import { NotificationType } from "@prisma/client";

// ============================================================================
// Types
// ============================================================================

/**
 * Input for creating a notification
 */
export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Filters for querying notifications
 */
export interface NotificationFilters {
  userId: string;
  type?: NotificationType;
  isRead?: boolean;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

/**
 * Result of notification validation
 */
export interface NotificationValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Context for pure validation functions
 */
export interface NotificationContext {
  userId: string;
  type: string;
  title: string;
  message: string;
}

/**
 * Context for notification read state validation
 */
export interface NotificationReadContext {
  isRead: boolean;
  readAt: Date | null;
}


// ============================================================================
// Pure Validation Functions (for property-based testing)
// ============================================================================

/**
 * Validate that a notification has all required fields
 * 
 * Property 20: Notification Creation on Events
 * For any triggering event (low stock, PO approval needed, requisition status change, expiring batch),
 * a notification SHALL be created for the appropriate users.
 */
export function validateNotificationCreationPure(
  context: NotificationContext
): NotificationValidationResult {
  // Validate userId is present and non-empty
  if (!context.userId || context.userId.trim() === "") {
    return { valid: false, error: "User ID is required" };
  }

  // Validate type is present and non-empty
  if (!context.type || context.type.trim() === "") {
    return { valid: false, error: "Notification type is required" };
  }

  // Validate title is present and non-empty
  if (!context.title || context.title.trim() === "") {
    return { valid: false, error: "Title is required" };
  }

  // Validate message is present and non-empty
  if (!context.message || context.message.trim() === "") {
    return { valid: false, error: "Message is required" };
  }

  return { valid: true };
}

/**
 * Validate notification read state consistency
 * 
 * Property 21: Notification Read State
 * For any notification marked as read, the isRead flag SHALL be true and readAt SHALL contain
 * the timestamp of when it was read.
 */
export function validateNotificationReadStatePure(
  context: NotificationReadContext
): NotificationValidationResult {
  // If isRead is true, readAt must be set
  if (context.isRead && !context.readAt) {
    return { valid: false, error: "readAt timestamp is required when isRead is true" };
  }

  // If isRead is false, readAt should be null
  if (!context.isRead && context.readAt) {
    return { valid: false, error: "readAt should be null when isRead is false" };
  }

  return { valid: true };
}

/**
 * Check if a notification type is valid for a given event
 */
export function isValidNotificationTypeForEvent(
  eventType: string,
  notificationType: NotificationType
): boolean {
  const eventToNotificationMap: Record<string, NotificationType[]> = {
    LOW_STOCK: ["LOW_STOCK"],
    PO_APPROVAL_NEEDED: ["PO_APPROVAL"],
    REQUISITION_STATUS_CHANGE: ["REQUISITION_STATUS"],
    EXPIRING_BATCH: ["EXPIRING_BATCH"],
    CYCLE_COUNT_REMINDER: ["CYCLE_COUNT_REMINDER"],
    ORDER_READY: ["ORDER_READY"],
    SYSTEM: ["SYSTEM"],
  };

  return eventToNotificationMap[eventType]?.includes(notificationType) ?? false;
}
