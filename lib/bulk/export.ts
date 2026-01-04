"use server";

import { db } from "@/lib/db";

// ============================================================================
// Bulk Export Service
// Requirements: 17.3
// ============================================================================

/**
 * Stock item export data structure
 */
export interface StockItemExportRow {
  itemCode: string;
  name: string;
  sku: string | null;
  categoryName: string;
  unitAbbreviation: string;
  isConsignment: boolean;
  supplierName: string | null;
  isActive: boolean;
  createdAt: string;
}

/**
 * Order export data structure
 */
export interface OrderExportRow {
  orderNumber: string;
  outletName: string;
  outletType: string;
  tableNumber: string | null;
  serverName: string | null;
  status: string;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  discountAmount: number;
  tipAmount: number;
  total: number;
  itemCount: number;
  paymentMethods: string;
  createdAt: string;
}

/**
 * Export result structure
 */
export interface ExportResult {
  success: boolean;
  data: string;
  filename: string;
  mimeType: string;
  rowCount: number;
  error?: string;
}

/**
 * Escape CSV field value
 */
function escapeCSV(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert array of objects to CSV string
 */
function arrayToCSV<T extends object>(
  data: T[],
  headers: { key: keyof T; label: string }[]
): string {
  if (data.length === 0) {
    return headers.map((h) => escapeCSV(h.label)).join(",");
  }

  const headerRow = headers.map((h) => escapeCSV(h.label)).join(",");
  const dataRows = data.map((row) =>
    headers.map((h) => escapeCSV(row[h.key] as string | number | boolean | null)).join(",")
  );

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Generate filename with timestamp
 */
function generateFilename(prefix: string, extension: string): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  return `${prefix}_${timestamp}.${extension}`;
}

/**
 * Format date for export
 */
function formatDate(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Export stock items to CSV
 * Requirements: 17.3
 */
export async function exportStockItems(propertyId: string): Promise<ExportResult> {
  try {
    const stockItems = await db.stockItem.findMany({
      where: { propertyId },
      include: {
        category: { select: { name: true } },
        primaryUnit: { select: { abbreviation: true } },
        supplier: { select: { name: true } },
      },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    });

    const exportData: StockItemExportRow[] = stockItems.map((item) => ({
      itemCode: item.itemCode,
      name: item.name,
      sku: item.sku,
      categoryName: item.category.name,
      unitAbbreviation: item.primaryUnit.abbreviation,
      isConsignment: item.isConsignment,
      supplierName: item.supplier?.name ?? null,
      isActive: item.isActive,
      createdAt: formatDate(item.createdAt),
    }));

    const headers: { key: keyof StockItemExportRow; label: string }[] = [
      { key: "itemCode", label: "Item Code" },
      { key: "name", label: "Name" },
      { key: "sku", label: "SKU" },
      { key: "categoryName", label: "Category" },
      { key: "unitAbbreviation", label: "Unit" },
      { key: "isConsignment", label: "Consignment" },
      { key: "supplierName", label: "Supplier" },
      { key: "isActive", label: "Active" },
      { key: "createdAt", label: "Created At" },
    ];

    const csv = arrayToCSV(exportData, headers);
    const filename = generateFilename("stock_items_export", "csv");

    return {
      success: true,
      data: csv,
      filename,
      mimeType: "text/csv;charset=utf-8;",
      rowCount: exportData.length,
    };
  } catch (error) {
    console.error("Export Stock Items Error:", error);
    return {
      success: false,
      data: "",
      filename: "",
      mimeType: "",
      rowCount: 0,
      error: "Failed to export stock items",
    };
  }
}

/**
 * Export stock items with stock levels to CSV
 * Requirements: 17.3
 */
export async function exportStockItemsWithLevels(propertyId: string): Promise<ExportResult> {
  try {
    const stockItems = await db.stockItem.findMany({
      where: { propertyId },
      include: {
        category: { select: { name: true } },
        primaryUnit: { select: { abbreviation: true } },
        supplier: { select: { name: true } },
        stockLevels: {
          include: {
            warehouse: { select: { name: true } },
          },
        },
      },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    });

    // Flatten stock levels into rows
    interface StockLevelExportRow {
      itemCode: string;
      name: string;
      sku: string | null;
      categoryName: string;
      unitAbbreviation: string;
      warehouseName: string;
      quantity: number;
      averageCost: number;
      totalValue: number;
    }

    const exportData: StockLevelExportRow[] = [];

    for (const item of stockItems) {
      if (item.stockLevels.length === 0) {
        // Include items with no stock levels
        exportData.push({
          itemCode: item.itemCode,
          name: item.name,
          sku: item.sku,
          categoryName: item.category.name,
          unitAbbreviation: item.primaryUnit.abbreviation,
          warehouseName: "(No Stock)",
          quantity: 0,
          averageCost: 0,
          totalValue: 0,
        });
      } else {
        for (const level of item.stockLevels) {
          const quantity = Number(level.quantity);
          const avgCost = Number(level.averageCost);
          exportData.push({
            itemCode: item.itemCode,
            name: item.name,
            sku: item.sku,
            categoryName: item.category.name,
            unitAbbreviation: item.primaryUnit.abbreviation,
            warehouseName: level.warehouse.name,
            quantity,
            averageCost: avgCost,
            totalValue: quantity * avgCost,
          });
        }
      }
    }

    const headers: { key: keyof StockLevelExportRow; label: string }[] = [
      { key: "itemCode", label: "Item Code" },
      { key: "name", label: "Name" },
      { key: "sku", label: "SKU" },
      { key: "categoryName", label: "Category" },
      { key: "unitAbbreviation", label: "Unit" },
      { key: "warehouseName", label: "Warehouse" },
      { key: "quantity", label: "Quantity" },
      { key: "averageCost", label: "Avg Cost" },
      { key: "totalValue", label: "Total Value" },
    ];

    const csv = arrayToCSV(exportData, headers);
    const filename = generateFilename("stock_levels_export", "csv");

    return {
      success: true,
      data: csv,
      filename,
      mimeType: "text/csv;charset=utf-8;",
      rowCount: exportData.length,
    };
  } catch (error) {
    console.error("Export Stock Items With Levels Error:", error);
    return {
      success: false,
      data: "",
      filename: "",
      mimeType: "",
      rowCount: 0,
      error: "Failed to export stock items with levels",
    };
  }
}

/**
 * Export orders to CSV
 * Requirements: 17.3
 */
export async function exportOrders(
  propertyId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ExportResult> {
  try {
    const whereClause: {
      outlet: { propertyId: string };
      createdAt?: { gte?: Date; lte?: Date };
    } = {
      outlet: { propertyId },
    };

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    const orders = await db.pOSOrder.findMany({
      where: whereClause,
      include: {
        outlet: { select: { name: true, type: true } },
        table: { select: { number: true } },
        server: { select: { name: true } },
        items: { select: { id: true } },
        payments: { select: { method: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const exportData: OrderExportRow[] = orders.map((order) => {
      const paymentMethods = [...new Set(order.payments.map((p) => p.method))].join(", ");
      
      return {
        orderNumber: order.orderNumber,
        outletName: order.outlet.name,
        outletType: order.outlet.type,
        tableNumber: order.table?.number ?? null,
        serverName: order.server?.name ?? null,
        status: order.status,
        subtotal: Number(order.subtotal),
        taxAmount: Number(order.taxAmount),
        serviceCharge: Number(order.serviceCharge),
        discountAmount: Number(order.discountAmount),
        tipAmount: Number(order.tipAmount),
        total: Number(order.total),
        itemCount: order.items.length,
        paymentMethods,
        createdAt: formatDate(order.createdAt),
      };
    });

    const headers: { key: keyof OrderExportRow; label: string }[] = [
      { key: "orderNumber", label: "Order Number" },
      { key: "outletName", label: "Outlet" },
      { key: "outletType", label: "Outlet Type" },
      { key: "tableNumber", label: "Table" },
      { key: "serverName", label: "Server" },
      { key: "status", label: "Status" },
      { key: "subtotal", label: "Subtotal" },
      { key: "taxAmount", label: "Tax" },
      { key: "serviceCharge", label: "Service Charge" },
      { key: "discountAmount", label: "Discount" },
      { key: "tipAmount", label: "Tip" },
      { key: "total", label: "Total" },
      { key: "itemCount", label: "Items" },
      { key: "paymentMethods", label: "Payment Methods" },
      { key: "createdAt", label: "Created At" },
    ];

    const csv = arrayToCSV(exportData, headers);
    const filename = generateFilename("orders_export", "csv");

    return {
      success: true,
      data: csv,
      filename,
      mimeType: "text/csv;charset=utf-8;",
      rowCount: exportData.length,
    };
  } catch (error) {
    console.error("Export Orders Error:", error);
    return {
      success: false,
      data: "",
      filename: "",
      mimeType: "",
      rowCount: 0,
      error: "Failed to export orders",
    };
  }
}

/**
 * Export order details (with line items) to CSV
 * Requirements: 17.3
 */
export async function exportOrderDetails(
  propertyId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ExportResult> {
  try {
    const whereClause: {
      outlet: { propertyId: string };
      createdAt?: { gte?: Date; lte?: Date };
    } = {
      outlet: { propertyId },
    };

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    const orders = await db.pOSOrder.findMany({
      where: whereClause,
      include: {
        outlet: { select: { name: true } },
        table: { select: { number: true } },
        items: {
          include: {
            menuItem: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    interface OrderDetailExportRow {
      orderNumber: string;
      outletName: string;
      tableNumber: string | null;
      orderStatus: string;
      menuItemName: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
      itemStatus: string;
      orderCreatedAt: string;
    }

    const exportData: OrderDetailExportRow[] = [];

    for (const order of orders) {
      for (const item of order.items) {
        const unitPrice = Number(item.unitPrice);
        exportData.push({
          orderNumber: order.orderNumber,
          outletName: order.outlet.name,
          tableNumber: order.table?.number ?? null,
          orderStatus: order.status,
          menuItemName: item.menuItem.name,
          quantity: item.quantity,
          unitPrice,
          lineTotal: item.quantity * unitPrice,
          itemStatus: item.status,
          orderCreatedAt: formatDate(order.createdAt),
        });
      }
    }

    const headers: { key: keyof OrderDetailExportRow; label: string }[] = [
      { key: "orderNumber", label: "Order Number" },
      { key: "outletName", label: "Outlet" },
      { key: "tableNumber", label: "Table" },
      { key: "orderStatus", label: "Order Status" },
      { key: "menuItemName", label: "Menu Item" },
      { key: "quantity", label: "Quantity" },
      { key: "unitPrice", label: "Unit Price" },
      { key: "lineTotal", label: "Line Total" },
      { key: "itemStatus", label: "Item Status" },
      { key: "orderCreatedAt", label: "Order Date" },
    ];

    const csv = arrayToCSV(exportData, headers);
    const filename = generateFilename("order_details_export", "csv");

    return {
      success: true,
      data: csv,
      filename,
      mimeType: "text/csv;charset=utf-8;",
      rowCount: exportData.length,
    };
  } catch (error) {
    console.error("Export Order Details Error:", error);
    return {
      success: false,
      data: "",
      filename: "",
      mimeType: "",
      rowCount: 0,
      error: "Failed to export order details",
    };
  }
}

/**
 * Export purchase orders to CSV
 * Requirements: 17.3
 */
export async function exportPurchaseOrders(
  propertyId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ExportResult> {
  try {
    const whereClause: {
      propertyId: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = {
      propertyId,
    };

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    const purchaseOrders = await db.purchaseOrder.findMany({
      where: whereClause,
      include: {
        supplier: { select: { name: true } },
        warehouse: { select: { name: true } },
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
        items: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    interface POExportRow {
      poNumber: string;
      supplierName: string;
      warehouseName: string;
      status: string;
      subtotal: number;
      taxAmount: number;
      total: number;
      itemCount: number;
      expectedDate: string | null;
      createdBy: string | null;
      approvedBy: string | null;
      approvedAt: string | null;
      createdAt: string;
    }

    const exportData: POExportRow[] = purchaseOrders.map((po) => ({
      poNumber: po.poNumber,
      supplierName: po.supplier.name,
      warehouseName: po.warehouse.name,
      status: po.status,
      subtotal: Number(po.subtotal),
      taxAmount: Number(po.taxAmount),
      total: Number(po.total),
      itemCount: po.items.length,
      expectedDate: po.expectedDate ? formatDate(po.expectedDate) : null,
      createdBy: po.createdBy?.name ?? null,
      approvedBy: po.approvedBy?.name ?? null,
      approvedAt: po.approvedAt ? formatDate(po.approvedAt) : null,
      createdAt: formatDate(po.createdAt),
    }));

    const headers: { key: keyof POExportRow; label: string }[] = [
      { key: "poNumber", label: "PO Number" },
      { key: "supplierName", label: "Supplier" },
      { key: "warehouseName", label: "Warehouse" },
      { key: "status", label: "Status" },
      { key: "subtotal", label: "Subtotal" },
      { key: "taxAmount", label: "Tax" },
      { key: "total", label: "Total" },
      { key: "itemCount", label: "Items" },
      { key: "expectedDate", label: "Expected Date" },
      { key: "createdBy", label: "Created By" },
      { key: "approvedBy", label: "Approved By" },
      { key: "approvedAt", label: "Approved At" },
      { key: "createdAt", label: "Created At" },
    ];

    const csv = arrayToCSV(exportData, headers);
    const filename = generateFilename("purchase_orders_export", "csv");

    return {
      success: true,
      data: csv,
      filename,
      mimeType: "text/csv;charset=utf-8;",
      rowCount: exportData.length,
    };
  } catch (error) {
    console.error("Export Purchase Orders Error:", error);
    return {
      success: false,
      data: "",
      filename: "",
      mimeType: "",
      rowCount: 0,
      error: "Failed to export purchase orders",
    };
  }
}

/**
 * Export suppliers to CSV
 * Requirements: 17.3
 */
export async function exportSuppliers(): Promise<ExportResult> {
  try {
    const suppliers = await db.supplier.findMany({
      orderBy: { name: "asc" },
    });

    interface SupplierExportRow {
      name: string;
      contactName: string | null;
      email: string | null;
      phone: string | null;
      address: string | null;
      isActive: boolean;
      createdAt: string;
    }

    const exportData: SupplierExportRow[] = suppliers.map((supplier) => ({
      name: supplier.name,
      contactName: supplier.contactName,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      isActive: supplier.isActive,
      createdAt: formatDate(supplier.createdAt),
    }));

    const headers: { key: keyof SupplierExportRow; label: string }[] = [
      { key: "name", label: "Name" },
      { key: "contactName", label: "Contact Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "address", label: "Address" },
      { key: "isActive", label: "Active" },
      { key: "createdAt", label: "Created At" },
    ];

    const csv = arrayToCSV(exportData, headers);
    const filename = generateFilename("suppliers_export", "csv");

    return {
      success: true,
      data: csv,
      filename,
      mimeType: "text/csv;charset=utf-8;",
      rowCount: exportData.length,
    };
  } catch (error) {
    console.error("Export Suppliers Error:", error);
    return {
      success: false,
      data: "",
      filename: "",
      mimeType: "",
      rowCount: 0,
      error: "Failed to export suppliers",
    };
  }
}

/**
 * Export waste records to CSV
 * Requirements: 17.3
 */
export async function exportWasteRecords(
  propertyId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ExportResult> {
  try {
    const whereClause: {
      warehouse: { propertyId: string };
      createdAt?: { gte?: Date; lte?: Date };
    } = {
      warehouse: { propertyId },
    };

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    const wasteRecords = await db.wasteRecord.findMany({
      where: whereClause,
      include: {
        stockItem: { select: { itemCode: true, name: true } },
        warehouse: { select: { name: true } },
        batch: { select: { batchNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    interface WasteExportRow {
      itemCode: string;
      itemName: string;
      warehouseName: string;
      batchNumber: string | null;
      wasteType: string;
      quantity: number;
      unitCost: number;
      totalCost: number;
      reason: string | null;
      createdAt: string;
    }

    const exportData: WasteExportRow[] = wasteRecords.map((record) => ({
      itemCode: record.stockItem.itemCode,
      itemName: record.stockItem.name,
      warehouseName: record.warehouse.name,
      batchNumber: record.batch?.batchNumber ?? null,
      wasteType: record.wasteType,
      quantity: Number(record.quantity),
      unitCost: Number(record.unitCost),
      totalCost: Number(record.totalCost),
      reason: record.reason,
      createdAt: formatDate(record.createdAt),
    }));

    const headers: { key: keyof WasteExportRow; label: string }[] = [
      { key: "itemCode", label: "Item Code" },
      { key: "itemName", label: "Item Name" },
      { key: "warehouseName", label: "Warehouse" },
      { key: "batchNumber", label: "Batch Number" },
      { key: "wasteType", label: "Waste Type" },
      { key: "quantity", label: "Quantity" },
      { key: "unitCost", label: "Unit Cost" },
      { key: "totalCost", label: "Total Cost" },
      { key: "reason", label: "Reason" },
      { key: "createdAt", label: "Created At" },
    ];

    const csv = arrayToCSV(exportData, headers);
    const filename = generateFilename("waste_records_export", "csv");

    return {
      success: true,
      data: csv,
      filename,
      mimeType: "text/csv;charset=utf-8;",
      rowCount: exportData.length,
    };
  } catch (error) {
    console.error("Export Waste Records Error:", error);
    return {
      success: false,
      data: "",
      filename: "",
      mimeType: "",
      rowCount: 0,
      error: "Failed to export waste records",
    };
  }
}
