/**
 * Guest Booking Cancellation Service
 * 
 * Handles cancellation policy checks and fee calculations for guest bookings.
 * Supports both logged-in users and guests with verification tokens.
 * 
 * Requirements:
 * - 10.2: Check cancellation policy
 * - 10.3: Free cancellation window → full refund
 * - 10.4: Outside free window → apply cancellation fee
 * - 10.6: Checked-in bookings cannot be cancelled
 */

import type { BookingStatus } from "@prisma/client";

/**
 * Cancellation policy configuration
 */
export interface CancellationPolicy {
  /** Hours before check-in for free cancellation */
  freeCancellationHours: number;
  /** Percentage fee applied outside free window (0-100) */
  cancellationFeePercent: number;
}

/**
 * Default cancellation policy
 * - Free cancellation up to 48 hours before check-in
 * - 50% fee if cancelled within 48 hours
 */
export const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = {
  freeCancellationHours: 48,
  cancellationFeePercent: 50,
};

/**
 * Result of cancellation fee calculation
 */
export interface CancellationFeeResult {
  /** Amount to refund to guest */
  refundAmount: number;
  /** Cancellation fee charged */
  fee: number;
  /** Whether cancellation is within free window */
  isFreeCancellation: boolean;
  /** Hours until check-in at time of cancellation */
  hoursUntilCheckIn: number;
}

/**
 * Result of checking if booking can be cancelled
 */
export interface CanCancelResult {
  /** Whether the booking can be cancelled */
  canCancel: boolean;
  /** Reason if cancellation is not allowed */
  reason?: string;
}

/**
 * Check if a booking can be cancelled based on its status.
 * 
 * A booking cannot be cancelled if:
 * - Status is CANCELLED (already cancelled)
 * - Status is COMPLETED (checked out)
 * 
 * Note: CONFIRMED bookings that have been checked in should have
 * status changed to COMPLETED, but we also check for explicit
 * check-in state if provided.
 * 
 * @param status - Current booking status
 * @param isCheckedIn - Optional flag indicating if guest has checked in
 * @returns CanCancelResult with canCancel flag and reason if not allowed
 */
export function canCancelBooking(
  status: BookingStatus,
  isCheckedIn: boolean = false
): CanCancelResult {
  // Check if already cancelled
  if (status === "CANCELLED") {
    return {
      canCancel: false,
      reason: "This booking has already been cancelled",
    };
  }

  // Check if completed (checked out)
  if (status === "COMPLETED") {
    return {
      canCancel: false,
      reason: "Cannot cancel a booking that has already been completed",
    };
  }

  // Check if checked in (explicit flag)
  // Requirement 10.6: Checked-in bookings cannot be cancelled
  if (isCheckedIn) {
    return {
      canCancel: false,
      reason: "Cannot cancel a booking that has already been checked in",
    };
  }

  // PENDING and CONFIRMED bookings can be cancelled
  return {
    canCancel: true,
  };
}

/**
 * Calculate hours between two dates.
 * Pure function for testing.
 * 
 * @param from - Start date
 * @param to - End date
 * @returns Number of hours (can be negative if from > to)
 */
export function calculateHoursBetween(from: Date, to: Date): number {
  const diffMs = to.getTime() - from.getTime();
  return diffMs / (1000 * 60 * 60);
}

/**
 * Check if cancellation is within the free cancellation window.
 * 
 * @param hoursUntilCheckIn - Hours until check-in
 * @param freeCancellationHours - Policy's free cancellation window in hours
 * @returns true if within free cancellation window
 */
export function isWithinFreeCancellationWindow(
  hoursUntilCheckIn: number,
  freeCancellationHours: number
): boolean {
  return hoursUntilCheckIn >= freeCancellationHours;
}

/**
 * Calculate the cancellation fee and refund amount based on policy.
 * 
 * Requirements:
 * - 10.3: If (checkIn - cancellation) >= freeCancellationHours, refund = 100%
 * - 10.4: If (checkIn - cancellation) < freeCancellationHours, refund = (100 - feePercent)%
 * 
 * @param bookingAmount - Total booking amount
 * @param checkInDate - Scheduled check-in date
 * @param cancellationDate - Date of cancellation request
 * @param policy - Cancellation policy to apply
 * @returns CancellationFeeResult with refund amount and fee
 */
export function calculateCancellationFee(
  bookingAmount: number,
  checkInDate: Date,
  cancellationDate: Date,
  policy: CancellationPolicy = DEFAULT_CANCELLATION_POLICY
): CancellationFeeResult {
  // Calculate hours until check-in
  const hoursUntilCheckIn = calculateHoursBetween(cancellationDate, checkInDate);
  
  // Check if within free cancellation window
  const isFreeCancellation = isWithinFreeCancellationWindow(
    hoursUntilCheckIn,
    policy.freeCancellationHours
  );

  if (isFreeCancellation) {
    // Full refund within free cancellation window
    return {
      refundAmount: bookingAmount,
      fee: 0,
      isFreeCancellation: true,
      hoursUntilCheckIn,
    };
  }

  // Apply cancellation fee
  const feeAmount = (bookingAmount * policy.cancellationFeePercent) / 100;
  const refundAmount = bookingAmount - feeAmount;

  return {
    refundAmount: Math.max(0, refundAmount),
    fee: feeAmount,
    isFreeCancellation: false,
    hoursUntilCheckIn,
  };
}

/**
 * Get a human-readable description of the cancellation policy.
 * 
 * @param policy - Cancellation policy
 * @returns Human-readable policy description
 */
export function getCancellationPolicyDescription(
  policy: CancellationPolicy = DEFAULT_CANCELLATION_POLICY
): string {
  return `Free cancellation up to ${policy.freeCancellationHours} hours before check-in. ` +
    `Cancellations within ${policy.freeCancellationHours} hours of check-in will incur a ` +
    `${policy.cancellationFeePercent}% cancellation fee.`;
}
