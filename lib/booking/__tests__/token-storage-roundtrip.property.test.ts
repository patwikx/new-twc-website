/**
 * Property-Based Tests for Token Storage Round-Trip
 * 
 * Feature: guest-booking-lookup
 * Property 5: Token Storage Round-Trip
 * 
 * For any generated token, hashing the token and storing it, then later
 * validating the same plain token against the stored hash, returns a
 * successful validation result.
 * 
 * **Validates: Requirements 4.2, 4.3**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { generateRawToken, hashToken } from "../lookup-token";

describe("Property 5: Token Storage Round-Trip", () => {
  /**
   * Property 5.1: Hash then compare round-trip
   * Hashing a token and comparing with the same token's hash should match
   */
  it("should match when comparing token hash with same token", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), () => {
        const token = generateRawToken();
        const storedHash = hashToken(token);
        
        // Simulate validation: hash the token again and compare
        const validationHash = hashToken(token);
        
        expect(validationHash).toBe(storedHash);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.2: Different tokens produce different hashes (no false positives)
   * A different token should not match the stored hash
   */
  it("should not match when comparing with different token", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), () => {
        const originalToken = generateRawToken();
        const differentToken = generateRawToken();
        
        // Ensure tokens are different (extremely unlikely to be same)
        fc.pre(originalToken !== differentToken);
        
        const storedHash = hashToken(originalToken);
        const validationHash = hashToken(differentToken);
        
        expect(validationHash).not.toBe(storedHash);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.3: Hash is consistent across multiple calls
   * The same token should always produce the same hash
   */
  it("should produce consistent hash across multiple calls", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 10 }), (callCount) => {
        const token = generateRawToken();
        const hashes: string[] = [];
        
        for (let i = 0; i < callCount; i++) {
          hashes.push(hashToken(token));
        }
        
        // All hashes should be identical
        const uniqueHashes = new Set(hashes);
        expect(uniqueHashes.size).toBe(1);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.4: Token modification breaks validation
   * Any modification to the token should produce a different hash
   */
  it("should fail validation when token is modified", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 42 }), // Position to modify (token is 43 chars)
        () => {
          const token = generateRawToken();
          const storedHash = hashToken(token);
          
          // Modify one character in the token
          const chars = token.split("");
          const position = Math.floor(Math.random() * chars.length);
          const originalChar = chars[position];
          
          // Change to a different character
          const base64urlChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
          let newChar = originalChar;
          while (newChar === originalChar) {
            newChar = base64urlChars[Math.floor(Math.random() * base64urlChars.length)];
          }
          chars[position] = newChar;
          
          const modifiedToken = chars.join("");
          const modifiedHash = hashToken(modifiedToken);
          
          expect(modifiedHash).not.toBe(storedHash);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.5: Empty string handling
   * Hash function should handle edge cases consistently
   */
  it("should handle empty and whitespace strings consistently", () => {
    const emptyHash1 = hashToken("");
    const emptyHash2 = hashToken("");
    
    expect(emptyHash1).toBe(emptyHash2);
    expect(emptyHash1.length).toBe(64); // SHA-256 always produces 64 hex chars
  });

  /**
   * Property 5.6: Hash is case-sensitive
   * Different case should produce different hash
   */
  it("should produce different hashes for different case", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.toLowerCase() !== s.toUpperCase()),
        (input) => {
          const lowerHash = hashToken(input.toLowerCase());
          const upperHash = hashToken(input.toUpperCase());
          
          // Only test if case actually differs
          if (input.toLowerCase() !== input.toUpperCase()) {
            expect(lowerHash).not.toBe(upperHash);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.7: Hash uniqueness for similar tokens
   * Tokens that differ by only one character should have completely different hashes
   */
  it("should produce completely different hashes for similar tokens", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 50 }), () => {
        const token1 = generateRawToken();
        
        // Create a token that differs by one character
        const chars = token1.split("");
        const base64urlChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        let newChar = chars[0];
        while (newChar === chars[0]) {
          newChar = base64urlChars[Math.floor(Math.random() * base64urlChars.length)];
        }
        chars[0] = newChar;
        const token2 = chars.join("");
        
        const hash1 = hashToken(token1);
        const hash2 = hashToken(token2);
        
        // Hashes should be completely different (avalanche effect)
        // Count differing characters - should be roughly half
        let diffCount = 0;
        for (let i = 0; i < hash1.length; i++) {
          if (hash1[i] !== hash2[i]) diffCount++;
        }
        
        // SHA-256 avalanche effect: ~50% of bits should differ
        // With 64 hex chars, we expect ~32 different chars on average
        // Allow some variance: at least 20 should differ
        expect(diffCount).toBeGreaterThanOrEqual(20);
      }),
      { numRuns: 100 }
    );
  });
});
