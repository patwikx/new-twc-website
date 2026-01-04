"use server";

import { db } from "@/lib/db";
import { MovementType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import { logStockMovement, logStockAdjustment } from "@/lib/audit/inventory-audit";

// Types
export interface ReceiveStockInput {
  stockItemId: string;
  warehouseId: string;
  quantity: number;
  unitCost: number;
  batchNumber?: string;
  expirationDate?: Date;
  referenceType?: string;
  referenceId?: string;
  createdById: string;
}

export interface TransferStockInput {
  stockItemId: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  quantity: number;
  batchId?: string;
  referenceType?: string;
  referenceId?: string;
  createdById: string;
}

export interface ConsumeStockInput {
  stockItemId: string;
  warehouseId: string;
  quantity: number;
  batchId?: string;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  createdById: string;
}

export interface AdjustStockInput {
  stockItemId: string;
  warehouseId: string;
  quantity: number; // Positive for increase, negative for decrease
  reason: string;
  batchId?: string;
  referenceType?: string;
  referenceId?: string;
  createdById: string;
}

export interface MovementHistoryQuery {
  stockItemId?: string;
  warehouseId?: string;
  type?: MovementType;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

// Valid movement types for validation
const VALID_MOVEMENT_TYPES: MovementType[] = [
  "RECEIPT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "CONSUMPTION",
  "ADJUSTMENT",
  "RETURN",
  "WASTE",
];

/**
 * Validate movement type enum
 */
function isValidMovementType(type: string): type is MovementType {
  return VALID_MOVEMENT_TYPES.includes(type as MovementType);
}


// ============================================================================
// Stock Receipt Operations
// ============================================================================

/**
 * Receive stock into a warehouse
 * Requirements: 3.1, 3.2, 3.6
 * 
 * Property 9: Stock Movement Required Fields
 * For any stock movement record, it SHALL have non-null values for: type, quantity, timestamp (createdAt), and createdById.
 * 
 * Property 10: Stock Receipt Increases Quantity
 * For any stock receipt of quantity Q for item I in warehouse W, the stock level for (I, W) SHALL increase by exactly Q.
 * 
 * Property 13: Weighted Average Cost Calculation
 * For any stock receipt of quantity Q at unit cost C into a warehouse where existing quantity is Q_old at average cost C_old,
 * the new average cost SHALL be: newAvgCost = (Q_old × C_old + Q × C) / (Q_old + Q).
 */
export async function receiveStock(data: ReceiveStockInput) {
  // Property 9: Validate required fields
  if (!data.stockItemId || data.stockItemId.trim() === "") {
    return { error: "Stock item ID is required" };
  }

  if (!data.warehouseId || data.warehouseId.trim() === "") {
    return { error: "Warehouse ID is required" };
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
      return { error: "Cannot receive stock into an inactive warehouse" };
    }

    // Use transaction to ensure atomicity
    const result = await db.$transaction(async (tx) => {
      // Get current stock level (if exists)
      const currentStockLevel = await tx.stockLevel.findUnique({
        where: {
          stockItemId_warehouseId: {
            stockItemId: data.stockItemId,
            warehouseId: data.warehouseId,
          },
        },
      });

      // Property 13: Calculate weighted average cost
      const currentQuantity = currentStockLevel
        ? new Decimal(currentStockLevel.quantity.toString())
        : new Decimal(0);
      const currentAvgCost = currentStockLevel
        ? new Decimal(currentStockLevel.averageCost.toString())
        : new Decimal(0);
      const newQuantity = new Decimal(data.quantity);
      const newUnitCost = new Decimal(data.unitCost);

      // newAvgCost = (Q_old × C_old + Q × C) / (Q_old + Q)
      const totalOldValue = currentQuantity.mul(currentAvgCost);
      const totalNewValue = newQuantity.mul(newUnitCost);
      const totalQuantity = currentQuantity.add(newQuantity);
      
      const newAvgCost = totalQuantity.isZero()
        ? newUnitCost
        : totalOldValue.add(totalNewValue).div(totalQuantity);

      // Property 10: Update stock level (create if not exists)
      const stockLevel = await tx.stockLevel.upsert({
        where: {
          stockItemId_warehouseId: {
            stockItemId: data.stockItemId,
            warehouseId: data.warehouseId,
          },
        },
        update: {
          quantity: totalQuantity.toDecimalPlaces(3).toNumber(),
          averageCost: newAvgCost.toDecimalPlaces(4).toNumber(),
        },
        create: {
          stockItemId: data.stockItemId,
          warehouseId: data.warehouseId,
          quantity: newQuantity.toDecimalPlaces(3).toNumber(),
          averageCost: newUnitCost.toDecimalPlaces(4).toNumber(),
        },
      });

      // Create batch record if batch info provided
      let batchId: string | undefined;
      if (data.batchNumber) {
        const batch = await tx.stockBatch.create({
          data: {
            stockItemId: data.stockItemId,
            warehouseId: data.warehouseId,
            batchNumber: data.batchNumber,
            quantity: data.quantity,
            unitCost: data.unitCost,
            expirationDate: data.expirationDate || null,
            isExpired: false,
          },
        });
        batchId = batch.id;
      }

      // Create stock movement record
      const totalCost = newQuantity.mul(newUnitCost).toDecimalPlaces(2).toNumber();
      
      const movement = await tx.stockMovement.create({
        data: {
          stockItemId: data.stockItemId,
          destinationWarehouseId: data.warehouseId,
          batchId: batchId || null,
          type: "RECEIPT",
          quantity: data.quantity,
          unitCost: data.unitCost,
          totalCost: totalCost,
          referenceType: data.referenceType || null,
          referenceId: data.referenceId || null,
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
          destinationWarehouse: {
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
        movementId: movement.id,
        stockLevelId: stockLevel.id,
        newQuantity: Number(stockLevel.quantity),
        newAverageCost: Number(stockLevel.averageCost),
      };
    });

    // Log the stock receipt for audit trail
    await logStockMovement({
      userId: data.createdById,
      action: "RECEIVE",
      movementId: result.movementId,
      movementData: {
        stockItemId: data.stockItemId,
        warehouseId: data.warehouseId,
        quantity: data.quantity,
        unitCost: data.unitCost,
        batchNumber: data.batchNumber,
        type: "RECEIPT",
      },
    });

    revalidatePath("/admin/inventory");
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Unique constraint violation for batch number
      if (error.code === "P2002") {
        return {
          error: "A batch with this number already exists for this item in this warehouse",
        };
      }
    }
    console.error("Receive Stock Error:", error);
    return { error: "Failed to receive stock" };
  }
}

/**
 * Get weighted average cost for a stock item in a warehouse
 * Requirements: 3.6
 */
export async function getWeightedAverageCost(
  stockItemId: string,
  warehouseId: string
): Promise<number> {
  try {
    const stockLevel = await db.stockLevel.findUnique({
      where: {
        stockItemId_warehouseId: {
          stockItemId,
          warehouseId,
        },
      },
    });

    return stockLevel ? Number(stockLevel.averageCost) : 0;
  } catch (error) {
    console.error("Get Weighted Average Cost Error:", error);
    return 0;
  }
}


// ============================================================================
// Stock Transfer Operations
// ============================================================================

/**
 * Transfer stock between warehouses
 * Requirements: 3.3
 * 
 * Property 11: Stock Transfer Conservation (Invariant)
 * For any stock transfer of quantity Q from warehouse A to warehouse B for item I,
 * the total quantity of item I across both warehouses SHALL remain unchanged.
 * Specifically: A.quantity_after + B.quantity_after = A.quantity_before + B.quantity_before.
 */
export async function transferStock(data: TransferStockInput) {
  // Validate required fields
  if (!data.stockItemId || data.stockItemId.trim() === "") {
    return { error: "Stock item ID is required" };
  }

  if (!data.sourceWarehouseId || data.sourceWarehouseId.trim() === "") {
    return { error: "Source warehouse ID is required" };
  }

  if (!data.destinationWarehouseId || data.destinationWarehouseId.trim() === "") {
    return { error: "Destination warehouse ID is required" };
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

  if (data.sourceWarehouseId === data.destinationWarehouseId) {
    return { error: "Source and destination warehouses must be different" };
  }

  try {
    // Verify stock item exists
    const stockItem = await db.stockItem.findUnique({
      where: { id: data.stockItemId },
    });

    if (!stockItem) {
      return { error: "Stock item not found" };
    }

    // Verify source warehouse exists and is active
    const sourceWarehouse = await db.warehouse.findUnique({
      where: { id: data.sourceWarehouseId },
    });

    if (!sourceWarehouse) {
      return { error: "Source warehouse not found" };
    }

    if (!sourceWarehouse.isActive) {
      return { error: "Cannot transfer from an inactive warehouse" };
    }

    // Verify destination warehouse exists and is active
    const destWarehouse = await db.warehouse.findUnique({
      where: { id: data.destinationWarehouseId },
    });

    if (!destWarehouse) {
      return { error: "Destination warehouse not found" };
    }

    if (!destWarehouse.isActive) {
      return { error: "Cannot transfer to an inactive warehouse" };
    }

    // Use transaction to ensure atomicity (Property 11: Conservation)
    const result = await db.$transaction(async (tx) => {
      // Get current stock level in source warehouse
      const sourceStockLevel = await tx.stockLevel.findUnique({
        where: {
          stockItemId_warehouseId: {
            stockItemId: data.stockItemId,
            warehouseId: data.sourceWarehouseId,
          },
        },
      });

      if (!sourceStockLevel) {
        throw new Error("No stock available in source warehouse");
      }

      const sourceQuantity = new Decimal(sourceStockLevel.quantity.toString());
      const transferQuantity = new Decimal(data.quantity);

      // Validate sufficient stock in source warehouse
      if (sourceQuantity.lessThan(transferQuantity)) {
        throw new Error(
          `Insufficient stock. Available: ${sourceQuantity.toNumber()}, Requested: ${data.quantity}`
        );
      }

      const sourceAvgCost = new Decimal(sourceStockLevel.averageCost.toString());

      // Get current stock level in destination warehouse (if exists)
      const destStockLevel = await tx.stockLevel.findUnique({
        where: {
          stockItemId_warehouseId: {
            stockItemId: data.stockItemId,
            warehouseId: data.destinationWarehouseId,
          },
        },
      });

      // Calculate new quantities
      const newSourceQuantity = sourceQuantity.sub(transferQuantity);
      
      // Calculate weighted average cost for destination
      const destQuantity = destStockLevel
        ? new Decimal(destStockLevel.quantity.toString())
        : new Decimal(0);
      const destAvgCost = destStockLevel
        ? new Decimal(destStockLevel.averageCost.toString())
        : new Decimal(0);

      const totalDestValue = destQuantity.mul(destAvgCost);
      const transferValue = transferQuantity.mul(sourceAvgCost);
      const newDestQuantity = destQuantity.add(transferQuantity);
      
      const newDestAvgCost = newDestQuantity.isZero()
        ? sourceAvgCost
        : totalDestValue.add(transferValue).div(newDestQuantity);

      // Update source stock level
      await tx.stockLevel.update({
        where: {
          stockItemId_warehouseId: {
            stockItemId: data.stockItemId,
            warehouseId: data.sourceWarehouseId,
          },
        },
        data: {
          quantity: newSourceQuantity.toDecimalPlaces(3).toNumber(),
        },
      });

      // Update or create destination stock level
      await tx.stockLevel.upsert({
        where: {
          stockItemId_warehouseId: {
            stockItemId: data.stockItemId,
            warehouseId: data.destinationWarehouseId,
          },
        },
        update: {
          quantity: newDestQuantity.toDecimalPlaces(3).toNumber(),
          averageCost: newDestAvgCost.toDecimalPlaces(4).toNumber(),
        },
        create: {
          stockItemId: data.stockItemId,
          warehouseId: data.destinationWarehouseId,
          quantity: transferQuantity.toDecimalPlaces(3).toNumber(),
          averageCost: sourceAvgCost.toDecimalPlaces(4).toNumber(),
        },
      });

      const totalCost = transferQuantity.mul(sourceAvgCost).toDecimalPlaces(2).toNumber();

      // Create TRANSFER_OUT movement
      const outMovement = await tx.stockMovement.create({
        data: {
          stockItemId: data.stockItemId,
          sourceWarehouseId: data.sourceWarehouseId,
          destinationWarehouseId: data.destinationWarehouseId,
          batchId: data.batchId || null,
          type: "TRANSFER_OUT",
          quantity: data.quantity,
          unitCost: sourceAvgCost.toDecimalPlaces(4).toNumber(),
          totalCost: totalCost,
          referenceType: data.referenceType || null,
          referenceId: data.referenceId || null,
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
          destinationWarehouse: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      });

      // Create TRANSFER_IN movement
      const inMovement = await tx.stockMovement.create({
        data: {
          stockItemId: data.stockItemId,
          sourceWarehouseId: data.sourceWarehouseId,
          destinationWarehouseId: data.destinationWarehouseId,
          batchId: data.batchId || null,
          type: "TRANSFER_IN",
          quantity: data.quantity,
          unitCost: sourceAvgCost.toDecimalPlaces(4).toNumber(),
          totalCost: totalCost,
          referenceType: data.referenceType || null,
          referenceId: data.referenceId || null,
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
          destinationWarehouse: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      });

      return { 
        outMovementId: outMovement.id, 
        inMovementId: inMovement.id,
        quantity: data.quantity,
      };
    });

    // Log the stock transfer for audit trail
    await logStockMovement({
      userId: data.createdById,
      action: "TRANSFER",
      movementId: result.outMovementId,
      movementData: {
        stockItemId: data.stockItemId,
        sourceWarehouseId: data.sourceWarehouseId,
        destinationWarehouseId: data.destinationWarehouseId,
        quantity: data.quantity,
        type: "TRANSFER",
      },
    });

    revalidatePath("/admin/inventory");
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof Error) {
      // Handle known business logic errors
      if (
        error.message.includes("Insufficient stock") ||
        error.message.includes("No stock available")
      ) {
        return { error: error.message };
      }
    }
    console.error("Transfer Stock Error:", error);
    return { error: "Failed to transfer stock" };
  }
}


// ============================================================================
// Stock Consumption Operations
// ============================================================================

/**
 * Consume stock from a warehouse (e.g., for recipe production)
 * Requirements: 3.4
 */
export async function consumeStock(data: ConsumeStockInput) {
  // Validate required fields
  if (!data.stockItemId || data.stockItemId.trim() === "") {
    return { error: "Stock item ID is required" };
  }

  if (!data.warehouseId || data.warehouseId.trim() === "") {
    return { error: "Warehouse ID is required" };
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
      return { error: "Cannot consume stock from an inactive warehouse" };
    }

    // Use transaction to ensure atomicity
    const result = await db.$transaction(async (tx) => {
      // Get current stock level
      const stockLevel = await tx.stockLevel.findUnique({
        where: {
          stockItemId_warehouseId: {
            stockItemId: data.stockItemId,
            warehouseId: data.warehouseId,
          },
        },
      });

      if (!stockLevel) {
        throw new Error("No stock available in warehouse");
      }

      const currentQuantity = new Decimal(stockLevel.quantity.toString());
      const consumeQuantity = new Decimal(data.quantity);

      // Validate sufficient stock
      if (currentQuantity.lessThan(consumeQuantity)) {
        throw new Error(
          `Insufficient stock. Available: ${currentQuantity.toNumber()}, Requested: ${data.quantity}`
        );
      }

      const avgCost = new Decimal(stockLevel.averageCost.toString());
      const newQuantity = currentQuantity.sub(consumeQuantity);

      // Update stock level
      await tx.stockLevel.update({
        where: {
          stockItemId_warehouseId: {
            stockItemId: data.stockItemId,
            warehouseId: data.warehouseId,
          },
        },
        data: {
          quantity: newQuantity.toDecimalPlaces(3).toNumber(),
        },
      });

      const totalCost = consumeQuantity.mul(avgCost).toDecimalPlaces(2).toNumber();

      // Create CONSUMPTION movement
      const movement = await tx.stockMovement.create({
        data: {
          stockItemId: data.stockItemId,
          sourceWarehouseId: data.warehouseId,
          batchId: data.batchId || null,
          type: "CONSUMPTION",
          quantity: data.quantity,
          unitCost: avgCost.toDecimalPlaces(4).toNumber(),
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
        },
      });

      return { movementId: movement.id, newQuantity: newQuantity.toNumber() };
    });

    // Log the stock consumption for audit trail
    await logStockMovement({
      userId: data.createdById,
      action: "UPDATE",
      movementId: result.movementId,
      movementData: {
        stockItemId: data.stockItemId,
        warehouseId: data.warehouseId,
        quantity: data.quantity,
        reason: data.reason,
        type: "CONSUMPTION",
      },
    });

    revalidatePath("/admin/inventory");
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes("Insufficient stock") ||
        error.message.includes("No stock available")
      ) {
        return { error: error.message };
      }
    }
    console.error("Consume Stock Error:", error);
    return { error: "Failed to consume stock" };
  }
}

// ============================================================================
// Stock Adjustment Operations
// ============================================================================

/**
 * Adjust stock quantity (for count corrections)
 * Requirements: 3.5
 * 
 * Property 12: Stock Adjustment Requires Reason
 * For any stock adjustment movement, the reason field SHALL be non-null and non-empty.
 * Adjustments without a reason SHALL be rejected.
 */
export async function adjustStock(data: AdjustStockInput) {
  // Validate required fields
  if (!data.stockItemId || data.stockItemId.trim() === "") {
    return { error: "Stock item ID is required" };
  }

  if (!data.warehouseId || data.warehouseId.trim() === "") {
    return { error: "Warehouse ID is required" };
  }

  if (!data.createdById || data.createdById.trim() === "") {
    return { error: "Created by user ID is required" };
  }

  if (data.quantity === undefined || data.quantity === null) {
    return { error: "Quantity is required" };
  }

  if (data.quantity === 0) {
    return { error: "Adjustment quantity cannot be zero" };
  }

  // Property 12: Validate reason is required
  if (!data.reason || data.reason.trim() === "") {
    return { error: "Reason is required for stock adjustments" };
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
      return { error: "Cannot adjust stock in an inactive warehouse" };
    }

    // Use transaction to ensure atomicity
    const result = await db.$transaction(async (tx) => {
      // Get current stock level (if exists)
      const stockLevel = await tx.stockLevel.findUnique({
        where: {
          stockItemId_warehouseId: {
            stockItemId: data.stockItemId,
            warehouseId: data.warehouseId,
          },
        },
      });

      const currentQuantity = stockLevel
        ? new Decimal(stockLevel.quantity.toString())
        : new Decimal(0);
      const adjustmentQuantity = new Decimal(data.quantity);
      const newQuantity = currentQuantity.add(adjustmentQuantity);

      // Validate new quantity is not negative
      if (newQuantity.lessThan(0)) {
        throw new Error(
          `Adjustment would result in negative stock. Current: ${currentQuantity.toNumber()}, Adjustment: ${data.quantity}`
        );
      }

      // Get or set average cost
      const avgCost = stockLevel
        ? new Decimal(stockLevel.averageCost.toString())
        : new Decimal(0);

      // Update or create stock level
      await tx.stockLevel.upsert({
        where: {
          stockItemId_warehouseId: {
            stockItemId: data.stockItemId,
            warehouseId: data.warehouseId,
          },
        },
        update: {
          quantity: newQuantity.toDecimalPlaces(3).toNumber(),
        },
        create: {
          stockItemId: data.stockItemId,
          warehouseId: data.warehouseId,
          quantity: newQuantity.toDecimalPlaces(3).toNumber(),
          averageCost: 0, // No cost for initial adjustment
        },
      });

      const totalCost = adjustmentQuantity.abs().mul(avgCost).toDecimalPlaces(2).toNumber();

      // Create ADJUSTMENT movement
      // Use sourceWarehouseId for negative adjustments, destinationWarehouseId for positive
      const movement = await tx.stockMovement.create({
        data: {
          stockItemId: data.stockItemId,
          sourceWarehouseId: data.quantity < 0 ? data.warehouseId : null,
          destinationWarehouseId: data.quantity > 0 ? data.warehouseId : null,
          batchId: data.batchId || null,
          type: "ADJUSTMENT",
          quantity: Math.abs(data.quantity),
          unitCost: avgCost.toDecimalPlaces(4).toNumber(),
          totalCost: totalCost,
          referenceType: data.referenceType || null,
          referenceId: data.referenceId || null,
          reason: data.reason.trim(),
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
          destinationWarehouse: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      });

      return {
        movementId: movement.id,
        previousQuantity: currentQuantity.toNumber(),
        newQuantity: newQuantity.toNumber(),
        variance: adjustmentQuantity.toNumber(),
      };
    });

    // Log the stock adjustment for audit trail
    await logStockAdjustment({
      userId: data.createdById,
      adjustmentId: result.movementId,
      stockItemId: data.stockItemId,
      warehouseId: data.warehouseId,
      previousQuantity: result.previousQuantity,
      newQuantity: result.newQuantity,
      reason: data.reason,
    });

    revalidatePath("/admin/inventory");
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("negative stock")) {
        return { error: error.message };
      }
    }
    console.error("Adjust Stock Error:", error);
    return { error: "Failed to adjust stock" };
  }
}


