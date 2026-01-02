"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

// --- Room Units ---

export async function getRoomUnits(roomTypeId: string) {
    try {
        const units = await db.roomUnit.findMany({
            where: { roomTypeId },
            orderBy: { number: 'asc' }
        });
        return units;
    } catch (error) {
        console.error("Error fetching room units:", error);
        return [];
    }
}

export async function createRoomUnit(roomTypeId: string, formData: FormData) {
    try {
        const number = formData.get("number") as string;
        const floor = parseInt(formData.get("floor") as string) || null;
        const notes = formData.get("notes") as string;

        if (!number) {
            return { error: "Room number is required" };
        }

        // Check if number already exists for this room type
        const existing = await db.roomUnit.findFirst({
            where: { roomTypeId, number }
        });

        if (existing) {
            return { error: `Room ${number} already exists` };
        }

        await db.roomUnit.create({
            data: {
                roomTypeId,
                number,
                floor,
                notes: notes || null
            }
        });

        revalidatePath(`/admin/properties`);
        return { success: true };
    } catch (error) {
        console.error("Error creating room unit:", error);
        return { error: "Failed to create room unit" };
    }
}

export async function updateRoomUnit(unitId: string, formData: FormData) {
    try {
        const number = formData.get("number") as string;
        const floor = parseInt(formData.get("floor") as string) || null;
        const status = formData.get("status") as string;
        const isActive = formData.get("isActive") === "true";
        const notes = formData.get("notes") as string;

        await db.roomUnit.update({
            where: { id: unitId },
            data: {
                number,
                floor,
                status: status as any,
                isActive,
                notes: notes || null
            }
        });

        revalidatePath(`/admin/properties`);
        return { success: true };
    } catch (error) {
        console.error("Error updating room unit:", error);
        return { error: "Failed to update room unit" };
    }
}

export async function deleteRoomUnit(unitId: string) {
    try {
        await db.roomUnit.delete({
            where: { id: unitId }
        });
        revalidatePath(`/admin/properties`);
        return { success: true };
    } catch (error) {
        console.error("Error deleting room unit:", error);
        return { error: "Failed to delete room unit" };
    }
}
