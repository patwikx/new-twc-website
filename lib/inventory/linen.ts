"use server";

import { db } from "@/lib/db";
import { Prisma, LinenType, LinenStatus, LinenCondition } from "@prisma/client";
import { revalidatePath } from "next/cache";

// Types
export interface CreateLinenItemInput {
  stockItemId: string;
  warehouseId: string;
  type: LinenType;
  serialNumber?: string;
  size?: string;
  condition?: LinenCondition;
  purchaseDate?: Date;
}

export interface UpdateLinenItemInput {
  serialNumber?: string;
  size?: string;
  condition?: LinenCondition;
  purchaseDate?: Date;
}

export interface LinenSearchQuery {
  warehouseId?: string;
  type?: LinenType;
  status?: LinenStatus;
  condition?: LinenCondition;
  assignedRoomId?: string;
  page?: number;
  pageSize?: number;
}

export interface LinenParReport {
  propertyId: string;
  byType: {
    type: LinenType;
    inStock: number;
    inUse: number;
    inLaundry: number;
    damaged: number;
    retired: number;
    total: number;
  }[];
  byWarehouse: {
    warehouseId: string;
    warehouseName: string;
    total: number;
    byStatus: Record<LinenStatus, number>;
  }[];
}

// Valid enum values for validation
const VALID_LINEN_TYPES: LinenType[] = [
  "BED_SHEET",
  "PILLOW_CASE",
  "DUVET_COVER",
  "TOWEL",
  "BATH_MAT",
  "BLANKET",
];

const VALID_LINEN_STATUSES: LinenStatus[] = [
  "IN_STOCK",
  "IN_USE",
  "IN_LAUNDRY",
  "DAMAGED",
  "RETIRED",
];

const VALID_LINEN_CONDITIONS: LinenCondition[] = [
  "NEW",
  "GOOD",
  "FAIR",
  "POOR",
];

/**
 * Validate linen type enum
 * Property 31: Linen Status Validation (also applies to type)
 */
function isValidLinenType(type: string): type is LinenType {
  return VALID_LINEN_TYPES.includes(type as LinenType);
}

/**
 * Validate linen status enum
 * Property 31: Linen Status Validation
 * For any linen status value, it SHALL be one of: IN_STOCK, IN_USE, IN_LAUNDRY, DAMAGED, or RETIRED.
 */
function isValidLinenStatus(status: string): status is LinenStatus {
  return VALID_LINEN_STATUSES.includes(status as LinenStatus);
}

/**
 * Validate linen condition enum
 */
function isValidLinenCondition(condition: string): condition is LinenCondition {
  return VALID_LINEN_CONDITIONS.includes(condition as LinenCondition);
}

// CRUD Operations

/**
 * Create a new linen item
 * Requirements: 8.1
 * 
 * Property 29: Linen Required Attributes
 * For any linen item, it SHALL have non-null values for: type, condition, status, and warehouseId.
 */
