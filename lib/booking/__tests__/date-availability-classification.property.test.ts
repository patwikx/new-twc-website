/**
 * Property-Based Tests for Date Availability Classification
 * 
 * Feature: unit-based-availability
 * Property 3: Date Availability Classification
 * Validates: Requirements 2.2, 2.3, 2.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { classifyDateAvailability, hasUnavailableDates, DateAvailability } from '../availability';

describe('Property 3: Date Availability Classification', () => {
  /**
   * For any date and room type, the date SHALL be classified as:
   * - 'unavailable' if availableUnits = 0
   * - 'limited' if availableUnits > 0 AND availableUnits < (totalUnits * 0.5)
   * - 'available' otherwise
   * 
   * And date range selection SHALL be blocked if any date in the range is 'unavailable'.
   */

  // Arbitrary for unit counts
  const totalUnitsArb = fc.integer({ min: 0, max: 100 });
  const availableUnitsArb = fc.integer({ min: 0, max: 100 });

  describe('classifyDateAvailability', () => {
    it('should classify as unavailable when availableUnits = 0', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }), // totalUnits > 0
          (totalUnits) => {
            const result = classifyDateAvailability(0, totalUnits);
            expect(result).toBe('unavailable');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should classify as unavailable when availableUnits < 0', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: -100, max: -1 }), // negative available
          fc.integer({ min: 1, max: 100 }),
          (availableUnits, totalUnits) => {
            const result = classifyDateAvailability(availableUnits, totalUnits);
            expect(result).toBe('unavailable');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should classify as limited when 0 < availableUnits < totalUnits * 0.5', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 100 }), // Need at least 4 total for meaningful test
          (totalUnits) => {
            // Calculate a value that's less than 50% but greater than 0
            const threshold = Math.floor(totalUnits * 0.5);
            if (threshold <= 0) return; // Skip if threshold is 0
            
            const availableUnits = Math.max(1, threshold - 1);
            const result = classifyDateAvailability(availableUnits, totalUnits);
            expect(result).toBe('limited');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should classify as available when availableUnits >= totalUnits * 0.5', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 100 }), // totalUnits >= 2
          (totalUnits) => {
            // Calculate a value that's at least 50%
            const availableUnits = Math.ceil(totalUnits * 0.5);
            const result = classifyDateAvailability(availableUnits, totalUnits);
            expect(result).toBe('available');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should classify as available when all units are available', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (totalUnits) => {
            const result = classifyDateAvailability(totalUnits, totalUnits);
            expect(result).toBe('available');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle edge case of zero total units', async () => {
      await fc.assert(
        fc.property(
          availableUnitsArb,
          (availableUnits) => {
            const result = classifyDateAvailability(availableUnits, 0);
            // With 0 total units, if available > 0, it's available; otherwise unavailable
            if (availableUnits <= 0) {
              expect(result).toBe('unavailable');
            } else {
              expect(result).toBe('available');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should follow the exact classification rules from the design', async () => {
      await fc.assert(
        fc.property(
          availableUnitsArb,
          totalUnitsArb,
          (availableUnits, totalUnits) => {
            const result = classifyDateAvailability(availableUnits, totalUnits);
            
            // Verify against the exact rules
            if (availableUnits <= 0) {
              expect(result).toBe('unavailable');
            } else if (totalUnits > 0 && availableUnits < totalUnits * 0.5) {
              expect(result).toBe('limited');
            } else {
              expect(result).toBe('available');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('hasUnavailableDates', () => {
    // Helper to generate a date
    const dateArb = fc.date({
      min: new Date('2024-01-01'),
      max: new Date('2027-12-31')
    }).filter(d => !isNaN(d.getTime()));

    // Helper to generate DateAvailability
    const dateAvailabilityArb = fc.record({
      date: dateArb,
      availableUnits: fc.integer({ min: 0, max: 50 }),
      totalUnits: fc.integer({ min: 1, max: 50 }),
      status: fc.constantFrom('available', 'limited', 'unavailable') as fc.Arbitrary<'available' | 'limited' | 'unavailable'>
    });

    it('should return true if any date is unavailable', async () => {
      await fc.assert(
        fc.property(
          fc.array(dateAvailabilityArb, { minLength: 1, maxLength: 30 }),
          (availability) => {
            const hasUnavailable = availability.some(d => d.status === 'unavailable');
            const result = hasUnavailableDates(availability);
            expect(result).toBe(hasUnavailable);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return false if all dates are available or limited', async () => {
      await fc.assert(
        fc.property(
          fc.array(
            fc.record({
              date: dateArb,
              availableUnits: fc.integer({ min: 1, max: 50 }),
              totalUnits: fc.integer({ min: 1, max: 50 }),
              status: fc.constantFrom('available', 'limited') as fc.Arbitrary<'available' | 'limited'>
            }),
            { minLength: 1, maxLength: 30 }
          ),
          (availability) => {
            const result = hasUnavailableDates(availability);
            expect(result).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return true if at least one date is unavailable among many', async () => {
      await fc.assert(
        fc.property(
          fc.array(
            fc.record({
              date: dateArb,
              availableUnits: fc.integer({ min: 1, max: 50 }),
              totalUnits: fc.integer({ min: 1, max: 50 }),
              status: fc.constantFrom('available', 'limited') as fc.Arbitrary<'available' | 'limited'>
            }),
            { minLength: 0, maxLength: 29 }
          ),
          dateArb,
          (availableDates, unavailableDate) => {
            // Add one unavailable date
            const unavailableEntry: DateAvailability = {
              date: unavailableDate,
              availableUnits: 0,
              totalUnits: 10,
              status: 'unavailable'
            };
            
            const availability = [...availableDates, unavailableEntry];
            const result = hasUnavailableDates(availability);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return false for empty array', () => {
      const result = hasUnavailableDates([]);
      expect(result).toBe(false);
    });
  });
});
