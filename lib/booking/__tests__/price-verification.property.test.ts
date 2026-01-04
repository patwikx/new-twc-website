/**
 * Property-Based Tests for Price Verification Consistency
 * 
 * Feature: booking-security-enhancements
 * Property 6: Price Verification Consistency
 * 
 * For any booking, if the re-calculated total from current room prices differs
 * from the stored total by more than 1%, the Payment_Gateway SHALL reject the checkout request.
 * 
 * **Validates: Requirements 7.1, 7.2**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  calculateNights,
  calculateItemTotal,
  calculatePercentageDiff,
  isWithinTolerance,
  verifyBookingAmountPure,
  BookingItemForVerification,
} from "../price-verification";

// Generate valid dates for booking items
const MIN_TIMESTAMP = new Date("2024-01-01T00:00:00.000Z").getTime();
const MAX_TIMESTAMP = new Date("2030-12-31T23:59:59.000Z").getTime();

const dateArb = fc.integer({ min: MIN_TIMESTAMP, max: MAX_TIMESTAMP }).map(ts => new Date(ts));

// Generate a valid booking item
const bookingItemArb = fc.record({
  checkIn: dateArb,
  nights: fc.integer({ min: 1, max: 30 }),
  pricePerNight: fc.float({ min: Math.fround(100), max: Math.fround(50000), noNaN: true }),
  currentRoomPrice: fc.float({ min: Math.fround(100), max: Math.fround(50000), noNaN: true }),
}).map(({ checkIn, nights, pricePerNight, currentRoomPrice }) => {
  const checkOut = new Date(checkIn.getTime() + nights * 24 * 60 * 60 * 1000);
  return {
    checkIn,
    checkOut,
    pricePerNight,
    room: { price: currentRoomPrice },
  } as BookingItemForVerification;
});

describe("Property 6: Price Verification Consistency", () => {
  /**
   * Property 6.1: calculateNights returns positive integer
   */
  it("should calculate nights as positive integer", () => {
    fc.assert(
      fc.property(
        dateArb,
        fc.integer({ min: 1, max: 365 }),
        (checkIn, nights) => {
          const checkOut = new Date(checkIn.getTime() + nights * 24 * 60 * 60 * 1000);
          const result = calculateNights(checkIn, checkOut);
          
          expect(result).toBeGreaterThanOrEqual(1);
          expect(Number.isInteger(result)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.2: calculateNights is at least 1 for same-day checkout
   */
  it("should return at least 1 night for same-day checkout", () => {
    fc.assert(
      fc.property(dateArb, (date) => {
        const result = calculateNights(date, date);
        expect(result).toBe(1);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.3: calculateItemTotal is positive for valid items
   */
  it("should calculate positive item total for valid items", () => {
    fc.assert(
      fc.property(bookingItemArb, (item) => {
        const total = calculateItemTotal(item);
        expect(total).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.4: Percentage difference is 0 for identical values
   */
  it("should return 0% difference for identical values", () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(1000000), noNaN: true }),
        (value) => {
          const diff = calculatePercentageDiff(value, value);
          expect(diff).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.5: Percentage difference is symmetric
   */
  it("should calculate percentage difference relative to stored value", () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(1000000), noNaN: true }),
        fc.float({ min: Math.fround(1), max: Math.fround(1000000), noNaN: true }),
        (stored, calculated) => {
          const diff = calculatePercentageDiff(stored, calculated);
          expect(diff).toBeGreaterThanOrEqual(0);
          
          // Verify the formula: |calculated - stored| / stored * 100
          const expected = Math.abs((calculated - stored) / stored) * 100;
          expect(diff).toBeCloseTo(expected, 5);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.6: isWithinTolerance returns true for differences <= 1%
   */
  it("should accept differences within 1% tolerance", () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
        (percentDiff) => {
          expect(isWithinTolerance(percentDiff)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.7: isWithinTolerance returns false for differences > 1%
   */
  it("should reject differences greater than 1% tolerance", () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1.01), max: Math.fround(100), noNaN: true }),
        (percentDiff) => {
          expect(isWithinTolerance(percentDiff)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.8: verifyBookingAmountPure returns valid=true when prices match
   */
  it("should return valid=true when stored and calculated totals match", () => {
    fc.assert(
      fc.property(
        fc.array(bookingItemArb, { minLength: 1, maxLength: 5 }),
        (items) => {
          // Calculate what the total should be
          let subtotal = 0;
          for (const item of items) {
            const nights = calculateNights(item.checkIn, item.checkOut);
            const price = typeof item.room.price === 'number' 
              ? item.room.price 
              : Number(item.room.price);
            subtotal += nights * price;
          }
          
          const taxRate = 0.12;
          const serviceChargeRate = 0.10;
          const total = subtotal * (1 + taxRate + serviceChargeRate);
          
          const result = verifyBookingAmountPure(total, items, taxRate, serviceChargeRate);
          
          expect(result.valid).toBe(true);
          expect(result.percentageDiff).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.9: verifyBookingAmountPure returns valid=false when prices differ significantly
   */
  it("should return valid=false when prices differ by more than 1%", () => {
    fc.assert(
      fc.property(
        fc.array(bookingItemArb, { minLength: 1, maxLength: 5 }),
        fc.float({ min: Math.fround(1.02), max: Math.fround(2), noNaN: true }), // Multiplier > 1.01 (more than 1% difference)
        (items, multiplier) => {
          // Calculate what the total should be
          let subtotal = 0;
          for (const item of items) {
            const nights = calculateNights(item.checkIn, item.checkOut);
            const price = typeof item.room.price === 'number' 
              ? item.room.price 
              : Number(item.room.price);
            subtotal += nights * price;
          }
          
          const taxRate = 0.12;
          const serviceChargeRate = 0.10;
          const correctTotal = subtotal * (1 + taxRate + serviceChargeRate);
          
          // Use a stored total that differs by more than 1%
          const storedTotal = correctTotal * multiplier;
          
          const result = verifyBookingAmountPure(storedTotal, items, taxRate, serviceChargeRate);
          
          expect(result.valid).toBe(false);
          expect(result.percentageDiff).toBeGreaterThan(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.10: verifyBookingAmountPure provides correct difference calculation
   */
  it("should correctly calculate the difference between stored and calculated totals", () => {
    fc.assert(
      fc.property(
        fc.array(bookingItemArb, { minLength: 1, maxLength: 3 }),
        fc.float({ min: Math.fround(0.5), max: Math.fround(1.5), noNaN: true }),
        (items, multiplier) => {
          // Calculate what the total should be
          let subtotal = 0;
          for (const item of items) {
            const nights = calculateNights(item.checkIn, item.checkOut);
            const price = typeof item.room.price === 'number' 
              ? item.room.price 
              : Number(item.room.price);
            subtotal += nights * price;
          }
          
          const taxRate = 0.12;
          const serviceChargeRate = 0.10;
          const calculatedTotal = subtotal * (1 + taxRate + serviceChargeRate);
          const storedTotal = calculatedTotal * multiplier;
          
          const result = verifyBookingAmountPure(storedTotal, items, taxRate, serviceChargeRate);
          
          // Verify difference is calculated correctly
          const expectedDiff = calculatedTotal - storedTotal;
          expect(result.difference).toBeCloseTo(expectedDiff, 2);
          expect(result.storedTotal).toBe(storedTotal);
          expect(result.calculatedTotal).toBeCloseTo(calculatedTotal, 2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
