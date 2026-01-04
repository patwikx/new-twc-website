"use server";

import { db } from "@/lib/db";
import { Prisma, RequisitionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import { getPropertyFilter } from "@/lib/property-context";

// Types
export interface CreateRequisitionInput {
  requestingWarehouseId: string;
  sourceWarehouseId: string;
  requestedById: string;
  notes?: string;
  items: CreateRequisitionItemInput[];
}

export interface CreateRequisitionItemInput {
  stockItemId: string;
  requestedQuantity: number;
}

export interface FulfillmentItem {
  stockItemId: string;
  fulfilledQuantity: number;
}

export interface RequisitionSearchQuery {
  requestingWarehouseId?: string;
  sourceWarehouseId?: string;
  status?: RequisitionStatus;
  requestedById?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export interface InsufficientStockItem {
  stockItemId: string;
  stockItemName: string;
  requestedQuantity: number;
  availableQuantity: number;
}

// Valid requisition statuses for validation
const VALID_REQUISITION_STATUSES: RequisitionStatus[] = [
  "PENDING",
  "APPROVED",
  "PARTIALLY_FULFILLED",
  "FULFILLED",
  "REJECTED",
];

/**
 * Validate requisition status enum
 * Property 15: Requisition Status Validation
 * For any requisition status value, it SHALL be one of: PENDING, APPROVED, PARTIALLY_FULFILLED, FULFILLED, or REJECTED.
 */
function isValidRequisitionStatus(status: string): status is RequisitionStatus {
  return VALID_REQUISITION_STATUSES.includes(status as RequisitionStatus);
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new requisition
 * Requirements: 4.1, 4.2
 * 
 * Property 14: Requisition Required Fields
 * For any requisition creation, it SHALL have non-null values for: requestingWarehouseId, sourceWarehouseId,
 * requestedById, and at least one item with stockItemId and requestedQuantity > 0.
 */
export async function createRequisition(data: CreateRequisitionInput) {
  // Property 14: Validate required fields
  if (!data.requestingWarehouseId || data.requestingWarehouseId.trim() === "") {
    return { error: "Requesting warehouse ID is required" };
  }

  if (!data.sourceWarehouseId || data.sourceWarehouseId.trim() === "") {
    return { error: "Source warehouse ID is required" };
  }

  if (!data.requestedById || data.requestedById.trim() === "") {
    return { error: "Requested by user ID is required" };
  }

  // Property 14: Validate at least one item
  if (!data.items || data.items.length === 0) {
    return { error: "At least one item is required" };
  }

  // Validate each item has required fields
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    if (!item.stockItemId || item.stockItemId.trim() === "") {
      return { error: `Item ${i + 1}: Stock item ID is required` };
    }
    if (item.requestedQuantity === undefined || item.requestedQuantity === null) {
      return { error: `Item ${i + 1}: Requested quantity is required` };
    }
    if (item.requestedQuantity <= 0) {
      return { error: `Item ${i + 1}: Requested quantity must be greater than zero` };
    }
  }

  // Validate warehouses are different
  if (data.requestingWarehouseId === data.sourceWarehouseId) {
    return { error: "Requesting and source warehouses must be different" };
  }

  try {
    // Verify requesting warehouse exists and is active
    const requestingWarehouse = await db.warehouse.findUnique({
      where: { id: data.requestingWarehouseId },
    });

    if (!requestingWarehouse) {
      return { error: "Requesting warehouse not found" };
    }

    if (!requestingWarehouse.isActive) {
      return { error: "Requesting warehouse is not active" };
    }

    // Verify source warehouse exists and is active
    const sourceWarehouse = await db.warehouse.findUnique({
      where: { id: data.sourceWarehouseId },
    });

    if (!sourceWarehouse) {
      return { error: "Source warehouse not found" };
    }

    if (!sourceWarehouse.isActive) {
      return { error: "Source warehouse is not active" };
    }

    // Verify all stock items exist
    const stockItemIds = data.items.map((item) => item.stockItemId);
    const stockItems = await db.stockItem.findMany({
      where: { id: { in: stockItemIds } },
      select: { id: true, name: true },
    });

    const foundIds = new Set(stockItems.map((item) => item.id));
    const missingIds = stockItemIds.filter((id) => !foundIds.has(id));

    if (missingIds.length > 0) {
      return { error: `Stock items not found: ${missingIds.join(", ")}` };
    }

    // Create requisition with items
    const requisition = await db.requisition.create({
      data: {
        requestingWarehouseId: data.requestingWarehouseId,
        sourceWarehouseId: data.sourceWarehouseId,
        requestedById: data.requestedById,
        notes: data.notes || null,
        status: "PENDING",
        items: {
          create: data.items.map((item) => ({
            stockItemId: item.stockItemId,
            requestedQuantity: item.requestedQuantity,
            fulfilledQuantity: 0,
          })),
        },
      },
      include: {
        requestingWarehouse: {
          select: { id: true, name: true, type: true },
        },
        sourceWarehouse: {
          select: { id: true, name: true, type: true },
        },
        items: {
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                sku: true,
                primaryUnit: { select: { abbreviation: true } },
              },
            },
          },
        },
      },
    });

    revalidatePath("/admin/inventory/requisitions");
    return { success: true, data: requisition };
  } catch (error) {
    console.error("Create Requisition Error:", error);
    return { error: "Failed to create requisition" };
  }
}

