"use server";

import { db } from "@/lib/db";
import { NotificationType, Prisma } from "@prisma/client";
import {
  NotificationInput,
  validateNotificationCreationPure,
  validateNotificationReadStatePure,
} from "./notification-utils";

// Re-export types only (types are allowed in "use server" files)
export type {
  NotificationInput,
  NotificationFilters,
  NotificationValidationResult,
  NotificationContext,
  NotificationReadContext,
} from "./notification-utils";

// Note: Pure validation functions are NOT re-exported here because "use server" 
// files can only export async functions. Import them directly from "./notification-utils"
// for property-based testing or client-side validation.


// ============================================================================
// Database Operations
// ============================================================================

/**
 * Create a notification
 * 
 * Requirements: 15.1, 15.2, 15.3, 15.4
 * 
 * Property 20: Notification Creation on Events
 * For any triggering event (low stock, PO approval needed, requisition status change, expiring batch),
 * a notification SHALL be created for the appropriate users.
 */
export async function createNotification(params: NotificationInput) {
  // Validate required fields
  const validationResult = validateNotificationCreationPure({
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
  });

  if (!validationResult.valid) {
    return { error: validationResult.error };
  }

  try {
    // Verify user exists
    const user = await db.user.findUnique({
      where: { id: params.userId },
      select: { id: true },
    });

    if (!user) {
      return { error: "User not found" };
    }

    const notification = await db.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        data: params.data ? (params.data as Prisma.InputJsonValue) : Prisma.JsonNull,
        isRead: false,
        readAt: null,
      },
    });

    return { success: true, data: notification };
  } catch (error) {
    console.error("Create Notification Error:", error);
    return { error: "Failed to create notification" };
  }
}

/**
 * Create multiple notifications at once (for batch operations)
 */
export async function createNotifications(notifications: NotificationInput[]) {
  try {
    // Validate all notifications
    for (const notification of notifications) {
      const validationResult = validateNotificationCreationPure({
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
      });

      if (!validationResult.valid) {
        return { error: validationResult.error };
      }
    }

    const result = await db.notification.createMany({
      data: notifications.map((n) => ({
        userId: n.userId,
        type: n.type,
        title: n.title,
        message: n.message,
        data: n.data ? (n.data as Prisma.InputJsonValue) : Prisma.JsonNull,
        isRead: false,
        readAt: null,
      })),
    });

    return { success: true, data: { created: result.count } };
  } catch (error) {
    console.error("Create Notifications Error:", error);
    return { error: "Failed to create notifications" };
  }
}

/**
 * Get notifications for a user
 * 
 * Requirements: 15.5, 15.6
 */
export async function getUserNotifications(
  userId: string,
  unreadOnly: boolean = false,
  page: number = 1,
  pageSize: number = 50
) {
  try {
    if (!userId || userId.trim() === "") {
      return { error: "User ID is required" };
    }

    const where: Prisma.NotificationWhereInput = {
      userId,
    };

    if (unreadOnly) {
      where.isRead = false;
    }

    const skip = (page - 1) * pageSize;

    const [notifications, total] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.notification.count({ where }),
    ]);

    return {
      success: true,
      data: {
        notifications,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    };
  } catch (error) {
    console.error("Get User Notifications Error:", error);
    return { error: "Failed to retrieve notifications" };
  }
}


/**
 * Mark a notification as read
 * 
 * Requirements: 15.6
 * 
 * Property 21: Notification Read State
 * For any notification marked as read, the isRead flag SHALL be true and readAt SHALL contain
 * the timestamp of when it was read.
 */
export async function markAsRead(notificationId: string) {
  try {
    if (!notificationId || notificationId.trim() === "") {
      return { error: "Notification ID is required" };
    }

    // Check if notification exists
    const existing = await db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!existing) {
      return { error: "Notification not found" };
    }

    // If already read, return success without updating
    if (existing.isRead) {
      return { success: true, data: existing };
    }

    const readAt = new Date();

    const notification = await db.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt,
      },
    });

    // Validate the read state consistency
    const readStateValidation = validateNotificationReadStatePure({
      isRead: notification.isRead,
      readAt: notification.readAt,
    });

    if (!readStateValidation.valid) {
      console.error("Read state validation failed:", readStateValidation.error);
    }

    return { success: true, data: notification };
  } catch (error) {
    console.error("Mark As Read Error:", error);
    return { error: "Failed to mark notification as read" };
  }
}

/**
 * Mark multiple notifications as read
 */
