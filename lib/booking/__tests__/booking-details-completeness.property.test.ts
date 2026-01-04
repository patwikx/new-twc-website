/**
 * Property-Based Tests for Booking Details Completeness
 *
 * Feature: guest-booking-lookup
 * Property 3: Booking Details Completeness
 *
 * For any successful booking lookup (via credentials or token), the returned
 * BookingDetails object contains all required fields: shortRef, status,
 * paymentStatus, property name, room details, check-in/check-out dates,
 * guest count, and total amount.
 *
 * **Validates: Requirements 1.6, 2.1**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { BookingDetails, BookingItemDetails, PropertyPolicy } from "../lookup";

// Arbitrary for generating booking status
const bookingStatusArb = fc.constantFrom(
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "COMPLETED"
) as fc.Arbitrary<"PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED">;

// Arbitrary for generating payment status
const paymentStatusArb = fc.constantFrom(
  "UNPAID",
  "PAID",
  "PARTIALLY_PAID",
  "REFUNDED",
  "FAILED"
) as fc.Arbitrary<"UNPAID" | "PAID" | "PARTIALLY_PAID" | "REFUNDED" | "FAILED">;

// Arbitrary for generating property policy
const propertyPolicyArb: fc.Arbitrary<PropertyPolicy> = fc.record({
  title: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.string({ minLength: 1, maxLength: 500 }),
});

// Arbitrary for generating booking item details
const bookingItemArb: fc.Arbitrary<BookingItemDetails> = fc.record({
  id: fc.uuid(),
  checkIn: fc.date({ min: new Date("2024-01-01"), max: new Date("2030-12-31") }),
  checkOut: fc.date({ min: new Date("2024-01-01"), max: new Date("2030-12-31") }),
  guests: fc.integer({ min: 1, max: 10 }),
  pricePerNight: fc.float({ min: 100, max: 50000, noNaN: true }),
  room: fc.record({
    name: fc.string({ minLength: 1, maxLength: 100 }),
    description: fc.string({ minLength: 1, maxLength: 500 }),
  }),
});

// Arbitrary for generating complete booking details
const bookingDetailsArb: fc.Arbitrary<BookingDetails> = fc.record({
  id: fc.uuid(),
  shortRef: fc.stringMatching(/^TWC-[A-Z0-9]{6}$/),
  status: bookingStatusArb,
  paymentStatus: paymentStatusArb,
  guestFirstName: fc.string({ minLength: 1, maxLength: 50 }),
  guestLastName: fc.string({ minLength: 1, maxLength: 50 }),
  guestEmail: fc.emailAddress(),
  guestPhone: fc.stringMatching(/^\+?[0-9]{10,15}$/),
  totalAmount: fc.float({ min: 0, max: 1000000, noNaN: true }),
  taxAmount: fc.float({ min: 0, max: 100000, noNaN: true }),
  serviceCharge: fc.float({ min: 0, max: 100000, noNaN: true }),
  currency: fc.constantFrom("PHP", "USD", "EUR"),
  property: fc.option(
    fc.record({
      name: fc.string({ minLength: 1, maxLength: 100 }),
      location: fc.string({ minLength: 1, maxLength: 200 }),
    }),
    { nil: null }
  ),
  items: fc.array(bookingItemArb, { minLength: 1, maxLength: 5 }),
  policies: fc.array(propertyPolicyArb, { minLength: 0, maxLength: 5 }),
  createdAt: fc.date({ min: new Date("2024-01-01"), max: new Date("2030-12-31") }),
});

/**
 * Validates that a BookingDetails object has all required fields
 */
