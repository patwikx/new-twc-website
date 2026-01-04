// Error class for inventory operations
export class InventoryError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "InventoryError";
  }
}

// Error codes
export const InventoryErrorCode = {
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
  WAREHOUSE_NOT_FOUND: "WAREHOUSE_NOT_FOUND",
  STOCK_ITEM_NOT_FOUND: "STOCK_ITEM_NOT_FOUND",
  INVALID_TRANSFER: "INVALID_TRANSFER",
  REQUISITION_NOT_FOUND: "REQUISITION_NOT_FOUND",
  REQUISITION_ALREADY_PROCESSED: "REQUISITION_ALREADY_PROCESSED",
  RECIPE_NOT_FOUND: "RECIPE_NOT_FOUND",
  CIRCULAR_RECIPE_DEPENDENCY: "CIRCULAR_RECIPE_DEPENDENCY",
  UNIT_CONVERSION_ERROR: "UNIT_CONVERSION_ERROR",
  CONSIGNMENT_SETTLEMENT_ERROR: "CONSIGNMENT_SETTLEMENT_ERROR",
} as const;

export type InventoryErrorCodeType = typeof InventoryErrorCode[keyof typeof InventoryErrorCode];
