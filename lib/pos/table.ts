"use server";

import { db } from "@/lib/db";
import { POSTableStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

// Types
export interface CreateTableInput {
  outletId: string;
  number: string;
  capacity: number;
  positionX?: number;
  positionY?: number;
}

export interface UpdateTableInput {
  number?: string;
  capacity?: number;
  positionX?: number;
  positionY?: number;
}

export interface TableSearchQuery {
  outletId?: string;
  status?: POSTableStatus;
  page?: number;
  pageSize?: number;
}

// Valid table statuses for validation
const VALID_TABLE_STATUSES: POSTableStatus[] = [
  "AVAILABLE",
  "OCCUPIED",
  "RESERVED",
  "DIRTY",
  "OUT_OF_SERVICE",
];

/**
 * Validate table status enum
 * Requirements: 4.2
 */
function isValidTableStatus(status: string): status is POSTableStatus {
  return VALID_TABLE_STATUSES.includes(status as POSTableStatus);
}

/**
 * Valid status transitions based on workflow
 * Requirements: 4.3, 4.4, 4.5
 * 
 * - WHEN an order is created for a table, THE System SHALL automatically set the table status to OCCUPIED
 * - WHEN an order is paid and closed, THE System SHALL set the table status to DIRTY
 * - WHEN a table is marked as cleaned, THE System SHALL set the table status to AVAILABLE
 */
const VALID_STATUS_TRANSITIONS: Record<POSTableStatus, POSTableStatus[]> = {
  AVAILABLE: ["OCCUPIED", "RESERVED", "OUT_OF_SERVICE"],
  OCCUPIED: ["DIRTY", "OUT_OF_SERVICE"], // After order is paid
  RESERVED: ["OCCUPIED", "AVAILABLE", "OUT_OF_SERVICE"],
  DIRTY: ["AVAILABLE", "OUT_OF_SERVICE"], // After cleaning
  OUT_OF_SERVICE: ["AVAILABLE", "DIRTY"],
};

/**
 * Check if a status transition is valid (internal async wrapper for server action context)
 * Requirements: 4.3, 4.4, 4.5
 * 
 * Note: Pure function is in table-utils.ts for property-based testing
 */
async function checkValidStatusTransition(
  currentStatus: POSTableStatus,
  newStatus: POSTableStatus
): Promise<boolean> {
  if (currentStatus === newStatus) {
    return true; // No change is always valid
  }
  return VALID_STATUS_TRANSITIONS[currentStatus].includes(newStatus);
}

// CRUD Operations

/**
 * Create a new table
 * Requirements: 4.1
 * 
 * - THE System SHALL maintain tables with number, capacity, status, and floor plan position
 */
export async function createTable(data: CreateTableInput) {
  // Validate required fields
  if (!data.outletId || data.outletId.trim() === "") {
    return { error: "Outlet ID is required" };
  }

  if (!data.number || data.number.trim() === "") {
    return { error: "Table number is required" };
  }

  if (!data.capacity || data.capacity < 1) {
    return { error: "Table capacity must be at least 1" };
  }

  try {
    // Check if outlet exists and is active
    const outlet = await db.salesOutlet.findUnique({
      where: { id: data.outletId },
    });

    if (!outlet) {
      return { error: "Sales outlet not found" };
    }

    if (!outlet.isActive) {
      return { error: "Cannot create tables for inactive outlets" };
    }

    // Check if table number already exists in this outlet
    const existingTable = await db.pOSTable.findUnique({
      where: {
        outletId_number: {
          outletId: data.outletId,
          number: data.number.trim(),
        },
      },
    });

    if (existingTable) {
      return { error: "A table with this number already exists in this outlet" };
    }

    const table = await db.pOSTable.create({
      data: {
        outletId: data.outletId,
        number: data.number.trim(),
        capacity: data.capacity,
        status: "AVAILABLE",
        positionX: data.positionX,
        positionY: data.positionY,
      },
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            type: true,
            propertyId: true,
          },
        },
      },
    });

    revalidatePath("/admin/pos/tables");
    return { success: true, data: table };
  } catch (error) {
    console.error("Create Table Error:", error);
    return { error: "Failed to create table" };
  }
}

/**
 * Get a table by ID
 */
