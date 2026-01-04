"use server";

import { db } from "@/lib/db";
import { POStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import { logPurchaseOrderCreate, logPurchaseOrderStatusChange, logPOReceipt } from "@/lib/audit/inventory-audit";
import { isValidStatusTransition } from "./purchase-order-utils";
import { getPropertyFilter } from "@/lib/property-context";

// Types
export interface CreatePurchaseOrderInput {
  propertyId: string;
  supplierId: string;
  warehouseId: string;
  expectedDate?: Date;
  notes?: string;
  createdById: string;
}

export interface AddPOItemInput {
  purchaseOrderId: string;
  stockItemId: string;
  quantity: number;
  unitCost: number;
}

export interface UpdatePOItemInput {
  itemId: string;
  quantity?: number;
  unitCost?: number;
}

export interface ReceivePOInput {
  purchaseOrderId: string;
  receivedById: string;
  notes?: string;
  items: ReceivePOItemInput[];
}

export interface ReceivePOItemInput {
  stockItemId: string;
  quantity: number;
  batchNumber?: string;
  expirationDate?: Date;
}

export interface PurchaseOrderQuery {
  propertyId?: string;
  supplierId?: string;
  warehouseId?: string;
  status?: POStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

/**
 * Generate a unique PO number
 * Format: PO-YYYYMMDD-XXXX (e.g., PO-20260104-0001)
 * Property 12: Purchase Order Number Uniqueness
 */
export async function generatePONumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `PO-${dateStr}-`;

  // Find the highest PO number for today
  const latestPO = await db.purchaseOrder.findFirst({
    where: {
      poNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      poNumber: "desc",
    },
    select: {
      poNumber: true,
    },
  });

  let sequence = 1;
  if (latestPO) {
    const lastSequence = parseInt(latestPO.poNumber.slice(-4), 10);
    sequence = lastSequence + 1;
  }

  return `${prefix}${sequence.toString().padStart(4, "0")}`;
}

// ============================================================================
// Purchase Order CRUD Operations
// ============================================================================

/**
 * Create a new purchase order
 * Requirements: 9.1
 */
export async function createPurchaseOrder(data: CreatePurchaseOrderInput) {
  // Validate required fields
  if (!data.propertyId || data.propertyId.trim() === "") {
    return { error: "Property ID is required" };
  }

  if (!data.supplierId || data.supplierId.trim() === "") {
    return { error: "Supplier ID is required" };
  }

  if (!data.warehouseId || data.warehouseId.trim() === "") {
    return { error: "Warehouse ID is required" };
  }

  if (!data.createdById || data.createdById.trim() === "") {
    return { error: "Created by user ID is required" };
  }

  try {
    // Verify property exists
    const property = await db.property.findUnique({
      where: { id: data.propertyId },
    });

    if (!property) {
      return { error: "Property not found" };
    }

    // Verify supplier exists and is active
    const supplier = await db.supplier.findUnique({
      where: { id: data.supplierId },
    });

    if (!supplier) {
      return { error: "Supplier not found" };
    }

    if (!supplier.isActive) {
      return { error: "Cannot create PO for inactive supplier" };
    }

    // Verify warehouse exists and is active
    const warehouse = await db.warehouse.findUnique({
      where: { id: data.warehouseId },
    });

    if (!warehouse) {
      return { error: "Warehouse not found" };
    }

    if (!warehouse.isActive) {
      return { error: "Cannot create PO for inactive warehouse" };
    }

    // Generate unique PO number
    const poNumber = await generatePONumber();

    // Create the purchase order
    const purchaseOrder = await db.purchaseOrder.create({
      data: {
        poNumber,
        propertyId: data.propertyId,
        supplierId: data.supplierId,
        warehouseId: data.warehouseId,
        status: "DRAFT",
        expectedDate: data.expectedDate || null,
        notes: data.notes || null,
        subtotal: 0,
        taxAmount: 0,
        total: 0,
        createdById: data.createdById,
      },
      include: {
        property: {
          select: { id: true, name: true },
        },
        supplier: {
          select: { id: true, name: true },
        },
        warehouse: {
          select: { id: true, name: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        items: {
          include: {
            stockItem: {
              select: { id: true, name: true, itemCode: true },
            },
          },
        },
      },
    });

    // Log the PO creation for audit trail
    await logPurchaseOrderCreate({
      userId: data.createdById,
      purchaseOrderId: purchaseOrder.id,
      poData: {
        poNumber: purchaseOrder.poNumber,
        propertyId: data.propertyId,
        supplierId: data.supplierId,
        warehouseId: data.warehouseId,
        status: purchaseOrder.status,
        expectedDate: data.expectedDate,
      },
    });

    revalidatePath("/admin/inventory/purchase-orders");
    return { success: true, data: purchaseOrder };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { error: "A purchase order with this number already exists" };
      }
    }
    console.error("Create Purchase Order Error:", error);
    return { error: "Failed to create purchase order" };
  }
}

/**
 * Get a purchase order by ID
 */
export async function getPurchaseOrder(id: string) {
  try {
    const purchaseOrder = await db.purchaseOrder.findUnique({
      where: { id },
      include: {
        property: {
          select: { id: true, name: true },
        },
        supplier: {
          select: { id: true, name: true, email: true, phone: true },
        },
        warehouse: {
          select: { id: true, name: true, type: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        approvedBy: {
          select: { id: true, name: true, email: true },
        },
        items: {
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                itemCode: true,
                primaryUnit: {
                  select: { abbreviation: true },
                },
              },
            },
          },
        },
        receipts: {
          include: {
            receivedBy: {
              select: { id: true, name: true },
            },
            items: {
              include: {
                stockItem: {
                  select: { id: true, name: true },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!purchaseOrder) {
      return { error: "Purchase order not found" };
    }

    return { success: true, data: purchaseOrder };
  } catch (error) {
    console.error("Get Purchase Order Error:", error);
    return { error: "Failed to get purchase order" };
  }
}

/**
 * Get purchase orders with filtering
 * Requirements: 1.1, 1.2
 * 
 * Property 1: Property Scope Filtering
 * For any data query executed while a user has a specific property selected,
 * all returned records SHALL belong to that property.
 */
export async function getPurchaseOrders(query?: PurchaseOrderQuery) {
  try {
    const where: Prisma.PurchaseOrderWhereInput = {};

    // Apply property context filtering (Requirements 1.1, 1.2)
    if (query?.propertyId) {
      where.propertyId = query.propertyId;
    } else {
      // Get property filter from context
      const propertyFilter = await getPropertyFilter();
      if (propertyFilter.propertyId) {
        where.propertyId = propertyFilter.propertyId;
      }
    }

    if (query?.supplierId) {
      where.supplierId = query.supplierId;
    }

    if (query?.warehouseId) {
      where.warehouseId = query.warehouseId;
    }

    if (query?.status) {
      where.status = query.status;
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

    const [purchaseOrders, total] = await Promise.all([
      db.purchaseOrder.findMany({
        where,
        include: {
          property: {
            select: { id: true, name: true },
          },
          supplier: {
            select: { id: true, name: true },
          },
          warehouse: {
            select: { id: true, name: true },
          },
          createdBy: {
            select: { id: true, name: true },
          },
          _count: {
            select: { items: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.purchaseOrder.count({ where }),
    ]);

    return {
      success: true,
      data: purchaseOrders,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Get Purchase Orders Error:", error);
    return { error: "Failed to get purchase orders" };
  }
}

/**
 * Update a purchase order
 */
export async function updatePurchaseOrder(
  id: string,
  data: {
    expectedDate?: Date;
    notes?: string;
  }
) {
  try {
    const purchaseOrder = await db.purchaseOrder.findUnique({
      where: { id },
    });

    if (!purchaseOrder) {
      return { error: "Purchase order not found" };
    }

    // Only allow updates in DRAFT status
    if (purchaseOrder.status !== "DRAFT") {
      return { error: "Can only update purchase orders in DRAFT status" };
    }

    const updated = await db.purchaseOrder.update({
      where: { id },
      data: {
        expectedDate: data.expectedDate,
        notes: data.notes,
      },
      include: {
        property: {
          select: { id: true, name: true },
        },
        supplier: {
          select: { id: true, name: true },
        },
        warehouse: {
          select: { id: true, name: true },
        },
        items: {
          include: {
            stockItem: {
              select: { id: true, name: true, itemCode: true },
            },
          },
        },
      },
    });

    revalidatePath("/admin/inventory/purchase-orders");
    return { success: true, data: updated };
  } catch (error) {
    console.error("Update Purchase Order Error:", error);
    return { error: "Failed to update purchase order" };
  }
}

// ============================================================================
// Purchase Order Item Operations
// ============================================================================

/**
 * Add an item to a purchase order
 * Requirements: 9.1
 */
export async function addPOItem(data: AddPOItemInput) {
  // Validate required fields
  if (!data.purchaseOrderId || data.purchaseOrderId.trim() === "") {
    return { error: "Purchase order ID is required" };
  }

  if (!data.stockItemId || data.stockItemId.trim() === "") {
    return { error: "Stock item ID is required" };
  }

  if (data.quantity === undefined || data.quantity === null || data.quantity <= 0) {
    return { error: "Quantity must be greater than zero" };
  }

  if (data.unitCost === undefined || data.unitCost === null || data.unitCost < 0) {
    return { error: "Unit cost cannot be negative" };
  }

  try {
    // Verify purchase order exists and is in DRAFT status
    const purchaseOrder = await db.purchaseOrder.findUnique({
      where: { id: data.purchaseOrderId },
    });

    if (!purchaseOrder) {
      return { error: "Purchase order not found" };
    }

    if (purchaseOrder.status !== "DRAFT") {
      return { error: "Can only add items to purchase orders in DRAFT status" };
    }

    // Verify stock item exists
    const stockItem = await db.stockItem.findUnique({
      where: { id: data.stockItemId },
    });

    if (!stockItem) {
      return { error: "Stock item not found" };
    }

    // Check if item already exists in PO
    const existingItem = await db.purchaseOrderItem.findFirst({
      where: {
        purchaseOrderId: data.purchaseOrderId,
        stockItemId: data.stockItemId,
      },
    });

    if (existingItem) {
      return { error: "Item already exists in this purchase order. Update the existing item instead." };
    }

    // Use transaction to add item and update totals
    const result = await db.$transaction(async (tx) => {
      // Create the PO item
      const poItem = await tx.purchaseOrderItem.create({
        data: {
          purchaseOrderId: data.purchaseOrderId,
          stockItemId: data.stockItemId,
          quantity: data.quantity,
          unitCost: data.unitCost,
          receivedQty: 0,
        },
        include: {
          stockItem: {
            select: {
              id: true,
              name: true,
              itemCode: true,
              primaryUnit: {
                select: { abbreviation: true },
              },
            },
          },
        },
      });

      // Recalculate PO totals
      const allItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: data.purchaseOrderId },
      });

      const subtotal = allItems.reduce((sum, item) => {
        return sum.add(new Decimal(item.quantity.toString()).mul(item.unitCost.toString()));
      }, new Decimal(0));

      // Update PO totals (assuming no tax for now, can be added later)
      await tx.purchaseOrder.update({
        where: { id: data.purchaseOrderId },
        data: {
          subtotal: subtotal.toDecimalPlaces(2).toNumber(),
          total: subtotal.toDecimalPlaces(2).toNumber(),
        },
      });

      return poItem;
    });

    revalidatePath("/admin/inventory/purchase-orders");
    return { success: true, data: result };
  } catch (error) {
    console.error("Add PO Item Error:", error);
    return { error: "Failed to add item to purchase order" };
  }
}

/**
 * Update a purchase order item
 * Requirements: 9.1
 */
export async function updatePOItem(data: UpdatePOItemInput) {
  if (!data.itemId || data.itemId.trim() === "") {
    return { error: "Item ID is required" };
  }

  if (data.quantity !== undefined && data.quantity <= 0) {
    return { error: "Quantity must be greater than zero" };
  }

  if (data.unitCost !== undefined && data.unitCost < 0) {
    return { error: "Unit cost cannot be negative" };
  }

  try {
    // Get the item and its PO
    const poItem = await db.purchaseOrderItem.findUnique({
      where: { id: data.itemId },
      include: {
        purchaseOrder: true,
      },
    });

    if (!poItem) {
      return { error: "Purchase order item not found" };
    }

    if (poItem.purchaseOrder.status !== "DRAFT") {
      return { error: "Can only update items in purchase orders with DRAFT status" };
    }

    // Use transaction to update item and recalculate totals
    const result = await db.$transaction(async (tx) => {
      // Update the item
      const updated = await tx.purchaseOrderItem.update({
        where: { id: data.itemId },
        data: {
          quantity: data.quantity,
          unitCost: data.unitCost,
        },
        include: {
          stockItem: {
            select: {
              id: true,
              name: true,
              itemCode: true,
              primaryUnit: {
                select: { abbreviation: true },
              },
            },
          },
        },
      });

      // Recalculate PO totals
      const allItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: poItem.purchaseOrderId },
      });

      const subtotal = allItems.reduce((sum, item) => {
        return sum.add(new Decimal(item.quantity.toString()).mul(item.unitCost.toString()));
      }, new Decimal(0));

      await tx.purchaseOrder.update({
        where: { id: poItem.purchaseOrderId },
        data: {
          subtotal: subtotal.toDecimalPlaces(2).toNumber(),
          total: subtotal.toDecimalPlaces(2).toNumber(),
        },
      });

      return updated;
    });

    revalidatePath("/admin/inventory/purchase-orders");
    return { success: true, data: result };
  } catch (error) {
    console.error("Update PO Item Error:", error);
    return { error: "Failed to update purchase order item" };
  }
}

/**
 * Remove an item from a purchase order
 * Requirements: 9.1
 */
export async function removePOItem(itemId: string) {
  if (!itemId || itemId.trim() === "") {
    return { error: "Item ID is required" };
  }

  try {
    // Get the item and its PO
    const poItem = await db.purchaseOrderItem.findUnique({
      where: { id: itemId },
      include: {
        purchaseOrder: true,
      },
    });

    if (!poItem) {
      return { error: "Purchase order item not found" };
    }

    if (poItem.purchaseOrder.status !== "DRAFT") {
      return { error: "Can only remove items from purchase orders with DRAFT status" };
    }

    // Use transaction to remove item and recalculate totals
    await db.$transaction(async (tx) => {
      // Delete the item
      await tx.purchaseOrderItem.delete({
        where: { id: itemId },
      });

      // Recalculate PO totals
      const remainingItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: poItem.purchaseOrderId },
      });

      const subtotal = remainingItems.reduce((sum, item) => {
        return sum.add(new Decimal(item.quantity.toString()).mul(item.unitCost.toString()));
      }, new Decimal(0));

      await tx.purchaseOrder.update({
        where: { id: poItem.purchaseOrderId },
        data: {
          subtotal: subtotal.toDecimalPlaces(2).toNumber(),
          total: subtotal.toDecimalPlaces(2).toNumber(),
        },
      });
    });

    revalidatePath("/admin/inventory/purchase-orders");
    return { success: true };
  } catch (error) {
    console.error("Remove PO Item Error:", error);
    return { error: "Failed to remove item from purchase order" };
  }
}


// ============================================================================
// Purchase Order Workflow Operations
// ============================================================================

/**
 * Submit a purchase order for approval
 * Requirements: 9.2
 * Property 13: PO Status Workflow Integrity
 */
export async function submitForApproval(purchaseOrderId: string) {
  if (!purchaseOrderId || purchaseOrderId.trim() === "") {
    return { error: "Purchase order ID is required" };
  }

  try {
    const purchaseOrder = await db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        items: true,
      },
    });

    if (!purchaseOrder) {
      return { error: "Purchase order not found" };
    }

    // Validate status transition
    if (!isValidStatusTransition(purchaseOrder.status, "PENDING_APPROVAL")) {
      return {
        error: `Cannot submit for approval from ${purchaseOrder.status} status`,
      };
    }

    // Validate PO has items
    if (purchaseOrder.items.length === 0) {
      return { error: "Cannot submit empty purchase order for approval" };
    }

    const updated = await db.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        status: "PENDING_APPROVAL",
      },
      include: {
        property: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        items: {
          include: {
            stockItem: {
              select: { id: true, name: true, itemCode: true },
            },
          },
        },
      },
    });

    revalidatePath("/admin/inventory/purchase-orders");
    return { success: true, data: updated };
  } catch (error) {
    console.error("Submit For Approval Error:", error);
    return { error: "Failed to submit purchase order for approval" };
  }
}

