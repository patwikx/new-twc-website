/**
 * Pure utility functions for table operations
 * These are used for property-based testing and don't require server actions
 */

import { POSTableStatus } from "@prisma/client";

/**
 * Valid status transitions based on workflow
 * Requirements: 4.3, 4.4, 4.5
 * 
 * - WHEN an order is created for a table, THE System SHALL automatically set the table status to OCCUPIED
 * - WHEN an order is paid and closed, THE System SHALL set the table status to DIRTY
 * - WHEN a table is marked as cleaned, THE System SHALL set the table status to AVAILABLE
 */
const VALID_STATUS_TRANSITIONS: Record<POSTableStatus, POSTableStatus[]> = {
  AVAILABLE: ["OCCUPIED", "RESERVED", "OUT_OF_SERVICE"],
  OCCUPIED: ["DIRTY", "OUT_OF_SERVICE"], // After order is paid
  RESERVED: ["OCCUPIED", "AVAILABLE", "OUT_OF_SERVICE"],
  DIRTY: ["AVAILABLE", "OUT_OF_SERVICE"], // After cleaning
  OUT_OF_SERVICE: ["AVAILABLE", "DIRTY"],
};

/**
 * Check if a status transition is valid
 * Requirements: 4.3, 4.4, 4.5
 * 
 * Property 5: Table Status Workflow Integrity
 * For any table, status transitions SHALL follow the valid workflow:
 * creating an order sets OCCUPIED, paying sets DIRTY, cleaning sets AVAILABLE.
 */
export function isValidStatusTransition(
  currentStatus: POSTableStatus,
  newStatus: POSTableStatus
): boolean {
  if (currentStatus === newStatus) {
    return true; // No change is always valid
  }
  return VALID_STATUS_TRANSITIONS[currentStatus].includes(newStatus);
}
