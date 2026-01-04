"use server";

import { db } from "@/lib/db";
import {
  createRequisitionStatusNotification,
  createNotifications,
  NotificationInput,
} from "./notification";
import { NotificationType, RequisitionStatus } from "@prisma/client";

// ============================================================================
// Requisition Notifications
// ============================================================================

/**
 * Notify the requester when their requisition status changes
 * 
 * Requirements: 15.3
 */
export async function notifyRequisitionStatusChange(
  requisitionId: string,
  newStatus: RequisitionStatus
) {
  try {
    const requisition = await db.requisition.findUnique({
      where: { id: requisitionId },
      include: {
        requestingWarehouse: {
          select: {
            id: true,
            name: true,
          },
        },
        sourceWarehouse: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!requisition) {
      return { error: "Requisition not found" };
    }

    // Only notify for certain status changes
    const notifiableStatuses: RequisitionStatus[] = [
      "APPROVED",
      "REJECTED",
      "PARTIALLY_FULFILLED",
      "FULFILLED",
    ];

    if (!notifiableStatuses.includes(newStatus)) {
      return { success: true, notified: false, reason: "Status change does not require notification" };
    }

    const result = await createRequisitionStatusNotification(
      requisition.requestedById,
      requisition.id,
      newStatus,
      requisition.sourceWarehouse.name,
      requisition.requestingWarehouse.name
    );

    return result;
  } catch (error) {
    console.error("Notify Requisition Status Change Error:", error);
    return { error: "Failed to notify requisition status change" };
  }
}

/**
 * Notify source warehouse managers when a new requisition is created
 */
export async function notifyNewRequisition(requisitionId: string) {
  try {
    const requisition = await db.requisition.findUnique({
      where: { id: requisitionId },
      include: {
        requestingWarehouse: {
          select: {
            id: true,
            name: true,
          },
        },
        sourceWarehouse: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          select: {
            stockItem: {
              select: { name: true },
            },
            requestedQuantity: true,
          },
        },
      },
    });

    if (!requisition) {
      return { error: "Requisition not found" };
    }

    // Get users with MANAGE or ADMIN access to the source warehouse
    const userAccesses = await db.userWarehouseAccess.findMany({
      where: {
        warehouseId: requisition.sourceWarehouseId,
        accessLevel: { in: ["MANAGE", "ADMIN"] },
      },
      select: { userId: true },
    });

    if (userAccesses.length === 0) {
      return { success: true, notified: 0, reason: "No users with access to source warehouse" };
    }

    const itemCount = requisition.items.length;
    const itemSummary = itemCount === 1
      ? requisition.items[0].stockItem.name
      : `${itemCount} items`;

    const notifications: NotificationInput[] = userAccesses.map((access) => ({
      userId: access.userId,
      type: "REQUISITION_STATUS" as NotificationType,
      title: "New Requisition Request",
      message: `New requisition from ${requisition.requestingWarehouse.name} requesting ${itemSummary}`,
      data: {
        requisitionId: requisition.id,
        status: "PENDING",
        sourceWarehouseId: requisition.sourceWarehouse.id,
        sourceWarehouseName: requisition.sourceWarehouse.name,
        requestingWarehouseId: requisition.requestingWarehouse.id,
        requestingWarehouseName: requisition.requestingWarehouse.name,
        itemCount,
      },
    }));

    const result = await createNotifications(notifications);
    return result;
  } catch (error) {
    console.error("Notify New Requisition Error:", error);
    return { error: "Failed to notify about new requisition" };
  }
}

/**
 * Notify the requester when their requisition is approved
 */
export async function notifyRequisitionApproved(requisitionId: string) {
  return notifyRequisitionStatusChange(requisitionId, "APPROVED");
}

/**
 * Notify the requester when their requisition is rejected
 */
export async function notifyRequisitionRejected(
  requisitionId: string,
  rejectionReason?: string
) {
  try {
    const requisition = await db.requisition.findUnique({
      where: { id: requisitionId },
      include: {
        requestingWarehouse: {
          select: {
            id: true,
            name: true,
          },
        },
        sourceWarehouse: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!requisition) {
      return { error: "Requisition not found" };
    }

    const reasonText = rejectionReason ? ` Reason: ${rejectionReason}` : "";

    const result = await createRequisitionStatusNotification(
      requisition.requestedById,
      requisition.id,
      "REJECTED",
      requisition.sourceWarehouse.name,
      requisition.requestingWarehouse.name
    );

    // If there's a rejection reason, we might want to include it in the notification data
    // The createRequisitionStatusNotification function handles the basic notification
    // For more detailed rejection info, we could create a custom notification

    return result;
  } catch (error) {
    console.error("Notify Requisition Rejected Error:", error);
    return { error: "Failed to notify requisition rejection" };
  }
}

/**
 * Notify the requester when their requisition is partially fulfilled
 */
export async function notifyRequisitionPartiallyFulfilled(requisitionId: string) {
  return notifyRequisitionStatusChange(requisitionId, "PARTIALLY_FULFILLED");
}

/**
 * Notify the requester when their requisition is fully fulfilled
 */
export async function notifyRequisitionFulfilled(requisitionId: string) {
  return notifyRequisitionStatusChange(requisitionId, "FULFILLED");
}

/**
 * Notify requesting warehouse users when items are ready for pickup
 */
export async function notifyRequisitionReadyForPickup(requisitionId: string) {
  try {
    const requisition = await db.requisition.findUnique({
      where: { id: requisitionId },
      include: {
        requestingWarehouse: {
          select: {
            id: true,
            name: true,
          },
        },
        sourceWarehouse: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          where: {
            fulfilledQuantity: {
              gt: 0,
            },
          },
          select: {
            stockItem: {
              select: { name: true },
            },
            fulfilledQuantity: true,
          },
        },
      },
    });

    if (!requisition) {
      return { error: "Requisition not found" };
    }

    // Get users with access to the requesting warehouse
    const userAccesses = await db.userWarehouseAccess.findMany({
      where: {
        warehouseId: requisition.requestingWarehouseId,
        accessLevel: { in: ["MANAGE", "ADMIN"] },
      },
      select: { userId: true },
    });

    if (userAccesses.length === 0) {
      return { success: true, notified: 0, reason: "No users with access to requesting warehouse" };
    }

    const fulfilledItemCount = requisition.items.length;

    const notifications: NotificationInput[] = userAccesses.map((access) => ({
      userId: access.userId,
      type: "REQUISITION_STATUS" as NotificationType,
      title: "Requisition Items Ready",
      message: `${fulfilledItemCount} item(s) from your requisition are ready for pickup at ${requisition.sourceWarehouse.name}`,
      data: {
        requisitionId: requisition.id,
        sourceWarehouseId: requisition.sourceWarehouse.id,
        sourceWarehouseName: requisition.sourceWarehouse.name,
        requestingWarehouseId: requisition.requestingWarehouse.id,
        requestingWarehouseName: requisition.requestingWarehouse.name,
        fulfilledItemCount,
      },
    }));

    const result = await createNotifications(notifications);
    return result;
  } catch (error) {
    console.error("Notify Requisition Ready For Pickup Error:", error);
    return { error: "Failed to notify about requisition ready for pickup" };
  }
}
