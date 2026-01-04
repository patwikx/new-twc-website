# Requirements Document

## Introduction

This feature enables guests who completed checkout without creating an account to look up and view their booking details. It also enhances the booking confirmation email to include a direct, secure link for guests to access their booking without needing to log in.

## Glossary

- **Guest**: A user who makes a booking without creating an account (no userId linked to booking)
- **Booking_Lookup_System**: The system component that validates guest identity and retrieves booking information
- **Short_Reference**: A unique booking identifier in format "TWC-XXXXXX" (e.g., TWC-ABC123)
- **Lookup_Token**: A secure, time-limited token embedded in confirmation emails for direct booking access
- **Email_System**: The system component responsible for sending booking confirmation emails

## Requirements

### Requirement 1: Guest Booking Lookup Page

**User Story:** As a guest who booked without an account, I want to look up my booking using my reference number and email, so that I can view my reservation details.

#### Acceptance Criteria

1. WHEN a guest visits the booking lookup page, THE Booking_Lookup_System SHALL display a form requesting Short_Reference and email address
2. WHEN a guest submits valid Short_Reference and matching email, THE Booking_Lookup_System SHALL display the full booking details
3. WHEN a guest submits a Short_Reference with non-matching email, THE Booking_Lookup_System SHALL display a generic "Booking not found" error without revealing whether the reference exists
4. WHEN a guest submits an invalid or non-existent Short_Reference, THE Booking_Lookup_System SHALL display a generic "Booking not found" error
5. IF the lookup form is submitted with empty fields, THEN THE Booking_Lookup_System SHALL display validation errors for required fields
6. WHEN booking details are displayed, THE Booking_Lookup_System SHALL show property name, room details, check-in/check-out dates, guest count, total amount, and payment status

### Requirement 2: Booking Details View for Guests

**User Story:** As a guest viewing my booking, I want to see all relevant reservation information and download my receipt, so that I have a record of my stay.

#### Acceptance Criteria

1. WHEN a guest successfully looks up their booking, THE Booking_Lookup_System SHALL display the booking status (PENDING, CONFIRMED, CANCELLED, COMPLETED)
2. WHEN a guest views a CONFIRMED booking, THE Booking_Lookup_System SHALL provide a button to download the PDF receipt
3. WHEN a guest views their booking, THE Booking_Lookup_System SHALL display the property policies relevant to their stay
4. WHEN a guest views their booking, THE Booking_Lookup_System SHALL show a link to return to the lookup form for checking another booking

### Requirement 3: Enhanced Confirmation Email with Direct Access Link

**User Story:** As a guest who just completed a booking, I want to receive an email with a direct link to view my booking, so that I can easily access my reservation without remembering my reference number.

#### Acceptance Criteria

1. WHEN a booking payment is confirmed, THE Email_System SHALL send a confirmation email containing a secure Lookup_Token link
2. THE Lookup_Token SHALL be valid for 30 days from the booking creation date
3. WHEN a guest clicks the Lookup_Token link, THE Booking_Lookup_System SHALL display the booking details without requiring email verification
4. IF a guest clicks an expired Lookup_Token link, THEN THE Booking_Lookup_System SHALL redirect to the manual lookup form with a message indicating the link has expired
5. THE Email_System SHALL include the Short_Reference prominently in the confirmation email for manual lookup fallback
6. THE Email_System SHALL include a "View Your Booking" button that uses the Lookup_Token link

### Requirement 4: Lookup Token Security

**User Story:** As a system administrator, I want booking lookup tokens to be secure and time-limited, so that guest booking information is protected.

#### Acceptance Criteria

1. THE Booking_Lookup_System SHALL generate Lookup_Tokens using cryptographically secure random generation
2. THE Lookup_Token SHALL be stored as a hash in the database, not in plain text
3. WHEN a Lookup_Token is used, THE Booking_Lookup_System SHALL validate it against the stored hash
4. IF a Lookup_Token has expired, THEN THE Booking_Lookup_System SHALL reject access and require manual verification
5. THE Booking_Lookup_System SHALL rate-limit lookup attempts to prevent brute-force attacks (maximum 5 attempts per IP per minute)

### Requirement 5: Lookup Page Navigation

**User Story:** As a guest, I want to easily find the booking lookup page, so that I can check my reservation status.

#### Acceptance Criteria

1. THE Booking_Lookup_System SHALL be accessible at the URL path `/bookings/lookup`
2. WHEN an unauthenticated user visits `/bookings`, THE Booking_Lookup_System SHALL display a link to the lookup page alongside the login prompt
3. THE booking confirmation page SHALL include a link to the lookup page for future reference
