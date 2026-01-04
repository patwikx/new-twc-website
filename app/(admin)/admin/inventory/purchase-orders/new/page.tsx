import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PurchaseOrderForm } from "@/components/admin/inventory/purchase-order-form";
import { getActiveSuppliers } from "@/lib/inventory/supplier";
import { getStockItems } from "@/lib/inventory/stock-item";
import { getWarehouses } from "@/lib/inventory/warehouse";
import { db } from "@/lib/db";

export default async function NewPurchaseOrderPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/login");
  }

  // Fetch user's default property
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { defaultPropertyId: true },
  });

  // Fetch all required data
  const [suppliers, stockItemsResult, warehousesResult, properties] = await Promise.all([
    getActiveSuppliers(),
    getStockItems({ isActive: true }),
    getWarehouses({ isActive: true }),
    db.property.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const stockItems = stockItemsResult.stockItems?.map((item) => ({
    id: item.id,
    name: item.name,
    itemCode: item.itemCode,
    supplierId: item.supplierId,
    primaryUnit: {
      id: item.primaryUnit.id,
      abbreviation: item.primaryUnit.abbreviation,
    },
  })) ?? [];

  const warehouses = warehousesResult.warehouses?.map((w) => ({
    id: w.id,
    name: w.name,
    type: w.type,
  })) ?? [];

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <PurchaseOrderForm
        stockItems={stockItems}
        suppliers={suppliers}
        warehouses={warehouses}
        properties={properties}
        userId={session.user.id}
        defaultPropertyId={user?.defaultPropertyId ?? undefined}
      />
    </div>
  );
}
