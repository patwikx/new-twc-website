"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { nanoid } from "nanoid";
import { checkRoomAvailability } from "@/lib/booking/availability";
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
    };

export async function createBooking(
  cartItems: CartItem[],
  guestDetails: GuestDetails
): Promise<CreateBookingResult> {
  try {
    // Validate inputs
    if (!cartItems || cartItems.length === 0) {
      return { success: false, error: "Cart is empty" };
    }

    if (!guestDetails.firstName || !guestDetails.lastName || !guestDetails.email || !guestDetails.phone) {
      return { success: false, error: "Please fill in all required guest details" };
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
      return { success: false, error: "Some rooms are no longer available" };
    }

    // Create room lookup map
    const roomMap = new Map(rooms.map(room => [room.id, room]));

    // Check room availability before proceeding
    const availabilityChecks = cartItems.map(item => ({
      roomId: item.roomId,
      checkIn: new Date(item.checkIn),
      checkOut: new Date(item.checkOut)
    }));
    
    const availabilityResults = await checkRoomAvailability(availabilityChecks);
    
    // Check if any rooms are unavailable
    const unavailableRooms: string[] = [];
    for (const [roomId, result] of availabilityResults) {
      if (!result.available) {
        const room = roomMap.get(roomId);
        unavailableRooms.push(room?.name || roomId);
      }
    }
    
    if (unavailableRooms.length > 0) {
      return { 
        success: false, 
        error: `The following room(s) are not available for the selected dates: ${unavailableRooms.join(', ')}. Please choose different dates.` 
      };
    }

    // Calculate totals
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
        return { success: false, error: "Invalid check-in/check-out dates" };
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

    // Create booking with items in transaction
    const booking = await db.booking.create({
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

    // Generate verification token for guest checkout
    const { token: verificationToken, expiresAt: tokenExpiresAt } = 
      await generateVerificationToken(booking.id);

    return {
      success: true,
      bookingId: booking.id,
      shortRef: booking.shortRef,
      totalAmount: Number(totalAmount),
      verificationToken,
      tokenExpiresAt
    };

  } catch (error) {
    console.error("Error creating booking:", error);
    return { success: false, error: "Failed to create booking. Please try again." };
  }
}
