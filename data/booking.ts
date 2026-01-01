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

// Helper to expire old pending payments (older than 1 hour)
const expireOldPendingPayments = async (bookingId: string) => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    // Check if there are any old pending payments first to avoid unnecessary writes
    const pendingCount = await db.payment.count({
      where: {
        bookingId,
        status: 'PENDING',
        createdAt: { lt: oneHourAgo }
      }
    });

    if (pendingCount > 0) {
       await db.payment.updateMany({
         where: {
           bookingId,
           status: 'PENDING',
           createdAt: { lt: oneHourAgo }
         },
         data: {
           status: 'FAILED', // Using FAILED as effectively "Expired" since CANCELLED isn't in schema
           failureReason: 'Transaction expired'
         }
       });
    }
  } catch (error) {
    console.error("Failed to expire old payments", error);
  }
};

export const getBookingById = async (id: string) => {
  try {
    // Auto-expire old pending payments before fetching
    await expireOldPendingPayments(id);

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

export const getBookingByRef = async (shortRef: string) => {
  try {
    // We need ID to expire payments, so fetch ID first or fetch full booking then expire
    // To be efficient, let's fetch first, if exists, expire then re-fetch payments or update in place?
    // simplest: fetch, if pending payments exist in result, we might want to show them as failed?
    // Better: find by ref, get ID, expire, then return full object.
    
    const partialBooking = await db.booking.findUnique({
       where: { shortRef },
       select: { id: true }
    });

    if (partialBooking) {
       await expireOldPendingPayments(partialBooking.id);
    }

    const booking = await db.booking.findUnique({
      where: { shortRef },
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
