"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";

// --- Properties ---

export async function getPropertyById(id: string) {
    try {
        const property = await db.property.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { rooms: true }
                }
            }
        });
        return property;
    } catch (error) {
        console.error("Error fetching property:", error);
        return null;
    }
}

export async function createProperty(formData: FormData) {
    try {
        const name = formData.get("name") as string;
        const location = formData.get("location") as string;
        const description = formData.get("description") as string;
        const longDescription = formData.get("longDescription") as string || ""; // Optional long desc
        const image = formData.get("image") as string;
        const facebookPageId = formData.get("facebookPageId") as string;
        const taxRate = parseFloat(formData.get("taxRate") as string) || 0.12;
        const serviceChargeRate = parseFloat(formData.get("serviceChargeRate") as string) || 0.10;

        if (!name || !location) {
            return { error: "Name and Location are required" };
        }

        // Generate slug from name
        const slug = name.toLowerCase().replace(/ /g, "-").replace(/[^\w-]+/g, "") + "-" + nanoid(4);

        await db.property.create({
            data: {
                name,
                slug,
                location,
                description,
                longDescription,
                image: image || "",
                facebookPageId: facebookPageId || null,
                taxRate,
                serviceChargeRate
            }
        });

        revalidatePath("/admin/properties");
        return { success: true };
    } catch (error) {
        console.error("Error creating property:", error);
        return { error: "Failed to create property" };
    }
}

export async function updateProperty(id: string, formData: FormData) {
    try {
        const name = formData.get("name") as string;
        const location = formData.get("location") as string;
        const description = formData.get("description") as string;
        const longDescription = formData.get("longDescription") as string;
        const image = formData.get("image") as string;
        const facebookPageId = formData.get("facebookPageId") as string;
        const taxRate = parseFloat(formData.get("taxRate") as string);
        const serviceChargeRate = parseFloat(formData.get("serviceChargeRate") as string);

        if (!id) return { error: "Property ID required" };

        await db.property.update({
            where: { id },
            data: {
                name,
                location,
                description,
                longDescription,
                image,
                facebookPageId: facebookPageId || null,
                taxRate: isNaN(taxRate) ? undefined : taxRate,
                serviceChargeRate: isNaN(serviceChargeRate) ? undefined : serviceChargeRate
            }
        });

        revalidatePath("/admin/properties");
        revalidatePath(`/admin/properties/${id}`);
        return { success: true };

    } catch (error) {
         console.error("Error updating property:", error);
        return { error: "Failed to update property" };
    }
}

export async function deleteProperty(id: string) {
     try {
        await db.property.delete({
            where: { id }
        });
        revalidatePath("/admin/properties");
        return { success: true };
    } catch (error) {
        console.error("Error deleting property:", error);
        return { error: "Failed to delete property" };
    }
}