/**
 * Get a requisition by ID
 */
export async function getRequisitionById(id: string) {
  try {
    const requisition = await db.requisition.findUnique({
      where: { id },
      include: {
        requestingWarehouse: {
          select: { id: true, name: true, type: true },
        },
        sourceWarehouse: {
          select: { id: true, name: true, type: true },
        },
        items: {
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                sku: true,
                category: true,
                primaryUnit: { select: { abbreviation: true } },
              },
            },
          },
        },
      },
    });

    return requisition;
  } catch (error) {
    console.error("Get Requisition Error:", error);
    return null;
  }
}

/**
 * Get requisitions with optional filtering
 * Requirements: 1.1, 1.2
 * 
 * Property 1: Property Scope Filtering
 * For any data query executed while a user has a specific property selected,
 * all returned records SHALL belong to that property.
 */
export async function getRequisitions(query?: RequisitionSearchQuery) {
  try {
    const where: Prisma.RequisitionWhereInput = {};

    // Apply property context filtering through warehouse relation (Requirements 1.1, 1.2)
    // If no specific warehouse is provided, filter by property context
    if (!query?.requestingWarehouseId && !query?.sourceWarehouseId) {
      const propertyFilter = await getPropertyFilter();
      if (propertyFilter.propertyId) {
        where.OR = [
          { requestingWarehouse: { propertyId: propertyFilter.propertyId } },
          { sourceWarehouse: { propertyId: propertyFilter.propertyId } },
        ];
      }
    }

    if (query?.requestingWarehouseId) {
      where.requestingWarehouseId = query.requestingWarehouseId;
    }

    if (query?.sourceWarehouseId) {
      where.sourceWarehouseId = query.sourceWarehouseId;
    }

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.requestedById) {
      where.requestedById = query.requestedById;
    }

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

    const [requisitions, total] = await Promise.all([
      db.requisition.findMany({
        where,
        include: {
          requestingWarehouse: {
            select: { id: true, name: true, type: true },
          },
          sourceWarehouse: {
            select: { id: true, name: true, type: true },
          },
          items: {
            include: {
              stockItem: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  primaryUnit: { select: { abbreviation: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.requisition.count({ where }),
    ]);

    return {
      requisitions,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Get Requisitions Error:", error);
    return {
      requisitions: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    };
  }
}

/**
 * Get requisitions by warehouse (either requesting or source)
 */
export async function getRequisitionsByWarehouse(
  warehouseId: string,
  status?: RequisitionStatus
) {
  try {
    const where: Prisma.RequisitionWhereInput = {
      OR: [
        { requestingWarehouseId: warehouseId },
        { sourceWarehouseId: warehouseId },
      ],
    };

    if (status) {
      where.status = status;
    }

    const requisitions = await db.requisition.findMany({
      where,
      include: {
        requestingWarehouse: {
          select: { id: true, name: true, type: true },
        },
        sourceWarehouse: {
          select: { id: true, name: true, type: true },
        },
        items: {
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                sku: true,
                primaryUnit: { select: { abbreviation: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return requisitions;
  } catch (error) {
    console.error("Get Requisitions By Warehouse Error:", error);
    return [];
  }
}

// ============================================================================
// Status Transition Operations
// ============================================================================

/**
 * Approve a requisition
 * Requirements: 4.2, 4.3
 */
export async function approveRequisition(id: string, approverId: string) {
  if (!id || id.trim() === "") {
    return { error: "Requisition ID is required" };
  }

  if (!approverId || approverId.trim() === "") {
    return { error: "Approver ID is required" };
  }

  try {
    // Get current requisition
    const requisition = await db.requisition.findUnique({
      where: { id },
    });

    if (!requisition) {
      return { error: "Requisition not found" };
    }

    // Validate status transition: only PENDING can be approved
    if (requisition.status !== "PENDING") {
      return {
        error: `Cannot approve requisition with status '${requisition.status}'. Only PENDING requisitions can be approved.`,
      };
    }

    // Update status to APPROVED
    const updated = await db.requisition.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedById: approverId,
      },
      include: {
        requestingWarehouse: {
          select: { id: true, name: true, type: true },
        },
        sourceWarehouse: {
          select: { id: true, name: true, type: true },
        },
        items: {
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                sku: true,
                primaryUnit: { select: { abbreviation: true } },
              },
            },
          },
        },
      },
    });

    revalidatePath("/admin/inventory/requisitions");
    revalidatePath(`/admin/inventory/requisitions/${id}`);
    return { success: true, data: updated };
  } catch (error) {
    console.error("Approve Requisition Error:", error);
    return { error: "Failed to approve requisition" };
  }
}

/**
 * Reject a requisition
 * Requirements: 4.2
 */
export async function rejectRequisition(
  id: string,
  approverId: string,
  reason: string
) {
  if (!id || id.trim() === "") {
    return { error: "Requisition ID is required" };
  }

  if (!approverId || approverId.trim() === "") {
    return { error: "Approver ID is required" };
  }

  if (!reason || reason.trim() === "") {
    return { error: "Rejection reason is required" };
  }

  try {
    // Get current requisition
    const requisition = await db.requisition.findUnique({
      where: { id },
    });

    if (!requisition) {
      return { error: "Requisition not found" };
    }

    // Validate status transition: only PENDING can be rejected
    if (requisition.status !== "PENDING") {
      return {
        error: `Cannot reject requisition with status '${requisition.status}'. Only PENDING requisitions can be rejected.`,
      };
    }

    // Update status to REJECTED
    const updated = await db.requisition.update({
      where: { id },
      data: {
        status: "REJECTED",
        approvedById: approverId,
        rejectionReason: reason.trim(),
      },
      include: {
        requestingWarehouse: {
          select: { id: true, name: true, type: true },
        },
        sourceWarehouse: {
          select: { id: true, name: true, type: true },
        },
        items: {
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                sku: true,
                primaryUnit: { select: { abbreviation: true } },
              },
            },
          },
        },
      },
    });

    revalidatePath("/admin/inventory/requisitions");
    revalidatePath(`/admin/inventory/requisitions/${id}`);
    return { success: true, data: updated };
  } catch (error) {
    console.error("Reject Requisition Error:", error);
    return { error: "Failed to reject requisition" };
  }
}


// ============================================================================
// Fulfillment Operations
// ============================================================================

/**
 * Fulfill a requisition (partial or full)
 * Requirements: 4.3, 4.4, 4.5
 * 
 * Property 16: Requisition Fulfillment Creates Transfers
 * For any requisition fulfillment of quantity Q for item I, the system SHALL create exactly one
 * stock transfer record moving Q units of item I from the source warehouse to the requesting warehouse.
 * 
 * Property 17: Insufficient Stock Fulfillment Error
 * For any requisition fulfillment attempt where the requested quantity exceeds available stock
 * in the source warehouse, the system SHALL return an error containing the available quantity
 * for each insufficient item.
 */
export async function fulfillRequisition(
  id: string,
  items: FulfillmentItem[],
  fulfilledById: string
) {
  if (!id || id.trim() === "") {
    return { error: "Requisition ID is required" };
  }

  if (!fulfilledById || fulfilledById.trim() === "") {
    return { error: "Fulfilled by user ID is required" };
  }

  if (!items || items.length === 0) {
    return { error: "At least one fulfillment item is required" };
  }

  // Validate fulfillment items
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item.stockItemId || item.stockItemId.trim() === "") {
      return { error: `Item ${i + 1}: Stock item ID is required` };
    }
    if (item.fulfilledQuantity === undefined || item.fulfilledQuantity === null) {
      return { error: `Item ${i + 1}: Fulfilled quantity is required` };
    }
    if (item.fulfilledQuantity < 0) {
      return { error: `Item ${i + 1}: Fulfilled quantity cannot be negative` };
    }
  }

  try {
    // Get requisition with items
    const requisition = await db.requisition.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            stockItem: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
        sourceWarehouse: {
          select: { id: true, name: true, isActive: true },
        },
        requestingWarehouse: {
          select: { id: true, name: true, isActive: true },
        },
      },
    });

    if (!requisition) {
      return { error: "Requisition not found" };
    }

    // Validate status transition: only APPROVED or PARTIALLY_FULFILLED can be fulfilled
    if (requisition.status !== "APPROVED" && requisition.status !== "PARTIALLY_FULFILLED") {
      return {
        error: `Cannot fulfill requisition with status '${requisition.status}'. Only APPROVED or PARTIALLY_FULFILLED requisitions can be fulfilled.`,
      };
    }

    // Validate warehouses are still active
    if (!requisition.sourceWarehouse.isActive) {
      return { error: "Source warehouse is no longer active" };
    }

    if (!requisition.requestingWarehouse.isActive) {
      return { error: "Requesting warehouse is no longer active" };
    }

    // Build a map of requisition items for quick lookup
    const requisitionItemMap = new Map(
      requisition.items.map((item) => [item.stockItemId, item])
    );

    // Validate all fulfillment items exist in the requisition
    for (const item of items) {
      if (!requisitionItemMap.has(item.stockItemId)) {
        return {
          error: `Stock item '${item.stockItemId}' is not part of this requisition`,
        };
      }
    }

    // Check stock availability in source warehouse
    // Property 17: Return error with available quantities if insufficient
    const insufficientItems: InsufficientStockItem[] = [];

    for (const item of items) {
      if (item.fulfilledQuantity === 0) continue; // Skip zero quantity items

      const requisitionItem = requisitionItemMap.get(item.stockItemId)!;
      const remainingToFulfill = new Decimal(requisitionItem.requestedQuantity.toString())
        .sub(new Decimal(requisitionItem.fulfilledQuantity.toString()));

      // Validate fulfilled quantity doesn't exceed remaining
      if (new Decimal(item.fulfilledQuantity).greaterThan(remainingToFulfill)) {
        return {
          error: `Cannot fulfill ${item.fulfilledQuantity} of '${requisitionItem.stockItem.name}'. Only ${remainingToFulfill.toNumber()} remaining to fulfill.`,
        };
      }

      // Check stock level in source warehouse
      const stockLevel = await db.stockLevel.findUnique({
        where: {
          stockItemId_warehouseId: {
            stockItemId: item.stockItemId,
            warehouseId: requisition.sourceWarehouseId,
          },
        },
      });

      const availableQuantity = stockLevel ? Number(stockLevel.quantity) : 0;

      if (availableQuantity < item.fulfilledQuantity) {
        insufficientItems.push({
          stockItemId: item.stockItemId,
          stockItemName: requisitionItem.stockItem.name,
          requestedQuantity: item.fulfilledQuantity,
          availableQuantity,
        });
      }
    }

    // Property 17: Return error with available quantities
    if (insufficientItems.length > 0) {
      return {
        error: "Insufficient stock for some items",
        insufficientItems,
      };
    }

    // Use transaction to ensure atomicity
    const result = await db.$transaction(async (tx) => {
      const transfers: Array<{ out: unknown; in: unknown }> = [];

      // Process each fulfillment item
      for (const item of items) {
        if (item.fulfilledQuantity === 0) continue; // Skip zero quantity items

        const requisitionItem = requisitionItemMap.get(item.stockItemId)!;

        // Get current stock level in source warehouse
        const sourceStockLevel = await tx.stockLevel.findUnique({
          where: {
            stockItemId_warehouseId: {
              stockItemId: item.stockItemId,
              warehouseId: requisition.sourceWarehouseId,
            },
          },
        });

        if (!sourceStockLevel) {
          throw new Error(`No stock available for item '${requisitionItem.stockItem.name}' in source warehouse`);
        }

        const sourceQuantity = new Decimal(sourceStockLevel.quantity.toString());
        const transferQuantity = new Decimal(item.fulfilledQuantity);
        const sourceAvgCost = new Decimal(sourceStockLevel.averageCost.toString());

        // Validate sufficient stock
        if (sourceQuantity.lessThan(transferQuantity)) {
          throw new Error(
            `Insufficient stock for '${requisitionItem.stockItem.name}'. Available: ${sourceQuantity.toNumber()}, Requested: ${item.fulfilledQuantity}`
          );
        }

        // Get current stock level in destination warehouse (if exists)
        const destStockLevel = await tx.stockLevel.findUnique({
          where: {
            stockItemId_warehouseId: {
              stockItemId: item.stockItemId,
              warehouseId: requisition.requestingWarehouseId,
            },
          },
        });

        // Calculate new quantities
        const newSourceQuantity = sourceQuantity.sub(transferQuantity);

        // Calculate weighted average cost for destination
        const destQuantity = destStockLevel
          ? new Decimal(destStockLevel.quantity.toString())
          : new Decimal(0);
        const destAvgCost = destStockLevel
          ? new Decimal(destStockLevel.averageCost.toString())
          : new Decimal(0);

        const totalDestValue = destQuantity.mul(destAvgCost);
        const transferValue = transferQuantity.mul(sourceAvgCost);
        const newDestQuantity = destQuantity.add(transferQuantity);

        const newDestAvgCost = newDestQuantity.isZero()
          ? sourceAvgCost
          : totalDestValue.add(transferValue).div(newDestQuantity);

        // Update source stock level
        await tx.stockLevel.update({
          where: {
            stockItemId_warehouseId: {
              stockItemId: item.stockItemId,
              warehouseId: requisition.sourceWarehouseId,
            },
          },
          data: {
            quantity: newSourceQuantity.toDecimalPlaces(3).toNumber(),
          },
        });

        // Update or create destination stock level
        await tx.stockLevel.upsert({
          where: {
            stockItemId_warehouseId: {
              stockItemId: item.stockItemId,
              warehouseId: requisition.requestingWarehouseId,
            },
          },
          update: {
            quantity: newDestQuantity.toDecimalPlaces(3).toNumber(),
            averageCost: newDestAvgCost.toDecimalPlaces(4).toNumber(),
          },
          create: {
            stockItemId: item.stockItemId,
            warehouseId: requisition.requestingWarehouseId,
            quantity: transferQuantity.toDecimalPlaces(3).toNumber(),
            averageCost: sourceAvgCost.toDecimalPlaces(4).toNumber(),
          },
        });

        const totalCost = transferQuantity.mul(sourceAvgCost).toDecimalPlaces(2).toNumber();

        // Property 16: Create stock transfer records
        // Create TRANSFER_OUT movement
        const outMovement = await tx.stockMovement.create({
          data: {
            stockItemId: item.stockItemId,
            sourceWarehouseId: requisition.sourceWarehouseId,
            destinationWarehouseId: requisition.requestingWarehouseId,
            type: "TRANSFER_OUT",
            quantity: item.fulfilledQuantity,
            unitCost: sourceAvgCost.toDecimalPlaces(4).toNumber(),
            totalCost: totalCost,
            referenceType: "REQUISITION",
            referenceId: requisition.id,
            createdById: fulfilledById,
          },
        });

        // Create TRANSFER_IN movement
        const inMovement = await tx.stockMovement.create({
          data: {
            stockItemId: item.stockItemId,
            sourceWarehouseId: requisition.sourceWarehouseId,
            destinationWarehouseId: requisition.requestingWarehouseId,
            type: "TRANSFER_IN",
            quantity: item.fulfilledQuantity,
            unitCost: sourceAvgCost.toDecimalPlaces(4).toNumber(),
            totalCost: totalCost,
            referenceType: "REQUISITION",
            referenceId: requisition.id,
            createdById: fulfilledById,
          },
        });

        transfers.push({ out: outMovement, in: inMovement });

        // Update requisition item fulfilled quantity
        const newFulfilledQuantity = new Decimal(requisitionItem.fulfilledQuantity.toString())
          .add(transferQuantity)
          .toDecimalPlaces(3)
          .toNumber();

        await tx.requisitionItem.update({
          where: { id: requisitionItem.id },
          data: { fulfilledQuantity: newFulfilledQuantity },
        });
      }

      // Determine new requisition status
      // Get updated requisition items to check fulfillment status
      const updatedItems = await tx.requisitionItem.findMany({
        where: { requisitionId: requisition.id },
      });

      let allFulfilled = true;
      let anyFulfilled = false;

      for (const item of updatedItems) {
        const requested = new Decimal(item.requestedQuantity.toString());
        const fulfilled = new Decimal(item.fulfilledQuantity.toString());

        if (fulfilled.greaterThan(0)) {
          anyFulfilled = true;
        }

        if (fulfilled.lessThan(requested)) {
          allFulfilled = false;
        }
      }

      // Update requisition status
      let newStatus: RequisitionStatus;
      if (allFulfilled) {
        newStatus = "FULFILLED";
      } else if (anyFulfilled) {
        newStatus = "PARTIALLY_FULFILLED";
      } else {
        newStatus = requisition.status; // Keep current status if nothing fulfilled
      }

      const updatedRequisition = await tx.requisition.update({
        where: { id },
        data: { status: newStatus },
        include: {
          requestingWarehouse: {
            select: { id: true, name: true, type: true },
          },
          sourceWarehouse: {
            select: { id: true, name: true, type: true },
          },
          items: {
            include: {
              stockItem: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  primaryUnit: { select: { abbreviation: true } },
                },
              },
            },
          },
        },
      });

      return { requisition: updatedRequisition, transfers };
    });

    revalidatePath("/admin/inventory/requisitions");
    revalidatePath(`/admin/inventory/requisitions/${id}`);
    revalidatePath("/admin/inventory");
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes("Insufficient stock") ||
        error.message.includes("No stock available")
      ) {
        return { error: error.message };
      }
    }
    console.error("Fulfill Requisition Error:", error);
    return { error: "Failed to fulfill requisition" };
  }
}

