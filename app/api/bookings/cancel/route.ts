import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateToken, deleteTokensForBooking } from "@/lib/booking/lookup-token";
import { 
  canCancelBooking, 
  calculateCancellationFee, 
  DEFAULT_CANCELLATION_POLICY 
} from "@/lib/booking/cancellation";
import { sendBookingCancellationEmail } from "@/lib/mail";
import { checkLimit } from "@/lib/rate-limit";

/**
 * Extract client IP from request headers
 */
function getClientIP(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }
  
  return 'unknown';
}

/**
 * POST /api/bookings/cancel
 * 
 * Cancel a booking using a verification token.
 * 
 * Requirements:
 * - 10.1: Guest with valid verification token can cancel
 * - 10.5: Send cancellation confirmation email
 */
export async function POST(request: Request) {
  try {
    // Rate limiting - 5 requests per 60 seconds
    const clientIP = getClientIP(request);
    const rateLimitResult = await checkLimit(clientIP, {
      limit: 5,
      windowMs: 60 * 1000,
      keyPrefix: 'booking-cancel'
    });
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: `Too many requests. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          retryAfter: rateLimitResult.retryAfter
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { bookingId, verificationToken } = body;

    // Validate required fields
    if (!bookingId || !verificationToken) {
      return NextResponse.json(
        { error: "Booking ID and verification token are required" },
        { status: 400 }
      );
    }

    // Validate the verification token
    const tokenResult = await validateToken(verificationToken);
    
    if (!tokenResult.valid) {
      if (tokenResult.expired) {
        return NextResponse.json(
          { error: "This link has expired. Please use the booking lookup form to request a new link." },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: "Invalid or expired cancellation link" },
        { status: 401 }
      );
    }

    // Verify token matches the booking
    if (tokenResult.bookingId !== bookingId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Fetch the booking with related data
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        items: {
          include: {
            room: {
              include: {
                property: true
              }
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

    // Check if booking can be cancelled
    const canCancelResult = canCancelBooking(booking.status);
    
    if (!canCancelResult.canCancel) {
      return NextResponse.json(
        { error: canCancelResult.reason },
        { status: 400 }
      );
    }

    // Get check-in date from first booking item
    const firstItem = booking.items[0];
    if (!firstItem) {
      return NextResponse.json(
        { error: "Booking has no items" },
        { status: 400 }
      );
    }

    const checkInDate = new Date(firstItem.checkIn);
    const cancellationDate = new Date();

    // Calculate cancellation fee
    const feeResult = calculateCancellationFee(
      Number(booking.amountPaid),
      checkInDate,
      cancellationDate,
      DEFAULT_CANCELLATION_POLICY
    );

    // Update booking status to CANCELLED
    await db.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date()
      }
    });

    // Delete lookup tokens for this booking (they're no longer needed)
    await deleteTokensForBooking(bookingId);

    // Format dates for email
    const checkIn = checkInDate.toLocaleDateString('en-US', { 
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
    });
    const checkOut = firstItem.checkOut 
      ? new Date(firstItem.checkOut).toLocaleDateString('en-US', { 
          weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
        })
      : 'N/A';

    // Send cancellation confirmation email (Requirement 10.5)
    if (booking.guestEmail) {
      await sendBookingCancellationEmail({
        email: booking.guestEmail,
        ref: booking.shortRef,
        propertyName: firstItem.room?.property?.name || 'Tropicana Hotel',
        checkIn,
        checkOut,
        refundAmount: `PHP ${feeResult.refundAmount.toLocaleString()}`,
        cancellationFee: `PHP ${feeResult.fee.toLocaleString()}`,
        guestName: `${booking.guestFirstName} ${booking.guestLastName}`,
        isFreeCancellation: feeResult.isFreeCancellation
      });
    }

    return NextResponse.json({
      success: true,
      message: "Booking cancelled successfully",
      refundAmount: feeResult.refundAmount,
      cancellationFee: feeResult.fee,
      isFreeCancellation: feeResult.isFreeCancellation
    });

  } catch (error) {
    console.error("Error cancelling booking:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
