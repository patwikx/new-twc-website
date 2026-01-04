import { db } from "@/lib/db";
import { RequisitionsTable } from "@/components/admin/inventory/requisitions-table";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";

export default async function AdminRequisitionsPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  // Get current property scope from cookie
  const cookieStore = await cookies();
  const currentScope = cookieStore.get("admin_property_scope")?.value || "ALL";

  // Build where clause based on property scope
  const whereClause: Prisma.RequisitionWhereInput = {};
  if (currentScope !== "ALL") {
    whereClause.OR = [
      { requestingWarehouse: { propertyId: currentScope } },
      { sourceWarehouse: { propertyId: currentScope } },
    ];
  }

  // Get requisitions with related data
  const requisitions = await db.requisition.findMany({
    where: whereClause,
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
    orderBy: { createdAt: "desc" },
  });

  // Transform data for the table
  const requisitionsData = requisitions.map((req) => ({
    id: req.id,
    status: req.status,
    requestedById: req.requestedById,
    approvedById: req.approvedById,
    rejectionReason: req.rejectionReason,
    notes: req.notes,
    createdAt: req.createdAt,
    updatedAt: req.updatedAt,
    requestingWarehouse: req.requestingWarehouse,
    sourceWarehouse: req.sourceWarehouse,
    items: req.items.map((item) => ({
      id: item.id,
      stockItemId: item.stockItemId,
      requestedQuantity: Number(item.requestedQuantity),
      fulfilledQuantity: Number(item.fulfilledQuantity),
      stockItem: item.stockItem,
    })),
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Requisitions</h1>
        <p className="text-muted-foreground">
          Manage stock requisitions between warehouses.
        </p>
      </div>

      <RequisitionsTable requisitions={requisitionsData} />
    </div>
  );
}
