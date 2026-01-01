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

  try {
    await db.$transaction(async (tx) => {
      // Re-fetch booking inside transaction to ensure latest state
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: { items: true }
      });

      if (!booking) {
        throw new Error("Booking not found.");
      }

      if (booking.userId !== userId) {
        throw new Error("Unauthorized.");
      }

      if (booking.status === 'CANCELLED') {
         throw new Error("Booking is already cancelled.");
      }

      // Policy Check
      const checkInDate = new Date(booking.items[0].checkIn);
      const now = new Date();
      const fortyEightHours = 48 * 60 * 60 * 1000;

      if (booking.status === 'CONFIRMED') {
         const timeDifference = checkInDate.getTime() - now.getTime();
         if (timeDifference < fortyEightHours) {
            throw new Error("Confirmed bookings can only be cancelled at least 48 hours before check-in.");
         }
      }

      // Update Booking Status
      await tx.booking.update({
         where: { id: bookingId },
         data: { status: 'CANCELLED' }
      });

      // Cancel Pending Payments
      await tx.payment.updateMany({
         where: { bookingId: bookingId, status: 'PENDING' },
         data: { status: 'FAILED', failureReason: 'Booking Cancelled by User' }
      });
    });

    revalidatePath(`/bookings/${bookingId}`);
    revalidatePath('/bookings');
    
    return { success: "Booking cancelled successfully." };

  } catch (error: any) {
     console.error("Cancellation error:", error);
     return { error: error.message || "Failed to cancel booking. Please try again." };
  }
};
