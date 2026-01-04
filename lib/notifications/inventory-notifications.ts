"use server";

import { db } from "@/lib/db";
import {
  createLowStockNotification,
  createExpiringBatchNotification,
  notifyWarehouseUsersLowStock,
} from "./notification";

// ============================================================================
// Low Stock Notifications
// ============================================================================

/**
 * Check if stock level is below par level and create notifications
 * 
 * Requirements: 15.1
 * 
 * This function should be called after any stock movement that decreases quantity
 * (consumption, transfer out, waste, adjustment)
 */
export async function checkAndNotifyLowStock(
  stockItemId: string,
  warehouseId: string
) {
  try {
    // Get current stock level
    const stockLevel = await db.stockLevel.findUnique({
      where: {
        stockItemId_warehouseId: {
          stockItemId,
          warehouseId,
        },
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!stockLevel) {
      return { success: true, notified: false, reason: "No stock level found" };
    }

    // Get par level for this item in this warehouse
    const parLevel = await db.stockParLevel.findUnique({
      where: {
        stockItemId_warehouseId: {
          stockItemId,
          warehouseId,
        },
      },
    });

    if (!parLevel) {
      return { success: true, notified: false, reason: "No par level configured" };
    }

    const currentQuantity = Number(stockLevel.quantity);
    const parLevelValue = Number(parLevel.parLevel);

    // Check if below par level
    if (currentQuantity >= parLevelValue) {
      return { success: true, notified: false, reason: "Stock level is above par" };
    }

    // Notify all users with access to this warehouse
    const result = await notifyWarehouseUsersLowStock(
      warehouseId,
      stockLevel.stockItem.name,
      stockLevel.warehouse.name,
      currentQuantity,
      parLevelValue,
      stockItemId
    );

    return { success: true, notified: true, result };
  } catch (error) {
    console.error("Check and Notify Low Stock Error:", error);
    return { error: "Failed to check and notify low stock" };
  }
}

/**
 * Check all stock items in a warehouse for low stock and create notifications
 */
export async function checkWarehouseLowStock(warehouseId: string) {
  try {
    // Get all stock levels with par levels for this warehouse
    const stockLevels = await db.stockLevel.findMany({
      where: {
        warehouseId,
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            parLevels: {
              where: {
                warehouseId,
              },
            },
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const lowStockItems: Array<{
      stockItemId: string;
      stockItemName: string;
      currentQuantity: number;
      parLevel: number;
    }> = [];

    for (const stockLevel of stockLevels) {
      const parLevel = stockLevel.stockItem.parLevels[0];
      if (!parLevel) continue;

      const currentQuantity = Number(stockLevel.quantity);
      const parLevelValue = Number(parLevel.parLevel);

      if (currentQuantity < parLevelValue) {
        lowStockItems.push({
          stockItemId: stockLevel.stockItem.id,
          stockItemName: stockLevel.stockItem.name,
          currentQuantity,
          parLevel: parLevelValue,
        });
      }
    }

    if (lowStockItems.length === 0) {
      return { success: true, notified: 0 };
    }

    // Get warehouse name
    const warehouse = await db.warehouse.findUnique({
      where: { id: warehouseId },
      select: { name: true },
    });

    if (!warehouse) {
      return { error: "Warehouse not found" };
    }

    // Notify for each low stock item
    let notifiedCount = 0;
    for (const item of lowStockItems) {
      const result = await notifyWarehouseUsersLowStock(
        warehouseId,
        item.stockItemName,
        warehouse.name,
        item.currentQuantity,
        item.parLevel,
        item.stockItemId
      );

      if (result.success) {
        notifiedCount++;
      }
    }

    return { success: true, notified: notifiedCount, lowStockItems };
  } catch (error) {
    console.error("Check Warehouse Low Stock Error:", error);
    return { error: "Failed to check warehouse low stock" };
  }
}


// ============================================================================
// Expiring Batch Notifications
// ============================================================================

/**
 * Check for expiring batches and create notifications
 * 
 * Requirements: 15.4
 * 
 * This function should be called periodically (e.g., daily) to check for batches
 * that are expiring within the configured threshold
 */
export async function checkAndNotifyExpiringBatches(
  warehouseId: string,
  thresholdDays: number = 7
) {
  try {
    const now = new Date();
    const thresholdDate = new Date(now.getTime() + thresholdDays * 24 * 60 * 60 * 1000);

    // Get batches expiring within threshold
    const expiringBatches = await db.stockBatch.findMany({
      where: {
        warehouseId,
        isExpired: false,
        quantity: {
          gt: 0,
        },
        expirationDate: {
          not: null,
          lte: thresholdDate,
          gt: now, // Not yet expired
        },
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        expirationDate: "asc",
      },
    });

    if (expiringBatches.length === 0) {
      return { success: true, notified: 0 };
    }

    // Get users with access to this warehouse
    const userAccesses = await db.userWarehouseAccess.findMany({
      where: {
        warehouseId,
        accessLevel: { in: ["MANAGE", "ADMIN"] },
      },
      select: { userId: true },
    });

    if (userAccesses.length === 0) {
      return { success: true, notified: 0, reason: "No users with access to warehouse" };
    }

    // Create notifications for each user for each expiring batch
    let notifiedCount = 0;
    for (const batch of expiringBatches) {
      if (!batch.expirationDate) continue;

      for (const access of userAccesses) {
        const result = await createExpiringBatchNotification(
          access.userId,
          batch.stockItem.name,
          batch.batchNumber,
          batch.expirationDate,
          batch.warehouse.name,
          batch.stockItem.id,
          batch.id,
          batch.warehouseId
        );

        if (result.success) {
          notifiedCount++;
        }
      }
    }

    return {
      success: true,
      notified: notifiedCount,
      expiringBatches: expiringBatches.length,
    };
  } catch (error) {
    console.error("Check and Notify Expiring Batches Error:", error);
    return { error: "Failed to check and notify expiring batches" };
  }
}

/**
 * Check all warehouses for expiring batches
 */
export async function checkAllWarehousesExpiringBatches(thresholdDays: number = 7) {
  try {
    // Get all active warehouses
    const warehouses = await db.warehouse.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    const results: Array<{
      warehouseId: string;
      warehouseName: string;
      notified: number;
      expiringBatches: number;
    }> = [];

    for (const warehouse of warehouses) {
      const result = await checkAndNotifyExpiringBatches(warehouse.id, thresholdDays);
      
      if (result.success) {
        results.push({
          warehouseId: warehouse.id,
          warehouseName: warehouse.name,
          notified: result.notified || 0,
          expiringBatches: result.expiringBatches || 0,
        });
      }
    }

    const totalNotified = results.reduce((sum, r) => sum + r.notified, 0);
    const totalExpiringBatches = results.reduce((sum, r) => sum + r.expiringBatches, 0);

    return {
      success: true,
      totalNotified,
      totalExpiringBatches,
      results,
    };
  } catch (error) {
    console.error("Check All Warehouses Expiring Batches Error:", error);
    return { error: "Failed to check all warehouses for expiring batches" };
  }
}

/**
 * Check for a specific batch expiration and notify if within threshold
 */
export async function checkBatchExpirationAndNotify(
  batchId: string,
  thresholdDays: number = 7
) {
  try {
    const batch = await db.stockBatch.findUnique({
      where: { id: batchId },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!batch) {
      return { error: "Batch not found" };
    }

    if (!batch.expirationDate) {
      return { success: true, notified: false, reason: "Batch has no expiration date" };
    }

    if (batch.isExpired) {
      return { success: true, notified: false, reason: "Batch is already expired" };
    }

    const now = new Date();
    const thresholdDate = new Date(now.getTime() + thresholdDays * 24 * 60 * 60 * 1000);

    if (batch.expirationDate > thresholdDate) {
      return { success: true, notified: false, reason: "Batch is not expiring within threshold" };
    }

    // Get users with access to this warehouse
    const userAccesses = await db.userWarehouseAccess.findMany({
      where: {
        warehouseId: batch.warehouseId,
        accessLevel: { in: ["MANAGE", "ADMIN"] },
      },
      select: { userId: true },
    });

    if (userAccesses.length === 0) {
      return { success: true, notified: 0, reason: "No users with access to warehouse" };
    }

    // Create notifications for each user
    let notifiedCount = 0;
    for (const access of userAccesses) {
      const result = await createExpiringBatchNotification(
        access.userId,
        batch.stockItem.name,
        batch.batchNumber,
        batch.expirationDate,
        batch.warehouse.name,
        batch.stockItem.id,
        batch.id,
        batch.warehouseId
      );

      if (result.success) {
        notifiedCount++;
      }
    }

    return { success: true, notified: notifiedCount };
  } catch (error) {
    console.error("Check Batch Expiration and Notify Error:", error);
    return { error: "Failed to check batch expiration and notify" };
  }
}