/**
 * Approve a purchase order
 * Requirements: 9.3
 * Property 13: PO Status Workflow Integrity
 */
export async function approvePO(purchaseOrderId: string, approverId: string) {
  if (!purchaseOrderId || purchaseOrderId.trim() === "") {
    return { error: "Purchase order ID is required" };
  }

  if (!approverId || approverId.trim() === "") {
    return { error: "Approver ID is required" };
  }

  try {
    const purchaseOrder = await db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
    });

    if (!purchaseOrder) {
      return { error: "Purchase order not found" };
    }

    // Validate status transition
    if (!isValidStatusTransition(purchaseOrder.status, "APPROVED")) {
      return {
        error: `Cannot approve from ${purchaseOrder.status} status`,
      };
    }

    const updated = await db.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        status: "APPROVED",
        approvedById: approverId,
        approvedAt: new Date(),
      },
      include: {
        property: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            stockItem: {
              select: { id: true, name: true, itemCode: true },
            },
          },
        },
      },
    });

    // Log the PO approval for audit trail
    await logPurchaseOrderStatusChange({
      userId: approverId,
      purchaseOrderId,
      action: "APPROVE",
      oldStatus: purchaseOrder.status,
      newStatus: "APPROVED",
    });

    revalidatePath("/admin/inventory/purchase-orders");
    return { success: true, data: updated };
  } catch (error) {
    console.error("Approve PO Error:", error);
    return { error: "Failed to approve purchase order" };
  }
}

