"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { LookupForm } from "@/components/booking/LookupForm";
import { BookingDetailsCard } from "@/components/booking/BookingDetailsCard";
import type { BookingDetails } from "@/lib/booking/lookup";

/**
 * Guest Booking Lookup Page
 * 
 * Allows guests to look up their booking using reference number and email.
 * Handles expired token redirect with appropriate message.
 * 
 * Requirements: 1.1, 3.4, 5.1
 */
export default function BookingLookupPage() {
  const searchParams = useSearchParams();
  const expired = searchParams.get("expired") === "true";
  const [booking, setBooking] = useState<BookingDetails | null>(null);

  // Message for expired token redirect (Requirement 3.4)
  const expiredMessage = expired
    ? "Your booking link has expired. Please use the form below to look up your booking."
    : undefined;

  // Handle successful lookup
  const handleLookupSuccess = (foundBooking: BookingDetails) => {
    setBooking(foundBooking);
  };

  return (
    <div className="min-h-screen bg-black w-full">
      <div className="pt-32 pb-20 px-6 md:px-10">
        {booking ? (
          // Display booking details on successful lookup
          <BookingDetailsCard booking={booking} />
        ) : (
          // Display lookup form (Requirement 1.1)
          <LookupForm onSuccess={handleLookupSuccess} message={expiredMessage} />
        )}
      </div>
    </div>
  );
}
