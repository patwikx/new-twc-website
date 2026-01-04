import { db } from "@/lib/db";
import { StockTransferForm } from "@/components/admin/inventory/stock-transfer-form";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function StockTransferPage() {
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
      <StockTransferForm
        stockItems={transformedStockItems}
        warehouses={warehouses}
        userId={session.user.id!}
      />
    </div>
  );
}
