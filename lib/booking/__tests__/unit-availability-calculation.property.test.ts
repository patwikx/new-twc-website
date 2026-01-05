/**
 * Property-Based Tests for Unit-Based Availability Calculation
 * 
 * Feature: unit-based-availability
 * Property 1: Availability Calculation Correctness
 * Validates: Requirements 1.1, 1.3, 1.4, 1.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateUnitAvailability } from '../availability';

describe('Property 1: Availability Calculation Correctness', () => {
  /**
   * For any room type with N active units and M overlapping bookings,
   * the availability service SHALL return:
   * - availableUnits = N - M (but never negative)
   * - available = (M < N)
   * - limitedAvailability = (N - M <= 2 AND N - M > 0)
   */

  // Arbitrary for total units (reasonable hotel size)
  const totalUnitsArb = fc.integer({ min: 0, max: 100 });
  
  // Arbitrary for booked units (can exceed total in edge cases)
  const bookedUnitsArb = fc.integer({ min: 0, max: 150 });

  it('should calculate availableUnits as totalUnits - bookedUnits (never negative)', async () => {
    await fc.assert(
      fc.property(
        totalUnitsArb,
        bookedUnitsArb,
        (totalUnits, bookedUnits) => {
          const result = calculateUnitAvailability(totalUnits, bookedUnits);
          
          const expectedAvailable = Math.max(0, totalUnits - bookedUnits);
          expect(result.availableUnits).toBe(expectedAvailable);
          expect(result.availableUnits).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should set available = true only when bookedUnits < totalUnits', async () => {
    await fc.assert(
      fc.property(
        totalUnitsArb,
        bookedUnitsArb,
        (totalUnits, bookedUnits) => {
          const result = calculateUnitAvailability(totalUnits, bookedUnits);
          
          const expectedAvailable = bookedUnits < totalUnits;
          expect(result.available).toBe(expectedAvailable);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should set limitedAvailability = true only when 0 < availableUnits <= 2', async () => {
    await fc.assert(
      fc.property(
        totalUnitsArb,
        bookedUnitsArb,
        (totalUnits, bookedUnits) => {
          const result = calculateUnitAvailability(totalUnits, bookedUnits);
          
          const availableUnits = Math.max(0, totalUnits - bookedUnits);
          const expectedLimited = availableUnits > 0 && availableUnits <= 2;
          expect(result.limitedAvailability).toBe(expectedLimited);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should mark as unavailable when all units are booked', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }), // At least 1 unit
        (totalUnits) => {
          // Book all units or more
          const bookedUnits = totalUnits;
          const result = calculateUnitAvailability(totalUnits, bookedUnits);
          
          expect(result.available).toBe(false);
          expect(result.availableUnits).toBe(0);
          expect(result.limitedAvailability).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should mark as unavailable when overbooked', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 1, max: 50 }),
        (totalUnits, extraBookings) => {
          // Book more than available
          const bookedUnits = totalUnits + extraBookings;
          const result = calculateUnitAvailability(totalUnits, bookedUnits);
          
          expect(result.available).toBe(false);
          expect(result.availableUnits).toBe(0);
          expect(result.limitedAvailability).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should mark as limited when exactly 1 or 2 units available', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 50 }), // Need at least 3 units
        fc.integer({ min: 1, max: 2 }),  // 1 or 2 remaining
        (totalUnits, remaining) => {
          const bookedUnits = totalUnits - remaining;
          const result = calculateUnitAvailability(totalUnits, bookedUnits);
          
          expect(result.available).toBe(true);
          expect(result.availableUnits).toBe(remaining);
          expect(result.limitedAvailability).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not mark as limited when more than 2 units available', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 4, max: 50 }), // Need at least 4 units
        fc.integer({ min: 3, max: 50 }), // 3+ remaining
        (totalUnits, remaining) => {
          // Ensure remaining doesn't exceed total
          const actualRemaining = Math.min(remaining, totalUnits);
          if (actualRemaining <= 2) return; // Skip if not enough remaining
          
          const bookedUnits = totalUnits - actualRemaining;
          const result = calculateUnitAvailability(totalUnits, bookedUnits);
          
          expect(result.available).toBe(true);
          expect(result.availableUnits).toBe(actualRemaining);
          expect(result.limitedAvailability).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle zero total units correctly', async () => {
    await fc.assert(
      fc.property(
        bookedUnitsArb,
        (bookedUnits) => {
          const result = calculateUnitAvailability(0, bookedUnits);
          
          expect(result.availableUnits).toBe(0);
          expect(result.available).toBe(false);
          expect(result.limitedAvailability).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
