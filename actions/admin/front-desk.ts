"use server"

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { BookingStatus, PaymentStatus, RoomUnitStatus } from "@prisma/client";
import { auth } from "@/auth";

// --- Data Fetching ---

export async function getFrontDeskData(propertyId: string) {
  // 1. Fetch Rooms and their Units
  const rooms = await db.room.findMany({
    where: { propertyId },
    include: {
      property: true, // Include property for tax/service rates
      units: {
        orderBy: { number: 'asc' },
        include: {
           // Get current active usage for this unit
           bookingItems: {
             where: {
               OR: [
                 { 
                   // Current active stay
                   checkIn: { lte: new Date() },
                   checkOut: { gte: new Date() },
                   booking: { status: { in: ['CONFIRMED', 'PENDING'] } } 
                 },
                 {
                   // Future stay starting today (for check-in context)
                   checkIn: { 
                     gte: new Date(new Date().setHours(0,0,0,0)), 
                     lte: new Date(new Date().setHours(23,59,59,999)) 
                    },
                   booking: { status: 'CONFIRMED' }
                 }
               ]
             },
             include: {
               booking: {
                 include: { user: true }
               }
             }
           }
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  // 2. Fetch Unassigned Confirmed Bookings for "Check-in" properties
  // These are bookings that should be happening now or soon but have no unit assigned
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  
  const unassignedBookings = await db.bookingItem.findMany({
    where: {
      room: { propertyId },
      roomUnitId: null,
      booking: {
        status: 'CONFIRMED'
      },
      checkIn: {
        gte: todayStart // Filter for upcoming/today
      }
    },
    include: {
      booking: true,
      room: true
    },
    orderBy: { checkIn: 'asc' }
  });

  return { rooms, unassignedBookings };
}

export async function getBookingFinancials(bookingId: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      payments: { orderBy: { createdAt: 'desc' } },
      adjustments: { orderBy: { createdAt: 'desc' } },
      items: { include: { room: true } }
    }
  });
  
  if (!booking) return null;

  // Serialize Decimal fields for client component
  return {
    ...booking,
    totalAmount: Number(booking.totalAmount),
    taxAmount: Number(booking.taxAmount),
    serviceCharge: Number(booking.serviceCharge),
    amountPaid: Number(booking.amountPaid),
    amountDue: Number(booking.amountDue),
    payments: booking.payments.map(p => ({
      ...p,
      amount: Number(p.amount)
    })),
    adjustments: booking.adjustments.map(a => ({
      ...a,
      amount: Number(a.amount)
    })),
    items: booking.items.map(i => ({
      ...i,
      pricePerNight: Number(i.pricePerNight),
      room: i.room ? {
        ...i.room,
        price: Number(i.room.price)
      } : null
    }))
  };
}

// --- Actions ---

export async function checkInBooking(bookingItemId: string, unitId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  // 1. Link Unit to Booking Item
  await db.bookingItem.update({
    where: { id: bookingItemId },
    data: { roomUnitId: unitId }
  });

  // 2. Update Unit Status to OCCUPIED
  await db.roomUnit.update({
    where: { id: unitId },
    data: { status: 'OCCUPIED' }
  });

  revalidatePath("/admin/front-desk");
  return { success: true };
}

export async function createWalkIn(data: {
  propertyId: string;
  roomTypeId: string;
  unitId: string;
  guestName: string;
  guestEmail: string;
  checkInDate: Date;
  checkOutDate: Date;
  pricePerNight: number;
  initialPayment: number;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  
  // 1. Fetch Property Rates
  const property = await db.property.findUnique({ where: { id: data.propertyId } });
  const taxRate = property?.taxRate ? Number(property.taxRate) : 0;
  const serviceRate = property?.serviceChargeRate ? Number(property.serviceChargeRate) : 0;

  const firstName = data.guestName.split(" ")[0];
  const lastName = data.guestName.split(" ").slice(1).join(" ") || "Guest";

  // 1. Create User (Optional, or find existing)
  let userId = null;
  const existingUser = await db.user.findUnique({ where: { email: data.guestEmail } });
  if (existingUser) userId = existingUser.id;
  
  // 2. Create Booking
  // Generate a short ref
  const shortRef = `WK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  
  // Calculate nights based on provided dates
  const nights = Math.max(1, Math.ceil((data.checkOutDate.getTime() - data.checkInDate.getTime()) / (1000 * 60 * 60 * 24)));
  
  const roomTotal = data.pricePerNight * nights;
  const taxAmount = roomTotal * taxRate;
  const serviceCharge = roomTotal * serviceRate;
  const totalAmount = roomTotal + taxAmount + serviceCharge;
  const amountDue = totalAmount - data.initialPayment;

  const booking = await db.booking.create({
    data: {
      shortRef,
      userId,
      guestFirstName: firstName,
      guestLastName: lastName,
      guestEmail: data.guestEmail,
      guestPhone: "", 
      totalAmount,
      taxAmount, 
      serviceCharge,
      amountPaid: data.initialPayment,
      amountDue,
      status: 'CONFIRMED',
      paymentStatus: amountDue <= 0 ? 'PAID' : (data.initialPayment > 0 ? 'PARTIALLY_PAID' : 'UNPAID'),
      propertyId: data.propertyId,
      createdById: session.user.id,
      
      // Items
      items: {
        create: {
          roomId: data.roomTypeId,
          roomUnitId: data.unitId,
          checkIn: data.checkInDate,
          checkOut: data.checkOutDate,
          guests: 1, 
          pricePerNight: data.pricePerNight
        }
      },

      // Initial Payment
      payments: data.initialPayment > 0 ? {
        create: {
          amount: data.initialPayment,
          status: 'PAID',
          provider: 'CASH', // Default for walk-in
          createdById: session.user.id
        }
      } : undefined
    }
  });

  // 3. Update Unit Status
  await db.roomUnit.update({
    where: { id: data.unitId },
    data: { status: 'OCCUPIED' }
  });

  revalidatePath("/admin/front-desk");
  return { success: true, bookingId: booking.id };
}

export async function addCharge(bookingId: string, amount: number, description: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  // Create Adjustment
  await db.bookingAdjustment.create({
    data: {
      bookingId,
      type: 'CHARGE',
      amount,
      description
    }
  });

  // Update Booking Totals
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (booking) {
    const newTotal = Number(booking.totalAmount) + Number(amount);
    const newDue = Number(booking.amountDue) + Number(amount);
    
    await db.booking.update({
      where: { id: bookingId },
      data: {
        totalAmount: newTotal,
        amountDue: newDue,
        updatedById: session.user.id
      }
    });
  }

  revalidatePath("/admin/front-desk");
  return { success: true };
}

export async function addPayment(bookingId: string, amount: number, method: string, referenceNo?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.payment.create({
    data: {
      bookingId,
      amount,
      status: 'PAID',
      provider: method,
      transactionId: referenceNo || null, // Store reference number
      paidAt: new Date(),
      createdById: session.user.id
    }
  });

  // Update Booking Totals
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (booking) {
    const newPaid = Number(booking.amountPaid) + Number(amount);
    const newDue = Number(booking.totalAmount) - newPaid;
    
    await db.booking.update({
      where: { id: bookingId },
      data: {
        amountPaid: newPaid,
        amountDue: newDue,
        paymentStatus: newDue <= 0 ? 'PAID' : 'PARTIALLY_PAID',
        updatedById: session.user.id
      }
    });
  }

  revalidatePath("/admin/front-desk");
  return { success: true };
}

export async function checkOutUnit(bookingId: string, unitId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.booking.update({
    where: { id: bookingId },
    data: {
      status: 'COMPLETED',
      updatedById: session.user.id
    }
  });

  await db.roomUnit.update({
    where: { id: unitId },
    data: { status: 'DIRTY' }
  });

  revalidatePath("/admin/front-desk");
  return { success: true };
}

export async function transferRoom(data: {
  bookingItemId: string;
  fromUnitId: string;
  toUnitId: string;
  reason?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  // Get the booking item to find the booking
  const bookingItem = await db.bookingItem.findUnique({
    where: { id: data.bookingItemId },
    include: { booking: true, room: true }
  });

  if (!bookingItem) throw new Error("Booking item not found");

  // Get the target unit info
  const toUnit = await db.roomUnit.findUnique({
    where: { id: data.toUnitId },
    include: { roomType: true }
  });

  if (!toUnit || toUnit.status !== 'CLEAN') {
    throw new Error("Target unit is not available");
  }

  // 1. Update the BookingItem to point to the new unit
  await db.bookingItem.update({
    where: { id: data.bookingItemId },
    data: { roomUnitId: data.toUnitId }
  });

  // 2. Mark old unit as DIRTY (needs cleaning)
  await db.roomUnit.update({
    where: { id: data.fromUnitId },
    data: { status: 'DIRTY' }
  });

  // 3. Mark new unit as OCCUPIED
  await db.roomUnit.update({
    where: { id: data.toUnitId },
    data: { status: 'OCCUPIED' }
  });

  // 4. Log the transfer as an adjustment (optional - for record keeping)
  const transferNote = data.reason 
    ? `Room Transfer: ${bookingItem.room.name} → ${toUnit.roomType.name} (${data.reason})`
    : `Room Transfer: ${bookingItem.room.name} → ${toUnit.roomType.name}`;

  await db.bookingAdjustment.create({
    data: {
      bookingId: bookingItem.bookingId,
      type: 'NOTE',
      amount: 0,
      description: transferNote,
      createdById: session.user.id
    }
  });

  revalidatePath("/admin/front-desk");
  return { success: true, toRoom: toUnit.roomType.name, toUnit: toUnit.number };
}

export async function updateUnitStatus(unitId: string, status: RoomUnitStatus) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.roomUnit.update({
    where: { id: unitId },
    data: { status }
  });

  revalidatePath("/admin/front-desk");
  return { success: true };
}