export async function getTableById(id: string) {
  try {
    const table = await db.pOSTable.findUnique({
      where: { id },
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            type: true,
            propertyId: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    return table;
  } catch (error) {
    console.error("Get Table Error:", error);
    return null;
  }
}

/**
 * Get all tables with optional filtering
 * Requirements: 4.1
 */
export async function getTables(query?: TableSearchQuery) {
  try {
    const where: Prisma.POSTableWhereInput = {};

    if (query?.outletId) {
      where.outletId = query.outletId;
    }

    if (query?.status) {
      where.status = query.status;
    }

    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 100;
    const skip = (page - 1) * pageSize;

    const [tables, total] = await Promise.all([
      db.pOSTable.findMany({
        where,
        include: {
          outlet: {
            select: {
              id: true,
              name: true,
              type: true,
              propertyId: true,
            },
          },
          _count: {
            select: {
              orders: true,
            },
          },
        },
        orderBy: [{ outlet: { name: "asc" } }, { number: "asc" }],
        skip,
        take: pageSize,
      }),
      db.pOSTable.count({ where }),
    ]);

    return {
      tables,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Get Tables Error:", error);
    return {
      tables: [],
      pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
    };
  }
}

/**
 * Get tables by outlet (for floor plan view)
 * Requirements: 4.1
 */
export async function getTablesByOutlet(outletId: string) {
  try {
    const tables = await db.pOSTable.findMany({
      where: { outletId },
      include: {
        orders: {
          where: {
            status: {
              in: ["OPEN", "SENT_TO_KITCHEN", "IN_PROGRESS", "READY", "SERVED"],
            },
          },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { number: "asc" },
    });

    return tables;
  } catch (error) {
    console.error("Get Tables By Outlet Error:", error);
    return [];
  }
}

/**
 * Get a table with its current active order
 * Requirements: 4.1
 */
export async function getTableWithOrder(tableId: string) {
  try {
    const table = await db.pOSTable.findUnique({
      where: { id: tableId },
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            type: true,
            propertyId: true,
            isActive: true,
          },
        },
        orders: {
          where: {
            status: {
              in: ["OPEN", "SENT_TO_KITCHEN", "IN_PROGRESS", "READY", "SERVED"],
            },
          },
          include: {
            items: {
              include: {
                menuItem: {
                  select: {
                    id: true,
                    name: true,
                    sellingPrice: true,
                  },
                },
              },
            },
            server: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!table) {
      return null;
    }

    // Return table with current order (if any)
    return {
      ...table,
      currentOrder: table.orders[0] || null,
    };
  } catch (error) {
    console.error("Get Table With Order Error:", error);
    return null;
  }
}

/**
 * Update table status
 * Requirements: 4.2, 4.3, 4.4, 4.5
 * 
 * - WHEN a table status changes, THE System SHALL update it to one of: AVAILABLE, OCCUPIED, RESERVED, DIRTY, OUT_OF_SERVICE
 * - WHEN an order is created for a table, THE System SHALL automatically set the table status to OCCUPIED
 * - WHEN an order is paid and closed, THE System SHALL set the table status to DIRTY
 * - WHEN a table is marked as cleaned, THE System SHALL set the table status to AVAILABLE
 */
export async function updateTableStatus(
  tableId: string,
  newStatus: POSTableStatus,
  options?: { skipTransitionValidation?: boolean }
) {
  // Validate status enum
  if (!isValidTableStatus(newStatus)) {
    return {
      error: `Invalid table status. Must be one of: ${VALID_TABLE_STATUSES.join(", ")}`,
    };
  }

  try {
    // Get current table
    const table = await db.pOSTable.findUnique({
      where: { id: tableId },
      select: { id: true, status: true, outletId: true },
    });

    if (!table) {
      return { error: "Table not found" };
    }

    // Validate status transition (unless explicitly skipped for system operations)
    if (!options?.skipTransitionValidation) {
      const isValid = await checkValidStatusTransition(table.status, newStatus);
      if (!isValid) {
        return {
          error: `Invalid status transition from ${table.status} to ${newStatus}`,
        };
      }
    }

    const updatedTable = await db.pOSTable.update({
      where: { id: tableId },
      data: { status: newStatus },
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            type: true,
            propertyId: true,
          },
        },
      },
    });

    revalidatePath("/admin/pos/tables");
    revalidatePath(`/admin/pos/outlets/${table.outletId}`);
    return { success: true, data: updatedTable };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Table not found" };
      }
    }
    console.error("Update Table Status Error:", error);
    return { error: "Failed to update table status" };
  }
}

/**
 * Update table details (number, capacity, position)
 * Requirements: 4.1
 */
export async function updateTable(id: string, data: UpdateTableInput) {
  try {
    const existingTable = await db.pOSTable.findUnique({
      where: { id },
    });

    if (!existingTable) {
      return { error: "Table not found" };
    }

    const updateData: Prisma.POSTableUpdateInput = {};

    if (data.number !== undefined) {
      if (!data.number || data.number.trim() === "") {
        return { error: "Table number cannot be empty" };
      }

      // Check if new number conflicts with existing table in same outlet
      if (data.number.trim() !== existingTable.number) {
        const conflictingTable = await db.pOSTable.findUnique({
          where: {
            outletId_number: {
              outletId: existingTable.outletId,
              number: data.number.trim(),
            },
          },
        });

        if (conflictingTable) {
          return { error: "A table with this number already exists in this outlet" };
        }
      }

      updateData.number = data.number.trim();
    }

    if (data.capacity !== undefined) {
      if (data.capacity < 1) {
        return { error: "Table capacity must be at least 1" };
      }
      updateData.capacity = data.capacity;
    }

    if (data.positionX !== undefined) {
      updateData.positionX = data.positionX;
    }

    if (data.positionY !== undefined) {
      updateData.positionY = data.positionY;
    }

    const table = await db.pOSTable.update({
      where: { id },
      data: updateData,
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            type: true,
            propertyId: true,
          },
        },
      },
    });

    revalidatePath("/admin/pos/tables");
    return { success: true, data: table };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Table not found" };
      }
    }
    console.error("Update Table Error:", error);
    return { error: "Failed to update table" };
  }
}

