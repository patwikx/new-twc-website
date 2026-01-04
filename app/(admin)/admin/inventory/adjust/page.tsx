import { db } from "@/lib/db";
import { StockAdjustmentForm } from "@/components/admin/inventory/stock-adjustment-form";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function StockAdjustmentPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/login");
  }

  // Get current property scope from cookie
  const cookieStore = await cookies();
  const currentScope = cookieStore.get("admin_property_scope")?.value;

  // Build where clause based on scope
  const propertyFilter =
    currentScope && currentScope !== "ALL" ? { propertyId: currentScope } : {};

  // Get active stock items with their stock levels for dropdown
  const stockItems = await db.stockItem.findMany({
    where: {
      ...propertyFilter,
      isActive: true,
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
          averageCost: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Transform stock levels to numbers
  const transformedStockItems = stockItems.map((item) => ({
    ...item,
    stockLevels: item.stockLevels.map((sl) => ({
      warehouseId: sl.warehouseId,
      quantity: Number(sl.quantity),
      averageCost: Number(sl.averageCost),
    })),
  }));

  // Get active warehouses for dropdown
  const warehouses = await db.warehouse.findMany({
    where: {
      ...propertyFilter,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      type: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <StockAdjustmentForm
        stockItems={transformedStockItems}
        warehouses={warehouses}
        userId={session.user.id!}
      />
    </div>
  );
}
