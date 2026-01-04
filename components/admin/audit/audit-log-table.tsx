"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Package,
  ArrowRightLeft,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { format } from "date-fns";

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

interface AuditLogTableProps {
  logs: AuditLogData[];
  pagination: Pagination;
  onPageChange: (page: number) => void;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  CREATE: <Plus className="h-3.5 w-3.5" />,
  UPDATE: <Pencil className="h-3.5 w-3.5" />,
  DELETE: <Trash2 className="h-3.5 w-3.5" />,
  APPROVE: <Check className="h-3.5 w-3.5" />,
  REJECT: <X className="h-3.5 w-3.5" />,
  RECEIVE: <Package className="h-3.5 w-3.5" />,
  TRANSFER: <ArrowRightLeft className="h-3.5 w-3.5" />,
  ADJUST: <FileText className="h-3.5 w-3.5" />,
  WASTE: <AlertTriangle className="h-3.5 w-3.5" />,
  VOID: <X className="h-3.5 w-3.5" />,
  CANCEL: <X className="h-3.5 w-3.5" />,
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-500/20 text-green-400 border-green-500/30",
  UPDATE: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  DELETE: "bg-red-500/20 text-red-400 border-red-500/30",
  APPROVE: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  REJECT: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  RECEIVE: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  TRANSFER: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  ADJUST: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  WASTE: "bg-red-500/20 text-red-400 border-red-500/30",
  VOID: "bg-neutral-500/20 text-neutral-400 border-neutral-500/30",
  CANCEL: "bg-neutral-500/20 text-neutral-400 border-neutral-500/30",
};

function ValueDiff({ oldValues, newValues }: { oldValues: Record<string, unknown> | null; newValues: Record<string, unknown> | null }) {
  const allKeys = new Set([
    ...Object.keys(oldValues || {}),
    ...Object.keys(newValues || {}),
  ]);

  if (allKeys.size === 0) {
    return <span className="text-neutral-500 text-sm">No data recorded</span>;
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {Array.from(allKeys).map((key) => {
        const oldVal = oldValues?.[key];
        const newVal = newValues?.[key];
        const hasChanged = JSON.stringify(oldVal) !== JSON.stringify(newVal);

        return (
          <div key={key} className="border-b border-white/5 pb-2 last:border-0">
            <div className="text-xs font-medium text-neutral-400 mb-1">{key}</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className={`p-2 rounded ${hasChanged ? "bg-red-500/10" : "bg-neutral-800"}`}>
                <span className="text-xs text-neutral-500 block mb-1">Old</span>
                <span className="text-neutral-300 break-all">
                  {oldVal !== undefined ? JSON.stringify(oldVal, null, 2) : "—"}
                </span>
              </div>
              <div className={`p-2 rounded ${hasChanged ? "bg-green-500/10" : "bg-neutral-800"}`}>
                <span className="text-xs text-neutral-500 block mb-1">New</span>
                <span className="text-neutral-300 break-all">
                  {newVal !== undefined ? JSON.stringify(newVal, null, 2) : "—"}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AuditLogTable({ logs, pagination, onPageChange }: AuditLogTableProps) {
  const [selectedLog, setSelectedLog] = React.useState<AuditLogData | null>(null);

  return (
    <div className="w-full space-y-4">
      {/* Table */}
      <div className="rounded-md border border-white/10 bg-neutral-900/50">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-neutral-900/50">
              <TableHead className="w-[180px] pl-4 uppercase tracking-widest text-xs font-medium text-neutral-400">
                Timestamp
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                User
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Action
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Entity Type
              </TableHead>
              <TableHead className="uppercase tracking-widest text-xs font-medium text-neutral-400">
                Entity ID
              </TableHead>
              <TableHead className="text-right pr-4 uppercase tracking-widest text-xs font-medium text-neutral-400">
                Details
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No audit logs found.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow
                  key={log.id}
                  className="border-white/10 hover:bg-white/5"
                >
                  <TableCell className="pl-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm text-white">
                        {format(new Date(log.createdAt), "MMM d, yyyy")}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {format(new Date(log.createdAt), "HH:mm:ss")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm text-white">
                        {log.user?.name || "System"}
                      </span>
                      <span className="text-xs text-neutral-500">
                        {log.user?.email || "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`gap-1 ${ACTION_COLORS[log.action] || "bg-neutral-500/20 text-neutral-400 border-neutral-500/30"}`}
                    >
                      {ACTION_ICONS[log.action]}
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-neutral-300">
                      {log.entityType}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-neutral-500 font-mono">
                      {log.entityId.substring(0, 8)}...
                    </span>
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-white/10"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span className="sr-only">View Details</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-neutral-900 border-white/10 max-w-2xl">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`gap-1 ${ACTION_COLORS[log.action] || "bg-neutral-500/20 text-neutral-400 border-neutral-500/30"}`}
                            >
                              {ACTION_ICONS[log.action]}
                              {log.action}
                            </Badge>
                            <span>{log.entityType}</span>
                          </DialogTitle>
                          <DialogDescription>
                            {format(new Date(log.createdAt), "MMMM d, yyyy 'at' HH:mm:ss")}
                            {log.user && ` by ${log.user.name || log.user.email}`}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-neutral-500">Entity ID</span>
                              <p className="text-white font-mono text-xs mt-1 break-all">
                                {log.entityId}
                              </p>
                            </div>
                            <div>
                              <span className="text-neutral-500">IP Address</span>
                              <p className="text-white mt-1">
                                {log.ipAddress || "—"}
                              </p>
                            </div>
                          </div>
                          {log.userAgent && (
                            <div className="text-sm">
                              <span className="text-neutral-500">User Agent</span>
                              <p className="text-neutral-400 text-xs mt-1 break-all">
                                {log.userAgent}
                              </p>
                            </div>
                          )}
                          <div>
                            <span className="text-neutral-500 text-sm">Value Changes</span>
                            <div className="mt-2">
                              <ValueDiff
                                oldValues={log.oldValues}
                                newValues={log.newValues}
                              />
                            </div>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Showing <strong>{logs.length}</strong> of{" "}
          <strong>{pagination.total}</strong> audit logs.
          {pagination.totalPages > 1 && (
            <span className="ml-1">
              Page {pagination.page} of {pagination.totalPages}
            </span>
          )}
        </div>
        {pagination.totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="h-8 bg-neutral-900 border-white/10"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="h-8 bg-neutral-900 border-white/10"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
