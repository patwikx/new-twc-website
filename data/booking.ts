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

export const getBookingById = async (id: string) => {
  try {
    const booking = await db.booking.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            room: true
          }
        },
        property: true,
        room: true,
        payments: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        user: true
      }
    });

    return booking;
  } catch (error) {
    return null;
  }
};
