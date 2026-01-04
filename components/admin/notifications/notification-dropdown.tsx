"use client";

import { useState, useEffect, useTransition } from "react";
import { Bell, Check, CheckCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { NotificationType } from "@prisma/client";
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
} from "@/lib/notifications/notification";

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

interface NotificationDropdownProps {
  userId: string;
}

const notificationTypeIcons: Record<NotificationType, string> = {
  LOW_STOCK: "📦",
  PO_APPROVAL: "📋",
  REQUISITION_STATUS: "📝",
  CYCLE_COUNT_REMINDER: "🔄",
  EXPIRING_BATCH: "⏰",
  ORDER_READY: "🍽️",
  SYSTEM: "⚙️",
};

const notificationTypeColors: Record<NotificationType, string> = {
  LOW_STOCK: "text-orange-500",
  PO_APPROVAL: "text-blue-500",
  REQUISITION_STATUS: "text-purple-500",
  CYCLE_COUNT_REMINDER: "text-cyan-500",
  EXPIRING_BATCH: "text-red-500",
  ORDER_READY: "text-green-500",
  SYSTEM: "text-gray-500",
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

export function NotificationDropdown({ userId }: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Fetch notifications and unread count
  const fetchNotifications = async () => {
    const [notifResult, countResult] = await Promise.all([
      getUserNotifications(userId, false, 1, 10),
      getUnreadCount(userId),
    ]);

    if (notifResult.success && notifResult.data) {
      setNotifications(notifResult.data.notifications as Notification[]);
    }
    if (countResult.success && countResult.data) {
      setUnreadCount(countResult.data.count);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  // Refresh when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const handleMarkAsRead = async (notificationId: string) => {
    startTransition(async () => {
      const result = await markAsRead(notificationId);
      if (result.success) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, isRead: true, readAt: new Date() } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
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
        setUnreadCount(0);
      }
    });
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-xs"
              onClick={handleMarkAllAsRead}
              disabled={isPending}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No notifications
            </div>
          ) : (
            notifications.map((notification) => {
              const link = getNotificationLink(notification);
              return (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn(
                    "flex flex-col items-start gap-1 p-3 cursor-pointer",
                    !notification.isRead && "bg-muted/50"
                  )}
                  onClick={() => {
                    if (!notification.isRead) {
                      handleMarkAsRead(notification.id);
                    }
                  }}
                >
                  <div className="flex items-start justify-between w-full gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {notificationTypeIcons[notification.type]}
                      </span>
                      <span
                        className={cn(
                          "font-medium text-sm",
                          notificationTypeColors[notification.type]
                        )}
                      >
                        {notification.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {!notification.isRead && (
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                      )}
                      {link && (
                        <Link
                          href={link}
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {notification.message}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </DropdownMenuItem>
              );
            })
          )}
        </ScrollArea>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="justify-center">
          <Link href="/admin/notifications" className="w-full text-center text-sm">
            View all notifications
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