/**
 * Get pending requisitions for a source warehouse (for approval queue)
 */
export async function getPendingRequisitionsForApproval(sourceWarehouseId: string) {
  try {
    const requisitions = await db.requisition.findMany({
      where: {
        sourceWarehouseId,
        status: "PENDING",
      },
      include: {
        requestingWarehouse: {
          select: { id: true, name: true, type: true },
        },
        sourceWarehouse: {
          select: { id: true, name: true, type: true },
        },
        items: {
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                sku: true,
                primaryUnit: { select: { abbreviation: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" }, // Oldest first
    });

    return requisitions;
  } catch (error) {
    console.error("Get Pending Requisitions Error:", error);
    return [];
  }
}

/**
 * Get approved requisitions ready for fulfillment
 */
export async function getRequisitionsForFulfillment(sourceWarehouseId: string) {
  try {
    const requisitions = await db.requisition.findMany({
      where: {
        sourceWarehouseId,
        status: { in: ["APPROVED", "PARTIALLY_FULFILLED"] },
      },
      include: {
        requestingWarehouse: {
          select: { id: true, name: true, type: true },
        },
        sourceWarehouse: {
          select: { id: true, name: true, type: true },
        },
        items: {
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                sku: true,
                primaryUnit: { select: { abbreviation: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" }, // Oldest first
    });

    return requisitions;
  } catch (error) {
    console.error("Get Requisitions For Fulfillment Error:", error);
    return [];
  }
}

/**
 * Check stock availability for a requisition
 * Returns available quantities for each item in the source warehouse
 */
export async function checkRequisitionStockAvailability(requisitionId: string) {
  try {
    const requisition = await db.requisition.findUnique({
      where: { id: requisitionId },
      include: {
        items: {
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                sku: true,
                primaryUnit: { select: { abbreviation: true } },
              },
            },
          },
        },
      },
    });

    if (!requisition) {
      return { error: "Requisition not found" };
    }

    const availability = await Promise.all(
      requisition.items.map(async (item) => {
        const stockLevel = await db.stockLevel.findUnique({
          where: {
            stockItemId_warehouseId: {
              stockItemId: item.stockItemId,
              warehouseId: requisition.sourceWarehouseId,
            },
          },
        });

        const availableQuantity = stockLevel ? Number(stockLevel.quantity) : 0;
        const requestedQuantity = Number(item.requestedQuantity);
        const fulfilledQuantity = Number(item.fulfilledQuantity);
        const remainingToFulfill = requestedQuantity - fulfilledQuantity;

        return {
          stockItemId: item.stockItemId,
          stockItemName: item.stockItem.name,
          stockItemSku: item.stockItem.sku,
          unit: item.stockItem.primaryUnit.abbreviation,
          requestedQuantity,
          fulfilledQuantity,
          remainingToFulfill,
          availableQuantity,
          canFulfill: availableQuantity >= remainingToFulfill,
          maxFulfillable: Math.min(availableQuantity, remainingToFulfill),
        };
      })
    );

    return { success: true, data: availability };
  } catch (error) {
    console.error("Check Requisition Stock Availability Error:", error);
    return { error: "Failed to check stock availability" };
  }
}