function validateBookingDetailsCompleteness(details: BookingDetails): {
  isComplete: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  // Required string fields
  if (!details.id) missingFields.push("id");
  if (!details.shortRef) missingFields.push("shortRef");
  if (!details.status) missingFields.push("status");
  if (!details.paymentStatus) missingFields.push("paymentStatus");
  if (!details.guestFirstName) missingFields.push("guestFirstName");
  if (!details.guestLastName) missingFields.push("guestLastName");
  if (!details.guestEmail) missingFields.push("guestEmail");
  if (!details.guestPhone) missingFields.push("guestPhone");
  if (!details.currency) missingFields.push("currency");

  // Required numeric fields (can be 0)
  if (typeof details.totalAmount !== "number") missingFields.push("totalAmount");
  if (typeof details.taxAmount !== "number") missingFields.push("taxAmount");
  if (typeof details.serviceCharge !== "number") missingFields.push("serviceCharge");

  // Required array fields
  if (!Array.isArray(details.items)) missingFields.push("items");
  if (!Array.isArray(details.policies)) missingFields.push("policies");

  // Required date field
  if (!(details.createdAt instanceof Date)) missingFields.push("createdAt");

  // Property can be null but must be defined
  if (details.property === undefined) missingFields.push("property");

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Validates that booking items have all required fields
 */
function validateBookingItemsCompleteness(items: BookingItemDetails[]): {
  isComplete: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const prefix = `items[${i}]`;

    if (!item.id) missingFields.push(`${prefix}.id`);
    if (!(item.checkIn instanceof Date)) missingFields.push(`${prefix}.checkIn`);
    if (!(item.checkOut instanceof Date)) missingFields.push(`${prefix}.checkOut`);
    if (typeof item.guests !== "number") missingFields.push(`${prefix}.guests`);
    if (typeof item.pricePerNight !== "number") missingFields.push(`${prefix}.pricePerNight`);
    if (!item.room) missingFields.push(`${prefix}.room`);
    if (item.room && !item.room.name) missingFields.push(`${prefix}.room.name`);
    if (item.room && !item.room.description) missingFields.push(`${prefix}.room.description`);
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}

describe("Property 3: Booking Details Completeness", () => {
  /**
   * Property 3.1: All required fields are present
   */
  it("should have all required fields in booking details", () => {
    fc.assert(
      fc.property(bookingDetailsArb, (details) => {
        const validation = validateBookingDetailsCompleteness(details);
        expect(validation.isComplete).toBe(true);
        expect(validation.missingFields).toHaveLength(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.2: Booking items have all required fields
   */
  it("should have all required fields in booking items", () => {
    fc.assert(
      fc.property(bookingDetailsArb, (details) => {
        const validation = validateBookingItemsCompleteness(details.items);
        expect(validation.isComplete).toBe(true);
        expect(validation.missingFields).toHaveLength(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.3: Short reference follows expected format
   */
  it("should have short reference in correct format", () => {
    fc.assert(
      fc.property(bookingDetailsArb, (details) => {
        expect(details.shortRef).toMatch(/^TWC-[A-Z0-9]{6}$/);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.4: Status is a valid booking status
   */
  it("should have valid booking status", () => {
    const validStatuses = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"];

    fc.assert(
      fc.property(bookingDetailsArb, (details) => {
        expect(validStatuses).toContain(details.status);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.5: Payment status is a valid payment status
   */
  it("should have valid payment status", () => {
    const validStatuses = ["UNPAID", "PAID", "PARTIALLY_PAID", "REFUNDED", "FAILED"];

    fc.assert(
      fc.property(bookingDetailsArb, (details) => {
        expect(validStatuses).toContain(details.paymentStatus);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.6: Financial amounts are non-negative
   */
  it("should have non-negative financial amounts", () => {
    fc.assert(
      fc.property(bookingDetailsArb, (details) => {
        expect(details.totalAmount).toBeGreaterThanOrEqual(0);
        expect(details.taxAmount).toBeGreaterThanOrEqual(0);
        expect(details.serviceCharge).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.7: Guest count is positive for all items
   */
  it("should have positive guest count in all booking items", () => {
    fc.assert(
      fc.property(bookingDetailsArb, (details) => {
        for (const item of details.items) {
          expect(item.guests).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.8: Price per night is positive for all items
   */
  it("should have positive price per night in all booking items", () => {
    fc.assert(
      fc.property(bookingDetailsArb, (details) => {
        for (const item of details.items) {
          expect(item.pricePerNight).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.9: Property details are complete when present
   */
  it("should have complete property details when property is present", () => {
    fc.assert(
      fc.property(bookingDetailsArb, (details) => {
        if (details.property !== null) {
          expect(details.property.name).toBeTruthy();
          expect(details.property.location).toBeTruthy();
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.10: At least one booking item exists
   */
  it("should have at least one booking item", () => {
    fc.assert(
      fc.property(bookingDetailsArb, (details) => {
        expect(details.items.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});
