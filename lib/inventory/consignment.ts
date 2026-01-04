"use server";

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";

// Types
export interface ReceiveConsignmentInput {
  supplierId: string;
  warehouseId: string;
  receivedById: string;
  items: {
    stockItemId: string;
    quantity: number;
    sellingPrice: number;
    supplierCost: number;
  }[];
  notes?: string;
}

export interface RecordConsignmentSaleInput {
  stockItemId: string;
  quantity: number;
}

export interface ReturnConsignmentInput {
  stockItemId: string;
  warehouseId: string;
  quantity: number;
  supplierId: string;
  reason?: string;
  createdById: string;
}

export interface ConsignmentSearchQuery {
  supplierId?: string;
  warehouseId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export interface ConsignmentSaleSearchQuery {
  stockItemId?: string;
  supplierId?: string;
  settled?: boolean;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export interface ConsignmentSettlementItem {
  stockItemId: string;
  stockItemName: string;
  quantity: number;
  sellingPrice: number;
  supplierCost: number;
  totalSupplierDue: number;
}

// ============================================================================
// Consignment Receipt Operations
// ============================================================================

/**
 * Receive consignment stock from a supplier
 * Requirements: 9.1
 * 
 * Property 33: Consignment Receipt Required Fields
 * For any consignment receipt, it SHALL have non-null values for: supplierId, warehouseId,
 * receivedById, and at least one item with quantity > 0 and sellingPrice > 0.
 * 
 * Property 34: Consignment Separation
 * For any stock item, if isConsignment is true, it SHALL be tracked separately in
 * consignment-specific tables (ConsignmentReceiptItem, ConsignmentSale).
 */
export async function receiveConsignment(data: ReceiveConsignmentInput) {
  // Property 33: Validate required fields
  if (!data.supplierId || data.supplierId.trim() === "") {
    return { error: "Supplier ID is required" };
  }

  if (!data.warehouseId || data.warehouseId.trim() === "") {
    return { error: "Warehouse ID is required" };
  }

  if (!data.receivedById || data.receivedById.trim() === "") {
    return { error: "Received by user ID is required" };
  }

  // Property 33: Validate at least one item
  if (!data.items || data.items.length === 0) {
    return { error: "At least one item is required" };
  }

  // Property 33: Validate each item has quantity > 0 and sellingPrice > 0
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    
    if (!item.stockItemId || item.stockItemId.trim() === "") {
      return { error: `Item ${i + 1}: Stock item ID is required` };
    }

    if (item.quantity === undefined || item.quantity === null || item.quantity <= 0) {
      return { error: `Item ${i + 1}: Quantity must be greater than zero` };
    }

    if (item.sellingPrice === undefined || item.sellingPrice === null || item.sellingPrice <= 0) {
      return { error: `Item ${i + 1}: Selling price must be greater than zero` };
    }

    if (item.supplierCost === undefined || item.supplierCost === null || item.supplierCost < 0) {
      return { error: `Item ${i + 1}: Supplier cost cannot be negative` };
    }
  }

  try {
    // Verify supplier exists
    const supplier = await db.supplier.findUnique({
      where: { id: data.supplierId },
    });

    if (!supplier) {
      return { error: "Supplier not found" };
    }

    if (!supplier.isActive) {
      return { error: "Cannot receive consignment from an inactive supplier" };
    }

    // Verify warehouse exists and is active
    const warehouse = await db.warehouse.findUnique({
      where: { id: data.warehouseId },
    });

    if (!warehouse) {
      return { error: "Warehouse not found" };
    }

    if (!warehouse.isActive) {
      return { error: "Cannot receive consignment into an inactive warehouse" };
    }

    // Verify all stock items exist and are consignment items
    for (const item of data.items) {
      const stockItem = await db.stockItem.findUnique({
        where: { id: item.stockItemId },
      });

      if (!stockItem) {
        return { error: `Stock item not found: ${item.stockItemId}` };
      }

      // Property 34: Verify item is marked as consignment
      if (!stockItem.isConsignment) {
        return { error: `Stock item "${stockItem.name}" is not marked as a consignment item` };
      }

      // Verify the stock item belongs to the same supplier
      if (stockItem.supplierId !== data.supplierId) {
        return { error: `Stock item "${stockItem.name}" does not belong to this supplier` };
      }
    }

    // Use transaction to ensure atomicity
    const result = await db.$transaction(async (tx) => {
      // Create consignment receipt
      const receipt = await tx.consignmentReceipt.create({
        data: {
          supplierId: data.supplierId,
          warehouseId: data.warehouseId,
          receivedById: data.receivedById,
          notes: data.notes?.trim() || null,
          items: {
            create: data.items.map((item) => ({
              stockItemId: item.stockItemId,
              quantity: item.quantity,
              sellingPrice: item.sellingPrice,
              supplierCost: item.supplierCost,
            })),
          },
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            include: {
              stockItem: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
      });

      // Update stock levels for each item
      for (const item of data.items) {
        // Get current stock level (if exists)
        const currentStockLevel = await tx.stockLevel.findUnique({
          where: {
            stockItemId_warehouseId: {
              stockItemId: item.stockItemId,
              warehouseId: data.warehouseId,
            },
          },
        });

        const currentQuantity = currentStockLevel
          ? new Decimal(currentStockLevel.quantity.toString())
          : new Decimal(0);
        const newQuantity = currentQuantity.add(new Decimal(item.quantity));

        // For consignment items, we track supplier cost as the average cost
        const currentAvgCost = currentStockLevel
          ? new Decimal(currentStockLevel.averageCost.toString())
          : new Decimal(0);
        const itemQuantity = new Decimal(item.quantity);
        const itemCost = new Decimal(item.supplierCost);

        // Calculate weighted average cost
        const totalOldValue = currentQuantity.mul(currentAvgCost);
        const totalNewValue = itemQuantity.mul(itemCost);
        const totalQuantity = currentQuantity.add(itemQuantity);
        
        const newAvgCost = totalQuantity.isZero()
          ? itemCost
          : totalOldValue.add(totalNewValue).div(totalQuantity);

        // Update or create stock level
        await tx.stockLevel.upsert({
          where: {
            stockItemId_warehouseId: {
              stockItemId: item.stockItemId,
              warehouseId: data.warehouseId,
            },
          },
          update: {
            quantity: newQuantity.toDecimalPlaces(3).toNumber(),
            averageCost: newAvgCost.toDecimalPlaces(4).toNumber(),
          },
          create: {
            stockItemId: item.stockItemId,
            warehouseId: data.warehouseId,
            quantity: itemQuantity.toDecimalPlaces(3).toNumber(),
            averageCost: itemCost.toDecimalPlaces(4).toNumber(),
          },
        });

        // Create stock movement record for receipt
        await tx.stockMovement.create({
          data: {
            stockItemId: item.stockItemId,
            destinationWarehouseId: data.warehouseId,
            type: "RECEIPT",
            quantity: item.quantity,
            unitCost: item.supplierCost,
            totalCost: new Decimal(item.quantity).mul(item.supplierCost).toDecimalPlaces(2).toNumber(),
            referenceType: "CONSIGNMENT_RECEIPT",
            referenceId: receipt.id,
            createdById: data.receivedById,
          },
        });
      }

      return receipt;
    });

    revalidatePath("/admin/inventory/consignment");
    return { success: true, data: result };
  } catch (error) {
    console.error("Receive Consignment Error:", error);
    return { error: "Failed to receive consignment" };
  }
}


/**
 * Get a consignment receipt by ID
 */
export async function getConsignmentReceiptById(id: string) {
  try {
    const receipt = await db.consignmentReceipt.findUnique({
      where: { id },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            contactName: true,
            email: true,
          },
        },
        items: {
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
          },
        },
      },
    });

