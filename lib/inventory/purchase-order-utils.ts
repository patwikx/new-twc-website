/**
 * Pure utility functions for purchase order operations
 * These are used for property-based testing and don't require server actions
 */

import { POStatus } from "@prisma/client";
import Decimal from "decimal.js";

// Valid PO status transitions
const VALID_STATUS_TRANSITIONS: Record<POStatus, POStatus[]> = {
  DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "DRAFT", "CANCELLED"],
  APPROVED: ["SENT", "CANCELLED"],
  SENT: ["PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"],
  PARTIALLY_RECEIVED: ["PARTIALLY_RECEIVED", "RECEIVED"],
  RECEIVED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

/**
 * Check if a status transition is valid
 * Property 13: PO Status Workflow Integrity
 */
export function isValidStatusTransition(
  currentStatus: POStatus,
  newStatus: POStatus
): boolean {
  return VALID_STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

/**
 * Pure function to generate PO number for testing
 * Property 12: Purchase Order Number Uniqueness
 */
export function generatePONumberPure(
  existingNumbers: string[],
  date: Date = new Date()
): string {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `PO-${dateStr}-`;

  // Find the highest sequence for this date
  const todayNumbers = existingNumbers.filter((n) => n.startsWith(prefix));
  let sequence = 1;

  if (todayNumbers.length > 0) {
    // Extract sequence numbers - handle both 4-digit and overflow cases
    const sequences = todayNumbers.map((n) => {
      const parts = n.split("-");
      return parseInt(parts[2], 10);
    });
    sequence = Math.max(...sequences) + 1;
  }

  // Cap sequence at 9999 to maintain 4-digit format
  // In practice, having more than 9999 POs in a single day is extremely rare
  if (sequence > 9999) {
    throw new Error(`PO sequence overflow: cannot generate more than 9999 POs per day. Current sequence would be ${sequence}`);
  }

  return `${prefix}${sequence.toString().padStart(4, "0")}`;
}

/**
 * Pure function to validate PO status transition
 * Property 13: PO Status Workflow Integrity
 */
export function validateStatusTransitionPure(
  currentStatus: POStatus,
  newStatus: POStatus
): { valid: boolean; error?: string } {
  if (isValidStatusTransition(currentStatus, newStatus)) {
    return { valid: true };
  }
  return {
    valid: false,
    error: `Invalid transition from ${currentStatus} to ${newStatus}`,
  };
}

/**
 * Pure function to calculate PO totals
 */
export function calculatePOTotalsPure(
  items: Array<{ quantity: number; unitCost: number }>
): { subtotal: number; total: number } {
  const subtotal = items.reduce((sum, item) => {
    return sum.add(new Decimal(item.quantity).mul(item.unitCost));
  }, new Decimal(0));

  return {
    subtotal: subtotal.toDecimalPlaces(2).toNumber(),
    total: subtotal.toDecimalPlaces(2).toNumber(),
  };
}

/**
 * Pure function to check if receiving would exceed ordered quantity
 * Property 14: PO Receiving Quantity Consistency
 */
export function validateReceivingQuantityPure(
  orderedQty: number,
  alreadyReceivedQty: number,
  newReceiveQty: number
): { valid: boolean; error?: string } {
  const ordered = new Decimal(orderedQty);
  const alreadyReceived = new Decimal(alreadyReceivedQty);
  const newReceive = new Decimal(newReceiveQty);
  const totalReceived = alreadyReceived.add(newReceive);

  if (totalReceived.greaterThan(ordered)) {
    return {
      valid: false,
      error: `Total received (${totalReceived.toNumber()}) would exceed ordered quantity (${ordered.toNumber()})`,
    };
  }

  return { valid: true };
}

/**
 * Pure function to determine PO status after receiving
 * Property 13: PO Status Workflow Integrity
 */
export function determinePOStatusAfterReceivingPure(
  items: Array<{ orderedQty: number; receivedQty: number }>
): POStatus {
  const isFullyReceived = items.every((item) => {
    const ordered = new Decimal(item.orderedQty);
    const received = new Decimal(item.receivedQty);
    return received.greaterThanOrEqualTo(ordered);
  });

  const isPartiallyReceived = items.some((item) => {
    const received = new Decimal(item.receivedQty);
    return received.greaterThan(0);
  });

  if (isFullyReceived) {
    return "RECEIVED";
  } else if (isPartiallyReceived) {
    return "PARTIALLY_RECEIVED";
  }

  return "SENT";
}
