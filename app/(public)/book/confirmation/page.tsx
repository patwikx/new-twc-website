import { getBookingById, getBookingByRef } from "@/data/booking";
import { getGlobalConfig } from "@/actions/public/properties";
import { redirect } from "next/navigation";
import ConfirmationClient from "./ConfirmationClient";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function ConfirmationPage({ searchParams }: { searchParams: Promise<{ id?: string; ref?: string }> }) {
  const resolvedSearchParams = await searchParams;
  const bookingId = resolvedSearchParams.id;
  const bookingRef = resolvedSearchParams.ref;

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

  let bookingData = null;
  if (bookingId) {
    bookingData = await getBookingById(bookingId);
  } else if (bookingRef) {
    bookingData = await getBookingByRef(bookingRef);
  }

  const config = await getGlobalConfig();

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
          <ConfirmationClient booking={booking} config={config} />
       </div>
    </div>
  );
}
