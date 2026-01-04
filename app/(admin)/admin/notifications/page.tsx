import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { NotificationList } from "@/components/admin/notifications/notification-list";

export default async function NotificationsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  const userId = session.user.id;
  const pageSize = 50;

  // Get initial notifications
  const [notifications, total] = await Promise.all([
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: pageSize,
    }),
    db.notification.count({ where: { userId } }),
  ]);

  // Transform notifications for the client component
  const notificationsData = notifications.map((notification) => ({
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    data: notification.data as Record<string, unknown> | null,
    isRead: notification.isRead,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  }));

  const initialPagination = {
    page: 1,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground">
          View and manage all your notifications.
        </p>
      </div>

      <NotificationList
        userId={userId}
        initialNotifications={notificationsData}
        initialPagination={initialPagination}
      />
    </div>
  );
}
