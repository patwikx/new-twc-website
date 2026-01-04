"use server";

import { logAction } from "./audit-log";
import { createAuditSnapshot, extractChangedFields, AuditAction } from "./audit-utils";

// ============================================================================
// Inventory Audit Logging Helpers
// ============================================================================

/**
 * Log a stock movement operation
 * Requirements: 12.1
 */
export async function logStockMovement(params: {
  userId: string;
  action: AuditAction;
  movementId: string;
  movementData: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  return logAction({
    userId: params.userId,
    action: params.action,
    entityType: "StockMovement",
    entityId: params.movementId,
    newValues: createAuditSnapshot(params.movementData),
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Log a stock adjustment operation
 * Requirements: 12.1
 */
export async function logStockAdjustment(params: {
  userId: string;
  adjustmentId: string;
  stockItemId: string;
  warehouseId: string;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  return logAction({
    userId: params.userId,
    action: "ADJUST",
    entityType: "StockAdjustment",
    entityId: params.adjustmentId,
    oldValues: {
      stockItemId: params.stockItemId,
      warehouseId: params.warehouseId,
      quantity: params.previousQuantity,
    },
    newValues: {
      stockItemId: params.stockItemId,
      warehouseId: params.warehouseId,
      quantity: params.newQuantity,
      reason: params.reason,
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Log a waste record creation
 * Requirements: 12.1
 */
export async function logWasteRecord(params: {
  userId: string;
  wasteRecordId: string;
  wasteData: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  return logAction({
    userId: params.userId,
    action: "WASTE",
    entityType: "WasteRecord",
    entityId: params.wasteRecordId,
    newValues: createAuditSnapshot(params.wasteData),
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Log a purchase order creation
 * Requirements: 12.1
 */
export async function logPurchaseOrderCreate(params: {
  userId: string;
  purchaseOrderId: string;
  poData: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  return logAction({
    userId: params.userId,
    action: "CREATE",
    entityType: "PurchaseOrder",
    entityId: params.purchaseOrderId,
    newValues: createAuditSnapshot(params.poData),
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Log a purchase order update
 * Requirements: 12.1, 12.2
 */
export async function logPurchaseOrderUpdate(params: {
  userId: string;
  purchaseOrderId: string;
  oldData: Record<string, unknown>;
  newData: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  const { oldValues, newValues } = extractChangedFields(
    createAuditSnapshot(params.oldData),
    createAuditSnapshot(params.newData)
  );

  // Only log if there are actual changes
  if (Object.keys(oldValues).length === 0 && Object.keys(newValues).length === 0) {
    return { success: true, data: null };
  }

  return logAction({
    userId: params.userId,
    action: "UPDATE",
    entityType: "PurchaseOrder",
    entityId: params.purchaseOrderId,
    oldValues,
    newValues,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Log a purchase order status change (approval, rejection, etc.)
 * Requirements: 12.1
 */
export async function logPurchaseOrderStatusChange(params: {
  userId: string;
  purchaseOrderId: string;
  action: "APPROVE" | "REJECT" | "CANCEL" | "RECEIVE";
  oldStatus: string;
  newStatus: string;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  return logAction({
    userId: params.userId,
    action: params.action,
    entityType: "PurchaseOrder",
    entityId: params.purchaseOrderId,
    oldValues: { status: params.oldStatus },
    newValues: { 
      status: params.newStatus,
      ...(params.reason && { reason: params.reason }),
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Log a PO receipt
 * Requirements: 12.1
 */
export async function logPOReceipt(params: {
  userId: string;
  receiptId: string;
  purchaseOrderId: string;
  receiptData: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  return logAction({
    userId: params.userId,
    action: "RECEIVE",
    entityType: "POReceipt",
    entityId: params.receiptId,
    newValues: {
      ...createAuditSnapshot(params.receiptData),
      purchaseOrderId: params.purchaseOrderId,
    },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Log a stock item creation
 * Requirements: 12.1
 */
export async function logStockItemCreate(params: {
  userId: string;
  stockItemId: string;
  itemData: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  return logAction({
    userId: params.userId,
    action: "CREATE",
    entityType: "StockItem",
    entityId: params.stockItemId,
    newValues: createAuditSnapshot(params.itemData),
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Log a stock item update
 * Requirements: 12.1, 12.2
 */
export async function logStockItemUpdate(params: {
  userId: string;
  stockItemId: string;
  oldData: Record<string, unknown>;
  newData: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  const { oldValues, newValues } = extractChangedFields(
    createAuditSnapshot(params.oldData),
    createAuditSnapshot(params.newData)
  );

  // Only log if there are actual changes
  if (Object.keys(oldValues).length === 0 && Object.keys(newValues).length === 0) {
    return { success: true, data: null };
  }

  return logAction({
    userId: params.userId,
    action: "UPDATE",
    entityType: "StockItem",
    entityId: params.stockItemId,
    oldValues,
    newValues,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Log a stock item deletion
 * Requirements: 12.1
 */
export async function logStockItemDelete(params: {
  userId: string;
  stockItemId: string;
  itemData: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  return logAction({
    userId: params.userId,
    action: "DELETE",
    entityType: "StockItem",
    entityId: params.stockItemId,
    oldValues: createAuditSnapshot(params.itemData),
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Log a warehouse operation
 * Requirements: 12.1
 */
export async function logWarehouseOperation(params: {
  userId: string;
  action: AuditAction;
  warehouseId: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  let oldValues: Record<string, unknown> | undefined;
  let newValues: Record<string, unknown> | undefined;

  if (params.action === "CREATE" && params.newData) {
    newValues = createAuditSnapshot(params.newData);
  } else if (params.action === "DELETE" && params.oldData) {
    oldValues = createAuditSnapshot(params.oldData);
  } else if (params.action === "UPDATE" && params.oldData && params.newData) {
    const changes = extractChangedFields(
      createAuditSnapshot(params.oldData),
      createAuditSnapshot(params.newData)
    );
    oldValues = changes.oldValues;
    newValues = changes.newValues;
  }

  return logAction({
    userId: params.userId,
    action: params.action,
    entityType: "Warehouse",
    entityId: params.warehouseId,
    oldValues,
    newValues,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Log a supplier operation
 * Requirements: 12.1
 */
export async function logSupplierOperation(params: {
  userId: string;
  action: AuditAction;
  supplierId: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  let oldValues: Record<string, unknown> | undefined;
  let newValues: Record<string, unknown> | undefined;

  if (params.action === "CREATE" && params.newData) {
    newValues = createAuditSnapshot(params.newData);
  } else if (params.action === "DELETE" && params.oldData) {
    oldValues = createAuditSnapshot(params.oldData);
  } else if (params.action === "UPDATE" && params.oldData && params.newData) {
    const changes = extractChangedFields(
      createAuditSnapshot(params.oldData),
      createAuditSnapshot(params.newData)
    );
    oldValues = changes.oldValues;
    newValues = changes.newValues;
  }

  return logAction({
    userId: params.userId,
    action: params.action,
    entityType: "Supplier",
    entityId: params.supplierId,
    oldValues,
    newValues,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Log a stock category operation
 * Requirements: 12.1
 */
export async function logStockCategoryOperation(params: {
  userId: string;
  action: AuditAction;
  categoryId: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  let oldValues: Record<string, unknown> | undefined;
  let newValues: Record<string, unknown> | undefined;

  if (params.action === "CREATE" && params.newData) {
    newValues = createAuditSnapshot(params.newData);
  } else if (params.action === "DELETE" && params.oldData) {
    oldValues = createAuditSnapshot(params.oldData);
  } else if (params.action === "UPDATE" && params.oldData && params.newData) {
    const changes = extractChangedFields(
      createAuditSnapshot(params.oldData),
      createAuditSnapshot(params.newData)
    );
    oldValues = changes.oldValues;
    newValues = changes.newValues;
  }

  return logAction({
    userId: params.userId,
    action: params.action,
    entityType: "StockCategory",
    entityId: params.categoryId,
    oldValues,
    newValues,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Log a requisition operation
 * Requirements: 12.1
 */
export async function logRequisitionOperation(params: {
  userId: string;
  action: AuditAction;
  requisitionId: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  let oldValues: Record<string, unknown> | undefined;
  let newValues: Record<string, unknown> | undefined;

  if (params.action === "CREATE" && params.newData) {
    newValues = createAuditSnapshot(params.newData);
  } else if (params.action === "UPDATE" && params.oldData && params.newData) {
    const changes = extractChangedFields(
      createAuditSnapshot(params.oldData),
      createAuditSnapshot(params.newData)
    );
    oldValues = changes.oldValues;
    newValues = changes.newValues;
  } else if (params.action === "APPROVE" || params.action === "REJECT") {
    if (params.oldData) oldValues = createAuditSnapshot(params.oldData);
    if (params.newData) newValues = createAuditSnapshot(params.newData);
  }

  return logAction({
    userId: params.userId,
    action: params.action,
    entityType: "Requisition",
    entityId: params.requisitionId,
    oldValues,
    newValues,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

/**
 * Log a cycle count operation
 * Requirements: 12.1
 */
export async function logCycleCountOperation(params: {
  userId: string;
  action: AuditAction;
  cycleCountId: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  let oldValues: Record<string, unknown> | undefined;
  let newValues: Record<string, unknown> | undefined;

  if (params.action === "CREATE" && params.newData) {
    newValues = createAuditSnapshot(params.newData);
  } else if (params.action === "UPDATE" && params.oldData && params.newData) {
    const changes = extractChangedFields(
      createAuditSnapshot(params.oldData),
      createAuditSnapshot(params.newData)
    );
    oldValues = changes.oldValues;
    newValues = changes.newValues;
  }

  return logAction({
    userId: params.userId,
    action: params.action,
    entityType: "CycleCount",
    entityId: params.cycleCountId,
    oldValues,
    newValues,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}

// ============================================================================
// Note: Core audit functions (logAction, getAuditLogs, etc.) should be imported
// directly from "./audit-log" or from the main "./index" module.
// This file only exports inventory-specific audit helpers.
// ============================================================================
