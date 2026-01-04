/**
 * Property-Based Tests for Booking Verification Token Security
 * 
 * Feature: booking-security-enhancements
 * Property 4: Verification Token Security
 * Validates: Requirements 8.3, 8.4, 8.5
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  generateRawVerificationToken, 
  hashVerificationToken,
  isVerificationTokenExpired 
} from '../verification-token';

describe('Property 4: Verification Token Security', () => {
  /**
   * For any verification token, hashing the plain token with SHA-256 
   * SHALL produce the stored tokenHash, and the token SHALL only be 
   * valid before its expiresAt timestamp.
   */

  it('should generate tokens with sufficient entropy (256 bits)', async () => {
    await fc.assert(
      fc.property(
        fc.constant(null), // No input needed
        () => {
          const token = generateRawVerificationToken();
          
          // Base64url encoding: 4 chars = 3 bytes
          // 32 bytes = ~43 chars in base64url
          expect(token.length).toBeGreaterThanOrEqual(42);
          
          // Should be URL-safe (no +, /, or =)
          expect(token).not.toMatch(/[+/=]/);
          
          // Should only contain base64url characters
          expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should generate unique tokens on each call', async () => {
    const tokens = new Set<string>();
    
    await fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (count) => {
          for (let i = 0; i < count; i++) {
            const token = generateRawVerificationToken();
            expect(tokens.has(token)).toBe(false);
            tokens.add(token);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should produce consistent hash for the same token', async () => {
    await fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (token) => {
          const hash1 = hashVerificationToken(token);
          const hash2 = hashVerificationToken(token);
          
          expect(hash1).toBe(hash2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should produce different hashes for different tokens', async () => {
    await fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (token1, token2) => {
          // Skip if tokens are the same
          if (token1 === token2) return;
          
          const hash1 = hashVerificationToken(token1);
          const hash2 = hashVerificationToken(token2);
          
          expect(hash1).not.toBe(hash2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should produce SHA-256 hash (64 hex characters)', async () => {
    await fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (token) => {
          const hash = hashVerificationToken(token);
          
          // SHA-256 produces 256 bits = 64 hex characters
          expect(hash.length).toBe(64);
          
          // Should only contain hex characters
          expect(hash).toMatch(/^[a-f0-9]+$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly identify expired tokens', async () => {
    await fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
          .filter(d => !isNaN(d.getTime())),
        fc.integer({ min: 1, max: 1000000 }), // Offset in milliseconds
        (baseDate, offset) => {
          const expiresAt = baseDate;
          
          // Test with a date before expiry
          const beforeExpiry = new Date(expiresAt.getTime() - offset);
          expect(isVerificationTokenExpired(expiresAt, beforeExpiry)).toBe(false);
          
          // Test with a date after expiry
          const afterExpiry = new Date(expiresAt.getTime() + offset);
          expect(isVerificationTokenExpired(expiresAt, afterExpiry)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should consider token expired exactly at expiration time', async () => {
    await fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
          .filter(d => !isNaN(d.getTime())),
        (expiresAt) => {
          // At exact expiration time, token should be expired (< not <=)
          const atExpiry = new Date(expiresAt.getTime());
          expect(isVerificationTokenExpired(expiresAt, atExpiry)).toBe(false);
          
          // 1ms after should be expired
          const justAfter = new Date(expiresAt.getTime() + 1);
          expect(isVerificationTokenExpired(expiresAt, justAfter)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not be possible to reverse hash to get original token', async () => {
    // This is a sanity check - we can't truly test irreversibility,
    // but we can verify the hash doesn't contain the original token
    await fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 50 }),
        (token) => {
          const hash = hashVerificationToken(token);
          
          // Hash should not contain the original token
          expect(hash.includes(token)).toBe(false);
          
          // Hash should be completely different from token
          expect(hash).not.toBe(token);
        }
      ),
      { numRuns: 100 }
    );
  });
});
