"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function setAdminPropertyScope(propertyId: string) {
    const cookieStore = await cookies();
    
    // "ALL" is a special value for Admins to see everything
    cookieStore.set("admin_property_scope", propertyId, {
        path: "/",
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    revalidatePath("/admin");
}