/**
 * Reject a purchase order
 * Requirements: 9.3
 * Property 13: PO Status Workflow Integrity
 */
export async function rejectPO(purchaseOrderId: string, reason?: string) {
  if (!purchaseOrderId || purchaseOrderId.trim() === "") {
    return { error: "Purchase order ID is required" };
  }

  try {
    const purchaseOrder = await db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
    });

    if (!purchaseOrder) {
      return { error: "Purchase order not found" };
    }

    // Validate status transition (rejection goes back to DRAFT)
    if (!isValidStatusTransition(purchaseOrder.status, "DRAFT")) {
      return {
        error: `Cannot reject from ${purchaseOrder.status} status`,
      };
    }

    const updated = await db.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        status: "DRAFT",
        notes: reason
          ? `${purchaseOrder.notes || ""}\n[REJECTED]: ${reason}`.trim()
          : purchaseOrder.notes,
      },
      include: {
        property: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        items: {
          include: {
            stockItem: {
              select: { id: true, name: true, itemCode: true },
            },
          },
        },
      },
    });

    // Log the PO rejection for audit trail
    await logPurchaseOrderStatusChange({
      userId: purchaseOrder.createdById, // Use creator as fallback
      purchaseOrderId,
      action: "REJECT",
      oldStatus: purchaseOrder.status,
      newStatus: "DRAFT",
      reason,
    });

    revalidatePath("/admin/inventory/purchase-orders");
    return { success: true, data: updated };
  } catch (error) {
    console.error("Reject PO Error:", error);
    return { error: "Failed to reject purchase order" };
  }
}

