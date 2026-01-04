import { db } from "@/lib/db";
import { CycleCountsTable } from "@/components/admin/inventory/cycle-counts-table";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requirePermission, hasPermission } from "@/lib/auth-checks";

export default async function CycleCountsPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  // Check permission to view cycle counts
  await requirePermission("cycle-count:view");

  // Get current property scope from cookie
  const cookieStore = await cookies();
  const currentScope = cookieStore.get("admin_property_scope")?.value || "ALL";

  // Get cycle counts (filtered by property scope through warehouse)
  const { cycleCounts } = await getCycleCounts(currentScope);

  // Get warehouses for filter dropdown
  const warehouses = await db.warehouse.findMany({
    where: {
      isActive: true,
      ...(currentScope !== "ALL" ? { propertyId: currentScope } : {}),
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  // Check permissions for actions
  const canCreate = await hasPermission("cycle-count:create");
  const canCount = await hasPermission("cycle-count:count");
  const canCancel = await hasPermission("cycle-count:cancel");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Cycle Counts</h1>
          <p className="text-sm text-neutral-400">
            Manage inventory cycle count sessions
          </p>
        </div>
      </div>

      <CycleCountsTable
        cycleCounts={cycleCounts}
        warehouses={warehouses}
        permissions={{
          canCreate,
          canCount,
          canCancel,
        }}
      />
    </div>
  );
}

async function getCycleCounts(propertyScope: string) {
  const cycleCounts = await db.cycleCount.findMany({
    where: {
      ...(propertyScope !== "ALL"
        ? { warehouse: { propertyId: propertyScope } }
        : {}),
    },
    include: {
      warehouse: {
        select: {
          id: true,
          name: true,
          type: true,
          property: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      _count: {
        select: {
          items: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  // Transform to match the expected interface
  return {
    cycleCounts: cycleCounts.map((cc) => ({
      id: cc.id,
      countNumber: cc.countNumber,
      type: cc.type,
      status: cc.status,
      blindCount: cc.blindCount,
      scheduledAt: cc.scheduledAt,
      startedAt: cc.startedAt,
      completedAt: cc.completedAt,
      totalItems: cc.totalItems,
      itemsCounted: cc.itemsCounted,
      itemsWithVariance: cc.itemsWithVariance,
      totalVarianceCost: cc.totalVarianceCost ? Number(cc.totalVarianceCost) : null,
      accuracyPercent: cc.accuracyPercent ? Number(cc.accuracyPercent) : null,
      createdAt: cc.createdAt,
      warehouse: cc.warehouse,
    })),
  };
}
