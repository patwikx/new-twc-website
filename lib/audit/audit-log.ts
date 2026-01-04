"use server";

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  AuditAction,
  AuditEntityType,
  AuditLogInput,
  AuditLogFilters,
  AuditLogContext,
  AuditLogValidationResult,
  validateAuditLogCompletenessPure,
  validateAuditLogValueCapturePure,
  hasValueChangedPure,
  extractChangedFields,
  createAuditSnapshot,
} from "./audit-utils";

// Re-export types for convenience
export type {
  AuditAction,
  AuditEntityType,
  AuditLogInput,
  AuditLogFilters,
  AuditLogContext,
  AuditLogValidationResult,
} from "./audit-utils";

// Note: Pure validation functions are NOT re-exported here because "use server" 
// files can only export async functions. Import them directly from "./audit-utils"
// for property-based testing or client-side validation.

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Create an audit log entry
 * 
 * Requirements: 12.1, 12.2
 * 
 * Property 16: Audit Log Completeness
 * For any inventory operation (create, update, delete), an AuditLog record SHALL be created
 * with the correct action, entity type, entity ID, and user ID.
 * 
 * Property 17: Audit Log Value Capture
 * For any update operation, the AuditLog SHALL contain the old values before the update
 * and new values after the update.
 */
export async function logAction(params: AuditLogInput) {
  // Validate completeness
  const completenessResult = validateAuditLogCompletenessPure({
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    oldValues: params.oldValues,
    newValues: params.newValues,
  });

  if (!completenessResult.valid) {
    return { error: completenessResult.error };
  }

  // Validate value capture for update operations
  const valueCaptureResult = validateAuditLogValueCapturePure({
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    oldValues: params.oldValues,
    newValues: params.newValues,
  });

  if (!valueCaptureResult.valid) {
    return { error: valueCaptureResult.error };
  }

  try {
    const auditLog = await db.auditLog.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldValues: params.oldValues ? (params.oldValues as Prisma.InputJsonValue) : Prisma.JsonNull,
        newValues: params.newValues ? (params.newValues as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });

    return { success: true, data: auditLog };
  } catch (error) {
    console.error("Audit Log Error:", error);
    // Audit logging should not block operations, so we return error but don't throw
    return { error: "Failed to create audit log entry" };
  }
}

/**
 * Get audit logs with filtering
 * 
 * Requirements: 12.3
 */
export async function getAuditLogs(filters?: AuditLogFilters) {
  try {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.entityType) {
      where.entityType = filters.entityType;
    }

    if (filters?.entityId) {
      where.entityId = filters.entityId;
    }

    if (filters?.action) {
      where.action = filters.action;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.auditLog.count({ where }),
    ]);

    return {
      success: true,
      data: {
        logs,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    };
  } catch (error) {
    console.error("Get Audit Logs Error:", error);
    return { error: "Failed to retrieve audit logs" };
  }
}

/**
 * Get audit history for a specific entity
 * 
 * Requirements: 12.3
 */
export async function getEntityHistory(entityType: AuditEntityType, entityId: string) {
  try {
    if (!entityType || !entityId) {
      return { error: "Entity type and ID are required" };
    }

    const logs = await db.auditLog.findMany({
      where: {
        entityType,
        entityId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: logs };
  } catch (error) {
    console.error("Get Entity History Error:", error);
    return { error: "Failed to retrieve entity history" };
  }
}

/**
 * Get recent audit logs for a user
 */
export async function getUserAuditLogs(userId: string, limit: number = 50) {
  try {
    if (!userId) {
      return { error: "User ID is required" };
    }

    const logs = await db.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return { success: true, data: logs };
  } catch (error) {
    console.error("Get User Audit Logs Error:", error);
    return { error: "Failed to retrieve user audit logs" };
  }
}

/**
 * Batch create audit logs (for bulk operations)
 */
export async function logBatchActions(entries: AuditLogInput[]) {
  try {
    const validEntries = entries.filter((entry) => {
      const completenessResult = validateAuditLogCompletenessPure({
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        oldValues: entry.oldValues,
        newValues: entry.newValues,
      });
      return completenessResult.valid;
    });

    if (validEntries.length === 0) {
      return { success: true, data: { created: 0 } };
    }

    const result = await db.auditLog.createMany({
      data: validEntries.map((entry) => ({
        userId: entry.userId || null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        oldValues: entry.oldValues ? (entry.oldValues as Prisma.InputJsonValue) : Prisma.JsonNull,
        newValues: entry.newValues ? (entry.newValues as Prisma.InputJsonValue) : Prisma.JsonNull,
        ipAddress: entry.ipAddress || null,
        userAgent: entry.userAgent || null,
      })),
    });

    return { success: true, data: { created: result.count } };
  } catch (error) {
    console.error("Batch Audit Log Error:", error);
    return { error: "Failed to create batch audit log entries" };
  }
}
