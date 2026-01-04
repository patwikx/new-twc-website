import { db } from "@/lib/db";
import { CycleCountForm } from "@/components/admin/inventory/cycle-count-form";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requirePermission } from "@/lib/auth-checks";

export default async function NewCycleCountPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  // Check permission to create cycle counts
  await requirePermission("cycle-count:create");

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
    orderBy: [{ name: "asc" }],
  });

  // Transform stock levels to a map for easier lookup
  const stockItemsWithLevels = stockItems.map((item) => ({
    ...item,
    stockLevels: item.stockLevels.reduce((acc, level) => {
      acc[level.warehouseId] = Number(level.quantity);
      return acc;
    }, {} as Record<string, number>),
  }));

  return (
    <div className="space-y-4">
      <CycleCountForm
        stockItems={stockItemsWithLevels}
        warehouses={warehouses}
        userId={session.user.id || ""}
      />
    </div>
  );
}
