/**
 * Property-Based Tests for Rate Limiting with Endpoint Prefixes
 * 
 * Feature: booking-security-enhancements
 * Property 1: Rate Limiting Enforcement
 * Validates: Requirements 1.1, 1.2, 2.1, 2.2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { checkLimit, clearAllLimits, getCurrentCount } from '../index';

describe('Property 1: Rate Limiting Enforcement', () => {
  beforeEach(() => {
    clearAllLimits();
  });

  /**
   * For any IP address making requests to a rate-limited endpoint,
   * if the number of requests within the time window exceeds the configured limit,
   * all subsequent requests SHALL be rejected until the window resets.
   */
  it('should reject requests exceeding the limit for any IP', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.ipV4(), // Random IP address
        fc.integer({ min: 1, max: 10 }), // Random limit
        async (ip, limit) => {
          clearAllLimits();
          
          // Make exactly `limit` requests - all should be allowed
          for (let i = 0; i < limit; i++) {
            const result = await checkLimit(ip, { limit, windowMs: 60000 });
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(limit - i - 1);
          }
          
          // The next request should be rejected
          const rejectedResult = await checkLimit(ip, { limit, windowMs: 60000 });
          expect(rejectedResult.allowed).toBe(false);
          expect(rejectedResult.remaining).toBe(0);
          expect(rejectedResult.retryAfter).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should track requests separately by keyPrefix', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.ipV4(),
        fc.constantFrom('checkout', 'newsletter', 'contact', 'booking'),
        async (ip, prefix) => {
          clearAllLimits();
          const limit = 3;
          
          // Make requests with the prefix
          for (let i = 0; i < limit; i++) {
            const result = await checkLimit(ip, { limit, windowMs: 60000, keyPrefix: prefix });
            expect(result.allowed).toBe(true);
          }
          
          // Should be blocked with this prefix
          const blockedResult = await checkLimit(ip, { limit, windowMs: 60000, keyPrefix: prefix });
          expect(blockedResult.allowed).toBe(false);
          
          // But should be allowed with a different prefix
          const differentPrefix = prefix === 'checkout' ? 'newsletter' : 'checkout';
          const allowedResult = await checkLimit(ip, { limit, windowMs: 60000, keyPrefix: differentPrefix });
          expect(allowedResult.allowed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return retryAfter when blocked', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.ipV4(),
        async (ip) => {
          clearAllLimits();
          const limit = 3;
          const windowMs = 60000;
          
          // Exhaust the limit
          for (let i = 0; i < limit; i++) {
            await checkLimit(ip, { limit, windowMs });
          }
          
          // Check that retryAfter is returned and is reasonable
          const result = await checkLimit(ip, { limit, windowMs });
          expect(result.allowed).toBe(false);
          expect(result.retryAfter).toBeDefined();
          expect(result.retryAfter).toBeGreaterThan(0);
          expect(result.retryAfter).toBeLessThanOrEqual(60); // Should be within window
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow requests from different IPs independently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.ipV4(),
        fc.ipV4().filter(ip2 => true), // Second IP
        async (ip1, ip2) => {
          // Skip if IPs are the same
          if (ip1 === ip2) return;
          
          clearAllLimits();
          const limit = 3;
          
          // Exhaust limit for ip1
          for (let i = 0; i < limit; i++) {
            await checkLimit(ip1, { limit, windowMs: 60000 });
          }
          
          // ip1 should be blocked
          const ip1Result = await checkLimit(ip1, { limit, windowMs: 60000 });
          expect(ip1Result.allowed).toBe(false);
          
          // ip2 should still be allowed
          const ip2Result = await checkLimit(ip2, { limit, windowMs: 60000 });
          expect(ip2Result.allowed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
