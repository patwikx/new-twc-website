/**
 * Pure utility functions for order operations
 * These are used for property-based testing and don't require server actions
 */

import Decimal from "decimal.js";
import { POSOrderStatus, OrderItemStatus } from "@prisma/client";

// Types
export interface OrderTotals {
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  discountAmount: number;
  tipAmount: number;
  total: number;
}

/**
 * Pure function to determine if an order should be associated with a shift
 * Property 19: Shift Order Association
 * 
 * For any order created while a cashier has an open shift, the order SHALL be associated with that shift.
 * 
 * @param hasOpenShift - Whether the cashier has an open shift
 * @param shiftId - The ID of the open shift (if any)
 * @returns The shift ID to associate with the order, or null
 */
export function determineOrderShiftAssociation(
  hasOpenShift: boolean,
  shiftId: string | null
): string | null {
  if (hasOpenShift && shiftId) {
    return shiftId;
  }
  return null;
}

/**
 * Pure function to verify order-shift association
 * Property 19: Shift Order Association
 * 
 * @param orderShiftId - The shift ID associated with the order
 * @param cashierOpenShiftId - The cashier's open shift ID at order creation time
 * @param cashierHadOpenShift - Whether the cashier had an open shift at order creation time
 * @returns True if the association is correct
 */
export function verifyOrderShiftAssociation(
  orderShiftId: string | null,
  cashierOpenShiftId: string | null,
  cashierHadOpenShift: boolean
): boolean {
  // If cashier had an open shift, order must be associated with it
  if (cashierHadOpenShift && cashierOpenShiftId) {
    return orderShiftId === cashierOpenShiftId;
  }
  
  // If cashier had no open shift, order should not be associated with any shift
  if (!cashierHadOpenShift) {
    return orderShiftId === null;
  }
  
  return true;
}

/**
 * Pure function to calculate order totals (for property testing)
 * This is a pure function that can be tested without database access
 * 
 * Property 6: Order Total Calculation Consistency
 * total = subtotal + taxAmount + serviceCharge - discountAmount + tipAmount
 * subtotal = sum of (item.quantity × item.unitPrice) for all items
 */
export function calculateOrderTotalsPure(
  items: Array<{ quantity: number; unitPrice: number }>,
  taxRate: number,
  serviceChargeRate: number,
  discountAmount: number,
  tipAmount: number
): OrderTotals {
  // Calculate subtotal from items
  const subtotal = items.reduce((sum, item) => {
    return sum.add(new Decimal(item.unitPrice).mul(item.quantity));
  }, new Decimal(0));

  // Calculate tax and service charge
  const taxAmountDecimal = subtotal.mul(taxRate);
  const serviceChargeDecimal = subtotal.mul(serviceChargeRate);
  const discountDecimal = new Decimal(discountAmount);
  const tipDecimal = new Decimal(tipAmount);

  // Property 6: total = subtotal + taxAmount + serviceCharge - discountAmount + tipAmount
  const total = subtotal
    .add(taxAmountDecimal)
    .add(serviceChargeDecimal)
    .sub(discountDecimal)
    .add(tipDecimal);

  return {
    subtotal: subtotal.toDecimalPlaces(2).toNumber(),
    taxAmount: taxAmountDecimal.toDecimalPlaces(2).toNumber(),
    serviceCharge: serviceChargeDecimal.toDecimalPlaces(2).toNumber(),
    discountAmount: discountDecimal.toDecimalPlaces(2).toNumber(),
    tipAmount: tipDecimal.toDecimalPlaces(2).toNumber(),
    total: total.toDecimalPlaces(2).toNumber(),
  };
}

/**
 * Verify order total calculation consistency
 * This function verifies that the stored totals match the calculated totals
 * 
 * Property 6: Order Total Calculation Consistency
 */
export function verifyOrderTotals(totals: OrderTotals): boolean {
  const { subtotal, taxAmount, serviceCharge, discountAmount, tipAmount, total } = totals;
  
  // Calculate expected total
  const expectedTotal = new Decimal(subtotal)
    .add(taxAmount)
    .add(serviceCharge)
    .sub(discountAmount)
    .add(tipAmount)
    .toDecimalPlaces(2)
    .toNumber();

  // Allow for small floating point differences (0.02 to account for rounding in intermediate calculations)
  return Math.abs(total - expectedTotal) < 0.02;
}

/**
 * Valid order status transitions
 * Requirements: 5.3, 6.5, 7.5
 * 
 * Property 8: Order Status Progression
 * For any order, status transitions SHALL follow valid paths:
 * OPEN → SENT_TO_KITCHEN → IN_PROGRESS → READY → SERVED → PAID
 * with CANCELLED/VOID as terminal states from any non-PAID state.
 */
const VALID_ORDER_STATUS_TRANSITIONS: Record<POSOrderStatus, POSOrderStatus[]> = {
  OPEN: ["SENT_TO_KITCHEN", "CANCELLED", "VOID"],
  SENT_TO_KITCHEN: ["IN_PROGRESS", "CANCELLED", "VOID"],
  IN_PROGRESS: ["READY", "CANCELLED", "VOID"],
  READY: ["SERVED", "CANCELLED", "VOID"],
  SERVED: ["PAID", "CANCELLED", "VOID"],
  PAID: [], // Terminal state - no transitions allowed
  CANCELLED: [], // Terminal state
  VOID: [], // Terminal state
};

/**
 * Valid order item status transitions
 */
const VALID_ITEM_STATUS_TRANSITIONS: Record<OrderItemStatus, OrderItemStatus[]> = {
  PENDING: ["SENT", "CANCELLED"],
  SENT: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED", "CANCELLED"],
  SERVED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

/**
 * Check if an order status transition is valid
 * Requirements: 5.3, 6.5, 7.5
 */
export function isValidOrderStatusTransition(
  currentStatus: POSOrderStatus,
  newStatus: POSOrderStatus
): boolean {
  if (currentStatus === newStatus) {
    return true; // No change is always valid
  }
  return VALID_ORDER_STATUS_TRANSITIONS[currentStatus].includes(newStatus);
}

/**
 * Check if an order item status transition is valid
 */
export function isValidItemStatusTransition(
  currentStatus: OrderItemStatus,
  newStatus: OrderItemStatus
): boolean {
  if (currentStatus === newStatus) {
    return true;
  }
  return VALID_ITEM_STATUS_TRANSITIONS[currentStatus].includes(newStatus);
}
