import { getBookingById, getBookingByRef } from "@/data/booking";
import { getGlobalConfig } from "@/actions/public/properties";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { validateToken } from "@/lib/booking/lookup-token";
import ConfirmationClient from "./ConfirmationClient";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/**
 * Booking Confirmation Page
 * 
 * Authorization requirements (Requirement 6):
 * - 6.1: Redirect to lookup page if no auth or token
 * - 6.2: Allow access with valid lookup token
 * - 6.3: Allow access for logged-in user who owns the booking
 * - 6.4: Show access denied if booking doesn't match user/token
 */
export default async function ConfirmationPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ id?: string; ref?: string; token?: string }> 
}) {
  const resolvedSearchParams = await searchParams;
  const bookingId = resolvedSearchParams.id;
  const bookingRef = resolvedSearchParams.ref;
  const lookupToken = resolvedSearchParams.token;

  // No booking identifier provided
  if (!bookingId && !bookingRef) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white pt-32 pb-24 flex flex-col items-center justify-center">
        <h1 className="text-2xl font-serif mb-4">Invalid Booking Reference</h1>
        <Button asChild variant="outline" className="rounded-none">
          <Link href="/">Return Home</Link>
        </Button>
      </div>
    );
  }

  // Fetch booking data
  let bookingData = null;
  if (bookingId) {
    bookingData = await getBookingById(bookingId);
  } else if (bookingRef) {
    bookingData = await getBookingByRef(bookingRef);
  }

  // Booking not found
  if (!bookingData) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white pt-32 pb-24 flex flex-col items-center justify-center">
        <h1 className="text-2xl font-serif mb-4">Booking Not Found</h1>
        <Button asChild variant="outline" className="rounded-none">
          <Link href="/">Return Home</Link>
        </Button>
      </div>
    );
  }

  // Authorization check
  const session = await auth();
  let isAuthorized = false;
  let authMethod: "session" | "token" | null = null;

  // Check 1: Logged-in user who owns the booking (Requirement 6.3)
  if (session?.user?.id && bookingData.userId === session.user.id) {
    isAuthorized = true;
    authMethod = "session";
  }

  // Check 2: Valid lookup token that matches the booking (Requirement 6.2)
  if (!isAuthorized && lookupToken) {
    const tokenValidation = await validateToken(lookupToken);
    
    if (tokenValidation.valid && tokenValidation.bookingId === bookingData.id) {
      isAuthorized = true;
      authMethod = "token";
    } else if (tokenValidation.expired) {
      // Token expired - redirect to lookup with message
      redirect("/bookings/lookup?expired=true");
    }
  }

  // Not authorized - redirect to lookup page (Requirement 6.1)
  if (!isAuthorized) {
    // If user is logged in but doesn't own the booking, show access denied (Requirement 6.4)
    if (session?.user?.id) {
      return (
        <div className="min-h-screen bg-neutral-950 text-white pt-32 pb-24 flex flex-col items-center justify-center">
          <h1 className="text-2xl font-serif mb-4">Access Denied</h1>
          <p className="text-neutral-400 mb-6">You don't have permission to view this booking.</p>
          <div className="flex gap-4">
            <Button asChild variant="outline" className="rounded-none">
              <Link href="/bookings">My Bookings</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-none">
              <Link href="/bookings/lookup">Lookup Another Booking</Link>
            </Button>
          </div>
        </div>
      );
    }
    
    // No session and no valid token - redirect to lookup (Requirement 6.1)
    redirect("/bookings/lookup");
  }

  const config = await getGlobalConfig();

  // Serialize Decimal and Date values to plain types for client component
  const booking = {
    id: bookingData.id,
    shortRef: bookingData.shortRef,
    status: bookingData.status,
    paymentStatus: bookingData.paymentStatus,
    totalAmount: Number(bookingData.totalAmount),
    taxAmount: Number(bookingData.taxAmount),
    serviceCharge: Number(bookingData.serviceCharge),
    amountPaid: Number(bookingData.amountPaid),
    amountDue: Number(bookingData.amountDue),
    guestFirstName: bookingData.guestFirstName,
    guestLastName: bookingData.guestLastName,
    guestEmail: bookingData.guestEmail,
    guestPhone: bookingData.guestPhone,
    items: bookingData.items.map(item => ({
      id: item.id,
      guests: item.guests,
      pricePerNight: Number(item.pricePerNight),
      checkIn: item.checkIn.toISOString(),
      checkOut: item.checkOut.toISOString(),
      room: item.room ? {
        id: item.room.id,
        name: item.room.name,
        image: item.room.image,
        price: Number(item.room.price),
        capacity: item.room.capacity,
      } : null,
    })),
    property: bookingData.property ? {
      id: bookingData.property.id,
      name: bookingData.property.name,
      location: bookingData.property.location,
    } : null,
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white pt-32 pb-24">
      <div className="container mx-auto px-4">
        <ConfirmationClient 
          booking={booking} 
          config={config} 
          verificationToken={authMethod === "token" ? lookupToken : undefined}
        />
      </div>
    </div>
  );
}