/**
 * Send a purchase order to supplier
 * Requirements: 9.3
 * Property 13: PO Status Workflow Integrity
 */
export async function sendToSupplier(purchaseOrderId: string) {
  if (!purchaseOrderId || purchaseOrderId.trim() === "") {
    return { error: "Purchase order ID is required" };
  }

  try {
    const purchaseOrder = await db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
    });

    if (!purchaseOrder) {
      return { error: "Purchase order not found" };
    }

    // Validate status transition
    if (!isValidStatusTransition(purchaseOrder.status, "SENT")) {
      return {
        error: `Cannot send to supplier from ${purchaseOrder.status} status`,
      };
    }

    const updated = await db.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        status: "SENT",
        sentAt: new Date(),
      },
      include: {
        property: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true, email: true } },
        warehouse: { select: { id: true, name: true } },
        items: {
          include: {
            stockItem: {
              select: { id: true, name: true, itemCode: true },
            },
          },
        },
      },
    });

    revalidatePath("/admin/inventory/purchase-orders");
    return { success: true, data: updated };
  } catch (error) {
    console.error("Send To Supplier Error:", error);
    return { error: "Failed to send purchase order to supplier" };
  }
}

/**
 * Cancel a purchase order
 * Property 13: PO Status Workflow Integrity
 */
