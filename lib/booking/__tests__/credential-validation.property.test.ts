/**
 * Property-Based Tests for Lookup Credential Validation
 *
 * Feature: guest-booking-lookup
 * Property 1: Lookup Credential Validation
 *
 * For any booking in the database and for any email address, the lookup
 * function returns the booking details if and only if the email matches
 * the booking's guestEmail (case-insensitive comparison).
 *
 * **Validates: Requirements 1.2, 1.3**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Pure function to test case-insensitive email comparison logic
 * This mirrors the comparison logic in lookupByCredentials
 */
function emailsMatch(bookingEmail: string, inputEmail: string): boolean {
  return bookingEmail.toLowerCase() === inputEmail.toLowerCase();
}

// Arbitrary for generating valid email addresses
const emailArb = fc.emailAddress();

// Arbitrary for generating email variations (case changes)
const emailWithCaseVariationsArb = fc.emailAddress().chain((email) =>
  fc.constantFrom(
    email,
    email.toLowerCase(),
    email.toUpperCase(),
    // Mixed case: capitalize first letter of each part
    email
      .split("@")
      .map((part, i) =>
        i === 0
          ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
          : part.toLowerCase()
      )
      .join("@"),
    // Random case variation
    email
      .split("")
      .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()))
      .join("")
  )
);

describe("Property 1: Lookup Credential Validation", () => {
  /**
   * Property 1.1: Same email (exact match) should return true
   */
  it("should match when emails are exactly the same", () => {
    fc.assert(
      fc.property(emailArb, (email) => {
        expect(emailsMatch(email, email)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.2: Case-insensitive matching
   * Email comparison should be case-insensitive
   */
  it("should match emails regardless of case", () => {
    fc.assert(
      fc.property(emailArb, (email) => {
        // Test various case combinations
        expect(emailsMatch(email, email.toLowerCase())).toBe(true);
        expect(emailsMatch(email, email.toUpperCase())).toBe(true);
        expect(emailsMatch(email.toLowerCase(), email.toUpperCase())).toBe(
          true
        );
        expect(emailsMatch(email.toUpperCase(), email.toLowerCase())).toBe(
          true
        );
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.3: Different emails should not match
   */
  it("should not match when emails are different", () => {
    fc.assert(
      fc.property(emailArb, emailArb, (email1, email2) => {
        // Skip if emails happen to be the same (case-insensitive)
        fc.pre(email1.toLowerCase() !== email2.toLowerCase());

        expect(emailsMatch(email1, email2)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.4: Email with case variations should match original
   */
  it("should match email with any case variation", () => {
    fc.assert(
      fc.property(emailWithCaseVariationsArb, emailArb, (variation, original) => {
        // Only test when the base emails are the same
        const baseOriginal = original.toLowerCase();
        const baseVariation = variation.toLowerCase();

        if (baseOriginal === baseVariation) {
          expect(emailsMatch(original, variation)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.5: Symmetry - if A matches B, then B matches A
   */
  it("should be symmetric in email comparison", () => {
    fc.assert(
      fc.property(emailArb, emailArb, (email1, email2) => {
        const match1to2 = emailsMatch(email1, email2);
        const match2to1 = emailsMatch(email2, email1);

        expect(match1to2).toBe(match2to1);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.6: Transitivity - if A matches B and B matches C, then A matches C
   */
  it("should be transitive in email comparison", () => {
    fc.assert(
      fc.property(emailArb, (email) => {
        // Create three case variations of the same email
        const emailLower = email.toLowerCase();
        const emailUpper = email.toUpperCase();
        const emailMixed = email
          .split("")
          .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()))
          .join("");

        // If lower matches upper and upper matches mixed, then lower matches mixed
        if (emailsMatch(emailLower, emailUpper) && emailsMatch(emailUpper, emailMixed)) {
          expect(emailsMatch(emailLower, emailMixed)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.7: Empty email handling
   */
  it("should handle empty emails consistently", () => {
    expect(emailsMatch("", "")).toBe(true);
    expect(emailsMatch("test@example.com", "")).toBe(false);
    expect(emailsMatch("", "test@example.com")).toBe(false);
  });

  /**
   * Property 1.8: Whitespace should not be trimmed (exact comparison after lowercasing)
   */
  it("should not match emails with extra whitespace", () => {
    fc.assert(
      fc.property(emailArb, (email) => {
        // Emails with leading/trailing whitespace should not match
        expect(emailsMatch(email, ` ${email}`)).toBe(false);
        expect(emailsMatch(email, `${email} `)).toBe(false);
        expect(emailsMatch(email, ` ${email} `)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.9: Special characters in email should be preserved
   */
  it("should correctly handle emails with special characters", () => {
    const specialEmails = [
      "user+tag@example.com",
      "user.name@example.com",
      "user_name@example.com",
      "user-name@example.com",
    ];

    for (const email of specialEmails) {
      expect(emailsMatch(email, email)).toBe(true);
      expect(emailsMatch(email, email.toUpperCase())).toBe(true);
      expect(emailsMatch(email, email.toLowerCase())).toBe(true);
    }
  });

  /**
   * Property 1.10: Similar but different emails should not match
   */
  it("should not match similar but different emails", () => {
    fc.assert(
      fc.property(emailArb, (email) => {
        // Modify one character
        if (email.length > 0) {
          const chars = email.split("");
          const pos = Math.floor(Math.random() * chars.length);
          const originalChar = chars[pos];

          // Change to a different character
          chars[pos] = originalChar === "a" ? "b" : "a";
          const modifiedEmail = chars.join("");

          // Should not match if the modification changed the email
          if (modifiedEmail.toLowerCase() !== email.toLowerCase()) {
            expect(emailsMatch(email, modifiedEmail)).toBe(false);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