export async function markMultipleAsRead(notificationIds: string[]) {
  try {
    if (!notificationIds || notificationIds.length === 0) {
      return { error: "At least one notification ID is required" };
    }

    const readAt = new Date();

    const result = await db.notification.updateMany({
      where: {
        id: { in: notificationIds },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt,
      },
    });

    return { success: true, data: { updated: result.count } };
  } catch (error) {
    console.error("Mark Multiple As Read Error:", error);
    return { error: "Failed to mark notifications as read" };
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string) {
  try {
    if (!userId || userId.trim() === "") {
      return { error: "User ID is required" };
    }

    const readAt = new Date();

    const result = await db.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt,
      },
    });

    return { success: true, data: { updated: result.count } };
  } catch (error) {
    console.error("Mark All As Read Error:", error);
    return { error: "Failed to mark all notifications as read" };
  }
}

/**
 * Get unread notification count for a user
 * 
 * Requirements: 15.5
 */
export async function getUnreadCount(userId: string) {
  try {
    if (!userId || userId.trim() === "") {
      return { error: "User ID is required" };
    }

    const count = await db.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return { success: true, data: { count } };
  } catch (error) {
    console.error("Get Unread Count Error:", error);
    return { error: "Failed to get unread count" };
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string) {
  try {
    if (!notificationId || notificationId.trim() === "") {
      return { error: "Notification ID is required" };
    }

    await db.notification.delete({
      where: { id: notificationId },
    });

    return { success: true };
  } catch (error) {
    console.error("Delete Notification Error:", error);
    return { error: "Failed to delete notification" };
  }
}

/**
 * Delete all read notifications for a user (cleanup)
 */
export async function deleteReadNotifications(userId: string) {
  try {
    if (!userId || userId.trim() === "") {
      return { error: "User ID is required" };
    }

    const result = await db.notification.deleteMany({
      where: {
        userId,
        isRead: true,
      },
    });

    return { success: true, data: { deleted: result.count } };
  } catch (error) {
    console.error("Delete Read Notifications Error:", error);
    return { error: "Failed to delete read notifications" };
  }
}


// ============================================================================
// Event-Based Notification Helpers
// ============================================================================

/**
 * Create a LOW_STOCK notification
 * 
 * Requirements: 15.1
 */
export async function createLowStockNotification(
  userId: string,
  stockItemName: string,
  warehouseName: string,
  currentQuantity: number,
  parLevel: number,
  stockItemId: string,
  warehouseId: string
) {
  return createNotification({
    userId,
    type: "LOW_STOCK",
    title: "Low Stock Alert",
    message: `${stockItemName} in ${warehouseName} is below par level. Current: ${currentQuantity}, Par: ${parLevel}`,
    data: {
      stockItemId,
      stockItemName,
      warehouseId,
      warehouseName,
      currentQuantity,
      parLevel,
    },
  });
}

/**
 * Create a PO_APPROVAL notification
 * 
 * Requirements: 15.2
 */
export async function createPOApprovalNotification(
  userId: string,
  poNumber: string,
  supplierName: string,
  total: number,
  purchaseOrderId: string
) {
  return createNotification({
    userId,
    type: "PO_APPROVAL",
    title: "Purchase Order Requires Approval",
    message: `PO ${poNumber} from ${supplierName} (Total: ${total.toFixed(2)}) requires your approval`,
    data: {
      purchaseOrderId,
      poNumber,
      supplierName,
      total,
    },
  });
}

/**
 * Create a REQUISITION_STATUS notification
 * 
 * Requirements: 15.3
 */
export async function createRequisitionStatusNotification(
  userId: string,
  requisitionId: string,
  status: string,
  sourceWarehouseName: string,
  requestingWarehouseName: string
) {
  const statusMessages: Record<string, string> = {
    APPROVED: "has been approved",
    REJECTED: "has been rejected",
    PARTIALLY_FULFILLED: "has been partially fulfilled",
    FULFILLED: "has been fulfilled",
  };

  const statusMessage = statusMessages[status] || `status changed to ${status}`;

  return createNotification({
    userId,
    type: "REQUISITION_STATUS",
    title: "Requisition Status Update",
    message: `Your requisition from ${sourceWarehouseName} to ${requestingWarehouseName} ${statusMessage}`,
    data: {
      requisitionId,
      status,
      sourceWarehouseName,
      requestingWarehouseName,
    },
  });
}

/**
 * Create an EXPIRING_BATCH notification
 * 
 * Requirements: 15.4
 */
export async function createExpiringBatchNotification(
  userId: string,
  stockItemName: string,
  batchNumber: string,
  expirationDate: Date,
  warehouseName: string,
  stockItemId: string,
  batchId: string,
  warehouseId: string
) {
  const daysUntilExpiry = Math.ceil(
    (expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return createNotification({
    userId,
    type: "EXPIRING_BATCH",
    title: "Batch Expiring Soon",
    message: `${stockItemName} (Batch: ${batchNumber}) in ${warehouseName} expires in ${daysUntilExpiry} days`,
    data: {
      stockItemId,
      stockItemName,
      batchId,
      batchNumber,
      warehouseId,
      warehouseName,
      expirationDate: expirationDate.toISOString(),
      daysUntilExpiry,
    },
  });
}

/**
 * Create a CYCLE_COUNT_REMINDER notification
 */
export async function createCycleCountReminderNotification(
  userId: string,
  warehouseName: string,
  cycleCountId: string,
  warehouseId: string
) {
  return createNotification({
    userId,
    type: "CYCLE_COUNT_REMINDER",
    title: "Cycle Count Reminder",
    message: `A cycle count is scheduled for ${warehouseName}. Please complete the count.`,
    data: {
      cycleCountId,
      warehouseId,
      warehouseName,
    },
  });
}

/**
 * Create an ORDER_READY notification
 */
export async function createOrderReadyNotification(
  userId: string,
  orderNumber: string,
  tableNumber: string | null,
  orderId: string
) {
  const tableInfo = tableNumber ? ` for Table ${tableNumber}` : "";
  
  return createNotification({
    userId,
    type: "ORDER_READY",
    title: "Order Ready",
    message: `Order ${orderNumber}${tableInfo} is ready for service`,
    data: {
      orderId,
      orderNumber,
      tableNumber,
    },
  });
}

/**
 * Create a SYSTEM notification
 */
export async function createSystemNotification(
  userId: string,
  title: string,
  message: string,
  data?: Record<string, unknown>
) {
  return createNotification({
    userId,
    type: "SYSTEM",
    title,
    message,
    data,
  });
}

// ============================================================================
// Bulk Notification Helpers
// ============================================================================

/**
 * Notify all users with access to a warehouse about low stock
 */
export async function notifyWarehouseUsersLowStock(
  warehouseId: string,
  stockItemName: string,
  warehouseName: string,
  currentQuantity: number,
  parLevel: number,
  stockItemId: string
) {
  try {
    // Get all users with MANAGE or ADMIN access to this warehouse
    const userAccesses = await db.userWarehouseAccess.findMany({
      where: {
        warehouseId,
        accessLevel: { in: ["MANAGE", "ADMIN"] },
      },
      select: { userId: true },
    });

    if (userAccesses.length === 0) {
      return { success: true, data: { notified: 0 } };
    }

    const notifications: NotificationInput[] = userAccesses.map((access) => ({
      userId: access.userId,
      type: "LOW_STOCK" as NotificationType,
      title: "Low Stock Alert",
      message: `${stockItemName} in ${warehouseName} is below par level. Current: ${currentQuantity}, Par: ${parLevel}`,
      data: {
        stockItemId,
        stockItemName,
        warehouseId,
        warehouseName,
        currentQuantity,
        parLevel,
      },
    }));

    const result = await createNotifications(notifications);
    return result;
  } catch (error) {
    console.error("Notify Warehouse Users Low Stock Error:", error);
    return { error: "Failed to notify users about low stock" };
  }
}

/**
 * Notify approvers about a PO requiring approval
 */
export async function notifyPOApprovers(
  propertyId: string,
  poNumber: string,
  supplierName: string,
  total: number,
  purchaseOrderId: string
) {
  try {
    // Get users who can approve POs (users with appropriate role/permissions)
    // For now, we'll get all users who manage the property
    const property = await db.property.findUnique({
      where: { id: propertyId },
      include: {
        managers: {
          select: { id: true },
        },
      },
    });

    if (!property || property.managers.length === 0) {
      return { success: true, data: { notified: 0 } };
    }

    const notifications: NotificationInput[] = property.managers.map((manager) => ({
      userId: manager.id,
      type: "PO_APPROVAL" as NotificationType,
      title: "Purchase Order Requires Approval",
      message: `PO ${poNumber} from ${supplierName} (Total: ${total.toFixed(2)}) requires your approval`,
      data: {
        purchaseOrderId,
        poNumber,
        supplierName,
        total,
      },
    }));

    const result = await createNotifications(notifications);
    return result;
  } catch (error) {
    console.error("Notify PO Approvers Error:", error);
    return { error: "Failed to notify approvers" };
  }
}
