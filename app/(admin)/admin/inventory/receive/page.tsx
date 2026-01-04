import { db } from "@/lib/db";
import { StockReceiptForm } from "@/components/admin/inventory/stock-receipt-form";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function StockReceivePage() {
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

  // Get active stock items for dropdown
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
    },
    orderBy: { name: "asc" },
  });

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
      <StockReceiptForm
        stockItems={stockItems}
        warehouses={warehouses}
        userId={session.user.id!}
      />
    </div>
  );
}
