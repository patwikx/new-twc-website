"use server";

import { db } from "@/lib/db";
import { WasteType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import { logWasteRecord } from "@/lib/audit/inventory-audit";

// Types
export interface RecordWasteInput {
  stockItemId: string;
  warehouseId: string;
  wasteType: WasteType;
  quantity: number;
  batchId?: string;
  reason?: string;
  recordedById: string;
}

export interface WasteHistoryQuery {
  stockItemId?: string;
  warehouseId?: string;
  wasteType?: WasteType;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export interface WasteByType {
  type: WasteType;
  cost: number;
  quantity: number;
}

export interface WasteByItem {
  stockItemId: string;
  name: string;
  cost: number;
  quantity: number;
}

export interface WasteReport {
  periodStart: Date;
  periodEnd: Date;
  totalWasteCost: number;
  totalConsumptionCost: number;
  wastePercentage: number;
  byType: WasteByType[];
  byItem: WasteByItem[];
}

// Valid waste types for validation
const VALID_WASTE_TYPES: WasteType[] = [
  "SPOILAGE",
  "EXPIRED",
  "DAMAGED",
  "OVERPRODUCTION",
  "PREPARATION_WASTE",
];

/**
 * Validate waste type enum
 * Property 42: Waste Type Validation
 */
function isValidWasteType(type: string): type is WasteType {
  return VALID_WASTE_TYPES.includes(type as WasteType);
}

// ============================================================================
// Waste Recording
// ============================================================================

/**
 * Record waste for a stock item
 * Requirements: 11.1, 11.2, 11.3, 11.4
 * 
 * Property 42: Waste Type Validation
 * For any waste record, the wasteType SHALL be one of: SPOILAGE, EXPIRED, DAMAGED, 
 * OVERPRODUCTION, or PREPARATION_WASTE. Any other value SHALL be rejected.
 * 
 * Property 43: Waste Record Required Fields
 * For any waste record creation, it SHALL have non-null values for: stockItemId, 
 * warehouseId, wasteType, quantity > 0, and recordedById.
 * 
 * Property 44: Waste Decreases Stock
 * For any waste record of quantity Q for item I in warehouse W, the stock level 
 * for (I, W) SHALL decrease by exactly Q and a WASTE movement record SHALL be created.
 * 
 * Property 45: Waste Cost Calculation
 * For any waste record, if a batchId is provided, the unitCost SHALL be the batch's unitCost.
 * Otherwise, the unitCost SHALL be the weighted average cost for that item-warehouse.
 */
export async function recordWaste(data: RecordWasteInput) {
  // Property 43: Validate required fields
  if (!data.stockItemId || data.stockItemId.trim() === "") {
    return { error: "Stock item ID is required" };
  }

  if (!data.warehouseId || data.warehouseId.trim() === "") {
    return { error: "Warehouse ID is required" };
  }

  if (!data.recordedById || data.recordedById.trim() === "") {
    return { error: "Recorded by user ID is required" };
  }

  // Property 42: Validate waste type
  if (!data.wasteType) {
    return { error: "Waste type is required" };
  }

  if (!isValidWasteType(data.wasteType)) {
    return { 
      error: `Invalid waste type. Must be one of: ${VALID_WASTE_TYPES.join(", ")}` 
    };
  }

  // Property 43: Validate quantity
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
      return { error: "Cannot record waste in an inactive warehouse" };
    }

    // If batchId provided, verify batch exists and belongs to the item/warehouse
    let batch = null;
    if (data.batchId) {
      batch = await db.stockBatch.findUnique({
        where: { id: data.batchId },
      });

      if (!batch) {
        return { error: "Batch not found" };
      }

      if (batch.stockItemId !== data.stockItemId) {
        return { error: "Batch does not belong to the specified stock item" };
      }

      if (batch.warehouseId !== data.warehouseId) {
        return { error: "Batch does not belong to the specified warehouse" };
      }
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
      const wasteQuantity = new Decimal(data.quantity);

      // Validate sufficient stock
      if (currentQuantity.lessThan(wasteQuantity)) {
        throw new Error(
          `Insufficient stock. Available: ${currentQuantity.toNumber()}, Requested: ${data.quantity}`
        );
      }

      // Property 45: Calculate unit cost
      // If batch provided, use batch cost; otherwise use weighted average
      let unitCost: Decimal;
      if (batch) {
        unitCost = new Decimal(batch.unitCost.toString());
      } else {
        unitCost = new Decimal(stockLevel.averageCost.toString());
      }

      const totalCost = wasteQuantity.mul(unitCost).toDecimalPlaces(2);
      const newQuantity = currentQuantity.sub(wasteQuantity);

      // Property 44: Update stock level (decrease by waste quantity)
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

      // If batch provided, also decrease batch quantity
      if (batch) {
        const batchQuantity = new Decimal(batch.quantity.toString());
        const newBatchQuantity = batchQuantity.sub(wasteQuantity);

        if (newBatchQuantity.lessThan(0)) {
          throw new Error(
            `Insufficient batch quantity. Available: ${batchQuantity.toNumber()}, Requested: ${data.quantity}`
          );
        }

        await tx.stockBatch.update({
          where: { id: data.batchId },
          data: {
            quantity: newBatchQuantity.toDecimalPlaces(3).toNumber(),
          },
        });
      }

      // Create waste record
      const wasteRecord = await tx.wasteRecord.create({
        data: {
          stockItemId: data.stockItemId,
          warehouseId: data.warehouseId,
          batchId: data.batchId || null,
          wasteType: data.wasteType,
          quantity: data.quantity,
          unitCost: unitCost.toDecimalPlaces(4).toNumber(),
          totalCost: totalCost.toNumber(),
          reason: data.reason || null,
          recordedById: data.recordedById,
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
          batch: {
            select: {
              id: true,
              batchNumber: true,
              expirationDate: true,
            },
          },
        },
      });

      // Property 44: Create WASTE movement record
      const movement = await tx.stockMovement.create({
        data: {
          stockItemId: data.stockItemId,
          sourceWarehouseId: data.warehouseId,
          batchId: data.batchId || null,
          type: "WASTE",
          quantity: data.quantity,
          unitCost: unitCost.toDecimalPlaces(4).toNumber(),
          totalCost: totalCost.toNumber(),
          referenceType: "WASTE_RECORD",
          referenceId: wasteRecord.id,
          reason: data.reason || null,
          createdById: data.recordedById,
        },
      });

      return {
        wasteRecord,
        movement,
        previousQuantity: currentQuantity.toNumber(),
        newQuantity: newQuantity.toNumber(),
      };
    });

    // Log the waste record for audit trail
    await logWasteRecord({
      userId: data.recordedById,
      wasteRecordId: result.wasteRecord.id,
      wasteData: {
        stockItemId: data.stockItemId,
        warehouseId: data.warehouseId,
        wasteType: data.wasteType,
        quantity: data.quantity,
        reason: data.reason,
        batchId: data.batchId,
      },
    });

    revalidatePath("/admin/inventory");
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes("Insufficient stock") ||
        error.message.includes("Insufficient batch") ||
        error.message.includes("No stock available")
      ) {
        return { error: error.message };
      }
    }
    console.error("Record Waste Error:", error);
    return { error: "Failed to record waste" };
  }
}


