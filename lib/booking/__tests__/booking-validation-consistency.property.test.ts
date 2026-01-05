/**
 * Property-Based Tests for Booking Validation Consistency
 * 
 * Feature: unit-based-availability
 * Property 5: Booking Validation Consistency
 * Validates: Requirements 4.2, 4.4
 * 
 * For any booking attempt where the selected room type has availableUnits = 0
 * for the requested dates, the system SHALL reject the booking and display an error.
 * In cart mode, each item SHALL be validated independently.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateBookingItems,
  canProceedWithBooking,
  BookingValidationItem,
  UnitAvailabilityResult
} from '@/lib/booking/availability';

// Arbitraries for generating test data
const bookingItemArb = fc.record({
  itemId: fc.uuid(),
  roomTypeId: fc.uuid(),
  checkIn: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }),
  checkOut: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') })
}).filter(item => item.checkIn < item.checkOut);

const availabilityResultArb = (roomTypeId: string) => fc.record({
  roomTypeId: fc.constant(roomTypeId),
  totalUnits: fc.integer({ min: 0, max: 50 }),
  bookedUnits: fc.integer({ min: 0, max: 50 }),
  availableUnits: fc.integer({ min: 0, max: 50 }),
  available: fc.boolean(),
  limitedAvailability: fc.boolean()
});

// Generate consistent availability (available flag matches availableUnits > 0)
const consistentAvailabilityArb = (roomTypeId: string) => 
  fc.integer({ min: 0, max: 50 }).chain(totalUnits =>
    fc.integer({ min: 0, max: totalUnits }).map(bookedUnits => {
      const availableUnits = Math.max(0, totalUnits - bookedUnits);
      return {
        roomTypeId,
        totalUnits,
        bookedUnits,
        availableUnits,
        available: availableUnits > 0,
        limitedAvailability: availableUnits > 0 && availableUnits <= 2
      };
    })
  );

// Generate booking items with matching availability
const itemsWithAvailabilityArb = fc.array(bookingItemArb, { minLength: 1, maxLength: 10 })
  .chain(items => {
    const availabilityArbs = items.map(item => consistentAvailabilityArb(item.roomTypeId));
    return fc.tuple(
      fc.constant(items),
      fc.tuple(...availabilityArbs)
    );
  });

describe('Property 5: Booking Validation Consistency', () => {
  /**
   * Property 5.1: Bookings with zero availability should be rejected
   * Validates: Requirement 4.2
   */
  it('should reject booking when availableUnits = 0', async () => {
    await fc.assert(
      fc.property(
        bookingItemArb,
        fc.integer({ min: 0, max: 50 }),
        (item, totalUnits) => {
          // Create availability with zero available units
          const availability: UnitAvailabilityResult = {
            roomTypeId: item.roomTypeId,
            totalUnits,
            bookedUnits: totalUnits, // All booked
            availableUnits: 0,
            available: false,
            limitedAvailability: false
          };
          
          const availabilityMap = new Map<string, UnitAvailabilityResult>();
          availabilityMap.set(item.roomTypeId, availability);
          
          const result = validateBookingItems([item], availabilityMap);
          
          // Booking should be rejected
          expect(result.allValid).toBe(false);
          expect(result.invalidCount).toBe(1);
          expect(result.results[0].valid).toBe(false);
          expect(result.results[0].error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.2: Bookings with available units should be accepted
   * Validates: Requirement 4.2 (positive case)
   */
  it('should accept booking when availableUnits > 0', async () => {
    await fc.assert(
      fc.property(
        bookingItemArb,
        fc.integer({ min: 1, max: 50 }), // At least 1 available
        fc.integer({ min: 1, max: 50 }),
        (item, availableUnits, totalUnits) => {
          const actualTotal = Math.max(availableUnits, totalUnits);
          const bookedUnits = actualTotal - availableUnits;
          
          const availability: UnitAvailabilityResult = {
            roomTypeId: item.roomTypeId,
            totalUnits: actualTotal,
            bookedUnits,
            availableUnits,
            available: true,
            limitedAvailability: availableUnits <= 2
          };
          
          const availabilityMap = new Map<string, UnitAvailabilityResult>();
          availabilityMap.set(item.roomTypeId, availability);
          
          const result = validateBookingItems([item], availabilityMap);
          
          // Booking should be accepted
          expect(result.allValid).toBe(true);
          expect(result.invalidCount).toBe(0);
          expect(result.results[0].valid).toBe(true);
          expect(result.results[0].error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.3: Each cart item should be validated independently
   * Validates: Requirement 4.4
   */
  it('should validate each cart item independently', async () => {
    await fc.assert(
      fc.property(
        itemsWithAvailabilityArb,
        ([items, availabilityResults]) => {
          const availabilityMap = new Map<string, UnitAvailabilityResult>();
          for (const availability of availabilityResults) {
            availabilityMap.set(availability.roomTypeId, availability);
          }
          
          const result = validateBookingItems(items, availabilityMap);
          
          // Should have a result for each item
          expect(result.results.length).toBe(items.length);
          
          // Each result should match its availability
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const availability = availabilityMap.get(item.roomTypeId);
            const itemResult = result.results.find(r => r.itemId === item.itemId);
            
            expect(itemResult).toBeDefined();
            expect(itemResult!.roomTypeId).toBe(item.roomTypeId);
            
            if (availability && availability.availableUnits > 0) {
              expect(itemResult!.valid).toBe(true);
            } else {
              expect(itemResult!.valid).toBe(false);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.4: Invalid count should match number of unavailable items
   * Validates: Requirement 4.4
   */
  it('should correctly count invalid items', async () => {
    await fc.assert(
      fc.property(
        itemsWithAvailabilityArb,
        ([items, availabilityResults]) => {
          const availabilityMap = new Map<string, UnitAvailabilityResult>();
          for (const availability of availabilityResults) {
            availabilityMap.set(availability.roomTypeId, availability);
          }
          
          const result = validateBookingItems(items, availabilityMap);
          
          // Count expected invalid items
          const expectedInvalid = items.filter(item => {
            const availability = availabilityMap.get(item.roomTypeId);
            return !availability || availability.availableUnits <= 0;
          }).length;
          
          expect(result.invalidCount).toBe(expectedInvalid);
          expect(result.allValid).toBe(expectedInvalid === 0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.5: Items without availability data should be rejected
   * Validates: Requirement 4.2
   */
  it('should reject items without availability data', async () => {
    await fc.assert(
      fc.property(
        fc.array(bookingItemArb, { minLength: 1, maxLength: 5 }),
        (items) => {
          // Empty availability map - no data for any room
          const availabilityMap = new Map<string, UnitAvailabilityResult>();
          
          const result = validateBookingItems(items, availabilityMap);
          
          // All items should be rejected
          expect(result.allValid).toBe(false);
          expect(result.invalidCount).toBe(items.length);
          
          for (const itemResult of result.results) {
            expect(itemResult.valid).toBe(false);
            expect(itemResult.error).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.6: canProceedWithBooking should return false for zero units
   */
  it('should return false for canProceedWithBooking when units = 0', async () => {
    expect(canProceedWithBooking(0)).toBe(false);
    
    await fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 0 }),
        (units) => {
          expect(canProceedWithBooking(units)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.7: canProceedWithBooking should return true for positive units
   */
  it('should return true for canProceedWithBooking when units > 0', async () => {
    await fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (units) => {
          expect(canProceedWithBooking(units)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.8: Available units in result should match availability data
   */
  it('should include correct availableUnits in validation result', async () => {
    await fc.assert(
      fc.property(
        itemsWithAvailabilityArb,
        ([items, availabilityResults]) => {
          const availabilityMap = new Map<string, UnitAvailabilityResult>();
          for (const availability of availabilityResults) {
            availabilityMap.set(availability.roomTypeId, availability);
          }
          
          const result = validateBookingItems(items, availabilityMap);
          
          for (const itemResult of result.results) {
            const availability = availabilityMap.get(itemResult.roomTypeId);
            if (availability) {
              expect(itemResult.availableUnits).toBe(availability.availableUnits);
            } else {
              expect(itemResult.availableUnits).toBe(0);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.9: Empty items array should return valid summary
   */
  it('should handle empty items array', () => {
    const availabilityMap = new Map<string, UnitAvailabilityResult>();
    const result = validateBookingItems([], availabilityMap);
    
    expect(result.allValid).toBe(true);
    expect(result.results).toEqual([]);
    expect(result.invalidCount).toBe(0);
  });
});
