import { db } from "@/lib/db";
import { CycleCountDetail } from "@/components/admin/inventory/cycle-count-detail";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { requirePermission, hasPermission } from "@/lib/auth-checks";

interface CycleCountDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CycleCountDetailPage({
  params,
}: CycleCountDetailPageProps) {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  // Check permission to view cycle counts
  await requirePermission("cycle-count:view");

  // Get user permissions for UI controls
  const permissions = {
    canCount: await hasPermission("cycle-count:count"),
    canApprove: await hasPermission("cycle-count:approve"),
    canCancel: await hasPermission("cycle-count:cancel"),
    canCreate: await hasPermission("cycle-count:create"),
  };

  const { id } = await params;

  // Get cycle count with all related data
  const cycleCount = await db.cycleCount.findUnique({
    where: { id },
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
      items: {
        include: {
          stockItem: {
            select: {
              id: true,
              name: true,
              itemCode: true,
              sku: true,
              primaryUnit: {
                select: {
                  id: true,
                  name: true,
                  abbreviation: true,
                },
              },
              category: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
            },
          },
          batch: {
            select: {
              id: true,
              batchNumber: true,
              expirationDate: true,
            },
          },
        },
        orderBy: [
          { stockItem: { category: { name: "asc" } } },
          { stockItem: { name: "asc" } },
        ],
      },
    },
  });

  if (!cycleCount) {
    notFound();
  }

  // Transform data for the component
  const cycleCountData = {
    id: cycleCount.id,
    countNumber: cycleCount.countNumber,
    type: cycleCount.type,
    status: cycleCount.status,
    blindCount: cycleCount.blindCount,
    scheduledAt: cycleCount.scheduledAt,
    startedAt: cycleCount.startedAt,
    completedAt: cycleCount.completedAt,
    createdById: cycleCount.createdById,
    approvedById: cycleCount.approvedById,
    notes: cycleCount.notes,
    totalItems: cycleCount.totalItems,
    itemsCounted: cycleCount.itemsCounted,
    itemsWithVariance: cycleCount.itemsWithVariance,
    totalVarianceCost: cycleCount.totalVarianceCost ? Number(cycleCount.totalVarianceCost) : null,
    accuracyPercent: cycleCount.accuracyPercent ? Number(cycleCount.accuracyPercent) : null,
    createdAt: cycleCount.createdAt,
    updatedAt: cycleCount.updatedAt,
    warehouse: cycleCount.warehouse,
    items: cycleCount.items.map((item) => ({
      id: item.id,
      stockItemId: item.stockItemId,
      batchId: item.batchId,
      systemQuantity: Number(item.systemQuantity),
      countedQuantity: item.countedQuantity !== null ? Number(item.countedQuantity) : null,
      variance: item.variance !== null ? Number(item.variance) : null,
      variancePercent: item.variancePercent !== null ? Number(item.variancePercent) : null,
      varianceCost: item.varianceCost !== null ? Number(item.varianceCost) : null,
      unitCost: item.unitCost !== null ? Number(item.unitCost) : null,
      countedById: item.countedById,
      countedAt: item.countedAt,
      notes: item.notes,
      adjustmentMade: item.adjustmentMade,
      adjustmentId: item.adjustmentId,
      stockItem: item.stockItem,
      batch: item.batch,
    })),
  };

  return (
    <div className="space-y-4">
      <CycleCountDetail
        cycleCount={cycleCountData}
        userId={session.user.id || ""}
        permissions={permissions}
      />
    </div>
  );
}