export async function cancelPO(purchaseOrderId: string, reason?: string) {
  if (!purchaseOrderId || purchaseOrderId.trim() === "") {
    return { error: "Purchase order ID is required" };
  }

  try {
    const purchaseOrder = await db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
    });

    if (!purchaseOrder) {
      return { error: "Purchase order not found" };
    }

    // Validate status transition
    if (!isValidStatusTransition(purchaseOrder.status, "CANCELLED")) {
      return {
        error: `Cannot cancel from ${purchaseOrder.status} status`,
      };
    }

    const updated = await db.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        status: "CANCELLED",
        notes: reason
          ? `${purchaseOrder.notes || ""}\n[CANCELLED]: ${reason}`.trim()
          : purchaseOrder.notes,
      },
      include: {
        property: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        items: {
          include: {
            stockItem: {
              select: { id: true, name: true, itemCode: true },
            },
          },
        },
      },
    });

    revalidatePath("/admin/inventory/purchase-orders");
    return { success: true, data: updated };
  } catch (error) {
    console.error("Cancel PO Error:", error);
    return { error: "Failed to cancel purchase order" };
  }
}

/**
 * Close a fully received purchase order
 * Property 13: PO Status Workflow Integrity
 */
export async function closePO(purchaseOrderId: string) {
  if (!purchaseOrderId || purchaseOrderId.trim() === "") {
    return { error: "Purchase order ID is required" };
  }

  try {
    const purchaseOrder = await db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
    });

    if (!purchaseOrder) {
      return { error: "Purchase order not found" };
    }

    // Validate status transition
    if (!isValidStatusTransition(purchaseOrder.status, "CLOSED")) {
      return {
        error: `Cannot close from ${purchaseOrder.status} status`,
      };
    }

    const updated = await db.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        status: "CLOSED",
      },
      include: {
        property: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        items: {
          include: {
            stockItem: {
              select: { id: true, name: true, itemCode: true },
            },
          },
        },
      },
    });

    revalidatePath("/admin/inventory/purchase-orders");
    return { success: true, data: updated };
  } catch (error) {
    console.error("Close PO Error:", error);
    return { error: "Failed to close purchase order" };
  }
}


