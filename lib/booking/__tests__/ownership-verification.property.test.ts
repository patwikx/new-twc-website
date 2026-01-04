/**
 * Property-Based Tests for Booking Ownership Verification
 * 
 * Feature: booking-security-enhancements
 * Property 7: Ownership Verification for Checkout
 * Validates: Requirements 3.2, 3.3, 3.4
 * 
 * Note: This test focuses on the pure logic of ownership verification.
 * Integration tests would be needed to test the full API endpoint.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Pure functions for ownership verification logic
interface OwnershipCheckParams {
  authenticatedUserEmail: string | null;
  bookingGuestEmail: string;
  verificationToken: string | null;
  tokenValid: boolean;
  tokenBookingId: string | null;
  requestedBookingId: string;
}

/**
 * Determines if a checkout request should be allowed based on ownership verification.
 * This is the pure logic extracted from the API endpoint.
 */
function verifyOwnership(params: OwnershipCheckParams): { allowed: boolean; reason?: string } {
  const {
    authenticatedUserEmail,
    bookingGuestEmail,
    verificationToken,
    tokenValid,
    tokenBookingId,
    requestedBookingId
  } = params;

  // Case 1: Authenticated user
  if (authenticatedUserEmail) {
    if (authenticatedUserEmail.toLowerCase() === bookingGuestEmail.toLowerCase()) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'email_mismatch' };
  }

  // Case 2: Guest user (unauthenticated)
  if (!verificationToken) {
    return { allowed: false, reason: 'no_token' };
  }

  if (!tokenValid) {
    return { allowed: false, reason: 'invalid_token' };
  }

  if (tokenBookingId !== requestedBookingId) {
    return { allowed: false, reason: 'token_booking_mismatch' };
  }

  return { allowed: true };
}

describe('Property 7: Ownership Verification for Checkout', () => {
  /**
   * For any checkout request, if the requester is authenticated, their email 
   * SHALL match the booking's guestEmail; if unauthenticated, a valid 
   * verification token SHALL be required.
   */

  // Arbitrary for email addresses
  const emailArb = fc.emailAddress();
  
  // Arbitrary for booking IDs (UUIDs)
  const bookingIdArb = fc.uuid();
  
  // Arbitrary for tokens
  const tokenArb = fc.string({ minLength: 32, maxLength: 64 });

  it('should allow authenticated users with matching email', async () => {
    await fc.assert(
      fc.property(
        emailArb,
        bookingIdArb,
        (email, bookingId) => {
          const result = verifyOwnership({
            authenticatedUserEmail: email,
            bookingGuestEmail: email,
            verificationToken: null,
            tokenValid: false,
            tokenBookingId: null,
            requestedBookingId: bookingId
          });
          
          expect(result.allowed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow authenticated users with case-insensitive email match', async () => {
    await fc.assert(
      fc.property(
        emailArb,
        bookingIdArb,
        fc.boolean(),
        (email, bookingId, upperCase) => {
          const userEmail = upperCase ? email.toUpperCase() : email.toLowerCase();
          const guestEmail = upperCase ? email.toLowerCase() : email.toUpperCase();
          
          const result = verifyOwnership({
            authenticatedUserEmail: userEmail,
            bookingGuestEmail: guestEmail,
            verificationToken: null,
            tokenValid: false,
            tokenBookingId: null,
            requestedBookingId: bookingId
          });
          
          expect(result.allowed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject authenticated users with non-matching email', async () => {
    await fc.assert(
      fc.property(
        emailArb,
        emailArb,
        bookingIdArb,
        (userEmail, guestEmail, bookingId) => {
          // Skip if emails happen to match
          if (userEmail.toLowerCase() === guestEmail.toLowerCase()) return;
          
          const result = verifyOwnership({
            authenticatedUserEmail: userEmail,
            bookingGuestEmail: guestEmail,
            verificationToken: null,
            tokenValid: false,
            tokenBookingId: null,
            requestedBookingId: bookingId
          });
          
          expect(result.allowed).toBe(false);
          expect(result.reason).toBe('email_mismatch');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject unauthenticated users without verification token', async () => {
    await fc.assert(
      fc.property(
        emailArb,
        bookingIdArb,
        (guestEmail, bookingId) => {
          const result = verifyOwnership({
            authenticatedUserEmail: null,
            bookingGuestEmail: guestEmail,
            verificationToken: null,
            tokenValid: false,
            tokenBookingId: null,
            requestedBookingId: bookingId
          });
          
          expect(result.allowed).toBe(false);
          expect(result.reason).toBe('no_token');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject unauthenticated users with invalid token', async () => {
    await fc.assert(
      fc.property(
        emailArb,
        bookingIdArb,
        tokenArb,
        (guestEmail, bookingId, token) => {
          const result = verifyOwnership({
            authenticatedUserEmail: null,
            bookingGuestEmail: guestEmail,
            verificationToken: token,
            tokenValid: false,
            tokenBookingId: null,
            requestedBookingId: bookingId
          });
          
          expect(result.allowed).toBe(false);
          expect(result.reason).toBe('invalid_token');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject unauthenticated users with token for different booking', async () => {
    await fc.assert(
      fc.property(
        emailArb,
        bookingIdArb,
        bookingIdArb,
        tokenArb,
        (guestEmail, requestedBookingId, tokenBookingId, token) => {
          // Skip if booking IDs happen to match
          if (requestedBookingId === tokenBookingId) return;
          
          const result = verifyOwnership({
            authenticatedUserEmail: null,
            bookingGuestEmail: guestEmail,
            verificationToken: token,
            tokenValid: true,
            tokenBookingId: tokenBookingId,
            requestedBookingId: requestedBookingId
          });
          
          expect(result.allowed).toBe(false);
          expect(result.reason).toBe('token_booking_mismatch');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow unauthenticated users with valid token for correct booking', async () => {
    await fc.assert(
      fc.property(
        emailArb,
        bookingIdArb,
        tokenArb,
        (guestEmail, bookingId, token) => {
          const result = verifyOwnership({
            authenticatedUserEmail: null,
            bookingGuestEmail: guestEmail,
            verificationToken: token,
            tokenValid: true,
            tokenBookingId: bookingId,
            requestedBookingId: bookingId
          });
          
          expect(result.allowed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should prioritize authenticated user check over token check', async () => {
    await fc.assert(
      fc.property(
        emailArb,
        emailArb,
        bookingIdArb,
        tokenArb,
        (userEmail, guestEmail, bookingId, token) => {
          // Even with a valid token, if user is authenticated with wrong email, reject
          if (userEmail.toLowerCase() === guestEmail.toLowerCase()) return;
          
          const result = verifyOwnership({
            authenticatedUserEmail: userEmail,
            bookingGuestEmail: guestEmail,
            verificationToken: token,
            tokenValid: true,
            tokenBookingId: bookingId,
            requestedBookingId: bookingId
          });
          
          // Should reject based on email mismatch, not accept based on token
          expect(result.allowed).toBe(false);
          expect(result.reason).toBe('email_mismatch');
        }
      ),
      { numRuns: 100 }
    );
  });
});
