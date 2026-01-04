# Design Document: Booking Security Enhancements

## Overview

This design addresses critical security vulnerabilities and missing features in the public-facing booking system. The implementation focuses on rate limiting, input validation, booking lifecycle management, and security hardening while maintaining backward compatibility with the existing booking flow.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Public Booking Flow                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────────────┐   │
│  │  Client  │───▶│ Rate Limiter │───▶│ Availability Service    │   │
│  └──────────┘    └──────────────┘    └─────────────────────────┘   │
│       │                                         │                   │
│       ▼                                         ▼                   │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────────┐   │
│  │ Booking      │───▶│ Verification │───▶│ Payment Gateway     │   │
│  │ Creation     │    │ Token        │    │ (PayMongo)          │   │
│  └──────────────┘    └──────────────┘    └─────────────────────┘   │
│                                                   │                 │
│                                                   ▼                 │
│                           ┌─────────────────────────────────────┐   │
│                           │ Expiration Service (Background Job) │   │
│                           └─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Rate Limiter Enhancement

Extends the existing `lib/rate-limit/index.ts` to support different rate limit configurations per endpoint.

```typescript
interface RateLimitConfig {
  identifier: string;      // IP address or user ID
  limit: number;           // Max requests
  windowMs: number;        // Time window in ms
  keyPrefix?: string;      // Namespace for different endpoints
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;     // Seconds until reset (when blocked)
}
```

### 2. Availability Service

New service at `lib/booking/availability.ts` for room availability checking.

```typescript
interface AvailabilityCheck {
  roomId: string;
  checkIn: Date;
  checkOut: Date;
}

interface AvailabilityResult {
  available: boolean;
  conflictingBookings?: string[];  // Booking IDs if not available
}

// Main function
async function checkRoomAvailability(
  checks: AvailabilityCheck[]
): Promise<Map<string, AvailabilityResult>>;
```

### 3. Booking Verification Token Service

New service at `lib/booking/verification-token.ts` for short-lived checkout tokens.

```typescript
interface VerificationToken {
  token: string;           // Plain token (returned to client)
  expiresAt: Date;         // 15 minutes from creation
}

// Generate token when booking is created
async function generateVerificationToken(bookingId: string): Promise<VerificationToken>;

// Validate token at checkout
async function validateVerificationToken(token: string): Promise<{
  valid: boolean;
  bookingId?: string;
  expired?: boolean;
}>;
```

### 4. Booking Expiration Service

New service at `lib/booking/expiration.ts` for automatic booking cleanup.

```typescript
interface ExpirationResult {
  expiredCount: number;
  bookingIds: string[];
}

// Run periodically (every 5 minutes)
async function expireStaleBookings(): Promise<ExpirationResult>;
```

### 5. Password Validator

Enhanced validation at `schemas/password.ts`.

```typescript
interface PasswordValidationResult {
  valid: boolean;
  errors: string[];  // Specific requirements not met
}

const PasswordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");
```

### 6. Payment Amount Verifier

New utility at `lib/booking/price-verification.ts`.

```typescript
interface PriceVerificationResult {
  valid: boolean;
  storedTotal: number;
  calculatedTotal: number;
  difference: number;
  percentageDiff: number;
}

async function verifyBookingAmount(bookingId: string): Promise<PriceVerificationResult>;
```

## Data Models

### BookingVerificationToken (New Prisma Model)

```prisma
model BookingVerificationToken {
  id        String   @id @default(uuid())
  bookingId String
  booking   Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  tokenHash String   @unique  // SHA-256 hash
  expiresAt DateTime           // 15 minutes from creation
  createdAt DateTime @default(now())

  @@index([bookingId])
  @@index([expiresAt])
}
```

### Booking Model Updates

Add relation to verification tokens:
```prisma
model Booking {
  // ... existing fields
  verificationTokens BookingVerificationToken[]
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Rate Limiting Enforcement

*For any* IP address making requests to a rate-limited endpoint, if the number of requests within the time window exceeds the configured limit, all subsequent requests SHALL be rejected until the window resets.

**Validates: Requirements 1.1, 1.2, 2.1, 2.2**

### Property 2: Availability Check Prevents Double Booking

*For any* room and date range, if a CONFIRMED or PENDING booking exists with overlapping dates, the Availability_Service SHALL return `available: false`.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 3: Booking Expiration Timing

*For any* booking in PENDING status with UNPAID payment status, if the booking was created more than 30 minutes ago, the Expiration_Service SHALL mark it as CANCELLED with EXPIRED payment status.

**Validates: Requirements 6.1, 6.2**

### Property 4: Verification Token Security

*For any* verification token, hashing the plain token with SHA-256 SHALL produce the stored tokenHash, and the token SHALL only be valid before its expiresAt timestamp.

**Validates: Requirements 8.3, 8.4, 8.5**

### Property 5: Password Complexity Enforcement

*For any* password string, the Password_Validator SHALL reject it if it does not contain at least 8 characters, one uppercase letter, one lowercase letter, and one number.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 6: Price Verification Consistency

*For any* booking, if the re-calculated total from current room prices differs from the stored total by more than 1%, the Payment_Gateway SHALL reject the checkout request.

**Validates: Requirements 7.1, 7.2**

### Property 7: Ownership Verification for Checkout

*For any* checkout request, if the requester is authenticated, their email SHALL match the booking's guestEmail; if unauthenticated, a valid verification token SHALL be required.

**Validates: Requirements 3.2, 3.3, 3.4**

### Property 8: Partially Paid Bookings Not Expired

*For any* booking with paymentStatus of PARTIALLY_PAID, the Expiration_Service SHALL NOT mark it as expired regardless of creation time.

**Validates: Requirements 6.5**

## Error Handling

### Rate Limiting Errors
- Return HTTP 429 with `Retry-After` header
- Response body: `{ error: "Too many requests. Please try again later.", retryAfter: <seconds> }`

### Availability Errors
- Return HTTP 409 Conflict for unavailable rooms
- Response body: `{ error: "Room is not available for the selected dates. Please choose different dates." }`

### Verification Token Errors
- Return HTTP 403 Forbidden for invalid/expired tokens
- Generic message: `{ error: "Unable to process request. Please try again." }`

### Price Mismatch Errors
- Return HTTP 409 Conflict
- Response body: `{ error: "Room prices have changed. Please refresh your booking and try again." }`

### Password Validation Errors
- Return HTTP 400 with specific requirements not met
- Response body: `{ error: "Password does not meet requirements", details: ["Must contain uppercase letter", ...] }`

## Testing Strategy

### Unit Tests
- Password validation edge cases (exactly 8 chars, boundary conditions)
- Token expiration boundary (exactly 15 minutes)
- Rate limit window boundaries
- Date overlap detection edge cases

### Property-Based Tests
- Rate limiting enforcement across random request patterns
- Availability check with random overlapping date ranges
- Token generation produces unique, high-entropy values
- Password validation rejects all non-compliant passwords
- Expiration service only affects eligible bookings

### Integration Tests
- Full checkout flow with rate limiting
- Booking creation with availability check
- Payment flow with ownership verification
- Background expiration job execution

### Test Configuration
- Property tests: minimum 100 iterations
- Use fast-check for TypeScript property-based testing
- Tag format: **Feature: booking-security-enhancements, Property {N}: {description}**
