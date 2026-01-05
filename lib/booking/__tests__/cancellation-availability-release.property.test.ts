/**
 * Property-Based Tests for Cancellation Availability Release
 * 
 * Feature: unit-based-availability
 * Property 7: Cancellation Availability Release
 * Validates: Requirements 5.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateAvailabilityAfterCancellation, calculateUnitAvailability } from '../availability';

describe('Property 7: Cancellation Availability Release', () => {
  /**
   * For any confirmed booking that is cancelled, the availability for that
   * room type and date range SHALL increase by 1 immediately after cancellation.
   */

  // Arbitrary for total units (reasonable hotel size)
  const totalUnitsArb = fc.integer({ min: 1, max: 100 });
  
  // Arbitrary for current available units (must be less than total)
  const availableUnitsArb = (totalUnits: number) => 
    fc.integer({ min: 0, max: totalUnits - 1 });

  it('should increase availability by 1 after cancellation', async () => {
    await fc.assert(
      fc.property(
        totalUnitsArb,
        (totalUnits) => {
          // Generate available units less than total (at least one booking exists)
          const currentAvailable = fc.sample(
            fc.integer({ min: 0, max: Math.max(0, totalUnits - 1) }), 
            1
          )[0];
          
          const newAvailable = calculateAvailabilityAfterCancellation(
            currentAvailable, 
            totalUnits
          );
          
          // Availability should increase by 1
          expect(newAvailable).toBe(currentAvailable + 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never exceed total units after cancellation', async () => {
    await fc.assert(
      fc.property(
        totalUnitsArb,
        fc.integer({ min: 0, max: 100 }), // current available (can be any value)
        (totalUnits, currentAvailable) => {
          const newAvailable = calculateAvailabilityAfterCancellation(
            currentAvailable, 
            totalUnits
          );
          
          // Should never exceed total units
          expect(newAvailable).toBeLessThanOrEqual(totalUnits);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should cap at total units when already at max', async () => {
    await fc.assert(
      fc.property(
        totalUnitsArb,
        (totalUnits) => {
          // When all units are already available
          const newAvailable = calculateAvailabilityAfterCancellation(
            totalUnits, 
            totalUnits
          );
          
          // Should stay at total (can't exceed)
          expect(newAvailable).toBe(totalUnits);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should release exactly one unit per cancellation', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 50 }), // total units
        fc.integer({ min: 1, max: 10 }), // number of cancellations
        (totalUnits, cancellationCount) => {
          let currentAvailable = 0; // Start fully booked
          
          // Simulate multiple cancellations
          for (let i = 0; i < cancellationCount; i++) {
            currentAvailable = calculateAvailabilityAfterCancellation(
              currentAvailable, 
              totalUnits
            );
          }
          
          // After N cancellations, should have N units available (capped at total)
          const expectedAvailable = Math.min(cancellationCount, totalUnits);
          expect(currentAvailable).toBe(expectedAvailable);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should make room available when going from 0 to 1', async () => {
    await fc.assert(
      fc.property(
        totalUnitsArb,
        (totalUnits) => {
          // Start with no availability (fully booked)
          const beforeCancellation = calculateUnitAvailability(totalUnits, totalUnits);
          expect(beforeCancellation.available).toBe(false);
          expect(beforeCancellation.availableUnits).toBe(0);
          
          // After cancellation
          const newAvailable = calculateAvailabilityAfterCancellation(0, totalUnits);
          const afterCancellation = calculateUnitAvailability(totalUnits, totalUnits - newAvailable);
          
          // Should now be available
          expect(afterCancellation.available).toBe(true);
          expect(afterCancellation.availableUnits).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain consistency between booking and cancellation', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }), // total units
        fc.integer({ min: 0, max: 49 }), // initial bookings
        (totalUnits, initialBookings) => {
          // Ensure bookings don't exceed units
          const bookings = Math.min(initialBookings, totalUnits);
          
          // Calculate initial availability
          const initialAvailability = calculateUnitAvailability(totalUnits, bookings);
          
          // If there's at least one booking, cancelling it should increase availability
          if (bookings > 0) {
            const newAvailable = calculateAvailabilityAfterCancellation(
              initialAvailability.availableUnits,
              totalUnits
            );
            
            // New availability should be initial + 1 (capped at total)
            const expected = Math.min(initialAvailability.availableUnits + 1, totalUnits);
            expect(newAvailable).toBe(expected);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle edge case of single unit room', async () => {
    // Single unit room - cancellation should make it available
    const newAvailable = calculateAvailabilityAfterCancellation(0, 1);
    expect(newAvailable).toBe(1);
    
    // Already available - should stay at 1
    const stillAvailable = calculateAvailabilityAfterCancellation(1, 1);
    expect(stillAvailable).toBe(1);
  });

  it('should immediately reflect in availability calculation', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }), // total units
        (totalUnits) => {
          // Fully booked scenario
          const bookedUnits = totalUnits;
          const beforeCancel = calculateUnitAvailability(totalUnits, bookedUnits);
          
          expect(beforeCancel.available).toBe(false);
          expect(beforeCancel.availableUnits).toBe(0);
          
          // After one cancellation, booked units decrease by 1
          const afterCancel = calculateUnitAvailability(totalUnits, bookedUnits - 1);
          
          expect(afterCancel.available).toBe(true);
          expect(afterCancel.availableUnits).toBe(1);
          
          // This simulates the immediate release - cancelled bookings
          // don't count toward booked units
        }
      ),
      { numRuns: 100 }
    );
  });
});
