/**
 * Room Availability Service
 * 
 * Provides room availability checking to prevent double-bookings.
 * Uses date range overlap detection and only considers active bookings
 * (CONFIRMED or PENDING status).
 * 
 * Supports unit-based availability checking for room types with multiple
 * physical room units.
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

// Unit-based availability interfaces
export interface UnitAvailabilityCheck {
  roomTypeId: string;
  checkIn: Date;
  checkOut: Date;
}

export interface UnitAvailabilityResult {
  roomTypeId: string;
  totalUnits: number;
  bookedUnits: number;
  availableUnits: number;
  available: boolean;
  limitedAvailability: boolean; // true if availableUnits <= 2
}

export interface DateAvailability {
  date: Date;
  availableUnits: number;
  totalUnits: number;
  status: 'available' | 'limited' | 'unavailable';
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

  // Find all potentially conflicting booking items
  // We need to check each room's bookings against the requested dates
  for (const check of checks) {
    const conflictingItems = await db.bookingItem.findMany({
      where: {
        roomId: check.roomId,
        booking: {
          status: {
            in: ['CONFIRMED', 'PENDING', 'CHECKED_IN']
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
 * Determines whether two date ranges overlap.
 *
 * Two ranges overlap when `start1 < end2` and `end1 > start2`.
 *
 * @param start1 - Start of the first range
 * @param end1 - End of the first range
 * @param start2 - Start of the second range
 * @param end2 - End of the second range
 * @returns `true` if the ranges overlap, `false` otherwise
 */
export function datesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && end1 > start2;
}


/**
 * Compute unit-level availability for the specified room types.
 *
 * For each check, derives the total active units for the room type, counts overlapping bookings with status `CONFIRMED` or `PENDING` that intersect the requested date range, and produces booked/available unit counts and availability flags.
 *
 * @param checks - Array of unit availability checks (each includes a roomTypeId, checkIn, and checkOut)
 * @returns A map from `roomTypeId` to `UnitAvailabilityResult` containing `totalUnits`, `bookedUnits`, `availableUnits`, `available`, and `limitedAvailability`
 */
export async function checkUnitAvailability(
  checks: UnitAvailabilityCheck[]
): Promise<UnitAvailabilityResult[]> {
  const results: UnitAvailabilityResult[] = [];
  
  if (checks.length === 0) {
    return results;
  }

  // Get unique room type IDs
  const roomTypeIds = [...new Set(checks.map(c => c.roomTypeId))];

  // Get total active units for each room type
  const unitCounts = await db.roomUnit.groupBy({
    by: ['roomTypeId'],
    where: {
      roomTypeId: { in: roomTypeIds },
      isActive: true,
      deletedAt: null
    },
    _count: {
      id: true
    }
  });

  // Create a map of roomTypeId to total units
  const totalUnitsMap = new Map<string, number>();
  for (const count of unitCounts) {
    totalUnitsMap.set(count.roomTypeId, count._count.id);
  }

  // Process each check
  for (const check of checks) {
    const totalUnits = totalUnitsMap.get(check.roomTypeId) || 0;

    // Count overlapping bookings for this room type and date range
    const overlappingBookings = await db.bookingItem.count({
      where: {
        roomId: check.roomTypeId,
        booking: {
          status: {
            in: ['CONFIRMED', 'PENDING', 'CHECKED_IN']
          }
        },
        // Date overlap: checkIn < requestedCheckOut AND checkOut > requestedCheckIn
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
      }
    });

    const bookedUnits = overlappingBookings;
    const availableUnits = Math.max(0, totalUnits - bookedUnits);
    const available = availableUnits > 0;
    const limitedAvailability = availableUnits > 0 && availableUnits <= 2;

    results.push({
      roomTypeId: check.roomTypeId,
      totalUnits,
      bookedUnits,
      availableUnits,
      available,
      limitedAvailability
    });
  }

  return results;
}

/**
 * Compute available unit count and availability flags from total and booked units.
 *
 * @param totalUnits - Total number of active units for the room type
 * @param bookedUnits - Number of units with overlapping bookings
 * @returns An object containing:
 *  - `availableUnits`: number of units available (zero if total minus booked is negative),
 *  - `available`: `true` if `availableUnits` > 0, `false` otherwise,
 *  - `limitedAvailability`: `true` if `availableUnits` is 1 or 2, `false` otherwise
 */
export function calculateUnitAvailability(
  totalUnits: number,
  bookedUnits: number
): { availableUnits: number; available: boolean; limitedAvailability: boolean } {
  const availableUnits = Math.max(0, totalUnits - bookedUnits);
  const available = availableUnits > 0;
  const limitedAvailability = availableUnits > 0 && availableUnits <= 2;
  
  return { availableUnits, available, limitedAvailability };
}


