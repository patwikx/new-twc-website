"use server";

import { db } from "@/lib/db";
import { MovementType, MenuCategory, WasteType } from "@prisma/client";
import Decimal from "decimal.js";

// ============================================================================
// Types for Inventory Reporting
// ============================================================================

export interface StockCategoryInfo {
  id: string;
  name: string;
  color: string | null;
}

export interface StockValuationItem {
  stockItemId: string;
  stockItemName: string;
  stockItemSku: string | null;
  category: StockCategoryInfo;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  averageCost: number;
  totalValue: number;
  unit: string;
}

export interface StockValuationReport {
  generatedAt: Date;
  propertyId: string;
  propertyName: string;
  totalValue: number;
  byWarehouse: {
    warehouseId: string;
    warehouseName: string;
    totalValue: number;
    itemCount: number;
  }[];
  byCategory: {
    category: StockCategoryInfo;
    totalValue: number;
    itemCount: number;
  }[];
  items: StockValuationItem[];
}

export interface StockMovementHistoryItem {
  id: string;
  stockItemId: string;
  stockItemName: string;
  stockItemSku: string | null;
  type: MovementType;
  quantity: number;
  unitCost: number | null;
  totalCost: number | null;
  sourceWarehouseId: string | null;
  sourceWarehouseName: string | null;
  destinationWarehouseId: string | null;
  destinationWarehouseName: string | null;
  batchNumber: string | null;
  reason: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: Date;
  createdById: string;
}

export interface StockMovementHistoryReport {
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  totalMovements: number;
  byType: {
    type: MovementType;
    count: number;
    totalQuantity: number;
    totalValue: number;
  }[];
  movements: StockMovementHistoryItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}


export interface LowStockAlertItem {
  stockItemId: string;
  stockItemName: string;
  stockItemSku: string | null;
  category: StockCategoryInfo;
  warehouseId: string;
  warehouseName: string;
  currentQuantity: number;
  parLevel: number;
  deficit: number;
  deficitPercentage: number;
  unit: string;
}

export interface LowStockAlertsReport {
  generatedAt: Date;
  propertyId: string;
  propertyName: string;
  totalAlerts: number;
  criticalAlerts: number; // Items at 0 or below 25% of par level
  warningAlerts: number; // Items between 25-75% of par level
  alerts: LowStockAlertItem[];
}

export interface BatchExpirationItem {
  batchId: string;
  stockItemId: string;
  stockItemName: string;
  stockItemSku: string | null;
  warehouseId: string;
  warehouseName: string;
  batchNumber: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
  expirationDate: Date;
  daysUntilExpiration: number;
  status: "expired" | "critical" | "warning" | "ok";
  unit: string;
}

export interface BatchExpirationReport {
  generatedAt: Date;
  propertyId: string;
  propertyName: string;
  daysThreshold: number;
  totalBatches: number;
  expiredBatches: number;
  criticalBatches: number; // Expiring within 3 days
  warningBatches: number; // Expiring within threshold
  totalAtRiskValue: number;
  batches: BatchExpirationItem[];
}

// ============================================================================
// Stock Valuation Report
// Requirements: 12.1
// ============================================================================

/**
 * Generate stock valuation report showing quantity and value per warehouse
 * Requirements: 12.1
 */
