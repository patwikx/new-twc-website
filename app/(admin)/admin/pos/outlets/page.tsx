import { db } from "@/lib/db";
import { OutletsTable } from "@/components/admin/pos/outlets-table";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";

export default async function AdminOutletsPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  // Get current property scope from cookie
  const cookieStore = await cookies();
  const currentScope = cookieStore.get("admin_property_scope")?.value || "ALL";

  // Build where clause based on property scope
  const whereClause: Prisma.SalesOutletWhereInput = {};
  if (currentScope !== "ALL") {
    whereClause.propertyId = currentScope;
  }

  // Get outlets with related data
  const outlets = await db.salesOutlet.findMany({
    where: whereClause,
    include: {
      property: {
        select: {
          id: true,
          name: true,
        },
      },
      warehouse: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      _count: {
        select: {
          tables: true,
          orders: true,
          shifts: true,
        },
      },
    },
    orderBy: [
      { property: { name: "asc" } },
      { name: "asc" },
    ],
  });

  // Transform outlets for the table
  const outletsData = outlets.map((outlet) => ({
    id: outlet.id,
    name: outlet.name,
    type: outlet.type,
    isActive: outlet.isActive,
    propertyId: outlet.propertyId,
    propertyName: outlet.property.name,
    warehouseId: outlet.warehouseId,
    warehouseName: outlet.warehouse.name,
    tableCount: outlet._count.tables,
    orderCount: outlet._count.orders,
    createdAt: outlet.createdAt,
    updatedAt: outlet.updatedAt,
  }));

  // Get properties for filter dropdown
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
        <h1 className="text-3xl font-bold tracking-tight">Sales Outlets</h1>
        <p className="text-muted-foreground">
          Manage restaurant, bar, and other sales outlets for your property.
        </p>
      </div>

      <OutletsTable 
        outlets={outletsData} 
        properties={properties}
        currentScope={currentScope}
      />
    </div>
  );
}