    return receipt;
  } catch (error) {
    console.error("Get Consignment Receipt Error:", error);
    return null;
  }
}

/**
 * Get consignment receipts with optional filtering
 */
export async function getConsignmentReceipts(query?: ConsignmentSearchQuery) {
  try {
    const where: Prisma.ConsignmentReceiptWhereInput = {};

    if (query?.supplierId) {
      where.supplierId = query.supplierId;
    }

    if (query?.warehouseId) {
      where.warehouseId = query.warehouseId;
    }

    if (query?.startDate || query?.endDate) {
      where.receivedAt = {};
      if (query.startDate) {
        where.receivedAt.gte = query.startDate;
      }
      if (query.endDate) {
        where.receivedAt.lte = query.endDate;
      }
    }

    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const [receipts, total] = await Promise.all([
      db.consignmentReceipt.findMany({
        where,
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            include: {
              stockItem: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
        orderBy: { receivedAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.consignmentReceipt.count({ where }),
    ]);

    return {
      receipts,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Get Consignment Receipts Error:", error);
    return {
      receipts: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    };
  }
}

// ============================================================================
// Consignment Sale Operations
// ============================================================================

/**
 * Record a consignment sale
 * Requirements: 9.3
 * 
 * Property 35: Consignment Sale Payment Calculation
 * For any consignment sale of quantity Q with supplier cost C, the supplier payment due
 * SHALL equal Q × C.
 */
export async function recordSale(data: RecordConsignmentSaleInput) {
  if (!data.stockItemId || data.stockItemId.trim() === "") {
    return { error: "Stock item ID is required" };
  }

  if (data.quantity === undefined || data.quantity === null || data.quantity <= 0) {
    return { error: "Quantity must be greater than zero" };
  }

  try {
    // Verify stock item exists and is a consignment item
    const stockItem = await db.stockItem.findUnique({
      where: { id: data.stockItemId },
      include: {
        supplier: true,
      },
    });

    if (!stockItem) {
      return { error: "Stock item not found" };
    }

    if (!stockItem.isConsignment) {
      return { error: "Stock item is not a consignment item" };
    }

    if (!stockItem.supplierId) {
      return { error: "Consignment item has no associated supplier" };
    }

    // Get the most recent consignment receipt item to get pricing info
    const latestReceiptItem = await db.consignmentReceiptItem.findFirst({
      where: {
        stockItemId: data.stockItemId,
        receipt: {
          supplierId: stockItem.supplierId,
        },
      },
      orderBy: {
        receipt: {
          receivedAt: "desc",
        },
      },
    });

    if (!latestReceiptItem) {
      return { error: "No consignment receipt found for this item" };
    }

    // Use transaction to ensure atomicity
    const result = await db.$transaction(async (tx) => {
      // Check available stock across all warehouses
      const stockLevels = await tx.stockLevel.findMany({
        where: {
          stockItemId: data.stockItemId,
          warehouse: {
            isActive: true,
          },
        },
      });

      const totalAvailable = stockLevels.reduce(
        (sum, level) => sum + Number(level.quantity),
        0
      );

      if (totalAvailable < data.quantity) {
        throw new Error(
          `Insufficient consignment stock. Available: ${totalAvailable}, Requested: ${data.quantity}`
        );
      }

      // Property 35: Calculate supplier payment due
      const sellingPrice = Number(latestReceiptItem.sellingPrice);
      const supplierCost = Number(latestReceiptItem.supplierCost);

      // Create consignment sale record
      const sale = await tx.consignmentSale.create({
        data: {
          stockItemId: data.stockItemId,
          quantity: data.quantity,
          sellingPrice: sellingPrice,
          supplierCost: supplierCost,
        },
      });

      // Decrease stock from the first warehouse with available stock
      let remainingQuantity = new Decimal(data.quantity);
      
      for (const stockLevel of stockLevels) {
        if (remainingQuantity.isZero()) break;

        const available = new Decimal(stockLevel.quantity.toString());
        const toDeduct = Decimal.min(available, remainingQuantity);

        if (toDeduct.greaterThan(0)) {
          await tx.stockLevel.update({
            where: {
              stockItemId_warehouseId: {
                stockItemId: data.stockItemId,
                warehouseId: stockLevel.warehouseId,
              },
            },
            data: {
              quantity: available.sub(toDeduct).toDecimalPlaces(3).toNumber(),
            },
          });

          remainingQuantity = remainingQuantity.sub(toDeduct);
        }
      }

      return sale;
    });

    revalidatePath("/admin/inventory/consignment");
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Insufficient consignment stock")) {
        return { error: error.message };
      }
    }
    console.error("Record Consignment Sale Error:", error);
    return { error: "Failed to record consignment sale" };
  }
}

/**
 * Get consignment sales with optional filtering
 */
export async function getConsignmentSales(query?: ConsignmentSaleSearchQuery) {
  try {
    const where: Prisma.ConsignmentSaleWhereInput = {};

    if (query?.stockItemId) {
      where.stockItemId = query.stockItemId;
    }

    if (query?.supplierId) {
      // Get stock item IDs for this supplier first
      const supplierItems = await db.stockItem.findMany({
        where: { supplierId: query.supplierId, isConsignment: true },
        select: { id: true },
      });
      where.stockItemId = { in: supplierItems.map((item) => item.id) };
    }

    if (query?.settled !== undefined) {
      if (query.settled) {
        where.settledAt = { not: null };
      } else {
        where.settledAt = null;
      }
    }

    if (query?.startDate || query?.endDate) {
      where.soldAt = {};
      if (query.startDate) {
        where.soldAt.gte = query.startDate;
      }
      if (query.endDate) {
        where.soldAt.lte = query.endDate;
      }
    }

    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const [sales, total] = await Promise.all([
      db.consignmentSale.findMany({
        where,
        include: {
          settlement: {
            select: {
              id: true,
              periodStart: true,
              periodEnd: true,
            },
          },
        },
        orderBy: { soldAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.consignmentSale.count({ where }),
    ]);

    // Fetch stock item details separately
    const stockItemIds = [...new Set(sales.map((s) => s.stockItemId))];
    const stockItems = await db.stockItem.findMany({
      where: { id: { in: stockItemIds } },
      select: {
        id: true,
        name: true,
        sku: true,
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    const stockItemMap = new Map(stockItems.map((item) => [item.id, item]));

    // Combine sales with stock item info
    const salesWithItems = sales.map((sale) => ({
      ...sale,
      stockItem: stockItemMap.get(sale.stockItemId) || null,
    }));

    return {
      sales: salesWithItems,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Get Consignment Sales Error:", error);
    return {
      sales: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    };
  }
}

/**
 * Get unsettled consignment sales for a supplier
 */
export async function getUnsettledSales(supplierId: string) {
  if (!supplierId || supplierId.trim() === "") {
    return [];
  }

  try {
    // Get stock item IDs for this supplier
    const supplierItems = await db.stockItem.findMany({
      where: { supplierId, isConsignment: true },
      select: { id: true, name: true, sku: true },
    });

    if (supplierItems.length === 0) {
      return [];
    }

    const stockItemIds = supplierItems.map((item) => item.id);
    const stockItemMap = new Map(supplierItems.map((item) => [item.id, item]));

    const sales = await db.consignmentSale.findMany({
      where: {
        stockItemId: { in: stockItemIds },
        settledAt: null,
      },
      orderBy: { soldAt: "asc" },
    });

    // Combine sales with stock item info
    return sales.map((sale) => ({
      ...sale,
      stockItem: stockItemMap.get(sale.stockItemId) || null,
    }));
  } catch (error) {
    console.error("Get Unsettled Sales Error:", error);
    return [];
  }
}


// ============================================================================
// Consignment Return Operations
// ============================================================================

/**
 * Return consignment items to supplier
 * Requirements: 9.5
 * 
 * Property 36: Consignment Return Updates Quantity
 * For any consignment return of quantity Q for item I, the consignment stock quantity
 * for item I SHALL decrease by exactly Q and a return record SHALL be created.
 */
export async function returnToSupplier(data: ReturnConsignmentInput) {
  if (!data.stockItemId || data.stockItemId.trim() === "") {
    return { error: "Stock item ID is required" };
  }

  if (!data.warehouseId || data.warehouseId.trim() === "") {
    return { error: "Warehouse ID is required" };
  }

  if (!data.supplierId || data.supplierId.trim() === "") {
    return { error: "Supplier ID is required" };
  }

  if (!data.createdById || data.createdById.trim() === "") {
    return { error: "Created by user ID is required" };
  }

  if (data.quantity === undefined || data.quantity === null || data.quantity <= 0) {
    return { error: "Quantity must be greater than zero" };
  }

  try {
    // Verify stock item exists and is a consignment item
    const stockItem = await db.stockItem.findUnique({
      where: { id: data.stockItemId },
    });

    if (!stockItem) {
      return { error: "Stock item not found" };
    }

    if (!stockItem.isConsignment) {
      return { error: "Stock item is not a consignment item" };
    }

    if (stockItem.supplierId !== data.supplierId) {
      return { error: "Stock item does not belong to this supplier" };
    }

    // Verify warehouse exists
    const warehouse = await db.warehouse.findUnique({
      where: { id: data.warehouseId },
    });

    if (!warehouse) {
      return { error: "Warehouse not found" };
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
        throw new Error("No stock available in this warehouse");
      }

      const currentQuantity = new Decimal(stockLevel.quantity.toString());
      const returnQuantity = new Decimal(data.quantity);

      // Property 36: Validate sufficient stock
      if (currentQuantity.lessThan(returnQuantity)) {
        throw new Error(
          `Insufficient stock. Available: ${currentQuantity.toNumber()}, Requested: ${data.quantity}`
        );
      }

      // Property 36: Decrease stock quantity
      const newQuantity = currentQuantity.sub(returnQuantity);

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

      const avgCost = new Decimal(stockLevel.averageCost.toString());
      const totalCost = returnQuantity.mul(avgCost).toDecimalPlaces(2).toNumber();

      // Property 36: Create return movement record
      const movement = await tx.stockMovement.create({
        data: {
          stockItemId: data.stockItemId,
          sourceWarehouseId: data.warehouseId,
          type: "RETURN",
          quantity: data.quantity,
          unitCost: avgCost.toDecimalPlaces(4).toNumber(),
          totalCost: totalCost,
          referenceType: "CONSIGNMENT_RETURN",
          reason: data.reason?.trim() || "Returned to supplier",
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

      return {
        movement,
        previousQuantity: currentQuantity.toNumber(),
        newQuantity: newQuantity.toNumber(),
        returnedQuantity: data.quantity,
      };
    });

    revalidatePath("/admin/inventory/consignment");
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
    console.error("Return To Supplier Error:", error);
    return { error: "Failed to return consignment to supplier" };
  }
}

// ============================================================================
// Consignment Settlement Operations
// ============================================================================

/**
 * Generate a consignment settlement for a supplier
 * Requirements: 9.4
 * 
 * Property 35: Consignment Sale Payment Calculation
 * For any consignment sale of quantity Q with supplier cost C, the supplier payment due
 * SHALL equal Q × C.
 */
export async function generateSettlement(
  supplierId: string,
  periodStart: Date,
  periodEnd: Date
) {
  if (!supplierId || supplierId.trim() === "") {
    return { error: "Supplier ID is required" };
  }

  if (!periodStart) {
    return { error: "Period start date is required" };
  }

  if (!periodEnd) {
    return { error: "Period end date is required" };
  }

  if (periodStart > periodEnd) {
    return { error: "Period start date must be before end date" };
  }

  try {
    // Verify supplier exists
    const supplier = await db.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      return { error: "Supplier not found" };
    }

    // Get stock item IDs for this supplier
    const supplierItems = await db.stockItem.findMany({
      where: { supplierId, isConsignment: true },
      select: { id: true, name: true, sku: true },
    });

    if (supplierItems.length === 0) {
      return { error: "No consignment items found for this supplier" };
    }

    const stockItemIds = supplierItems.map((item) => item.id);

    // Get all unsettled sales for this supplier within the period
    const unsettledSales = await db.consignmentSale.findMany({
      where: {
        stockItemId: { in: stockItemIds },
        settledAt: null,
        soldAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    if (unsettledSales.length === 0) {
      return { error: "No unsettled sales found for this period" };
    }

    // Property 35: Calculate totals
    let totalSales = new Decimal(0);
    let totalSupplierDue = new Decimal(0);

    for (const sale of unsettledSales) {
      const quantity = new Decimal(sale.quantity.toString());
      const sellingPrice = new Decimal(sale.sellingPrice.toString());
      const supplierCost = new Decimal(sale.supplierCost.toString());

      totalSales = totalSales.add(quantity.mul(sellingPrice));
      totalSupplierDue = totalSupplierDue.add(quantity.mul(supplierCost));
    }

    // Use transaction to create settlement and update sales
    const result = await db.$transaction(async (tx) => {
      // Create settlement record
      const settlement = await tx.consignmentSettlement.create({
        data: {
          supplierId,
          periodStart,
          periodEnd,
          totalSales: totalSales.toDecimalPlaces(2).toNumber(),
          totalSupplierDue: totalSupplierDue.toDecimalPlaces(2).toNumber(),
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              contactName: true,
              email: true,
            },
          },
        },
      });

      // Update all sales to link to this settlement
      await tx.consignmentSale.updateMany({
        where: {
          id: { in: unsettledSales.map((s) => s.id) },
        },
        data: {
          settlementId: settlement.id,
        },
      });

      return {
        settlement,
        salesCount: unsettledSales.length,
        totalSales: totalSales.toDecimalPlaces(2).toNumber(),
        totalSupplierDue: totalSupplierDue.toDecimalPlaces(2).toNumber(),
      };
    });

    revalidatePath("/admin/inventory/consignment");
    return { success: true, data: result };
  } catch (error) {
    console.error("Generate Settlement Error:", error);
    return { error: "Failed to generate settlement" };
  }
}

/**
 * Mark a settlement as settled (paid)
 */
export async function markSettlementPaid(settlementId: string) {
  if (!settlementId || settlementId.trim() === "") {
    return { error: "Settlement ID is required" };
  }

  try {
    const settlement = await db.consignmentSettlement.findUnique({
      where: { id: settlementId },
    });

    if (!settlement) {
      return { error: "Settlement not found" };
    }

    if (settlement.settledAt) {
      return { error: "Settlement is already marked as paid" };
    }

    // Update settlement and all associated sales
    const result = await db.$transaction(async (tx) => {
      const updatedSettlement = await tx.consignmentSettlement.update({
        where: { id: settlementId },
        data: {
          settledAt: new Date(),
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Mark all associated sales as settled
      await tx.consignmentSale.updateMany({
        where: {
          settlementId,
        },
        data: {
          settledAt: new Date(),
        },
      });

      return updatedSettlement;
    });

    revalidatePath("/admin/inventory/consignment");
    return { success: true, data: result };
  } catch (error) {
    console.error("Mark Settlement Paid Error:", error);
    return { error: "Failed to mark settlement as paid" };
  }
}

/**
 * Get a settlement by ID
 */
export async function getSettlementById(id: string) {
  try {
    const settlement = await db.consignmentSettlement.findUnique({
      where: { id },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            contactName: true,
            email: true,
            phone: true,
          },
        },
        sales: {
          orderBy: { soldAt: "asc" },
        },
      },
    });

    if (!settlement) {
      return null;
    }

    // Fetch stock item details separately
    const stockItemIds = [...new Set(settlement.sales.map((s) => s.stockItemId))];
    const stockItems = await db.stockItem.findMany({
      where: { id: { in: stockItemIds } },
      select: {
        id: true,
        name: true,
        sku: true,
      },
    });
    const stockItemMap = new Map(stockItems.map((item) => [item.id, item]));

    // Combine sales with stock item info
    const salesWithItems = settlement.sales.map((sale) => ({
      ...sale,
      stockItem: stockItemMap.get(sale.stockItemId) || null,
    }));

    return {
      ...settlement,
      sales: salesWithItems,
    };
  } catch (error) {
    console.error("Get Settlement Error:", error);
    return null;
  }
}

/**
 * Get settlements with optional filtering
 */
export async function getSettlements(query?: {
  supplierId?: string;
  settled?: boolean;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}) {
  try {
    const where: Prisma.ConsignmentSettlementWhereInput = {};

    if (query?.supplierId) {
      where.supplierId = query.supplierId;
    }

    if (query?.settled !== undefined) {
      if (query.settled) {
        where.settledAt = { not: null };
      } else {
        where.settledAt = null;
      }
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

    const [settlements, total] = await Promise.all([
      db.consignmentSettlement.findMany({
        where,
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              sales: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.consignmentSettlement.count({ where }),
    ]);

    return {
      settlements,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Get Settlements Error:", error);
    return {
      settlements: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    };
  }
}

/**
 * Get settlement summary for a supplier
 */
export async function getSupplierSettlementSummary(supplierId: string) {
  if (!supplierId || supplierId.trim() === "") {
    return null;
  }

  try {
    // Get all settlements for the supplier
    const settlements = await db.consignmentSettlement.findMany({
      where: { supplierId },
    });

    // Get stock item IDs for this supplier
    const supplierItems = await db.stockItem.findMany({
      where: { supplierId, isConsignment: true },
      select: { id: true },
    });
    const stockItemIds = supplierItems.map((item) => item.id);

    // Get unsettled sales
    const unsettledSales = stockItemIds.length > 0
      ? await db.consignmentSale.findMany({
          where: {
            stockItemId: { in: stockItemIds },
            settledAt: null,
          },
        })
      : [];

    // Calculate totals
    let totalSettled = new Decimal(0);
    let totalPending = new Decimal(0);

    for (const settlement of settlements) {
      if (settlement.settledAt) {
        totalSettled = totalSettled.add(new Decimal(settlement.totalSupplierDue.toString()));
      } else {
        totalPending = totalPending.add(new Decimal(settlement.totalSupplierDue.toString()));
      }
    }

    // Calculate unsettled sales total
    let unsettledTotal = new Decimal(0);
    for (const sale of unsettledSales) {
      const quantity = new Decimal(sale.quantity.toString());
      const supplierCost = new Decimal(sale.supplierCost.toString());
      unsettledTotal = unsettledTotal.add(quantity.mul(supplierCost));
    }

    return {
      supplierId,
      totalSettlements: settlements.length,
      settledSettlements: settlements.filter((s) => s.settledAt).length,
      pendingSettlements: settlements.filter((s) => !s.settledAt).length,
      totalSettledAmount: totalSettled.toDecimalPlaces(2).toNumber(),
      totalPendingAmount: totalPending.toDecimalPlaces(2).toNumber(),
      unsettledSalesCount: unsettledSales.length,
      unsettledSalesAmount: unsettledTotal.toDecimalPlaces(2).toNumber(),
    };
  } catch (error) {
    console.error("Get Supplier Settlement Summary Error:", error);
    return null;
  }
}

/**
 * Get consignment stock summary by supplier
 */
export async function getConsignmentStockBySupplier(supplierId: string) {
  if (!supplierId || supplierId.trim() === "") {
    return [];
  }

  try {
    // Get all consignment items for this supplier
    const stockItems = await db.stockItem.findMany({
      where: {
        supplierId,
        isConsignment: true,
        isActive: true,
      },
      include: {
        primaryUnit: {
          select: {
            abbreviation: true,
          },
        },
        stockLevels: {
          include: {
            warehouse: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
      },
    });

    return stockItems.map((item) => ({
      stockItemId: item.id,
      stockItemName: item.name,
      stockItemSku: item.sku,
      unit: item.primaryUnit.abbreviation,
      stockLevels: item.stockLevels.map((level) => ({
        warehouseId: level.warehouse.id,
        warehouseName: level.warehouse.name,
        warehouseType: level.warehouse.type,
        quantity: Number(level.quantity),
        averageCost: Number(level.averageCost),
        totalValue: Number(level.quantity) * Number(level.averageCost),
      })),
      totalQuantity: item.stockLevels.reduce(
        (sum, level) => sum + Number(level.quantity),
        0
      ),
      totalValue: item.stockLevels.reduce(
        (sum, level) => sum + Number(level.quantity) * Number(level.averageCost),
        0
      ),
    }));
  } catch (error) {
    console.error("Get Consignment Stock By Supplier Error:", error);
    return [];
  }
}
