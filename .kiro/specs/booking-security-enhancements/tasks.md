# Implementation Plan: Booking Security Enhancements

## Overview

This implementation plan addresses security vulnerabilities and missing features in the booking system. Tasks are organized to build foundational services first, then integrate them into existing endpoints.

## Tasks

- [x] 1. Enhance Rate Limiter with Endpoint-Specific Configuration
  - [x] 1.1 Add `keyPrefix` and `retryAfter` support to rate limiter
    - Extend `checkLimit` function to accept optional `keyPrefix` parameter
    - Add `retryAfter` calculation to `RateLimitResult`
    - _Requirements: 1.1, 1.4, 2.1_

  - [x] 1.2 Write property test for rate limiting enforcement
    - **Property 1: Rate Limiting Enforcement**
    - **Validates: Requirements 1.1, 1.2, 2.1, 2.2**

  - [x] 1.3 Add rate limiting to payment checkout endpoint
    - Modify `/api/payments/create-checkout/route.ts`
    - Add IP extraction and rate limit check (3 req/60s)
    - Return 429 with `Retry-After` header when blocked
    - _Requirements: 1.2, 1.3_

  - [x] 1.4 Add rate limiting to newsletter endpoint
    - Modify `/api/newsletter/route.ts`
    - Add IP extraction and rate limit check (3 req/60s)
    - Return 429 with user-friendly error message
    - _Requirements: 2.2, 2.3_

- [x] 2. Implement Room Availability Service
  - [x] 2.1 Create availability service at `lib/booking/availability.ts`
    - Implement `checkRoomAvailability` function
    - Use date overlap detection: `checkIn < existingCheckOut AND checkOut > existingCheckIn`
    - Only consider CONFIRMED and PENDING bookings
    - _Requirements: 5.1, 5.3, 5.4_

  - [x] 2.2 Write property test for availability check
    - **Property 2: Availability Check Prevents Double Booking**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

  - [x] 2.3 Integrate availability check into booking creation
    - Modify `actions/create-booking.ts`
    - Check availability before creating booking
    - Return clear error message for unavailable rooms
    - _Requirements: 5.2_

- [x] 3. Implement Booking Verification Token System
  - [x] 3.1 Add BookingVerificationToken model to Prisma schema
    - Create model with id, bookingId, tokenHash, expiresAt, createdAt
    - Add relation to Booking model
    - Run `prisma migrate dev`
    - _Requirements: 8.5_

  - [x] 3.2 Create verification token service at `lib/booking/verification-token.ts`
    - Implement `generateVerificationToken` (15 min expiry)
    - Implement `validateVerificationToken`
    - Use SHA-256 hashing for storage
    - _Requirements: 8.1, 8.3, 8.4, 8.5_

  - [x] 3.3 Write property test for verification token security
    - **Property 4: Verification Token Security**
    - **Validates: Requirements 8.3, 8.4, 8.5**

  - [x] 3.4 Generate verification token on booking creation
    - Modify `actions/create-booking.ts`
    - Generate and return verification token with booking result
    - _Requirements: 8.1, 8.2_

- [-] 4. Implement Booking Ownership Verification
  - [x] 4.1 Add ownership verification to checkout endpoint
    - Modify `/api/payments/create-checkout/route.ts`
    - For authenticated users: verify email matches booking
    - For guests: require valid verification token
    - Return 403 for failed verification
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 4.2 Write property test for ownership verification
    - **Property 7: Ownership Verification for Checkout**
    - **Validates: Requirements 3.2, 3.3, 3.4**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Stronger Password Policy
  - [x] 6.1 Create enhanced password schema at `schemas/password.ts`
    - Minimum 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one number
    - Return specific error messages for each requirement
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 6.2 Write property test for password complexity
    - **Property 5: Password Complexity Enforcement**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

  - [x] 6.3 Update RegisterSchema and NewPasswordSchema
    - Modify `schemas/index.ts` to use new password validation
    - Update error messages to be specific
    - _Requirements: 4.1, 4.5_

- [x] 7. Implement Payment Amount Re-verification
  - [x] 7.1 Create price verification utility at `lib/booking/price-verification.ts`
    - Implement `verifyBookingAmount` function
    - Re-calculate total from current room prices
    - Return comparison result with percentage difference
    - _Requirements: 7.1_

  - [x] 7.2 Write property test for price verification
    - **Property 6: Price Verification Consistency**
    - **Validates: Requirements 7.1, 7.2**

  - [x] 7.3 Integrate price verification into checkout endpoint (DONE)
    - Modify `/api/payments/create-checkout/route.ts`
    - Reject checkout if price differs by more than 1%
    - Return error message instructing guest to refresh
    - Log price mismatch events
    - _Requirements: 7.2, 7.3, 7.4_

- [x] 8. Implement Automatic Booking Expiration
  - [x] 8.1 Create expiration service at `lib/booking/expiration.ts`
    - Implement `expireStaleBookings` function
    - Find PENDING/UNPAID bookings older than 30 minutes
    - Exclude PARTIALLY_PAID bookings
    - Update status to CANCELLED, paymentStatus to EXPIRED
    - Log expiration events
    - _Requirements: 6.1, 6.2, 6.4, 6.5_

  - [x] 8.2 Write property test for booking expiration
    - **Property 3: Booking Expiration Timing**
    - **Validates: Requirements 6.1, 6.2**

  - [x] 8.3 Write property test for partially paid protection
    - **Property 8: Partially Paid Bookings Not Expired**
    - **Validates: Requirements 6.5**

  - [x] 8.4 Create API endpoint for expiration job
    - Create `/api/cron/expire-bookings/route.ts`
    - Secure with cron secret header
    - Call `expireStaleBookings` function
    - _Requirements: 6.3_

- [x] 9. Final Checkpoint - Ensure all tests pass
  - All 130 tests pass across 16 test files
  - Booking security enhancements implementation complete

## Notes

- All property tests use fast-check library with minimum 100 iterations
- Each property test is tagged with: **Feature: booking-security-enhancements, Property {N}: {description}**
- Rate limiting uses existing in-memory store (consider Redis for production scaling)
- Expiration job should be triggered by external cron service (Vercel Cron, AWS EventBridge, etc.)
- Verification tokens are separate from lookup tokens (shorter expiry, different purpose)
