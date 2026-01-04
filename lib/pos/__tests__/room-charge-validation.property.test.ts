/**
 * Property-Based Tests for Room Charge Booking Validation
 * 
 * Feature: enterprise-gaps
 * Property 10: Room Charge Booking Validation
 * 
 * For any room charge payment, the associated booking SHALL have status CONFIRMED 
 * and the guest SHALL be authorized for room charges.
 * 
 * **Validates: Requirements 8.1, 8.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateBookingForRoomChargePure } from '../payment';
import { BookingStatus } from '@prisma/client';

// All booking statuses
const allBookingStatuses: BookingStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED",
];

// Non-confirmed booking statuses
const nonConfirmedStatuses: BookingStatus[] = [
  "PENDING",
  "CANCELLED",
  "COMPLETED",
];

// Arbitrary for booking status
const bookingStatusArb = fc.constantFrom(...allBookingStatuses);

// Arbitrary for non-confirmed booking status
const nonConfirmedStatusArb = fc.constantFrom(...nonConfirmedStatuses);

// Arbitrary for guest authorization
const guestAuthorizedArb = fc.boolean();

describe('Property 10: Room Charge Booking Validation', () => {
  /**
   * Property 10.1: CONFIRMED bookings with authorized guests are valid
   * Requirement 8.1, 8.2: Booking must be CONFIRMED and guest must be authorized
   */
  it('should accept CONFIRMED bookings with authorized guests', () => {
    fc.assert(
      fc.property(
        fc.constant("CONFIRMED" as BookingStatus),
        fc.constant(true),
        (status, authorized) => {
          const result = validateBookingForRoomChargePure(status, authorized);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.2: Non-CONFIRMED bookings are rejected
   * Requirement 8.1: Booking must be CONFIRMED for room charges
   */
  it('should reject non-CONFIRMED bookings regardless of authorization', () => {
    fc.assert(
      fc.property(
        nonConfirmedStatusArb,
        guestAuthorizedArb,
        (status, authorized) => {
          const result = validateBookingForRoomChargePure(status, authorized);
          expect(result.valid).toBe(false);
          expect(result.error).toContain("Booking must be confirmed");
          expect(result.error).toContain(status);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.3: Unauthorized guests are rejected even with CONFIRMED booking
   * Requirement 8.2: Guest must be authorized for room charges
   */
  it('should reject unauthorized guests even with CONFIRMED booking', () => {
    fc.assert(
      fc.property(
        fc.constant("CONFIRMED" as BookingStatus),
        fc.constant(false),
        (status, authorized) => {
          const result = validateBookingForRoomChargePure(status, authorized);
          expect(result.valid).toBe(false);
          expect(result.error).toBe("Guest is not authorized for room charges");
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.4: PENDING bookings are always rejected
   * Requirement 8.1: Only CONFIRMED bookings can have room charges
   */
  it('should always reject PENDING bookings', () => {
    fc.assert(
      fc.property(
        fc.constant("PENDING" as BookingStatus),
        guestAuthorizedArb,
        (status, authorized) => {
          const result = validateBookingForRoomChargePure(status, authorized);
          expect(result.valid).toBe(false);
          expect(result.error).toContain("PENDING");
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.5: CANCELLED bookings are always rejected
   * Requirement 8.1: Only CONFIRMED bookings can have room charges
   */
  it('should always reject CANCELLED bookings', () => {
    fc.assert(
      fc.property(
        fc.constant("CANCELLED" as BookingStatus),
        guestAuthorizedArb,
        (status, authorized) => {
          const result = validateBookingForRoomChargePure(status, authorized);
          expect(result.valid).toBe(false);
          expect(result.error).toContain("CANCELLED");
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.6: COMPLETED bookings are always rejected
   * Requirement 8.1: Only CONFIRMED (active) bookings can have room charges
   */
  it('should always reject COMPLETED bookings', () => {
    fc.assert(
      fc.property(
        fc.constant("COMPLETED" as BookingStatus),
        guestAuthorizedArb,
        (status, authorized) => {
          const result = validateBookingForRoomChargePure(status, authorized);
          expect(result.valid).toBe(false);
          expect(result.error).toContain("COMPLETED");
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.7: Validation result is deterministic
   * Same inputs should always produce same outputs
   */
  it('should produce deterministic results for same inputs', () => {
    fc.assert(
      fc.property(
        bookingStatusArb,
        guestAuthorizedArb,
        (status, authorized) => {
          const result1 = validateBookingForRoomChargePure(status, authorized);
          const result2 = validateBookingForRoomChargePure(status, authorized);
          
          expect(result1.valid).toBe(result2.valid);
          expect(result1.error).toBe(result2.error);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.8: Error message contains status for non-CONFIRMED bookings
   * Helps with debugging and user feedback
   */
  it('should include booking status in error message for non-CONFIRMED bookings', () => {
    fc.assert(
      fc.property(
        nonConfirmedStatusArb,
        (status) => {
          const result = validateBookingForRoomChargePure(status, true);
          expect(result.valid).toBe(false);
          expect(result.error).toContain(status);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.9: Only CONFIRMED status passes the status check
   * Exhaustive check that only CONFIRMED is valid
   */
  it('should only accept CONFIRMED as valid status', () => {
    fc.assert(
      fc.property(
        bookingStatusArb,
        (status) => {
          const result = validateBookingForRoomChargePure(status, true);
          
          if (status === "CONFIRMED") {
            expect(result.valid).toBe(true);
          } else {
            expect(result.valid).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10.10: Both conditions must be met for valid result
   * CONFIRMED status AND authorized guest required
   */
  it('should require both CONFIRMED status and guest authorization', () => {
    fc.assert(
      fc.property(
        bookingStatusArb,
        guestAuthorizedArb,
        (status, authorized) => {
          const result = validateBookingForRoomChargePure(status, authorized);
          
          const shouldBeValid = status === "CONFIRMED" && authorized;
          expect(result.valid).toBe(shouldBeValid);
        }
      ),
      { numRuns: 100 }
    );
  });
});
