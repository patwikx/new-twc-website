"use client";

import * as React from "react";
import { AuditLogTable } from "@/components/admin/audit/audit-log-table";
import { AuditLogFilters, AuditLogFilterValues } from "@/components/admin/audit/audit-log-filters";
import { getAuditLogs, AuditEntityType, AuditAction } from "@/lib/audit/audit-log";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AuditLogUser {
  id: string;
  name: string | null;
  email: string | null;
}

interface AuditLogData {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  user: AuditLogUser | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface AuditLogClientProps {
  initialLogs: AuditLogData[];
  initialPagination: Pagination;
  users: AuditLogUser[];
}

export function AuditLogClient({
  initialLogs,
  initialPagination,
  users,
}: AuditLogClientProps) {
  const [logs, setLogs] = React.useState<AuditLogData[]>(initialLogs);
  const [pagination, setPagination] = React.useState<Pagination>(initialPagination);
  const [filters, setFilters] = React.useState<AuditLogFilterValues>({});
  const [isLoading, setIsLoading] = React.useState(false);

  const fetchLogs = React.useCallback(async (page: number, currentFilters: AuditLogFilterValues) => {
    setIsLoading(true);
    try {
      const result = await getAuditLogs({
        userId: currentFilters.userId,
        entityType: currentFilters.entityType as AuditEntityType | undefined,
        action: currentFilters.action as AuditAction | undefined,
        startDate: currentFilters.startDate,
        endDate: currentFilters.endDate,
        page,
        pageSize: pagination.pageSize,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.data) {
        const transformedLogs = result.data.logs.map((log) => ({
          id: log.id,
          userId: log.userId,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          oldValues: log.oldValues as Record<string, unknown> | null,
          newValues: log.newValues as Record<string, unknown> | null,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          createdAt: log.createdAt,
          user: log.user,
        }));
        setLogs(transformedLogs);
        setPagination(result.data.pagination);
      }
    } catch (error) {
      toast.error("Failed to fetch audit logs");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.pageSize]);

  const handleFiltersChange = React.useCallback((newFilters: AuditLogFilterValues) => {
    setFilters(newFilters);
    // Reset to page 1 when filters change
    fetchLogs(1, newFilters);
  }, [fetchLogs]);

  const handlePageChange = React.useCallback((page: number) => {
    fetchLogs(page, filters);
  }, [fetchLogs, filters]);

  const handleReset = React.useCallback(() => {
    setFilters({});
    fetchLogs(1, {});
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      <AuditLogFilters
        users={users}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onReset={handleReset}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
        </div>
      ) : (
        <AuditLogTable
          logs={logs}
          pagination={pagination}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
