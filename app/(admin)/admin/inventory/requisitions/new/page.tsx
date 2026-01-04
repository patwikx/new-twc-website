import { db } from "@/lib/db";
import { RequisitionForm } from "@/components/admin/inventory/requisition-form";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function NewRequisitionPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  // Get current property scope from cookie
  const cookieStore = await cookies();
  const currentScope = cookieStore.get("admin_property_scope")?.value || "ALL";

  // Get active warehouses (filtered by property scope)
  const warehouses = await db.warehouse.findMany({
    where: {
      isActive: true,
      ...(currentScope !== "ALL" ? { propertyId: currentScope } : {}),
    },
    select: {
      id: true,
      name: true,
      type: true,
    },
    orderBy: { name: "asc" },
  });

  // Get active stock items with stock levels (filtered by property scope)
  const stockItems = await db.stockItem.findMany({
    where: {
      isActive: true,
      ...(currentScope !== "ALL" ? { propertyId: currentScope } : {}),
    },
    select: {
      id: true,
      name: true,
      itemCode: true,
      primaryUnit: {
        select: {
          id: true,
          abbreviation: true,
        },
      },
      stockLevels: {
        select: {
          warehouseId: true,
          quantity: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Transform stock items for the form
  const stockItemsData = stockItems.map((item) => ({
    id: item.id,
    name: item.name,
    itemCode: item.itemCode,
    primaryUnit: item.primaryUnit,
    stockLevels: item.stockLevels.map((sl) => ({
      warehouseId: sl.warehouseId,
      quantity: Number(sl.quantity),
    })),
  }));

  return (
    <div className="space-y-4">
      <RequisitionForm
        stockItems={stockItemsData}
        warehouses={warehouses}
        userId={session.user.id || ""}
      />
    </div>
  );
}
