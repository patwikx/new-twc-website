"use server";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * Property Context Service
 * 
 * This service provides property-aware data filtering for all services.
 * It reads the current property scope from cookies and provides utilities
 * for filtering queries by property.
 * 
 * Requirements: 1.1, 1.2, 1.3
 * 
 * Property 1: Property Scope Filtering
 * For any data query executed while a user has a specific property selected,
 * all returned records SHALL belong to that property (or have a valid relationship to that property).
 * 
 * Property 2: Super Admin All Properties Access
 * For any super admin user with "All Properties" selected, data queries SHALL return
 * the union of all records across all properties.
 */

export interface PropertyContext {
  propertyId: string | "ALL";
  isAllProperties: boolean;
  userId: string | null;
  isSuperAdmin: boolean;
}

/**
 * Get the current property context from cookies and session
 * 
 * Requirements: 1.1, 1.2, 1.3
 * - WHEN a user selects a property from the Property_Switcher, THE System SHALL filter all subsequent data queries to that property's scope
 * - WHILE a user has a specific property selected, THE System SHALL only display warehouses, stock items, orders, and reports belonging to that property
 * - WHEN a super admin selects "All Properties", THE System SHALL display aggregated data across all properties
 */
export async function getPropertyContext(): Promise<PropertyContext> {
  const session = await auth();
  const cookieStore = await cookies();
  
  const userId = session?.user?.id || null;
  const role = session?.user?.role;
  const isSuperAdmin = role === "ADMIN";
  
  // Get property scope from cookie
  const scopeFromCookie = cookieStore.get("admin_property_scope")?.value;
  
  // Determine the property ID
  let propertyId: string | "ALL";
  
  if (scopeFromCookie === "ALL" && isSuperAdmin) {
    // Super admin with "All Properties" selected
    propertyId = "ALL";
  } else if (scopeFromCookie && scopeFromCookie !== "ALL") {
    // Specific property selected
    propertyId = scopeFromCookie;
  } else if (isSuperAdmin) {
    // Super admin with no selection defaults to ALL
    propertyId = "ALL";
  } else {
    // Non-admin users need a specific property
    // Get the first accessible property
    const firstProperty = await db.property.findFirst({
      select: { id: true },
      orderBy: { name: "asc" },
    });
    propertyId = firstProperty?.id || "ALL";
  }
  
  return {
    propertyId,
    isAllProperties: propertyId === "ALL",
    userId,
    isSuperAdmin,
  };
}

/**
 * Set the property context (stored in cookie)
 */
export async function setPropertyContext(propertyId: string): Promise<void> {
  const cookieStore = await cookies();
  
  cookieStore.set("admin_property_scope", propertyId, {
    path: "/",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
}

/**
 * Get the property filter for Prisma queries
 * 
 * Requirements: 1.1, 1.2, 1.3
 * 
 * Returns a filter object that can be spread into Prisma where clauses.
 * For super admins with "All Properties", returns an empty object (no filter).
 * For specific properties, returns { propertyId: <id> }.
 * 
 * @param context - Optional property context (will be fetched if not provided)
 * @returns Filter object for Prisma queries
 */
export async function getPropertyFilter(context?: PropertyContext): Promise<{ propertyId?: string }> {
  const ctx = context || await getPropertyContext();
  
  if (ctx.isAllProperties && ctx.isSuperAdmin) {
    // Super admin with "All Properties" - no filter
    return {};
  }
  
  if (ctx.propertyId === "ALL") {
    // Non-super admin shouldn't have ALL, but handle gracefully
    return {};
  }
  
  return { propertyId: ctx.propertyId };
}

/**
 * Check if a user has access to a specific property
 * 
 * Requirements: 1.4
 * - IF a user attempts to access data outside their property scope, THEN THE System SHALL deny access
 * 
 * @param propertyId - The property ID to check access for
 * @param context - Optional property context (will be fetched if not provided)
 * @returns true if user has access, false otherwise
 */
export async function hasPropertyAccess(propertyId: string, context?: PropertyContext): Promise<boolean> {
  const ctx = context || await getPropertyContext();
  
  // Super admins have access to all properties
  if (ctx.isSuperAdmin) {
    return true;
  }
  
  // Check if the property matches the current scope
  if (ctx.propertyId === "ALL") {
    // Non-super admin with ALL scope - check if property exists and is accessible
    const property = await db.property.findUnique({
      where: { id: propertyId },
      select: { id: true },
    });
    return !!property;
  }
  
  return ctx.propertyId === propertyId;
}

/**
 * Validate property access and throw error if denied
 * 
 * Requirements: 1.4
 * - IF a user attempts to access data outside their property scope, THEN THE System SHALL deny access and display an authorization error
 * 
 * @param propertyId - The property ID to validate access for
 * @param context - Optional property context (will be fetched if not provided)
 * @throws Error if access is denied
 */
export async function validatePropertyAccess(propertyId: string, context?: PropertyContext): Promise<void> {
  const hasAccess = await hasPropertyAccess(propertyId, context);
  
  if (!hasAccess) {
    throw new Error("Access denied: You do not have permission to access this property's data");
  }
}

/**
 * Get all accessible property IDs for the current user
 * 
 * @param context - Optional property context (will be fetched if not provided)
 * @returns Array of property IDs the user can access
 */
export async function getAccessiblePropertyIds(context?: PropertyContext): Promise<string[]> {
  const ctx = context || await getPropertyContext();
  
  if (ctx.isSuperAdmin || ctx.isAllProperties) {
    // Super admin can access all properties
    const properties = await db.property.findMany({
      select: { id: true },
    });
    return properties.map(p => p.id);
  }
  
  if (ctx.propertyId && ctx.propertyId !== "ALL") {
    return [ctx.propertyId];
  }
  
  return [];
}

/**
 * Apply property filter to a Prisma where clause
 * 
 * This is a utility function that merges the property filter with an existing where clause.
 * 
 * @param where - Existing Prisma where clause
 * @param context - Optional property context (will be fetched if not provided)
 * @returns Merged where clause with property filter
 */
export async function withPropertyFilter<T extends Record<string, unknown>>(
  where: T,
  context?: PropertyContext
): Promise<T & { propertyId?: string }> {
  const filter = await getPropertyFilter(context);
  return { ...where, ...filter };
}

/**
 * Get property filter for nested relations
 * 
 * For queries that need to filter by property through a relation (e.g., warehouse.propertyId),
 * this function returns the appropriate nested filter.
 * 
 * @param relationPath - The path to the property relation (e.g., "warehouse" for warehouse.propertyId)
 * @param context - Optional property context (will be fetched if not provided)
 * @returns Nested filter object for Prisma queries
 */
export async function getNestedPropertyFilter(
  relationPath: string,
  context?: PropertyContext
): Promise<Record<string, { propertyId?: string }>> {
  const ctx = context || await getPropertyContext();
  
  if (ctx.isAllProperties && ctx.isSuperAdmin) {
    // Super admin with "All Properties" - no filter
    return {};
  }
  
  if (ctx.propertyId === "ALL") {
    return {};
  }
  
  return {
    [relationPath]: { propertyId: ctx.propertyId },
  };
}
