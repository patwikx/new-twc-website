"use server";

import { db } from "@/lib/db";
import { CycleCountStatus, CycleCountType, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { adjustStock } from "./stock-movement";

// =============================================================================
// Types
// =============================================================================

export interface CreateCycleCountInput {
  warehouseId: string;
  type: CycleCountType;
  blindCount?: boolean;
  scheduledAt?: Date;
  notes?: string;
  itemIds?: string[]; // For SPOT type
  samplePercent?: number; // For RANDOM type
  createdById: string;
}

export interface UpdateCycleCountInput {
  notes?: string;
  scheduledAt?: Date | null;
  blindCount?: boolean;
}

export interface CycleCountQuery {
  warehouseId?: string;
  status?: CycleCountStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export interface RecordCountInput {
  cycleCountItemId: string;
  countedQuantity: number;
  countedById: string;
  notes?: string;
}

// Valid cycle count types for validation
const VALID_CYCLE_COUNT_TYPES: CycleCountType[] = [
  "FULL",
  "ABC_CLASS_A",
  "ABC_CLASS_B",
  "ABC_CLASS_C",
  "RANDOM",
  "SPOT",
];

// Valid cycle count statuses for validation
const VALID_CYCLE_COUNT_STATUSES: CycleCountStatus[] = [
  "DRAFT",
  "SCHEDULED",
  "IN_PROGRESS",
  "PENDING_REVIEW",
  "COMPLETED",
  "CANCELLED",
];

/**
 * Validate cycle count type enum
 */
function isValidCycleCountType(type: string): type is CycleCountType {
  return VALID_CYCLE_COUNT_TYPES.includes(type as CycleCountType);
}

/**
 * Validate cycle count status enum
 */
function isValidCycleCountStatus(status: string): status is CycleCountStatus {
  return VALID_CYCLE_COUNT_STATUSES.includes(status as CycleCountStatus);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate unique count number in format CC-YYYY-NNNN
 * Requirements: REQ-CC-1.1
 */
export async function generateCountNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `CC-${currentYear}-`;

  // Get the highest existing count number for this year
  const lastCount = await db.cycleCount.findFirst({
    where: {
      countNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      countNumber: "desc",
    },
    select: {
      countNumber: true,
    },
  });

  let nextNumber = 1;
  if (lastCount?.countNumber) {
    const match = lastCount.countNumber.match(/CC-\d{4}-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}${nextNumber.toString().padStart(4, "0")}`;
}


// =============================================================================
// CRUD Operations
// =============================================================================

/**
 * Create a new cycle count session
 * Requirements: REQ-CC-1.1, REQ-CC-1.2
 */
export async function createCycleCount(data: CreateCycleCountInput) {
  // Validate required fields
  if (!data.warehouseId || data.warehouseId.trim() === "") {
    return { error: "Warehouse ID is required" };
  }

  if (!data.createdById || data.createdById.trim() === "") {
    return { error: "Created by user ID is required" };
  }

  // Validate cycle count type
  if (!data.type || !isValidCycleCountType(data.type)) {
    return {
      error: `Invalid cycle count type. Must be one of: ${VALID_CYCLE_COUNT_TYPES.join(", ")}`,
    };
  }

  // Validate SPOT type requires itemIds
  if (data.type === "SPOT" && (!data.itemIds || data.itemIds.length === 0)) {
    return { error: "SPOT count type requires at least one item to be selected" };
  }

  // Validate RANDOM type requires samplePercent
  if (data.type === "RANDOM") {
    if (data.samplePercent === undefined || data.samplePercent === null) {
      return { error: "RANDOM count type requires a sample percentage" };
    }
    if (data.samplePercent <= 0 || data.samplePercent > 100) {
      return { error: "Sample percentage must be between 1 and 100" };
    }
  }

  try {
    // Check if warehouse exists and is active
    const warehouse = await db.warehouse.findUnique({
      where: { id: data.warehouseId },
    });

    if (!warehouse) {
      return { error: "Warehouse not found" };
    }

    if (!warehouse.isActive) {
      return { error: "Cannot create cycle count for inactive warehouse" };
    }

    // Generate unique count number
    const countNumber = await generateCountNumber();

    // Determine initial status
    const status: CycleCountStatus = data.scheduledAt ? "SCHEDULED" : "DRAFT";

    // Create the cycle count
    const cycleCount = await db.cycleCount.create({
      data: {
        countNumber,
        warehouseId: data.warehouseId,
        type: data.type,
        status,
        blindCount: data.blindCount ?? false,
        scheduledAt: data.scheduledAt || null,
        notes: data.notes?.trim() || null,
        createdById: data.createdById,
      },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        items: true,
      },
    });

    revalidatePath("/admin/inventory/cycle-counts");
    return { success: true, data: cycleCount };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { error: "Failed to generate unique count number. Please try again." };
      }
    }
    console.error("Create Cycle Count Error:", error);
    return { error: "Failed to create cycle count" };
  }
}


/**
 * Get a cycle count by ID with all relations
 * Requirements: REQ-CC-5.1
 */
export async function getCycleCountById(id: string) {
  try {
    const cycleCount = await db.cycleCount.findUnique({
      where: { id },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
            property: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        items: {
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                itemCode: true,
                sku: true,
                primaryUnit: {
                  select: {
                    id: true,
                    name: true,
                    abbreviation: true,
                  },
                },
                category: {
                  select: {
                    id: true,
                    name: true,
                    color: true,
                  },
                },
              },
            },
            batch: {
              select: {
                id: true,
                batchNumber: true,
                expirationDate: true,
              },
            },
          },
          orderBy: [
            { stockItem: { category: { name: "asc" } } },
            { stockItem: { name: "asc" } },
          ],
        },
      },
    });

    return cycleCount;
  } catch (error) {
    console.error("Get Cycle Count Error:", error);
    return null;
  }
}

/**
 * Get all cycle counts with optional filtering and pagination
 * Requirements: REQ-CC-5.1
 */
export async function getCycleCounts(query?: CycleCountQuery) {
  try {
    const where: Prisma.CycleCountWhereInput = {};

    if (query?.warehouseId) {
      where.warehouseId = query.warehouseId;
    }

    if (query?.status) {
      if (!isValidCycleCountStatus(query.status)) {
        return {
          cycleCounts: [],
          pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
        };
      }
      where.status = query.status;
    }

    // Date range filter
    if (query?.startDate || query?.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = query.startDate;
      }
      if (query.endDate) {
        where.createdAt.lte = query.endDate;
      }
    }

    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const [cycleCounts, total] = await Promise.all([
      db.cycleCount.findMany({
        where,
        include: {
          warehouse: {
            select: {
              id: true,
              name: true,
              type: true,
              property: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: pageSize,
      }),
      db.cycleCount.count({ where }),
    ]);

    return {
      cycleCounts,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Get Cycle Counts Error:", error);
    return {
      cycleCounts: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    };
  }
}


/**
 * Update a cycle count (only allowed in DRAFT status)
 * Requirements: REQ-CC-1.3
 */
export async function updateCycleCount(id: string, data: UpdateCycleCountInput) {
  try {
    // Get existing cycle count to check status
    const existingCycleCount = await db.cycleCount.findUnique({
      where: { id },
    });

    if (!existingCycleCount) {
      return { error: "Cycle count not found" };
    }

    // Only allow updates in DRAFT or SCHEDULED status
    if (existingCycleCount.status !== "DRAFT" && existingCycleCount.status !== "SCHEDULED") {
      return {
        error: `Cannot update cycle count in ${existingCycleCount.status} status. Only DRAFT or SCHEDULED counts can be updated.`,
      };
    }

    const updateData: Prisma.CycleCountUpdateInput = {};

    if (data.notes !== undefined) {
      updateData.notes = data.notes?.trim() || null;
    }

    if (data.blindCount !== undefined) {
      updateData.blindCount = data.blindCount;
    }

    if (data.scheduledAt !== undefined) {
      updateData.scheduledAt = data.scheduledAt;
      // Update status based on scheduledAt
      if (data.scheduledAt && existingCycleCount.status === "DRAFT") {
        updateData.status = "SCHEDULED";
      } else if (!data.scheduledAt && existingCycleCount.status === "SCHEDULED") {
        updateData.status = "DRAFT";
      }
    }

    const cycleCount = await db.cycleCount.update({
      where: { id },
      data: updateData,
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        items: true,
      },
    });

    revalidatePath("/admin/inventory/cycle-counts");
    revalidatePath(`/admin/inventory/cycle-counts/${id}`);
    return { success: true, data: cycleCount };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Cycle count not found" };
      }
    }
    console.error("Update Cycle Count Error:", error);
    return { error: "Failed to update cycle count" };
  }
}


/**
 * Cancel a cycle count
 * Requirements: REQ-CC-4.4
 */
export async function cancelCycleCount(id: string, reason?: string) {
  try {
    // Get existing cycle count to check status
    const existingCycleCount = await db.cycleCount.findUnique({
      where: { id },
    });

    if (!existingCycleCount) {
      return { error: "Cycle count not found" };
    }

    // Cannot cancel already completed or cancelled counts
    if (existingCycleCount.status === "COMPLETED") {
      return { error: "Cannot cancel a completed cycle count" };
    }

    if (existingCycleCount.status === "CANCELLED") {
      return { error: "Cycle count is already cancelled" };
    }

    // Build notes with cancellation reason
    let updatedNotes = existingCycleCount.notes || "";
    if (reason) {
      const cancellationNote = `\n[CANCELLED: ${new Date().toISOString()}] ${reason}`;
      updatedNotes = updatedNotes + cancellationNote;
    }

    const cycleCount = await db.cycleCount.update({
      where: { id },
      data: {
        status: "CANCELLED",
        notes: updatedNotes.trim() || null,
      },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    revalidatePath("/admin/inventory/cycle-counts");
    revalidatePath(`/admin/inventory/cycle-counts/${id}`);
    return { success: true, data: cycleCount };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Cycle count not found" };
      }
    }
    console.error("Cancel Cycle Count Error:", error);
    return { error: "Failed to cancel cycle count" };
  }
}

// =============================================================================
// Count Item Population
// =============================================================================

/**
 * ABC Classification result for a stock item
 */
interface ABCClassification {
  stockItemId: string;
  totalValue: number;
  classification: "A" | "B" | "C";
}

/**
 * Classify items by ABC analysis based on total inventory value
 * A: Top 80% of value (high-value items)
 * B: Next 15% of value (medium-value items)
 * C: Bottom 5% of value (low-value items)
 * Requirements: REQ-CC-1.2
 */
export async function classifyItemsABC(warehouseId: string): Promise<ABCClassification[]> {
  // Get all stock levels with quantity > 0 for the warehouse
  const stockLevels = await db.stockLevel.findMany({
    where: {
      warehouseId,
      quantity: { gt: 0 },
    },
    select: {
      stockItemId: true,
      quantity: true,
      averageCost: true,
    },
  });

  if (stockLevels.length === 0) {
    return [];
  }

  // Calculate total value per item (qty × avgCost)
  const itemValues = stockLevels.map((level) => ({
    stockItemId: level.stockItemId,
    totalValue: Number(level.quantity) * Number(level.averageCost),
  }));

  // Sort by value descending
  itemValues.sort((a, b) => b.totalValue - a.totalValue);

  // Calculate total value across all items
  const totalValue = itemValues.reduce((sum, item) => sum + item.totalValue, 0);

  if (totalValue === 0) {
    // All items have zero value, classify all as C
    return itemValues.map((item) => ({
      ...item,
      classification: "C" as const,
    }));
  }

  // Calculate cumulative percentage and classify
  let cumulativeValue = 0;
  return itemValues.map((item) => {
    cumulativeValue += item.totalValue;
    const cumulativePercent = (cumulativeValue / totalValue) * 100;

    let classification: "A" | "B" | "C";
    if (cumulativePercent <= 80) {
      classification = "A"; // Top 80% of value
    } else if (cumulativePercent <= 95) {
      classification = "B"; // Next 15% of value
    } else {
      classification = "C"; // Bottom 5% of value
    }

    return { ...item, classification };
  });
}

/**
 * Populate count items for a FULL cycle count
 * Gets all stock items with quantity > 0 in the warehouse
 * Requirements: REQ-CC-1.2
 */
async function populateFullCountItems(
  cycleCountId: string,
  warehouseId: string,
  includeBatches: boolean = true
): Promise<{ count: number }> {
  // Get all stock levels with quantity > 0 for the warehouse
  const stockLevels = await db.stockLevel.findMany({
    where: {
      warehouseId,
      quantity: { gt: 0 },
    },
    include: {
      stockItem: {
        select: {
          id: true,
          isActive: true,
        },
      },
    },
  });

  // Filter to only active stock items
  const activeStockLevels = stockLevels.filter((level) => level.stockItem.isActive);

  if (activeStockLevels.length === 0) {
    return { count: 0 };
  }

  // Get batches for batch-tracked items if includeBatches is true
  let batchesByItem: Map<string, Array<{ id: string; batchNumber: string; quantity: number; unitCost: number }>> = new Map();
  
  if (includeBatches) {
    const batches = await db.stockBatch.findMany({
      where: {
        warehouseId,
        quantity: { gt: 0 },
        stockItemId: { in: activeStockLevels.map((l) => l.stockItemId) },
      },
      select: {
        id: true,
        stockItemId: true,
        batchNumber: true,
        quantity: true,
        unitCost: true,
      },
    });

    // Group batches by stock item
    for (const batch of batches) {
      const existing = batchesByItem.get(batch.stockItemId) || [];
      existing.push({
        id: batch.id,
        batchNumber: batch.batchNumber,
        quantity: Number(batch.quantity),
        unitCost: Number(batch.unitCost),
      });
      batchesByItem.set(batch.stockItemId, existing);
    }
  }

  // Create cycle count items
  const itemsToCreate: Array<{
    cycleCountId: string;
    stockItemId: string;
    batchId: string | null;
    systemQuantity: number;
    unitCost: number;
  }> = [];

  for (const level of activeStockLevels) {
    const batches = batchesByItem.get(level.stockItemId);

    if (batches && batches.length > 0) {
      // Create separate entries for each batch
      for (const batch of batches) {
        itemsToCreate.push({
          cycleCountId,
          stockItemId: level.stockItemId,
          batchId: batch.id,
          systemQuantity: batch.quantity,
          unitCost: batch.unitCost,
        });
      }
    } else {
      // No batches, create single entry for the item
      itemsToCreate.push({
        cycleCountId,
        stockItemId: level.stockItemId,
        batchId: null,
        systemQuantity: Number(level.quantity),
        unitCost: Number(level.averageCost),
      });
    }
  }

  // Bulk create items
  await db.cycleCountItem.createMany({
    data: itemsToCreate,
    skipDuplicates: true,
  });

  return { count: itemsToCreate.length };
}

/**
 * Populate count items for ABC class cycle counts
 * Requirements: REQ-CC-1.2
 */
async function populateABCCountItems(
  cycleCountId: string,
  warehouseId: string,
  targetClass: "A" | "B" | "C",
  includeBatches: boolean = true
): Promise<{ count: number }> {
  // Get ABC classification for all items
  const classifications = await classifyItemsABC(warehouseId);

  // Filter to target class
  const targetItems = classifications.filter((c) => c.classification === targetClass);

  if (targetItems.length === 0) {
    return { count: 0 };
  }

  const targetItemIds = targetItems.map((t) => t.stockItemId);

  // Get stock levels for target items
  const stockLevels = await db.stockLevel.findMany({
    where: {
      warehouseId,
      stockItemId: { in: targetItemIds },
      quantity: { gt: 0 },
    },
    include: {
      stockItem: {
        select: {
          id: true,
          isActive: true,
        },
      },
    },
  });

  // Filter to only active stock items
  const activeStockLevels = stockLevels.filter((level) => level.stockItem.isActive);

  if (activeStockLevels.length === 0) {
    return { count: 0 };
  }

  // Get batches for batch-tracked items if includeBatches is true
  let batchesByItem: Map<string, Array<{ id: string; batchNumber: string; quantity: number; unitCost: number }>> = new Map();

  if (includeBatches) {
    const batches = await db.stockBatch.findMany({
      where: {
        warehouseId,
        quantity: { gt: 0 },
        stockItemId: { in: activeStockLevels.map((l) => l.stockItemId) },
      },
      select: {
        id: true,
        stockItemId: true,
        batchNumber: true,
        quantity: true,
        unitCost: true,
      },
    });

    for (const batch of batches) {
      const existing = batchesByItem.get(batch.stockItemId) || [];
      existing.push({
        id: batch.id,
        batchNumber: batch.batchNumber,
        quantity: Number(batch.quantity),
        unitCost: Number(batch.unitCost),
      });
      batchesByItem.set(batch.stockItemId, existing);
    }
  }

  // Create cycle count items
  const itemsToCreate: Array<{
    cycleCountId: string;
    stockItemId: string;
    batchId: string | null;
    systemQuantity: number;
    unitCost: number;
  }> = [];

  for (const level of activeStockLevels) {
    const batches = batchesByItem.get(level.stockItemId);

    if (batches && batches.length > 0) {
      for (const batch of batches) {
        itemsToCreate.push({
          cycleCountId,
          stockItemId: level.stockItemId,
          batchId: batch.id,
          systemQuantity: batch.quantity,
          unitCost: batch.unitCost,
        });
      }
    } else {
      itemsToCreate.push({
        cycleCountId,
        stockItemId: level.stockItemId,
        batchId: null,
        systemQuantity: Number(level.quantity),
        unitCost: Number(level.averageCost),
      });
    }
  }

  await db.cycleCountItem.createMany({
    data: itemsToCreate,
    skipDuplicates: true,
  });

  return { count: itemsToCreate.length };
}

/**
 * Populate count items for RANDOM cycle count
 * Randomly selects a percentage of items
 * Requirements: REQ-CC-1.2
 */
async function populateRandomCountItems(
  cycleCountId: string,
  warehouseId: string,
  samplePercent: number,
  includeBatches: boolean = true
): Promise<{ count: number }> {
  // Get all stock levels with quantity > 0 for the warehouse
  const stockLevels = await db.stockLevel.findMany({
    where: {
      warehouseId,
      quantity: { gt: 0 },
    },
    include: {
      stockItem: {
        select: {
          id: true,
          isActive: true,
        },
      },
    },
  });

  // Filter to only active stock items
  const activeStockLevels = stockLevels.filter((level) => level.stockItem.isActive);

  if (activeStockLevels.length === 0) {
    return { count: 0 };
  }

  // Calculate how many items to sample
  const sampleSize = Math.max(1, Math.round((activeStockLevels.length * samplePercent) / 100));

  // Randomly shuffle and take sample
  const shuffled = [...activeStockLevels].sort(() => Math.random() - 0.5);
  const sampledLevels = shuffled.slice(0, sampleSize);

  // Get batches for batch-tracked items if includeBatches is true
  let batchesByItem: Map<string, Array<{ id: string; batchNumber: string; quantity: number; unitCost: number }>> = new Map();

  if (includeBatches) {
    const batches = await db.stockBatch.findMany({
      where: {
        warehouseId,
        quantity: { gt: 0 },
        stockItemId: { in: sampledLevels.map((l) => l.stockItemId) },
      },
      select: {
        id: true,
        stockItemId: true,
        batchNumber: true,
        quantity: true,
        unitCost: true,
      },
    });

    for (const batch of batches) {
      const existing = batchesByItem.get(batch.stockItemId) || [];
      existing.push({
        id: batch.id,
        batchNumber: batch.batchNumber,
        quantity: Number(batch.quantity),
        unitCost: Number(batch.unitCost),
      });
      batchesByItem.set(batch.stockItemId, existing);
    }
  }

  // Create cycle count items
  const itemsToCreate: Array<{
    cycleCountId: string;
    stockItemId: string;
    batchId: string | null;
    systemQuantity: number;
    unitCost: number;
  }> = [];

  for (const level of sampledLevels) {
    const batches = batchesByItem.get(level.stockItemId);

    if (batches && batches.length > 0) {
      for (const batch of batches) {
        itemsToCreate.push({
          cycleCountId,
          stockItemId: level.stockItemId,
          batchId: batch.id,
          systemQuantity: batch.quantity,
          unitCost: batch.unitCost,
        });
      }
    } else {
      itemsToCreate.push({
        cycleCountId,
        stockItemId: level.stockItemId,
        batchId: null,
        systemQuantity: Number(level.quantity),
        unitCost: Number(level.averageCost),
      });
    }
  }

  await db.cycleCountItem.createMany({
    data: itemsToCreate,
    skipDuplicates: true,
  });

  return { count: itemsToCreate.length };
}

/**
 * Populate count items for SPOT cycle count
 * Creates items only for user-selected stock items
 * MODIFIED: Allows items with zero stock (useful for verifying empty locations)
 * Requirements: REQ-CC-1.2
 */
async function populateSpotCountItems(
  cycleCountId: string,
  warehouseId: string,
  itemIds: string[],
  includeBatches: boolean = true
): Promise<{ count: number }> {
  if (!itemIds || itemIds.length === 0) {
    return { count: 0 };
  }

  // Get the selected stock items (regardless of stock level)
  const stockItems = await db.stockItem.findMany({
    where: {
      id: { in: itemIds },
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (stockItems.length === 0) {
    return { count: 0 };
  }

  const activeItemIds = stockItems.map((item) => item.id);

  // Get stock levels for specified items (may not exist for all items)
  const stockLevels = await db.stockLevel.findMany({
    where: {
      warehouseId,
      stockItemId: { in: activeItemIds },
    },
  });

  // Create a map of stock levels by item ID
  const stockLevelMap = new Map<string, { quantity: number; averageCost: number }>();
  for (const level of stockLevels) {
    stockLevelMap.set(level.stockItemId, {
      quantity: Number(level.quantity),
      averageCost: Number(level.averageCost),
    });
  }

  // Get batches for batch-tracked items if includeBatches is true
  let batchesByItem: Map<string, Array<{ id: string; batchNumber: string; quantity: number; unitCost: number }>> = new Map();

  if (includeBatches) {
    const batches = await db.stockBatch.findMany({
      where: {
        warehouseId,
        quantity: { gt: 0 },
        stockItemId: { in: activeItemIds },
      },
      select: {
        id: true,
        stockItemId: true,
        batchNumber: true,
        quantity: true,
        unitCost: true,
      },
    });

    for (const batch of batches) {
      const existing = batchesByItem.get(batch.stockItemId) || [];
      existing.push({
        id: batch.id,
        batchNumber: batch.batchNumber,
        quantity: Number(batch.quantity),
        unitCost: Number(batch.unitCost),
      });
      batchesByItem.set(batch.stockItemId, existing);
    }
  }

  // Create cycle count items for ALL selected items (even with zero stock)
  const itemsToCreate: Array<{
    cycleCountId: string;
    stockItemId: string;
    batchId: string | null;
    systemQuantity: number;
    unitCost: number;
  }> = [];

  for (const itemId of activeItemIds) {
    const batches = batchesByItem.get(itemId);
    const stockLevel = stockLevelMap.get(itemId);

    if (batches && batches.length > 0) {
      // Create separate entries for each batch
      for (const batch of batches) {
        itemsToCreate.push({
          cycleCountId,
          stockItemId: itemId,
          batchId: batch.id,
          systemQuantity: batch.quantity,
          unitCost: batch.unitCost,
        });
      }
    } else {
      // No batches - create single entry with stock level or zero
      itemsToCreate.push({
        cycleCountId,
        stockItemId: itemId,
        batchId: null,
        systemQuantity: stockLevel?.quantity ?? 0,
        unitCost: stockLevel?.averageCost ?? 0,
      });
    }
  }

  await db.cycleCountItem.createMany({
    data: itemsToCreate,
    skipDuplicates: true,
  });

  return { count: itemsToCreate.length };
}

/**
 * Main function to populate count items based on cycle count type
 * Requirements: REQ-CC-1.2, REQ-CC-2.4
 */
export async function populateCountItems(
  cycleCountId: string,
  options?: {
    itemIds?: string[]; // For SPOT type
    samplePercent?: number; // For RANDOM type
    includeBatches?: boolean; // Whether to create separate entries per batch
  }
) {
  try {
    // Get the cycle count to determine type and warehouse
    const cycleCount = await db.cycleCount.findUnique({
      where: { id: cycleCountId },
      select: {
        id: true,
        type: true,
        warehouseId: true,
        status: true,
      },
    });

    if (!cycleCount) {
      return { error: "Cycle count not found" };
    }

    // Only allow populating items in DRAFT status
    if (cycleCount.status !== "DRAFT") {
      return { error: "Can only populate items for cycle counts in DRAFT status" };
    }

    const includeBatches = options?.includeBatches ?? true;
    let result: { count: number };

    switch (cycleCount.type) {
      case "FULL":
        result = await populateFullCountItems(cycleCountId, cycleCount.warehouseId, includeBatches);
        break;

      case "ABC_CLASS_A":
        result = await populateABCCountItems(cycleCountId, cycleCount.warehouseId, "A", includeBatches);
        break;

      case "ABC_CLASS_B":
        result = await populateABCCountItems(cycleCountId, cycleCount.warehouseId, "B", includeBatches);
        break;

      case "ABC_CLASS_C":
        result = await populateABCCountItems(cycleCountId, cycleCount.warehouseId, "C", includeBatches);
        break;

      case "RANDOM":
        if (!options?.samplePercent) {
          return { error: "Sample percentage is required for RANDOM count type" };
        }
        result = await populateRandomCountItems(
          cycleCountId,
          cycleCount.warehouseId,
          options.samplePercent,
          includeBatches
        );
        break;

      case "SPOT":
        if (!options?.itemIds || options.itemIds.length === 0) {
          return { error: "Item IDs are required for SPOT count type" };
        }
        result = await populateSpotCountItems(
          cycleCountId,
          cycleCount.warehouseId,
          options.itemIds,
          includeBatches
        );
        break;

      default:
        return { error: `Unknown cycle count type: ${cycleCount.type}` };
    }

    // Update the cycle count with total items
    await db.cycleCount.update({
      where: { id: cycleCountId },
      data: { totalItems: result.count },
    });

    revalidatePath(`/admin/inventory/cycle-counts/${cycleCountId}`);
    return { success: true, data: { itemsCreated: result.count } };
  } catch (error) {
    console.error("Populate Count Items Error:", error);
    return { error: "Failed to populate count items" };
  }
}

/**
 * Get count items for a cycle count
 */
export async function getCountItems(cycleCountId: string) {
  try {
    const items = await db.cycleCountItem.findMany({
      where: { cycleCountId },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            itemCode: true,
            sku: true,
            primaryUnit: {
              select: {
                id: true,
                name: true,
                abbreviation: true,
              },
            },
            category: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
        batch: {
          select: {
            id: true,
            batchNumber: true,
            expirationDate: true,
          },
        },
      },
      orderBy: [
        { stockItem: { category: { name: "asc" } } },
        { stockItem: { name: "asc" } },
        { batch: { batchNumber: "asc" } },
      ],
    });

    return items;
  } catch (error) {
    console.error("Get Count Items Error:", error);
    return [];
  }
}

/**
 * Clear all count items for a cycle count (useful for re-populating)
 */
export async function clearCountItems(cycleCountId: string) {
  try {
    const cycleCount = await db.cycleCount.findUnique({
      where: { id: cycleCountId },
      select: { status: true },
    });

    if (!cycleCount) {
      return { error: "Cycle count not found" };
    }

    if (cycleCount.status !== "DRAFT") {
      return { error: "Can only clear items for cycle counts in DRAFT status" };
    }

    await db.cycleCountItem.deleteMany({
      where: { cycleCountId },
    });

    await db.cycleCount.update({
      where: { id: cycleCountId },
      data: { totalItems: 0 },
    });

    revalidatePath(`/admin/inventory/cycle-counts/${cycleCountId}`);
    return { success: true };
  } catch (error) {
    console.error("Clear Count Items Error:", error);
    return { error: "Failed to clear count items" };
  }
}

// =============================================================================
// Count Execution Service
// =============================================================================

/**
 * Start a cycle count - locks system quantities as baseline
 * Requirements: REQ-CC-2.1
 * 
 * This function:
 * - Validates status is DRAFT or SCHEDULED
 * - Snapshots current quantities to systemQuantity
 * - Snapshots current average costs to unitCost
 * - Sets status to IN_PROGRESS
 * - Records startedAt timestamp
 */
export async function startCycleCount(id: string) {
  try {
    // Get existing cycle count to check status
    const existingCycleCount = await db.cycleCount.findUnique({
      where: { id },
      include: {
        items: {
          select: {
            id: true,
            stockItemId: true,
            batchId: true,
          },
        },
      },
    });

    if (!existingCycleCount) {
      return { error: "Cycle count not found" };
    }

    // Validate status - only DRAFT or SCHEDULED can be started
    if (existingCycleCount.status !== "DRAFT" && existingCycleCount.status !== "SCHEDULED") {
      return {
        error: `Cannot start cycle count in ${existingCycleCount.status} status. Only DRAFT or SCHEDULED counts can be started.`,
      };
    }

    // Check if there are items to count
    if (existingCycleCount.items.length === 0) {
      return { error: "Cannot start cycle count with no items. Please populate items first." };
    }

    // Use a transaction to ensure atomicity
    const result = await db.$transaction(async (tx) => {
      // Snapshot current quantities and costs for each item
      for (const item of existingCycleCount.items) {
        let systemQuantity: number;
        let unitCost: number;

        if (item.batchId) {
          // For batch-tracked items, get quantity from the batch
          const batch = await tx.stockBatch.findUnique({
            where: { id: item.batchId },
            select: {
              quantity: true,
              unitCost: true,
            },
          });

          systemQuantity = batch ? Number(batch.quantity) : 0;
          unitCost = batch ? Number(batch.unitCost) : 0;
        } else {
          // For non-batch items, get from stock level
          const stockLevel = await tx.stockLevel.findUnique({
            where: {
              stockItemId_warehouseId: {
                stockItemId: item.stockItemId,
                warehouseId: existingCycleCount.warehouseId,
              },
            },
            select: {
              quantity: true,
              averageCost: true,
            },
          });

          systemQuantity = stockLevel ? Number(stockLevel.quantity) : 0;
          unitCost = stockLevel ? Number(stockLevel.averageCost) : 0;
        }

        // Update the cycle count item with snapshotted values
        await tx.cycleCountItem.update({
          where: { id: item.id },
          data: {
            systemQuantity,
            unitCost,
          },
        });
      }

      // Update cycle count status and timestamp
      const updatedCycleCount = await tx.cycleCount.update({
        where: { id },
        data: {
          status: "IN_PROGRESS",
          startedAt: new Date(),
        },
        include: {
          warehouse: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          items: {
            include: {
              stockItem: {
                select: {
                  id: true,
                  name: true,
                  itemCode: true,
                  sku: true,
                  primaryUnit: {
                    select: {
                      id: true,
                      name: true,
                      abbreviation: true,
                    },
                  },
                },
              },
              batch: {
                select: {
                  id: true,
                  batchNumber: true,
                  expirationDate: true,
                },
              },
            },
          },
        },
      });

      return updatedCycleCount;
    });

    // Serialize Decimal values to numbers for client components
    const serializedResult = {
      ...result,
      totalVarianceCost: result.totalVarianceCost ? Number(result.totalVarianceCost) : null,
      accuracyPercent: result.accuracyPercent ? Number(result.accuracyPercent) : null,
      items: result.items.map((item) => ({
        ...item,
        systemQuantity: Number(item.systemQuantity),
        countedQuantity: item.countedQuantity !== null ? Number(item.countedQuantity) : null,
        variance: item.variance !== null ? Number(item.variance) : null,
        variancePercent: item.variancePercent !== null ? Number(item.variancePercent) : null,
        varianceCost: item.varianceCost !== null ? Number(item.varianceCost) : null,
        unitCost: item.unitCost !== null ? Number(item.unitCost) : null,
      })),
    };

    revalidatePath("/admin/inventory/cycle-counts");
    revalidatePath(`/admin/inventory/cycle-counts/${id}`);
    return { success: true, data: serializedResult };
  } catch (error) {
    console.error("Start Cycle Count Error:", error);
    return { error: "Failed to start cycle count" };
  }
}


/**
 * Record a physical count for a single item
 * Requirements: REQ-CC-2.2
 * 
 * This function:
 * - Validates cycle count is IN_PROGRESS
 * - Updates countedQuantity for the item
 * - Records countedById and countedAt
 * - Allows notes per item
 */
export async function recordCount(data: RecordCountInput) {
  // Validate required fields
  if (!data.cycleCountItemId || data.cycleCountItemId.trim() === "") {
    return { error: "Cycle count item ID is required" };
  }

  if (!data.countedById || data.countedById.trim() === "") {
    return { error: "Counted by user ID is required" };
  }

  if (data.countedQuantity === undefined || data.countedQuantity === null) {
    return { error: "Counted quantity is required" };
  }

  if (data.countedQuantity < 0) {
    return { error: "Counted quantity cannot be negative" };
  }

  try {
    // Get the cycle count item with its parent cycle count
    const cycleCountItem = await db.cycleCountItem.findUnique({
      where: { id: data.cycleCountItemId },
      include: {
        cycleCount: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!cycleCountItem) {
      return { error: "Cycle count item not found" };
    }

    // Validate cycle count is IN_PROGRESS
    if (cycleCountItem.cycleCount.status !== "IN_PROGRESS") {
      return {
        error: `Cannot record count. Cycle count is in ${cycleCountItem.cycleCount.status} status. Only IN_PROGRESS counts can be updated.`,
      };
    }

    // Update the cycle count item
    const updatedItem = await db.cycleCountItem.update({
      where: { id: data.cycleCountItemId },
      data: {
        countedQuantity: data.countedQuantity,
        countedById: data.countedById,
        countedAt: new Date(),
        notes: data.notes?.trim() || null,
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            itemCode: true,
            sku: true,
            primaryUnit: {
              select: {
                id: true,
                name: true,
                abbreviation: true,
              },
            },
          },
        },
        batch: {
          select: {
            id: true,
            batchNumber: true,
            expirationDate: true,
          },
        },
      },
    });

    revalidatePath(`/admin/inventory/cycle-counts/${cycleCountItem.cycleCount.id}`);
    return { success: true, data: updatedItem };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Cycle count item not found" };
      }
    }
    console.error("Record Count Error:", error);
    return { error: "Failed to record count" };
  }
}


/**
 * Record physical counts for multiple items in a single transaction
 * Requirements: REQ-CC-2.2
 * 
 * This function:
 * - Accepts array of counts
 * - Updates multiple items in a transaction
 * - Validates all items belong to the same cycle count
 * - Validates cycle count is IN_PROGRESS
 */
export async function recordBulkCounts(
  cycleCountId: string,
  counts: Array<{
    cycleCountItemId: string;
    countedQuantity: number;
    notes?: string;
  }>,
  countedById: string
) {
  // Validate required fields
  if (!cycleCountId || cycleCountId.trim() === "") {
    return { error: "Cycle count ID is required" };
  }

  if (!countedById || countedById.trim() === "") {
    return { error: "Counted by user ID is required" };
  }

  if (!counts || counts.length === 0) {
    return { error: "At least one count is required" };
  }

  // Validate all counts have required fields
  for (let i = 0; i < counts.length; i++) {
    const count = counts[i];
    if (!count.cycleCountItemId || count.cycleCountItemId.trim() === "") {
      return { error: `Count at index ${i}: Cycle count item ID is required` };
    }
    if (count.countedQuantity === undefined || count.countedQuantity === null) {
      return { error: `Count at index ${i}: Counted quantity is required` };
    }
    if (count.countedQuantity < 0) {
      return { error: `Count at index ${i}: Counted quantity cannot be negative` };
    }
  }

  try {
    // Get the cycle count to validate status
    const cycleCount = await db.cycleCount.findUnique({
      where: { id: cycleCountId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!cycleCount) {
      return { error: "Cycle count not found" };
    }

    // Validate cycle count is IN_PROGRESS
    if (cycleCount.status !== "IN_PROGRESS") {
      return {
        error: `Cannot record counts. Cycle count is in ${cycleCount.status} status. Only IN_PROGRESS counts can be updated.`,
      };
    }

    // Verify all items belong to this cycle count
    const itemIds = counts.map((c) => c.cycleCountItemId);
    const existingItems = await db.cycleCountItem.findMany({
      where: {
        id: { in: itemIds },
        cycleCountId,
      },
      select: { id: true },
    });

    const existingItemIds = new Set(existingItems.map((i) => i.id));
    const invalidItems = itemIds.filter((id) => !existingItemIds.has(id));

    if (invalidItems.length > 0) {
      return {
        error: `Some items do not belong to this cycle count: ${invalidItems.join(", ")}`,
      };
    }

    // Use a transaction to update all items atomically
    const countedAt = new Date();
    const result = await db.$transaction(async (tx) => {
      const updatedItems = [];

      for (const count of counts) {
        const updatedItem = await tx.cycleCountItem.update({
          where: { id: count.cycleCountItemId },
          data: {
            countedQuantity: count.countedQuantity,
            countedById,
            countedAt,
            notes: count.notes?.trim() || null,
          },
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                itemCode: true,
                sku: true,
              },
            },
            batch: {
              select: {
                id: true,
                batchNumber: true,
              },
            },
          },
        });
        updatedItems.push(updatedItem);
      }

      return updatedItems;
    });

    revalidatePath(`/admin/inventory/cycle-counts/${cycleCountId}`);
    return { success: true, data: { updatedCount: result.length, items: result } };
  } catch (error) {
    console.error("Record Bulk Counts Error:", error);
    return { error: "Failed to record bulk counts" };
  }
}


/**
 * Get count progress for a cycle count
 * Requirements: REQ-CC-2.2
 * 
 * This function returns:
 * - Total items in the count
 * - Items that have been counted
 * - Items remaining to be counted
 * - Progress percentage
 */
export async function getCountProgress(cycleCountId: string) {
  if (!cycleCountId || cycleCountId.trim() === "") {
    return { error: "Cycle count ID is required" };
  }

  try {
    // Get the cycle count to verify it exists
    const cycleCount = await db.cycleCount.findUnique({
      where: { id: cycleCountId },
      select: {
        id: true,
        status: true,
        totalItems: true,
      },
    });

    if (!cycleCount) {
      return { error: "Cycle count not found" };
    }

    // Count total items and items with counts
    const [totalItems, itemsCounted] = await Promise.all([
      db.cycleCountItem.count({
        where: { cycleCountId },
      }),
      db.cycleCountItem.count({
        where: {
          cycleCountId,
          countedQuantity: { not: null },
        },
      }),
    ]);

    const itemsRemaining = totalItems - itemsCounted;
    const progressPercent = totalItems > 0 
      ? Math.round((itemsCounted / totalItems) * 100 * 100) / 100 // Round to 2 decimal places
      : 0;

    return {
      success: true,
      data: {
        cycleCountId,
        status: cycleCount.status,
        totalItems,
        itemsCounted,
        itemsRemaining,
        progressPercent,
        isComplete: itemsRemaining === 0 && totalItems > 0,
      },
    };
  } catch (error) {
    console.error("Get Count Progress Error:", error);
    return { error: "Failed to get count progress" };
  }
}


// =============================================================================
// Variance Calculation
// =============================================================================

/**
 * Calculate variances for all items in a cycle count
 * Requirements: REQ-CC-3.1
 * 
 * This function:
 * - Calculates variance = counted - system
 * - Calculates variancePercent = (variance / system) × 100
 * - Calculates varianceCost = variance × unitCost
 * - Handles zero system quantity edge case
 */
export async function calculateVariances(cycleCountId: string) {
  if (!cycleCountId || cycleCountId.trim() === "") {
    return { error: "Cycle count ID is required" };
  }

  try {
    // Get the cycle count to verify it exists and check status
    const cycleCount = await db.cycleCount.findUnique({
      where: { id: cycleCountId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!cycleCount) {
      return { error: "Cycle count not found" };
    }

    // Get all items that have been counted
    const items = await db.cycleCountItem.findMany({
      where: {
        cycleCountId,
        countedQuantity: { not: null },
      },
      select: {
        id: true,
        systemQuantity: true,
        countedQuantity: true,
        unitCost: true,
      },
    });

    if (items.length === 0) {
      return { success: true, data: { itemsProcessed: 0 } };
    }

    // Calculate variances for each item
    const updates = items.map((item) => {
      const systemQty = Number(item.systemQuantity);
      const countedQty = Number(item.countedQuantity);
      const unitCost = Number(item.unitCost) || 0;

      // Calculate variance = counted - system
      const variance = countedQty - systemQty;

      // Calculate variance percent
      // Handle zero system quantity edge case:
      // - If system is 0 and counted is 0, variance percent is 0
      // - If system is 0 and counted is not 0, variance percent is 100 (or could be considered infinite)
      let variancePercent: number;
      if (systemQty === 0) {
        variancePercent = variance !== 0 ? 100 : 0;
      } else {
        variancePercent = (variance / systemQty) * 100;
      }

      // Calculate variance cost = variance × unitCost
      const varianceCost = variance * unitCost;

      return {
        id: item.id,
        variance,
        variancePercent,
        varianceCost,
      };
    });

    // Update all items with calculated variances in a transaction
    await db.$transaction(
      updates.map((update) =>
        db.cycleCountItem.update({
          where: { id: update.id },
          data: {
            variance: update.variance,
            variancePercent: update.variancePercent,
            varianceCost: update.varianceCost,
          },
        })
      )
    );

    revalidatePath(`/admin/inventory/cycle-counts/${cycleCountId}`);
    return { success: true, data: { itemsProcessed: updates.length } };
  } catch (error) {
    console.error("Calculate Variances Error:", error);
    return { error: "Failed to calculate variances" };
  }
}


/**
 * Update cycle count summary statistics
 * Requirements: REQ-CC-5.2
 * 
 * This function calculates and updates:
 * - totalItems: Total number of items in the count
 * - itemsCounted: Number of items that have been counted
 * - itemsWithVariance: Number of items with non-zero variance
 * - totalVarianceCost: Sum of absolute variance costs
 * - accuracyPercent: Percentage of items with zero variance
 */
export async function updateCycleCountSummary(cycleCountId: string) {
  if (!cycleCountId || cycleCountId.trim() === "") {
    return { error: "Cycle count ID is required" };
  }

  try {
    // Get the cycle count to verify it exists
    const cycleCount = await db.cycleCount.findUnique({
      where: { id: cycleCountId },
      select: { id: true },
    });

    if (!cycleCount) {
      return { error: "Cycle count not found" };
    }

    // Get all items for this cycle count
    const items = await db.cycleCountItem.findMany({
      where: { cycleCountId },
      select: {
        id: true,
        countedQuantity: true,
        variance: true,
        varianceCost: true,
      },
    });

    // Calculate summary statistics
    const totalItems = items.length;
    
    // Items that have been counted (countedQuantity is not null)
    const itemsCounted = items.filter((item) => item.countedQuantity !== null).length;
    
    // Items with non-zero variance
    const itemsWithVariance = items.filter(
      (item) => item.variance !== null && Number(item.variance) !== 0
    ).length;
    
    // Sum of absolute variance costs
    const totalVarianceCost = items.reduce((sum, item) => {
      if (item.varianceCost !== null) {
        return sum + Math.abs(Number(item.varianceCost));
      }
      return sum;
    }, 0);
    
    // Accuracy percent = items with zero variance / total items counted
    // Only consider items that have been counted and have variance calculated
    const itemsWithZeroVariance = items.filter(
      (item) => item.countedQuantity !== null && item.variance !== null && Number(item.variance) === 0
    ).length;
    
    const accuracyPercent = itemsCounted > 0
      ? (itemsWithZeroVariance / itemsCounted) * 100
      : 0;

    // Update the cycle count with summary statistics
    const updatedCycleCount = await db.cycleCount.update({
      where: { id: cycleCountId },
      data: {
        totalItems,
        itemsCounted,
        itemsWithVariance,
        totalVarianceCost,
        accuracyPercent,
      },
      select: {
        id: true,
        countNumber: true,
        totalItems: true,
        itemsCounted: true,
        itemsWithVariance: true,
        totalVarianceCost: true,
        accuracyPercent: true,
      },
    });

    revalidatePath(`/admin/inventory/cycle-counts/${cycleCountId}`);
    return { success: true, data: updatedCycleCount };
  } catch (error) {
    console.error("Update Cycle Count Summary Error:", error);
    return { error: "Failed to update cycle count summary" };
  }
}


/**
 * Submit a cycle count for review
 * Requirements: REQ-CC-3.3
 * 
 * This function:
 * - Validates all items have counts entered
 * - Calculates variances for all items
 * - Updates cycle count summary fields
 * - Sets status to PENDING_REVIEW
 */
export async function submitForReview(cycleCountId: string) {
  if (!cycleCountId || cycleCountId.trim() === "") {
    return { error: "Cycle count ID is required" };
  }

  try {
    // Get the cycle count to verify it exists and check status
    const cycleCount = await db.cycleCount.findUnique({
      where: { id: cycleCountId },
      select: {
        id: true,
        status: true,
        countNumber: true,
      },
    });

    if (!cycleCount) {
      return { error: "Cycle count not found" };
    }

    // Validate status - only IN_PROGRESS can be submitted for review
    if (cycleCount.status !== "IN_PROGRESS") {
      return {
        error: `Cannot submit cycle count for review. Current status is ${cycleCount.status}. Only IN_PROGRESS counts can be submitted.`,
      };
    }

    // Check if all items have been counted
    const [totalItems, itemsWithCounts] = await Promise.all([
      db.cycleCountItem.count({
        where: { cycleCountId },
      }),
      db.cycleCountItem.count({
        where: {
          cycleCountId,
          countedQuantity: { not: null },
        },
      }),
    ]);

    if (totalItems === 0) {
      return { error: "Cannot submit cycle count with no items" };
    }

    if (itemsWithCounts < totalItems) {
      const remaining = totalItems - itemsWithCounts;
      return {
        error: `Cannot submit for review. ${remaining} item(s) have not been counted yet. All items must be counted before submission.`,
      };
    }

    // Calculate variances for all items
    const varianceResult = await calculateVariances(cycleCountId);
    if (varianceResult.error) {
      return { error: `Failed to calculate variances: ${varianceResult.error}` };
    }

    // Update cycle count summary
    const summaryResult = await updateCycleCountSummary(cycleCountId);
    if (summaryResult.error) {
      return { error: `Failed to update summary: ${summaryResult.error}` };
    }

    // Update status to PENDING_REVIEW
    const updatedCycleCount = await db.cycleCount.update({
      where: { id: cycleCountId },
      data: {
        status: "PENDING_REVIEW",
      },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        items: {
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                itemCode: true,
                sku: true,
                primaryUnit: {
                  select: {
                    id: true,
                    name: true,
                    abbreviation: true,
                  },
                },
              },
            },
            batch: {
              select: {
                id: true,
                batchNumber: true,
                expirationDate: true,
              },
            },
          },
          orderBy: [
            { stockItem: { name: "asc" } },
          ],
        },
      },
    });

    revalidatePath("/admin/inventory/cycle-counts");
    revalidatePath(`/admin/inventory/cycle-counts/${cycleCountId}`);
    return { success: true, data: updatedCycleCount };
  } catch (error) {
    console.error("Submit For Review Error:", error);
    return { error: "Failed to submit cycle count for review" };
  }
}


// =============================================================================
// Approval Workflow
// =============================================================================

/**
 * Approve a cycle count and trigger stock adjustments
 * Requirements: REQ-CC-4.2
 * 
 * This function:
 * - Validates status is PENDING_REVIEW
 * - Records approvedById and completedAt
 * - Sets status to COMPLETED
 */
export async function approveCycleCount(id: string, approvedById: string) {
  // Validate required fields
  if (!id || id.trim() === "") {
    return { error: "Cycle count ID is required" };
  }

  if (!approvedById || approvedById.trim() === "") {
    return { error: "Approved by user ID is required" };
  }

  try {
    // Get existing cycle count to check status
    const existingCycleCount = await db.cycleCount.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        countNumber: true,
      },
    });

    if (!existingCycleCount) {
      return { error: "Cycle count not found" };
    }

    // Validate status - only PENDING_REVIEW can be approved
    if (existingCycleCount.status !== "PENDING_REVIEW") {
      return {
        error: `Cannot approve cycle count in ${existingCycleCount.status} status. Only PENDING_REVIEW counts can be approved.`,
      };
    }

    // Update cycle count status to COMPLETED
    const updatedCycleCount = await db.cycleCount.update({
      where: { id },
      data: {
        status: "COMPLETED",
        approvedById,
        completedAt: new Date(),
      },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        items: {
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                itemCode: true,
                sku: true,
                primaryUnit: {
                  select: {
                    id: true,
                    name: true,
                    abbreviation: true,
                  },
                },
              },
            },
            batch: {
              select: {
                id: true,
                batchNumber: true,
                expirationDate: true,
              },
            },
          },
          orderBy: [{ stockItem: { name: "asc" } }],
        },
      },
    });

    revalidatePath("/admin/inventory/cycle-counts");
    revalidatePath(`/admin/inventory/cycle-counts/${id}`);
    return { success: true, data: updatedCycleCount };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Cycle count not found" };
      }
    }
    console.error("Approve Cycle Count Error:", error);
    return { error: "Failed to approve cycle count" };
  }
}


/**
 * Create stock adjustments for all items with variance in a cycle count
 * Requirements: REQ-CC-4.3, REQ-CC-6.1
 * 
 * This function:
 * - For each item with variance, calls adjustStock
 * - Sets reason: "Cycle Count Adjustment: {countNumber}"
 * - Sets referenceType: "CYCLE_COUNT"
 * - Sets referenceId: cycleCountItem.id
 * - Updates adjustmentMade and adjustmentId on item
 */
export async function createAdjustments(cycleCountId: string, approvedById: string) {
  // Validate required fields
  if (!cycleCountId || cycleCountId.trim() === "") {
    return { error: "Cycle count ID is required" };
  }

  if (!approvedById || approvedById.trim() === "") {
    return { error: "Approved by user ID is required" };
  }

  try {
    // Get the cycle count with all items that have variance
    const cycleCount = await db.cycleCount.findUnique({
      where: { id: cycleCountId },
      select: {
        id: true,
        countNumber: true,
        warehouseId: true,
        status: true,
        items: {
          where: {
            variance: { not: null },
            NOT: { variance: 0 },
          },
          select: {
            id: true,
            stockItemId: true,
            batchId: true,
            variance: true,
            adjustmentMade: true,
          },
        },
      },
    });

    if (!cycleCount) {
      return { error: "Cycle count not found" };
    }

    // Validate status - only COMPLETED counts should have adjustments created
    // (This function is typically called after approveCycleCount)
    if (cycleCount.status !== "COMPLETED" && cycleCount.status !== "PENDING_REVIEW") {
      return {
        error: `Cannot create adjustments for cycle count in ${cycleCount.status} status.`,
      };
    }

    // Filter out items that already have adjustments made
    const itemsToAdjust = cycleCount.items.filter((item) => !item.adjustmentMade);

    if (itemsToAdjust.length === 0) {
      return { 
        success: true, 
        data: { 
          adjustmentsCreated: 0, 
          message: "No items require adjustment" 
        } 
      };
    }

    const reason = `Cycle Count Adjustment: ${cycleCount.countNumber}`;
    const adjustmentResults: Array<{
      itemId: string;
      movementId: string;
      variance: number;
    }> = [];
    const errors: Array<{ itemId: string; error: string }> = [];

    // Process each item with variance
    for (const item of itemsToAdjust) {
      const variance = Number(item.variance);
      
      // Skip items with zero variance (shouldn't happen due to filter, but safety check)
      if (variance === 0) {
        continue;
      }

      // Call adjustStock to create the adjustment
      const adjustResult = await adjustStock({
        stockItemId: item.stockItemId,
        warehouseId: cycleCount.warehouseId,
        quantity: variance, // Positive for increase, negative for decrease
        reason,
        batchId: item.batchId || undefined,
        referenceType: "CYCLE_COUNT",
        referenceId: item.id,
        createdById: approvedById,
      });

      if (adjustResult.error) {
        errors.push({ itemId: item.id, error: adjustResult.error });
        continue;
      }

      // Update the cycle count item with adjustment info
      await db.cycleCountItem.update({
        where: { id: item.id },
        data: {
          adjustmentMade: true,
          adjustmentId: adjustResult.data?.movementId || null,
        },
      });

      adjustmentResults.push({
        itemId: item.id,
        movementId: adjustResult.data?.movementId || "",
        variance,
      });
    }

    revalidatePath("/admin/inventory/cycle-counts");
    revalidatePath(`/admin/inventory/cycle-counts/${cycleCountId}`);
    revalidatePath("/admin/inventory");

    // Return results
    if (errors.length > 0 && adjustmentResults.length === 0) {
      return {
        error: `Failed to create any adjustments. Errors: ${errors.map((e) => e.error).join(", ")}`,
      };
    }

    return {
      success: true,
      data: {
        adjustmentsCreated: adjustmentResults.length,
        adjustments: adjustmentResults,
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  } catch (error) {
    console.error("Create Adjustments Error:", error);
    return { error: "Failed to create adjustments" };
  }
}


/**
 * Reject a cycle count and optionally request recount
 * Requirements: REQ-CC-4.4
 * 
 * This function:
 * - Sets status back to IN_PROGRESS
 * - Clears counted quantities (optional, configurable)
 * - Records rejection reason
 */
export async function rejectCycleCount(
  id: string, 
  reason: string, 
  options?: { clearCounts?: boolean }
) {
  // Validate required fields
  if (!id || id.trim() === "") {
    return { error: "Cycle count ID is required" };
  }

  if (!reason || reason.trim() === "") {
    return { error: "Rejection reason is required" };
  }

  try {
    // Get existing cycle count to check status
    const existingCycleCount = await db.cycleCount.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        countNumber: true,
        notes: true,
      },
    });

    if (!existingCycleCount) {
      return { error: "Cycle count not found" };
    }

    // Validate status - only PENDING_REVIEW can be rejected
    if (existingCycleCount.status !== "PENDING_REVIEW") {
      return {
        error: `Cannot reject cycle count in ${existingCycleCount.status} status. Only PENDING_REVIEW counts can be rejected.`,
      };
    }

    // Build notes with rejection reason
    let updatedNotes = existingCycleCount.notes || "";
    const rejectionNote = `\n[REJECTED: ${new Date().toISOString()}] ${reason.trim()}`;
    updatedNotes = updatedNotes + rejectionNote;

    // Use transaction to update cycle count and optionally clear counts
    const result = await db.$transaction(async (tx) => {
      // If clearCounts is true, clear all counted quantities
      if (options?.clearCounts) {
        await tx.cycleCountItem.updateMany({
          where: { cycleCountId: id },
          data: {
            countedQuantity: null,
            countedById: null,
            countedAt: null,
            variance: null,
            variancePercent: null,
            varianceCost: null,
            notes: null,
          },
        });
      }

      // Update cycle count status back to IN_PROGRESS
      const updatedCycleCount = await tx.cycleCount.update({
        where: { id },
        data: {
          status: "IN_PROGRESS",
          notes: updatedNotes.trim(),
          // Reset summary fields if counts are cleared
          ...(options?.clearCounts && {
            itemsCounted: 0,
            itemsWithVariance: null,
            totalVarianceCost: null,
            accuracyPercent: null,
          }),
        },
        include: {
          warehouse: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          items: {
            include: {
              stockItem: {
                select: {
                  id: true,
                  name: true,
                  itemCode: true,
                  sku: true,
                  primaryUnit: {
                    select: {
                      id: true,
                      name: true,
                      abbreviation: true,
                    },
                  },
                },
              },
              batch: {
                select: {
                  id: true,
                  batchNumber: true,
                  expirationDate: true,
                },
              },
            },
            orderBy: [{ stockItem: { name: "asc" } }],
          },
        },
      });

      return updatedCycleCount;
    });

    revalidatePath("/admin/inventory/cycle-counts");
    revalidatePath(`/admin/inventory/cycle-counts/${id}`);
    return { 
      success: true, 
      data: result,
      countsCleared: options?.clearCounts ?? false,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Cycle count not found" };
      }
    }
    console.error("Reject Cycle Count Error:", error);
    return { error: "Failed to reject cycle count" };
  }
}


// =============================================================================
// Reporting Functions
// =============================================================================

/**
 * Report data types
 */
export interface CycleCountReportItem {
  id: string;
  stockItemId: string;
  stockItemName: string;
  stockItemCode: string;
  stockItemSku: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  unitName: string;
  unitAbbreviation: string;
  batchId: string | null;
  batchNumber: string | null;
  expirationDate: Date | null;
  systemQuantity: number;
  countedQuantity: number | null;
  variance: number | null;
  variancePercent: number | null;
  unitCost: number | null;
  varianceCost: number | null;
  countedById: string | null;
  countedAt: Date | null;
  notes: string | null;
  adjustmentMade: boolean;
  adjustmentId: string | null;
}

export interface CycleCountReportSummary {
  totalItems: number;
  itemsCounted: number;
  itemsWithVariance: number;
  itemsWithPositiveVariance: number;
  itemsWithNegativeVariance: number;
  totalPositiveVarianceCost: number;
  totalNegativeVarianceCost: number;
  totalAbsoluteVarianceCost: number;
  netVarianceCost: number;
  accuracyPercent: number;
}

export interface CycleCountReport {
  cycleCount: {
    id: string;
    countNumber: string;
    type: CycleCountType;
    status: CycleCountStatus;
    blindCount: boolean;
    warehouseId: string;
    warehouseName: string;
    warehouseType: string;
    propertyId: string | null;
    propertyName: string | null;
    scheduledAt: Date | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdById: string;
    approvedById: string | null;
    notes: string | null;
    createdAt: Date;
  };
  items: CycleCountReportItem[];
  summary: CycleCountReportSummary;
}

/**
 * Get detailed cycle count report with all items and summary statistics
 * Requirements: REQ-CC-5.1
 * 
 * This function returns:
 * - Cycle count header information
 * - All items with system qty, counted qty, variance, cost
 * - Summary statistics including total variance cost and accuracy
 */
export async function getCycleCountReport(id: string): Promise<{ error?: string; data?: CycleCountReport }> {
  if (!id || id.trim() === "") {
    return { error: "Cycle count ID is required" };
  }

  try {
    // Get the cycle count with all related data
    const cycleCount = await db.cycleCount.findUnique({
      where: { id },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
            property: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        items: {
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                itemCode: true,
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
                    id: true,
                    name: true,
                    abbreviation: true,
                  },
                },
              },
            },
            batch: {
              select: {
                id: true,
                batchNumber: true,
                expirationDate: true,
              },
            },
          },
          orderBy: [
            { stockItem: { category: { name: "asc" } } },
            { stockItem: { name: "asc" } },
            { batch: { batchNumber: "asc" } },
          ],
        },
      },
    });

    if (!cycleCount) {
      return { error: "Cycle count not found" };
    }

    // Transform items to report format
    const items: CycleCountReportItem[] = cycleCount.items.map((item) => ({
      id: item.id,
      stockItemId: item.stockItemId,
      stockItemName: item.stockItem.name,
      stockItemCode: item.stockItem.itemCode,
      stockItemSku: item.stockItem.sku,
      categoryId: item.stockItem.category?.id || null,
      categoryName: item.stockItem.category?.name || null,
      categoryColor: item.stockItem.category?.color || null,
      unitName: item.stockItem.primaryUnit.name,
      unitAbbreviation: item.stockItem.primaryUnit.abbreviation,
      batchId: item.batchId,
      batchNumber: item.batch?.batchNumber || null,
      expirationDate: item.batch?.expirationDate || null,
      systemQuantity: Number(item.systemQuantity),
      countedQuantity: item.countedQuantity !== null ? Number(item.countedQuantity) : null,
      variance: item.variance !== null ? Number(item.variance) : null,
      variancePercent: item.variancePercent !== null ? Number(item.variancePercent) : null,
      unitCost: item.unitCost !== null ? Number(item.unitCost) : null,
      varianceCost: item.varianceCost !== null ? Number(item.varianceCost) : null,
      countedById: item.countedById,
      countedAt: item.countedAt,
      notes: item.notes,
      adjustmentMade: item.adjustmentMade,
      adjustmentId: item.adjustmentId,
    }));

    // Calculate summary statistics
    const totalItems = items.length;
    const itemsCounted = items.filter((item) => item.countedQuantity !== null).length;
    
    // Items with variance (non-zero)
    const itemsWithVariance = items.filter(
      (item) => item.variance !== null && item.variance !== 0
    ).length;
    
    // Items with positive variance (counted > system)
    const itemsWithPositiveVariance = items.filter(
      (item) => item.variance !== null && item.variance > 0
    ).length;
    
    // Items with negative variance (counted < system)
    const itemsWithNegativeVariance = items.filter(
      (item) => item.variance !== null && item.variance < 0
    ).length;
    
    // Total positive variance cost (overage)
    const totalPositiveVarianceCost = items.reduce((sum, item) => {
      if (item.varianceCost !== null && item.varianceCost > 0) {
        return sum + item.varianceCost;
      }
      return sum;
    }, 0);
    
    // Total negative variance cost (shortage/shrinkage)
    const totalNegativeVarianceCost = items.reduce((sum, item) => {
      if (item.varianceCost !== null && item.varianceCost < 0) {
        return sum + Math.abs(item.varianceCost);
      }
      return sum;
    }, 0);
    
    // Total absolute variance cost
    const totalAbsoluteVarianceCost = totalPositiveVarianceCost + totalNegativeVarianceCost;
    
    // Net variance cost (positive - negative)
    const netVarianceCost = items.reduce((sum, item) => {
      if (item.varianceCost !== null) {
        return sum + item.varianceCost;
      }
      return sum;
    }, 0);
    
    // Accuracy percent = items with zero variance / total items counted
    const itemsWithZeroVariance = items.filter(
      (item) => item.countedQuantity !== null && item.variance !== null && item.variance === 0
    ).length;
    
    const accuracyPercent = itemsCounted > 0
      ? Math.round((itemsWithZeroVariance / itemsCounted) * 100 * 100) / 100
      : 0;

    const summary: CycleCountReportSummary = {
      totalItems,
      itemsCounted,
      itemsWithVariance,
      itemsWithPositiveVariance,
      itemsWithNegativeVariance,
      totalPositiveVarianceCost: Math.round(totalPositiveVarianceCost * 100) / 100,
      totalNegativeVarianceCost: Math.round(totalNegativeVarianceCost * 100) / 100,
      totalAbsoluteVarianceCost: Math.round(totalAbsoluteVarianceCost * 100) / 100,
      netVarianceCost: Math.round(netVarianceCost * 100) / 100,
      accuracyPercent,
    };

    const report: CycleCountReport = {
      cycleCount: {
        id: cycleCount.id,
        countNumber: cycleCount.countNumber,
        type: cycleCount.type,
        status: cycleCount.status,
        blindCount: cycleCount.blindCount,
        warehouseId: cycleCount.warehouseId,
        warehouseName: cycleCount.warehouse.name,
        warehouseType: cycleCount.warehouse.type,
        propertyId: cycleCount.warehouse.property?.id || null,
        propertyName: cycleCount.warehouse.property?.name || null,
        scheduledAt: cycleCount.scheduledAt,
        startedAt: cycleCount.startedAt,
        completedAt: cycleCount.completedAt,
        createdById: cycleCount.createdById,
        approvedById: cycleCount.approvedById,
        notes: cycleCount.notes,
        createdAt: cycleCount.createdAt,
      },
      items,
      summary,
    };

    return { data: report };
  } catch (error) {
    console.error("Get Cycle Count Report Error:", error);
    return { error: "Failed to get cycle count report" };
  }
}



/**
 * Inventory accuracy data point for trend charting
 */
export interface InventoryAccuracyDataPoint {
  cycleCountId: string;
  countNumber: string;
  completedAt: Date;
  warehouseId: string;
  warehouseName: string;
  type: CycleCountType;
  totalItems: number;
  itemsWithZeroVariance: number;
  accuracyPercent: number;
  totalVarianceCost: number;
}

export interface InventoryAccuracyResult {
  dataPoints: InventoryAccuracyDataPoint[];
  summary: {
    totalCycleCounts: number;
    averageAccuracy: number;
    minAccuracy: number;
    maxAccuracy: number;
    totalVarianceCost: number;
    dateRange: {
      start: Date | null;
      end: Date | null;
    };
  };
}

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Get inventory accuracy metrics over time for trend analysis
 * Requirements: REQ-CC-5.2
 * 
 * This function:
 * - Queries completed cycle counts in date range
 * - Calculates accuracy % per count
 * - Returns trend data for charting
 */
export async function getInventoryAccuracy(
  warehouseId?: string,
  dateRange?: DateRange
): Promise<{ error?: string; data?: InventoryAccuracyResult }> {
  try {
    // Build where clause
    const where: Prisma.CycleCountWhereInput = {
      status: "COMPLETED",
      completedAt: { not: null },
    };

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    if (dateRange) {
      where.completedAt = {
        gte: dateRange.start,
        lte: dateRange.end,
      };
    }

    // Get completed cycle counts
    const cycleCounts = await db.cycleCount.findMany({
      where,
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          select: {
            id: true,
            countedQuantity: true,
            variance: true,
            varianceCost: true,
          },
        },
      },
      orderBy: {
        completedAt: "asc",
      },
    });

    if (cycleCounts.length === 0) {
      return {
        data: {
          dataPoints: [],
          summary: {
            totalCycleCounts: 0,
            averageAccuracy: 0,
            minAccuracy: 0,
            maxAccuracy: 0,
            totalVarianceCost: 0,
            dateRange: {
              start: dateRange?.start || null,
              end: dateRange?.end || null,
            },
          },
        },
      };
    }

    // Calculate accuracy for each cycle count
    const dataPoints: InventoryAccuracyDataPoint[] = cycleCounts.map((cc) => {
      const countedItems = cc.items.filter((item) => item.countedQuantity !== null);
      const totalItems = countedItems.length;
      
      const itemsWithZeroVariance = countedItems.filter(
        (item) => item.variance !== null && Number(item.variance) === 0
      ).length;
      
      const accuracyPercent = totalItems > 0
        ? Math.round((itemsWithZeroVariance / totalItems) * 100 * 100) / 100
        : 0;
      
      const totalVarianceCost = cc.items.reduce((sum, item) => {
        if (item.varianceCost !== null) {
          return sum + Math.abs(Number(item.varianceCost));
        }
        return sum;
      }, 0);

      return {
        cycleCountId: cc.id,
        countNumber: cc.countNumber,
        completedAt: cc.completedAt!,
        warehouseId: cc.warehouseId,
        warehouseName: cc.warehouse.name,
        type: cc.type,
        totalItems,
        itemsWithZeroVariance,
        accuracyPercent,
        totalVarianceCost: Math.round(totalVarianceCost * 100) / 100,
      };
    });

    // Calculate summary statistics
    const accuracies = dataPoints.map((dp) => dp.accuracyPercent);
    const totalVarianceCost = dataPoints.reduce((sum, dp) => sum + dp.totalVarianceCost, 0);
    
    const averageAccuracy = accuracies.length > 0
      ? Math.round((accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length) * 100) / 100
      : 0;
    
    const minAccuracy = accuracies.length > 0 ? Math.min(...accuracies) : 0;
    const maxAccuracy = accuracies.length > 0 ? Math.max(...accuracies) : 0;

    const completedDates = dataPoints.map((dp) => dp.completedAt);
    const dateRangeResult = {
      start: completedDates.length > 0 ? completedDates[0] : null,
      end: completedDates.length > 0 ? completedDates[completedDates.length - 1] : null,
    };

    return {
      data: {
        dataPoints,
        summary: {
          totalCycleCounts: dataPoints.length,
          averageAccuracy,
          minAccuracy,
          maxAccuracy,
          totalVarianceCost: Math.round(totalVarianceCost * 100) / 100,
          dateRange: dateRangeResult,
        },
      },
    };
  } catch (error) {
    console.error("Get Inventory Accuracy Error:", error);
    return { error: "Failed to get inventory accuracy data" };
  }
}



/**
 * Variance analysis item data
 */
export interface VarianceByItem {
  stockItemId: string;
  stockItemName: string;
  stockItemCode: string;
  categoryId: string | null;
  categoryName: string | null;
  varianceCount: number; // Number of times this item had variance
  totalVarianceCost: number; // Sum of absolute variance costs
  averageVariancePercent: number;
  lastVarianceDate: Date | null;
}

export interface VarianceByCategory {
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  itemCount: number; // Number of unique items with variance
  varianceCount: number; // Total variance occurrences
  totalVarianceCost: number;
  averageAccuracy: number;
}

export interface VarianceAnalysisResult {
  topItemsByFrequency: VarianceByItem[];
  topItemsByCost: VarianceByItem[];
  varianceByCategory: VarianceByCategory[];
  summary: {
    totalVarianceOccurrences: number;
    uniqueItemsWithVariance: number;
    totalVarianceCost: number;
    mostProblematicCategory: string | null;
    dateRange: {
      start: Date | null;
      end: Date | null;
    };
  };
}

/**
 * Analyze patterns in inventory variances
 * Requirements: REQ-CC-5.3
 * 
 * This function returns:
 * - Top items by variance frequency
 * - Top items by variance cost
 * - Variance by category
 * - Identifies shrinkage patterns
 */
export async function getVarianceAnalysis(
  warehouseId?: string,
  dateRange?: DateRange,
  limit: number = 10
): Promise<{ error?: string; data?: VarianceAnalysisResult }> {
  try {
    // Build where clause for completed cycle counts
    const cycleCountWhere: Prisma.CycleCountWhereInput = {
      status: "COMPLETED",
      completedAt: { not: null },
    };

    if (warehouseId) {
      cycleCountWhere.warehouseId = warehouseId;
    }

    if (dateRange) {
      cycleCountWhere.completedAt = {
        gte: dateRange.start,
        lte: dateRange.end,
      };
    }

    // Get all cycle count items with variance from completed counts
    const cycleCountItems = await db.cycleCountItem.findMany({
      where: {
        cycleCount: cycleCountWhere,
        variance: { not: null },
        NOT: { variance: 0 },
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            itemCode: true,
            category: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
        cycleCount: {
          select: {
            completedAt: true,
          },
        },
      },
    });

    if (cycleCountItems.length === 0) {
      return {
        data: {
          topItemsByFrequency: [],
          topItemsByCost: [],
          varianceByCategory: [],
          summary: {
            totalVarianceOccurrences: 0,
            uniqueItemsWithVariance: 0,
            totalVarianceCost: 0,
            mostProblematicCategory: null,
            dateRange: {
              start: dateRange?.start || null,
              end: dateRange?.end || null,
            },
          },
        },
      };
    }

    // Aggregate variance data by stock item
    const itemVarianceMap = new Map<string, {
      stockItemId: string;
      stockItemName: string;
      stockItemCode: string;
      categoryId: string | null;
      categoryName: string | null;
      varianceCount: number;
      totalVarianceCost: number;
      variancePercents: number[];
      lastVarianceDate: Date | null;
    }>();

    for (const item of cycleCountItems) {
      const existing = itemVarianceMap.get(item.stockItemId);
      const varianceCost = Math.abs(Number(item.varianceCost) || 0);
      const variancePercent = Math.abs(Number(item.variancePercent) || 0);
      const completedAt = item.cycleCount.completedAt;

      if (existing) {
        existing.varianceCount += 1;
        existing.totalVarianceCost += varianceCost;
        existing.variancePercents.push(variancePercent);
        if (completedAt && (!existing.lastVarianceDate || completedAt > existing.lastVarianceDate)) {
          existing.lastVarianceDate = completedAt;
        }
      } else {
        itemVarianceMap.set(item.stockItemId, {
          stockItemId: item.stockItemId,
          stockItemName: item.stockItem.name,
          stockItemCode: item.stockItem.itemCode,
          categoryId: item.stockItem.category?.id || null,
          categoryName: item.stockItem.category?.name || null,
          varianceCount: 1,
          totalVarianceCost: varianceCost,
          variancePercents: [variancePercent],
          lastVarianceDate: completedAt,
        });
      }
    }

    // Convert to array and calculate averages
    const itemVariances: VarianceByItem[] = Array.from(itemVarianceMap.values()).map((item) => ({
      stockItemId: item.stockItemId,
      stockItemName: item.stockItemName,
      stockItemCode: item.stockItemCode,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      varianceCount: item.varianceCount,
      totalVarianceCost: Math.round(item.totalVarianceCost * 100) / 100,
      averageVariancePercent: item.variancePercents.length > 0
        ? Math.round((item.variancePercents.reduce((sum, p) => sum + p, 0) / item.variancePercents.length) * 100) / 100
        : 0,
      lastVarianceDate: item.lastVarianceDate,
    }));

    // Top items by frequency
    const topItemsByFrequency = [...itemVariances]
      .sort((a, b) => b.varianceCount - a.varianceCount)
      .slice(0, limit);

    // Top items by cost
    const topItemsByCost = [...itemVariances]
      .sort((a, b) => b.totalVarianceCost - a.totalVarianceCost)
      .slice(0, limit);

    // Aggregate variance data by category
    const categoryVarianceMap = new Map<string | null, {
      categoryId: string | null;
      categoryName: string | null;
      categoryColor: string | null;
      itemIds: Set<string>;
      varianceCount: number;
      totalVarianceCost: number;
      accuracies: number[];
    }>();

    // We need to get all items (including those with zero variance) to calculate accuracy
    const allCycleCountItems = await db.cycleCountItem.findMany({
      where: {
        cycleCount: cycleCountWhere,
        countedQuantity: { not: null },
      },
      include: {
        stockItem: {
          select: {
            id: true,
            category: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
    });

    // Group all items by category for accuracy calculation
    const categoryItemsMap = new Map<string | null, {
      categoryId: string | null;
      categoryName: string | null;
      categoryColor: string | null;
      totalItems: number;
      itemsWithZeroVariance: number;
    }>();

    for (const item of allCycleCountItems) {
      const categoryId = item.stockItem.category?.id || null;
      const existing = categoryItemsMap.get(categoryId);
      const hasZeroVariance = item.variance !== null && Number(item.variance) === 0;

      if (existing) {
        existing.totalItems += 1;
        if (hasZeroVariance) {
          existing.itemsWithZeroVariance += 1;
        }
      } else {
        categoryItemsMap.set(categoryId, {
          categoryId,
          categoryName: item.stockItem.category?.name || null,
          categoryColor: item.stockItem.category?.color || null,
          totalItems: 1,
          itemsWithZeroVariance: hasZeroVariance ? 1 : 0,
        });
      }
    }

    // Build category variance data
    for (const item of cycleCountItems) {
      const categoryId = item.stockItem.category?.id || null;
      const existing = categoryVarianceMap.get(categoryId);
      const varianceCost = Math.abs(Number(item.varianceCost) || 0);

      if (existing) {
        existing.itemIds.add(item.stockItemId);
        existing.varianceCount += 1;
        existing.totalVarianceCost += varianceCost;
      } else {
        categoryVarianceMap.set(categoryId, {
          categoryId,
          categoryName: item.stockItem.category?.name || null,
          categoryColor: item.stockItem.category?.color || null,
          itemIds: new Set([item.stockItemId]),
          varianceCount: 1,
          totalVarianceCost: varianceCost,
          accuracies: [],
        });
      }
    }

    // Calculate accuracy per category
    const varianceByCategory: VarianceByCategory[] = Array.from(categoryVarianceMap.values()).map((cat) => {
      const categoryItems = categoryItemsMap.get(cat.categoryId);
      const averageAccuracy = categoryItems && categoryItems.totalItems > 0
        ? Math.round((categoryItems.itemsWithZeroVariance / categoryItems.totalItems) * 100 * 100) / 100
        : 0;

      return {
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        categoryColor: cat.categoryColor,
        itemCount: cat.itemIds.size,
        varianceCount: cat.varianceCount,
        totalVarianceCost: Math.round(cat.totalVarianceCost * 100) / 100,
        averageAccuracy,
      };
    }).sort((a, b) => b.totalVarianceCost - a.totalVarianceCost);

    // Calculate summary
    const totalVarianceOccurrences = cycleCountItems.length;
    const uniqueItemsWithVariance = itemVarianceMap.size;
    const totalVarianceCost = itemVariances.reduce((sum, item) => sum + item.totalVarianceCost, 0);
    
    const mostProblematicCategory = varianceByCategory.length > 0
      ? varianceByCategory[0].categoryName
      : null;

    // Get date range from actual data
    const completedDates = cycleCountItems
      .map((item) => item.cycleCount.completedAt)
      .filter((date): date is Date => date !== null)
      .sort((a, b) => a.getTime() - b.getTime());

    const actualDateRange = {
      start: completedDates.length > 0 ? completedDates[0] : (dateRange?.start || null),
      end: completedDates.length > 0 ? completedDates[completedDates.length - 1] : (dateRange?.end || null),
    };

    return {
      data: {
        topItemsByFrequency,
        topItemsByCost,
        varianceByCategory,
        summary: {
          totalVarianceOccurrences,
          uniqueItemsWithVariance,
          totalVarianceCost: Math.round(totalVarianceCost * 100) / 100,
          mostProblematicCategory,
          dateRange: actualDateRange,
        },
      },
    };
  } catch (error) {
    console.error("Get Variance Analysis Error:", error);
    return { error: "Failed to get variance analysis data" };
  }
}