// ============================================================================
// Purchase Order Receiving Operations
// ============================================================================

/**
 * Receive stock against a purchase order
 * Requirements: 9.4, 9.5, 9.6
 * Property 14: PO Receiving Quantity Consistency
 */
export async function receiveAgainstPO(data: ReceivePOInput) {
  if (!data.purchaseOrderId || data.purchaseOrderId.trim() === "") {
    return { error: "Purchase order ID is required" };
  }

  if (!data.receivedById || data.receivedById.trim() === "") {
    return { error: "Received by user ID is required" };
  }

  if (!data.items || data.items.length === 0) {
    return { error: "At least one item must be received" };
  }

  // Validate all items have positive quantities
  for (const item of data.items) {
    if (!item.stockItemId || item.stockItemId.trim() === "") {
      return { error: "Stock item ID is required for all items" };
    }
    if (item.quantity === undefined || item.quantity === null || item.quantity <= 0) {
      return { error: "Quantity must be greater than zero for all items" };
    }
  }

  try {
    const purchaseOrder = await db.purchaseOrder.findUnique({
      where: { id: data.purchaseOrderId },
      include: {
        items: true,
        warehouse: true,
      },
    });

    if (!purchaseOrder) {
      return { error: "Purchase order not found" };
    }

    // Validate PO is in a receivable status
    if (!["SENT", "PARTIALLY_RECEIVED"].includes(purchaseOrder.status)) {
      return {
        error: `Cannot receive against PO in ${purchaseOrder.status} status`,
      };
    }

    // Validate warehouse is active
    if (!purchaseOrder.warehouse.isActive) {
      return { error: "Cannot receive into inactive warehouse" };
    }

    // Validate received quantities don't exceed ordered quantities
    for (const receiveItem of data.items) {
      const poItem = purchaseOrder.items.find(
        (i) => i.stockItemId === receiveItem.stockItemId
      );

      if (!poItem) {
        return {
          error: `Stock item ${receiveItem.stockItemId} is not in this purchase order`,
        };
      }

      const orderedQty = new Decimal(poItem.quantity.toString());
      const alreadyReceivedQty = new Decimal(poItem.receivedQty.toString());
      const newReceiveQty = new Decimal(receiveItem.quantity);
      const totalReceivedQty = alreadyReceivedQty.add(newReceiveQty);

      // Property 14: receivedQty SHALL NOT exceed ordered quantity
      if (totalReceivedQty.greaterThan(orderedQty)) {
        return {
          error: `Cannot receive more than ordered. Item: ${receiveItem.stockItemId}, Ordered: ${orderedQty.toNumber()}, Already Received: ${alreadyReceivedQty.toNumber()}, Attempting to Receive: ${newReceiveQty.toNumber()}`,
        };
      }
    }

    // Use transaction for atomicity
    const result = await db.$transaction(async (tx) => {
      // Create PO Receipt
      const poReceipt = await tx.pOReceipt.create({
        data: {
          purchaseOrderId: data.purchaseOrderId,
          receivedById: data.receivedById,
          notes: data.notes || null,
        },
      });

      // Process each received item
      for (const receiveItem of data.items) {
        const poItem = purchaseOrder.items.find(
          (i) => i.stockItemId === receiveItem.stockItemId
        )!;

        // Create PO Receipt Item
        await tx.pOReceiptItem.create({
          data: {
            poReceiptId: poReceipt.id,
            stockItemId: receiveItem.stockItemId,
            quantity: receiveItem.quantity,
            batchNumber: receiveItem.batchNumber || null,
            expirationDate: receiveItem.expirationDate || null,
          },
        });

        // Update PO Item received quantity
        const newReceivedQty = new Decimal(poItem.receivedQty.toString())
          .add(receiveItem.quantity)
          .toDecimalPlaces(4)
          .toNumber();

        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: {
            receivedQty: newReceivedQty,
          },
        });

        // Get current stock level
        const currentStockLevel = await tx.stockLevel.findUnique({
          where: {
            stockItemId_warehouseId: {
              stockItemId: receiveItem.stockItemId,
              warehouseId: purchaseOrder.warehouseId,
            },
          },
        });

        // Calculate weighted average cost
        const currentQuantity = currentStockLevel
          ? new Decimal(currentStockLevel.quantity.toString())
          : new Decimal(0);
        const currentAvgCost = currentStockLevel
          ? new Decimal(currentStockLevel.averageCost.toString())
          : new Decimal(0);
        const newQuantity = new Decimal(receiveItem.quantity);
        const newUnitCost = new Decimal(poItem.unitCost.toString());

        const totalOldValue = currentQuantity.mul(currentAvgCost);
        const totalNewValue = newQuantity.mul(newUnitCost);
        const totalQuantity = currentQuantity.add(newQuantity);

        const newAvgCost = totalQuantity.isZero()
          ? newUnitCost
          : totalOldValue.add(totalNewValue).div(totalQuantity);

        // Update stock level
        await tx.stockLevel.upsert({
          where: {
            stockItemId_warehouseId: {
              stockItemId: receiveItem.stockItemId,
              warehouseId: purchaseOrder.warehouseId,
            },
          },
          update: {
            quantity: totalQuantity.toDecimalPlaces(3).toNumber(),
            averageCost: newAvgCost.toDecimalPlaces(4).toNumber(),
          },
          create: {
            stockItemId: receiveItem.stockItemId,
            warehouseId: purchaseOrder.warehouseId,
            quantity: newQuantity.toDecimalPlaces(3).toNumber(),
            averageCost: newUnitCost.toDecimalPlaces(4).toNumber(),
          },
        });

        // Create batch if batch number provided
        let batchId: string | undefined;
        if (receiveItem.batchNumber) {
          const batch = await tx.stockBatch.create({
            data: {
              stockItemId: receiveItem.stockItemId,
              warehouseId: purchaseOrder.warehouseId,
              batchNumber: receiveItem.batchNumber,
              quantity: receiveItem.quantity,
              unitCost: poItem.unitCost,
              expirationDate: receiveItem.expirationDate || null,
              isExpired: false,
            },
          });
          batchId = batch.id;
        }

        // Create stock movement
        const totalCost = newQuantity
          .mul(newUnitCost)
          .toDecimalPlaces(2)
          .toNumber();

        await tx.stockMovement.create({
          data: {
            stockItemId: receiveItem.stockItemId,
            destinationWarehouseId: purchaseOrder.warehouseId,
            batchId: batchId || null,
            type: "RECEIPT",
            quantity: receiveItem.quantity,
            unitCost: poItem.unitCost,
            totalCost: totalCost,
            referenceType: "PURCHASE_ORDER",
            referenceId: purchaseOrder.id,
            createdById: data.receivedById,
          },
        });
      }

      // Check if PO is fully received
      const updatedItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: data.purchaseOrderId },
      });

      const isFullyReceived = updatedItems.every((item) => {
        const ordered = new Decimal(item.quantity.toString());
        const received = new Decimal(item.receivedQty.toString());
        return received.greaterThanOrEqualTo(ordered);
      });

      const isPartiallyReceived = updatedItems.some((item) => {
        const received = new Decimal(item.receivedQty.toString());
        return received.greaterThan(0);
      });

      // Update PO status
      let newStatus: POStatus = purchaseOrder.status;
      if (isFullyReceived) {
        newStatus = "RECEIVED";
      } else if (isPartiallyReceived) {
        newStatus = "PARTIALLY_RECEIVED";
      }

      await tx.purchaseOrder.update({
        where: { id: data.purchaseOrderId },
        data: { status: newStatus },
      });

      return {
        receiptId: poReceipt.id,
        newStatus,
        isFullyReceived,
      };
    });

    // Log the PO receipt for audit trail
    await logPOReceipt({
      userId: data.receivedById,
      receiptId: result.receiptId,
      purchaseOrderId: data.purchaseOrderId,
      receiptData: {
        items: data.items,
        notes: data.notes,
        newStatus: result.newStatus,
        isFullyReceived: result.isFullyReceived,
      },
    });

    revalidatePath("/admin/inventory/purchase-orders");
    revalidatePath("/admin/inventory");
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return {
          error: "A batch with this number already exists for this item in this warehouse",
        };
      }
    }
    console.error("Receive Against PO Error:", error);
    return { error: "Failed to receive against purchase order" };
  }
}

