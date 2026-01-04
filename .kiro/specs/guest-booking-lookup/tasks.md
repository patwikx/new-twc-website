# Implementation Plan: Guest Booking Lookup

## Overview

This plan implements a secure guest booking lookup system with two access methods: manual lookup via reference + email, and direct access via secure token links in confirmation emails. The implementation uses TypeScript with Next.js App Router, Prisma ORM, and fast-check for property-based testing.

## Tasks

- [x] 1. Database schema and token infrastructure
  - [x] 1.1 Add BookingLookupToken model to Prisma schema
    - Add model with id, bookingId, tokenHash, expiresAt, createdAt fields
    - Add relation to Booking model
    - Add indexes on bookingId and expiresAt
    - _Requirements: 4.2_

  - [x] 1.2 Create and run Prisma migration
    - Generate migration for BookingLookupToken table
    - _Requirements: 4.2_

  - [x] 1.3 Implement lookup token service (`lib/booking/lookup-token.ts`)
    - Implement `generateToken()` using crypto.randomBytes for 256-bit entropy
    - Implement `hashToken()` using SHA-256
    - Implement `validateToken()` to check hash and expiration
    - Set token expiration to 30 days from creation
    - _Requirements: 3.2, 4.1, 4.2, 4.3_

  - [x] 1.4 Write property test for token generation security
    - **Property 4: Token Generation Security**
    - **Validates: Requirements 4.1**

  - [x] 1.5 Write property test for token storage round-trip
    - **Property 5: Token Storage Round-Trip**
    - **Validates: Requirements 4.2, 4.3**

  - [x] 1.6 Write property test for token expiration enforcement
    - **Property 6: Token Expiration Enforcement**
    - **Validates: Requirements 3.2, 4.4**

- [x] 2. Rate limiting infrastructure
  - [x] 2.1 Implement rate limiter (`lib/rate-limit.ts`)
    - Use in-memory store with IP-based tracking
    - Implement sliding window algorithm
    - Configure 5 attempts per 60-second window
    - _Requirements: 4.5_

  - [x] 2.2 Write property test for rate limiting enforcement
    - **Property 7: Rate Limiting Enforcement**
    - **Validates: Requirements 4.5**

- [x] 3. Booking lookup service
  - [x] 3.1 Implement booking lookup service (`lib/booking/lookup.ts`)
    - Implement `lookupByCredentials()` with case-insensitive email comparison
    - Implement `lookupByToken()` using token service
    - Implement `getBookingDetails()` to fetch full booking with relations
    - Return null for any invalid lookup (no information leakage)
    - _Requirements: 1.2, 1.3, 1.4, 1.6, 2.1, 3.3_

  - [x] 3.2 Write property test for credential validation
    - **Property 1: Lookup Credential Validation**
    - **Validates: Requirements 1.2, 1.3**

  - [x] 3.3 Write property test for error message uniformity
    - **Property 2: Error Message Uniformity**
    - **Validates: Requirements 1.3, 1.4**

  - [x] 3.4 Write property test for booking details completeness
    - **Property 3: Booking Details Completeness**
    - **Validates: Requirements 1.6, 2.1**

  - [x] 3.5 Write property test for token-based access bypass
    - **Property 8: Token-Based Access Bypass**
    - **Validates: Requirements 3.3**

- [x] 4. Server actions for lookup
  - [x] 4.1 Create booking lookup server action (`actions/booking-lookup.ts`)
    - Implement `lookupBooking(shortRef, email)` action
    - Integrate rate limiting check before lookup
    - Return generic error for all failure cases
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 4.5_

  - [x] 4.2 Create token lookup server action
    - Implement `lookupBookingByToken(token)` action
    - Handle expired token case with redirect info
    - _Requirements: 3.3, 3.4_

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. UI components
  - [x] 6.1 Create LookupForm component (`components/booking/LookupForm.tsx`)
    - Client component with reference and email inputs
    - Form validation for required fields
    - Loading state during submission
    - Error display for failed lookups
    - _Requirements: 1.1, 1.5_

  - [x] 6.2 Create BookingDetailsCard component (`components/booking/BookingDetailsCard.tsx`)
    - Display all booking information (property, room, dates, guests, amount)
    - Show booking status with appropriate styling
    - Conditional PDF download button for CONFIRMED bookings
    - Link to lookup another booking
    - _Requirements: 1.6, 2.1, 2.2, 2.3, 2.4_

- [x] 7. Lookup pages
  - [x] 7.1 Create manual lookup page (`app/(public)/bookings/lookup/page.tsx`)
    - Server component with LookupForm
    - Handle `?expired=true` query param for expired token message
    - Display booking details on successful lookup
    - _Requirements: 1.1, 3.4, 5.1_

  - [x] 7.2 Create token-based lookup route (`app/(public)/bookings/lookup/[token]/page.tsx`)
    - Server component that validates token
    - Redirect to manual lookup if invalid/expired
    - Display booking details if valid
    - _Requirements: 3.3, 3.4_

  - [x] 7.3 Update bookings page with lookup link (`app/(public)/bookings/page.tsx`)
    - Add "Look up a booking" link for unauthenticated users
    - Display alongside login prompt
    - _Requirements: 5.2_

  - [x] 7.4 Update confirmation page with lookup link
    - Add "Save this link" section with lookup page reference
    - _Requirements: 5.3_

- [x] 8. Enhanced confirmation email
  - [x] 8.1 Update email API to generate and include lookup token
    - Generate token when sending booking confirmation
    - Store hashed token in database
    - Include token link in email HTML
    - _Requirements: 3.1, 3.5, 3.6_

  - [x] 8.2 Update email template with "View Your Booking" button
    - Add prominent button with token link
    - Keep short reference visible for manual lookup fallback
    - Style consistent with existing email design
    - _Requirements: 3.5, 3.6_

  - [x] 8.3 Update webhook to trigger enhanced email
    - Ensure token is generated on payment confirmation
    - _Requirements: 3.1_

- [ ] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks including property tests are required for comprehensive coverage
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The rate limiter uses in-memory storage; consider Redis for production scaling
