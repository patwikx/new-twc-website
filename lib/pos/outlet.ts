"use server";

import { db } from "@/lib/db";
import { OutletType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getPropertyFilter } from "@/lib/property-context";

// Types
export interface CreateOutletInput {
  propertyId: string;
  name: string;
  type: OutletType;
  warehouseId: string;
}

export interface UpdateOutletInput {
  name?: string;
  type?: OutletType;
  warehouseId?: string;
}

export interface OutletSearchQuery {
  propertyId?: string;
  type?: OutletType;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

// Valid outlet types for validation
const VALID_OUTLET_TYPES: OutletType[] = [
  "RESTAURANT",
  "BAR",
  "ROOM_SERVICE",
  "POOL_BAR",
  "CAFE",
  "MINIBAR",
];

/**
 * Validate outlet type enum
 * Requirements: 3.1
 */
function isValidOutletType(type: string): type is OutletType {
  return VALID_OUTLET_TYPES.includes(type as OutletType);
}

// CRUD Operations

/**
 * Create a new sales outlet
 * Requirements: 3.1, 3.2
 * 
 * - THE System SHALL support creating Sales_Outlets of types: RESTAURANT, BAR, ROOM_SERVICE, POOL_BAR, CAFE, MINIBAR
 * - WHEN creating a Sales_Outlet, THE System SHALL require linking it to a property and an inventory warehouse
 */
export async function createOutlet(data: CreateOutletInput) {
  // Validate required fields
  if (!data.propertyId || data.propertyId.trim() === "") {
    return { error: "Property ID is required" };
  }

  if (!data.name || data.name.trim() === "") {
    return { error: "Outlet name is required" };
  }

  // Validate outlet type enum (Requirement 3.1)
  if (!data.type || !isValidOutletType(data.type)) {
    return {
      error: `Invalid outlet type. Must be one of: ${VALID_OUTLET_TYPES.join(", ")}`,
    };
  }

  // Validate warehouse is required (Requirement 3.2)
  if (!data.warehouseId || data.warehouseId.trim() === "") {
    return { error: "Warehouse is required for sales outlets" };
  }

  try {
    // Check if property exists
    const property = await db.property.findUnique({
      where: { id: data.propertyId },
    });

    if (!property) {
      return { error: "Property not found" };
    }

    // Check if warehouse exists and belongs to the same property
    const warehouse = await db.warehouse.findUnique({
      where: { id: data.warehouseId },
    });

    if (!warehouse) {
      return { error: "Warehouse not found" };
    }

    if (warehouse.propertyId !== data.propertyId) {
      return { error: "Warehouse must belong to the same property as the outlet" };
    }

    const outlet = await db.salesOutlet.create({
      data: {
        propertyId: data.propertyId,
        name: data.name.trim(),
        type: data.type,
        warehouseId: data.warehouseId,
        isActive: true,
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    revalidatePath("/admin/pos/outlets");
    return { success: true, data: outlet };
  } catch (error) {
    console.error("Create Outlet Error:", error);
    return { error: "Failed to create sales outlet" };
  }
}


/**
 * Get a sales outlet by ID
 */
export async function getOutletById(id: string) {
  try {
    const outlet = await db.salesOutlet.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        _count: {
          select: {
            tables: true,
            orders: true,
            shifts: true,
          },
        },
      },
    });

    return outlet;
  } catch (error) {
    console.error("Get Outlet Error:", error);
    return null;
  }
}

/**
 * Get all sales outlets with optional filtering
 * Requirements: 1.1, 1.2, 3.4
 * 
 * Property 1: Property Scope Filtering
 * For any data query executed while a user has a specific property selected,
 * all returned records SHALL belong to that property.
 * 
 * - THE System SHALL display only Sales_Outlets belonging to the current property scope
 */
export async function getOutlets(query?: OutletSearchQuery) {
  try {
    const where: Prisma.SalesOutletWhereInput = {};

    // Apply property context filtering (Requirements 1.1, 1.2, 3.4)
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

    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const [outlets, total] = await Promise.all([
      db.salesOutlet.findMany({
        where,
        include: {
          property: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          _count: {
            select: {
              tables: true,
              orders: true,
              shifts: true,
            },
          },
        },
        orderBy: [{ property: { name: "asc" } }, { name: "asc" }],
        skip,
        take: pageSize,
      }),
      db.salesOutlet.count({ where }),
    ]);

    return {
      outlets,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Get Outlets Error:", error);
    return {
      outlets: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    };
  }
}

/**
 * Get all active outlets for a property (for dropdowns)
 * Requirements: 3.4
 */
export async function getActiveOutlets(propertyId: string) {
  try {
    const outlets = await db.salesOutlet.findMany({
      where: {
        propertyId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return outlets;
  } catch (error) {
    console.error("Get Active Outlets Error:", error);
    return [];
  }
}

/**
 * Update a sales outlet
 * Requirements: 3.2
 */
export async function updateOutlet(id: string, data: UpdateOutletInput) {
  try {
    // Get existing outlet to validate property context
    const existingOutlet = await db.salesOutlet.findUnique({
      where: { id },
    });

    if (!existingOutlet) {
      return { error: "Sales outlet not found" };
    }

    const updateData: Prisma.SalesOutletUpdateInput = {};

    if (data.name !== undefined) {
      if (!data.name || data.name.trim() === "") {
        return { error: "Outlet name cannot be empty" };
      }
      updateData.name = data.name.trim();
    }

    if (data.type !== undefined) {
      // Validate outlet type enum
      if (!isValidOutletType(data.type)) {
        return {
          error: `Invalid outlet type. Must be one of: ${VALID_OUTLET_TYPES.join(", ")}`,
        };
      }
      updateData.type = data.type;
    }

    if (data.warehouseId !== undefined) {
      if (!data.warehouseId || data.warehouseId.trim() === "") {
        return { error: "Warehouse is required for sales outlets" };
      }

      // Check if warehouse exists and belongs to the same property
      const warehouse = await db.warehouse.findUnique({
        where: { id: data.warehouseId },
      });

      if (!warehouse) {
        return { error: "Warehouse not found" };
      }

      if (warehouse.propertyId !== existingOutlet.propertyId) {
        return { error: "Warehouse must belong to the same property as the outlet" };
      }

      updateData.warehouse = { connect: { id: data.warehouseId } };
    }

    const outlet = await db.salesOutlet.update({
      where: { id },
      data: updateData,
      include: {
        property: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    revalidatePath("/admin/pos/outlets");
    revalidatePath(`/admin/pos/outlets/${id}`);
    return { success: true, data: outlet };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Sales outlet not found" };
      }
    }
    console.error("Update Outlet Error:", error);
    return { error: "Failed to update sales outlet" };
  }
}

/**
 * Deactivate a sales outlet (soft delete)
 * Requirements: 3.3
 * 
 * - WHEN a Sales_Outlet is deactivated, THE System SHALL prevent new orders but allow viewing historical data
 */
export async function deactivateOutlet(id: string) {
  try {
    // Simply set isActive to false - this preserves all historical data
    // Orders, shifts, tables, etc. remain intact for historical viewing
    const outlet = await db.salesOutlet.update({
      where: { id },
      data: { isActive: false },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    revalidatePath("/admin/pos/outlets");
    return { success: true, data: outlet };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Sales outlet not found" };
      }
    }
    console.error("Deactivate Outlet Error:", error);
    return { error: "Failed to deactivate sales outlet" };
  }
}

/**
 * Reactivate a sales outlet
 */
export async function reactivateOutlet(id: string) {
  try {
    const outlet = await db.salesOutlet.update({
      where: { id },
      data: { isActive: true },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    revalidatePath("/admin/pos/outlets");
    return { success: true, data: outlet };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Sales outlet not found" };
      }
    }
    console.error("Reactivate Outlet Error:", error);
    return { error: "Failed to reactivate sales outlet" };
  }
}

/**
 * Get outlets by property (for dropdowns and lists)
 * Requirements: 3.4
 */
export async function getOutletsByProperty(propertyId: string) {
  try {
    const outlets = await db.salesOutlet.findMany({
      where: { propertyId },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        _count: {
          select: {
            tables: true,
            orders: true,
            shifts: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return outlets;
  } catch (error) {
    console.error("Get Outlets By Property Error:", error);
    return [];
  }
}

/**
 * Check if an outlet is active (for order creation validation)
 * Requirements: 3.3
 */
export async function isOutletActive(outletId: string): Promise<boolean> {
  try {
    const outlet = await db.salesOutlet.findUnique({
      where: { id: outletId },
      select: { isActive: true },
    });

    return outlet?.isActive ?? false;
  } catch (error) {
    console.error("Check Outlet Active Error:", error);
    return false;
  }
}
