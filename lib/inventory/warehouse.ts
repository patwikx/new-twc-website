"use server";

import { db } from "@/lib/db";
import { AccessLevel, Prisma, WarehouseType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getPropertyContext, getPropertyFilter, validatePropertyAccess } from "@/lib/property-context";

// Types
export interface CreateWarehouseInput {
  propertyId: string;
  name: string;
  type: WarehouseType;
}

export interface UpdateWarehouseInput {
  name?: string;
  type?: WarehouseType;
}

export interface WarehouseSearchQuery {
  propertyId?: string;
  type?: WarehouseType;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  userId?: string; // Optional: filter by user access
  minAccessLevel?: AccessLevel; // Optional: minimum access level required
}

// Valid warehouse types for validation
const VALID_WAREHOUSE_TYPES: WarehouseType[] = [
  "MAIN_STOCKROOM",
  "KITCHEN",
  "HOUSEKEEPING",
  "BAR",
  "MINIBAR",
];

// Access level hierarchy for permission checks
const ACCESS_LEVEL_HIERARCHY: Record<AccessLevel, number> = {
  VIEW: 1,
  MANAGE: 2,
  ADMIN: 3,
};

/**
 * Check if a user is a super admin (has ADMIN role)
 * Super admins bypass all warehouse access checks
 * Requirements: 2.6
 */
async function isSuperAdmin(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role === "ADMIN";
}

/**
 * Validate warehouse type enum
 * Property 2: Warehouse Type Validation
 * For any warehouse type value, it SHALL be one of: MAIN_STOCKROOM, KITCHEN, HOUSEKEEPING, BAR, or MINIBAR.
 */
function isValidWarehouseType(type: string): type is WarehouseType {
  return VALID_WAREHOUSE_TYPES.includes(type as WarehouseType);
}

// CRUD Operations

/**
 * Create a new warehouse
 * Requirements: 1.1, 1.2, 1.3
 * 
 * Property 1: Warehouse Creation Completeness
 * For any valid warehouse creation input with name, type, and property association,
 * the created warehouse SHALL have a unique non-null identifier, the provided name and type,
 * and a non-null creation timestamp.
 */
export async function createWarehouse(data: CreateWarehouseInput) {
  // Validate required fields
  if (!data.propertyId || data.propertyId.trim() === "") {
    return { error: "Property ID is required" };
  }

  if (!data.name || data.name.trim() === "") {
    return { error: "Warehouse name is required" };
  }

  // Validate warehouse type enum (Property 2)
  if (!data.type || !isValidWarehouseType(data.type)) {
    return {
      error: `Invalid warehouse type. Must be one of: ${VALID_WAREHOUSE_TYPES.join(", ")}`,
    };
  }

  try {
    // Check if property exists
    const property = await db.property.findUnique({
      where: { id: data.propertyId },
    });

    if (!property) {
      return { error: "Property not found" };
    }

    const warehouse = await db.warehouse.create({
      data: {
        propertyId: data.propertyId,
        name: data.name.trim(),
        type: data.type,
        isActive: true,
      },
    });

    revalidatePath("/admin/inventory/warehouses");
    return { success: true, data: warehouse };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Unique constraint violation - name must be unique per property
      if (error.code === "P2002") {
        return {
          error: "A warehouse with this name already exists for this property",
        };
      }
    }
    console.error("Create Warehouse Error:", error);
    return { error: "Failed to create warehouse" };
  }
}

/**
 * Get a warehouse by ID
 * Requirements: 2.5, 2.6
 * 
 * Property 4: Warehouse Access Filtering
 * For any user querying warehouses, the returned list SHALL contain only warehouses
 * where the user has at least VIEW access (or all warehouses if super admin).
 * 
 * @param id - The warehouse ID
 * @param userId - Optional user ID for access control filtering
 * @returns The warehouse if found and accessible, null otherwise
 */
export async function getWarehouseById(id: string, userId?: string) {
  try {
    // If userId is provided, check access
    if (userId) {
      // Super admins bypass access checks (Requirement 2.6)
      const isAdmin = await isSuperAdmin(userId);
      
      if (!isAdmin) {
        // Check if user has at least VIEW access to this warehouse
        const accessRecord = await db.userWarehouseAccess.findUnique({
          where: {
            userId_warehouseId: {
              userId,
              warehouseId: id,
            },
          },
        });

        // No access record means no access (Requirement 2.5)
        if (!accessRecord) {
          return null;
        }
      }
    }

    const warehouse = await db.warehouse.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        stockLevels: {
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                sku: true,
                category: true,
              },
            },
          },
        },
        _count: {
          select: {
            stockLevels: true,
            stockBatches: true,
            movementsFrom: true,
            movementsTo: true,
            requisitionsFrom: true,
            requisitionsTo: true,
            linens: true,
            wasteRecords: true,
          },
        },
      },
    });

    return warehouse;
  } catch (error) {
    console.error("Get Warehouse Error:", error);
    return null;
  }
}

