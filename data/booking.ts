import { db } from "@/lib/db";

export const getBookingsByUserId = async (userId: string) => {
  try {
    const bookings = await db.booking.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            room: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return bookings;
  } catch (error) {
    return null;
  }
};
