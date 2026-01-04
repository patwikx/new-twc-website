/**
 * Property-Based Tests for Rate Limiting Enforcement
 * 
 * Feature: guest-booking-lookup
 * Property 7: Rate Limiting Enforcement
 * 
 * For any IP address making lookup requests, after 5 failed attempts within
 * a 60-second window, subsequent requests are blocked until the window resets.
 * 
 * **Validates: Requirements 4.5**
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { checkLimit, clearAllLimits, getCurrentCount, resetLimit } from "..";

describe("Property 7: Rate Limiting Enforcement", () => {
  beforeEach(() => {
    // Clear all rate limits before each test
    clearAllLimits();
  });

  /**
   * Property 7.1: Requests within limit are allowed
   * For any identifier, the first N requests (where N <= limit) should be allowed
   */
  it("should allow requests within the limit", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1, max: 5 }),
        async (identifier, requestCount) => {
          clearAllLimits();
          
          for (let i = 0; i < requestCount; i++) {
            const result = await checkLimit(identifier, { limit: 5, windowMs: 60000 });
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(5 - (i + 1));
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.2: Requests exceeding limit are blocked
   * After 5 requests, subsequent requests should be blocked
   */
  it("should block requests after limit is exceeded", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1, max: 10 }),
        async (identifier, extraRequests) => {
          clearAllLimits();
          const limit = 5;
          
          // Make exactly 5 requests (should all be allowed)
          for (let i = 0; i < limit; i++) {
            const result = await checkLimit(identifier, { limit, windowMs: 60000 });
            expect(result.allowed).toBe(true);
          }
          
          // Additional requests should be blocked
          for (let i = 0; i < extraRequests; i++) {
            const result = await checkLimit(identifier, { limit, windowMs: 60000 });
            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.3: Different identifiers have independent limits
   * Rate limiting for one identifier should not affect another
   */
  it("should maintain independent limits per identifier", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        async (id1, id2) => {
          // Ensure identifiers are different
          if (id1 === id2) return;
          
          clearAllLimits();
          const limit = 5;
          
          // Exhaust limit for id1
          for (let i = 0; i < limit; i++) {
            await checkLimit(id1, { limit, windowMs: 60000 });
          }
          
          // id1 should be blocked
          const result1 = await checkLimit(id1, { limit, windowMs: 60000 });
          expect(result1.allowed).toBe(false);
          
          // id2 should still be allowed
          const result2 = await checkLimit(id2, { limit, windowMs: 60000 });
          expect(result2.allowed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.4: Remaining count decreases correctly
   * Each allowed request should decrease remaining by 1
   */
  it("should correctly track remaining attempts", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1, max: 10 }),
        async (identifier, limit) => {
          clearAllLimits();
          
          for (let i = 0; i < limit; i++) {
            const result = await checkLimit(identifier, { limit, windowMs: 60000 });
            expect(result.remaining).toBe(limit - (i + 1));
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.5: Reset clears the limit for an identifier
   * After reset, the identifier should have full limit available
   */
  it("should reset limit for specific identifier", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (identifier) => {
          clearAllLimits();
          const limit = 5;
          
          // Exhaust the limit
          for (let i = 0; i < limit; i++) {
            await checkLimit(identifier, { limit, windowMs: 60000 });
          }
          
          // Should be blocked
          let result = await checkLimit(identifier, { limit, windowMs: 60000 });
          expect(result.allowed).toBe(false);
          
          // Reset the limit
          resetLimit(identifier);
          
          // Should be allowed again
          result = await checkLimit(identifier, { limit, windowMs: 60000 });
          expect(result.allowed).toBe(true);
          expect(result.remaining).toBe(limit - 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.6: getCurrentCount returns accurate count
   * The count should match the number of requests made
   */
  it("should accurately report current request count", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1, max: 10 }),
        async (identifier, requestCount) => {
          clearAllLimits();
          
          // Make some requests
          for (let i = 0; i < requestCount; i++) {
            await checkLimit(identifier, { limit: 10, windowMs: 60000 });
          }
          
          // Count should match requests made
          const count = getCurrentCount(identifier, 60000);
          expect(count).toBe(requestCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.7: Default configuration uses 5 attempts per 60 seconds
   * Verifies the default rate limit configuration
   */
  it("should use default configuration of 5 attempts per 60 seconds", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (identifier) => {
          clearAllLimits();
          
          // Make 5 requests with defaults (should all be allowed)
          for (let i = 0; i < 5; i++) {
            const result = await checkLimit(identifier);
            expect(result.allowed).toBe(true);
          }
          
          // 6th request should be blocked
          const result = await checkLimit(identifier);
          expect(result.allowed).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