// ============================================================================
// Movement History and Queries
// ============================================================================

/**
 * Get stock movement history with filtering
 */
export async function getMovementHistory(query?: MovementHistoryQuery) {
  try {
    const where: Prisma.StockMovementWhereInput = {};

    if (query?.stockItemId) {
      where.stockItemId = query.stockItemId;
    }

    if (query?.warehouseId) {
      where.OR = [
        { sourceWarehouseId: query.warehouseId },
        { destinationWarehouseId: query.warehouseId },
      ];
    }

    if (query?.type) {
      where.type = query.type;
    }

    if (query?.startDate || query?.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = query.startDate;
      }
      if (query.endDate) {
        where.createdAt.lte = query.endDate;
      }
    }

    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const [movements, total] = await Promise.all([
      db.stockMovement.findMany({
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
          sourceWarehouse: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          destinationWarehouse: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          batch: {
            select: {
              id: true,
              batchNumber: true,
              expirationDate: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.stockMovement.count({ where }),
    ]);

    return {
      movements,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Get Movement History Error:", error);
    return {
      movements: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    };
  }
}

/**
 * Get a single stock movement by ID
 */
export async function getMovementById(id: string) {
  try {
    const movement = await db.stockMovement.findUnique({
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
        sourceWarehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        destinationWarehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        batch: true,
      },
    });

    return movement;
  } catch (error) {
    console.error("Get Movement By ID Error:", error);
    return null;
  }
}

/**
 * Get movements for a specific stock item
 */
export async function getMovementsByStockItem(
  stockItemId: string,
  options?: { limit?: number; type?: MovementType }
) {
  try {
    const where: Prisma.StockMovementWhereInput = { stockItemId };

    if (options?.type) {
      where.type = options.type;
    }

    const movements = await db.stockMovement.findMany({
      where,
      include: {
        sourceWarehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        destinationWarehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        batch: {
          select: {
            id: true,
            batchNumber: true,
            expirationDate: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: options?.limit ?? 100,
    });

    return movements;
  } catch (error) {
    console.error("Get Movements By Stock Item Error:", error);
    return [];
  }
}

/**
 * Get movements for a specific warehouse
 */
export async function getMovementsByWarehouse(
  warehouseId: string,
  options?: { limit?: number; type?: MovementType }
) {
  try {
    const where: Prisma.StockMovementWhereInput = {
      OR: [
        { sourceWarehouseId: warehouseId },
        { destinationWarehouseId: warehouseId },
      ],
    };

    if (options?.type) {
      where.type = options.type;
    }

    const movements = await db.stockMovement.findMany({
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
        sourceWarehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        destinationWarehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        batch: {
          select: {
            id: true,
            batchNumber: true,
            expirationDate: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: options?.limit ?? 100,
    });

    return movements;
  } catch (error) {
    console.error("Get Movements By Warehouse Error:", error);
    return [];
  }
}

/**
 * Get stock level for a specific item in a warehouse
 */
export async function getStockLevelForMovement(
  stockItemId: string,
  warehouseId: string
) {
  try {
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

    return stockLevel;
  } catch (error) {
    console.error("Get Stock Level For Movement Error:", error);
    return null;
  }
}

