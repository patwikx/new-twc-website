/**
 * Audit Trail Module
 * 
 * This module provides audit logging functionality for tracking changes
 * to entities in the system.
 * 
 * Requirements: 12.1, 12.2, 12.3
 */

// Core audit log functions (async server actions)
export {
  logAction,
  getAuditLogs,
  getEntityHistory,
  getUserAuditLogs,
  logBatchActions,
} from "./audit-log";

// Re-export types
export type {
  AuditAction,
  AuditEntityType,
  AuditLogInput,
  AuditLogFilters,
  AuditLogContext,
  AuditLogValidationResult,
} from "./audit-utils";

// Pure validation functions and utilities (for property-based testing)
export {
  validateAuditLogCompletenessPure,
  validateAuditLogValueCapturePure,
  hasValueChangedPure,
  extractChangedFields,
  createAuditSnapshot,
} from "./audit-utils";

// Inventory-specific audit helpers
export {
  logStockMovement,
  logStockAdjustment,
  logWasteRecord,
  logPurchaseOrderCreate,
  logPurchaseOrderUpdate,
  logPurchaseOrderStatusChange,
  logPOReceipt,
  logStockItemCreate,
  logStockItemUpdate,
  logStockItemDelete,
  logWarehouseOperation,
  logSupplierOperation,
  logStockCategoryOperation,
  logRequisitionOperation,
  logCycleCountOperation,
} from "./inventory-audit";
