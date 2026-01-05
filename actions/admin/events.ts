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

export async function createEvent(params: CreateEventParams) {
    try {
        const { 
            propertyId, title, startDate, endDate, status, 
            guestCount, roomCount, menuDetails, description, blockedUnitIds 
        } = params;

        // Perform in transaction
        const event = await db.$transaction(async (tx) => {
            // 1. Create Event
            const newEvent = await tx.event.create({
                data: {
                    propertyId,
                    title,
                    startDate,
                    endDate,
                    status,
                    guestCount,
                    roomCount,
                    menuDetails: menuDetails ?? undefined,
                    description,
                }
            });

            // 2. Block Units (Create Bookings)
            if (blockedUnitIds && blockedUnitIds.length > 0) {
                 // Fetch unit details to get roomTypeId (Room Type)
                 const units = await tx.roomUnit.findMany({
                     where: { id: { in: blockedUnitIds } },
                     include: { roomType: true }
                 });

                 for (const unit of units) {
                     // Create a booking for this unit
                     await tx.booking.create({
                         data: {
                             propertyId,
                             eventId: newEvent.id, // Link to Event
                             status: BookingStatus.CONFIRMED, // Blocks availability
                             shortRef: Math.random().toString(36).substring(2, 10).toUpperCase(), // Generate short ref
                             guestFirstName: "Event",
                             guestLastName: title,
                             guestEmail: "events@internal", // Placeholder
                             guestPhone: "N/A",
                             totalAmount: 0,
                             taxAmount: 0,
                             serviceCharge: 0,
                             amountDue: 0,
                             items: {
                                 create: {
                                     roomId: unit.roomTypeId,
                                     roomUnitId: unit.id,
                                     checkIn: startDate,
                                     checkOut: endDate,
                                     guests: 0, 
                                     pricePerNight: 0
                                 }
                             }
                         }
                     });
                 }
            }

            return newEvent;
        });

        revalidatePath("/admin/calendar");
        revalidatePath("/admin/front-desk");
        return { success: true, event };

    } catch (error) {
        console.error("Error creating event:", error);
        return { error: "Failed to create event" };
    }
}
