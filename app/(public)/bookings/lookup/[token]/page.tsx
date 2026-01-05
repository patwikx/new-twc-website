import { redirect } from "next/navigation";
import { lookupBookingByToken } from "@/actions/booking-lookup";
import { BookingDetailsCard } from "@/components/booking/BookingDetailsCard";

interface TokenLookupPageProps {
  params: Promise<{ token: string }>;
}

/**
 * Token-Based Booking Lookup Page
 * 
 * Server component that validates the token from the URL and either:
 * - Displays booking details if token is valid
 * - Redirects to manual lookup if token is invalid/expired
 * 
 * Requirements: 3.3, 3.4, 10.1
 */
export default async function TokenLookupPage({ params }: TokenLookupPageProps) {
  const { token } = await params;

  // Validate token and get booking (Requirement 3.3)
  const result = await lookupBookingByToken(token);

  // Handle expired token - redirect with message (Requirement 3.4)
  if (result.expired) {
    redirect("/bookings/lookup?expired=true");
  }

  // Handle invalid token - redirect to manual lookup
  if (!result.success || !result.booking) {
    redirect("/bookings/lookup");
  }

  // Token valid - display booking details with token for cancellation (Requirement 3.3, 10.1)
  return (
    <div className="min-h-screen bg-black w-full">
      <div className="pt-32 pb-20 px-6 md:px-10">
        <BookingDetailsCard booking={result.booking} verificationToken={token} />
      </div>
    </div>
  );
}
