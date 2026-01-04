# Requirements Document

## Introduction

This specification addresses security vulnerabilities and missing features identified in the public-facing booking system. The enhancements focus on rate limiting, input validation, booking lifecycle management, and security hardening for the guest checkout flow.

## Glossary

- **Rate_Limiter**: A service that tracks and limits the number of requests from a single identifier within a time window
- **Booking_System**: The system responsible for creating, managing, and tracking hotel room reservations
- **Payment_Gateway**: The PayMongo integration that handles payment processing
- **Availability_Service**: A service that checks room availability for given date ranges
- **Expiration_Service**: A service that automatically cancels unpaid bookings after a timeout period
- **Password_Validator**: A service that enforces password complexity requirements

## Requirements

### Requirement 1: Rate Limiting on Payment Checkout

**User Story:** As a system administrator, I want to prevent abuse of the payment checkout endpoint, so that malicious actors cannot spam checkout session creation.

#### Acceptance Criteria

1. WHEN a client makes a request to create a checkout session, THE Rate_Limiter SHALL track the request by IP address
2. WHEN a client exceeds 3 checkout requests within 60 seconds, THE Rate_Limiter SHALL reject subsequent requests with a 429 status code
3. WHEN a rate-limited request is rejected, THE Payment_Gateway SHALL return a clear error message indicating the client should wait
4. THE Rate_Limiter SHALL use the existing sliding window algorithm from `lib/rate-limit`

### Requirement 2: Rate Limiting on Newsletter Subscription

**User Story:** As a system administrator, I want to prevent spam subscriptions to the newsletter, so that the email service is not abused.

#### Acceptance Criteria

1. WHEN a client submits a newsletter subscription, THE Rate_Limiter SHALL track the request by IP address
2. WHEN a client exceeds 3 subscription attempts within 60 seconds, THE Rate_Limiter SHALL reject subsequent requests with a 429 status code
3. WHEN a rate-limited request is rejected, THE Newsletter_API SHALL return a user-friendly error message

### Requirement 3: Booking Ownership Verification

**User Story:** As a security engineer, I want to ensure only the booking owner can initiate payment, so that unauthorized users cannot access or pay for others' bookings.

#### Acceptance Criteria

1. WHEN a checkout session is requested, THE Payment_Gateway SHALL verify the booking exists
2. WHEN a logged-in user requests checkout, THE Payment_Gateway SHALL verify the user's email matches the booking guest email
3. WHEN a guest (non-authenticated) requests checkout, THE Payment_Gateway SHALL require a short-lived verification token
4. IF the ownership verification fails, THEN THE Payment_Gateway SHALL return a 403 Forbidden status
5. THE Payment_Gateway SHALL use generic error messages to prevent information leakage

### Requirement 4: Stronger Password Policy

**User Story:** As a security engineer, I want to enforce stronger password requirements, so that user accounts are better protected against brute force attacks.

#### Acceptance Criteria

1. WHEN a user registers or changes their password, THE Password_Validator SHALL require a minimum of 8 characters
2. WHEN validating a password, THE Password_Validator SHALL require at least one uppercase letter
3. WHEN validating a password, THE Password_Validator SHALL require at least one lowercase letter
4. WHEN validating a password, THE Password_Validator SHALL require at least one number
5. WHEN validation fails, THE Password_Validator SHALL return specific error messages indicating which requirements are not met

### Requirement 5: Room Availability Check

**User Story:** As a guest, I want the system to prevent double-bookings, so that my reservation is guaranteed when I complete payment.

#### Acceptance Criteria

1. WHEN a booking is created, THE Availability_Service SHALL check if the room is available for the requested dates
2. WHEN a room is already booked for overlapping dates, THE Booking_System SHALL reject the booking with a clear error message
3. THE Availability_Service SHALL only consider bookings with status CONFIRMED or PENDING (not CANCELLED)
4. WHEN checking availability, THE Availability_Service SHALL use date range overlap detection (checkIn < existingCheckOut AND checkOut > existingCheckIn)

### Requirement 6: Automatic Booking Expiration

**User Story:** As a system administrator, I want unpaid bookings to automatically expire, so that room inventory is not held indefinitely by abandoned bookings.

#### Acceptance Criteria

1. WHEN a booking remains in PENDING status with UNPAID payment status for more than 30 minutes, THE Expiration_Service SHALL mark it as EXPIRED
2. WHEN a booking is expired, THE Expiration_Service SHALL update the status to CANCELLED and paymentStatus to EXPIRED
3. THE Expiration_Service SHALL run periodically (every 5 minutes) to check for expired bookings
4. WHEN a booking is expired, THE Expiration_Service SHALL log the expiration event for audit purposes
5. THE Expiration_Service SHALL NOT expire bookings that have any payment recorded (PARTIALLY_PAID)

### Requirement 7: Payment Amount Re-verification

**User Story:** As a finance manager, I want payment amounts to be verified at checkout time, so that price changes don't cause payment mismatches.

#### Acceptance Criteria

1. WHEN a checkout session is created, THE Payment_Gateway SHALL re-calculate the booking total from current room prices
2. IF the re-calculated total differs from the stored booking total by more than 1%, THEN THE Payment_Gateway SHALL reject the checkout with an error
3. WHEN a price mismatch is detected, THE Payment_Gateway SHALL return an error message instructing the guest to refresh their booking
4. THE Payment_Gateway SHALL log price mismatch events for monitoring

### Requirement 8: Booking Verification Token

**User Story:** As a guest, I want to securely access my booking for payment without logging in, so that I can complete checkout as a guest.

#### Acceptance Criteria

1. WHEN a booking is created, THE Booking_System SHALL generate a short-lived verification token (15 minutes expiry)
2. THE Booking_System SHALL return the verification token to the client for use in checkout
3. WHEN a guest requests checkout, THE Payment_Gateway SHALL accept the verification token as proof of ownership
4. WHEN the verification token is expired or invalid, THE Payment_Gateway SHALL reject the request with a 403 status
5. THE Booking_System SHALL hash verification tokens before storage (SHA-256)
