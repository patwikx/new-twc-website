# Implementation Plan: Public API Security Hardening

## Overview

This implementation plan addresses security vulnerabilities in public-facing APIs and the guest booking flow. Tasks are organized to build foundational components first, then integrate them into existing endpoints.

## Tasks

- [ ] 1. Create phone number validation schema
  - [x] 1.1 Create `schemas/phone.ts` with Philippine phone validation
    - Implement `validatePhoneNumber` function
    - Implement `normalizePhoneNumber` function
    - Support mobile format: 09XX-XXX-XXXX and +639XX-XXX-XXXX
    - Support landline format with area codes
    - Export Zod schema for form validation
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [ ]* 1.2 Write property tests for phone validation
    - **Property 1: Phone Number Normalization Preserves Validity**
    - **Property 2: Valid Philippine Phone Formats Are Accepted**
    - **Property 3: Invalid Phone Formats Are Rejected**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

- [ ] 2. Create guest capacity validation
  - [x] 2.1 Create `lib/booking/capacity-validation.ts`
    - Implement `validateGuestCapacity` function
    - Check each room's capacity individually
    - Return detailed error messages per room
    - _Requirements: 8.1, 8.2_
  - [ ]* 2.2 Write property test for capacity validation
    - **Property 5: Guest Count Cannot Exceed Room Capacity**
    - **Validates: Requirements 8.1, 8.2**

- [ ] 3. Create timing-safe comparison utility
  - [x] 3.1 Create `lib/security/timing-safe.ts`
    - Implement `timingSafeEqual` function using crypto.timingSafeEqual
    - Handle strings of different lengths safely
    - _Requirements: 9.2_
  - [ ]* 3.2 Write property test for timing-safe comparison
    - **Property 8: Timing-Safe Comparison Returns Correct Result**
    - **Validates: Requirements 9.2**

- [ ] 4. Checkpoint - Core utilities complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Add rate limiting to Contact API
  - [x] 5.1 Update `app/api/contact/route.ts`
    - Import and use centralized `checkLimit`
    - Use "contact-form" key prefix
    - Set limit to 5 requests per 60 seconds
    - Extract client IP from headers (x-forwarded-for or x-real-ip)
    - Return 429 with user-friendly message when limited
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 6. Update Chat API to use centralized rate limiter
  - [x] 6.1 Update `app/api/chat/route.ts`
    - Replace in-memory rate limiting with centralized `checkLimit`
    - Use "chat" key prefix
    - Keep limit at 10 requests per 60 seconds
    - _Requirements: 2.1, 2.2, 2.3_

- [ ] 7. Add rate limiting to Booking Status API
  - [x] 7.1 Update `app/api/bookings/status/route.ts`
    - Import and use centralized `checkLimit`
    - Use "booking-status" key prefix
    - Set limit to 10 requests per 60 seconds
    - _Requirements: 4.1, 4.2, 4.3_

- [ ] 8. Add authentication to Upload API
  - [x] 8.1 Update `app/api/upload/route.ts`
    - Add session validation using auth system
    - Return 401 for unauthenticated requests
    - Allow only authenticated admin users
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 9. Update Email API with timing-safe comparison
  - [x] 9.1 Update `app/api/email/route.ts`
    - Import `timingSafeEqual` from lib/security
    - Replace direct string comparison with timing-safe version
    - Add logging for failed authentication attempts
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 10. Checkpoint - API security hardening complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Update CompletePaymentButton to pass verification token
  - [x] 11.1 Update `components/booking/CompletePaymentButton.tsx`
    - Accept optional `verificationToken` prop
    - Pass token to checkout API in request body
    - _Requirements: 5.2_

- [ ] 12. Add booking confirmation page authorization
  - [x] 12.1 Update `app/(public)/book/confirmation/page.tsx`
    - Check for valid session or lookup token
    - Redirect to lookup page if unauthorized
    - Validate token/user matches booking
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 13. Create guest cancellation service
  - [x] 13.1 Create `lib/booking/cancellation.ts`
    - Implement `calculateCancellationFee` function
    - Check cancellation policy (free window, fee percentage)
    - Implement `canCancelBooking` function to check status
    - _Requirements: 10.2, 10.3, 10.4, 10.6_
  - [ ]* 13.2 Write property tests for cancellation
    - **Property 6: Cancellation Fee Calculation Follows Policy**
    - **Property 7: Checked-In Bookings Cannot Be Cancelled**
    - **Validates: Requirements 10.2, 10.3, 10.4, 10.6**

- [ ] 14. Create guest cancellation API
  - [x] 14.1 Create `app/api/bookings/cancel/route.ts`
    - Accept booking ID and verification token
    - Validate token matches booking
    - Use cancellation service for policy checks
    - Send cancellation confirmation email
    - _Requirements: 10.1, 10.5_
  - [x] 14.2 Update `components/booking/BookingDetailsCard.tsx`
    - Add cancel button for guest bookings with valid token
    - Show cancellation policy information
    - Confirm before cancelling
    - _Requirements: 10.1_

- [ ] 15. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- The checkout API already has rate limiting, ownership verification, and verification token support implemented
- Existing booking cancellation in `actions/booking.ts` handles logged-in users; task 14 adds guest cancellation via API