export async function createLinenItem(data: CreateLinenItemInput) {
  // Property 29: Validate required fields
  if (!data.stockItemId || data.stockItemId.trim() === "") {
    return { error: "Stock item ID is required" };
  }

  if (!data.warehouseId || data.warehouseId.trim() === "") {
    return { error: "Warehouse ID is required" };
  }

  // Validate linen type
  if (!data.type || !isValidLinenType(data.type)) {
    return {
      error: `Invalid linen type. Must be one of: ${VALID_LINEN_TYPES.join(", ")}`,
    };
  }

  // Validate condition if provided
  if (data.condition && !isValidLinenCondition(data.condition)) {
    return {
      error: `Invalid linen condition. Must be one of: ${VALID_LINEN_CONDITIONS.join(", ")}`,
    };
  }

  try {
    // Check if stock item exists and is a linen category
    const stockItem = await db.stockItem.findUnique({
      where: { id: data.stockItemId },
      include: {
        category: {
          select: { name: true },
        },
      },
    });

    if (!stockItem) {
      return { error: "Stock item not found" };
    }

    if (stockItem.category.name !== "Linen") {
      return { error: "Stock item must be of category Linen" };
    }

    // Check if warehouse exists
    const warehouse = await db.warehouse.findUnique({
      where: { id: data.warehouseId },
    });

    if (!warehouse) {
      return { error: "Warehouse not found" };
    }

    const linenItem = await db.linenItem.create({
      data: {
        stockItemId: data.stockItemId,
        warehouseId: data.warehouseId,
        type: data.type,
        serialNumber: data.serialNumber?.trim() || null,
        size: data.size?.trim() || null,
        condition: data.condition ?? "NEW",
        status: "IN_STOCK",
        purchaseDate: data.purchaseDate || null,
        cycleCount: 0,
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
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

    revalidatePath("/admin/housekeeping/linens");
    return { success: true, data: linenItem };
  } catch (error) {
    console.error("Create Linen Item Error:", error);
    return { error: "Failed to create linen item" };
  }
}

/**
 * Get a linen item by ID
 */
export async function getLinenItemById(id: string) {
  try {
    const linenItem = await db.linenItem.findUnique({
      where: { id },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
            property: {
              select: {
                id: true,
                name: true,
              },
            },
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

    return linenItem;
  } catch (error) {
    console.error("Get Linen Item Error:", error);
    return null;
  }
}

/**
 * Get all linen items with optional filtering
 */
export async function getLinenItems(query?: LinenSearchQuery) {
  try {
    const where: Prisma.LinenItemWhereInput = {};

    if (query?.warehouseId) {
      where.warehouseId = query.warehouseId;
    }

    if (query?.type) {
      where.type = query.type;
    }

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.condition) {
      where.condition = query.condition;
    }

    if (query?.assignedRoomId) {
      where.assignedRoomId = query.assignedRoomId;
    }

    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const [linenItems, total] = await Promise.all([
      db.linenItem.findMany({
        where,
        include: {
          stockItem: {
            select: {
              id: true,
              name: true,
              sku: true,
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
        orderBy: [{ type: "asc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
      }),
      db.linenItem.count({ where }),
    ]);

    return {
      linenItems,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Get Linen Items Error:", error);
    return {
      linenItems: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    };
  }
}

/**
 * Get linen items by warehouse
 */
export async function getLinenItemsByWarehouse(warehouseId: string) {
  try {
    const linenItems = await db.linenItem.findMany({
      where: { warehouseId },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
      orderBy: [{ type: "asc" }, { status: "asc" }],
    });

    return linenItems;
  } catch (error) {
    console.error("Get Linen Items By Warehouse Error:", error);
    return [];
  }
}

/**
 * Get linen items by status
 */
export async function getLinenItemsByStatus(status: LinenStatus) {
  // Property 31: Validate status
  if (!isValidLinenStatus(status)) {
    return [];
  }

  try {
    const linenItems = await db.linenItem.findMany({
      where: { status },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
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
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
    });

    return linenItems;
  } catch (error) {
    console.error("Get Linen Items By Status Error:", error);
    return [];
  }
}

/**
 * Update a linen item
 */
export async function updateLinenItem(id: string, data: UpdateLinenItemInput) {
  try {
    const updateData: Prisma.LinenItemUpdateInput = {};

    if (data.serialNumber !== undefined) {
      updateData.serialNumber = data.serialNumber?.trim() || null;
    }

    if (data.size !== undefined) {
      updateData.size = data.size?.trim() || null;
    }

    if (data.condition !== undefined) {
      if (!isValidLinenCondition(data.condition)) {
        return {
          error: `Invalid linen condition. Must be one of: ${VALID_LINEN_CONDITIONS.join(", ")}`,
        };
      }
      updateData.condition = data.condition;
    }

    if (data.purchaseDate !== undefined) {
      updateData.purchaseDate = data.purchaseDate;
    }

    const linenItem = await db.linenItem.update({
      where: { id },
      data: updateData,
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
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

    revalidatePath("/admin/housekeeping/linens");
    return { success: true, data: linenItem };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Linen item not found" };
      }
    }
    console.error("Update Linen Item Error:", error);
    return { error: "Failed to update linen item" };
  }
}

/**
 * Delete a linen item permanently
 */
export async function deleteLinenItem(id: string) {
  try {
    await db.linenItem.delete({
      where: { id },
    });

    revalidatePath("/admin/housekeeping/linens");
    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Linen item not found" };
      }
    }
    console.error("Delete Linen Item Error:", error);
    return { error: "Failed to delete linen item" };
  }
}


// Lifecycle Operations

/**
 * Issue linen items to a room
 * Requirements: 8.2
 * 
 * Property 30: Linen Room Assignment Tracking
 * For any linen item issued to a room, the assignedRoomId SHALL be set to the room ID
 * and status SHALL be IN_USE.
 */
export async function issueToRoom(itemIds: string[], roomId: string) {
  if (!itemIds || itemIds.length === 0) {
    return { error: "At least one linen item ID is required" };
  }

  if (!roomId || roomId.trim() === "") {
    return { error: "Room ID is required" };
  }

  try {
    // Verify all items exist and are available (IN_STOCK)
    const items = await db.linenItem.findMany({
      where: {
        id: { in: itemIds },
      },
    });

    if (items.length !== itemIds.length) {
      return { error: "One or more linen items not found" };
    }

    const unavailableItems = items.filter(
      (item) => item.status !== "IN_STOCK"
    );

    if (unavailableItems.length > 0) {
      return {
        error: `${unavailableItems.length} item(s) are not available for issue (not IN_STOCK)`,
      };
    }

    // Property 30: Update all items - set assignedRoomId and status to IN_USE
    const updatedItems = await db.$transaction(
      itemIds.map((id) =>
        db.linenItem.update({
          where: { id },
          data: {
            assignedRoomId: roomId.trim(),
            status: "IN_USE",
          },
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                sku: true,
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
        })
      )
    );

    revalidatePath("/admin/housekeeping/linens");
    return { success: true, data: updatedItems };
  } catch (error) {
    console.error("Issue To Room Error:", error);
    return { error: "Failed to issue linen items to room" };
  }
}

/**
 * Return linen items from a room
 * Requirements: 8.2, 8.4
 * 
 * Property 32: Linen Damage Recording
 * For any linen returned with damage, the condition SHALL be updated to reflect the damage level.
 */
export async function returnFromRoom(
  itemIds: string[],
  condition: LinenCondition,
  damageNotes?: string
) {
  if (!itemIds || itemIds.length === 0) {
    return { error: "At least one linen item ID is required" };
  }

  if (!isValidLinenCondition(condition)) {
    return {
      error: `Invalid linen condition. Must be one of: ${VALID_LINEN_CONDITIONS.join(", ")}`,
    };
  }

  try {
    // Verify all items exist and are in use
    const items = await db.linenItem.findMany({
      where: {
        id: { in: itemIds },
      },
    });

    if (items.length !== itemIds.length) {
      return { error: "One or more linen items not found" };
    }

    const notInUseItems = items.filter((item) => item.status !== "IN_USE");

    if (notInUseItems.length > 0) {
      return {
        error: `${notInUseItems.length} item(s) are not currently in use`,
      };
    }

    // Determine new status based on condition
    // Property 32: If damaged (POOR condition), set status to DAMAGED
    const newStatus: LinenStatus = condition === "POOR" ? "DAMAGED" : "IN_STOCK";

    // Update all items
    const updatedItems = await db.$transaction(
      itemIds.map((id) =>
        db.linenItem.update({
          where: { id },
          data: {
            assignedRoomId: null,
            status: newStatus,
            condition,
            // Property 32: Record damage notes if condition is POOR
            damageNotes: condition === "POOR" ? (damageNotes || "Returned damaged") : null,
          },
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                sku: true,
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
        })
      )
    );

    revalidatePath("/admin/housekeeping/linens");
    return { success: true, data: updatedItems };
  } catch (error) {
    console.error("Return From Room Error:", error);
    return { error: "Failed to return linen items from room" };
  }
}

/**
 * Send linen items to laundry
 * Requirements: 8.2
 */
export async function sendToLaundry(itemIds: string[]) {
  if (!itemIds || itemIds.length === 0) {
    return { error: "At least one linen item ID is required" };
  }

  try {
    // Verify all items exist and are in a valid state for laundry
    const items = await db.linenItem.findMany({
      where: {
        id: { in: itemIds },
      },
    });

    if (items.length !== itemIds.length) {
      return { error: "One or more linen items not found" };
    }

    // Items can be sent to laundry from IN_STOCK or IN_USE status
    const invalidItems = items.filter(
      (item) => item.status === "IN_LAUNDRY" || item.status === "RETIRED"
    );

    if (invalidItems.length > 0) {
      return {
        error: `${invalidItems.length} item(s) cannot be sent to laundry (already in laundry or retired)`,
      };
    }

    // Update all items to IN_LAUNDRY status
    const updatedItems = await db.$transaction(
      itemIds.map((id) =>
        db.linenItem.update({
          where: { id },
          data: {
            status: "IN_LAUNDRY",
            assignedRoomId: null, // Clear room assignment if any
          },
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                sku: true,
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
        })
      )
    );

    revalidatePath("/admin/housekeeping/linens");
    return { success: true, data: updatedItems };
  } catch (error) {
    console.error("Send To Laundry Error:", error);
    return { error: "Failed to send linen items to laundry" };
  }
}

/**
 * Receive linen items from laundry
 * Requirements: 8.2
 */
export async function receiveFromLaundry(itemIds: string[]) {
  if (!itemIds || itemIds.length === 0) {
    return { error: "At least one linen item ID is required" };
  }

  try {
    // Verify all items exist and are in laundry
    const items = await db.linenItem.findMany({
      where: {
        id: { in: itemIds },
      },
    });

    if (items.length !== itemIds.length) {
      return { error: "One or more linen items not found" };
    }

    const notInLaundryItems = items.filter(
      (item) => item.status !== "IN_LAUNDRY"
    );

    if (notInLaundryItems.length > 0) {
      return {
        error: `${notInLaundryItems.length} item(s) are not currently in laundry`,
      };
    }

    // Update all items - set status to IN_STOCK, update laundry date and cycle count
    const updatedItems = await db.$transaction(
      itemIds.map((id) =>
        db.linenItem.update({
          where: { id },
          data: {
            status: "IN_STOCK",
            lastLaundryDate: new Date(),
            cycleCount: { increment: 1 },
          },
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                sku: true,
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
        })
      )
    );

    revalidatePath("/admin/housekeeping/linens");
    return { success: true, data: updatedItems };
  } catch (error) {
    console.error("Receive From Laundry Error:", error);
    return { error: "Failed to receive linen items from laundry" };
  }
}

/**
 * Mark a linen item as damaged
 * Requirements: 8.4
 * 
 * Property 32: Linen Damage Recording
 * For any linen returned with damage, the condition SHALL be updated to reflect the damage level
 * and damageNotes SHALL be non-null.
 */
export async function markDamaged(itemId: string, damageType: string) {
  if (!itemId || itemId.trim() === "") {
    return { error: "Linen item ID is required" };
  }

  // Property 32: damageNotes (damageType) SHALL be non-null
  if (!damageType || damageType.trim() === "") {
    return { error: "Damage type/notes is required" };
  }

  try {
    // Verify item exists
    const item = await db.linenItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return { error: "Linen item not found" };
    }

    // Cannot mark already retired items as damaged
    if (item.status === "RETIRED") {
      return { error: "Cannot mark retired linen as damaged" };
    }

    // Property 32: Update condition to POOR and set damageNotes
    const updatedItem = await db.linenItem.update({
      where: { id: itemId },
      data: {
        status: "DAMAGED",
        condition: "POOR",
        damageNotes: damageType.trim(),
        assignedRoomId: null, // Clear room assignment if any
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
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

    revalidatePath("/admin/housekeeping/linens");
    return { success: true, data: updatedItem };
  } catch (error) {
    console.error("Mark Damaged Error:", error);
    return { error: "Failed to mark linen item as damaged" };
  }
}

/**
 * Retire a linen item
 * Requirements: 8.4
 */
export async function retire(itemId: string, reason: string) {
  if (!itemId || itemId.trim() === "") {
    return { error: "Linen item ID is required" };
  }

  if (!reason || reason.trim() === "") {
    return { error: "Retirement reason is required" };
  }

  try {
    // Verify item exists
    const item = await db.linenItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return { error: "Linen item not found" };
    }

    // Cannot retire already retired items
    if (item.status === "RETIRED") {
      return { error: "Linen item is already retired" };
    }

    // Update item to RETIRED status
    const updatedItem = await db.linenItem.update({
      where: { id: itemId },
      data: {
        status: "RETIRED",
        retiredAt: new Date(),
        retiredReason: reason.trim(),
        assignedRoomId: null, // Clear room assignment if any
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
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

    revalidatePath("/admin/housekeeping/linens");
    return { success: true, data: updatedItem };
  } catch (error) {
    console.error("Retire Linen Error:", error);
    return { error: "Failed to retire linen item" };
  }
}

// Reporting

/**
 * Get par level report for housekeeping supplies
 * Requirements: 8.5
 */
export async function getParLevelReport(propertyId: string): Promise<LinenParReport | null> {
  if (!propertyId || propertyId.trim() === "") {
    return null;
  }

  try {
    // Get all linen items for the property
    const linenItems = await db.linenItem.findMany({
      where: {
        stockItem: {
          propertyId,
        },
      },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Group by type
    const byType: LinenParReport["byType"] = VALID_LINEN_TYPES.map((type) => {
      const itemsOfType = linenItems.filter((item) => item.type === type);
      return {
        type,
        inStock: itemsOfType.filter((item) => item.status === "IN_STOCK").length,
        inUse: itemsOfType.filter((item) => item.status === "IN_USE").length,
        inLaundry: itemsOfType.filter((item) => item.status === "IN_LAUNDRY").length,
        damaged: itemsOfType.filter((item) => item.status === "DAMAGED").length,
        retired: itemsOfType.filter((item) => item.status === "RETIRED").length,
        total: itemsOfType.length,
      };
    });

    // Group by warehouse
    const warehouseMap = new Map<
      string,
      { warehouseId: string; warehouseName: string; items: typeof linenItems }
    >();

    for (const item of linenItems) {
      const existing = warehouseMap.get(item.warehouseId);
      if (existing) {
        existing.items.push(item);
      } else {
        warehouseMap.set(item.warehouseId, {
          warehouseId: item.warehouseId,
          warehouseName: item.warehouse.name,
          items: [item],
        });
      }
    }

    const byWarehouse: LinenParReport["byWarehouse"] = Array.from(
      warehouseMap.values()
    ).map((wh) => ({
      warehouseId: wh.warehouseId,
      warehouseName: wh.warehouseName,
      total: wh.items.length,
      byStatus: {
        IN_STOCK: wh.items.filter((item) => item.status === "IN_STOCK").length,
        IN_USE: wh.items.filter((item) => item.status === "IN_USE").length,
        IN_LAUNDRY: wh.items.filter((item) => item.status === "IN_LAUNDRY").length,
        DAMAGED: wh.items.filter((item) => item.status === "DAMAGED").length,
        RETIRED: wh.items.filter((item) => item.status === "RETIRED").length,
      },
    }));

    return {
      propertyId,
      byType,
      byWarehouse,
    };
  } catch (error) {
    console.error("Get Par Level Report Error:", error);
    return null;
  }
}

/**
 * Get linen items assigned to a specific room
 */
export async function getLinenItemsByRoom(roomId: string) {
  if (!roomId || roomId.trim() === "") {
    return [];
  }

  try {
    const linenItems = await db.linenItem.findMany({
      where: {
        assignedRoomId: roomId,
        status: "IN_USE",
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
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
      orderBy: { type: "asc" },
    });

    return linenItems;
  } catch (error) {
    console.error("Get Linen Items By Room Error:", error);
    return [];
  }
}

/**
 * Get linen inventory summary by property
 */
export async function getLinenSummaryByProperty(propertyId: string) {
  if (!propertyId || propertyId.trim() === "") {
    return null;
  }

  try {
    const linenItems = await db.linenItem.findMany({
      where: {
        stockItem: {
          propertyId,
        },
      },
      select: {
        status: true,
        type: true,
        condition: true,
      },
    });

    const summary = {
      total: linenItems.length,
      byStatus: {
        IN_STOCK: linenItems.filter((item) => item.status === "IN_STOCK").length,
        IN_USE: linenItems.filter((item) => item.status === "IN_USE").length,
        IN_LAUNDRY: linenItems.filter((item) => item.status === "IN_LAUNDRY").length,
        DAMAGED: linenItems.filter((item) => item.status === "DAMAGED").length,
        RETIRED: linenItems.filter((item) => item.status === "RETIRED").length,
      },
      byCondition: {
        NEW: linenItems.filter((item) => item.condition === "NEW").length,
        GOOD: linenItems.filter((item) => item.condition === "GOOD").length,
        FAIR: linenItems.filter((item) => item.condition === "FAIR").length,
        POOR: linenItems.filter((item) => item.condition === "POOR").length,
      },
    };

    return summary;
  } catch (error) {
    console.error("Get Linen Summary Error:", error);
    return null;
  }
}
