"use server";

import { headers } from "next/headers";
import { checkLimit } from "@/lib/rate-limit";
import {
  lookupByCredentials,
  lookupByToken,
  LOOKUP_ERROR_MESSAGE,
  type BookingDetails,
} from "@/lib/booking/lookup";

/**
 * Rate limiting configuration
 * Maximum 5 attempts per IP per 60 seconds
 */
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 1000; // 60 seconds

/**
 * Result type for manual booking lookup
 */
export interface LookupResult {
  success: boolean;
  booking?: BookingDetails;
  error?: string;
}

/**
 * Result type for token-based booking lookup
 */
export interface TokenLookupResult {
  success: boolean;
  booking?: BookingDetails;
  expired?: boolean;
  error?: string;
}

/**
 * Get client IP address from request headers
 * Falls back to "unknown" if not available
 */
async function getClientIp(): Promise<string> {
  const headersList = await headers();
  // Check common headers for client IP
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(",")[0].trim();
  }
  
  const realIp = headersList.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  
  return "unknown";
}

/**
 * Look up a booking by short reference and email
 * 
 * Integrates rate limiting to prevent brute-force attacks.
 * Returns a generic error message for all failure cases to prevent
 * information leakage about which bookings exist.
 * 
 * @param shortRef - The booking short reference (e.g., "TWC-ABC123")
 * @param email - The guest email address
 * @returns LookupResult with booking details or error
 * 
 * Requirements: 1.2, 1.3, 1.4, 1.5, 4.5
 */
export async function lookupBooking(
  shortRef: string,
  email: string
): Promise<LookupResult> {
  try {
    // Validate required fields (Requirement 1.5)
    if (!shortRef || !shortRef.trim()) {
      return {
        success: false,
        error: "Reference number is required",
      };
    }

    if (!email || !email.trim()) {
      return {
        success: false,
        error: "Email address is required",
      };
    }

    // Check rate limit before lookup (Requirement 4.5)
    const clientIp = await getClientIp();
    const rateLimitResult = await checkLimit(clientIp, {
      limit: RATE_LIMIT,
      windowMs: RATE_WINDOW_MS,
      keyPrefix: "booking-lookup",
    });

    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: "Too many attempts. Please try again in a minute.",
      };
    }

    // Perform lookup (Requirements 1.2, 1.3, 1.4)
    const booking = await lookupByCredentials(shortRef.trim(), email.trim());

    if (!booking) {
      // Return generic error for all failure cases (Requirement 1.3, 1.4)
      return {
        success: false,
        error: LOOKUP_ERROR_MESSAGE,
      };
    }

    return {
      success: true,
      booking,
    };
  } catch (error) {
    console.error("Booking lookup error:", error);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}

/**
 * Look up a booking by secure token from confirmation email
 * 
 * Does not require email verification - the token itself is proof of access.
 * Handles expired tokens by returning redirect information.
 * 
 * @param token - The plain lookup token from the email link
 * @returns TokenLookupResult with booking details, expired flag, or error
 * 
 * Requirements: 3.3, 3.4
 */
export async function lookupBookingByToken(
  token: string
): Promise<TokenLookupResult> {
  try {
    // Validate token is provided
    if (!token || !token.trim()) {
      return {
        success: false,
        error: "Invalid token",
      };
    }

    // Perform token-based lookup (Requirement 3.3)
    const result = await lookupByToken(token.trim());

    // Handle expired token (Requirement 3.4)
    if (result.expired) {
      return {
        success: false,
        expired: true,
        error: "This link has expired. Please use the manual lookup form.",
      };
    }

    // Handle invalid token
    if (!result.booking) {
      return {
        success: false,
        error: "Invalid or expired link. Please use the manual lookup form.",
      };
    }

    // Token valid, return booking details (Requirement 3.3)
    return {
      success: true,
      booking: result.booking,
    };
  } catch (error) {
    console.error("Token lookup error:", error);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }
}
