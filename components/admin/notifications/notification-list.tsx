"use client";

import { useState, useTransition } from "react";
import { Check, CheckCheck, Trash2, ExternalLink, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { NotificationType } from "@prisma/client";
import {
  markAsRead,
  markMultipleAsRead,
  markAllAsRead,
  deleteNotification,
  deleteReadNotifications,
  getUserNotifications,
} from "@/lib/notifications/notification";
import { toast } from "sonner";

interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface NotificationListProps {
  userId: string;
  initialNotifications: Notification[];
  initialPagination: Pagination;
}

const notificationTypeLabels: Record<NotificationType, string> = {
  LOW_STOCK: "Low Stock",
  PO_APPROVAL: "PO Approval",
  REQUISITION_STATUS: "Requisition",
  CYCLE_COUNT_REMINDER: "Cycle Count",
  EXPIRING_BATCH: "Expiring Batch",
  ORDER_READY: "Order Ready",
  SYSTEM: "System",
};

const notificationTypeColors: Record<NotificationType, string> = {
  LOW_STOCK: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  PO_APPROVAL: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  REQUISITION_STATUS: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  CYCLE_COUNT_REMINDER: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  EXPIRING_BATCH: "bg-red-500/10 text-red-500 border-red-500/20",
  ORDER_READY: "bg-green-500/10 text-green-500 border-green-500/20",
  SYSTEM: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

function getNotificationLink(notification: Notification): string | null {
  const data = notification.data;
  if (!data) return null;

  switch (notification.type) {
    case "LOW_STOCK":
      return data.stockItemId
        ? `/admin/inventory/items/${data.stockItemId}`
        : null;
    case "PO_APPROVAL":
      return data.purchaseOrderId
        ? `/admin/inventory/purchase-orders/${data.purchaseOrderId}`
        : null;
    case "REQUISITION_STATUS":
      return data.requisitionId
        ? `/admin/inventory/requisitions/${data.requisitionId}`
        : null;
    case "CYCLE_COUNT_REMINDER":
      return data.cycleCountId
        ? `/admin/inventory/cycle-counts/${data.cycleCountId}`
        : null;
    case "EXPIRING_BATCH":
      return data.stockItemId
        ? `/admin/inventory/items/${data.stockItemId}`
        : null;
    case "ORDER_READY":
      return data.orderId ? `/admin/pos` : null;
    default:
      return null;
  }
}

export function NotificationList({
  userId,
  initialNotifications,
  initialPagination,
}: NotificationListProps) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>("all");
  const [filterRead, setFilterRead] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  const filteredNotifications = notifications.filter((n) => {
    if (filterType !== "all" && n.type !== filterType) return false;
    if (filterRead === "unread" && n.isRead) return false;
    if (filterRead === "read" && !n.isRead) return false;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const fetchNotifications = async (page: number = 1) => {
    const result = await getUserNotifications(userId, false, page, pagination.pageSize);
    if (result.success && result.data) {
      setNotifications(result.data.notifications as Notification[]);
      setPagination(result.data.pagination);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredNotifications.map((n) => n.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleMarkAsRead = async (notificationId: string) => {
    startTransition(async () => {
      const result = await markAsRead(notificationId);
      if (result.success) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, isRead: true, readAt: new Date() } : n
          )
        );
        toast.success("Notification marked as read");
      } else {
        toast.error(result.error || "Failed to mark as read");
      }
    });
  };

  const handleMarkSelectedAsRead = async () => {
    if (selectedIds.size === 0) return;
    startTransition(async () => {
      const result = await markMultipleAsRead(Array.from(selectedIds));
      if (result.success) {
        setNotifications((prev) =>
          prev.map((n) =>
            selectedIds.has(n.id) ? { ...n, isRead: true, readAt: new Date() } : n
          )
        );
        setSelectedIds(new Set());
        toast.success(`${result.data?.updated || 0} notifications marked as read`);
      } else {
        toast.error(result.error || "Failed to mark as read");
      }
    });
  };

  const handleMarkAllAsRead = async () => {
    startTransition(async () => {
      const result = await markAllAsRead(userId);
      if (result.success) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true, readAt: new Date() }))
        );
        toast.success(`${result.data?.updated || 0} notifications marked as read`);
      } else {
        toast.error(result.error || "Failed to mark all as read");
      }
    });
  };

  const handleDelete = async (notificationId: string) => {
    startTransition(async () => {
      const result = await deleteNotification(notificationId);
      if (result.success) {
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        selectedIds.delete(notificationId);
        setSelectedIds(new Set(selectedIds));
        toast.success("Notification deleted");
      } else {
        toast.error(result.error || "Failed to delete notification");
      }
    });
  };

  const handleDeleteRead = async () => {
    startTransition(async () => {
      const result = await deleteReadNotifications(userId);
      if (result.success) {
        setNotifications((prev) => prev.filter((n) => !n.isRead));
        setSelectedIds(new Set());
        toast.success(`${result.data?.deleted || 0} read notifications deleted`);
      } else {
        toast.error(result.error || "Failed to delete read notifications");
      }
    });
  };

  const handlePageChange = (newPage: number) => {
    fetchNotifications(newPage);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">All Notifications</h2>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
              : "All caught up!"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={isPending}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all as read
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteRead}
            disabled={isPending || notifications.filter((n) => n.isRead).length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear read
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(notificationTypeLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Select value={filterRead} onValueChange={setFilterRead}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="read">Read</SelectItem>
          </SelectContent>
        </Select>
        {selectedIds.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkSelectedAsRead}
            disabled={isPending}
          >
            <Check className="h-4 w-4 mr-2" />
            Mark selected as read ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={
                    filteredNotifications.length > 0 &&
                    filteredNotifications.every((n) => selectedIds.has(n.id))
                  }
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="w-[120px]">Type</TableHead>
              <TableHead>Notification</TableHead>
              <TableHead className="w-[150px]">Date</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredNotifications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No notifications found
                </TableCell>
              </TableRow>
            ) : (
              filteredNotifications.map((notification) => {
                const link = getNotificationLink(notification);
                return (
                  <TableRow
                    key={notification.id}
                    className={cn(!notification.isRead && "bg-muted/30")}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(notification.id)}
                        onCheckedChange={(checked) =>
                          handleSelectOne(notification.id, checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          notificationTypeColors[notification.type]
                        )}
                      >
                        {notificationTypeLabels[notification.type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "font-medium",
                              !notification.isRead && "text-foreground"
                            )}
                          >
                            {notification.title}
                          </span>
                          {!notification.isRead && (
                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {notification.message}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span>
                          {format(new Date(notification.createdAt), "MMM d, yyyy")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {link && (
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={link}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleMarkAsRead(notification.id)}
                            disabled={isPending}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(notification.id)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
            {pagination.total} notifications
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || isPending}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || isPending}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
