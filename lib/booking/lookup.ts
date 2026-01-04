/**
 * Booking Lookup Service
 *
 * Provides secure lookup functionality for guest bookings via:
 * 1. Manual lookup using short reference + email verification
 * 2. Token-based direct access from confirmation emails
 *
 * Security: Returns null/generic errors for all invalid lookups to prevent
 * information leakage about which bookings exist.
 */

import { db } from "@/lib/db";
import { validateToken } from "./lookup-token";
import type { BookingStatus, PaymentStatus } from "@prisma/client";

// Generic error message for all lookup failures (prevents information leakage)
export const LOOKUP_ERROR_MESSAGE =
  "Booking not found. Please check your reference number and email.";

/**
 * Booking details returned from successful lookups
 */
export interface BookingDetails {
  id: string;
  shortRef: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone: string;
  totalAmount: number;
  taxAmount: number;
  serviceCharge: number;
  currency: string;
  property: {
    name: string;
    location: string;
  } | null;
  items: BookingItemDetails[];
  policies: PropertyPolicy[];
  createdAt: Date;
}

export interface BookingItemDetails {
  id: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  pricePerNight: number;
  room: {
    name: string;
    description: string;
  };
}

export interface PropertyPolicy {
  title: string;
  description: string;
}

/**
 * Result type for token-based lookup
 */
export interface TokenLookupResult {
  booking: BookingDetails | null;
  expired: boolean;
}

/**
 * Look up a booking by short reference and email
 * Uses case-insensitive email comparison
 * Returns null for any invalid lookup (no information leakage)
 *
 * @param shortRef - The booking short reference (e.g., "TWC-ABC123")
 * @param email - The guest email address
 * @returns BookingDetails if found and email matches, null otherwise
 */
export async function lookupByCredentials(
  shortRef: string,
  email: string
): Promise<BookingDetails | null> {
  if (!shortRef || !email) {
    return null;
  }

  const booking = await db.booking.findUnique({
    where: { shortRef },
    include: {
      property: {
        include: {
          policies: true,
        },
      },
      items: {
        include: {
          room: true,
        },
      },
    },
  });

  // Booking not found
  if (!booking) {
    return null;
  }

  // Case-insensitive email comparison
  if (booking.guestEmail.toLowerCase() !== email.toLowerCase()) {
    return null;
  }

  return mapBookingToDetails(booking);
}

/**
 * Look up a booking by secure token
 * Does not require email verification (token is proof of access)
 * Returns expired flag if token has expired
 *
 * @param token - The plain lookup token from the email link
 * @returns TokenLookupResult with booking details or expired flag
 */
export async function lookupByToken(token: string): Promise<TokenLookupResult> {
  if (!token) {
    return { booking: null, expired: false };
  }

  const validation = await validateToken(token);

  // Token not found or invalid
  if (!validation.valid) {
    return {
      booking: null,
      expired: validation.expired ?? false,
    };
  }

  // Token valid, fetch booking details
  const booking = await getBookingDetails(validation.bookingId!);

  return {
    booking,
    expired: false,
  };
}

/**
 * Get full booking details by ID
 * Used internally after successful authentication
 *
 * @param bookingId - The booking UUID
 * @returns BookingDetails or null if not found
 */
export async function getBookingDetails(
  bookingId: string
): Promise<BookingDetails | null> {
  if (!bookingId) {
    return null;
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      property: {
        include: {
          policies: true,
        },
      },
      items: {
        include: {
          room: true,
        },
      },
    },
  });

  if (!booking) {
    return null;
  }

  return mapBookingToDetails(booking);
}


/**
 * Maps a Prisma booking result to the BookingDetails interface
 */
function mapBookingToDetails(
  booking: {
    id: string;
    shortRef: string;
    status: BookingStatus;
    paymentStatus: PaymentStatus;
    guestFirstName: string;
    guestLastName: string;
    guestEmail: string;
    guestPhone: string;
    totalAmount: { toNumber(): number } | number;
    taxAmount: { toNumber(): number } | number;
    serviceCharge: { toNumber(): number } | number;
    currency: string;
    createdAt: Date;
    property: {
      name: string;
      location: string;
      policies: Array<{ title: string; description: string }>;
    } | null;
    items: Array<{
      id: string;
      checkIn: Date;
      checkOut: Date;
      guests: number;
      pricePerNight: { toNumber(): number } | number;
      room: {
        name: string;
        description: string;
      };
    }>;
  }
): BookingDetails {
  return {
    id: booking.id,
    shortRef: booking.shortRef,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    guestFirstName: booking.guestFirstName,
    guestLastName: booking.guestLastName,
    guestEmail: booking.guestEmail,
    guestPhone: booking.guestPhone,
    totalAmount: toNumber(booking.totalAmount),
    taxAmount: toNumber(booking.taxAmount),
    serviceCharge: toNumber(booking.serviceCharge),
    currency: booking.currency,
    property: booking.property
      ? {
          name: booking.property.name,
          location: booking.property.location,
        }
      : null,
    items: booking.items.map((item) => ({
      id: item.id,
      checkIn: item.checkIn,
      checkOut: item.checkOut,
      guests: item.guests,
      pricePerNight: toNumber(item.pricePerNight),
      room: {
        name: item.room.name,
        description: item.room.description,
      },
    })),
    policies: booking.property?.policies ?? [],
    createdAt: booking.createdAt,
  };
}

/**
 * Helper to convert Prisma Decimal to number
 */
function toNumber(value: { toNumber(): number } | number): number {
  if (typeof value === "number") {
    return value;
  }
  return value.toNumber();
}
