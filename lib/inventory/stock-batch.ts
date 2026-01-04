"use server";

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";

// Types
export interface CreateBatchInput {
  stockItemId: string;
  warehouseId: string;
  batchNumber: string;
  quantity: number;
  unitCost: number;
  expirationDate?: Date;
}

export interface ConsumeBatchInput {
  batchId: string;
  quantity: number;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  createdById: string;
}

export interface ExpirationAlert {
  batchId: string;
  stockItemId: string;
  stockItemName: string;
  stockItemSku: string | null;
  warehouseId: string;
  warehouseName: string;
  batchNumber: string;
  quantity: number;
  unitCost: number;
  expirationDate: Date;
  daysUntilExpiration: number;
}

// ============================================================================
// Batch Creation
// ============================================================================

/**
 * Create a new stock batch
 * Requirements: 10.1
 * 
 * Property 37: Batch Receipt Creates Batch Record
 * For any stock receipt with batch number and expiration date, the system SHALL create
 * a StockBatch record with the provided batch number, expiration date, quantity, and unit cost.
 */
export async function createBatch(data: CreateBatchInput) {
  // Validate required fields
  if (!data.stockItemId || data.stockItemId.trim() === "") {
    return { error: "Stock item ID is required" };
  }

  if (!data.warehouseId || data.warehouseId.trim() === "") {
    return { error: "Warehouse ID is required" };
  }

  if (!data.batchNumber || data.batchNumber.trim() === "") {
    return { error: "Batch number is required" };
  }

  if (data.quantity === undefined || data.quantity === null) {
    return { error: "Quantity is required" };
  }

  if (data.quantity <= 0) {
    return { error: "Quantity must be greater than zero" };
  }

  if (data.unitCost === undefined || data.unitCost === null) {
    return { error: "Unit cost is required" };
  }

  if (data.unitCost < 0) {
    return { error: "Unit cost cannot be negative" };
  }

  try {
    // Verify stock item exists
    const stockItem = await db.stockItem.findUnique({
      where: { id: data.stockItemId },
    });

    if (!stockItem) {
      return { error: "Stock item not found" };
    }

    // Verify warehouse exists and is active
    const warehouse = await db.warehouse.findUnique({
      where: { id: data.warehouseId },
    });

    if (!warehouse) {
      return { error: "Warehouse not found" };
    }

    if (!warehouse.isActive) {
      return { error: "Cannot create batch in an inactive warehouse" };
    }

    // Create the batch
    const batch = await db.stockBatch.create({
      data: {
        stockItemId: data.stockItemId,
        warehouseId: data.warehouseId,
        batchNumber: data.batchNumber.trim(),
        quantity: data.quantity,
        unitCost: data.unitCost,
        expirationDate: data.expirationDate || null,
        isExpired: false,
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    revalidatePath("/admin/inventory");
    return { success: true, data: batch };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Unique constraint violation for batch number
      if (error.code === "P2002") {
        return {
          error: "A batch with this number already exists for this item in this warehouse",
        };
      }
    }
    console.error("Create Batch Error:", error);
    return { error: "Failed to create batch" };
  }
}

// ============================================================================
// Batch Queries
// ============================================================================

/**
 * Get a batch by ID
 */
export async function getBatchById(id: string) {
  try {
    const batch = await db.stockBatch.findUnique({
      where: { id },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: true,
            primaryUnit: {
              select: {
                abbreviation: true,
              },
            },
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        _count: {
          select: {
            movements: true,
            wasteRecords: true,
          },
        },
      },
    });

    return batch;
  } catch (error) {
    console.error("Get Batch By ID Error:", error);
    return null;
  }
}

/**
 * Get all batches for a stock item in a warehouse
 * Requirements: 10.2
 * 
 * Property 38: Batch Quantity Tracking
 * For any stock item with batches in a warehouse, the sum of all non-expired batch quantities
 * SHALL equal the total stock level quantity for that item-warehouse combination.
 */
export async function getBatchesByItem(
  stockItemId: string,
  warehouseId: string,
  options?: { includeExpired?: boolean }
) {
  try {
    const where: Prisma.StockBatchWhereInput = {
      stockItemId,
      warehouseId,
    };

    // By default, exclude expired batches
    if (!options?.includeExpired) {
      where.isExpired = false;
    }

    const batches = await db.stockBatch.findMany({
      where,
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
            primaryUnit: {
              select: {
                abbreviation: true,
              },
            },
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: [
        { expirationDate: "asc" }, // FEFO order
        { receivedAt: "asc" },
      ],
    });

    return batches;
  } catch (error) {
    console.error("Get Batches By Item Error:", error);
    return [];
  }
}

/**
 * Get all batches in a warehouse
 */
export async function getBatchesByWarehouse(
  warehouseId: string,
  options?: { includeExpired?: boolean }
) {
  try {
    const where: Prisma.StockBatchWhereInput = {
      warehouseId,
    };

    if (!options?.includeExpired) {
      where.isExpired = false;
    }

    const batches = await db.stockBatch.findMany({
      where,
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: true,
            primaryUnit: {
              select: {
                abbreviation: true,
              },
            },
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: [
        { expirationDate: "asc" },
        { receivedAt: "asc" },
      ],
    });

    return batches;
  } catch (error) {
    console.error("Get Batches By Warehouse Error:", error);
    return [];
  }
}

// ============================================================================
// FEFO (First Expired, First Out) Operations
// ============================================================================

/**
 * Get the next batch to consume using FEFO method
 * Requirements: 10.3
 * 
 * Property 39: FEFO Consumption Order
 * For any stock consumption without explicit batch selection, the system SHALL consume
 * from the batch with the earliest expiration date first (First Expired, First Out).
 */
export async function getNextBatchFEFO(
  stockItemId: string,
  warehouseId: string
) {
  try {
    // Get the batch with earliest expiration date that has quantity > 0 and is not expired
    // If no expiration date, use receivedAt (FIFO fallback)
    const batch = await db.stockBatch.findFirst({
      where: {
        stockItemId,
        warehouseId,
        isExpired: false,
        quantity: {
          gt: 0,
        },
      },
      orderBy: [
        // Batches with expiration dates come first, ordered by earliest expiration
        { expirationDate: "asc" },
        // For batches without expiration dates, use FIFO (first received)
        { receivedAt: "asc" },
      ],
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
            primaryUnit: {
              select: {
                abbreviation: true,
              },
            },
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    return batch;
  } catch (error) {
    console.error("Get Next Batch FEFO Error:", error);
    return null;
  }
}

/**
 * Get available (non-expired) quantity for a stock item in a warehouse
 * Property 41: Expired Batch Exclusion
 * For any batch where expirationDate < currentDate OR isExpired = true,
 * the batch quantity SHALL NOT be included in available stock calculations.
 */
export async function getAvailableBatchQuantity(
  stockItemId: string,
  warehouseId: string
): Promise<number> {
  try {
    const result = await db.stockBatch.aggregate({
      where: {
        stockItemId,
        warehouseId,
        isExpired: false,
        quantity: {
          gt: 0,
        },
      },
      _sum: {
        quantity: true,
      },
    });

    return Number(result._sum.quantity) || 0;
  } catch (error) {
    console.error("Get Available Batch Quantity Error:", error);
    return 0;
  }
}

// ============================================================================
// Batch Consumption
// ============================================================================

/**
 * Consume stock from a specific batch
 * Requirements: 10.3
 */
export async function consumeFromBatch(data: ConsumeBatchInput) {
  // Validate required fields
  if (!data.batchId || data.batchId.trim() === "") {
    return { error: "Batch ID is required" };
  }

  if (!data.createdById || data.createdById.trim() === "") {
    return { error: "Created by user ID is required" };
  }

  if (data.quantity === undefined || data.quantity === null) {
    return { error: "Quantity is required" };
  }

  if (data.quantity <= 0) {
    return { error: "Quantity must be greater than zero" };
  }

  try {
    // Get the batch
    const batch = await db.stockBatch.findUnique({
      where: { id: data.batchId },
      include: {
        stockItem: true,
        warehouse: true,
      },
    });

    if (!batch) {
      return { error: "Batch not found" };
    }

    if (batch.isExpired) {
      return { error: "Cannot consume from an expired batch" };
    }

    const batchQuantity = new Decimal(batch.quantity.toString());
    const consumeQuantity = new Decimal(data.quantity);

    if (batchQuantity.lessThan(consumeQuantity)) {
      return {
        error: `Insufficient batch quantity. Available: ${batchQuantity.toNumber()}, Requested: ${data.quantity}`,
      };
    }

    // Use transaction to ensure atomicity
    const result = await db.$transaction(async (tx) => {
      const newBatchQuantity = batchQuantity.sub(consumeQuantity);
      const unitCost = new Decimal(batch.unitCost.toString());
      const totalCost = consumeQuantity.mul(unitCost).toDecimalPlaces(2).toNumber();

      // Update batch quantity
      await tx.stockBatch.update({
        where: { id: data.batchId },
        data: {
          quantity: newBatchQuantity.toDecimalPlaces(3).toNumber(),
        },
      });

      // Update stock level
      const stockLevel = await tx.stockLevel.findUnique({
        where: {
          stockItemId_warehouseId: {
            stockItemId: batch.stockItemId,
            warehouseId: batch.warehouseId,
          },
        },
      });

      if (stockLevel) {
        const currentQuantity = new Decimal(stockLevel.quantity.toString());
        const newQuantity = currentQuantity.sub(consumeQuantity);

        await tx.stockLevel.update({
          where: {
            stockItemId_warehouseId: {
              stockItemId: batch.stockItemId,
              warehouseId: batch.warehouseId,
            },
          },
          data: {
            quantity: newQuantity.toDecimalPlaces(3).toNumber(),
          },
        });
      }

      // Create consumption movement
      const movement = await tx.stockMovement.create({
        data: {
          stockItemId: batch.stockItemId,
          sourceWarehouseId: batch.warehouseId,
          batchId: data.batchId,
          type: "CONSUMPTION",
          quantity: data.quantity,
          unitCost: unitCost.toDecimalPlaces(4).toNumber(),
          totalCost: totalCost,
          referenceType: data.referenceType || null,
          referenceId: data.referenceId || null,
          reason: data.reason || null,
          createdById: data.createdById,
        },
        include: {
          stockItem: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
          sourceWarehouse: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          batch: true,
        },
      });

      return {
        movement,
        previousBatchQuantity: batchQuantity.toNumber(),
        newBatchQuantity: newBatchQuantity.toNumber(),
      };
    });

    revalidatePath("/admin/inventory");
    return { success: true, data: result };
  } catch (error) {
    console.error("Consume From Batch Error:", error);
    return { error: "Failed to consume from batch" };
  }
}

/**
 * Consume stock using FEFO method (auto-select batches)
 * Requirements: 10.3
 * 
 * Property 39: FEFO Consumption Order
 * For any stock consumption without explicit batch selection, the system SHALL consume
 * from the batch with the earliest expiration date first (First Expired, First Out).
 */
export async function consumeStockFEFO(
  stockItemId: string,
  warehouseId: string,
  quantity: number,
  createdById: string,
  options?: {
    referenceType?: string;
    referenceId?: string;
    reason?: string;
  }
) {
  if (quantity <= 0) {
    return { error: "Quantity must be greater than zero" };
  }

  try {
    let remainingQuantity = new Decimal(quantity);
    const consumedBatches: Array<{
      batchId: string;
      batchNumber: string;
      quantity: number;
      unitCost: number;
    }> = [];

    // Use transaction to ensure atomicity
    const result = await db.$transaction(async (tx) => {
      // Get all available batches in FEFO order
      const batches = await tx.stockBatch.findMany({
        where: {
          stockItemId,
          warehouseId,
          isExpired: false,
          quantity: {
            gt: 0,
          },
        },
        orderBy: [
          { expirationDate: "asc" },
          { receivedAt: "asc" },
        ],
      });

      // Check if we have enough total quantity
      const totalAvailable = batches.reduce(
        (sum, b) => sum.add(new Decimal(b.quantity.toString())),
        new Decimal(0)
      );

      if (totalAvailable.lessThan(remainingQuantity)) {
        throw new Error(
          `Insufficient stock. Available: ${totalAvailable.toNumber()}, Requested: ${quantity}`
        );
      }

      // Consume from batches in FEFO order
      for (const batch of batches) {
        if (remainingQuantity.lte(0)) break;

        const batchQuantity = new Decimal(batch.quantity.toString());
        const consumeFromBatch = Decimal.min(batchQuantity, remainingQuantity);
        const newBatchQuantity = batchQuantity.sub(consumeFromBatch);
        const unitCost = new Decimal(batch.unitCost.toString());
        const totalCost = consumeFromBatch.mul(unitCost).toDecimalPlaces(2).toNumber();

        // Update batch quantity
        await tx.stockBatch.update({
          where: { id: batch.id },
          data: {
            quantity: newBatchQuantity.toDecimalPlaces(3).toNumber(),
          },
        });

        // Create consumption movement for this batch
        await tx.stockMovement.create({
          data: {
            stockItemId,
            sourceWarehouseId: warehouseId,
            batchId: batch.id,
            type: "CONSUMPTION",
            quantity: consumeFromBatch.toNumber(),
            unitCost: unitCost.toDecimalPlaces(4).toNumber(),
            totalCost: totalCost,
            referenceType: options?.referenceType || null,
            referenceId: options?.referenceId || null,
            reason: options?.reason || null,
            createdById,
          },
        });

        consumedBatches.push({
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          quantity: consumeFromBatch.toNumber(),
          unitCost: unitCost.toNumber(),
        });

        remainingQuantity = remainingQuantity.sub(consumeFromBatch);
      }

      // Update stock level
      const stockLevel = await tx.stockLevel.findUnique({
        where: {
          stockItemId_warehouseId: {
            stockItemId,
            warehouseId,
          },
        },
      });

      if (stockLevel) {
        const currentQuantity = new Decimal(stockLevel.quantity.toString());
        const newQuantity = currentQuantity.sub(new Decimal(quantity));

        await tx.stockLevel.update({
          where: {
            stockItemId_warehouseId: {
              stockItemId,
              warehouseId,
            },
          },
          data: {
            quantity: newQuantity.toDecimalPlaces(3).toNumber(),
          },
        });
      }

      return {
        totalConsumed: quantity,
        consumedBatches,
      };
    });

    revalidatePath("/admin/inventory");
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Insufficient stock")) {
        return { error: error.message };
      }
    }
    console.error("Consume Stock FEFO Error:", error);
    return { error: "Failed to consume stock" };
  }
}


// ============================================================================
// Expiration Alerts and Expired Batch Handling
// ============================================================================

/**
 * Get batches that are expiring within a threshold
 * Requirements: 10.4
 * 
 * Property 40: Expiration Alert Generation
 * For any batch where (expirationDate - currentDate) is less than or equal to
 * the configured alert threshold days, the system SHALL include that batch in expiration alerts.
 */
export async function getExpiringBatches(
  warehouseId: string,
  daysThreshold: number
): Promise<ExpirationAlert[]> {
  try {
    const now = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    // Get batches that:
    // 1. Have an expiration date
    // 2. Are not already marked as expired
    // 3. Have quantity > 0
    // 4. Expiration date is within the threshold
    const batches = await db.stockBatch.findMany({
      where: {
        warehouseId,
        isExpired: false,
        quantity: {
          gt: 0,
        },
        expirationDate: {
          not: null,
          lte: thresholdDate,
          gte: now, // Not yet expired
        },
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
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

    const alerts: ExpirationAlert[] = batches.map((batch) => {
      const expirationDate = batch.expirationDate as Date;
      const daysUntilExpiration = Math.ceil(
        (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        batchId: batch.id,
        stockItemId: batch.stockItem.id,
        stockItemName: batch.stockItem.name,
        stockItemSku: batch.stockItem.sku,
        warehouseId: batch.warehouse.id,
        warehouseName: batch.warehouse.name,
        batchNumber: batch.batchNumber,
        quantity: Number(batch.quantity),
        unitCost: Number(batch.unitCost),
        expirationDate: expirationDate,
        daysUntilExpiration,
      };
    });

    return alerts;
  } catch (error) {
    console.error("Get Expiring Batches Error:", error);
    return [];
  }
}

/**
 * Get expiring batches for a property (across all warehouses)
 * Requirements: 10.4
 */
export async function getExpiringBatchesByProperty(
  propertyId: string,
  daysThreshold: number
): Promise<ExpirationAlert[]> {
  try {
    const now = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    const batches = await db.stockBatch.findMany({
      where: {
        warehouse: {
          propertyId,
          isActive: true,
        },
        isExpired: false,
        quantity: {
          gt: 0,
        },
        expirationDate: {
          not: null,
          lte: thresholdDate,
          gte: now,
        },
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
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

    const alerts: ExpirationAlert[] = batches.map((batch) => {
      const expirationDate = batch.expirationDate as Date;
      const daysUntilExpiration = Math.ceil(
        (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        batchId: batch.id,
        stockItemId: batch.stockItem.id,
        stockItemName: batch.stockItem.name,
        stockItemSku: batch.stockItem.sku,
        warehouseId: batch.warehouse.id,
        warehouseName: batch.warehouse.name,
        batchNumber: batch.batchNumber,
        quantity: Number(batch.quantity),
        unitCost: Number(batch.unitCost),
        expirationDate: expirationDate,
        daysUntilExpiration,
      };
    });

    return alerts;
  } catch (error) {
    console.error("Get Expiring Batches By Property Error:", error);
    return [];
  }
}

/**
 * Get already expired batches (past expiration date but not yet marked)
 * Requirements: 10.5
 */
export async function getExpiredBatches(warehouseId: string) {
  try {
    const now = new Date();

    const batches = await db.stockBatch.findMany({
      where: {
        warehouseId,
        isExpired: false, // Not yet marked as expired
        quantity: {
          gt: 0,
        },
        expirationDate: {
          not: null,
          lt: now, // Past expiration date
        },
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
            primaryUnit: {
              select: {
                abbreviation: true,
              },
            },
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: {
        expirationDate: "asc",
      },
    });

    return batches;
  } catch (error) {
    console.error("Get Expired Batches Error:", error);
    return [];
  }
}

/**
 * Mark a batch as expired
 * Requirements: 10.5
 * 
 * Property 41: Expired Batch Exclusion
 * For any batch where expirationDate < currentDate OR isExpired = true,
 * the batch quantity SHALL NOT be included in available stock calculations.
 */
export async function markExpired(batchId: string) {
  try {
    const batch = await db.stockBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return { error: "Batch not found" };
    }

    if (batch.isExpired) {
      return { error: "Batch is already marked as expired" };
    }

    const updatedBatch = await db.stockBatch.update({
      where: { id: batchId },
      data: {
        isExpired: true,
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    revalidatePath("/admin/inventory");
    return { success: true, data: updatedBatch };
  } catch (error) {
    console.error("Mark Expired Error:", error);
    return { error: "Failed to mark batch as expired" };
  }
}

/**
 * Mark all expired batches in a warehouse
 * Requirements: 10.5
 */
export async function markAllExpiredBatches(warehouseId: string) {
  try {
    const now = new Date();

    const result = await db.stockBatch.updateMany({
      where: {
        warehouseId,
        isExpired: false,
        expirationDate: {
          not: null,
          lt: now,
        },
      },
      data: {
        isExpired: true,
      },
    });

    revalidatePath("/admin/inventory");
    return { success: true, count: result.count };
  } catch (error) {
    console.error("Mark All Expired Batches Error:", error);
    return { error: "Failed to mark expired batches" };
  }
}

/**
 * Unmark a batch as expired (for corrections)
 */
export async function unmarkExpired(batchId: string) {
  try {
    const batch = await db.stockBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return { error: "Batch not found" };
    }

    if (!batch.isExpired) {
      return { error: "Batch is not marked as expired" };
    }

    const updatedBatch = await db.stockBatch.update({
      where: { id: batchId },
      data: {
        isExpired: false,
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    revalidatePath("/admin/inventory");
    return { success: true, data: updatedBatch };
  } catch (error) {
    console.error("Unmark Expired Error:", error);
    return { error: "Failed to unmark batch as expired" };
  }
}

// ============================================================================
// Batch Update Operations
// ============================================================================

/**
 * Update batch quantity (for adjustments)
 */
export async function updateBatchQuantity(
  batchId: string,
  newQuantity: number,
  reason: string,
  createdById: string
) {
  if (newQuantity < 0) {
    return { error: "Quantity cannot be negative" };
  }

  if (!reason || reason.trim() === "") {
    return { error: "Reason is required for batch quantity adjustments" };
  }

  try {
    const batch = await db.stockBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return { error: "Batch not found" };
    }

    const oldQuantity = new Decimal(batch.quantity.toString());
    const newQty = new Decimal(newQuantity);
    const difference = newQty.sub(oldQuantity);

    // Use transaction to update batch and stock level
    const result = await db.$transaction(async (tx) => {
      // Update batch quantity
      const updatedBatch = await tx.stockBatch.update({
        where: { id: batchId },
        data: {
          quantity: newQty.toDecimalPlaces(3).toNumber(),
        },
        include: {
          stockItem: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      });

      // Update stock level
      const stockLevel = await tx.stockLevel.findUnique({
        where: {
          stockItemId_warehouseId: {
            stockItemId: batch.stockItemId,
            warehouseId: batch.warehouseId,
          },
        },
      });

      if (stockLevel) {
        const currentStockQuantity = new Decimal(stockLevel.quantity.toString());
        const newStockQuantity = currentStockQuantity.add(difference);

        await tx.stockLevel.update({
          where: {
            stockItemId_warehouseId: {
              stockItemId: batch.stockItemId,
              warehouseId: batch.warehouseId,
            },
          },
          data: {
            quantity: newStockQuantity.toDecimalPlaces(3).toNumber(),
          },
        });
      }

      // Create adjustment movement
      const unitCost = new Decimal(batch.unitCost.toString());
      const totalCost = difference.abs().mul(unitCost).toDecimalPlaces(2).toNumber();

      await tx.stockMovement.create({
        data: {
          stockItemId: batch.stockItemId,
          sourceWarehouseId: difference.isNegative() ? batch.warehouseId : null,
          destinationWarehouseId: difference.isPositive() ? batch.warehouseId : null,
          batchId: batchId,
          type: "ADJUSTMENT",
          quantity: difference.abs().toNumber(),
          unitCost: unitCost.toDecimalPlaces(4).toNumber(),
          totalCost: totalCost,
          reason: reason.trim(),
          createdById,
        },
      });

      return {
        batch: updatedBatch,
        previousQuantity: oldQuantity.toNumber(),
        newQuantity: newQty.toNumber(),
        difference: difference.toNumber(),
      };
    });

    revalidatePath("/admin/inventory");
    return { success: true, data: result };
  } catch (error) {
    console.error("Update Batch Quantity Error:", error);
    return { error: "Failed to update batch quantity" };
  }
}

/**
 * Update batch expiration date
 */
export async function updateBatchExpirationDate(
  batchId: string,
  expirationDate: Date | null
) {
  try {
    const batch = await db.stockBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return { error: "Batch not found" };
    }

    // If setting a new expiration date, check if it's in the past
    const now = new Date();
    const isExpired = expirationDate ? expirationDate < now : false;

    const updatedBatch = await db.stockBatch.update({
      where: { id: batchId },
      data: {
        expirationDate: expirationDate,
        isExpired: isExpired,
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    revalidatePath("/admin/inventory");
    return { success: true, data: updatedBatch };
  } catch (error) {
    console.error("Update Batch Expiration Date Error:", error);
    return { error: "Failed to update batch expiration date" };
  }
}

// ============================================================================
// Batch Reporting
// ============================================================================

/**
 * Generate expiration report for a warehouse
 * Requirements: 10.6
 */
export async function generateExpirationReport(
  warehouseId: string,
  daysAhead: number = 30
) {
  try {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    // Get all batches with expiration dates
    const batches = await db.stockBatch.findMany({
      where: {
        warehouseId,
        quantity: {
          gt: 0,
        },
        expirationDate: {
          not: null,
        },
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: true,
            primaryUnit: {
              select: {
                abbreviation: true,
              },
            },
          },
        },
      },
      orderBy: {
        expirationDate: "asc",
      },
    });

    // Categorize batches
    const expired: typeof batches = [];
    const expiringWithinThreshold: typeof batches = [];
    const safe: typeof batches = [];

    for (const batch of batches) {
      const expirationDate = batch.expirationDate as Date;
      
      if (batch.isExpired || expirationDate < now) {
        expired.push(batch);
      } else if (expirationDate <= futureDate) {
        expiringWithinThreshold.push(batch);
      } else {
        safe.push(batch);
      }
    }

    // Calculate totals
    const expiredValue = expired.reduce(
      (sum, b) => sum + Number(b.quantity) * Number(b.unitCost),
      0
    );
    const expiringValue = expiringWithinThreshold.reduce(
      (sum, b) => sum + Number(b.quantity) * Number(b.unitCost),
      0
    );
    const safeValue = safe.reduce(
      (sum, b) => sum + Number(b.quantity) * Number(b.unitCost),
      0
    );

    return {
      reportDate: now,
      warehouseId,
      daysAhead,
      summary: {
        expiredCount: expired.length,
        expiredValue,
        expiringCount: expiringWithinThreshold.length,
        expiringValue,
        safeCount: safe.length,
        safeValue,
        totalBatches: batches.length,
        totalValue: expiredValue + expiringValue + safeValue,
      },
      expired: expired.map((b) => ({
        batchId: b.id,
        batchNumber: b.batchNumber,
        stockItemId: b.stockItem.id,
        stockItemName: b.stockItem.name,
        stockItemSku: b.stockItem.sku,
        category: b.stockItem.category,
        quantity: Number(b.quantity),
        unitCost: Number(b.unitCost),
        totalValue: Number(b.quantity) * Number(b.unitCost),
        expirationDate: b.expirationDate,
        unit: b.stockItem.primaryUnit.abbreviation,
      })),
      expiring: expiringWithinThreshold.map((b) => ({
        batchId: b.id,
        batchNumber: b.batchNumber,
        stockItemId: b.stockItem.id,
        stockItemName: b.stockItem.name,
        stockItemSku: b.stockItem.sku,
        category: b.stockItem.category,
        quantity: Number(b.quantity),
        unitCost: Number(b.unitCost),
        totalValue: Number(b.quantity) * Number(b.unitCost),
        expirationDate: b.expirationDate,
        daysUntilExpiration: Math.ceil(
          ((b.expirationDate as Date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        ),
        unit: b.stockItem.primaryUnit.abbreviation,
      })),
    };
  } catch (error) {
    console.error("Generate Expiration Report Error:", error);
    return null;
  }
}
