/**
 * Room Availability Service
 * 
 * Provides room availability checking to prevent double-bookings.
 * Uses date range overlap detection and only considers active bookings
 * (CONFIRMED or PENDING status).
 */

import { db } from "@/lib/db";

export interface AvailabilityCheck {
  roomId: string;
  checkIn: Date;
  checkOut: Date;
}

export interface AvailabilityResult {
  available: boolean;
  conflictingBookings?: string[]; // Booking IDs if not available
}

/**
 * Check if rooms are available for the given date ranges.
 * 
 * Date overlap detection uses the formula:
 * checkIn < existingCheckOut AND checkOut > existingCheckIn
 * 
 * Only considers bookings with status CONFIRMED or PENDING (not CANCELLED).
 * 
 * @param checks - Array of room availability checks
 * @returns Map of roomId to availability result
 */
export async function checkRoomAvailability(
  checks: AvailabilityCheck[]
): Promise<Map<string, AvailabilityResult>> {
  const results = new Map<string, AvailabilityResult>();
  
  if (checks.length === 0) {
    return results;
  }

  // Get unique room IDs
  const roomIds = [...new Set(checks.map(c => c.roomId))];

  // Find all potentially conflicting booking items
  // We need to check each room's bookings against the requested dates
  for (const check of checks) {
    const conflictingItems = await db.bookingItem.findMany({
      where: {
        roomId: check.roomId,
        booking: {
          status: {
            in: ['CONFIRMED', 'PENDING']
          }
        },
        // Date overlap: checkIn < existingCheckOut AND checkOut > existingCheckIn
        AND: [
          {
            checkIn: {
              lt: check.checkOut
            }
          },
          {
            checkOut: {
              gt: check.checkIn
            }
          }
        ]
      },
      select: {
        bookingId: true
      }
    });

    const conflictingBookingIds = [...new Set(conflictingItems.map(item => item.bookingId))];

    results.set(check.roomId, {
      available: conflictingBookingIds.length === 0,
      conflictingBookings: conflictingBookingIds.length > 0 ? conflictingBookingIds : undefined
    });
  }

  return results;
}

/**
 * Check availability for a single room.
 * Convenience wrapper around checkRoomAvailability.
 * 
 * @param roomId - The room ID to check
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns Availability result for the room
 */
export async function isRoomAvailable(
  roomId: string,
  checkIn: Date,
  checkOut: Date
): Promise<AvailabilityResult> {
  const results = await checkRoomAvailability([{ roomId, checkIn, checkOut }]);
  return results.get(roomId) || { available: true };
}

/**
 * Check if dates overlap using the standard overlap formula.
 * Pure function for testing purposes.
 * 
 * Two date ranges overlap if:
 * range1Start < range2End AND range1End > range2Start
 * 
 * @param start1 - Start of first range
 * @param end1 - End of first range
 * @param start2 - Start of second range
 * @param end2 - End of second range
 * @returns true if the ranges overlap
 */
export function datesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && end1 > start2;
}
