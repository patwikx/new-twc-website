"use server";

import { db } from "@/lib/db";
import { WasteType, MenuCategory, POSOrderStatus } from "@prisma/client";
import Decimal from "decimal.js";
import { getPropertyContext, getPropertyFilter } from "@/lib/property-context";

// ============================================================================
// Types for Dashboard Analytics
// Requirements: 16.1, 16.2, 16.3, 16.4, 16.6
// ============================================================================

export interface WarehouseInventoryValue {
  warehouseId: string;
  warehouseName: string;
  warehouseType: string;
  totalValue: number;
  itemCount: number;
  propertyId: string;
  propertyName: string;
}

export interface InventoryValueByWarehouseReport {
  generatedAt: Date;
  propertyId: string | "ALL";
  propertyName: string;
  totalValue: number;
  totalWarehouses: number;
  totalItems: number;
  warehouses: WarehouseInventoryValue[];
}

export interface OutletSalesData {
  outletId: string;
  outletName: string;
  outletType: string;
  propertyId: string;
  propertyName: string;
  totalSales: number;
  orderCount: number;
  averageOrderValue: number;
  taxCollected: number;
  serviceChargeCollected: number;
  discountsGiven: number;
  tipsReceived: number;
}

export interface SalesByOutletReport {
  generatedAt: Date;
  propertyId: string | "ALL";
  propertyName: string;
  periodStart: Date;
  periodEnd: Date;
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  outlets: OutletSalesData[];
  dailyTrend: {
    date: string;
    sales: number;
    orders: number;
  }[];
}

export interface FoodCostTrendItem {
  period: string;
  periodStart: Date;
  periodEnd: Date;
  totalRevenue: number;
  totalCOGS: number;
  foodCostPercentage: number;
  grossProfit: number;
  grossMargin: number;
}

export interface FoodCostTrendsReport {
  generatedAt: Date;
  propertyId: string | "ALL";
  propertyName: string;
  periodStart: Date;
  periodEnd: Date;
  granularity: "daily" | "weekly" | "monthly";
  averageFoodCostPercentage: number;
  trends: FoodCostTrendItem[];
}

export interface WasteByTypeData {
  type: WasteType;
  totalCost: number;
  totalQuantity: number;
  percentage: number;
  recordCount: number;
}

export interface WasteByCategoryData {
  categoryId: string;
  categoryName: string;
  totalCost: number;
  totalQuantity: number;
  percentage: number;
}

export interface WasteByReasonData {
  reason: string;
  totalCost: number;
  totalQuantity: number;
  percentage: number;
  recordCount: number;
}

