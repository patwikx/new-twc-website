import { db } from "@/lib/db";
import { ConsignmentReceiptForm } from "@/components/admin/inventory/consignment-receipt-form";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function ConsignmentReceivePage() {
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

  // Get active consignment stock items for dropdown
  const stockItems = await db.stockItem.findMany({
    where: {
      ...propertyFilter,
      isActive: true,
      isConsignment: true,
    },
    select: {
      id: true,
      name: true,
      itemCode: true,
      supplierId: true,
      primaryUnit: {
        select: {
          id: true,
          abbreviation: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Get active suppliers that have consignment items
  const suppliers = await db.supplier.findMany({
    where: {
      isActive: true,
      stockItems: {
        some: {
          isConsignment: true,
          isActive: true,
          ...propertyFilter,
        },
      },
    },
    select: {
      id: true,
      name: true,
      contactName: true,
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

  // Filter out items without supplierId
  const validStockItems = stockItems.filter(
    (item): item is typeof item & { supplierId: string } => 
      item.supplierId !== null
  );

  return (
    <div className="space-y-6">
      <ConsignmentReceiptForm
        stockItems={validStockItems}
        suppliers={suppliers}
        warehouses={warehouses}
        userId={session.user.id!}
      />
    </div>
  );
}
