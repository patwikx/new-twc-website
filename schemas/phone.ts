/**
 * Philippine Phone Number Validation Schema
 * 
 * Implements phone number validation for Philippine formats:
 * - Mobile: 09XX-XXX-XXXX or +639XX-XXX-XXXX
 * - Landline: (0XX) XXX-XXXX or area code formats
 * 
 * Strips non-numeric characters except leading plus sign before validation.
 */

import * as z from "zod";

/**
 * Phone validation error messages
 */
export const PHONE_ERRORS = {
  INVALID_FORMAT: "Invalid Philippine phone number format",
  TOO_SHORT: "Phone number is too short",
  TOO_LONG: "Phone number is too long",
  INVALID_PREFIX: "Phone number must start with 0 or +63",
  INVALID_MOBILE_PREFIX: "Mobile number must start with 09 or +639",
} as const;

/**
 * Phone validation regex patterns
 */
const PATTERNS = {
  // Philippine mobile: 09XXXXXXXXX (11 digits) or +639XXXXXXXXX (12 digits with +)
  MOBILE_LOCAL: /^09\d{9}$/,
  MOBILE_INTL: /^\+639\d{9}$/,
  // Philippine landline: 0X-XXXXXXX or 0XX-XXXXXXX (area code + 7-8 digits)
  // Area codes: 02 (Metro Manila), 032-088 (provincial)
  LANDLINE_LOCAL: /^0[2-8]\d{7,8}$/,
  LANDLINE_INTL: /^\+63[2-8]\d{7,8}$/,
} as const;

/**
 * Result of phone number validation
 */
export interface PhoneValidationResult {
  valid: boolean;
  normalized: string | null;
  error?: string;
}

/**
 * Normalizes a phone number by stripping non-numeric characters except leading +
 * 
 * @param phone - The phone number to normalize
 * @returns Normalized phone number string
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return "";
  
  // Preserve leading + if present
  const hasPlus = phone.startsWith("+");
  
  // Remove all non-numeric characters
  const digitsOnly = phone.replace(/[^\d]/g, "");
  
  // Add back the + if it was present
  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}

/**
 * Validates a Philippine phone number
 * 
 * @param phone - The phone number to validate
 * @returns Validation result with normalized number if valid
 */
export function validatePhoneNumber(phone: string): PhoneValidationResult {
  if (!phone || phone.trim() === "") {
    return {
      valid: false,
      normalized: null,
      error: PHONE_ERRORS.INVALID_FORMAT,
    };
  }

  const normalized = normalizePhoneNumber(phone);
  
  // Check minimum length (landline with area code: 9 digits like 02XXXXXXX)
  const digitsOnly = normalized.replace(/^\+/, "");
  if (digitsOnly.length < 9) {
    return {
      valid: false,
      normalized: null,
      error: PHONE_ERRORS.TOO_SHORT,
    };
  }
  
  // Check maximum length (mobile with country code: 12 digits like +639XXXXXXXXX)
  if (digitsOnly.length > 12) {
    return {
      valid: false,
      normalized: null,
      error: PHONE_ERRORS.TOO_LONG,
    };
  }

  // Check if it matches any valid Philippine format
  const isValidMobile = 
    PATTERNS.MOBILE_LOCAL.test(normalized) || 
    PATTERNS.MOBILE_INTL.test(normalized);
    
  const isValidLandline = 
    PATTERNS.LANDLINE_LOCAL.test(normalized) || 
    PATTERNS.LANDLINE_INTL.test(normalized);

  if (isValidMobile || isValidLandline) {
    return {
      valid: true,
      normalized,
    };
  }

  // Provide more specific error messages
  if (normalized.startsWith("+63") || normalized.startsWith("0")) {
    // Has valid prefix but wrong format
    if (normalized.startsWith("+639") || normalized.startsWith("09")) {
      return {
        valid: false,
        normalized: null,
        error: PHONE_ERRORS.INVALID_FORMAT,
      };
    }
    return {
      valid: false,
      normalized: null,
      error: PHONE_ERRORS.INVALID_FORMAT,
    };
  }

  return {
    valid: false,
    normalized: null,
    error: PHONE_ERRORS.INVALID_PREFIX,
  };
}

/**
 * Checks if a phone number is a valid Philippine mobile number
 * 
 * @param phone - The phone number to check
 * @returns True if valid mobile number
 */
export function isValidMobile(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  return PATTERNS.MOBILE_LOCAL.test(normalized) || PATTERNS.MOBILE_INTL.test(normalized);
}

/**
 * Checks if a phone number is a valid Philippine landline number
 * 
 * @param phone - The phone number to check
 * @returns True if valid landline number
 */
export function isValidLandline(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  return PATTERNS.LANDLINE_LOCAL.test(normalized) || PATTERNS.LANDLINE_INTL.test(normalized);
}

/**
 * Zod schema for Philippine phone number validation
 * 
 * Transforms input by normalizing, then validates against Philippine formats.
 * Use this schema in forms for automatic validation.
 */
export const PhoneSchema = z
  .string()
  .transform((val) => normalizePhoneNumber(val))
  .refine(
    (val) => {
      if (!val) return false;
      const result = validatePhoneNumber(val);
      return result.valid;
    },
    {
      message: PHONE_ERRORS.INVALID_FORMAT,
    }
  );

/**
 * Optional phone schema - allows empty string or valid phone
 */
export const OptionalPhoneSchema = z
  .string()
  .optional()
  .transform((val) => (val ? normalizePhoneNumber(val) : undefined))
  .refine(
    (val) => {
      if (!val) return true; // Allow empty/undefined
      const result = validatePhoneNumber(val);
      return result.valid;
    },
    {
      message: PHONE_ERRORS.INVALID_FORMAT,
    }
  );

/**
 * Type for a valid Philippine phone number
 */
export type ValidPhoneNumber = z.infer<typeof PhoneSchema>;
