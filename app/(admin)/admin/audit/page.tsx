import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AuditLogClient } from "./audit-log-client";

export default async function AdminAuditPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  // Get users for the filter dropdown
  const users = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: { name: "asc" },
  });

  // Get initial audit logs (first page)
  const pageSize = 50;
  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
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
      take: pageSize,
    }),
    db.auditLog.count(),
  ]);

  // Transform logs for the client component
  const logsData = logs.map((log) => ({
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

  const initialPagination = {
    page: 1,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground">
          Track all system changes with detailed before/after values.
        </p>
      </div>

      <AuditLogClient
        initialLogs={logsData}
        initialPagination={initialPagination}
        users={users}
      />
    </div>
  );
}
