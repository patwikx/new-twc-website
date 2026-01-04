/**
 * Payment Amount Re-verification Service
 * 
 * Provides price verification to ensure booking totals match current room prices.
 * Used during checkout to detect price changes that occurred after booking creation.
 */

import { db } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";

// Maximum allowed price difference percentage (1%)
const MAX_PRICE_DIFFERENCE_PERCENT = 1;

export interface PriceVerificationResult {
  valid: boolean;
  storedTotal: number;
  calculatedTotal: number;
  difference: number;
  percentageDiff: number;
  reason?: string;
}

export interface BookingItemForVerification {
  checkIn: Date;
  checkOut: Date;
  pricePerNight: Decimal | number;
  room: {
    price: Decimal | number;
  };
}

/**
 * Calculate the number of nights between check-in and check-out dates
 * 
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns Number of nights
 */
export function calculateNights(checkIn: Date, checkOut: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffMs = checkOut.getTime() - checkIn.getTime();
  return Math.max(1, Math.ceil(diffMs / msPerDay));
}

/**
 * Calculate the total price for a booking item based on current room prices
 * 
 * @param item - Booking item with room price information
 * @returns Calculated total for this item
 */
export function calculateItemTotal(item: BookingItemForVerification): number {
  const nights = calculateNights(item.checkIn, item.checkOut);
  const currentPrice = typeof item.room.price === 'number' 
    ? item.room.price 
    : Number(item.room.price);
  return nights * currentPrice;
}

/**
 * Calculate the percentage difference between two values
 * 
 * @param stored - The stored/original value
 * @param calculated - The newly calculated value
 * @returns Percentage difference (absolute value)
 */
export function calculatePercentageDiff(stored: number, calculated: number): number {
  if (stored === 0) {
    return calculated === 0 ? 0 : 100;
  }
  return Math.abs((calculated - stored) / stored) * 100;
}

/**
 * Check if the price difference is within acceptable tolerance
 * 
 * @param percentageDiff - The percentage difference
 * @param maxPercent - Maximum allowed percentage (default 1%)
 * @returns true if within tolerance
 */
export function isWithinTolerance(
  percentageDiff: number, 
  maxPercent: number = MAX_PRICE_DIFFERENCE_PERCENT
): boolean {
  return percentageDiff <= maxPercent;
}

/**
 * Verify that a booking's stored total matches the current room prices
 * 
 * @param bookingId - The booking ID to verify
 * @returns PriceVerificationResult with comparison details
 */
export async function verifyBookingAmount(
  bookingId: string
): Promise<PriceVerificationResult> {
  // Fetch booking with items and current room prices
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      items: {
        include: {
          room: {
            select: { price: true }
          }
        }
      }
    }
  });

  if (!booking) {
    return {
      valid: false,
      storedTotal: 0,
      calculatedTotal: 0,
      difference: 0,
      percentageDiff: 0,
      reason: "Booking not found"
    };
  }

  const storedTotal = Number(booking.totalAmount);
  
  // Calculate total from current room prices
  let calculatedSubtotal = 0;
  for (const item of booking.items) {
    calculatedSubtotal += calculateItemTotal(item);
  }

  // Apply tax and service charge rates from property or defaults
  // Note: We compare against the stored total which already includes tax/service
  // For simplicity, we'll compare the base amounts and apply the same rates
  const taxRate = 0.12; // 12% VAT
  const serviceChargeRate = 0.10; // 10% service charge
  
  const calculatedTax = calculatedSubtotal * taxRate;
  const calculatedServiceCharge = calculatedSubtotal * serviceChargeRate;
  const calculatedTotal = calculatedSubtotal + calculatedTax + calculatedServiceCharge;

  const difference = calculatedTotal - storedTotal;
  const percentageDiff = calculatePercentageDiff(storedTotal, calculatedTotal);
  const valid = isWithinTolerance(percentageDiff);

  return {
    valid,
    storedTotal,
    calculatedTotal,
    difference,
    percentageDiff,
    reason: valid ? undefined : "Price has changed since booking was created"
  };
}

/**
 * Pure function version of price verification for testing
 * Takes pre-fetched data instead of querying the database
 * 
 * @param storedTotal - The stored total amount
 * @param items - Array of booking items with room prices
 * @param taxRate - Tax rate (default 12%)
 * @param serviceChargeRate - Service charge rate (default 10%)
 * @returns PriceVerificationResult
 */
export function verifyBookingAmountPure(
  storedTotal: number,
  items: BookingItemForVerification[],
  taxRate: number = 0.12,
  serviceChargeRate: number = 0.10
): PriceVerificationResult {
  // Calculate total from current room prices
  let calculatedSubtotal = 0;
  for (const item of items) {
    calculatedSubtotal += calculateItemTotal(item);
  }

  const calculatedTax = calculatedSubtotal * taxRate;
  const calculatedServiceCharge = calculatedSubtotal * serviceChargeRate;
  const calculatedTotal = calculatedSubtotal + calculatedTax + calculatedServiceCharge;

  const difference = calculatedTotal - storedTotal;
  const percentageDiff = calculatePercentageDiff(storedTotal, calculatedTotal);
  const valid = isWithinTolerance(percentageDiff);

  return {
    valid,
    storedTotal,
    calculatedTotal,
    difference,
    percentageDiff,
    reason: valid ? undefined : "Price has changed since booking was created"
  };
}
