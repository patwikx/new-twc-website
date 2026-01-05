"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { nanoid } from "nanoid";
import { checkUnitAvailabilityInTransaction, TransactionalAvailabilityCheck } from "@/lib/booking/availability";
import { generateVerificationToken } from "@/lib/booking/verification-token";

interface CartItem {
  propertySlug: string;
  roomId: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
}

interface GuestDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  specialRequests?: string;
}

type CreateBookingResult = 
  | {
      success: true;
      bookingId: string;
      shortRef: string;
      totalAmount: number;
      verificationToken: string;  // Short-lived token for guest checkout
      tokenExpiresAt: Date;
    }
  | {
      success: false;
      error: string;
      code?: 'AVAILABILITY_CHANGED' | 'ROOM_UNAVAILABLE' | 'VALIDATION_ERROR';
    };

/**
 * Create a booking from cart items and guest details, performing atomic availability checks and returning either booking information or a structured failure.
 *
 * @param cartItems - Array of items to book; each item must include `roomId`, `checkIn`, `checkOut`, and `guests`.
 * @param guestDetails - Guest contact information and optional `specialRequests` used for the booking record.
 * @returns On success: an object containing `success: true`, `bookingId`, `shortRef`, `totalAmount`, `verificationToken`, and `tokenExpiresAt`. On failure: an object containing `success: false`, an `error` message, and optional `code` set to `'AVAILABILITY_CHANGED' | 'ROOM_UNAVAILABLE' | 'VALIDATION_ERROR'`.
 */
export async function createBooking(
  cartItems: CartItem[],
  guestDetails: GuestDetails
): Promise<CreateBookingResult> {
  try {
    // Validate inputs
    if (!cartItems || cartItems.length === 0) {
      return { success: false, error: "Cart is empty", code: 'VALIDATION_ERROR' };
    }

    if (!guestDetails.firstName || !guestDetails.lastName || !guestDetails.email || !guestDetails.phone) {
      return { success: false, error: "Please fill in all required guest details", code: 'VALIDATION_ERROR' };
    }

    // Get current user (optional - guest checkout allowed)
    const session = await auth();
    const userId = session?.user?.id;

    // Fetch room details and calculate pricing
    const roomIds = cartItems.map(item => item.roomId);
    const rooms = await db.room.findMany({
      where: { id: { in: roomIds } },
      include: { property: true }
    });

    if (rooms.length !== roomIds.length) {
      return { success: false, error: "Some rooms are no longer available", code: 'ROOM_UNAVAILABLE' };
    }

    // Create room lookup map
    const roomMap = new Map(rooms.map(room => [room.id, room]));

    // Calculate totals before transaction
    let subtotal = 0;
    const bookingItems: {
      roomId: string;
      checkIn: Date;
      checkOut: Date;
      guests: number;
      pricePerNight: number;
      nights: number;
    }[] = [];

    for (const item of cartItems) {
      const room = roomMap.get(item.roomId);
      if (!room) continue;

      const checkIn = new Date(item.checkIn);
      const checkOut = new Date(item.checkOut);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      
      if (nights <= 0) {
        return { success: false, error: "Invalid check-in/check-out dates", code: 'VALIDATION_ERROR' };
      }

      const pricePerNight = Number(room.price);
      const itemTotal = pricePerNight * nights;
      subtotal += itemTotal;

      bookingItems.push({
        roomId: item.roomId,
        checkIn,
        checkOut,
        guests: item.guests,
        pricePerNight,
        nights
      });
    }

    // Calculate service charge and tax (12% VAT)
    const serviceChargeRate = 0.10; // 10%
    const taxRate = 0.12; // 12% VAT
    
    const serviceCharge = subtotal * serviceChargeRate;
    const taxAmount = (subtotal + serviceCharge) * taxRate;
    const totalAmount = subtotal + serviceCharge + taxAmount;

    // Generate short reference
    const shortRef = `TWC-${nanoid(6).toUpperCase()}`;

    // Get first room's property for reference
    const firstRoom = roomMap.get(cartItems[0].roomId);

    // Prepare availability checks for transaction
    const availabilityChecks: TransactionalAvailabilityCheck[] = cartItems.map(item => ({
      roomTypeId: item.roomId,
      checkIn: new Date(item.checkIn),
      checkOut: new Date(item.checkOut)
    }));

    // Create booking with transactional availability check
    // This ensures atomicity and prevents race conditions (Property 6)
    const result = await db.$transaction(async (tx) => {
      // Re-check availability within transaction before creating booking
      // This is the final availability check that prevents overselling
      const availabilityResults = await checkUnitAvailabilityInTransaction(tx, availabilityChecks);
      
      // Check if any rooms are unavailable
      const unavailableRooms: string[] = [];
      for (const availability of availabilityResults) {
        if (!availability.available) {
          const room = roomMap.get(availability.roomTypeId);
          unavailableRooms.push(room?.name || availability.roomTypeId);
        }
      }
      
      if (unavailableRooms.length > 0) {
        // Availability changed since initial check - throw to rollback transaction
        throw new Error(`AVAILABILITY_CHANGED:${unavailableRooms.join(', ')}`);
      }

      // Create booking with items
      const booking = await tx.booking.create({
        data: {
          shortRef,
          userId,
          guestFirstName: guestDetails.firstName,
          guestLastName: guestDetails.lastName,
          guestEmail: guestDetails.email,
          guestPhone: guestDetails.phone,
          specialRequests: guestDetails.specialRequests,
          totalAmount,
          taxAmount,
          serviceCharge,
          amountPaid: 0,
          amountDue: totalAmount,
          currency: "PHP",
          status: "PENDING",
          paymentStatus: "UNPAID",
          propertyId: firstRoom?.propertyId,
          items: {
            create: bookingItems.map(item => ({
              roomId: item.roomId,
              checkIn: item.checkIn,
              checkOut: item.checkOut,
              guests: item.guests,
              pricePerNight: item.pricePerNight
            }))
          }
        }
      });

      return booking;
    }, { isolationLevel: 'Serializable' });

    // Generate verification token for guest checkout (outside transaction)
    const { token: verificationToken, expiresAt: tokenExpiresAt } = 
      await generateVerificationToken(result.id);

    return {
      success: true,
      bookingId: result.id,
      shortRef: result.shortRef,
      totalAmount: Number(totalAmount),
      verificationToken,
      tokenExpiresAt
    };

  } catch (error: any) {
    console.error("Error creating booking:", error);
    
    // Check if this is an availability changed error
    if (error.message?.startsWith('AVAILABILITY_CHANGED:')) {
      const roomNames = error.message.replace('AVAILABILITY_CHANGED:', '');
      return { 
        success: false, 
        error: `Sorry, the following room(s) were just booked: ${roomNames}. Please select different dates or room types.`,
        code: 'AVAILABILITY_CHANGED'
      };
    }
    
    return { success: false, error: "Failed to create booking. Please try again." };
  }
}