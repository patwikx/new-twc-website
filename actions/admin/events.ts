"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { BookingStatus, EventStatus } from "@prisma/client";

// --- Types ---

export interface CreateEventParams {
    propertyId: string;
    title: string;
    startDate: Date;
    endDate: Date;
    status: EventStatus;
    guestCount?: number;
    roomCount?: number; // Target
    menuDetails?: any; // Json of selected items
    description?: string;
    blockedUnitIds?: string[]; // IDs of units to block
}

// --- Actions ---

export async function getRoomTypesWithUnits(propertyId: string, startDate: Date, endDate: Date) {
    try {
        // Fetch all room types and their units
        // We use bookingItems to check for availability
        const roomTypes = await db.room.findMany({
            where: { propertyId },
            include: {
                units: {
                    include: {
                        bookingItems: {
                            where: {
                                // check for date overlap
                                OR: [
                                   { checkIn: { lte: startDate }, checkOut: { gte: startDate } },
                                   { checkIn: { lte: endDate }, checkOut: { gte: endDate } },
                                   { checkIn: { gte: startDate }, checkOut: { lte: endDate } }
                                ],
                                // AND ensure booking is active
                                booking: {
                                    status: { in: [BookingStatus.CONFIRMED, BookingStatus.PENDING] }
                                }
                            },
                             select: { id: true } 
                        }
                    }
                }
            }
        });

        // Group by Room Type
        const grouped = roomTypes.map(room => {
             return {
                 ...room,
                 price: room.price.toNumber(), // Fix Decimal serialization
                 units: room.units.map((u: any) => ({
                     id: u.id,
                     name: u.number, 
                     isAvailable: u.bookingItems.length === 0
                 }))
             };
        });

        return grouped;

    } catch (error) {
        console.error("Error fetching room types with units:", error);
        return [];
    }
}

export async function getMenuItems(propertyId: string) {
    try {
        const items = await db.menuItem.findMany({
            where: { propertyId, isAvailable: true },
            orderBy: { category: 'asc' }
        });
        return items;
    } catch (error) {
        console.error("Error fetching menu items:", error);
        return [];
    }
}