/**
 * Get all warehouses for a property
 * Requirements: 1.4 - Display current stock levels for all items in that warehouse
 */
export async function getWarehousesByProperty(propertyId: string) {
  try {
    const warehouses = await db.warehouse.findMany({
      where: { propertyId },
      include: {
        stockLevels: {
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                sku: true,
                category: true,
              },
            },
          },
        },
        _count: {
          select: {
            stockLevels: true,
            stockBatches: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return warehouses;
  } catch (error) {
    console.error("Get Warehouses By Property Error:", error);
    return [];
  }
}

/**
 * Get all warehouses with optional filtering
 * Requirements: 1.1, 1.2, 2.5, 2.6
 * 
 * Property 1: Property Scope Filtering
 * For any data query executed while a user has a specific property selected,
 * all returned records SHALL belong to that property.
 * 
 * Property 4: Warehouse Access Filtering
 * For any user querying warehouses, the returned list SHALL contain only warehouses
 * where the user has at least VIEW access (or all warehouses if super admin).
 */
export async function getWarehouses(query?: WarehouseSearchQuery) {
  try {
    const where: Prisma.WarehouseWhereInput = {};

    // Apply property context filtering (Requirements 1.1, 1.2)
    // If propertyId is explicitly provided, use it; otherwise, use the current property context
    if (query?.propertyId) {
      where.propertyId = query.propertyId;
    } else {
      // Get property filter from context
      const propertyFilter = await getPropertyFilter();
      if (propertyFilter.propertyId) {
        where.propertyId = propertyFilter.propertyId;
      }
    }

    if (query?.type) {
      where.type = query.type;
    }

    if (query?.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    // If userId is provided, filter by user access (Requirements 2.5, 2.6)
    if (query?.userId) {
      // Super admins bypass access checks (Requirement 2.6)
      const isAdmin = await isSuperAdmin(query.userId);
      
      if (!isAdmin) {
        // Get warehouse IDs the user has access to
        const minLevelValue = query.minAccessLevel 
          ? ACCESS_LEVEL_HIERARCHY[query.minAccessLevel] 
          : ACCESS_LEVEL_HIERARCHY.VIEW;
        
        const accessLevelsToInclude = (
          Object.entries(ACCESS_LEVEL_HIERARCHY) as [AccessLevel, number][]
        )
          .filter(([, value]) => value >= minLevelValue)
          .map(([level]) => level);

        const accessRecords = await db.userWarehouseAccess.findMany({
          where: {
            userId: query.userId,
            accessLevel: { in: accessLevelsToInclude },
          },
          select: { warehouseId: true },
        });

        const accessibleWarehouseIds = accessRecords.map(r => r.warehouseId);
        
        // Filter warehouses to only those the user has access to
        where.id = { in: accessibleWarehouseIds };
      }
    }

    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const [warehouses, total] = await Promise.all([
      db.warehouse.findMany({
        where,
        include: {
          property: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              stockLevels: true,
              stockBatches: true,
            },
          },
        },
        orderBy: [{ property: { name: "asc" } }, { name: "asc" }],
        skip,
        take: pageSize,
      }),
      db.warehouse.count({ where }),
    ]);

    return {
      warehouses,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Get Warehouses Error:", error);
    return {
      warehouses: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    };
  }
}

/**
 * Get all active warehouses for a property (for dropdowns)
 * Requirements: 2.5, 2.6
 * 
 * @param propertyId - The property ID
 * @param userId - Optional user ID for access control filtering
 * @returns List of active warehouses accessible to the user
 */
export async function getActiveWarehouses(propertyId: string, userId?: string) {
  try {
    const where: Prisma.WarehouseWhereInput = {
      propertyId,
      isActive: true,
    };

    // If userId is provided, filter by user access (Requirements 2.5, 2.6)
    if (userId) {
      // Super admins bypass access checks (Requirement 2.6)
      const isAdmin = await isSuperAdmin(userId);
      
      if (!isAdmin) {
        // Get warehouse IDs the user has access to
        const accessRecords = await db.userWarehouseAccess.findMany({
          where: {
            userId,
            warehouse: { propertyId },
          },
          select: { warehouseId: true },
        });

        const accessibleWarehouseIds = accessRecords.map(r => r.warehouseId);
        
        // Filter warehouses to only those the user has access to
        where.id = { in: accessibleWarehouseIds };
      }
    }

    const warehouses = await db.warehouse.findMany({
      where,
      select: {
        id: true,
        name: true,
        type: true,
      },
      orderBy: { name: "asc" },
    });

    return warehouses;
  } catch (error) {
    console.error("Get Active Warehouses Error:", error);
    return [];
  }
}

/**
 * Update a warehouse
 */
export async function updateWarehouse(id: string, data: UpdateWarehouseInput) {
  try {
    const updateData: Prisma.WarehouseUpdateInput = {};

    if (data.name !== undefined) {
      if (!data.name || data.name.trim() === "") {
        return { error: "Warehouse name cannot be empty" };
      }
      updateData.name = data.name.trim();
    }

    if (data.type !== undefined) {
      // Validate warehouse type enum (Property 2)
      if (!isValidWarehouseType(data.type)) {
        return {
          error: `Invalid warehouse type. Must be one of: ${VALID_WAREHOUSE_TYPES.join(", ")}`,
        };
      }
      updateData.type = data.type;
    }

    const warehouse = await db.warehouse.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/admin/inventory/warehouses");
    revalidatePath(`/admin/inventory/warehouses/${id}`);
    return { success: true, data: warehouse };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Warehouse not found" };
      }
      if (error.code === "P2002") {
        return {
          error: "A warehouse with this name already exists for this property",
        };
      }
    }
    console.error("Update Warehouse Error:", error);
    return { error: "Failed to update warehouse" };
  }
}