export interface WasteAnalysisReport {
  generatedAt: Date;
  propertyId: string | "ALL";
  propertyName: string;
  periodStart: Date;
  periodEnd: Date;
  totalWasteCost: number;
  totalWasteQuantity: number;
  totalRecords: number;
  byType: WasteByTypeData[];
  byCategory: WasteByCategoryData[];
  byReason: WasteByReasonData[];
  trends: {
    period: string;
    wasteCost: number;
    wasteQuantity: number;
  }[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get date range for different periods
 */
function getDateRange(
  view: "daily" | "weekly" | "monthly",
  referenceDate: Date = new Date()
): { start: Date; end: Date } {
  const end = new Date(referenceDate);
  end.setHours(23, 59, 59, 999);

  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);

  switch (view) {
    case "daily":
      // Last 30 days
      start.setDate(start.getDate() - 30);
      break;
    case "weekly":
      // Last 12 weeks
      start.setDate(start.getDate() - 84);
      break;
    case "monthly":
      // Last 12 months
      start.setMonth(start.getMonth() - 12);
      break;
  }

  return { start, end };
}

/**
 * Format date for period grouping
 */
function formatPeriod(date: Date, granularity: "daily" | "weekly" | "monthly"): string {
  switch (granularity) {
    case "daily":
      return date.toISOString().slice(0, 10);
    case "weekly":
      // Get ISO week number
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + 4 - (d.getDay() || 7));
      const yearStart = new Date(d.getFullYear(), 0, 1);
      const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      return `${d.getFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
    case "monthly":
      return date.toISOString().slice(0, 7);
  }
}

// ============================================================================
// Inventory Value by Warehouse
// Requirements: 16.1
// ============================================================================

/**
 * Get the property ID from context for analytics queries
 * Requirements: 1.1, 1.2, 1.3
 * 
 * @returns The property ID or "ALL" for super admins with all properties selected
 */
export async function getAnalyticsPropertyId(): Promise<string | "ALL"> {
  const context = await getPropertyContext();
  return context.isAllProperties ? "ALL" : context.propertyId;
}

/**
 * Get inventory value by warehouse for the current property
 * Requirements: 16.1
 * 
 * THE System SHALL display inventory value by warehouse for the current property
 * 
 * @param propertyId - The property ID or "ALL" for all properties (super admin)
 * @returns Inventory value breakdown by warehouse
 */
export async function getInventoryValueByWarehouse(
  propertyId: string | "ALL"
): Promise<InventoryValueByWarehouseReport> {
  try {
    // Build where clause based on property scope
    const warehouseWhere = propertyId === "ALL" 
      ? { isActive: true }
      : { propertyId, isActive: true };

    // Get all warehouses with their stock levels
    const warehouses = await db.warehouse.findMany({
      where: warehouseWhere,
      include: {
        property: {
          select: {
            id: true,
            name: true,
          },
        },
        stockLevels: {
          where: {
            stockItem: {
              isActive: true,
            },
          },
          select: {
            quantity: true,
            averageCost: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Calculate value for each warehouse
    const warehouseValues: WarehouseInventoryValue[] = warehouses.map((warehouse) => {
      let totalValue = new Decimal(0);
      let itemCount = 0;

      for (const level of warehouse.stockLevels) {
        const quantity = new Decimal(level.quantity.toString());
        const cost = new Decimal(level.averageCost.toString());
        totalValue = totalValue.add(quantity.mul(cost));
        if (quantity.greaterThan(0)) {
          itemCount++;
        }
      }

      return {
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        warehouseType: warehouse.type,
        totalValue: totalValue.toDecimalPlaces(2).toNumber(),
        itemCount,
        propertyId: warehouse.property.id,
        propertyName: warehouse.property.name,
      };
    });

    // Sort by total value descending
    warehouseValues.sort((a, b) => b.totalValue - a.totalValue);

    // Calculate totals
    const totalValue = warehouseValues.reduce((sum, w) => sum + w.totalValue, 0);
    const totalItems = warehouseValues.reduce((sum, w) => sum + w.itemCount, 0);

    // Get property name for display
    let propertyName = "All Properties";
    if (propertyId !== "ALL") {
      const property = await db.property.findUnique({
        where: { id: propertyId },
        select: { name: true },
      });
      propertyName = property?.name || "Unknown Property";
    }

    return {
      generatedAt: new Date(),
      propertyId,
      propertyName,
      totalValue,
      totalWarehouses: warehouseValues.length,
      totalItems,
      warehouses: warehouseValues,
    };
  } catch (error) {
    console.error("Get Inventory Value By Warehouse Error:", error);
    return {
      generatedAt: new Date(),
      propertyId,
      propertyName: propertyId === "ALL" ? "All Properties" : "Error",
      totalValue: 0,
      totalWarehouses: 0,
      totalItems: 0,
      warehouses: [],
    };
  }
}

// ============================================================================
// Sales by Outlet
// Requirements: 16.2
// ============================================================================

/**
 * Get sales by outlet with date range filtering
 * Requirements: 16.2
 * 
 * THE System SHALL display sales by outlet with daily, weekly, and monthly views
 * 
 * @param propertyId - The property ID or "ALL" for all properties
 * @param startDate - Start of the reporting period
 * @param endDate - End of the reporting period
 * @returns Sales breakdown by outlet
 */
export async function getSalesByOutlet(
  propertyId: string | "ALL",
  startDate: Date,
  endDate: Date
): Promise<SalesByOutletReport> {
  try {
    // Build where clause for orders
    const orderWhere: {
      status: POSOrderStatus;
      createdAt: { gte: Date; lte: Date };
      outlet?: { propertyId: string };
    } = {
      status: "PAID",
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (propertyId !== "ALL") {
      orderWhere.outlet = { propertyId };
    }

    // Get all paid orders with outlet info
    const orders = await db.pOSOrder.findMany({
      where: orderWhere,
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            type: true,
            propertyId: true,
            property: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Group by outlet
    const outletMap = new Map<string, {
      outlet: typeof orders[0]["outlet"];
      totalSales: Decimal;
      orderCount: number;
      taxCollected: Decimal;
      serviceChargeCollected: Decimal;
      discountsGiven: Decimal;
      tipsReceived: Decimal;
    }>();

    // Group by date for daily trend
    const dailyMap = new Map<string, { sales: Decimal; orders: number }>();

    for (const order of orders) {
      // Outlet aggregation
      const existing = outletMap.get(order.outletId) || {
        outlet: order.outlet,
        totalSales: new Decimal(0),
        orderCount: 0,
        taxCollected: new Decimal(0),
        serviceChargeCollected: new Decimal(0),
        discountsGiven: new Decimal(0),
        tipsReceived: new Decimal(0),
      };

      outletMap.set(order.outletId, {
        outlet: order.outlet,
        totalSales: existing.totalSales.add(new Decimal(order.total.toString())),
        orderCount: existing.orderCount + 1,
        taxCollected: existing.taxCollected.add(new Decimal(order.taxAmount.toString())),
        serviceChargeCollected: existing.serviceChargeCollected.add(
          new Decimal(order.serviceCharge.toString())
        ),
        discountsGiven: existing.discountsGiven.add(new Decimal(order.discountAmount.toString())),
        tipsReceived: existing.tipsReceived.add(new Decimal(order.tipAmount.toString())),
      });

      // Daily trend aggregation
      const dateKey = order.createdAt.toISOString().slice(0, 10);
      const dailyExisting = dailyMap.get(dateKey) || { sales: new Decimal(0), orders: 0 };
      dailyMap.set(dateKey, {
        sales: dailyExisting.sales.add(new Decimal(order.total.toString())),
        orders: dailyExisting.orders + 1,
      });
    }

    // Convert outlet map to array
    const outlets: OutletSalesData[] = Array.from(outletMap.values()).map((data) => ({
      outletId: data.outlet.id,
      outletName: data.outlet.name,
      outletType: data.outlet.type,
      propertyId: data.outlet.propertyId,
      propertyName: data.outlet.property.name,
      totalSales: data.totalSales.toDecimalPlaces(2).toNumber(),
      orderCount: data.orderCount,
      averageOrderValue: data.orderCount > 0
        ? data.totalSales.div(data.orderCount).toDecimalPlaces(2).toNumber()
        : 0,
      taxCollected: data.taxCollected.toDecimalPlaces(2).toNumber(),
      serviceChargeCollected: data.serviceChargeCollected.toDecimalPlaces(2).toNumber(),
      discountsGiven: data.discountsGiven.toDecimalPlaces(2).toNumber(),
      tipsReceived: data.tipsReceived.toDecimalPlaces(2).toNumber(),
    }));

    // Sort by total sales descending
    outlets.sort((a, b) => b.totalSales - a.totalSales);

    // Convert daily map to array and sort by date
    const dailyTrend = Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        sales: data.sales.toDecimalPlaces(2).toNumber(),
        orders: data.orders,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate totals
    const totalSales = outlets.reduce((sum, o) => sum + o.totalSales, 0);
    const totalOrders = outlets.reduce((sum, o) => sum + o.orderCount, 0);
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    // Get property name for display
    let propertyName = "All Properties";
    if (propertyId !== "ALL") {
      const property = await db.property.findUnique({
        where: { id: propertyId },
        select: { name: true },
      });
      propertyName = property?.name || "Unknown Property";
    }

    return {
      generatedAt: new Date(),
      propertyId,
      propertyName,
      periodStart: startDate,
      periodEnd: endDate,
      totalSales,
      totalOrders,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      outlets,
      dailyTrend,
    };
  } catch (error) {
    console.error("Get Sales By Outlet Error:", error);
    return {
      generatedAt: new Date(),
      propertyId,
      propertyName: propertyId === "ALL" ? "All Properties" : "Error",
      periodStart: startDate,
      periodEnd: endDate,
      totalSales: 0,
      totalOrders: 0,
      averageOrderValue: 0,
      outlets: [],
      dailyTrend: [],
    };
  }
}


// ============================================================================
// Food Cost Trends
// Requirements: 16.3
// ============================================================================

/**
 * Get food cost percentage trends over time
 * Requirements: 16.3
 * 
 * THE System SHALL display food cost percentage trends over time
 * 
 * @param propertyId - The property ID or "ALL" for all properties
 * @param startDate - Start of the reporting period
 * @param endDate - End of the reporting period
 * @param granularity - Time granularity for grouping (daily, weekly, monthly)
 * @returns Food cost trends over the period
 */
export async function getFoodCostTrends(
  propertyId: string | "ALL",
  startDate: Date,
  endDate: Date,
  granularity: "daily" | "weekly" | "monthly" = "daily"
): Promise<FoodCostTrendsReport> {
  try {
    // Build where clause for COGS records
    const cogsWhere: {
      createdAt: { gte: Date; lte: Date };
      menuItem?: { propertyId: string };
    } = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (propertyId !== "ALL") {
      cogsWhere.menuItem = { propertyId };
    }

    // Get all COGS records with menu item info
    const cogsRecords = await db.cOGSRecord.findMany({
      where: cogsWhere,
      include: {
        menuItem: {
          select: {
            sellingPrice: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Group by period
    const periodMap = new Map<string, {
      periodStart: Date;
      periodEnd: Date;
      totalRevenue: Decimal;
      totalCOGS: Decimal;
    }>();

    for (const record of cogsRecords) {
      const periodKey = formatPeriod(record.createdAt, granularity);
      
      const existing = periodMap.get(periodKey) || {
        periodStart: record.createdAt,
        periodEnd: record.createdAt,
        totalRevenue: new Decimal(0),
        totalCOGS: new Decimal(0),
      };

      // Calculate revenue from selling price * quantity
      const revenue = new Decimal(record.menuItem.sellingPrice.toString()).mul(record.quantity);
      const cogs = new Decimal(record.totalCost.toString());

      periodMap.set(periodKey, {
        periodStart: existing.periodStart < record.createdAt ? existing.periodStart : record.createdAt,
        periodEnd: existing.periodEnd > record.createdAt ? existing.periodEnd : record.createdAt,
        totalRevenue: existing.totalRevenue.add(revenue),
        totalCOGS: existing.totalCOGS.add(cogs),
      });
    }

    // Convert to array and calculate percentages
    const trends: FoodCostTrendItem[] = Array.from(periodMap.entries())
      .map(([period, data]) => {
        const totalRevenue = data.totalRevenue.toDecimalPlaces(2).toNumber();
        const totalCOGS = data.totalCOGS.toDecimalPlaces(2).toNumber();
        const grossProfit = totalRevenue - totalCOGS;
        const foodCostPercentage = totalRevenue > 0 
          ? (totalCOGS / totalRevenue) * 100 
          : 0;
        const grossMargin = totalRevenue > 0 
          ? (grossProfit / totalRevenue) * 100 
          : 0;

        return {
          period,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          totalRevenue,
          totalCOGS,
          foodCostPercentage: Math.round(foodCostPercentage * 100) / 100,
          grossProfit,
          grossMargin: Math.round(grossMargin * 100) / 100,
        };
      })
      .sort((a, b) => a.period.localeCompare(b.period));

    // Calculate average food cost percentage
    const totalRevenue = trends.reduce((sum, t) => sum + t.totalRevenue, 0);
    const totalCOGS = trends.reduce((sum, t) => sum + t.totalCOGS, 0);
    const averageFoodCostPercentage = totalRevenue > 0 
      ? Math.round((totalCOGS / totalRevenue) * 10000) / 100 
      : 0;

    // Get property name for display
    let propertyName = "All Properties";
    if (propertyId !== "ALL") {
      const property = await db.property.findUnique({
        where: { id: propertyId },
        select: { name: true },
      });
      propertyName = property?.name || "Unknown Property";
    }

    return {
      generatedAt: new Date(),
      propertyId,
      propertyName,
      periodStart: startDate,
      periodEnd: endDate,
      granularity,
      averageFoodCostPercentage,
      trends,
    };
  } catch (error) {
    console.error("Get Food Cost Trends Error:", error);
    return {
      generatedAt: new Date(),
      propertyId,
      propertyName: propertyId === "ALL" ? "All Properties" : "Error",
      periodStart: startDate,
      periodEnd: endDate,
      granularity,
      averageFoodCostPercentage: 0,
      trends: [],
    };
  }
}

// ============================================================================
// Waste Analysis
// Requirements: 16.4
// ============================================================================

/**
 * Get waste analysis by category and reason
 * Requirements: 16.4
 * 
 * THE System SHALL display waste analysis by category and reason
 * 
 * @param propertyId - The property ID or "ALL" for all properties
 * @param startDate - Start of the reporting period
 * @param endDate - End of the reporting period
 * @returns Waste analysis breakdown
 */
export async function getWasteAnalysis(
  propertyId: string | "ALL",
  startDate: Date,
  endDate: Date
): Promise<WasteAnalysisReport> {
  try {
    // Build where clause for waste records
    const wasteWhere: {
      createdAt: { gte: Date; lte: Date };
      warehouse?: { propertyId: string };
    } = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (propertyId !== "ALL") {
      wasteWhere.warehouse = { propertyId };
    }

    // Get all waste records with related data
    const wasteRecords = await db.wasteRecord.findMany({
      where: wasteWhere,
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Calculate totals
    let totalWasteCost = new Decimal(0);
    let totalWasteQuantity = new Decimal(0);

    // Group by type
    const typeMap = new Map<WasteType, {
      totalCost: Decimal;
      totalQuantity: Decimal;
      recordCount: number;
    }>();

    // Group by category
    const categoryMap = new Map<string, {
      categoryName: string;
      totalCost: Decimal;
      totalQuantity: Decimal;
    }>();

    // Group by reason
    const reasonMap = new Map<string, {
      totalCost: Decimal;
      totalQuantity: Decimal;
      recordCount: number;
    }>();

    // Group by date for trends
    const trendMap = new Map<string, {
      wasteCost: Decimal;
      wasteQuantity: Decimal;
    }>();

    for (const record of wasteRecords) {
      const cost = new Decimal(record.totalCost.toString());
      const quantity = new Decimal(record.quantity.toString());

      totalWasteCost = totalWasteCost.add(cost);
      totalWasteQuantity = totalWasteQuantity.add(quantity);

      // By type
      const typeExisting = typeMap.get(record.wasteType) || {
        totalCost: new Decimal(0),
        totalQuantity: new Decimal(0),
        recordCount: 0,
      };
      typeMap.set(record.wasteType, {
        totalCost: typeExisting.totalCost.add(cost),
        totalQuantity: typeExisting.totalQuantity.add(quantity),
        recordCount: typeExisting.recordCount + 1,
      });

      // By category
      const categoryId = record.stockItem.category.id;
      const categoryExisting = categoryMap.get(categoryId) || {
        categoryName: record.stockItem.category.name,
        totalCost: new Decimal(0),
        totalQuantity: new Decimal(0),
      };
      categoryMap.set(categoryId, {
        categoryName: record.stockItem.category.name,
        totalCost: categoryExisting.totalCost.add(cost),
        totalQuantity: categoryExisting.totalQuantity.add(quantity),
      });

      // By reason (use "No reason specified" if null)
      const reason = record.reason || "No reason specified";
      const reasonExisting = reasonMap.get(reason) || {
        totalCost: new Decimal(0),
        totalQuantity: new Decimal(0),
        recordCount: 0,
      };
      reasonMap.set(reason, {
        totalCost: reasonExisting.totalCost.add(cost),
        totalQuantity: reasonExisting.totalQuantity.add(quantity),
        recordCount: reasonExisting.recordCount + 1,
      });

      // Daily trend
      const dateKey = record.createdAt.toISOString().slice(0, 10);
      const trendExisting = trendMap.get(dateKey) || {
        wasteCost: new Decimal(0),
        wasteQuantity: new Decimal(0),
      };
      trendMap.set(dateKey, {
        wasteCost: trendExisting.wasteCost.add(cost),
        wasteQuantity: trendExisting.wasteQuantity.add(quantity),
      });
    }

    const totalCostNum = totalWasteCost.toDecimalPlaces(2).toNumber();

    // Convert type map to array
    const byType: WasteByTypeData[] = Array.from(typeMap.entries())
      .map(([type, data]) => ({
        type,
        totalCost: data.totalCost.toDecimalPlaces(2).toNumber(),
        totalQuantity: data.totalQuantity.toDecimalPlaces(3).toNumber(),
        percentage: totalCostNum > 0 
          ? Math.round((data.totalCost.toNumber() / totalCostNum) * 10000) / 100 
          : 0,
        recordCount: data.recordCount,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    // Convert category map to array
    const byCategory: WasteByCategoryData[] = Array.from(categoryMap.entries())
      .map(([categoryId, data]) => ({
        categoryId,
        categoryName: data.categoryName,
        totalCost: data.totalCost.toDecimalPlaces(2).toNumber(),
        totalQuantity: data.totalQuantity.toDecimalPlaces(3).toNumber(),
        percentage: totalCostNum > 0 
          ? Math.round((data.totalCost.toNumber() / totalCostNum) * 10000) / 100 
          : 0,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    // Convert reason map to array
    const byReason: WasteByReasonData[] = Array.from(reasonMap.entries())
      .map(([reason, data]) => ({
        reason,
        totalCost: data.totalCost.toDecimalPlaces(2).toNumber(),
        totalQuantity: data.totalQuantity.toDecimalPlaces(3).toNumber(),
        percentage: totalCostNum > 0 
          ? Math.round((data.totalCost.toNumber() / totalCostNum) * 10000) / 100 
          : 0,
        recordCount: data.recordCount,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    // Convert trend map to array
    const trends = Array.from(trendMap.entries())
      .map(([period, data]) => ({
        period,
        wasteCost: data.wasteCost.toDecimalPlaces(2).toNumber(),
        wasteQuantity: data.wasteQuantity.toDecimalPlaces(3).toNumber(),
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    // Get property name for display
    let propertyName = "All Properties";
    if (propertyId !== "ALL") {
      const property = await db.property.findUnique({
        where: { id: propertyId },
        select: { name: true },
      });
      propertyName = property?.name || "Unknown Property";
    }

    return {
      generatedAt: new Date(),
      propertyId,
      propertyName,
      periodStart: startDate,
      periodEnd: endDate,
      totalWasteCost: totalCostNum,
      totalWasteQuantity: totalWasteQuantity.toDecimalPlaces(3).toNumber(),
      totalRecords: wasteRecords.length,
      byType,
      byCategory,
      byReason,
      trends,
    };
  } catch (error) {
    console.error("Get Waste Analysis Error:", error);
    return {
      generatedAt: new Date(),
      propertyId,
      propertyName: propertyId === "ALL" ? "All Properties" : "Error",
      periodStart: startDate,
      periodEnd: endDate,
      totalWasteCost: 0,
      totalWasteQuantity: 0,
      totalRecords: 0,
      byType: [],
      byCategory: [],
      byReason: [],
      trends: [],
    };
  }
}


// ============================================================================
// Multi-Property Consolidation
// Requirements: 16.6
// ============================================================================

/**
 * Get consolidated inventory value across all properties
 * Requirements: 16.6
 * 
 * WHEN viewing "All Properties", THE System SHALL display consolidated metrics across properties
 * 
 * @returns Consolidated inventory value for all properties
 */
export async function getConsolidatedInventoryValue(): Promise<InventoryValueByWarehouseReport> {
  return getInventoryValueByWarehouse("ALL");
}

/**
 * Get consolidated sales across all properties
 * Requirements: 16.6
 * 
 * @param startDate - Start of the reporting period
 * @param endDate - End of the reporting period
 * @returns Consolidated sales for all properties
 */
export async function getConsolidatedSales(
  startDate: Date,
  endDate: Date
): Promise<SalesByOutletReport> {
  return getSalesByOutlet("ALL", startDate, endDate);
}

/**
 * Get consolidated food cost trends across all properties
 * Requirements: 16.6
 * 
 * @param startDate - Start of the reporting period
 * @param endDate - End of the reporting period
 * @param granularity - Time granularity for grouping
 * @returns Consolidated food cost trends for all properties
 */
export async function getConsolidatedFoodCostTrends(
  startDate: Date,
  endDate: Date,
  granularity: "daily" | "weekly" | "monthly" = "daily"
): Promise<FoodCostTrendsReport> {
  return getFoodCostTrends("ALL", startDate, endDate, granularity);
}

/**
 * Get consolidated waste analysis across all properties
 * Requirements: 16.6
 * 
 * @param startDate - Start of the reporting period
 * @param endDate - End of the reporting period
 * @returns Consolidated waste analysis for all properties
 */
export async function getConsolidatedWasteAnalysis(
  startDate: Date,
  endDate: Date
): Promise<WasteAnalysisReport> {
  return getWasteAnalysis("ALL", startDate, endDate);
}

// ============================================================================
// Dashboard Summary
// ============================================================================

export interface DashboardSummary {
  generatedAt: Date;
  propertyId: string | "ALL";
  propertyName: string;
  inventory: {
    totalValue: number;
    warehouseCount: number;
    itemCount: number;
  };
  sales: {
    todaySales: number;
    todayOrders: number;
    weekSales: number;
    weekOrders: number;
    monthSales: number;
    monthOrders: number;
  };
  foodCost: {
    currentPercentage: number;
    trend: "up" | "down" | "stable";
    previousPercentage: number;
  };
  waste: {
    monthTotal: number;
    topType: WasteType | null;
    topCategory: string | null;
  };
}

/**
 * Get dashboard summary with key metrics
 * 
 * @param propertyId - The property ID or "ALL" for all properties
 * @returns Dashboard summary with key metrics
 */
export async function getDashboardSummary(
  propertyId: string | "ALL"
): Promise<DashboardSummary> {
  try {
    const now = new Date();
    
    // Date ranges
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    
    const monthStart = new Date(todayStart);
    monthStart.setMonth(monthStart.getMonth() - 1);
    
    const previousMonthStart = new Date(monthStart);
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);

    // Get inventory value
    const inventoryReport = await getInventoryValueByWarehouse(propertyId);

    // Get sales data
    const [todaySales, weekSales, monthSales] = await Promise.all([
      getSalesByOutlet(propertyId, todayStart, todayEnd),
      getSalesByOutlet(propertyId, weekStart, todayEnd),
      getSalesByOutlet(propertyId, monthStart, todayEnd),
    ]);

    // Get food cost data
    const [currentFoodCost, previousFoodCost] = await Promise.all([
      getFoodCostTrends(propertyId, monthStart, todayEnd, "monthly"),
      getFoodCostTrends(propertyId, previousMonthStart, monthStart, "monthly"),
    ]);

    // Get waste data
    const wasteReport = await getWasteAnalysis(propertyId, monthStart, todayEnd);

    // Determine food cost trend
    let foodCostTrend: "up" | "down" | "stable" = "stable";
    const currentPct = currentFoodCost.averageFoodCostPercentage;
    const previousPct = previousFoodCost.averageFoodCostPercentage;
    if (currentPct > previousPct + 1) {
      foodCostTrend = "up";
    } else if (currentPct < previousPct - 1) {
      foodCostTrend = "down";
    }

    return {
      generatedAt: now,
      propertyId,
      propertyName: inventoryReport.propertyName,
      inventory: {
        totalValue: inventoryReport.totalValue,
        warehouseCount: inventoryReport.totalWarehouses,
        itemCount: inventoryReport.totalItems,
      },
      sales: {
        todaySales: todaySales.totalSales,
        todayOrders: todaySales.totalOrders,
        weekSales: weekSales.totalSales,
        weekOrders: weekSales.totalOrders,
        monthSales: monthSales.totalSales,
        monthOrders: monthSales.totalOrders,
      },
      foodCost: {
        currentPercentage: currentPct,
        trend: foodCostTrend,
        previousPercentage: previousPct,
      },
      waste: {
        monthTotal: wasteReport.totalWasteCost,
        topType: wasteReport.byType[0]?.type || null,
        topCategory: wasteReport.byCategory[0]?.categoryName || null,
      },
    };
  } catch (error) {
    console.error("Get Dashboard Summary Error:", error);
    return {
      generatedAt: new Date(),
      propertyId,
      propertyName: propertyId === "ALL" ? "All Properties" : "Error",
      inventory: {
        totalValue: 0,
        warehouseCount: 0,
        itemCount: 0,
      },
      sales: {
        todaySales: 0,
        todayOrders: 0,
        weekSales: 0,
        weekOrders: 0,
        monthSales: 0,
        monthOrders: 0,
      },
      foodCost: {
        currentPercentage: 0,
        trend: "stable",
        previousPercentage: 0,
      },
      waste: {
        monthTotal: 0,
        topType: null,
        topCategory: null,
      },
    };
  }
}

// ============================================================================
// Convenience Functions for Common Date Ranges
// ============================================================================

/**
 * Get sales for today
 */
export async function getTodaySales(propertyId: string | "ALL"): Promise<SalesByOutletReport> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  return getSalesByOutlet(propertyId, todayStart, todayEnd);
}

/**
 * Get sales for this week
 */
export async function getWeekSales(propertyId: string | "ALL"): Promise<SalesByOutletReport> {
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const weekStart = new Date(todayEnd);
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);
  return getSalesByOutlet(propertyId, weekStart, todayEnd);
}

/**
 * Get sales for this month
 */
export async function getMonthSales(propertyId: string | "ALL"): Promise<SalesByOutletReport> {
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const monthStart = new Date(todayEnd);
  monthStart.setMonth(monthStart.getMonth() - 1);
  monthStart.setHours(0, 0, 0, 0);
  return getSalesByOutlet(propertyId, monthStart, todayEnd);
}

/**
 * Get food cost trends for the last 30 days
 */
export async function getLast30DaysFoodCostTrends(
  propertyId: string | "ALL"
): Promise<FoodCostTrendsReport> {
  const { start, end } = getDateRange("daily");
  return getFoodCostTrends(propertyId, start, end, "daily");
}

/**
 * Get food cost trends for the last 12 weeks
 */
export async function getLast12WeeksFoodCostTrends(
  propertyId: string | "ALL"
): Promise<FoodCostTrendsReport> {
  const { start, end } = getDateRange("weekly");
  return getFoodCostTrends(propertyId, start, end, "weekly");
}

/**
 * Get food cost trends for the last 12 months
 */
export async function getLast12MonthsFoodCostTrends(
  propertyId: string | "ALL"
): Promise<FoodCostTrendsReport> {
  const { start, end } = getDateRange("monthly");
  return getFoodCostTrends(propertyId, start, end, "monthly");
}

/**
 * Get waste analysis for the last 30 days
 */
export async function getLast30DaysWasteAnalysis(
  propertyId: string | "ALL"
): Promise<WasteAnalysisReport> {
  const { start, end } = getDateRange("daily");
  return getWasteAnalysis(propertyId, start, end);
}

/**
 * Get waste analysis for the last month
 */
export async function getLastMonthWasteAnalysis(
  propertyId: string | "ALL"
): Promise<WasteAnalysisReport> {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const start = new Date(end);
  start.setMonth(start.getMonth() - 1);
  start.setHours(0, 0, 0, 0);
  return getWasteAnalysis(propertyId, start, end);
}
