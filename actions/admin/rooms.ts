"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// --- Rooms ---

export async function getAllPropertiesChoice() {
    try {
        const properties = await db.property.findMany({
            select: { id: true, name: true }
        });
        return properties;
    } catch (error) {
        return [];
    }
}

export async function getRoomById(id: string) {
    try {
        const room = await db.room.findUnique({
             where: { id },
             include: { property: true }
        });
        
        if (!room) return null;

        // Convert Decimal to number for client usage
        return {
            ...room,
            price: Number(room.price)
        };
    } catch (error) {
        console.error("Error fetching room:", error);
        return null;
    }
}

export async function createRoom(formData: FormData) {
    try {
        const name = formData.get("name") as string;
        const propertyId = formData.get("propertyId") as string;
        const description = formData.get("description") as string;
        const capacity = parseInt(formData.get("capacity") as string) || 2;
        const price = parseFloat(formData.get("price") as string);
        const image = formData.get("image") as string;

        if (!name || !propertyId || isNaN(price)) {
            return { error: "Name, Property, and Price are required." };
        }

        await db.room.create({
            data: {
                name,
                propertyId,
                description,
                capacity,
                price: price,
                image: image || "",
                // Default size if not provided?
            }
        });

        revalidatePath("/admin/rooms");
        return { success: true };
    } catch (error) {
        console.error("Error creating room:", error);
        return { error: "Failed to create room" };
    }
}

export async function updateRoom(id: string, formData: FormData) {
    try {
         const name = formData.get("name") as string;
        const propertyId = formData.get("propertyId") as string;
        const description = formData.get("description") as string;
        const capacity = parseInt(formData.get("capacity") as string);
        const price = parseFloat(formData.get("price") as string);
        const image = formData.get("image") as string;

        if (!id) return { error: "Room ID required" };

        await db.room.update({
            where: { id },
            data: {
                name,
                propertyId,
                description,
                capacity,
                price,
                image
            }
        });
        
        revalidatePath("/admin/rooms");
        revalidatePath(`/admin/rooms/${id}`);
        return { success: true };

    } catch (error) {
        console.error("Error updating room:", error);
        return { error: "Failed to update room" };
    }
}

export async function deleteRoom(id: string) {
     try {
        await db.room.delete({
            where: { id }
        });
        revalidatePath("/admin/rooms");
        return { success: true };
    } catch (error) {
        console.error("Error deleting room:", error);
        return { error: "Failed to delete room" };
    }
}
