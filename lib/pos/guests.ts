"use server";

import { db } from "@/lib/db";
import { BookingStatus } from "@prisma/client";

export interface HotelGuest {
  bookingId: string;
  bookingRef: string;
  guestId: string;
  guestName: string;
  roomNumber: string;
  checkIn: Date;
  checkOut: Date;
}

export async function searchCheckedInGuests(query: string = ""): Promise<HotelGuest[]> {
  try {
    const statusFilter = {
        in: ["CHECKED_IN", "CONFIRMED"]
    };
    
    // Base where clause
    const whereClause: any = {
      status: statusFilter,
      // Ensure the guest is assigned to a room that is actually OCCUPIED physically
      // AND that the booking is active (checkIn has passed)
      items: {
          some: {
              roomUnit: {
                  status: "OCCUPIED"
              },
              checkIn: {
                  lte: new Date() // Must have started by now
              }
          }
      }
    };

    if (query && query.trim() !== "") {
        const terms = query.trim().split(/\s+/);
        
        // Create an AND condition for all terms
        whereClause.AND = terms.map(term => ({
            OR: [
                { guestFirstName: { contains: term, mode: "insensitive" } },
                { guestLastName: { contains: term, mode: "insensitive" } },
                { 
                   items: {
                       some: {
                           OR: [
                               { room: { name: { contains: term, mode: "insensitive" } } },
                               { roomUnit: { number: { contains: term, mode: "insensitive" } } }
                           ]
                       }
                   }
                },
                { shortRef: { contains: term, mode: "insensitive" } }
            ]
        }));
    }

    const bookings = await db.booking.findMany({
      where: whereClause,
      include: {
        items: {
            include: {
                room: true,
                roomUnit: true
            }
        },
        user: true
      },
      take: 20 // Limit results
    });

    return bookings.map(booking => {
        // Find the primary room (or first item)
        const primaryItem = booking.items[0];
        const roomNumber = primaryItem?.roomUnit?.number || primaryItem?.room?.name || "Unassigned";
        
        return {
            bookingId: booking.id,
            bookingRef: booking.shortRef,
            guestId: booking.userId || "guest", // Provide a fallback if no user account
            guestName: `${booking.guestFirstName} ${booking.guestLastName}`,
            roomNumber: roomNumber,
            checkIn: primaryItem?.checkIn || booking.createdAt,
            checkOut: primaryItem?.checkOut || booking.createdAt, // fallback
        };
    });

  } catch (error) {
    console.error("Error searching checked-in guests:", error);
    return [];
  }
}