export async function generateStockValuationReport(
  propertyId: string
): Promise<StockValuationReport> {
  try {
    // Get property info
    const property = await db.property.findUnique({
      where: { id: propertyId },
      select: { id: true, name: true },
    });

    if (!property) {
      return {
        generatedAt: new Date(),
        propertyId,
        propertyName: "Unknown",
        totalValue: 0,
        byWarehouse: [],
        byCategory: [],
        items: [],
      };
    }

    // Get all stock levels for the property with related data
    const stockLevels = await db.stockLevel.findMany({
      where: {
        warehouse: {
          propertyId,
          isActive: true,
        },
        stockItem: {
          isActive: true,
        },
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
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
          },
        },
      },
    });

    // Build items list
    const items: StockValuationItem[] = stockLevels.map((level) => {
      const quantity = Number(level.quantity);
      const averageCost = Number(level.averageCost);
      const totalValue = quantity * averageCost;

      return {
        stockItemId: level.stockItem.id,
        stockItemName: level.stockItem.name,
        stockItemSku: level.stockItem.sku,
        category: level.stockItem.category,
        warehouseId: level.warehouse.id,
        warehouseName: level.warehouse.name,
        quantity,
        averageCost,
        totalValue,
        unit: level.stockItem.primaryUnit.abbreviation,
      };
    });

    // Calculate total value
    const totalValue = items.reduce((sum, item) => sum + item.totalValue, 0);

    // Group by warehouse
    const warehouseMap = new Map<string, { name: string; value: number; count: number }>();
    for (const item of items) {
      const existing = warehouseMap.get(item.warehouseId) || {
        name: item.warehouseName,
        value: 0,
        count: 0,
      };
      warehouseMap.set(item.warehouseId, {
        name: item.warehouseName,
        value: existing.value + item.totalValue,
        count: existing.count + 1,
      });
    }

    const byWarehouse = Array.from(warehouseMap.entries()).map(([id, data]) => ({
      warehouseId: id,
      warehouseName: data.name,
      totalValue: data.value,
      itemCount: data.count,
    }));

    // Group by category
    const categoryMap = new Map<string, { category: StockCategoryInfo; value: number; count: number }>();
    for (const item of items) {
      const existing = categoryMap.get(item.category.id) || { category: item.category, value: 0, count: 0 };
      categoryMap.set(item.category.id, {
        category: item.category,
        value: existing.value + item.totalValue,
        count: existing.count + 1,
      });
    }

    const byCategory = Array.from(categoryMap.values()).map((data) => ({
      category: data.category,
      totalValue: data.value,
      itemCount: data.count,
    }));

    // Sort items by total value descending
    items.sort((a, b) => b.totalValue - a.totalValue);

    return {
      generatedAt: new Date(),
      propertyId,
      propertyName: property.name,
      totalValue,
      byWarehouse: byWarehouse.sort((a, b) => b.totalValue - a.totalValue),
      byCategory: byCategory.sort((a, b) => b.totalValue - a.totalValue),
      items,
    };
  } catch (error) {
    console.error("Generate Stock Valuation Report Error:", error);
    return {
      generatedAt: new Date(),
      propertyId,
      propertyName: "Error",
      totalValue: 0,
      byWarehouse: [],
      byCategory: [],
      items: [],
    };
  }
}


// ============================================================================
// Stock Movement History Report
// Requirements: 12.2
// ============================================================================

/**
 * Generate stock movement history report with filtering
 * Requirements: 12.2
 */