/**
 * Deactivate a warehouse (soft delete)
 * Requirements: 1.5 - Allow warehouses to be activated or deactivated without deleting historical data
 * 
 * Property 3: Warehouse Deactivation Preserves History
 * For any warehouse with existing stock movements and levels, deactivating the warehouse
 * SHALL preserve all historical movement records and stock level records unchanged.
 */
export async function deactivateWarehouse(id: string) {
  try {
    // Simply set isActive to false - this preserves all historical data
    // Stock movements, stock levels, requisitions, etc. remain intact
    const warehouse = await db.warehouse.update({
      where: { id },
      data: { isActive: false },
    });

    revalidatePath("/admin/inventory/warehouses");
    return { success: true, data: warehouse };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Warehouse not found" };
      }
    }
    console.error("Deactivate Warehouse Error:", error);
    return { error: "Failed to deactivate warehouse" };
  }
}

/**
 * Reactivate a warehouse
 */
export async function reactivateWarehouse(id: string) {
  try {
    const warehouse = await db.warehouse.update({
      where: { id },
      data: { isActive: true },
    });

    revalidatePath("/admin/inventory/warehouses");
    return { success: true, data: warehouse };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Warehouse not found" };
      }
    }
    console.error("Reactivate Warehouse Error:", error);
    return { error: "Failed to reactivate warehouse" };
  }
}

/**
 * Get warehouse stock summary
 * Returns aggregated stock information for a warehouse
 */
export async function getWarehouseStockSummary(warehouseId: string) {
  try {
    const stockLevels = await db.stockLevel.findMany({
      where: { warehouseId },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
            primaryUnit: {
              select: {
                abbreviation: true,
              },
            },
          },
        },
      },
    });

    // Calculate total value
    const totalValue = stockLevels.reduce((sum, level) => {
      return sum + Number(level.quantity) * Number(level.averageCost);
    }, 0);

    // Group by category
    const byCategory = stockLevels.reduce(
      (acc, level) => {
        const categoryId = level.stockItem.category.id;
        const categoryName = level.stockItem.category.name;
        if (!acc[categoryId]) {
          acc[categoryId] = { name: categoryName, count: 0, value: 0 };
        }
        acc[categoryId].count += 1;
        acc[categoryId].value += Number(level.quantity) * Number(level.averageCost);
        return acc;
      },
      {} as Record<string, { name: string; count: number; value: number }>
    );

    return {
      totalItems: stockLevels.length,
      totalValue,
      byCategory,
      items: stockLevels,
    };
  } catch (error) {
    console.error("Get Warehouse Stock Summary Error:", error);
    return null;
  }
}
