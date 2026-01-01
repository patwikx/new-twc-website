"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export const cancelBooking = async (bookingId: string) => {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return { error: "You must be logged in to cancel a booking." };
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { items: true }
  });

  if (!booking) {
    return { error: "Booking not found." };
  }

  if (booking.userId !== userId) {
    return { error: "Unauthorized." };
  }

  if (booking.status === 'CANCELLED') {
    return { error: "Booking is already cancelled." };
  }

  // Policy Check
  if (!booking.items || booking.items.length === 0) {
    return { error: "Booking has no check-in date." };
  }

  // Policy Check
  const checkInDate = new Date(booking.items[0].checkIn); // Assuming first item defines check-in
  const now = new Date();
  
  // 48 hours in milliseconds
  const fortyEightHours = 48 * 60 * 60 * 1000;

  if (booking.status === 'CONFIRMED') {
     const timeDifference = checkInDate.getTime() - now.getTime();
     if (timeDifference < fortyEightHours) {
        return { error: "Confirmed bookings can only be cancelled at least 48 hours before check-in." };
     }
  }

  try {
     await db.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED' }
     });

     // Also cancel any pending payments? Or is that handled separately?
     // Good to ensure pending payments are failed/cancelled
     await db.payment.updateMany({
        where: { bookingId: bookingId, status: 'PENDING' },
        data: { status: 'FAILED', failureReason: 'Booking Cancelled by User' }
     });

     revalidatePath(`/bookings/${bookingId}`);
     revalidatePath('/bookings');
     
     return { success: "Booking cancelled successfully." };
  } catch (error) {
     console.error("Cancellation error:", error);
     return { error: "Failed to cancel booking. Please try again." };
  }
};