/**
 * Get daily availability for a date range (for calendar display).
 * 
 * Returns availability status for each day in the range:
 * - 'unavailable': availableUnits = 0
 * - 'limited': availableUnits > 0 AND availableUnits < (totalUnits * 0.5)
 * - 'available': otherwise
 * 
 * @param roomTypeId - The room type to check
 * @param startDate - Start of the date range
 * @param endDate - End of the date range
 * @returns Array of daily availability data
 */
export async function getDateRangeAvailability(
  roomTypeId: string,
  startDate: Date,
  endDate: Date
): Promise<DateAvailability[]> {
  const results: DateAvailability[] = [];
  
  // Get total active units for this room type
  const totalUnits = await db.roomUnit.count({
    where: {
      roomTypeId,
      isActive: true,
      deletedAt: null
    }
  });

  // Get all overlapping bookings for the entire date range
  const overlappingBookings = await db.bookingItem.findMany({
    where: {
      roomId: roomTypeId,
      booking: {
        status: {
          in: ['CONFIRMED', 'PENDING', 'CHECKED_IN']
        }
      },
      AND: [
        { checkIn: { lt: endDate } },
        { checkOut: { gt: startDate } }
      ]
    },
    select: {
      checkIn: true,
      checkOut: true
    }
  });

  // Iterate through each day in the range
  const currentDate = new Date(startDate);
  currentDate.setUTCHours(0, 0, 0, 0);
  
  const endDateTime = new Date(endDate);
  endDateTime.setUTCHours(0, 0, 0, 0);

  while (currentDate < endDateTime) {
    // Count bookings that overlap with this specific day
    // A booking overlaps with a day if: checkIn <= day AND checkOut > day
    const dayStart = new Date(currentDate);
    const dayEnd = new Date(currentDate);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const bookedUnits = overlappingBookings.filter(booking => {
      return booking.checkIn < dayEnd && booking.checkOut > dayStart;
    }).length;

    const availableUnits = Math.max(0, totalUnits - bookedUnits);
    const status = classifyDateAvailability(availableUnits, totalUnits);

    results.push({
      date: new Date(currentDate),
      availableUnits,
      totalUnits,
      status
    });

    // Move to next day
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return results;
}

/**
 * Determine the availability status for a single date based on available and total units.
 *
 * Classification:
 * - `'unavailable'` when `availableUnits` is 0
 * - `'limited'` when `availableUnits` > 0 and less than half of `totalUnits`
 * - `'available'` otherwise
 *
 * @param availableUnits - Number of available units for the date
 * @param totalUnits - Total number of units for the room type
 * @returns The status: `'available'`, `'limited'`, or `'unavailable'`
 */
export function classifyDateAvailability(
  availableUnits: number,
  totalUnits: number
): 'available' | 'limited' | 'unavailable' {
  if (availableUnits <= 0) {
    return 'unavailable';
  }
  
  if (totalUnits > 0 && availableUnits < totalUnits * 0.5) {
    return 'limited';
  }
  
  return 'available';
}

/**
 * Determine whether any day in the provided availability range is marked unavailable.
 *
 * @param availability - Array of daily availability entries to inspect
 * @returns `true` if any day has status `'unavailable'`, `false` otherwise
 */
export function hasUnavailableDates(availability: DateAvailability[]): boolean {
  return availability.some(day => day.status === 'unavailable');
}


// Booking validation types
export interface BookingValidationItem {
  itemId: string;
  roomTypeId: string;
  checkIn: Date;
  checkOut: Date;
}

export interface BookingValidationResult {
  itemId: string;
  roomTypeId: string;
  valid: boolean;
  availableUnits: number;
  error?: string;
}

export interface BookingValidationSummary {
  allValid: boolean;
  results: BookingValidationResult[];
  invalidCount: number;
}

/**
 * Validate each booking item against per-room-type availability.
 *
 * Each item is validated independently using `availabilityMap`; missing availability data is treated as unavailable.
 *
 * @param items - Booking items to validate (each must include `itemId` and `roomTypeId`)
 * @param availabilityMap - Map of `roomTypeId` to `UnitAvailabilityResult` used to determine availability per item
 * @returns A summary containing per-item validation results, an `allValid` flag, and the count of invalid items
 */
export function validateBookingItems(
  items: BookingValidationItem[],
  availabilityMap: Map<string, UnitAvailabilityResult>
): BookingValidationSummary {
  const results: BookingValidationResult[] = [];
  
  for (const item of items) {
    const availability = availabilityMap.get(item.roomTypeId);
    
    if (!availability) {
      // No availability data - treat as unavailable
      results.push({
        itemId: item.itemId,
        roomTypeId: item.roomTypeId,
        valid: false,
        availableUnits: 0,
        error: 'Unable to verify availability for this room type'
      });
      continue;
    }
    
    if (!availability.available || availability.availableUnits <= 0) {
      results.push({
        itemId: item.itemId,
        roomTypeId: item.roomTypeId,
        valid: false,
        availableUnits: availability.availableUnits,
        error: 'This room type is fully booked for your selected dates'
      });
      continue;
    }
    
    // Room is available
    results.push({
      itemId: item.itemId,
      roomTypeId: item.roomTypeId,
      valid: true,
      availableUnits: availability.availableUnits
    });
  }
  
  const invalidCount = results.filter(r => !r.valid).length;
  
  return {
    allValid: invalidCount === 0,
    results,
    invalidCount
  };
}

/**
 * Determines whether a booking can proceed given the number of available units.
 *
 * @param availableUnits - Number of available units for the room type
 * @returns `true` if at least one unit is available, `false` otherwise.
 */
export function canProceedWithBooking(availableUnits: number): boolean {
  return availableUnits > 0;
}


// Concurrent booking protection types
export interface TransactionalAvailabilityCheck {
  roomTypeId: string;
  checkIn: Date;
  checkOut: Date;
}

export interface TransactionalAvailabilityResult {
  roomTypeId: string;
  available: boolean;
  availableUnits: number;
  totalUnits: number;
  bookedUnits: number;
}

/**
 * Compute unit-level availability for the specified room types within the provided database transaction.
 *
 * This function evaluates total units, booked units (considering CONFIRMED and PENDING bookings), and derives available units and availability flags for each requested room type while executing inside a transaction to enable concurrency protection.
 *
 * @param checks - Array of availability checks, each specifying a `roomTypeId`, `checkIn`, and `checkOut`
 * @returns A map from `roomTypeId` to `TransactionalAvailabilityResult` containing `totalUnits`, `bookedUnits`, `availableUnits`, and `available`
 */
export async function checkUnitAvailabilityInTransaction(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  checks: TransactionalAvailabilityCheck[]
): Promise<TransactionalAvailabilityResult[]> {
  const results: TransactionalAvailabilityResult[] = [];
  
  if (checks.length === 0) {
    return results;
  }

  // Get unique room type IDs
  const roomTypeIds = [...new Set(checks.map(c => c.roomTypeId))];

  // Get total active units for each room type
  const unitCounts = await tx.roomUnit.groupBy({
    by: ['roomTypeId'],
    where: {
      roomTypeId: { in: roomTypeIds },
      isActive: true,
      deletedAt: null
    },
    _count: {
      id: true
    }
  });

  // Create a map of roomTypeId to total units
  const totalUnitsMap = new Map<string, number>();
  for (const count of unitCounts) {
    totalUnitsMap.set(count.roomTypeId, count._count.id);
  }

  // Process each check
  for (const check of checks) {
    const totalUnits = totalUnitsMap.get(check.roomTypeId) || 0;

    // Count overlapping bookings for this room type and date range
    // Only count CONFIRMED or PENDING bookings (not CANCELLED)
    const overlappingBookings = await tx.bookingItem.count({
      where: {
        roomId: check.roomTypeId,
        booking: {
          status: {
            in: ['CONFIRMED', 'PENDING', 'CHECKED_IN']
          }
        },
        // Date overlap: checkIn < requestedCheckOut AND checkOut > requestedCheckIn
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
      }
    });

    const bookedUnits = overlappingBookings;
    const availableUnits = Math.max(0, totalUnits - bookedUnits);
    const available = availableUnits > 0;

    results.push({
      roomTypeId: check.roomTypeId,
      available,
      availableUnits,
      totalUnits,
      bookedUnits
    });
  }

  return results;
}

/**
 * Simulate concurrent booking protection logic.
 * Pure function for testing purposes.
 * 
 * Given N booking attempts and M available units:
 * - If N <= M: all N bookings succeed
 * - If N > M: exactly M bookings succeed, (N - M) fail
 * 
 * @param attemptCount - Number of concurrent booking attempts
 * @param availableUnits - Number of available units
 * @returns Object with success and failure counts
 */
export function simulateConcurrentBookings(
  attemptCount: number,
  availableUnits: number
): { successCount: number; failureCount: number } {
  const successCount = Math.min(attemptCount, availableUnits);
  const failureCount = Math.max(0, attemptCount - availableUnits);
  
  return { successCount, failureCount };
}

/**
 * Increase available units by one when a booking is cancelled, capped at the room type's total units.
 *
 * @returns The new number of available units after cancellation, not exceeding `totalUnits`.
 */
export function calculateAvailabilityAfterCancellation(
  currentAvailableUnits: number,
  totalUnits: number
): number {
  // After cancellation, one more unit becomes available
  // But cannot exceed total units
  return Math.min(currentAvailableUnits + 1, totalUnits);
}