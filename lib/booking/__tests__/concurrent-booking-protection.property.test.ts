/**
 * Property-Based Tests for Concurrent Booking Protection
 * 
 * Feature: unit-based-availability
 * Property 6: Concurrent Booking Protection
 * Validates: Requirements 5.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { simulateConcurrentBookings } from '../availability';

describe('Property 6: Concurrent Booking Protection', () => {
  /**
   * For any N concurrent booking attempts for a room type with M available units
   * where N > M, exactly M bookings SHALL succeed and (N - M) SHALL fail with
   * an availability error. No overselling SHALL occur.
   */

  // Arbitrary for number of concurrent booking attempts
  const attemptCountArb = fc.integer({ min: 1, max: 100 });
  
  // Arbitrary for available units
  const availableUnitsArb = fc.integer({ min: 0, max: 50 });

  it('should never allow more successful bookings than available units', async () => {
    await fc.assert(
      fc.property(
        attemptCountArb,
        availableUnitsArb,
        (attemptCount, availableUnits) => {
          const result = simulateConcurrentBookings(attemptCount, availableUnits);
          
          // Success count should never exceed available units
          expect(result.successCount).toBeLessThanOrEqual(availableUnits);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should succeed for all attempts when attempts <= available units', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }), // available units
        (availableUnits) => {
          // Generate attempts <= available
          const attemptCount = fc.sample(fc.integer({ min: 1, max: availableUnits }), 1)[0];
          const result = simulateConcurrentBookings(attemptCount, availableUnits);
          
          // All attempts should succeed
          expect(result.successCount).toBe(attemptCount);
          expect(result.failureCount).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should fail exactly (N - M) attempts when N > M', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }), // available units (M)
        fc.integer({ min: 1, max: 50 }), // extra attempts beyond available
        (availableUnits, extraAttempts) => {
          const attemptCount = availableUnits + extraAttempts; // N > M
          const result = simulateConcurrentBookings(attemptCount, availableUnits);
          
          // Exactly M should succeed
          expect(result.successCount).toBe(availableUnits);
          // Exactly (N - M) should fail
          expect(result.failureCount).toBe(extraAttempts);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have success + failure = total attempts', async () => {
    await fc.assert(
      fc.property(
        attemptCountArb,
        availableUnitsArb,
        (attemptCount, availableUnits) => {
          const result = simulateConcurrentBookings(attemptCount, availableUnits);
          
          // Total should always equal attempt count
          expect(result.successCount + result.failureCount).toBe(attemptCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should fail all attempts when no units available', async () => {
    await fc.assert(
      fc.property(
        attemptCountArb,
        (attemptCount) => {
          const result = simulateConcurrentBookings(attemptCount, 0);
          
          // All should fail when no units available
          expect(result.successCount).toBe(0);
          expect(result.failureCount).toBe(attemptCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should succeed exactly M times when N concurrent attempts for M units', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }), // M available units
        fc.integer({ min: 1, max: 50 }), // N attempts
        (availableUnits, attemptCount) => {
          const result = simulateConcurrentBookings(attemptCount, availableUnits);
          
          // Success count should be min(N, M)
          const expectedSuccess = Math.min(attemptCount, availableUnits);
          expect(result.successCount).toBe(expectedSuccess);
          
          // Failure count should be max(0, N - M)
          const expectedFailure = Math.max(0, attemptCount - availableUnits);
          expect(result.failureCount).toBe(expectedFailure);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should prevent overselling - success count never exceeds initial availability', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }), // Many concurrent attempts
        fc.integer({ min: 1, max: 10 }),  // Limited availability
        (attemptCount, availableUnits) => {
          const result = simulateConcurrentBookings(attemptCount, availableUnits);
          
          // This is the key property: no overselling
          expect(result.successCount).toBeLessThanOrEqual(availableUnits);
          
          // And we maximize successful bookings
          expect(result.successCount).toBe(Math.min(attemptCount, availableUnits));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle edge case of single unit with many attempts', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 100 }), // Multiple attempts
        (attemptCount) => {
          const result = simulateConcurrentBookings(attemptCount, 1);
          
          // Only 1 should succeed
          expect(result.successCount).toBe(1);
          // Rest should fail
          expect(result.failureCount).toBe(attemptCount - 1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
