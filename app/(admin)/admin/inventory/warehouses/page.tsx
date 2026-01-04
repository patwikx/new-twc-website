import { db } from "@/lib/db";
import { WarehousesTable } from "@/components/admin/inventory/warehouses-table";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";

export default async function AdminWarehousesPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  // Get current property scope from cookie
  const cookieStore = await cookies();
  const currentScope = cookieStore.get("admin_property_scope")?.value || "ALL";

  // Build where clause based on property scope
  const whereClause: Prisma.WarehouseWhereInput = {};
  if (currentScope !== "ALL") {
    whereClause.propertyId = currentScope;
  }

  // Get warehouses with stock summary (filtered by property scope)
  const warehouses = await db.warehouse.findMany({
    where: whereClause,
    include: {
      property: {
        select: {
          id: true,
          name: true,
        },
      },
      stockLevels: {
        include: {
          stockItem: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
        },
      },
      _count: {
        select: {
          stockLevels: true,
          stockBatches: true,
        },
      },
    },
    orderBy: [
      { property: { name: "asc" } },
      { name: "asc" },
    ],
  });

  // Calculate stock summary for each warehouse
  const warehousesWithSummary = warehouses.map((warehouse) => {
    const totalValue = warehouse.stockLevels.reduce((sum, level) => {
      return sum + Number(level.quantity) * Number(level.averageCost);
    }, 0);

    const totalItems = warehouse.stockLevels.length;

    return {
      id: warehouse.id,
      name: warehouse.name,
      type: warehouse.type,
      isActive: warehouse.isActive,
      propertyId: warehouse.propertyId,
      propertyName: warehouse.property.name,
      totalItems,
      totalValue,
      batchCount: warehouse._count.stockBatches,
      createdAt: warehouse.createdAt,
      updatedAt: warehouse.updatedAt,
    };
  });

  // Get properties for filter dropdown
  // When viewing a specific property, we still need that property's info for the dialog
  const properties = await db.property.findMany({
    where: currentScope !== "ALL" ? { id: currentScope } : undefined,
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Warehouses</h1>
        <p className="text-muted-foreground">
          Manage inventory storage locations and view stock summaries.
        </p>
      </div>

      <WarehousesTable 
        warehouses={warehousesWithSummary} 
        properties={properties}
        currentScope={currentScope}
      />
    </div>
  );
}