export async function generateStockMovementHistoryReport(
  options: {
    propertyId?: string;
    warehouseId?: string;
    stockItemId?: string;
    type?: MovementType;
    startDate: Date;
    endDate: Date;
    page?: number;
    pageSize?: number;
  }
): Promise<StockMovementHistoryReport> {
  try {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: {
      createdAt: { gte: Date; lte: Date };
      type?: MovementType;
      stockItemId?: string;
      OR?: Array<{ sourceWarehouseId?: string; destinationWarehouseId?: string }>;
      stockItem?: { propertyId: string };
    } = {
      createdAt: {
        gte: options.startDate,
        lte: options.endDate,
      },
    };

    if (options.type) {
      where.type = options.type;
    }

    if (options.stockItemId) {
      where.stockItemId = options.stockItemId;
    }

    if (options.warehouseId) {
      where.OR = [
        { sourceWarehouseId: options.warehouseId },
        { destinationWarehouseId: options.warehouseId },
      ];
    }

    if (options.propertyId) {
      where.stockItem = { propertyId: options.propertyId };
    }

    // Get movements with pagination
    const [movements, total] = await Promise.all([
      db.stockMovement.findMany({
        where,
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
            },
          },
          destinationWarehouse: {
            select: {
              id: true,
              name: true,
            },
          },
          batch: {
            select: {
              batchNumber: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.stockMovement.count({ where }),
    ]);

    // Get aggregates by type
    const typeAggregates = await db.stockMovement.groupBy({
      by: ["type"],
      where,
      _count: true,
      _sum: {
        quantity: true,
        totalCost: true,
      },
    });

    const byType = typeAggregates.map((agg) => ({
      type: agg.type,
      count: agg._count,
      totalQuantity: Number(agg._sum.quantity) || 0,
      totalValue: Number(agg._sum.totalCost) || 0,
    }));

    // Map movements to report format
    const movementItems: StockMovementHistoryItem[] = movements.map((m) => ({
      id: m.id,
      stockItemId: m.stockItem.id,
      stockItemName: m.stockItem.name,
      stockItemSku: m.stockItem.sku,
      type: m.type,
      quantity: Number(m.quantity),
      unitCost: m.unitCost ? Number(m.unitCost) : null,
      totalCost: m.totalCost ? Number(m.totalCost) : null,
      sourceWarehouseId: m.sourceWarehouse?.id || null,
      sourceWarehouseName: m.sourceWarehouse?.name || null,
      destinationWarehouseId: m.destinationWarehouse?.id || null,
      destinationWarehouseName: m.destinationWarehouse?.name || null,
      batchNumber: m.batch?.batchNumber || null,
      reason: m.reason,
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      createdAt: m.createdAt,
      createdById: m.createdById,
    }));

    return {
      generatedAt: new Date(),
      periodStart: options.startDate,
      periodEnd: options.endDate,
      totalMovements: total,
      byType: byType.sort((a, b) => b.count - a.count),
      movements: movementItems,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Generate Stock Movement History Report Error:", error);
    return {
      generatedAt: new Date(),
      periodStart: options.startDate,
      periodEnd: options.endDate,
      totalMovements: 0,
      byType: [],
      movements: [],
      pagination: {
        page: options.page ?? 1,
        pageSize: options.pageSize ?? 50,
        total: 0,
        totalPages: 0,
      },
    };
  }
}


// ============================================================================
// Low Stock Alerts Report
// Requirements: 12.4
// ============================================================================

/**
 * Generate low-stock alerts report showing items below par level
 * Requirements: 12.4
 */
export async function generateLowStockAlertsReport(
  propertyId: string
): Promise<LowStockAlertsReport> {
  try {
    // Get property info
    const property = await db.property.findUnique({
      where: { id: propertyId },
      select: { id: true, name: true },
    });

    if (!property) {
      return {
        generatedAt: new Date(),
        propertyId,
        propertyName: "Unknown",
        totalAlerts: 0,
        criticalAlerts: 0,
        warningAlerts: 0,
        alerts: [],
      };
    }

    // Get all par levels for the property with current stock levels
    const parLevels = await db.stockParLevel.findMany({
      where: {
        stockItem: {
          propertyId,
          isActive: true,
        },
        warehouse: {
          isActive: true,
        },
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
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
          },
        },
      },
    });

    const alerts: LowStockAlertItem[] = [];

    for (const parLevel of parLevels) {
      // Get current stock level
      const stockLevel = await db.stockLevel.findUnique({
        where: {
          stockItemId_warehouseId: {
            stockItemId: parLevel.stockItemId,
            warehouseId: parLevel.warehouseId,
          },
        },
      });

      const currentQuantity = stockLevel ? Number(stockLevel.quantity) : 0;
      const parLevelValue = Number(parLevel.parLevel);

      // Only include if below par level
      if (currentQuantity < parLevelValue) {
        const deficit = parLevelValue - currentQuantity;
        const deficitPercentage = parLevelValue > 0 
          ? ((deficit / parLevelValue) * 100) 
          : 100;

        alerts.push({
          stockItemId: parLevel.stockItem.id,
          stockItemName: parLevel.stockItem.name,
          stockItemSku: parLevel.stockItem.sku,
          category: parLevel.stockItem.category,
          warehouseId: parLevel.warehouse.id,
          warehouseName: parLevel.warehouse.name,
          currentQuantity,
          parLevel: parLevelValue,
          deficit,
          deficitPercentage: Math.round(deficitPercentage * 100) / 100,
          unit: parLevel.stockItem.primaryUnit.abbreviation,
        });
      }
    }

    // Sort by deficit percentage descending (most critical first)
    alerts.sort((a, b) => b.deficitPercentage - a.deficitPercentage);

    // Count critical (at 0 or below 25% of par) and warning alerts
    const criticalAlerts = alerts.filter(
      (a) => a.currentQuantity === 0 || a.deficitPercentage >= 75
    ).length;
    const warningAlerts = alerts.filter(
      (a) => a.currentQuantity > 0 && a.deficitPercentage >= 25 && a.deficitPercentage < 75
    ).length;

    return {
      generatedAt: new Date(),
      propertyId,
      propertyName: property.name,
      totalAlerts: alerts.length,
      criticalAlerts,
      warningAlerts,
      alerts,
    };
  } catch (error) {
    console.error("Generate Low Stock Alerts Report Error:", error);
    return {
      generatedAt: new Date(),
      propertyId,
      propertyName: "Error",
      totalAlerts: 0,
      criticalAlerts: 0,
      warningAlerts: 0,
      alerts: [],
    };
  }
}


// ============================================================================
// Batch Expiration Report
// Requirements: 12.6
// ============================================================================

/**
 * Generate batch expiration report showing batches expiring within specified days
 * Requirements: 12.6
 */
export async function generateBatchExpirationReport(
  propertyId: string,
  daysThreshold: number = 30
): Promise<BatchExpirationReport> {
  try {
    // Get property info
    const property = await db.property.findUnique({
      where: { id: propertyId },
      select: { id: true, name: true },
    });

    if (!property) {
      return {
        generatedAt: new Date(),
        propertyId,
        propertyName: "Unknown",
        daysThreshold,
        totalBatches: 0,
        expiredBatches: 0,
        criticalBatches: 0,
        warningBatches: 0,
        totalAtRiskValue: 0,
        batches: [],
      };
    }

    const now = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    // Get all batches with expiration dates within threshold or already expired
    const batches = await db.stockBatch.findMany({
      where: {
        warehouse: {
          propertyId,
          isActive: true,
        },
        quantity: {
          gt: 0,
        },
        expirationDate: {
          not: null,
          lte: thresholdDate,
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
          },
        },
      },
      orderBy: {
        expirationDate: "asc",
      },
    });

    const batchItems: BatchExpirationItem[] = batches.map((batch) => {
      const expirationDate = batch.expirationDate as Date;
      const daysUntilExpiration = Math.ceil(
        (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const quantity = Number(batch.quantity);
      const unitCost = Number(batch.unitCost);
      const totalValue = quantity * unitCost;

      let status: "expired" | "critical" | "warning" | "ok";
      if (daysUntilExpiration <= 0 || batch.isExpired) {
        status = "expired";
      } else if (daysUntilExpiration <= 3) {
        status = "critical";
      } else if (daysUntilExpiration <= daysThreshold) {
        status = "warning";
      } else {
        status = "ok";
      }

      return {
        batchId: batch.id,
        stockItemId: batch.stockItem.id,
        stockItemName: batch.stockItem.name,
        stockItemSku: batch.stockItem.sku,
        warehouseId: batch.warehouse.id,
        warehouseName: batch.warehouse.name,
        batchNumber: batch.batchNumber,
        quantity,
        unitCost,
        totalValue,
        expirationDate,
        daysUntilExpiration,
        status,
        unit: batch.stockItem.primaryUnit.abbreviation,
      };
    });

    // Count by status
    const expiredBatches = batchItems.filter((b) => b.status === "expired").length;
    const criticalBatches = batchItems.filter((b) => b.status === "critical").length;
    const warningBatches = batchItems.filter((b) => b.status === "warning").length;

    // Calculate total at-risk value (expired + critical + warning)
    const totalAtRiskValue = batchItems
      .filter((b) => b.status !== "ok")
      .reduce((sum, b) => sum + b.totalValue, 0);

    return {
      generatedAt: new Date(),
      propertyId,
      propertyName: property.name,
      daysThreshold,
      totalBatches: batchItems.length,
      expiredBatches,
      criticalBatches,
      warningBatches,
      totalAtRiskValue,
      batches: batchItems,
    };
  } catch (error) {
    console.error("Generate Batch Expiration Report Error:", error);
    return {
      generatedAt: new Date(),
      propertyId,
      propertyName: "Error",
      daysThreshold,
      totalBatches: 0,
      expiredBatches: 0,
      criticalBatches: 0,
      warningBatches: 0,
      totalAtRiskValue: 0,
      batches: [],
    };
  }
}


// ============================================================================
// Types for COGS and Profitability Reporting
// ============================================================================

export interface COGSReportItem {
  menuItemId: string;
  menuItemName: string;
  category: MenuCategory;
  quantitySold: number;
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  grossMargin: number;
  foodCostPercentage: number;
  averageUnitCost: number;
  sellingPrice: number;
}

export interface COGSReport {
  generatedAt: Date;
  propertyId: string;
  propertyName: string;
  periodStart: Date;
  periodEnd: Date;
  totalRevenue: number;
  totalCOGS: number;
  totalGrossProfit: number;
  overallFoodCostPercentage: number;
  overallGrossMargin: number;
  byCategory: {
    category: MenuCategory;
    totalRevenue: number;
    totalCOGS: number;
    grossProfit: number;
    foodCostPercentage: number;
    itemCount: number;
  }[];
  items: COGSReportItem[];
}

export interface RecipeProfitabilityItem {
  recipeId: string;
  recipeName: string;
  menuItemId: string | null;
  menuItemName: string | null;
  sellingPrice: number | null;
  recipeCost: number;
  costPerPortion: number;
  yield: number;
  grossProfit: number | null;
  foodCostPercentage: number | null;
  isAboveTargetCost: boolean;
  ingredientCount: number;
}

export interface RecipeProfitabilityReport {
  generatedAt: Date;
  propertyId: string;
  propertyName: string;
  warehouseId: string;
  warehouseName: string;
  targetFoodCostPercentage: number;
  totalRecipes: number;
  recipesAboveTarget: number;
  averageFoodCostPercentage: number;
  recipes: RecipeProfitabilityItem[];
}

export interface WasteAnalysisItem {
  stockItemId: string;
  stockItemName: string;
  stockItemSku: string | null;
  category: StockCategoryInfo;
  totalQuantityWasted: number;
  totalCostWasted: number;
  wastePercentage: number;
  byType: {
    type: WasteType;
    quantity: number;
    cost: number;
  }[];
  unit: string;
}

export interface WasteAnalysisReport {
  generatedAt: Date;
  propertyId: string;
  propertyName: string;
  periodStart: Date;
  periodEnd: Date;
  totalWasteCost: number;
  totalConsumptionCost: number;
  overallWastePercentage: number;
  byWarehouse: {
    warehouseId: string;
    warehouseName: string;
    wasteCost: number;
    wastePercentage: number;
  }[];
  byType: {
    type: WasteType;
    totalCost: number;
    totalQuantity: number;
    percentage: number;
  }[];
  topWastedItems: WasteAnalysisItem[];
  trends: {
    period: string;
    wasteCost: number;
    wastePercentage: number;
  }[];
}


// ============================================================================
// COGS Report per Menu Item
// Requirements: 12.3
// ============================================================================

/**
 * Generate COGS report per menu item and aggregated by category
 * Requirements: 12.3
 */
export async function generateCOGSReport(
  propertyId: string,
  startDate: Date,
  endDate: Date
): Promise<COGSReport> {
  try {
    // Get property info
    const property = await db.property.findUnique({
      where: { id: propertyId },
      select: { id: true, name: true },
    });

    if (!property) {
      return {
        generatedAt: new Date(),
        propertyId,
        propertyName: "Unknown",
        periodStart: startDate,
        periodEnd: endDate,
        totalRevenue: 0,
        totalCOGS: 0,
        totalGrossProfit: 0,
        overallFoodCostPercentage: 0,
        overallGrossMargin: 0,
        byCategory: [],
        items: [],
      };
    }

    // Get all menu items for the property
    const menuItems = await db.menuItem.findMany({
      where: { propertyId },
      select: {
        id: true,
        name: true,
        category: true,
        sellingPrice: true,
      },
    });

    const menuItemIds = menuItems.map((m) => m.id);

    // Get COGS records grouped by menu item
    const cogsRecords = await db.cOGSRecord.groupBy({
      by: ["menuItemId"],
      where: {
        menuItemId: { in: menuItemIds },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        quantity: true,
        totalCost: true,
      },
      _avg: {
        unitCost: true,
      },
    });

    // Build items list
    const items: COGSReportItem[] = [];
    
    for (const menuItem of menuItems) {
      const cogsData = cogsRecords.find((r) => r.menuItemId === menuItem.id);
      
      if (!cogsData || !cogsData._sum.quantity) {
        continue; // Skip items with no sales
      }

      const quantitySold = cogsData._sum.quantity;
      const totalCOGS = Number(cogsData._sum.totalCost) || 0;
      const sellingPrice = Number(menuItem.sellingPrice);
      const totalRevenue = sellingPrice * quantitySold;
      const grossProfit = totalRevenue - totalCOGS;
      const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
      const foodCostPercentage = totalRevenue > 0 ? (totalCOGS / totalRevenue) * 100 : 0;
      const averageUnitCost = Number(cogsData._avg.unitCost) || 0;

      items.push({
        menuItemId: menuItem.id,
        menuItemName: menuItem.name,
        category: menuItem.category,
        quantitySold,
        totalRevenue,
        totalCOGS,
        grossProfit,
        grossMargin: Math.round(grossMargin * 100) / 100,
        foodCostPercentage: Math.round(foodCostPercentage * 100) / 100,
        averageUnitCost: Math.round(averageUnitCost * 10000) / 10000,
        sellingPrice,
      });
    }

    // Sort by total revenue descending
    items.sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Calculate totals
    const totalRevenue = items.reduce((sum, item) => sum + item.totalRevenue, 0);
    const totalCOGS = items.reduce((sum, item) => sum + item.totalCOGS, 0);
    const totalGrossProfit = totalRevenue - totalCOGS;
    const overallFoodCostPercentage = totalRevenue > 0 ? (totalCOGS / totalRevenue) * 100 : 0;
    const overallGrossMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

    // Group by category
    const categoryMap = new Map<MenuCategory, {
      revenue: number;
      cogs: number;
      count: number;
    }>();

    for (const item of items) {
      const existing = categoryMap.get(item.category) || {
        revenue: 0,
        cogs: 0,
        count: 0,
      };
      categoryMap.set(item.category, {
        revenue: existing.revenue + item.totalRevenue,
        cogs: existing.cogs + item.totalCOGS,
        count: existing.count + 1,
      });
    }

    const byCategory = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      totalRevenue: data.revenue,
      totalCOGS: data.cogs,
      grossProfit: data.revenue - data.cogs,
      foodCostPercentage: data.revenue > 0 
        ? Math.round((data.cogs / data.revenue) * 10000) / 100 
        : 0,
      itemCount: data.count,
    }));

    byCategory.sort((a, b) => b.totalRevenue - a.totalRevenue);

    return {
      generatedAt: new Date(),
      propertyId,
      propertyName: property.name,
      periodStart: startDate,
      periodEnd: endDate,
      totalRevenue,
      totalCOGS,
      totalGrossProfit,
      overallFoodCostPercentage: Math.round(overallFoodCostPercentage * 100) / 100,
      overallGrossMargin: Math.round(overallGrossMargin * 100) / 100,
      byCategory,
      items,
    };
  } catch (error) {
    console.error("Generate COGS Report Error:", error);
    return {
      generatedAt: new Date(),
      propertyId,
      propertyName: "Error",
      periodStart: startDate,
      periodEnd: endDate,
      totalRevenue: 0,
      totalCOGS: 0,
      totalGrossProfit: 0,
      overallFoodCostPercentage: 0,
      overallGrossMargin: 0,
      byCategory: [],
      items: [],
    };
  }
}


