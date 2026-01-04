# Requirements Document

## Introduction

This specification addresses security vulnerabilities and feature gaps identified in the public-facing APIs and booking flow of the hotel management system. The focus is on hardening API endpoints against abuse, improving input validation, and ensuring proper authorization for guest booking operations.

## Glossary

- **Rate_Limiter**: The sliding window rate limiting service that tracks request attempts per IP address
- **Contact_API**: The public endpoint for contact form submissions at `/api/contact`
- **Chat_API**: The AI-powered chat endpoint at `/api/chat`
- **Upload_API**: The file upload endpoint at `/api/upload`
- **Booking_Status_API**: The endpoint for checking booking payment status at `/api/bookings/status`
- **Checkout_API**: The payment checkout creation endpoint at `/api/payments/create-checkout`
- **Verification_Token**: A cryptographically secure token used to authorize guest access to booking operations
- **Guest_Booking**: A booking made without a registered user account
- **Phone_Number**: A contact phone number in E.164 or local Philippine format
- **Room_Capacity**: The maximum number of guests allowed in a room

## Requirements

### Requirement 1: Contact Form Rate Limiting

**User Story:** As a system administrator, I want the contact form API to be rate limited, so that I can prevent spam and abuse of the email service.

#### Acceptance Criteria

1. WHEN a client submits a contact form request, THE Contact_API SHALL check the rate limit before processing
2. WHEN a client exceeds 5 requests per minute, THE Contact_API SHALL return a 429 status with a user-friendly error message
3. WHEN rate limiting is applied, THE Contact_API SHALL use the "contact-form" key prefix to isolate limits from other endpoints
4. THE Contact_API SHALL extract the client IP from x-forwarded-for or x-real-ip headers

### Requirement 2: Chat API Rate Limiting Enhancement

**User Story:** As a system administrator, I want the chat API to use the centralized rate limiter, so that rate limits persist across server restarts and are consistent with other endpoints.

#### Acceptance Criteria

1. WHEN a client sends a chat message, THE Chat_API SHALL use the centralized Rate_Limiter instead of in-memory tracking
2. WHEN a client exceeds 10 requests per minute, THE Chat_API SHALL return a 429 status with a user-friendly message
3. WHEN rate limiting is applied, THE Chat_API SHALL use the "chat" key prefix to isolate limits from other endpoints

### Requirement 3: Upload API Authentication

**User Story:** As a system administrator, I want the upload API to require authentication, so that only authorized users can upload files.

#### Acceptance Criteria

1. WHEN an unauthenticated request is made to the Upload_API, THE Upload_API SHALL return a 401 status
2. WHEN an authenticated admin user uploads a file, THE Upload_API SHALL process the upload normally
3. THE Upload_API SHALL validate the user session using the existing auth system

### Requirement 4: Booking Status API Rate Limiting

**User Story:** As a system administrator, I want the booking status API to be rate limited, so that I can prevent enumeration attacks on booking IDs.

#### Acceptance Criteria

1. WHEN a client checks booking status, THE Booking_Status_API SHALL check the rate limit before processing
2. WHEN a client exceeds 10 requests per minute, THE Booking_Status_API SHALL return a 429 status
3. WHEN rate limiting is applied, THE Booking_Status_API SHALL use the "booking-status" key prefix

### Requirement 5: Guest Checkout Authorization

**User Story:** As a guest, I want to complete payment for my booking securely, so that only I can pay for my own booking.

#### Acceptance Criteria

1. WHEN a guest initiates checkout without a verification token, THE Checkout_API SHALL return a 401 status
2. WHEN a guest provides a valid verification token, THE Checkout_API SHALL allow the checkout to proceed
3. WHEN a logged-in user initiates checkout for their own booking, THE Checkout_API SHALL allow the checkout without a token
4. WHEN a verification token is expired, THE Checkout_API SHALL return a 401 status with an appropriate message
5. THE Checkout_API SHALL validate that the token matches the booking being paid for

### Requirement 6: Booking Confirmation Page Authorization

**User Story:** As a guest, I want my booking details to be protected, so that only I can view my booking information.

#### Acceptance Criteria

1. WHEN accessing the confirmation page without authentication or token, THE Confirmation_Page SHALL redirect to the booking lookup page
2. WHEN accessing with a valid lookup token, THE Confirmation_Page SHALL display the booking details
3. WHEN accessing as a logged-in user who owns the booking, THE Confirmation_Page SHALL display the booking details
4. WHEN the booking ID/ref does not match the authenticated user or token, THE Confirmation_Page SHALL show an access denied message

### Requirement 7: Phone Number Validation

**User Story:** As a system administrator, I want phone numbers to be validated, so that I can ensure contact information is usable.

#### Acceptance Criteria

1. WHEN a guest enters a phone number during checkout, THE Checkout_Form SHALL validate the format
2. THE Phone_Validator SHALL accept Philippine mobile numbers (09XX-XXX-XXXX or +639XX-XXX-XXXX)
3. THE Phone_Validator SHALL accept Philippine landline numbers with area codes
4. WHEN an invalid phone number is entered, THE Checkout_Form SHALL display a validation error
5. THE Phone_Validator SHALL strip non-numeric characters except the leading plus sign before validation

### Requirement 8: Guest Count Validation

**User Story:** As a system administrator, I want guest counts to be validated against room capacity, so that overbooking is prevented.

#### Acceptance Criteria

1. WHEN a guest selects more guests than the room capacity, THE Booking_System SHALL prevent the booking
2. WHEN validating guest count, THE Booking_System SHALL check each room's capacity individually
3. WHEN guest count exceeds capacity, THE Booking_System SHALL display a clear error message
4. THE Booking_System SHALL validate guest count both on the client and server side

### Requirement 9: Email API Security Enhancement

**User Story:** As a system administrator, I want the internal email API to have stronger authentication, so that it cannot be abused by external actors.

#### Acceptance Criteria

1. THE Email_API SHALL validate requests using a cryptographically secure comparison
2. THE Email_API SHALL use timing-safe string comparison to prevent timing attacks
3. WHEN the internal secret is missing or invalid, THE Email_API SHALL return a 401 status
4. THE Email_API SHALL log failed authentication attempts for monitoring

### Requirement 10: Guest Booking Cancellation Support

**User Story:** As a guest, I want to cancel my booking, so that I can manage my reservation without creating an account.

#### Acceptance Criteria

1. WHEN a guest has a valid verification token, THE Cancellation_System SHALL allow booking cancellation
2. WHEN cancelling a booking, THE Cancellation_System SHALL check the cancellation policy
3. WHEN a booking is within the free cancellation window, THE Cancellation_System SHALL process a full refund
4. WHEN a booking is outside the free cancellation window, THE Cancellation_System SHALL apply the cancellation fee
5. THE Cancellation_System SHALL send a cancellation confirmation email to the guest
6. IF a booking has already been checked in, THEN THE Cancellation_System SHALL reject the cancellation request
