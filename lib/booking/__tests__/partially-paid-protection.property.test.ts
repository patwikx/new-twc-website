/**
 * Property Test: Partially Paid Bookings Not Expired
 * 
 * Feature: booking-security-enhancements
 * Property 8: Partially Paid Bookings Not Expired
 * 
 * For any booking with paymentStatus of PARTIALLY_PAID,
 * the Expiration_Service SHALL NOT mark it as expired regardless of creation time.
 * 
 * Validates: Requirements 6.5
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  calculateExpirationCutoff,
  isEligibleForExpiration,
  filterEligibleBookings
} from "../expiration";

// 30 minutes in milliseconds
const EXPIRATION_THRESHOLD_MS = 30 * 60 * 1000;

describe("Feature: booking-security-enhancements, Property 8: Partially Paid Bookings Not Expired", () => {
  
  describe("isEligibleForExpiration with PARTIALLY_PAID", () => {
    it("should NEVER expire PARTIALLY_PAID bookings regardless of age", () => {
      fc.assert(
        fc.property(
          // Generate a "now" timestamp
          fc.integer({ min: 1577836800000 + EXPIRATION_THRESHOLD_MS + 1000, max: 1893456000000 }),
          // Generate any age from 0 to 7 days old
          fc.integer({ min: 0, max: 7 * 24 * 60 }),
          fc.constantFrom("PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"),
          (nowTimestamp, minutesOld, status) => {
            const now = new Date(nowTimestamp);
            const cutoff = calculateExpirationCutoff(now);
            const createdAt = new Date(nowTimestamp - minutesOld * 60 * 1000);
            
            const booking = {
              status,
              paymentStatus: "PARTIALLY_PAID",
              createdAt
            };
            
            // PARTIALLY_PAID bookings should NEVER be eligible for expiration
            expect(isEligibleForExpiration(booking, cutoff)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should protect PARTIALLY_PAID even when all other criteria would qualify for expiration", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1577836800000 + EXPIRATION_THRESHOLD_MS + 60000, max: 1893456000000 }),
          // Very old bookings (1-30 days old)
          fc.integer({ min: 24 * 60, max: 30 * 24 * 60 }),
          (nowTimestamp, minutesOld) => {
            const now = new Date(nowTimestamp);
            const cutoff = calculateExpirationCutoff(now);
            const createdAt = new Date(nowTimestamp - minutesOld * 60 * 1000);
            
            // This booking would be expired if it were UNPAID
            const partiallyPaidBooking = {
              status: "PENDING",
              paymentStatus: "PARTIALLY_PAID",
              createdAt
            };
            
            // Same booking but UNPAID would be expired
            const unpaidBooking = {
              status: "PENDING",
              paymentStatus: "UNPAID",
              createdAt
            };
            
            // UNPAID should be eligible
            expect(isEligibleForExpiration(unpaidBooking, cutoff)).toBe(true);
            
            // PARTIALLY_PAID should NOT be eligible
            expect(isEligibleForExpiration(partiallyPaidBooking, cutoff)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("filterEligibleBookings with mixed payment statuses", () => {
    it("should exclude all PARTIALLY_PAID bookings from expiration list", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1577836800000 + EXPIRATION_THRESHOLD_MS + 60000, max: 1893456000000 }),
          // Generate multiple bookings with various payment statuses
          fc.array(
            fc.record({
              id: fc.uuid(),
              status: fc.constant("PENDING"), // All PENDING to isolate payment status test
              paymentStatus: fc.constantFrom("UNPAID", "PARTIALLY_PAID"),
              // All old enough to be expired (31-120 minutes)
              minutesOld: fc.integer({ min: 31, max: 120 })
            }),
            { minLength: 5, maxLength: 20 }
          ),
          (nowTimestamp, bookingSpecs) => {
            const now = new Date(nowTimestamp);
            const cutoff = calculateExpirationCutoff(now);
            
            const bookings = bookingSpecs.map(spec => ({
              id: spec.id,
              status: spec.status,
              paymentStatus: spec.paymentStatus,
              createdAt: new Date(nowTimestamp - spec.minutesOld * 60 * 1000)
            }));
            
            const eligibleIds = filterEligibleBookings(bookings, cutoff);
            
            // Count expected results
            const partiallyPaidBookings = bookings.filter(b => b.paymentStatus === "PARTIALLY_PAID");
            const unpaidBookings = bookings.filter(b => b.paymentStatus === "UNPAID");
            
            // No PARTIALLY_PAID booking should be in the eligible list
            for (const booking of partiallyPaidBookings) {
              expect(eligibleIds).not.toContain(booking.id);
            }
            
            // All UNPAID bookings should be in the eligible list (they're all old enough)
            for (const booking of unpaidBookings) {
              expect(eligibleIds).toContain(booking.id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should handle edge case: all bookings are PARTIALLY_PAID", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1577836800000 + EXPIRATION_THRESHOLD_MS + 60000, max: 1893456000000 }),
          fc.array(
            fc.record({
              id: fc.uuid(),
              minutesOld: fc.integer({ min: 31, max: 120 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (nowTimestamp, bookingSpecs) => {
            const now = new Date(nowTimestamp);
            const cutoff = calculateExpirationCutoff(now);
            
            // All bookings are PARTIALLY_PAID
            const bookings = bookingSpecs.map(spec => ({
              id: spec.id,
              status: "PENDING",
              paymentStatus: "PARTIALLY_PAID",
              createdAt: new Date(nowTimestamp - spec.minutesOld * 60 * 1000)
            }));
            
            const eligibleIds = filterEligibleBookings(bookings, cutoff);
            
            // Should return empty array
            expect(eligibleIds).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("Payment status transition protection", () => {
    it("should protect bookings that transition to PARTIALLY_PAID before expiration check", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1577836800000 + EXPIRATION_THRESHOLD_MS + 60000, max: 1893456000000 }),
          fc.integer({ min: 31, max: 120 }),
          (nowTimestamp, minutesOld) => {
            const now = new Date(nowTimestamp);
            const cutoff = calculateExpirationCutoff(now);
            const createdAt = new Date(nowTimestamp - minutesOld * 60 * 1000);
            
            // Simulate a booking that was UNPAID but received partial payment
            // At the time of expiration check, it's PARTIALLY_PAID
            const booking = {
              id: "test-booking-id",
              status: "PENDING",
              paymentStatus: "PARTIALLY_PAID", // Current state at check time
              createdAt
            };
            
            const eligibleIds = filterEligibleBookings([booking], cutoff);
            
            // Should NOT be expired because current status is PARTIALLY_PAID
            expect(eligibleIds).not.toContain(booking.id);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
