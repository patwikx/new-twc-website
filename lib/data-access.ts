import { auth } from "@/auth";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { cookies } from "next/headers";

export async function getAccessibleProperties() {
    const session = await auth();
    if (!session?.user?.id) return [];

    const role = session.user.role;

    if (role === "ADMIN") {
        return await db.property.findMany({
            select: { id: true, name: true }
        });
    }

    if (role === "STAFF") {
        return await db.user.findUnique({
            where: { id: session.user.id },
            select: {
                managedProperties: {
                    select: { id: true, name: true }
                }
            }
        }).then(u => u?.managedProperties || []);
    }

    return [];
}

/**
 * Returns a list of Property IDs that the current user is allowed to access.
 * - ADMIN: Returns undefined (implicitly "all") or you can choose to return all IDs.
 *          Returning undefined is often better for "no filter" logic.
 * - STAFF: Returns array of assigned property IDs.
 * - GUEST: Returns empty array.
 */
export async function getAccessiblePropertyIds(): Promise<string[] | undefined | null> {
    const session = await auth();
    
    if (!session?.user?.id) return []; // No access
    
    const role = session.user.role;

    // Admin sees everything (return null/undefined to signal "no filter needed")
    if (role === "ADMIN") {
        return null; 
    }

    // Staff: Fetch assigned properties
    if (role === "STAFF") {
        const user = await db.user.findUnique({
            where: { id: session.user.id },
            select: {
                managedProperties: {
                    select: { id: true }
                }
            }
        });
        
        return user?.managedProperties.map(p => p.id) || [];
    }

    // Default (Guest): See nothing
    return [];
}

/**
 * Returns the Prisma 'where' clause for property filtering based on the CURRENT SELECTION
 * stored in cookies.
 */
export async function getCurrentPropertyFilter() {
    const accessibleIds = await getAccessiblePropertyIds();
    
    // If guest or no access
    if (Array.isArray(accessibleIds) && accessibleIds.length === 0) {
        return { id: "NO_ACCESS" }; // Impossible ID to return nothing
    }

    const cookieStore = await cookies();
    const currentScope = cookieStore.get("admin_property_scope")?.value;

    // ADMIN: If scope is "ALL" or undefined, return empty filter (Show All)
    if (accessibleIds === null && (!currentScope || currentScope === "ALL")) {
        return {}; 
    }

    // STAFF or Admin-with-Scope:
    // Verify the scope is valid (user actually has access to this property)
    // accessibleIds is `string[]` for Staff, `null` for Admin
    
    // If explicit scope is set
    if (currentScope && currentScope !== "ALL") {
        // If Admin (null accessibleIds), they can see any property
        if (accessibleIds === null) {
             return { id: currentScope }; // Or propertyId: currentScope depending on context, handled by caller typically using ID list
        }
        
        // If Staff, check if they truly own this scope
        if (accessibleIds?.includes(currentScope)) {
             return { id: currentScope };
        }
    }

    // If Staff and no scope (or invalid) -> Default to their Preference, or first assigned property
    if (Array.isArray(accessibleIds) && accessibleIds.length > 0) {
        // Fetch user default preference
        const session = await auth();
        if (session?.user?.id) {
            const user = await db.user.findUnique({ 
                where: { id: session.user.id },
                select: { defaultPropertyId: true }
            });
            
            if (user?.defaultPropertyId && accessibleIds.includes(user.defaultPropertyId)) {
                return { id: user.defaultPropertyId };
            }
        }

        // Fallback to first assigned
        return { id: accessibleIds[0] };
    }

    // Fallback to all accessible (safe default)
    if (Array.isArray(accessibleIds)) {
         return { id: { in: accessibleIds } };
    }

    return {};
}
