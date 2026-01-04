/**
 * Booking Verification Token Service
 * 
 * Provides short-lived tokens for guest checkout verification.
 * These tokens are separate from lookup tokens and have a shorter expiry (15 minutes).
 * Used to verify booking ownership during the checkout process for unauthenticated users.
 */

import crypto from "crypto";
import { db } from "@/lib/db";

// Token expiration: 15 minutes in milliseconds
const TOKEN_EXPIRATION_MS = 15 * 60 * 1000;

// Token size: 32 bytes = 256 bits of entropy
const TOKEN_SIZE_BYTES = 32;

export interface VerificationToken {
  token: string;      // Plain token (returned to client)
  expiresAt: Date;    // 15 minutes from creation
}

export interface TokenValidationResult {
  valid: boolean;
  bookingId?: string;
  expired?: boolean;
}

/**
 * Generates a cryptographically secure random token
 * Returns a URL-safe base64 string with 256 bits of entropy
 */
export function generateRawVerificationToken(): string {
  const buffer = crypto.randomBytes(TOKEN_SIZE_BYTES);
  return buffer.toString("base64url");
}

/**
 * Hashes a token using SHA-256 for secure storage
 * Only the hash is stored in the database, never the plain token
 */
export function hashVerificationToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generates a new verification token for a booking
 * Returns the plain token (to be sent to client) and expiration date
 * The token hash is stored in the database
 * 
 * @param bookingId - The booking ID to generate a token for
 * @returns VerificationToken with plain token and expiry
 */
export async function generateVerificationToken(
  bookingId: string
): Promise<VerificationToken> {
  const token = generateRawVerificationToken();
  const tokenHash = hashVerificationToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRATION_MS);

  // Delete any existing verification tokens for this booking
  await db.bookingVerificationToken.deleteMany({
    where: { bookingId }
  });

  // Create new token
  await db.bookingVerificationToken.create({
    data: {
      bookingId,
      tokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

/**
 * Validates a verification token and returns the booking ID if valid
 * Checks both the hash match and expiration
 * 
 * @param token - The plain verification token from the client
 * @returns TokenValidationResult with validity status and booking ID
 */
export async function validateVerificationToken(
  token: string
): Promise<TokenValidationResult> {
  if (!token) {
    return { valid: false };
  }

  const tokenHash = hashVerificationToken(token);

  const verificationToken = await db.bookingVerificationToken.findUnique({
    where: { tokenHash },
    select: {
      bookingId: true,
      expiresAt: true,
    },
  });

  // Token not found
  if (!verificationToken) {
    return { valid: false };
  }

  // Token expired
  if (verificationToken.expiresAt < new Date()) {
    return { valid: false, expired: true };
  }

  return { valid: true, bookingId: verificationToken.bookingId };
}

/**
 * Deletes all verification tokens for a booking
 * Called after successful checkout or when booking is cancelled
 * 
 * @param bookingId - The booking ID to clean up tokens for
 */
export async function deleteVerificationTokensForBooking(
  bookingId: string
): Promise<void> {
  await db.bookingVerificationToken.deleteMany({
    where: { bookingId },
  });
}

/**
 * Checks if a verification token is expired based on the expiration date
 * Pure function for testing purposes
 * 
 * @param expiresAt - The token expiration date
 * @param now - Current date (defaults to now)
 * @returns true if the token is expired
 */
export function isVerificationTokenExpired(
  expiresAt: Date,
  now: Date = new Date()
): boolean {
  return expiresAt < now;
}

/**
 * Clean up expired verification tokens
 * Can be called periodically to remove stale tokens
 */
export async function cleanupExpiredVerificationTokens(): Promise<number> {
  const result = await db.bookingVerificationToken.deleteMany({
    where: {
      expiresAt: {
        lt: new Date()
      }
    }
  });
  return result.count;
}
