/**
 * Enhanced Password Validation Schema
 * 
 * Implements stronger password policy with the following requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * 
 * Returns specific error messages for each requirement not met.
 */

import * as z from "zod";

/**
 * Password validation error messages
 */
export const PASSWORD_ERRORS = {
  MIN_LENGTH: "Password must be at least 8 characters",
  UPPERCASE: "Password must contain at least one uppercase letter",
  LOWERCASE: "Password must contain at least one lowercase letter",
  NUMBER: "Password must contain at least one number",
} as const;

/**
 * Password validation regex patterns
 */
const PATTERNS = {
  UPPERCASE: /[A-Z]/,
  LOWERCASE: /[a-z]/,
  NUMBER: /[0-9]/,
} as const;

/**
 * Enhanced password schema with comprehensive validation
 * 
 * Validates:
 * - Minimum 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one number (0-9)
 */
export const PasswordSchema = z
  .string()
  .min(8, PASSWORD_ERRORS.MIN_LENGTH)
  .refine((password) => PATTERNS.UPPERCASE.test(password), {
    message: PASSWORD_ERRORS.UPPERCASE,
  })
  .refine((password) => PATTERNS.LOWERCASE.test(password), {
    message: PASSWORD_ERRORS.LOWERCASE,
  })
  .refine((password) => PATTERNS.NUMBER.test(password), {
    message: PASSWORD_ERRORS.NUMBER,
  });

/**
 * Type for a valid password
 */
export type ValidPassword = z.infer<typeof PasswordSchema>;

/**
 * Validates a password and returns detailed error information
 * 
 * @param password - The password to validate
 * @returns Object with valid status and array of error messages
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push(PASSWORD_ERRORS.MIN_LENGTH);
  }

  if (!PATTERNS.UPPERCASE.test(password)) {
    errors.push(PASSWORD_ERRORS.UPPERCASE);
  }

  if (!PATTERNS.LOWERCASE.test(password)) {
    errors.push(PASSWORD_ERRORS.LOWERCASE);
  }

  if (!PATTERNS.NUMBER.test(password)) {
    errors.push(PASSWORD_ERRORS.NUMBER);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Checks if a password meets the minimum length requirement
 * Pure function for testing
 */
export function meetsMinLength(password: string): boolean {
  return password.length >= 8;
}

/**
 * Checks if a password contains at least one uppercase letter
 * Pure function for testing
 */
export function hasUppercase(password: string): boolean {
  return PATTERNS.UPPERCASE.test(password);
}

/**
 * Checks if a password contains at least one lowercase letter
 * Pure function for testing
 */
export function hasLowercase(password: string): boolean {
  return PATTERNS.LOWERCASE.test(password);
}

/**
 * Checks if a password contains at least one number
 * Pure function for testing
 */
export function hasNumber(password: string): boolean {
  return PATTERNS.NUMBER.test(password);
}