// ============================================================================
// Waste History and Queries
// ============================================================================

/**
 * Get waste record by ID
 */
export async function getWasteRecordById(id: string) {
  try {
    const wasteRecord = await db.wasteRecord.findUnique({
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
        batch: {
          select: {
            id: true,
            batchNumber: true,
            expirationDate: true,
          },
        },
      },
    });

    return wasteRecord;
  } catch (error) {
    console.error("Get Waste Record By ID Error:", error);
    return null;
  }
}

/**
 * Get waste history with filtering
 * Requirements: 11.5
 */
export async function getWasteHistory(query?: WasteHistoryQuery) {
  try {
    const where: Prisma.WasteRecordWhereInput = {};

    if (query?.stockItemId) {
      where.stockItemId = query.stockItemId;
    }

    if (query?.warehouseId) {
      where.warehouseId = query.warehouseId;
    }

    if (query?.wasteType) {
      where.wasteType = query.wasteType;
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

    const [wasteRecords, total] = await Promise.all([
      db.wasteRecord.findMany({
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
      db.wasteRecord.count({ where }),
    ]);

    return {
      wasteRecords,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Get Waste History Error:", error);
    return {
      wasteRecords: [],
      pagination: {
        page: 1,
        pageSize: 50,
        total: 0,
        totalPages: 0,
      },
    };
  }
}

/**
 * Get waste records by warehouse
 */
export async function getWasteByWarehouse(
  warehouseId: string,
  options?: { startDate?: Date; endDate?: Date }
) {
  try {
    const where: Prisma.WasteRecordWhereInput = {
      warehouseId,
    };

    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate;
      }
    }

    const wasteRecords = await db.wasteRecord.findMany({
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
        batch: {
          select: {
            id: true,
            batchNumber: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return wasteRecords;
  } catch (error) {
    console.error("Get Waste By Warehouse Error:", error);
    return [];
  }
}

// ============================================================================
// Waste Reporting
// ============================================================================

/**
 * Generate waste report for a warehouse within a period
 * Requirements: 11.5, 11.6
 * 
 * Property 46: Waste Percentage Calculation
 * For any waste report for a period, the waste percentage SHALL equal 
 * (totalWasteCost / totalConsumptionCost) × 100, where totalConsumptionCost 
 * includes all CONSUMPTION and WASTE movements.
 */
export async function generateWasteReport(
  warehouseId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<WasteReport> {
  try {
    // Get all waste records in the period
    const wasteRecords = await db.wasteRecord.findMany({
      where: {
        warehouseId,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Calculate total waste cost
    const totalWasteCost = wasteRecords.reduce(
      (sum, record) => sum.add(new Decimal(record.totalCost.toString())),
      new Decimal(0)
    );

    // Get all consumption movements (CONSUMPTION + WASTE) in the period
    const consumptionMovements = await db.stockMovement.findMany({
      where: {
        sourceWarehouseId: warehouseId,
        type: {
          in: ["CONSUMPTION", "WASTE"],
        },
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    // Calculate total consumption cost (includes waste)
    const totalConsumptionCost = consumptionMovements.reduce(
      (sum, movement) => {
        const cost = movement.totalCost ? new Decimal(movement.totalCost.toString()) : new Decimal(0);
        return sum.add(cost);
      },
      new Decimal(0)
    );

    // Property 46: Calculate waste percentage
    const wastePercentage = totalConsumptionCost.isZero()
      ? 0
      : totalWasteCost.div(totalConsumptionCost).mul(100).toDecimalPlaces(2).toNumber();

    // Group by waste type
    const byTypeMap = new Map<WasteType, { cost: Decimal; quantity: Decimal }>();
    for (const record of wasteRecords) {
      const existing = byTypeMap.get(record.wasteType) || {
        cost: new Decimal(0),
        quantity: new Decimal(0),
      };
      byTypeMap.set(record.wasteType, {
        cost: existing.cost.add(new Decimal(record.totalCost.toString())),
        quantity: existing.quantity.add(new Decimal(record.quantity.toString())),
      });
    }

    const byType: WasteByType[] = Array.from(byTypeMap.entries()).map(
      ([type, data]) => ({
        type,
        cost: data.cost.toNumber(),
        quantity: data.quantity.toNumber(),
      })
    );

    // Group by item
    const byItemMap = new Map<string, { name: string; cost: Decimal; quantity: Decimal }>();
    for (const record of wasteRecords) {
      const existing = byItemMap.get(record.stockItemId) || {
        name: record.stockItem.name,
        cost: new Decimal(0),
        quantity: new Decimal(0),
      };
      byItemMap.set(record.stockItemId, {
        name: record.stockItem.name,
        cost: existing.cost.add(new Decimal(record.totalCost.toString())),
        quantity: existing.quantity.add(new Decimal(record.quantity.toString())),
      });
    }

    const byItem: WasteByItem[] = Array.from(byItemMap.entries()).map(
      ([stockItemId, data]) => ({
        stockItemId,
        name: data.name,
        cost: data.cost.toNumber(),
        quantity: data.quantity.toNumber(),
      })
    );

    // Sort by cost descending
    byType.sort((a, b) => b.cost - a.cost);
    byItem.sort((a, b) => b.cost - a.cost);

    return {
      periodStart,
      periodEnd,
      totalWasteCost: totalWasteCost.toNumber(),
      totalConsumptionCost: totalConsumptionCost.toNumber(),
      wastePercentage,
      byType,
      byItem,
    };
  } catch (error) {
    console.error("Generate Waste Report Error:", error);
    return {
      periodStart,
      periodEnd,
      totalWasteCost: 0,
      totalConsumptionCost: 0,
      wastePercentage: 0,
      byType: [],
      byItem: [],
    };
  }
}

/**
 * Calculate waste percentage for a warehouse in a period
 * Requirements: 11.6
 * 
 * Property 46: Waste Percentage Calculation
 */
export async function calculateWastePercentage(
  warehouseId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  try {
    // Get total waste cost
    const wasteResult = await db.wasteRecord.aggregate({
      where: {
        warehouseId,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      _sum: {
        totalCost: true,
      },
    });

    const totalWasteCost = new Decimal(wasteResult._sum.totalCost?.toString() || "0");

    // Get total consumption cost (CONSUMPTION + WASTE movements)
    const consumptionResult = await db.stockMovement.aggregate({
      where: {
        sourceWarehouseId: warehouseId,
        type: {
          in: ["CONSUMPTION", "WASTE"],
        },
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      _sum: {
        totalCost: true,
      },
    });

    const totalConsumptionCost = new Decimal(
      consumptionResult._sum.totalCost?.toString() || "0"
    );

    // Property 46: wastePercentage = (totalWasteCost / totalConsumptionCost) × 100
    if (totalConsumptionCost.isZero()) {
      return 0;
    }

    return totalWasteCost.div(totalConsumptionCost).mul(100).toDecimalPlaces(2).toNumber();
  } catch (error) {
    console.error("Calculate Waste Percentage Error:", error);
    return 0;
  }
}

/**
 * Generate waste report by property (across all warehouses)
 * Requirements: 11.5
 */
export async function generateWasteReportByProperty(
  propertyId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<WasteReport> {
  try {
    // Get all warehouses for the property
    const warehouses = await db.warehouse.findMany({
      where: { propertyId },
      select: { id: true },
    });

    const warehouseIds = warehouses.map((w) => w.id);

    // Get all waste records in the period for all warehouses
    const wasteRecords = await db.wasteRecord.findMany({
      where: {
        warehouseId: { in: warehouseIds },
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Calculate total waste cost
    const totalWasteCost = wasteRecords.reduce(
      (sum, record) => sum.add(new Decimal(record.totalCost.toString())),
      new Decimal(0)
    );

    // Get all consumption movements in the period
    const consumptionMovements = await db.stockMovement.findMany({
      where: {
        sourceWarehouseId: { in: warehouseIds },
        type: {
          in: ["CONSUMPTION", "WASTE"],
        },
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    // Calculate total consumption cost
    const totalConsumptionCost = consumptionMovements.reduce(
      (sum, movement) => {
        const cost = movement.totalCost ? new Decimal(movement.totalCost.toString()) : new Decimal(0);
        return sum.add(cost);
      },
      new Decimal(0)
    );

    // Calculate waste percentage
    const wastePercentage = totalConsumptionCost.isZero()
      ? 0
      : totalWasteCost.div(totalConsumptionCost).mul(100).toDecimalPlaces(2).toNumber();

    // Group by waste type
    const byTypeMap = new Map<WasteType, { cost: Decimal; quantity: Decimal }>();
    for (const record of wasteRecords) {
      const existing = byTypeMap.get(record.wasteType) || {
        cost: new Decimal(0),
        quantity: new Decimal(0),
      };
      byTypeMap.set(record.wasteType, {
        cost: existing.cost.add(new Decimal(record.totalCost.toString())),
        quantity: existing.quantity.add(new Decimal(record.quantity.toString())),
      });
    }

    const byType: WasteByType[] = Array.from(byTypeMap.entries()).map(
      ([type, data]) => ({
        type,
        cost: data.cost.toNumber(),
        quantity: data.quantity.toNumber(),
      })
    );

    // Group by item
    const byItemMap = new Map<string, { name: string; cost: Decimal; quantity: Decimal }>();
    for (const record of wasteRecords) {
      const existing = byItemMap.get(record.stockItemId) || {
        name: record.stockItem.name,
        cost: new Decimal(0),
        quantity: new Decimal(0),
      };
      byItemMap.set(record.stockItemId, {
        name: record.stockItem.name,
        cost: existing.cost.add(new Decimal(record.totalCost.toString())),
        quantity: existing.quantity.add(new Decimal(record.quantity.toString())),
      });
    }

    const byItem: WasteByItem[] = Array.from(byItemMap.entries()).map(
      ([stockItemId, data]) => ({
        stockItemId,
        name: data.name,
        cost: data.cost.toNumber(),
        quantity: data.quantity.toNumber(),
      })
    );

    // Sort by cost descending
    byType.sort((a, b) => b.cost - a.cost);
    byItem.sort((a, b) => b.cost - a.cost);

    return {
      periodStart,
      periodEnd,
      totalWasteCost: totalWasteCost.toNumber(),
      totalConsumptionCost: totalConsumptionCost.toNumber(),
      wastePercentage,
      byType,
      byItem,
    };
  } catch (error) {
    console.error("Generate Waste Report By Property Error:", error);
    return {
      periodStart,
      periodEnd,
      totalWasteCost: 0,
      totalConsumptionCost: 0,
      wastePercentage: 0,
      byType: [],
      byItem: [],
    };
  }
}

/**
 * Get waste summary statistics for a warehouse
 */
export async function getWasteSummary(
  warehouseId: string,
  periodStart: Date,
  periodEnd: Date
) {
  try {
    const [totalRecords, totalCost, byType] = await Promise.all([
      // Count total waste records
      db.wasteRecord.count({
        where: {
          warehouseId,
          createdAt: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
      }),
      // Sum total waste cost
      db.wasteRecord.aggregate({
        where: {
          warehouseId,
          createdAt: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
        _sum: {
          totalCost: true,
          quantity: true,
        },
      }),
      // Group by waste type
      db.wasteRecord.groupBy({
        by: ["wasteType"],
        where: {
          warehouseId,
          createdAt: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
        _sum: {
          totalCost: true,
          quantity: true,
        },
        _count: true,
      }),
    ]);

    return {
      totalRecords,
      totalCost: Number(totalCost._sum.totalCost) || 0,
      totalQuantity: Number(totalCost._sum.quantity) || 0,
      byType: byType.map((item) => ({
        type: item.wasteType,
        count: item._count,
        cost: Number(item._sum.totalCost) || 0,
        quantity: Number(item._sum.quantity) || 0,
      })),
    };
  } catch (error) {
    console.error("Get Waste Summary Error:", error);
    return {
      totalRecords: 0,
      totalCost: 0,
      totalQuantity: 0,
      byType: [],
    };
  }
}
