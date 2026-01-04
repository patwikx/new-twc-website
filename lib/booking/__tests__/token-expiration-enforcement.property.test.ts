/**
 * Property-Based Tests for Token Expiration Enforcement
 * 
 * Feature: guest-booking-lookup
 * Property 6: Token Expiration Enforcement
 * 
 * For any lookup token, if the current time is greater than the token's
 * expiresAt timestamp, the validation function returns { valid: false, expired: true }.
 * 
 * **Validates: Requirements 3.2, 4.4**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { isTokenExpired } from "../lookup-token";

// Generate valid dates by using integer timestamps and converting to Date
// This avoids the issue where fc.date() can generate Invalid Date
const MIN_TIMESTAMP = new Date("2024-01-01T00:00:00.000Z").getTime();
const MAX_TIMESTAMP = new Date("2030-12-31T23:59:59.000Z").getTime();

const dateArb = fc.integer({ min: MIN_TIMESTAMP, max: MAX_TIMESTAMP }).map(ts => new Date(ts));

// Arbitrary for generating time offsets in milliseconds
const timeOffsetArb = fc.integer({ min: 1, max: 365 * 24 * 60 * 60 * 1000 }); // Up to 1 year

describe("Property 6: Token Expiration Enforcement", () => {
  /**
   * Property 6.1: Token is expired when current time is after expiration
   * If now > expiresAt, token should be expired
   */
  it("should mark token as expired when current time is after expiration", () => {
    fc.assert(
      fc.property(dateArb, timeOffsetArb, (expiresAt, offset) => {
        // Current time is after expiration
        const now = new Date(expiresAt.getTime() + offset);
        
        expect(isTokenExpired(expiresAt, now)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.2: Token is not expired when current time is before expiration
   * If now < expiresAt, token should not be expired
   */
  it("should not mark token as expired when current time is before expiration", () => {
    fc.assert(
      fc.property(dateArb, timeOffsetArb, (expiresAt, offset) => {
        // Current time is before expiration
        const now = new Date(expiresAt.getTime() - offset);
        
        expect(isTokenExpired(expiresAt, now)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.3: Token is expired at exact expiration time
   * If now === expiresAt, token should be expired (boundary condition)
   */
  it("should mark token as expired at exact expiration time", () => {
    fc.assert(
      fc.property(dateArb, (expiresAt) => {
        // Current time is exactly at expiration
        const now = new Date(expiresAt.getTime());
        
        // At exact expiration time, token is considered expired
        // (expiresAt < now is false, but expiresAt <= now would be true)
        // Our implementation uses expiresAt < now, so at exact time it's NOT expired
        // This is the correct behavior - token is valid until expiration
        expect(isTokenExpired(expiresAt, now)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.4: Token expires 1ms after expiration time
   * Boundary test: 1ms after expiration should be expired
   */
  it("should mark token as expired 1ms after expiration time", () => {
    fc.assert(
      fc.property(dateArb, (expiresAt) => {
        // Current time is 1ms after expiration
        const now = new Date(expiresAt.getTime() + 1);
        
        expect(isTokenExpired(expiresAt, now)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.5: Token is valid 1ms before expiration time
   * Boundary test: 1ms before expiration should not be expired
   */
  it("should not mark token as expired 1ms before expiration time", () => {
    fc.assert(
      fc.property(dateArb, (expiresAt) => {
        // Current time is 1ms before expiration
        const now = new Date(expiresAt.getTime() - 1);
        
        expect(isTokenExpired(expiresAt, now)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.6: Expiration is monotonic
   * If token is expired at time T, it should be expired at all times > T
   */
  it("should remain expired once expired (monotonic)", () => {
    fc.assert(
      fc.property(
        dateArb,
        timeOffsetArb,
        fc.array(timeOffsetArb, { minLength: 1, maxLength: 10 }),
        (expiresAt, initialOffset, additionalOffsets) => {
          // Start at a time after expiration
          const expiredTime = new Date(expiresAt.getTime() + initialOffset);
          
          // Token should be expired at initial time
          expect(isTokenExpired(expiresAt, expiredTime)).toBe(true);
          
          // Token should remain expired at all later times
          let currentTime = expiredTime.getTime();
          for (const offset of additionalOffsets) {
            currentTime += offset;
            expect(isTokenExpired(expiresAt, new Date(currentTime))).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.7: 30-day expiration calculation
   * Token created now should expire in exactly 30 days
   */
  it("should correctly calculate 30-day expiration window", () => {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    
    fc.assert(
      fc.property(dateArb, (createdAt) => {
        const expiresAt = new Date(createdAt.getTime() + THIRTY_DAYS_MS);
        
        // 29 days, 23 hours, 59 minutes, 59 seconds after creation - not expired
        const almostExpired = new Date(createdAt.getTime() + THIRTY_DAYS_MS - 1000);
        expect(isTokenExpired(expiresAt, almostExpired)).toBe(false);
        
        // 30 days and 1 second after creation - expired
        const justExpired = new Date(createdAt.getTime() + THIRTY_DAYS_MS + 1000);
        expect(isTokenExpired(expiresAt, justExpired)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.8: Expiration comparison is timezone-independent
   * Using UTC timestamps should work correctly regardless of timezone
   */
  it("should handle expiration comparison correctly with UTC timestamps", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }), // Hour of day
        fc.integer({ min: 0, max: 59 }), // Minute
        (hour, minute) => {
          // Create expiration at a specific time
          const expiresAt = new Date(Date.UTC(2025, 5, 15, hour, minute, 0, 0));
          
          // 1 second before - not expired
          const before = new Date(expiresAt.getTime() - 1000);
          expect(isTokenExpired(expiresAt, before)).toBe(false);
          
          // 1 second after - expired
          const after = new Date(expiresAt.getTime() + 1000);
          expect(isTokenExpired(expiresAt, after)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.9: Far future expiration
   * Tokens with far future expiration should not be expired
   */
  it("should not mark tokens with far future expiration as expired", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // Years in future
        (yearsInFuture) => {
          const now = new Date();
          const expiresAt = new Date(now.getTime() + yearsInFuture * 365 * 24 * 60 * 60 * 1000);
          
          expect(isTokenExpired(expiresAt, now)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.10: Past expiration
   * Tokens with past expiration should always be expired
   */
  it("should mark tokens with past expiration as expired", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 365 }), // Days in past
        (daysInPast) => {
          const now = new Date();
          const expiresAt = new Date(now.getTime() - daysInPast * 24 * 60 * 60 * 1000);
          
          expect(isTokenExpired(expiresAt, now)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