/**
 * Delete a table
 * Only allowed if table has no orders
 */
export async function deleteTable(id: string) {
  try {
    // Check if table has any orders
    const table = await db.pOSTable.findUnique({
      where: { id },
      include: {
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!table) {
      return { error: "Table not found" };
    }

    if (table._count.orders > 0) {
      return { error: "Cannot delete table with existing orders. Consider marking it as OUT_OF_SERVICE instead." };
    }

    await db.pOSTable.delete({
      where: { id },
    });

    revalidatePath("/admin/pos/tables");
    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Table not found" };
      }
    }
    console.error("Delete Table Error:", error);
    return { error: "Failed to delete table" };
  }
}

/**
 * Get available tables for an outlet
 * Requirements: 4.1
 */
export async function getAvailableTables(outletId: string) {
  try {
    const tables = await db.pOSTable.findMany({
      where: {
        outletId,
        status: "AVAILABLE",
      },
      orderBy: { number: "asc" },
    });

    return tables;
  } catch (error) {
    console.error("Get Available Tables Error:", error);
    return [];
  }
}

/**
 * Set table to OCCUPIED when an order is created
 * Requirements: 4.3
 * 
 * - WHEN an order is created for a table, THE System SHALL automatically set the table status to OCCUPIED
 */
export async function setTableOccupied(tableId: string) {
  return updateTableStatus(tableId, "OCCUPIED", { skipTransitionValidation: true });
}

/**
 * Set table to DIRTY when an order is paid
 * Requirements: 4.4
 * 
 * - WHEN an order is paid and closed, THE System SHALL set the table status to DIRTY
 */
export async function setTableDirty(tableId: string) {
  return updateTableStatus(tableId, "DIRTY", { skipTransitionValidation: true });
}

/**
 * Set table to AVAILABLE when cleaned
 * Requirements: 4.5
 * 
 * - WHEN a table is marked as cleaned, THE System SHALL set the table status to AVAILABLE
 */
export async function setTableAvailable(tableId: string) {
  return updateTableStatus(tableId, "AVAILABLE", { skipTransitionValidation: true });
}

/**
 * Force clear a table (Owner override)
 * - Voids/Cancels any active order
 * - Sets table to AVAILABLE
 */
export async function forceClearTable(tableId: string) {
  try {
    // 1. Find active order
    const table = await db.pOSTable.findUnique({
      where: { id: tableId },
      include: {
        orders: {
          where: {
            status: { in: ["OPEN", "SENT_TO_KITCHEN", "IN_PROGRESS", "READY", "SERVED"] }
          }
        }
      }
    });

    if (!table) return { error: "Table not found" };

    // 2. Void active orders if any
    for (const order of table.orders) {
        await db.pOSOrder.update({
            where: { id: order.id },
            data: { 
                status: "VOID",
                notes: order.notes ? `${order.notes}\n[System]: Table cleared manually` : "[System]: Table cleared manually"
            }
        });
    }

    // 3. Set table to available
    const result = await updateTableStatus(tableId, "AVAILABLE", { skipTransitionValidation: true });
    
    revalidatePath("/admin/pos");
    return result;
  } catch (error) {
    console.error("Force Clear Table Error:", error);
    return { error: "Failed to force clear table" };
  }
}
