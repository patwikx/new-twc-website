/**
 * Property-Based Tests for Token Generation Security
 * 
 * Feature: guest-booking-lookup
 * Property 4: Token Generation Security
 * 
 * For any generated lookup token, the token has at least 256 bits of entropy
 * and is generated using a cryptographically secure random number generator.
 * 
 * **Validates: Requirements 4.1**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { generateRawToken, hashToken } from "../lookup-token";

describe("Property 4: Token Generation Security", () => {
  /**
   * Property 4.1: Token has sufficient length for 256 bits of entropy
   * Base64url encoding: 32 bytes = 43 characters (256 bits)
   */
  it("should generate tokens with at least 256 bits of entropy (43 base64url chars)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), () => {
        const token = generateRawToken();
        
        // Base64url encoding of 32 bytes produces 43 characters
        // (32 * 8 / 6 = 42.67, rounded up to 43)
        expect(token.length).toBeGreaterThanOrEqual(43);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.2: Tokens are URL-safe (base64url format)
   * Should only contain alphanumeric characters, hyphens, and underscores
   */
  it("should generate URL-safe tokens", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), () => {
        const token = generateRawToken();
        
        // Base64url alphabet: A-Z, a-z, 0-9, -, _
        const base64urlRegex = /^[A-Za-z0-9_-]+$/;
        expect(token).toMatch(base64urlRegex);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.3: Generated tokens are unique
   * Multiple calls should produce different tokens
   */
  it("should generate unique tokens on each call", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 50 }), (count) => {
        const tokens = new Set<string>();
        
        for (let i = 0; i < count; i++) {
          tokens.add(generateRawToken());
        }
        
        // All tokens should be unique
        expect(tokens.size).toBe(count);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.4: Token hash is deterministic
   * Same token should always produce the same hash
   */
  it("should produce deterministic hashes", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (input) => {
        const hash1 = hashToken(input);
        const hash2 = hashToken(input);
        
        expect(hash1).toBe(hash2);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.5: Token hash is SHA-256 format (64 hex characters)
   */
  it("should produce SHA-256 hashes (64 hex characters)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), () => {
        const token = generateRawToken();
        const hash = hashToken(token);
        
        // SHA-256 produces 64 hex characters
        expect(hash.length).toBe(64);
        expect(hash).toMatch(/^[a-f0-9]{64}$/);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.6: Different tokens produce different hashes
   * Hash function should be collision-resistant
   */
  it("should produce different hashes for different tokens", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 50 }), (count) => {
        const hashes = new Set<string>();
        
        for (let i = 0; i < count; i++) {
          const token = generateRawToken();
          hashes.add(hashToken(token));
        }
        
        // All hashes should be unique
        expect(hashes.size).toBe(count);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.7: Token entropy distribution
   * Tokens should have good character distribution (no obvious patterns)
   */
  it("should have good character distribution in tokens", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), () => {
        const token = generateRawToken();
        
        // Count unique characters - should have reasonable diversity
        const uniqueChars = new Set(token.split(""));
        
        // With 43+ characters from a 64-character alphabet,
        // we expect at least 15 unique characters on average
        expect(uniqueChars.size).toBeGreaterThanOrEqual(10);
      }),
      { numRuns: 100 }
    );
  });
});
