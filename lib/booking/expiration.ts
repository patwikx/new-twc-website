/**
 * Automatic Booking Expiration Service
 * 
 * Handles cleanup of stale bookings that were never paid.
 * Runs periodically to expire PENDING/UNPAID bookings older than 30 minutes.
 */

import { db } from "@/lib/db";

// Expiration threshold in milliseconds (30 minutes)
const EXPIRATION_THRESHOLD_MS = 30 * 60 * 1000;

export interface ExpirationResult {
  expiredCount: number;
  bookingIds: string[];
}

/**
 * Calculate the cutoff time for booking expiration
 * 
 * @param now - Current timestamp (for testing)
 * @param thresholdMs - Expiration threshold in milliseconds
 * @returns Date representing the cutoff time
 */
export function calculateExpirationCutoff(
  now: Date = new Date(),
  thresholdMs: number = EXPIRATION_THRESHOLD_MS
): Date {
  return new Date(now.getTime() - thresholdMs);
}

/**
 * Check if a booking is eligible for expiration
 * 
 * A booking is eligible if:
 * - Status is PENDING
 * - Payment status is UNPAID (NOT PARTIALLY_PAID)
 * - Created more than 30 minutes ago
 * 
 * @param booking - Booking to check
 * @param cutoffTime - Cutoff time for expiration
 * @returns true if booking should be expired
 */
export function isEligibleForExpiration(
  booking: {
    status: string;
    paymentStatus: string;
    createdAt: Date;
  },
  cutoffTime: Date
): boolean {
  // Only expire PENDING bookings
  if (booking.status !== "PENDING") {
    return false;
  }
  
  // Never expire PARTIALLY_PAID bookings
  if (booking.paymentStatus === "PARTIALLY_PAID") {
    return false;
  }
  
  // Only expire UNPAID bookings
  if (booking.paymentStatus !== "UNPAID") {
    return false;
  }
  
  // Check if booking is older than cutoff
  return booking.createdAt < cutoffTime;
}

/**
 * Expire stale bookings that were never paid
 * 
 * Finds all PENDING/UNPAID bookings older than 30 minutes and marks them
 * as CANCELLED with EXPIRED payment status.
 * 
 * @returns ExpirationResult with count and IDs of expired bookings
 */
export async function expireStaleBookings(): Promise<ExpirationResult> {
  const cutoffTime = calculateExpirationCutoff();
  
  // Find eligible bookings
  const staleBookings = await db.booking.findMany({
    where: {
      status: "PENDING",
      paymentStatus: "UNPAID",
      createdAt: {
        lt: cutoffTime
      },
      deletedAt: null
    },
    select: {
      id: true,
      shortRef: true,
      guestEmail: true,
      createdAt: true
    }
  });

  if (staleBookings.length === 0) {
    return {
      expiredCount: 0,
      bookingIds: []
    };
  }

  const bookingIds = staleBookings.map(b => b.id);

  // Update all eligible bookings in a single transaction
  await db.booking.updateMany({
    where: {
      id: {
        in: bookingIds
      }
    },
    data: {
      status: "CANCELLED",
      paymentStatus: "EXPIRED",
      updatedAt: new Date()
    }
  });

  // Log expiration events
  for (const booking of staleBookings) {
    console.log("Booking expired", {
      bookingId: booking.id,
      shortRef: booking.shortRef,
      guestEmail: booking.guestEmail,
      createdAt: booking.createdAt,
      expiredAt: new Date().toISOString()
    });
  }

  return {
    expiredCount: bookingIds.length,
    bookingIds
  };
}

/**
 * Pure function version for testing
 * Filters a list of bookings to find those eligible for expiration
 * 
 * @param bookings - Array of bookings to check
 * @param cutoffTime - Cutoff time for expiration
 * @returns Array of booking IDs that should be expired
 */
export function filterEligibleBookings(
  bookings: Array<{
    id: string;
    status: string;
    paymentStatus: string;
    createdAt: Date;
  }>,
  cutoffTime: Date
): string[] {
  return bookings
    .filter(booking => isEligibleForExpiration(booking, cutoffTime))
    .map(booking => booking.id);
}