// ============================================================================
// Recipe Profitability Report
// Requirements: 12.5
// ============================================================================

// Default target food cost percentage
const TARGET_FOOD_COST_PERCENTAGE = 35;

/**
 * Generate recipe profitability report showing cost percentage and margin per item
 * Requirements: 12.5
 */
export async function generateRecipeProfitabilityReport(
  propertyId: string,
  warehouseId: string,
  targetFoodCostPercentage: number = TARGET_FOOD_COST_PERCENTAGE
): Promise<RecipeProfitabilityReport> {
  try {
    // Get property and warehouse info
    const [property, warehouse] = await Promise.all([
      db.property.findUnique({
        where: { id: propertyId },
        select: { id: true, name: true },
      }),
      db.warehouse.findUnique({
        where: { id: warehouseId },
        select: { id: true, name: true },
      }),
    ]);

    if (!property || !warehouse) {
      return {
        generatedAt: new Date(),
        propertyId,
        propertyName: property?.name || "Unknown",
        warehouseId,
        warehouseName: warehouse?.name || "Unknown",
        targetFoodCostPercentage,
        totalRecipes: 0,
        recipesAboveTarget: 0,
        averageFoodCostPercentage: 0,
        recipes: [],
      };
    }

    // Get all active recipes with their ingredients and menu items
    const recipes = await db.recipe.findMany({
      where: { isActive: true },
      include: {
        yieldUnit: {
          select: { abbreviation: true },
        },
        ingredients: {
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                primaryUnitId: true,
              },
            },
            unit: {
              select: {
                id: true,
                abbreviation: true,
              },
            },
          },
        },
        menuItems: {
          where: { propertyId },
          select: {
            id: true,
            name: true,
            sellingPrice: true,
          },
        },
        _count: {
          select: { ingredients: true },
        },
      },
    });

    const recipeItems: RecipeProfitabilityItem[] = [];

    for (const recipe of recipes) {
      // Calculate recipe cost from ingredients
      let totalCost = new Decimal(0);

      for (const ingredient of recipe.ingredients) {
        // Get weighted average cost for this ingredient
        const stockLevel = await db.stockLevel.findUnique({
          where: {
            stockItemId_warehouseId: {
              stockItemId: ingredient.stockItemId,
              warehouseId,
            },
          },
        });

        const unitCost = stockLevel ? new Decimal(stockLevel.averageCost.toString()) : new Decimal(0);
        const ingredientCost = new Decimal(ingredient.quantity.toString()).mul(unitCost);
        totalCost = totalCost.add(ingredientCost);
      }

      const recipeCost = totalCost.toNumber();
      const recipeYield = Number(recipe.yield);
      const costPerPortion = recipeYield > 0 ? recipeCost / recipeYield : 0;

      // Get associated menu item (if any)
      const menuItem = recipe.menuItems[0] || null;
      const sellingPrice = menuItem ? Number(menuItem.sellingPrice) : null;
      
      let grossProfit: number | null = null;
      let foodCostPercentage: number | null = null;
      let isAboveTargetCost = false;

      if (sellingPrice && sellingPrice > 0) {
        grossProfit = sellingPrice - costPerPortion;
        foodCostPercentage = (costPerPortion / sellingPrice) * 100;
        isAboveTargetCost = foodCostPercentage > targetFoodCostPercentage;
      }

      recipeItems.push({
        recipeId: recipe.id,
        recipeName: recipe.name,
        menuItemId: menuItem?.id || null,
        menuItemName: menuItem?.name || null,
        sellingPrice,
        recipeCost: Math.round(recipeCost * 100) / 100,
        costPerPortion: Math.round(costPerPortion * 10000) / 10000,
        yield: recipeYield,
        grossProfit: grossProfit !== null ? Math.round(grossProfit * 100) / 100 : null,
        foodCostPercentage: foodCostPercentage !== null 
          ? Math.round(foodCostPercentage * 100) / 100 
          : null,
        isAboveTargetCost,
        ingredientCount: recipe._count.ingredients,
      });
    }

    // Sort by food cost percentage descending (highest cost first)
    recipeItems.sort((a, b) => {
      if (a.foodCostPercentage === null) return 1;
      if (b.foodCostPercentage === null) return -1;
      return b.foodCostPercentage - a.foodCostPercentage;
    });

    // Calculate summary stats
    const recipesWithPricing = recipeItems.filter((r) => r.foodCostPercentage !== null);
    const recipesAboveTarget = recipesWithPricing.filter((r) => r.isAboveTargetCost).length;
    const averageFoodCostPercentage = recipesWithPricing.length > 0
      ? recipesWithPricing.reduce((sum, r) => sum + (r.foodCostPercentage || 0), 0) / recipesWithPricing.length
      : 0;

    return {
      generatedAt: new Date(),
      propertyId,
      propertyName: property.name,
      warehouseId,
      warehouseName: warehouse.name,
      targetFoodCostPercentage,
      totalRecipes: recipeItems.length,
      recipesAboveTarget,
      averageFoodCostPercentage: Math.round(averageFoodCostPercentage * 100) / 100,
      recipes: recipeItems,
    };
  } catch (error) {
    console.error("Generate Recipe Profitability Report Error:", error);
    return {
      generatedAt: new Date(),
      propertyId,
      propertyName: "Error",
      warehouseId,
      warehouseName: "Error",
      targetFoodCostPercentage,
      totalRecipes: 0,
      recipesAboveTarget: 0,
      averageFoodCostPercentage: 0,
      recipes: [],
    };
  }
}


