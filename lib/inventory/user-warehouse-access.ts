"use server";

import { db } from "@/lib/db";
import { AccessLevel, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

// Types
export interface UserWarehouseAccessRecord {
  id: string;
  userId: string;
  warehouseId: string;
  accessLevel: AccessLevel;
  createdAt: Date;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
  };
  warehouse?: {
    id: string;
    name: string;
    propertyId: string;
  };
}

export interface GrantAccessInput {
  userId: string;
  warehouseId: string;
  accessLevel: AccessLevel;
}

// Access level hierarchy for permission checks
const ACCESS_LEVEL_HIERARCHY: Record<AccessLevel, number> = {
  VIEW: 1,
  MANAGE: 2,
  ADMIN: 3,
};

/**
 * Check if a user is a super admin (has ADMIN role)
 * Super admins bypass all warehouse access checks
 */
async function isSuperAdmin(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === "ADMIN";
}

/**
 * Get all warehouse access records for a user
 * Requirements: 2.1
 * 
 * Returns all UserWarehouseAccess records for the specified user,
 * including warehouse details.
 */
export async function getUserWarehouseAccess(
  userId: string
): Promise<UserWarehouseAccessRecord[]> {
  try {
    const accessRecords = await db.userWarehouseAccess.findMany({
      where: { userId },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            propertyId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return accessRecords;
  } catch (error) {
    console.error("Get User Warehouse Access Error:", error);
    return [];
  }
}


/**
 * Check if a user has the required access level for a warehouse
 * Requirements: 2.2, 2.3, 2.4
 * 
 * Property 3: Warehouse Access Level Enforcement
 * For any user with a specific access level (VIEW, MANAGE, ADMIN) on a warehouse,
 * the system SHALL permit exactly the operations allowed for that level and deny all others.
 * 
 * Access Level Hierarchy:
 * - VIEW: Read-only access to stock levels and movements
 * - MANAGE: VIEW + stock receipts, transfers, adjustments, requisitions
 * - ADMIN: MANAGE + user access management
 * 
 * @param userId - The user ID to check
 * @param warehouseId - The warehouse ID to check access for
 * @param requiredLevel - The minimum access level required for the operation
 * @returns true if user has sufficient access, false otherwise
 */
export async function checkWarehouseAccess(
  userId: string,
  warehouseId: string,
  requiredLevel: AccessLevel
): Promise<boolean> {
  try {
    // Super admins bypass all access checks (Requirement 2.6)
    if (await isSuperAdmin(userId)) {
      return true;
    }

    // Get the user's access record for this warehouse
    const accessRecord = await db.userWarehouseAccess.findUnique({
      where: {
        userId_warehouseId: {
          userId,
          warehouseId,
        },
      },
      select: { accessLevel: true },
    });

    // No access record means no access
    if (!accessRecord) {
      return false;
    }

    // Check if user's access level meets or exceeds the required level
    const userLevelValue = ACCESS_LEVEL_HIERARCHY[accessRecord.accessLevel];
    const requiredLevelValue = ACCESS_LEVEL_HIERARCHY[requiredLevel];

    return userLevelValue >= requiredLevelValue;
  } catch (error) {
    console.error("Check Warehouse Access Error:", error);
    return false;
  }
}

/**
 * Get all warehouses accessible to a user within a property scope
 * Requirements: 2.5, 2.6
 * 
 * Property 4: Warehouse Access Filtering
 * For any user querying warehouses, the returned list SHALL contain only warehouses
 * where the user has at least VIEW access (or all warehouses if super admin).
 * 
 * @param userId - The user ID
 * @param propertyId - Optional property ID to filter by (if not provided, returns all accessible warehouses)
 * @param minAccessLevel - Optional minimum access level filter (defaults to VIEW)
 * @returns List of accessible warehouses
 */
export async function getAccessibleWarehouses(
  userId: string,
  propertyId?: string,
  minAccessLevel: AccessLevel = "VIEW"
): Promise<
  Array<{
    id: string;
    name: string;
    type: string;
    propertyId: string;
    isActive: boolean;
    accessLevel: AccessLevel;
    property?: {
      id: string;
      name: string;
    };
  }>
> {
  try {
    // Super admins get all warehouses (Requirement 2.6)
    if (await isSuperAdmin(userId)) {
      const whereClause: Prisma.WarehouseWhereInput = {};
      if (propertyId) {
        whereClause.propertyId = propertyId;
      }

      const warehouses = await db.warehouse.findMany({
        where: whereClause,
        include: {
          property: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { name: "asc" },
      });

      // Super admins have ADMIN access to all warehouses
      return warehouses.map((w) => ({
        id: w.id,
        name: w.name,
        type: w.type,
        propertyId: w.propertyId,
        isActive: w.isActive,
        accessLevel: "ADMIN" as AccessLevel,
        property: w.property,
      }));
    }

    // Get user's warehouse access records with minimum required level
    const minLevelValue = ACCESS_LEVEL_HIERARCHY[minAccessLevel];
    const accessLevelsToInclude = (
      Object.entries(ACCESS_LEVEL_HIERARCHY) as [AccessLevel, number][]
    )
      .filter(([, value]) => value >= minLevelValue)
      .map(([level]) => level);

    const whereClause: Prisma.UserWarehouseAccessWhereInput = {
      userId,
      accessLevel: { in: accessLevelsToInclude },
    };

    if (propertyId) {
      whereClause.warehouse = { propertyId };
    }

    const accessRecords = await db.userWarehouseAccess.findMany({
      where: whereClause,
      include: {
        warehouse: {
          include: {
            property: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { warehouse: { name: "asc" } },
    });

    return accessRecords.map((record) => ({
      id: record.warehouse.id,
      name: record.warehouse.name,
      type: record.warehouse.type,
      propertyId: record.warehouse.propertyId,
      isActive: record.warehouse.isActive,
      accessLevel: record.accessLevel,
      property: record.warehouse.property,
    }));
  } catch (error) {
    console.error("Get Accessible Warehouses Error:", error);
    return [];
  }
}


/**
 * Grant warehouse access to a user
 * Requirements: 2.1, 2.4
 * 
 * Creates or updates a UserWarehouseAccess record linking a user to a warehouse
 * with the specified access level.
 * 
 * @param input - The grant access input containing userId, warehouseId, and accessLevel
 * @returns The created or updated access record
 */
export async function grantWarehouseAccess(
  input: GrantAccessInput
): Promise<{ success: boolean; data?: UserWarehouseAccessRecord; error?: string }> {
  try {
    // Validate user exists
    const user = await db.user.findUnique({
      where: { id: input.userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Validate warehouse exists
    const warehouse = await db.warehouse.findUnique({
      where: { id: input.warehouseId },
      select: { id: true, name: true, propertyId: true },
    });

    if (!warehouse) {
      return { success: false, error: "Warehouse not found" };
    }

    // Validate access level
    if (!Object.keys(ACCESS_LEVEL_HIERARCHY).includes(input.accessLevel)) {
      return {
        success: false,
        error: `Invalid access level. Must be one of: ${Object.keys(ACCESS_LEVEL_HIERARCHY).join(", ")}`,
      };
    }

    // Upsert the access record (create or update if exists)
    const accessRecord = await db.userWarehouseAccess.upsert({
      where: {
        userId_warehouseId: {
          userId: input.userId,
          warehouseId: input.warehouseId,
        },
      },
      update: {
        accessLevel: input.accessLevel,
      },
      create: {
        userId: input.userId,
        warehouseId: input.warehouseId,
        accessLevel: input.accessLevel,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            propertyId: true,
          },
        },
      },
    });

    revalidatePath("/admin/inventory/warehouses");
    revalidatePath(`/admin/inventory/warehouses/${input.warehouseId}`);

    return { success: true, data: accessRecord };
  } catch (error) {
    console.error("Grant Warehouse Access Error:", error);
    return { success: false, error: "Failed to grant warehouse access" };
  }
}

/**
 * Revoke warehouse access from a user
 * Requirements: 2.1
 * 
 * Removes the UserWarehouseAccess record linking a user to a warehouse.
 * 
 * @param userId - The user ID
 * @param warehouseId - The warehouse ID
 * @returns Success status
 */
export async function revokeWarehouseAccess(
  userId: string,
  warehouseId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if access record exists
    const existingAccess = await db.userWarehouseAccess.findUnique({
      where: {
        userId_warehouseId: {
          userId,
          warehouseId,
        },
      },
    });

    if (!existingAccess) {
      return { success: false, error: "Access record not found" };
    }

    // Delete the access record
    await db.userWarehouseAccess.delete({
      where: {
        userId_warehouseId: {
          userId,
          warehouseId,
        },
      },
    });

    revalidatePath("/admin/inventory/warehouses");
    revalidatePath(`/admin/inventory/warehouses/${warehouseId}`);

    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { success: false, error: "Access record not found" };
      }
    }
    console.error("Revoke Warehouse Access Error:", error);
    return { success: false, error: "Failed to revoke warehouse access" };
  }
}

/**
 * Get all users with access to a specific warehouse
 * Requirements: 2.1
 * 
 * Returns all users who have been granted access to the specified warehouse,
 * along with their access levels.
 * 
 * @param warehouseId - The warehouse ID
 * @returns List of users with their access levels
 */
export async function getWarehouseUsers(
  warehouseId: string
): Promise<
  Array<{
    id: string;
    userId: string;
    accessLevel: AccessLevel;
    createdAt: Date;
    user: {
      id: string;
      name: string | null;
      email: string | null;
    };
  }>
> {
  try {
    const accessRecords = await db.userWarehouseAccess.findMany({
      where: { warehouseId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ accessLevel: "desc" }, { createdAt: "asc" }],
    });

    return accessRecords;
  } catch (error) {
    console.error("Get Warehouse Users Error:", error);
    return [];
  }
}

/**
 * Update a user's access level for a warehouse
 * Requirements: 2.4
 * 
 * @param userId - The user ID
 * @param warehouseId - The warehouse ID
 * @param newAccessLevel - The new access level
 * @returns Success status with updated record
 */
export async function updateWarehouseAccess(
  userId: string,
  warehouseId: string,
  newAccessLevel: AccessLevel
): Promise<{ success: boolean; data?: UserWarehouseAccessRecord; error?: string }> {
  try {
    // Validate access level
    if (!Object.keys(ACCESS_LEVEL_HIERARCHY).includes(newAccessLevel)) {
      return {
        success: false,
        error: `Invalid access level. Must be one of: ${Object.keys(ACCESS_LEVEL_HIERARCHY).join(", ")}`,
      };
    }

    const accessRecord = await db.userWarehouseAccess.update({
      where: {
        userId_warehouseId: {
          userId,
          warehouseId,
        },
      },
      data: {
        accessLevel: newAccessLevel,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            propertyId: true,
          },
        },
      },
    });

    revalidatePath("/admin/inventory/warehouses");
    revalidatePath(`/admin/inventory/warehouses/${warehouseId}`);

    return { success: true, data: accessRecord };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { success: false, error: "Access record not found" };
      }
    }
    console.error("Update Warehouse Access Error:", error);
    return { success: false, error: "Failed to update warehouse access" };
  }
}

/**
 * Check if a user has any access to a warehouse (at least VIEW level)
 * Requirements: 2.5
 * 
 * @param userId - The user ID
 * @param warehouseId - The warehouse ID
 * @returns true if user has any access, false otherwise
 */
export async function hasWarehouseAccess(
  userId: string,
  warehouseId: string
): Promise<boolean> {
  return checkWarehouseAccess(userId, warehouseId, "VIEW");
}

/**
 * Check if a user can manage a warehouse (MANAGE or ADMIN level)
 * Requirements: 2.3
 * 
 * @param userId - The user ID
 * @param warehouseId - The warehouse ID
 * @returns true if user can manage, false otherwise
 */
export async function canManageWarehouse(
  userId: string,
  warehouseId: string
): Promise<boolean> {
  return checkWarehouseAccess(userId, warehouseId, "MANAGE");
}

/**
 * Check if a user is an admin of a warehouse (ADMIN level)
 * Requirements: 2.4
 * 
 * @param userId - The user ID
 * @param warehouseId - The warehouse ID
 * @returns true if user is admin, false otherwise
 */
export async function isWarehouseAdmin(
  userId: string,
  warehouseId: string
): Promise<boolean> {
  return checkWarehouseAccess(userId, warehouseId, "ADMIN");
}
