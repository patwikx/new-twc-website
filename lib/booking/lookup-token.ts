import crypto from "crypto";
import { db } from "@/lib/db";

// Token expiration: 30 days in milliseconds
const TOKEN_EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000;

// Token size: 32 bytes = 256 bits of entropy
const TOKEN_SIZE_BYTES = 32;

/**
 * Generates a cryptographically secure random token
 * Returns a URL-safe base64 string with 256 bits of entropy
 */
export function generateRawToken(): string {
  const buffer = crypto.randomBytes(TOKEN_SIZE_BYTES);
  // Convert to URL-safe base64 (replace + with -, / with _, remove =)
  return buffer.toString("base64url");
}

/**
 * Hashes a token using SHA-256 for secure storage
 * Only the hash is stored in the database, never the plain token
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generates a new lookup token for a booking
 * Returns the plain token (to be sent in email) and expiration date
 * The token hash is stored in the database
 */
export async function generateToken(
  bookingId: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateRawToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRATION_MS);

  await db.bookingLookupToken.create({
    data: {
      bookingId,
      tokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

/**
 * Validates a token and returns the booking ID if valid
 * Checks both the hash match and expiration
 */
export async function validateToken(token: string): Promise<{
  valid: boolean;
  bookingId?: string;
  expired?: boolean;
}> {
  const tokenHash = hashToken(token);

  const lookupToken = await db.bookingLookupToken.findUnique({
    where: { tokenHash },
    select: {
      bookingId: true,
      expiresAt: true,
    },
  });

  // Token not found
  if (!lookupToken) {
    return { valid: false };
  }

  // Token expired
  if (lookupToken.expiresAt < new Date()) {
    return { valid: false, expired: true };
  }

  return { valid: true, bookingId: lookupToken.bookingId };
}

/**
 * Deletes all lookup tokens for a booking
 * Useful when a booking is cancelled or for cleanup
 */
export async function deleteTokensForBooking(bookingId: string): Promise<void> {
  await db.bookingLookupToken.deleteMany({
    where: { bookingId },
  });
}

/**
 * Checks if a token is expired based on the expiration date
 * Pure function for testing purposes
 */
export function isTokenExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt < now;
}
