import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCheckoutSession } from "@/lib/paymongo";
import { sendBookingConfirmationEmail } from "@/lib/mail";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Booking ID required" }, { status: 400 });
    }

    let booking = await db.booking.findUnique({
      where: { id },
      include: {
         payments: {
            where: {
               provider: 'PAYMONGO',
               externalId: { not: null }
            },
            take: 1,
            orderBy: { createdAt: 'desc' }
         },
         items: {
            include: {
               room: { include: { property: true } }
            }
         }
      }
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Check PayMongo status if currently pending/unpaid and we have a session ID
    if ((booking.paymentStatus === 'UNPAID') && booking.payments[0]?.externalId) {
       const sessionId = booking.payments[0].externalId;
       const session = await getCheckoutSession(sessionId);

       if (session && session.attributes.payments && session.attributes.payments.length > 0) {
          const payment = session.attributes.payments[0];
          
          if (payment.attributes.status === 'paid') {
             // Sync status to DB
             const updatedBooking = await db.booking.update({
                where: { id },
                data: {
                   status: 'CONFIRMED',
                   paymentStatus: 'PAID',
                   amountPaid: booking.totalAmount,
                   amountDue: 0
                }
             });

             await db.payment.update({
                where: { id: booking.payments[0].id },
                data: { status: 'PAID' }
             });
             
             // Send confirmation email
             if (booking.guestEmail) {
                const firstItem = booking.items[0];
                const checkIn = firstItem ? new Date(firstItem.checkIn).toLocaleDateString('en-US', { 
                   weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
                }) : 'N/A';
                const checkOut = firstItem ? new Date(firstItem.checkOut).toLocaleDateString('en-US', { 
                   weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
                }) : 'N/A';

                await sendBookingConfirmationEmail({
                   email: booking.guestEmail,
                   ref: booking.shortRef, // Link will use this ref
                   propertyName: booking.items[0]?.room?.property?.name || 'Tropicana Hotel',
                   checkIn,
                   checkOut,
                   amount: `PHP ${Number(booking.totalAmount).toLocaleString()}`,
                   guestName: `${booking.guestFirstName} ${booking.guestLastName}`
                });
             }
             
             // Refresh booking data to return
             booking = { ...booking, ...updatedBooking };
          }
       }
    }

    return NextResponse.json({
       status: booking.status,
       paymentStatus: booking.paymentStatus,
       shortRef: booking.shortRef
    });
  } catch (error) {
    console.error("Error fetching booking status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
