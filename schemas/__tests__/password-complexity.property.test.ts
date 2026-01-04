/**
 * Property-Based Tests for Password Complexity Enforcement
 * 
 * Feature: booking-security-enhancements
 * Property 5: Password Complexity Enforcement
 * 
 * For any password string, the Password_Validator SHALL reject it if it does not
 * contain at least 8 characters, one uppercase letter, one lowercase letter, and one number.
 * 
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  validatePassword,
  meetsMinLength,
  hasUppercase,
  hasLowercase,
  hasNumber,
  PASSWORD_ERRORS,
} from "../password";

// Character sets for generating specific password types
const LOWERCASE_CHARS = 'abcdefghijklmnopqrstuvwxyz';
const UPPERCASE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMBER_CHARS = '0123456789';
const ALL_CHARS = LOWERCASE_CHARS + UPPERCASE_CHARS + NUMBER_CHARS;

// Helper to generate string from character set
const stringFromChars = (chars: string, minLength: number, maxLength: number) =>
  fc.array(fc.constantFrom(...chars.split('')), { minLength, maxLength })
    .map(arr => arr.join(''));

describe("Property 5: Password Complexity Enforcement", () => {
  /**
   * Property 5.1: Passwords shorter than 8 characters are rejected
   */
  it("should reject passwords shorter than 8 characters", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 7 }),
        (password) => {
          const result = validatePassword(password);
          expect(result.valid).toBe(false);
          expect(result.errors).toContain(PASSWORD_ERRORS.MIN_LENGTH);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.2: Passwords without uppercase letters are rejected
   */
  it("should reject passwords without uppercase letters", () => {
    // Generate passwords with only lowercase and numbers (no uppercase)
    const noUppercaseArb = stringFromChars(LOWERCASE_CHARS + NUMBER_CHARS, 8, 20);

    fc.assert(
      fc.property(noUppercaseArb, (password) => {
        const result = validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(PASSWORD_ERRORS.UPPERCASE);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.3: Passwords without lowercase letters are rejected
   */
  it("should reject passwords without lowercase letters", () => {
    // Generate passwords with only uppercase and numbers (no lowercase)
    const noLowercaseArb = stringFromChars(UPPERCASE_CHARS + NUMBER_CHARS, 8, 20);

    fc.assert(
      fc.property(noLowercaseArb, (password) => {
        const result = validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(PASSWORD_ERRORS.LOWERCASE);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.4: Passwords without numbers are rejected
   */
  it("should reject passwords without numbers", () => {
    // Generate passwords with only letters (no numbers)
    const noNumberArb = stringFromChars(LOWERCASE_CHARS + UPPERCASE_CHARS, 8, 20);

    fc.assert(
      fc.property(noNumberArb, (password) => {
        const result = validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(PASSWORD_ERRORS.NUMBER);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.5: Valid passwords are accepted
   * A password meeting all requirements should be valid
   */
  it("should accept passwords meeting all requirements", () => {
    // Generate valid passwords: 8+ chars with uppercase, lowercase, and number
    const validPasswordArb = fc.tuple(
      fc.constantFrom(...UPPERCASE_CHARS.split('')),
      fc.constantFrom(...LOWERCASE_CHARS.split('')),
      fc.constantFrom(...NUMBER_CHARS.split('')),
      stringFromChars(ALL_CHARS, 5, 17)
    ).map(([upper, lower, num, rest]) => {
      // Shuffle the characters to create a random valid password
      const chars = [upper, lower, num, ...rest.split('')];
      return chars.sort(() => Math.random() - 0.5).join('');
    });

    fc.assert(
      fc.property(validPasswordArb, (password) => {
        const result = validatePassword(password);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.6: meetsMinLength is consistent with validatePassword
   */
  it("should have meetsMinLength consistent with validatePassword", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 30 }), (password) => {
        const meetsLength = meetsMinLength(password);
        const result = validatePassword(password);
        
        if (!meetsLength) {
          expect(result.errors).toContain(PASSWORD_ERRORS.MIN_LENGTH);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.7: hasUppercase is consistent with validatePassword
   */
  it("should have hasUppercase consistent with validatePassword", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 30 }), (password) => {
        const hasUpper = hasUppercase(password);
        const result = validatePassword(password);
        
        if (!hasUpper) {
          expect(result.errors).toContain(PASSWORD_ERRORS.UPPERCASE);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.8: hasLowercase is consistent with validatePassword
   */
  it("should have hasLowercase consistent with validatePassword", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 30 }), (password) => {
        const hasLower = hasLowercase(password);
        const result = validatePassword(password);
        
        if (!hasLower) {
          expect(result.errors).toContain(PASSWORD_ERRORS.LOWERCASE);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.9: hasNumber is consistent with validatePassword
   */
  it("should have hasNumber consistent with validatePassword", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 30 }), (password) => {
        const hasNum = hasNumber(password);
        const result = validatePassword(password);
        
        if (!hasNum) {
          expect(result.errors).toContain(PASSWORD_ERRORS.NUMBER);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.10: Error count matches number of failed requirements
   */
  it("should return correct number of errors for each failed requirement", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 30 }), (password) => {
        const result = validatePassword(password);
        
        let expectedErrors = 0;
        if (!meetsMinLength(password)) expectedErrors++;
        if (!hasUppercase(password)) expectedErrors++;
        if (!hasLowercase(password)) expectedErrors++;
        if (!hasNumber(password)) expectedErrors++;
        
        expect(result.errors.length).toBe(expectedErrors);
        expect(result.valid).toBe(expectedErrors === 0);
      }),
      { numRuns: 100 }
    );
  });
});
