import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPayMongoCheckoutSession } from "@/lib/paymongo";
import { checkLimit } from "@/lib/rate-limit";
import { auth } from "@/auth";
import { validateVerificationToken, deleteVerificationTokensForBooking } from "@/lib/booking/verification-token";
import { verifyBookingAmount } from "@/lib/booking/price-verification";

// Rate limit configuration for checkout endpoint
const CHECKOUT_RATE_LIMIT = {
  limit: 3,
  windowMs: 60 * 1000, // 60 seconds
  keyPrefix: 'checkout'
};

/**
 * Extract client IP from request headers
 */
function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  return 'unknown';
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting check
    const clientIP = getClientIP(req);
    const rateLimitResult = await checkLimit(clientIP, CHECKOUT_RATE_LIMIT);
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter || 60)
          }
        }
      );
    }

    const body = await req.json();
    const { bookingId, verificationToken } = body;

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
      // Generic error to prevent information leakage
      return NextResponse.json(
        { error: "Unable to process request. Please try again." },
        { status: 403 }
      );
    }

    // Ownership verification
    const session = await auth();
    
    if (session?.user?.email) {
      // Authenticated user: verify email matches booking
      if (session.user.email.toLowerCase() !== booking.guestEmail.toLowerCase()) {
        return NextResponse.json(
          { error: "Unable to process request. Please try again." },
          { status: 403 }
        );
      }
    } else {
      // Guest user: require valid verification token
      if (!verificationToken) {
        return NextResponse.json(
          { error: "Unable to process request. Please try again." },
          { status: 403 }
        );
      }
      
      const tokenValidation = await validateVerificationToken(verificationToken);
      
      if (!tokenValidation.valid) {
        return NextResponse.json(
          { error: tokenValidation.expired 
            ? "Your session has expired. Please start a new booking." 
            : "Unable to process request. Please try again." 
          },
          { status: 403 }
        );
      }
      
      // Verify token belongs to this booking
      if (tokenValidation.bookingId !== bookingId) {
        return NextResponse.json(
          { error: "Unable to process request. Please try again." },
          { status: 403 }
        );
      }
    }

    if (booking.paymentStatus === "PAID") {
      return NextResponse.json(
        { error: "Booking is already paid" },
        { status: 400 }
      );
    }

    // Price verification - ensure booking total matches current room prices
    const priceVerification = await verifyBookingAmount(bookingId);
    
    if (!priceVerification.valid) {
      console.warn("Price mismatch detected", {
        bookingId,
        storedTotal: priceVerification.storedTotal,
        calculatedTotal: priceVerification.calculatedTotal,
        percentageDiff: priceVerification.percentageDiff,
        reason: priceVerification.reason
      });
      
      return NextResponse.json(
        { 
          error: "Room prices have changed. Please refresh and review your booking.",
          code: "PRICE_MISMATCH"
        },
        { status: 409 }
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
      successUrl: `${baseUrl}/book/confirmation?id=${booking.id}`,
      cancelUrl: `${baseUrl}/book`,
      metadata: {
        guest_name: `${booking.guestFirstName} ${booking.guestLastName}`,
        guest_email: booking.guestEmail,
        guest_phone: booking.guestPhone,
      },
      lineItems: [
        {
          name: description,
          amount: Number(booking.totalAmount) / 1.22, // Approximate base (Back-calculate)
          currency: "PHP",
          quantity: 1,
          description: "Room Charges"
        },
        {
          name: "Service Charge (10%)",
          amount: (Number(booking.totalAmount) / 1.22) * 0.10,
          currency: "PHP",
          quantity: 1
        },
        {
          name: "VAT (12%)",
          amount: (Number(booking.totalAmount) / 1.22) * 1.10 * 0.12, 
          currency: "PHP",
          quantity: 1
        }
      ]
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
        externalId: result.sessionId,
        metadata: {
          checkoutUrl: result.checkoutUrl,
          description
        }
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
