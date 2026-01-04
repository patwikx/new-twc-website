/**
 * Property Test: Booking Expiration Timing
 * 
 * Feature: booking-security-enhancements
 * Property 3: Booking Expiration Timing
 * 
 * For any booking in PENDING status with UNPAID payment status,
 * if the booking was created more than 30 minutes ago,
 * the Expiration_Service SHALL mark it as CANCELLED with EXPIRED payment status.
 * 
 * Validates: Requirements 6.1, 6.2
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

describe("Feature: booking-security-enhancements, Property 3: Booking Expiration Timing", () => {
  
  describe("calculateExpirationCutoff", () => {
    it("should return a date 30 minutes before the given time", () => {
      fc.assert(
        fc.property(
          // Generate timestamps within a reasonable range (year 2020-2030)
          fc.integer({ min: 1577836800000, max: 1893456000000 }),
          (timestamp) => {
            const now = new Date(timestamp);
            const cutoff = calculateExpirationCutoff(now);
            
            const expectedCutoff = new Date(timestamp - EXPIRATION_THRESHOLD_MS);
            expect(cutoff.getTime()).toBe(expectedCutoff.getTime());
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should support custom threshold", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1577836800000, max: 1893456000000 }),
          fc.integer({ min: 1000, max: 3600000 }), // 1 second to 1 hour
          (timestamp, thresholdMs) => {
            const now = new Date(timestamp);
            const cutoff = calculateExpirationCutoff(now, thresholdMs);
            
            const expectedCutoff = new Date(timestamp - thresholdMs);
            expect(cutoff.getTime()).toBe(expectedCutoff.getTime());
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("isEligibleForExpiration", () => {
    it("should expire PENDING/UNPAID bookings older than 30 minutes", () => {
      fc.assert(
        fc.property(
          // Generate a "now" timestamp
          fc.integer({ min: 1577836800000 + EXPIRATION_THRESHOLD_MS + 1000, max: 1893456000000 }),
          // Generate minutes past threshold (31-120 minutes old)
          fc.integer({ min: 31, max: 120 }),
          (nowTimestamp, minutesOld) => {
            const now = new Date(nowTimestamp);
            const cutoff = calculateExpirationCutoff(now);
            
            // Create a booking older than the threshold
            const createdAt = new Date(nowTimestamp - minutesOld * 60 * 1000);
            
            const booking = {
              status: "PENDING",
              paymentStatus: "UNPAID",
              createdAt
            };
            
            expect(isEligibleForExpiration(booking, cutoff)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should NOT expire PENDING/UNPAID bookings younger than 30 minutes", () => {
      fc.assert(
        fc.property(
          // Generate a "now" timestamp
          fc.integer({ min: 1577836800000, max: 1893456000000 }),
          // Generate minutes under threshold (0-29 minutes old)
          fc.integer({ min: 0, max: 29 }),
          (nowTimestamp, minutesOld) => {
            const now = new Date(nowTimestamp);
            const cutoff = calculateExpirationCutoff(now);
            
            // Create a booking younger than the threshold
            const createdAt = new Date(nowTimestamp - minutesOld * 60 * 1000);
            
            const booking = {
              status: "PENDING",
              paymentStatus: "UNPAID",
              createdAt
            };
            
            expect(isEligibleForExpiration(booking, cutoff)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should NOT expire non-PENDING bookings regardless of age", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1577836800000 + EXPIRATION_THRESHOLD_MS + 1000, max: 1893456000000 }),
          fc.integer({ min: 31, max: 120 }),
          fc.constantFrom("CONFIRMED", "CANCELLED", "COMPLETED"),
          (nowTimestamp, minutesOld, status) => {
            const now = new Date(nowTimestamp);
            const cutoff = calculateExpirationCutoff(now);
            const createdAt = new Date(nowTimestamp - minutesOld * 60 * 1000);
            
            const booking = {
              status,
              paymentStatus: "UNPAID",
              createdAt
            };
            
            expect(isEligibleForExpiration(booking, cutoff)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should NOT expire non-UNPAID bookings regardless of age", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1577836800000 + EXPIRATION_THRESHOLD_MS + 1000, max: 1893456000000 }),
          fc.integer({ min: 31, max: 120 }),
          fc.constantFrom("PAID", "PARTIALLY_PAID", "REFUNDED", "FAILED"),
          (nowTimestamp, minutesOld, paymentStatus) => {
            const now = new Date(nowTimestamp);
            const cutoff = calculateExpirationCutoff(now);
            const createdAt = new Date(nowTimestamp - minutesOld * 60 * 1000);
            
            const booking = {
              status: "PENDING",
              paymentStatus,
              createdAt
            };
            
            expect(isEligibleForExpiration(booking, cutoff)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should handle exact boundary (exactly 30 minutes old)", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1577836800000 + EXPIRATION_THRESHOLD_MS, max: 1893456000000 }),
          (nowTimestamp) => {
            const now = new Date(nowTimestamp);
            const cutoff = calculateExpirationCutoff(now);
            
            // Exactly at the cutoff - should NOT be expired (< not <=)
            const createdAtExact = new Date(nowTimestamp - EXPIRATION_THRESHOLD_MS);
            
            const bookingExact = {
              status: "PENDING",
              paymentStatus: "UNPAID",
              createdAt: createdAtExact
            };
            
            // At exactly 30 minutes, createdAt equals cutoff, so not eligible
            expect(isEligibleForExpiration(bookingExact, cutoff)).toBe(false);
            
            // 1ms older than cutoff - should be expired
            const createdAtOlder = new Date(nowTimestamp - EXPIRATION_THRESHOLD_MS - 1);
            
            const bookingOlder = {
              status: "PENDING",
              paymentStatus: "UNPAID",
              createdAt: createdAtOlder
            };
            
            expect(isEligibleForExpiration(bookingOlder, cutoff)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe("filterEligibleBookings", () => {
    it("should filter only eligible bookings from a mixed list", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1577836800000 + EXPIRATION_THRESHOLD_MS + 60000, max: 1893456000000 }),
          fc.array(
            fc.record({
              id: fc.uuid(),
              status: fc.constantFrom("PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"),
              paymentStatus: fc.constantFrom("UNPAID", "PAID", "PARTIALLY_PAID", "REFUNDED", "FAILED"),
              // Minutes old: 0-120
              minutesOld: fc.integer({ min: 0, max: 120 })
            }),
            { minLength: 1, maxLength: 20 }
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
            
            // Verify each eligible booking meets all criteria
            for (const id of eligibleIds) {
              const booking = bookings.find(b => b.id === id)!;
              expect(booking.status).toBe("PENDING");
              expect(booking.paymentStatus).toBe("UNPAID");
              expect(booking.createdAt.getTime()).toBeLessThan(cutoff.getTime());
            }
            
            // Verify no ineligible booking was included
            for (const booking of bookings) {
              if (!eligibleIds.includes(booking.id)) {
                const shouldBeEligible = 
                  booking.status === "PENDING" &&
                  booking.paymentStatus === "UNPAID" &&
                  booking.createdAt < cutoff;
                expect(shouldBeEligible).toBe(false);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
