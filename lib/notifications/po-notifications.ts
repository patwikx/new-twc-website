"use server";

import { db } from "@/lib/db";
import {
  createPOApprovalNotification,
  createSystemNotification,
  createNotifications,
  NotificationInput,
} from "./notification";
import { NotificationType } from "@prisma/client";

// ============================================================================
// Purchase Order Notifications
// ============================================================================

/**
 * Notify approvers when a PO is submitted for approval
 * 
 * Requirements: 15.2
 */
export async function notifyPOSubmittedForApproval(purchaseOrderId: string) {
  try {
    // Get the purchase order with supplier and property info
    const po = await db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
            managers: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!po) {
      return { error: "Purchase order not found" };
    }

    if (!po.property.managers || po.property.managers.length === 0) {
      return { success: true, notified: 0, reason: "No managers found for property" };
    }

    // Create notifications for all property managers
    const notifications: NotificationInput[] = po.property.managers.map((manager) => ({
      userId: manager.id,
      type: "PO_APPROVAL" as NotificationType,
      title: "Purchase Order Requires Approval",
      message: `PO ${po.poNumber} from ${po.supplier.name} (Total: ${Number(po.total).toFixed(2)}) requires your approval`,
      data: {
        purchaseOrderId: po.id,
        poNumber: po.poNumber,
        supplierId: po.supplier.id,
        supplierName: po.supplier.name,
        total: Number(po.total),
        propertyId: po.property.id,
        propertyName: po.property.name,
      },
    }));

    const result = await createNotifications(notifications);
    return result;
  } catch (error) {
    console.error("Notify PO Submitted For Approval Error:", error);
    return { error: "Failed to notify approvers" };
  }
}

/**
 * Notify the PO creator when their PO is approved
 */
export async function notifyPOApproved(purchaseOrderId: string) {
  try {
    const po = await db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        supplier: {
          select: { name: true },
        },
        approvedBy: {
          select: { name: true },
        },
      },
    });

    if (!po) {
      return { error: "Purchase order not found" };
    }

    const approverName = po.approvedBy?.name || "A manager";

    const result = await createSystemNotification(
      po.createdById,
      "Purchase Order Approved",
      `Your PO ${po.poNumber} for ${po.supplier.name} has been approved by ${approverName}`,
      {
        purchaseOrderId: po.id,
        poNumber: po.poNumber,
        supplierName: po.supplier.name,
        status: "APPROVED",
      }
    );

    return result;
  } catch (error) {
    console.error("Notify PO Approved Error:", error);
    return { error: "Failed to notify PO creator" };
  }
}

/**
 * Notify the PO creator when their PO is rejected
 */
export async function notifyPORejected(
  purchaseOrderId: string,
  rejectionReason?: string
) {
  try {
    const po = await db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        supplier: {
          select: { name: true },
        },
      },
    });

    if (!po) {
      return { error: "Purchase order not found" };
    }

    const reasonText = rejectionReason ? ` Reason: ${rejectionReason}` : "";

    const result = await createSystemNotification(
      po.createdById,
      "Purchase Order Rejected",
      `Your PO ${po.poNumber} for ${po.supplier.name} has been rejected.${reasonText}`,
      {
        purchaseOrderId: po.id,
        poNumber: po.poNumber,
        supplierName: po.supplier.name,
        status: "REJECTED",
        rejectionReason,
      }
    );

    return result;
  } catch (error) {
    console.error("Notify PO Rejected Error:", error);
    return { error: "Failed to notify PO creator" };
  }
}

/**
 * Notify the PO creator when stock is received against their PO
 */
export async function notifyPOReceived(
  purchaseOrderId: string,
  isPartial: boolean = false
) {
  try {
    const po = await db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        supplier: {
          select: { name: true },
        },
      },
    });

    if (!po) {
      return { error: "Purchase order not found" };
    }

    const statusText = isPartial ? "partially received" : "fully received";

    const result = await createSystemNotification(
      po.createdById,
      isPartial ? "Purchase Order Partially Received" : "Purchase Order Received",
      `PO ${po.poNumber} from ${po.supplier.name} has been ${statusText}`,
      {
        purchaseOrderId: po.id,
        poNumber: po.poNumber,
        supplierName: po.supplier.name,
        status: isPartial ? "PARTIALLY_RECEIVED" : "RECEIVED",
      }
    );

    return result;
  } catch (error) {
    console.error("Notify PO Received Error:", error);
    return { error: "Failed to notify PO creator" };
  }
}

/**
 * Notify warehouse managers when a PO is sent to supplier
 */
export async function notifyPOSentToSupplier(purchaseOrderId: string) {
  try {
    const po = await db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        supplier: {
          select: { name: true },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!po) {
      return { error: "Purchase order not found" };
    }

    // Get users with MANAGE or ADMIN access to the warehouse
    const userAccesses = await db.userWarehouseAccess.findMany({
      where: {
        warehouseId: po.warehouseId,
        accessLevel: { in: ["MANAGE", "ADMIN"] },
      },
      select: { userId: true },
    });

    if (userAccesses.length === 0) {
      return { success: true, notified: 0, reason: "No users with access to warehouse" };
    }

    const notifications: NotificationInput[] = userAccesses.map((access) => ({
      userId: access.userId,
      type: "SYSTEM" as NotificationType,
      title: "Purchase Order Sent to Supplier",
      message: `PO ${po.poNumber} has been sent to ${po.supplier.name}. Expected delivery: ${po.expectedDate ? po.expectedDate.toLocaleDateString() : "Not specified"}`,
      data: {
        purchaseOrderId: po.id,
        poNumber: po.poNumber,
        supplierName: po.supplier.name,
        warehouseId: po.warehouse.id,
        warehouseName: po.warehouse.name,
        expectedDate: po.expectedDate?.toISOString(),
      },
    }));

    const result = await createNotifications(notifications);
    return result;
  } catch (error) {
    console.error("Notify PO Sent To Supplier Error:", error);
    return { error: "Failed to notify warehouse managers" };
  }
}
