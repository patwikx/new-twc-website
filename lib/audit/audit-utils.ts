// ============================================================================
// Types
// ============================================================================

/**
 * Supported audit actions
 */
export type AuditAction = 
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "APPROVE"
  | "REJECT"
  | "RECEIVE"
  | "TRANSFER"
  | "ADJUST"
  | "WASTE"
  | "VOID"
  | "CANCEL";

/**
 * Supported entity types for audit logging
 */
export type AuditEntityType =
  | "StockItem"
  | "StockMovement"
  | "StockAdjustment"
  | "WasteRecord"
  | "PurchaseOrder"
  | "PurchaseOrderItem"
  | "POReceipt"
  | "Requisition"
  | "CycleCount"
  | "Warehouse"
  | "Supplier"
  | "StockCategory"
  | "MenuItem"
  | "Recipe"
  | "Order"
  | "OrderPayment"
  | "Shift"
  | "User"
  | "Role";

/**
 * Input for creating an audit log entry
 */
export interface AuditLogInput {
  userId?: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Filters for querying audit logs
 */
export interface AuditLogFilters {
  userId?: string;
  entityType?: AuditEntityType;
  entityId?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

/**
 * Result of audit log validation
 */
export interface AuditLogValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Context for pure validation functions
 */
export interface AuditLogContext {
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}

// ============================================================================
// Pure Validation Functions (for property-based testing)
// ============================================================================

/**
 * Validate that an audit log entry has all required fields
 * 
 * Property 16: Audit Log Completeness
 * For any inventory operation (create, update, delete), an AuditLog record SHALL be created
 * with the correct action, entity type, entity ID, and user ID.
 */
export function validateAuditLogCompletenessPure(
  context: AuditLogContext
): AuditLogValidationResult {
  // Validate action is present and non-empty
  if (!context.action || context.action.trim() === "") {
    return { valid: false, error: "Action is required" };
  }

  // Validate entityType is present and non-empty
  if (!context.entityType || context.entityType.trim() === "") {
    return { valid: false, error: "Entity type is required" };
  }

  // Validate entityId is present and non-empty
  if (!context.entityId || context.entityId.trim() === "") {
    return { valid: false, error: "Entity ID is required" };
  }

  return { valid: true };
}

/**
 * Validate that update operations capture old and new values
 * 
 * Property 17: Audit Log Value Capture
 * For any update operation, the AuditLog SHALL contain the old values before the update
 * and new values after the update.
 */
export function validateAuditLogValueCapturePure(
  context: AuditLogContext
): AuditLogValidationResult {
  // For UPDATE actions, both old and new values should be present
  if (context.action === "UPDATE") {
    if (!context.oldValues || Object.keys(context.oldValues).length === 0) {
      return { valid: false, error: "Old values are required for UPDATE actions" };
    }
    if (!context.newValues || Object.keys(context.newValues).length === 0) {
      return { valid: false, error: "New values are required for UPDATE actions" };
    }
  }

  // For CREATE actions, new values should be present
  if (context.action === "CREATE") {
    if (!context.newValues || Object.keys(context.newValues).length === 0) {
      return { valid: false, error: "New values are required for CREATE actions" };
    }
  }

  // For DELETE actions, old values should be present
  if (context.action === "DELETE") {
    if (!context.oldValues || Object.keys(context.oldValues).length === 0) {
      return { valid: false, error: "Old values are required for DELETE actions" };
    }
  }

  return { valid: true };
}

/**
 * Check if values have actually changed between old and new
 */
export function hasValueChangedPure(
  oldValues: Record<string, unknown> | null | undefined,
  newValues: Record<string, unknown> | null | undefined
): boolean {
  if (!oldValues && !newValues) return false;
  if (!oldValues || !newValues) return true;
  
  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);
  
  for (const key of allKeys) {
    const oldVal = oldValues[key];
    const newVal = newValues[key];
    
    // Handle null/undefined comparison
    if (oldVal === null && newVal === undefined) continue;
    if (oldVal === undefined && newVal === null) continue;
    
    // Deep comparison for objects
    if (typeof oldVal === "object" && typeof newVal === "object") {
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        return true;
      }
    } else if (oldVal !== newVal) {
      return true;
    }
  }
  
  return false;
}

// ============================================================================
// Helper Functions for Integration
// ============================================================================

/**
 * Extract changed fields between old and new objects
 * Useful for creating audit log entries with only changed values
 */
export function extractChangedFields(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>
): { oldValues: Record<string, unknown>; newValues: Record<string, unknown> } {
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    const oldVal = oldObj[key];
    const newVal = newObj[key];

    // Skip if values are the same
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) {
      continue;
    }

    // Record the change
    if (oldVal !== undefined) {
      oldValues[key] = oldVal;
    }
    if (newVal !== undefined) {
      newValues[key] = newVal;
    }
  }

  return { oldValues, newValues };
}

/**
 * Create a snapshot of an object for audit logging
 * Filters out sensitive fields and converts Decimal/Date to serializable formats
 */
export function createAuditSnapshot(
  obj: Record<string, unknown>,
  excludeFields: string[] = ["password", "token", "secret"]
): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip excluded fields
    if (excludeFields.includes(key)) {
      continue;
    }

    // Handle special types
    if (value instanceof Date) {
      snapshot[key] = value.toISOString();
    } else if (typeof value === "object" && value !== null && "toNumber" in value) {
      // Handle Decimal.js objects
      snapshot[key] = (value as { toNumber: () => number }).toNumber();
    } else if (value !== undefined) {
      snapshot[key] = value;
    }
  }

  return snapshot;
}
