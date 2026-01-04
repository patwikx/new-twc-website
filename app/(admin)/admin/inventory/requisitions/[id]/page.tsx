import { db } from "@/lib/db";
import { RequisitionDetail } from "@/components/admin/inventory/requisition-detail";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";

interface RequisitionDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function RequisitionDetailPage({
  params,
}: RequisitionDetailPageProps) {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  const { id } = await params;

  // Get requisition with all related data
  const requisition = await db.requisition.findUnique({
    where: { id },
    include: {
      requestingWarehouse: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      sourceWarehouse: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      items: {
        include: {
          stockItem: {
            select: {
              id: true,
              name: true,
              sku: true,
              primaryUnit: {
                select: {
                  abbreviation: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!requisition) {
    notFound();
  }

  // Get stock availability for each item in the source warehouse
  const stockItemIds = requisition.items.map((item) => item.stockItemId);
  const stockLevels = await db.stockLevel.findMany({
    where: {
      stockItemId: { in: stockItemIds },
      warehouseId: requisition.sourceWarehouseId,
    },
    select: {
      stockItemId: true,
      quantity: true,
    },
  });

  // Transform data for the component
  const requisitionData = {
    id: requisition.id,
    status: requisition.status,
    requestedById: requisition.requestedById,
    approvedById: requisition.approvedById,
    rejectionReason: requisition.rejectionReason,
    notes: requisition.notes,
    createdAt: requisition.createdAt,
    updatedAt: requisition.updatedAt,
    requestingWarehouse: requisition.requestingWarehouse,
    sourceWarehouse: requisition.sourceWarehouse,
    items: requisition.items.map((item) => ({
      id: item.id,
      stockItemId: item.stockItemId,
      requestedQuantity: Number(item.requestedQuantity),
      fulfilledQuantity: Number(item.fulfilledQuantity),
      stockItem: item.stockItem,
    })),
  };

  const stockAvailability = stockLevels.map((sl) => ({
    stockItemId: sl.stockItemId,
    availableQuantity: Number(sl.quantity),
  }));

  return (
    <div className="space-y-4">
      <RequisitionDetail
        requisition={requisitionData}
        stockAvailability={stockAvailability}
        userId={session.user.id || ""}
      />
    </div>
  );
}
