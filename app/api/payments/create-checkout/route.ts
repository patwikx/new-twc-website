import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPayMongoCheckoutSession } from "@/lib/paymongo";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookingId } = body;

    if (!bookingId) {
      return NextResponse.json(
        { error: "Booking ID is required" },
        { status: 400 }
      );
    }

    // Fetch booking details
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        items: {
          include: {
            room: {
              include: { property: true }
            }
          }
        }
      }
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    if (booking.paymentStatus === "PAID") {
      return NextResponse.json(
        { error: "Booking is already paid" },
        { status: 400 }
      );
    }

    // Build description from booking items
    const roomNames = booking.items.map(item => item.room.name).join(", ");
    const propertyName = booking.items[0]?.room?.property?.name || "Tropicana";
    const description = `${roomNames} at ${propertyName}`;

    // Get base URL for success/cancel redirects
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Create PayMongo checkout session
    const result = await createPayMongoCheckoutSession({
      bookingId: booking.id,
      bookingNumber: booking.shortRef,
      amount: Number(booking.totalAmount),
      description,
      customerEmail: booking.guestEmail,
      customerName: `${booking.guestFirstName} ${booking.guestLastName}`,
      successUrl: `${baseUrl}/bookings?payment=success&ref=${booking.shortRef}`,
      cancelUrl: `${baseUrl}/cart?payment=cancelled&ref=${booking.shortRef}`,
      metadata: {
        guest_name: `${booking.guestFirstName} ${booking.guestLastName}`,
        guest_email: booking.guestEmail,
        guest_phone: booking.guestPhone,
      }
    });

    if ("error" in result) {
      console.error("PayMongo checkout error:", result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    // Create payment record
    await db.payment.create({
      data: {
        bookingId: booking.id,
        amount: booking.totalAmount,
        currency: booking.currency,
        provider: "PAYMONGO",
        status: "PENDING",
        paymongoPaymentIntentId: result.sessionId,
        paymongoCheckoutUrl: result.checkoutUrl,
        description
      }
    });

    return NextResponse.json({
      checkoutUrl: result.checkoutUrl,
      sessionId: result.sessionId
    });

  } catch (error) {
    console.error("Create checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
