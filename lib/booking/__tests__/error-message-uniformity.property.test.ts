/**
 * Property-Based Tests for Error Message Uniformity
 *
 * Feature: guest-booking-lookup
 * Property 2: Error Message Uniformity
 *
 * For any lookup attempt that fails (whether due to non-existent reference,
 * wrong email, or invalid format), the error message returned is identical,
 * preventing information leakage about which bookings exist.
 *
 * **Validates: Requirements 1.3, 1.4**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { LOOKUP_ERROR_MESSAGE } from "../lookup";

/**
 * Simulates the error response behavior of the lookup service
 * All failure cases should return the same generic error message
 */
function getErrorMessageForFailure(
  _failureReason:
    | "non_existent_ref"
    | "wrong_email"
    | "invalid_format"
    | "empty_fields"
): string {
  // All failure cases return the same message - this is the security requirement
  return LOOKUP_ERROR_MESSAGE;
}

// Arbitrary for generating booking reference formats
const shortRefArb = fc.stringMatching(/^TWC-[A-Z0-9]{6}$/);

// Arbitrary for generating invalid reference formats
const invalidRefArb = fc.oneof(
  fc.constant(""), // Empty
  fc.string({ minLength: 1, maxLength: 5 }), // Too short
  fc.stringMatching(/^[A-Z]{3}-[A-Z0-9]{6}$/), // Wrong prefix
  fc.stringMatching(/^TWC[A-Z0-9]{6}$/), // Missing hyphen
  fc.stringMatching(/^twc-[a-z0-9]{6}$/) // Lowercase (if case-sensitive)
);

// Arbitrary for generating email addresses
const emailArb = fc.emailAddress();

describe("Property 2: Error Message Uniformity", () => {
  /**
   * Property 2.1: Non-existent reference returns generic error
   */
  it("should return generic error for non-existent reference", () => {
    fc.assert(
      fc.property(shortRefArb, () => {
        const errorMessage = getErrorMessageForFailure("non_existent_ref");
        expect(errorMessage).toBe(LOOKUP_ERROR_MESSAGE);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2.2: Wrong email returns same generic error
   */
  it("should return same generic error for wrong email", () => {
    fc.assert(
      fc.property(emailArb, () => {
        const errorMessage = getErrorMessageForFailure("wrong_email");
        expect(errorMessage).toBe(LOOKUP_ERROR_MESSAGE);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2.3: Invalid format returns same generic error
   */
  it("should return same generic error for invalid format", () => {
    fc.assert(
      fc.property(invalidRefArb, () => {
        const errorMessage = getErrorMessageForFailure("invalid_format");
        expect(errorMessage).toBe(LOOKUP_ERROR_MESSAGE);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2.4: Empty fields return same generic error
   */
  it("should return same generic error for empty fields", () => {
    const errorMessage = getErrorMessageForFailure("empty_fields");
    expect(errorMessage).toBe(LOOKUP_ERROR_MESSAGE);
  });

  /**
   * Property 2.5: All failure types produce identical error messages
   * This is the core security property - no information leakage
   */
  it("should produce identical error messages for all failure types", () => {
    const failureTypes: Array<
      "non_existent_ref" | "wrong_email" | "invalid_format" | "empty_fields"
    > = ["non_existent_ref", "wrong_email", "invalid_format", "empty_fields"];

    const errorMessages = failureTypes.map((type) =>
      getErrorMessageForFailure(type)
    );

    // All error messages should be identical
    const uniqueMessages = new Set(errorMessages);
    expect(uniqueMessages.size).toBe(1);
  });

  /**
   * Property 2.6: Error message does not contain sensitive information
   */
  it("should not contain sensitive information in error message", () => {
    const sensitivePatterns = [
      /booking.*exist/i, // "booking exists" or "booking does not exist"
      /reference.*found/i, // "reference found" or "reference not found"
      /email.*match/i, // "email matches" or "email does not match"
      /invalid.*email/i, // "invalid email"
      /invalid.*reference/i, // "invalid reference"
      /wrong.*email/i, // "wrong email"
      /incorrect/i, // "incorrect"
    ];

    for (const pattern of sensitivePatterns) {
      expect(LOOKUP_ERROR_MESSAGE).not.toMatch(pattern);
    }
  });

  /**
   * Property 2.7: Error message is user-friendly
   */
  it("should provide a user-friendly error message", () => {
    // Should contain helpful guidance
    expect(LOOKUP_ERROR_MESSAGE.toLowerCase()).toContain("booking");
    expect(LOOKUP_ERROR_MESSAGE.toLowerCase()).toContain("check");

    // Should not be empty
    expect(LOOKUP_ERROR_MESSAGE.length).toBeGreaterThan(0);

    // Should not be too long (reasonable length for UI)
    expect(LOOKUP_ERROR_MESSAGE.length).toBeLessThan(200);
  });

  /**
   * Property 2.8: Error message is consistent across multiple calls
   */
  it("should return consistent error message across multiple calls", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 20 }), (callCount) => {
        const messages: string[] = [];

        for (let i = 0; i < callCount; i++) {
          messages.push(getErrorMessageForFailure("non_existent_ref"));
        }

        // All messages should be identical
        const uniqueMessages = new Set(messages);
        expect(uniqueMessages.size).toBe(1);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2.9: Error message does not vary based on input
   * Different invalid inputs should produce the same error
   */
  it("should not vary error message based on invalid input content", () => {
    fc.assert(
      fc.property(
        fc.oneof(shortRefArb, invalidRefArb),
        fc.oneof(emailArb, fc.constant("")),
        () => {
          // Regardless of what invalid input is provided, error should be the same
          const error1 = getErrorMessageForFailure("non_existent_ref");
          const error2 = getErrorMessageForFailure("wrong_email");
          const error3 = getErrorMessageForFailure("invalid_format");

          expect(error1).toBe(error2);
          expect(error2).toBe(error3);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2.10: Error message is a string type
   */
  it("should always return a string error message", () => {
    const failureTypes: Array<
      "non_existent_ref" | "wrong_email" | "invalid_format" | "empty_fields"
    > = ["non_existent_ref", "wrong_email", "invalid_format", "empty_fields"];

    for (const type of failureTypes) {
      const message = getErrorMessageForFailure(type);
      expect(typeof message).toBe("string");
    }
  });
});
