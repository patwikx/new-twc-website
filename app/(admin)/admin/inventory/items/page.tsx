import { db } from "@/lib/db";
import { StockItemsTable } from "@/components/admin/inventory/stock-items-table";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AdminStockItemsPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  // Get stock items with stock levels
  const stockItems = await db.stockItem.findMany({
    include: {
      property: {
        select: {
          id: true,
          name: true,
        },
      },
      primaryUnit: {
        select: {
          id: true,
          name: true,
          abbreviation: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
      supplier: {
        select: {
          id: true,
          name: true,
        },
      },
      stockLevels: {
        include: {
          warehouse: {
            select: {
              id: true,
              name: true,
              type: true,
              isActive: true,
            },
          },
        },
      },
      _count: {
        select: {
          stockLevels: true,
          stockBatches: true,
          movements: true,
          recipeIngredients: true,
        },
      },
    },
    orderBy: [
      { category: { name: "asc" } },
      { name: "asc" },
    ],
  });

  // Calculate total stock and value for each item
  const stockItemsWithSummary = stockItems.map((item) => {
    const totalQuantity = item.stockLevels.reduce((sum, level) => {
      return sum + Number(level.quantity);
    }, 0);

    const totalValue = item.stockLevels.reduce((sum, level) => {
      return sum + Number(level.quantity) * Number(level.averageCost);
    }, 0);

    return {
      id: item.id,
      itemCode: item.itemCode,
      name: item.name,
      sku: item.sku,
      category: item.category,
      isConsignment: item.isConsignment,
      isActive: item.isActive,
      propertyId: item.propertyId,
      propertyName: item.property.name,
      primaryUnit: item.primaryUnit,
      supplier: item.supplier,
      totalQuantity,
      totalValue,
      warehouseCount: item.stockLevels.filter(sl => sl.warehouse.isActive).length,
      batchCount: item._count.stockBatches,
      recipeCount: item._count.recipeIngredients,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  });

  // Get properties for filter dropdown
  const properties = await db.property.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  // Get active categories for filter dropdown
  const categories = await db.stockCategory.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      color: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Stock Items</h1>
        <p className="text-muted-foreground">
          Manage your inventory catalog and view stock levels across warehouses.
        </p>
      </div>

      <StockItemsTable 
        stockItems={stockItemsWithSummary} 
        properties={properties}
        categories={categories}
      />
    </div>
  );
}
