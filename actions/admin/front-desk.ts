"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { BookingStatus, PaymentStatus, RoomUnitStatus } from "@prisma/client";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";

// --- Data Fetching ---

export async function getFrontDeskData(propertyId: string) {
  // 1. Fetch Rooms and their Units
  const rooms = await db.room.findMany({
    where: { propertyId },
    include: {
      property: true, // Include property for tax/service rates
      units: {
        orderBy: { number: "asc" },
        include: {
          // Get current active usage for this unit
          bookingItems: {
            where: {
              booking: { status: { in: ["CONFIRMED", "PENDING"] } },
              checkIn: {
                lte: new Date(new Date().setHours(23, 59, 59, 999)),
              },
            },
            orderBy: { checkIn: "asc" },
            include: {
              booking: {
                include: { user: true },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // 2. Fetch Unassigned Confirmed Bookings for "Check-in" properties
  // These are bookings that should be happening now or soon but have no unit assigned
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const unassignedBookings = await db.bookingItem.findMany({
    where: {
      room: { propertyId },
      roomUnitId: null,
      booking: {
        status: "CONFIRMED",
      },
      checkIn: {
        gte: todayStart, // Filter for upcoming/today
      },
    },
    include: {
      booking: true,
      room: true,
    },
    orderBy: { checkIn: "asc" },
  });

  return { rooms, unassignedBookings };
}

export async function getBookingFinancials(bookingId: string) {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      payments: { orderBy: { createdAt: "desc" } },
      adjustments: { orderBy: { createdAt: "desc" } },
      items: { include: { room: true } },
    },
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
    payments: booking.payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
    })),
    adjustments: booking.adjustments.map((a) => ({
      ...a,
      amount: Number(a.amount),
    })),
    items: booking.items.map((i) => ({
      ...i,
      pricePerNight: Number(i.pricePerNight),
      room: i.room
        ? {
            ...i.room,
            price: Number(i.room.price),
          }
        : null,
    })),
  };
}

// --- Actions ---

export async function checkInBooking(
  bookingItemId: string, 
  unitId: string,
  extras?: {
    guestPhone?: string;
    guestAddress?: string;
    idScans?: string[];
    initialPayment?: number;
    initialPaymentMethod?: string;
    initialPaymentRef?: string;
  }
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.$transaction(async (tx) => {
    // 1. Link Unit to Booking Item
    const bookingItem = await tx.bookingItem.update({
      where: { id: bookingItemId },
      data: { roomUnitId: unitId },
      include: { booking: true }
    });

    // 2. Update Unit Status to OCCUPIED
    await tx.roomUnit.update({
      where: { id: unitId },
      data: { status: "OCCUPIED" },
    });

    // 3. Update Guest Details & ID Scans
    if (extras) {
        if (extras.idScans || extras.guestPhone || extras.guestAddress) {
            // Update User Profile
            if (bookingItem.booking.guestEmail) {
                const existingUser = await tx.user.findUnique({
                    where: { email: bookingItem.booking.guestEmail }
                });
                if (existingUser) {
                    await tx.user.update({
                        where: { id: existingUser.id },
                        data: {
                            phone: extras.guestPhone || undefined,
                            address: extras.guestAddress || undefined,
                           idScans: extras.idScans ? { push: extras.idScans } : undefined 
                        }
                    });
                }
            }
            
            // Update Booking Guest Details (Snapshot)
            if (extras.guestPhone) {
               await tx.booking.update({
                  where: { id: bookingItem.bookingId },
                  data: { guestPhone: extras.guestPhone }
               });
            }
        }

        // 4. Record Initial Payment (e.g. Security Deposit or Balance)
        if (extras.initialPayment && extras.initialPayment > 0) {
            await tx.payment.create({
                data: {
                    bookingId: bookingItem.bookingId,
                    amount: extras.initialPayment,
                    provider: (extras.initialPaymentMethod as any) || "CASH",
                    reference: extras.initialPaymentRef,
                    status: "PAID",
                    createdById: session.user.id
                }
            });

            // Update Booking Financials
            const booking = await tx.booking.findUnique({ where: { id: bookingItem.bookingId } });
            if (booking) {
                const newPaid = Number(booking.amountPaid) + extras.initialPayment;
                const newDue = Number(booking.totalAmount) - newPaid;
                await tx.booking.update({
                    where: { id: bookingItem.bookingId },
                    data: {
                        amountPaid: newPaid,
                        amountDue: newDue,
                        paymentStatus: newDue <= 0 ? "PAID" : "PARTIALLY_PAID"
                    }
                });
            }
        }
    }
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
  guestPhone?: string;
  guestAddress?: string;
  idScans?: string[];
  checkInDate: Date;
  checkOutDate: Date;
  pricePerNight: number;
  initialPayment: number;
  initialPaymentMethod?: string;
  initialPaymentRef?: string;
  additionalChargeAmount?: number;
  additionalChargeDesc?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  // 1. Fetch Property Rates
  const property = await db.property.findUnique({
    where: { id: data.propertyId },
  });
  const taxRate = property?.taxRate ? Number(property.taxRate) : 0;
  const serviceRate = property?.serviceChargeRate
    ? Number(property.serviceChargeRate)
    : 0;

  const firstName = data.guestName.split(" ")[0];
  const lastName = data.guestName.split(" ").slice(1).join(" ") || "Guest";

  const result = await db.$transaction(async (tx) => {
      // 1. Create/Update User
      let userId = null;
      if (data.guestEmail) {
        const existingUser = await tx.user.findUnique({
          where: { email: data.guestEmail },
        });
        
        if (existingUser) {
          userId = existingUser.id;
          // Update extended profile if provided
          await tx.user.update({
             where: { id: existingUser.id },
             data: {
               phone: data.guestPhone || existingUser.phone,
               address: data.guestAddress || existingUser.address,
               idScans: data.idScans && data.idScans.length > 0 ? data.idScans : existingUser.idScans
             }
          });
        } else {
           const newUser = await tx.user.create({
              data: {
                 name: data.guestName,
                 email: data.guestEmail,
                 phone: data.guestPhone,
                 address: data.guestAddress,
                 idScans: data.idScans || [],
                 role: 'GUEST',
                 password: null // No password
              }
           });
           userId = newUser.id;
        }
      }

      // 2. Create Booking
      // Generate a short ref
      const shortRef = `WK-${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;

      // Calculate nights based on provided dates
      const nights = Math.max(
        1,
        Math.ceil(
          (data.checkOutDate.getTime() - data.checkInDate.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );

      const roomTotal = data.pricePerNight * nights;
      const taxAmount = roomTotal * taxRate;
      const serviceCharge = roomTotal * serviceRate;
      const addCharges = data.additionalChargeAmount || 0;
      
      const totalAmount = roomTotal + taxAmount + serviceCharge + addCharges;
      const amountDue = totalAmount - data.initialPayment;

      const booking = await tx.booking.create({
        data: {
          shortRef,
          userId,
          guestFirstName: firstName,
          guestLastName: lastName,
          guestEmail: data.guestEmail,
          guestPhone: data.guestPhone || "",
          totalAmount,
          taxAmount,
          serviceCharge,
          amountPaid: data.initialPayment,
          amountDue,
          status: "CONFIRMED",
          paymentStatus:
            amountDue <= 0
              ? "PAID"
              : data.initialPayment > 0
              ? "PARTIALLY_PAID"
              : "UNPAID",
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
              pricePerNight: data.pricePerNight,
            },
          },
          
          // Adjustments (Additional Charges)
          adjustments: addCharges > 0 ? {
             create: {
                type: 'CHARGE',
                amount: addCharges,
                description: data.additionalChargeDesc || "Additional Charges",
                createdById: session.user.id
             }
          } : undefined,

          // Initial Payment
          payments:
            data.initialPayment > 0
              ? {
                  create: {
                    amount: data.initialPayment,
                    status: "PAID",
                    provider: data.initialPaymentMethod || "CASH",
                    reference: data.initialPaymentRef,
                    createdById: session.user.id,
                  },
                }
              : undefined,
        },
      });

      // 3. Update Unit Status
      await tx.roomUnit.update({
        where: { id: data.unitId },
        data: { status: "OCCUPIED" },
      });

      return { success: true, bookingId: booking.id };
  });

  revalidatePath("/admin/front-desk");
  return result;
}

export async function addCharge(
  bookingId: string,
  amount: number,
  description: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.$transaction(async (tx) => {
    // Create Adjustment
    await tx.bookingAdjustment.create({
      data: {
        bookingId,
        type: "CHARGE",
        amount,
        description,
        createdById: session.user.id,
      },
    });

    // Update Booking Totals
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (booking) {
      const newTotal = Number(booking.totalAmount) + Number(amount);
      const newDue = Number(booking.amountDue) + Number(amount);

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          totalAmount: newTotal,
          amountDue: newDue,
          updatedById: session.user.id,
        },
      });
    }
  });

  revalidatePath("/admin/front-desk");
  return { success: true };
}

export async function addPayment(
  bookingId: string,
  amount: number,
  method: string,
  referenceNo?: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.payment.create({
    data: {
      bookingId,
      amount,
      status: "PAID",
      provider: method,
      transactionId: referenceNo || null, // Store reference number
      paidAt: new Date(),
      createdById: session.user.id,
    },
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
        paymentStatus: newDue <= 0 ? "PAID" : "PARTIALLY_PAID",
        updatedById: session.user.id,
      },
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
      status: "COMPLETED",
      updatedById: session.user.id,
    },
  });

  await db.roomUnit.update({
    where: { id: unitId },
    data: { status: "DIRTY" },
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
    include: { booking: true, room: true },
  });

  if (!bookingItem) throw new Error("Booking item not found");

  // Get the target unit info
  const toUnit = await db.roomUnit.findUnique({
    where: { id: data.toUnitId },
    include: { roomType: true },
  });

  if (!toUnit || toUnit.status !== "CLEAN") {
    throw new Error("Target unit is not available");
  }

  // 1. Update the BookingItem to point to the new unit
  await db.bookingItem.update({
    where: { id: data.bookingItemId },
    data: { roomUnitId: data.toUnitId },
  });

  // 2. Mark old unit as DIRTY (needs cleaning)
  await db.roomUnit.update({
    where: { id: data.fromUnitId },
    data: { status: "DIRTY" },
  });

  // 3. Mark new unit as OCCUPIED
  await db.roomUnit.update({
    where: { id: data.toUnitId },
    data: { status: "OCCUPIED" },
  });

  // 4. Log the transfer as an adjustment (optional - for record keeping)
  const transferNote = data.reason
    ? `Room Transfer: ${bookingItem.room.name} → ${toUnit.roomType.name} (${data.reason})`
    : `Room Transfer: ${bookingItem.room.name} → ${toUnit.roomType.name}`;

  await db.bookingAdjustment.create({
    data: {
      bookingId: bookingItem.bookingId,
      type: "NOTE",
      amount: 0,
      description: transferNote,
      createdById: session.user.id,
    },
  });

  revalidatePath("/admin/front-desk");
  return { success: true, toRoom: toUnit.roomType.name, toUnit: toUnit.number };
}

export async function updateUnitStatus(unitId: string, status: RoomUnitStatus, note?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.roomUnit.update({
    where: { id: unitId },
    data: { status, notes: note },
  });

  revalidatePath("/admin/front-desk");
  return { success: true };
}

export async function updateGuestDetails(bookingId: string, data: { firstName: string; lastName: string; email: string; phone: string; specialRequests?: string }) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.booking.update({
    where: { id: bookingId },
    data: {
      guestFirstName: data.firstName,
      guestLastName: data.lastName,
      guestEmail: data.email,
      guestPhone: data.phone,
      specialRequests: data.specialRequests,
      updatedById: session.user.id
    }
  });

  revalidatePath("/admin/front-desk");
  return { success: true };
}

export async function extendStay(bookingId: string, newCheckOutDate: Date) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { items: { include: { room: true } } }
    });

    if (!booking || booking.items.length === 0) throw new Error("Booking not found");
    const item = booking.items[0]; // Assuming single room booking for now

    // Calculate added nights
    const oldCheckOut = new Date(item.checkOut);
    const checkIn = new Date(item.checkIn);
    
    if (newCheckOutDate <= checkIn) {
        throw new Error("New checkout date must be after check-in date");
    }

    const diffTime = newCheckOutDate.getTime() - oldCheckOut.getTime();
    const addedNights = Math.round(diffTime / (1000 * 60 * 60 * 24)); // Round to nearest integer

    if (addedNights === 0) return; // No change

    // Calculate costs
    const roomCost = Number(item.pricePerNight) * addedNights;
    
    // Fetch property for tax info - assuming property fetch is fast, can be outside or inside. 
    // Property data rarely changes, but for consistency let's fetch inside or before. 
    // Since we need booking.propertyId, we fetch inside.
    const property = await tx.property.findUnique({ where: { id: booking.propertyId! } });
    const taxRate = property?.taxRate ? Number(property.taxRate) : 0;
    const serviceRate = property?.serviceChargeRate ? Number(property.serviceChargeRate) : 0;

    const taxAmount = roomCost * taxRate;
    const serviceCharge = roomCost * serviceRate;
    const totalAdded = roomCost + taxAmount + serviceCharge;

    // 1. Update Booking Item Dates
    await tx.bookingItem.update({
      where: { id: item.id },
      data: { checkOut: newCheckOutDate }
    });

    // 2. Add Adjustment
    await tx.bookingAdjustment.create({
      data: {
        bookingId,
        type: addedNights > 0 ? 'CHARGE' : 'CREDIT',
        amount: Math.abs(totalAdded), 
        description: `Stay Modification (${addedNights > 0 ? '+' : ''}${addedNights} nights)`,
        createdById: session.user.id
      }
    });

    // 3. Update Booking Totals
    await tx.booking.update({
       where: { id: bookingId },
       data: {
          totalAmount: { increment: totalAdded },
          amountDue: { increment: totalAdded },
          taxAmount: { increment: taxAmount },
          serviceCharge: { increment: serviceCharge },
          updatedById: session.user.id
       }
    });
  });

  revalidatePath("/admin/front-desk");
  return { success: true };
}

export async function voidCharge(bookingId: string, adjustmentId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const adjustment = await db.bookingAdjustment.findUnique({ where: { id: adjustmentId } });
  if (!adjustment) throw new Error("Adjustment not found");

  if (adjustment.isVoided) return { success: false, message: "Already voided" };

  // Use transaction
  await db.$transaction(async (tx) => {
      // 1. Mark as Voided
      await tx.bookingAdjustment.update({
         where: { id: adjustmentId },
         data: {
            isVoided: true,
            voidedAt: new Date(),
            updatedById: session.user.id
         }
      });

      // 2. Recalculate Booking Logic
      const booking = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!booking) throw new Error("Booking not found");

      // We void a CHARGE (+Total), so we decrement total & due.
      // But we should verify adjustment type? Assuming it's a charge (amount > 0).
      // If it was a CREDIT (reduction), voiding it INCREASES total/due.
      // Let's check adjustment.type or handle generically?
      // For now `decrement` is used assuming it WAS an addition.
      
      let newTotal = Number(booking.totalAmount);
      let newDue = Number(booking.amountDue);

      if (adjustment.type === 'CHARGE') {
         newTotal -= Number(adjustment.amount);
         newDue -= Number(adjustment.amount);
      } else if (adjustment.type === 'CREDIT') {
          // If we void a credit (which reduced total), we add it back?
          newTotal += Number(adjustment.amount);
          newDue += Number(adjustment.amount);
      }
      // If 'NOTE' type, no financial impact. But amount is 0 usually.
      
      const newPaid = Number(booking.amountPaid); 
      let newStatus: PaymentStatus = 'UNPAID';
      if (newPaid >= newTotal && newTotal > 0) newStatus = 'PAID';
      else if (newPaid > 0) newStatus = 'PARTIALLY_PAID';

      await tx.booking.update({
         where: { id: bookingId },
         data: {
            totalAmount: newTotal,
            amountDue: newDue,
            paymentStatus: newStatus,
            updatedById: session.user.id
         }
      });
  });

  revalidatePath("/admin/front-desk");
  return { success: true };
}

export async function voidPayment(bookingId: string, paymentId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error("Payment not found");

  if (payment.status === 'VOIDED') return { success: false, message: "Already voided" };

  // Use transaction to ensure consistency
  await db.$transaction(async (tx) => {
      // 1. Update Payment Status
      await tx.payment.update({
         where: { id: paymentId },
         data: { 
            status: 'VOIDED',
            updatedById: session.user.id,
            metadata: { ...(payment.metadata as object || {}), voidedAt: new Date(), voidedBy: session.user.id }
         }
      });

      // 2. Fetch latest booking state to recalculate
      const booking = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!booking) throw new Error("Booking not found");

      const newPaid = Number(booking.amountPaid) - Number(payment.amount);
      const newDue = Number(booking.amountDue) + Number(payment.amount);
      const total = Number(booking.totalAmount);

      let newStatus: PaymentStatus = 'UNPAID';
      if (newPaid >= total && total > 0) newStatus = 'PAID';
      else if (newPaid > 0) newStatus = 'PARTIALLY_PAID';
      
      // Update Booking Totals
      await tx.booking.update({
         where: { id: bookingId },
         data: {
            amountPaid: newPaid,
            amountDue: newDue,
            paymentStatus: newStatus,
            updatedById: session.user.id
         }
      });
  });

  revalidatePath("/admin/front-desk");
  return { success: true };
}

export async function verifySupervisorCredentials(data: { identifier: string; password: string }) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  // Determine if identifier is an email
  const isEmail = data.identifier.includes('@');

  const supervisor = await db.user.findFirst({
    where: isEmail ? { email: data.identifier } : { employeeId: data.identifier }
  });

  if (!supervisor || !supervisor.password) {
    return { success: false, message: "Invalid credentials" };
  }

  // Check role: ADMIN or MANAGER
  if (!['ADMIN', 'MANAGER'].includes(supervisor.role)) {
     return { success: false, message: "User does not have supervisor privileges" };
  }

  const passwordsMatch = await bcrypt.compare(data.password, supervisor.password);
  
  if (!passwordsMatch) {
    return { success: false, message: "Invalid credentials" };
  }

  return { success: true, supervisorName: supervisor.name || "Supervisor" };
}