/**
 * Get PO receipts for a purchase order
 */
export async function getPOReceipts(purchaseOrderId: string) {
  try {
    const receipts = await db.pOReceipt.findMany({
      where: { purchaseOrderId },
      include: {
        receivedBy: {
          select: { id: true, name: true, email: true },
        },
        items: {
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                itemCode: true,
                primaryUnit: {
                  select: { abbreviation: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: receipts };
  } catch (error) {
    console.error("Get PO Receipts Error:", error);
    return { error: "Failed to get PO receipts" };
  }
}

// ============================================================================
// Auto-Suggest Operations
// ============================================================================

/**
 * Get suggested PO items based on par levels
 * Requirements: 9.7
 */
export async function getSuggestedPOItems(warehouseId: string) {
  if (!warehouseId || warehouseId.trim() === "") {
    return { error: "Warehouse ID is required" };
  }

  try {
    // Get all stock items with par levels for this warehouse
    const parLevels = await db.stockParLevel.findMany({
      where: { warehouseId },
      include: {
        stockItem: {
          include: {
            primaryUnit: {
              select: { abbreviation: true },
            },
            supplier: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    // Get current stock levels for these items
    const stockLevels = await db.stockLevel.findMany({
      where: {
        warehouseId,
        stockItemId: {
          in: parLevels.map((p) => p.stockItemId),
        },
      },
    });

    const stockLevelMap = new Map(
      stockLevels.map((sl) => [sl.stockItemId, sl])
    );

    // Find items below par level
    const suggestedItems = parLevels
      .map((parLevel) => {
        const stockLevel = stockLevelMap.get(parLevel.stockItemId);
        const currentQty = stockLevel
          ? new Decimal(stockLevel.quantity.toString())
          : new Decimal(0);
        const parQty = new Decimal(parLevel.parLevel.toString());

        if (currentQty.lessThan(parQty)) {
          const suggestedQty = parQty.sub(currentQty);
          return {
            stockItemId: parLevel.stockItemId,
            stockItem: parLevel.stockItem,
            currentQuantity: currentQty.toNumber(),
            parLevel: parQty.toNumber(),
            suggestedQuantity: suggestedQty.toNumber(),
            supplierId: parLevel.stockItem.supplierId,
            supplier: parLevel.stockItem.supplier,
          };
        }
        return null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return { success: true, data: suggestedItems };
  } catch (error) {
    console.error("Get Suggested PO Items Error:", error);
    return { error: "Failed to get suggested PO items" };
  }
}