// ============================================================================
// Waste Analysis Report
// Requirements: 12.7
// ============================================================================

/**
 * Generate waste analysis report with trends and cost impact
 * Requirements: 12.7
 */
export async function generateWasteAnalysisReport(
  propertyId: string,
  startDate: Date,
  endDate: Date
): Promise<WasteAnalysisReport> {
  try {
    // Get property info
    const property = await db.property.findUnique({
      where: { id: propertyId },
      select: { id: true, name: true },
    });

    if (!property) {
      return {
        generatedAt: new Date(),
        propertyId,
        propertyName: "Unknown",
        periodStart: startDate,
        periodEnd: endDate,
        totalWasteCost: 0,
        totalConsumptionCost: 0,
        overallWastePercentage: 0,
        byWarehouse: [],
        byType: [],
        topWastedItems: [],
        trends: [],
      };
    }

    // Get all warehouses for the property
    const warehouses = await db.warehouse.findMany({
      where: { propertyId, isActive: true },
      select: { id: true, name: true },
    });

    const warehouseIds = warehouses.map((w) => w.id);

    // Get all waste records in the period
    const wasteRecords = await db.wasteRecord.findMany({
      where: {
        warehouseId: { in: warehouseIds },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
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
          },
        },
      },
    });

    // Get all consumption movements (CONSUMPTION + WASTE) in the period
    const consumptionMovements = await db.stockMovement.findMany({
      where: {
        sourceWarehouseId: { in: warehouseIds },
        type: { in: ["CONSUMPTION", "WASTE"] },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Calculate totals
    const totalWasteCost = wasteRecords.reduce(
      (sum, r) => sum + Number(r.totalCost),
      0
    );

    const totalConsumptionCost = consumptionMovements.reduce(
      (sum, m) => sum + (Number(m.totalCost) || 0),
      0
    );

    const overallWastePercentage = totalConsumptionCost > 0
      ? (totalWasteCost / totalConsumptionCost) * 100
      : 0;

    // Group by warehouse
    const warehouseMap = new Map<string, { name: string; wasteCost: number; consumptionCost: number }>();
    
    for (const warehouse of warehouses) {
      warehouseMap.set(warehouse.id, {
        name: warehouse.name,
        wasteCost: 0,
        consumptionCost: 0,
      });
    }

    for (const record of wasteRecords) {
      const existing = warehouseMap.get(record.warehouseId);
      if (existing) {
        existing.wasteCost += Number(record.totalCost);
      }
    }

    for (const movement of consumptionMovements) {
      if (movement.sourceWarehouseId) {
        const existing = warehouseMap.get(movement.sourceWarehouseId);
        if (existing) {
          existing.consumptionCost += Number(movement.totalCost) || 0;
        }
      }
    }

    const byWarehouse = Array.from(warehouseMap.entries()).map(([id, data]) => ({
      warehouseId: id,
      warehouseName: data.name,
      wasteCost: data.wasteCost,
      wastePercentage: data.consumptionCost > 0
        ? Math.round((data.wasteCost / data.consumptionCost) * 10000) / 100
        : 0,
    }));

    byWarehouse.sort((a, b) => b.wasteCost - a.wasteCost);

    // Group by waste type
    const typeMap = new Map<WasteType, { cost: number; quantity: number }>();
    
    for (const record of wasteRecords) {
      const existing = typeMap.get(record.wasteType) || { cost: 0, quantity: 0 };
      typeMap.set(record.wasteType, {
        cost: existing.cost + Number(record.totalCost),
        quantity: existing.quantity + Number(record.quantity),
      });
    }

    const byType = Array.from(typeMap.entries()).map(([type, data]) => ({
      type,
      totalCost: data.cost,
      totalQuantity: data.quantity,
      percentage: totalWasteCost > 0
        ? Math.round((data.cost / totalWasteCost) * 10000) / 100
        : 0,
    }));

    byType.sort((a, b) => b.totalCost - a.totalCost);

    // Get top wasted items
    const itemMap = new Map<string, {
      name: string;
      sku: string | null;
      category: StockCategoryInfo;
      unit: string;
      totalQuantity: number;
      totalCost: number;
      byType: Map<WasteType, { quantity: number; cost: number }>;
    }>();

    for (const record of wasteRecords) {
      const existing = itemMap.get(record.stockItemId) || {
        name: record.stockItem.name,
        sku: record.stockItem.sku,
        category: record.stockItem.category,
        unit: record.stockItem.primaryUnit.abbreviation,
        totalQuantity: 0,
        totalCost: 0,
        byType: new Map(),
      };

      existing.totalQuantity += Number(record.quantity);
      existing.totalCost += Number(record.totalCost);

      const typeData = existing.byType.get(record.wasteType) || { quantity: 0, cost: 0 };
      typeData.quantity += Number(record.quantity);
      typeData.cost += Number(record.totalCost);
      existing.byType.set(record.wasteType, typeData);

      itemMap.set(record.stockItemId, existing);
    }

    const topWastedItems: WasteAnalysisItem[] = Array.from(itemMap.entries())
      .map(([stockItemId, data]) => ({
        stockItemId,
        stockItemName: data.name,
        stockItemSku: data.sku,
        category: data.category,
        totalQuantityWasted: data.totalQuantity,
        totalCostWasted: data.totalCost,
        wastePercentage: totalWasteCost > 0
          ? Math.round((data.totalCost / totalWasteCost) * 10000) / 100
          : 0,
        byType: Array.from(data.byType.entries()).map(([type, typeData]) => ({
          type,
          quantity: typeData.quantity,
          cost: typeData.cost,
        })),
        unit: data.unit,
      }))
      .sort((a, b) => b.totalCostWasted - a.totalCostWasted)
      .slice(0, 20); // Top 20 items

    // Calculate trends (weekly)
    const trends = calculateWasteTrends(wasteRecords, consumptionMovements, startDate, endDate);

    return {
      generatedAt: new Date(),
      propertyId,
      propertyName: property.name,
      periodStart: startDate,
      periodEnd: endDate,
      totalWasteCost,
      totalConsumptionCost,
      overallWastePercentage: Math.round(overallWastePercentage * 100) / 100,
      byWarehouse,
      byType,
      topWastedItems,
      trends,
    };
  } catch (error) {
    console.error("Generate Waste Analysis Report Error:", error);
    return {
      generatedAt: new Date(),
      propertyId,
      propertyName: "Error",
      periodStart: startDate,
      periodEnd: endDate,
      totalWasteCost: 0,
      totalConsumptionCost: 0,
      overallWastePercentage: 0,
      byWarehouse: [],
      byType: [],
      topWastedItems: [],
      trends: [],
    };
  }
}

/**
 * Helper function to calculate weekly waste trends
 */
function calculateWasteTrends(
  wasteRecords: Array<{ createdAt: Date; totalCost: Prisma.Decimal }>,
  consumptionMovements: Array<{ createdAt: Date; totalCost: Prisma.Decimal | null }>,
  startDate: Date,
  endDate: Date
): Array<{ period: string; wasteCost: number; wastePercentage: number }> {
  const trends: Array<{ period: string; wasteCost: number; wastePercentage: number }> = [];
  
  // Calculate number of weeks
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const totalWeeks = Math.ceil((endDate.getTime() - startDate.getTime()) / msPerWeek);
  
  for (let i = 0; i < totalWeeks; i++) {
    const weekStart = new Date(startDate.getTime() + i * msPerWeek);
    const weekEnd = new Date(Math.min(weekStart.getTime() + msPerWeek, endDate.getTime()));
    
    const weekWasteCost = wasteRecords
      .filter((r) => r.createdAt >= weekStart && r.createdAt < weekEnd)
      .reduce((sum, r) => sum + Number(r.totalCost), 0);
    
    const weekConsumptionCost = consumptionMovements
      .filter((m) => m.createdAt >= weekStart && m.createdAt < weekEnd)
      .reduce((sum, m) => sum + (Number(m.totalCost) || 0), 0);
    
    const wastePercentage = weekConsumptionCost > 0
      ? (weekWasteCost / weekConsumptionCost) * 100
      : 0;
    
    trends.push({
      period: `Week ${i + 1} (${weekStart.toISOString().split('T')[0]})`,
      wasteCost: Math.round(weekWasteCost * 100) / 100,
      wastePercentage: Math.round(wastePercentage * 100) / 100,
    });
  }
  
  return trends;
}

// Import Prisma types for the helper function
import { Prisma } from "@prisma/client";
