import { db } from "@/lib/db";
import { StockItemForm } from "@/components/admin/inventory/stock-item-form";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getParLevelsByStockItem } from "@/lib/inventory/stock-item";

interface StockItemPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminStockItemPage({ params }: StockItemPageProps) {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  const { id } = await params;

  // Get stock item with category
  const stockItem = await db.stockItem.findUnique({
    where: { id },
    select: {
      id: true,
      itemCode: true,
      name: true,
      sku: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          description: true,
          color: true,
        },
      },
      primaryUnitId: true,
      isConsignment: true,
      supplierId: true,
      isActive: true,
      propertyId: true,
      property: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!stockItem) {
    notFound();
  }

  // Get par levels for this stock item
  const parLevels = await getParLevelsByStockItem(id);

  // Get properties for dropdown
  const properties = await db.property.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  // Get active categories for dropdown
  const categories = await db.stockCategory.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
    },
    orderBy: { name: "asc" },
  });

  // Get units of measure for dropdown
  const units = await db.unitOfMeasure.findMany({
    select: {
      id: true,
      name: true,
      abbreviation: true,
    },
    orderBy: { name: "asc" },
  });

  // Get active suppliers for dropdown
  const suppliers = await db.supplier.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      contactName: true,
    },
    orderBy: { name: "asc" },
  });

  // Get warehouses for the stock item's property (for par levels)
  const warehouses = await db.warehouse.findMany({
    where: {
      propertyId: stockItem.propertyId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      type: true,
    },
    orderBy: { name: "asc" },
  });

  // Transform par levels for the form
  const parLevelsForForm = parLevels.map(pl => ({
    warehouseId: pl.warehouseId,
    parLevel: Number(pl.parLevel),
    warehouse: pl.warehouse,
  }));

  return (
    <div className="space-y-6">
      <StockItemForm
        stockItem={stockItem}
        parLevels={parLevelsForForm}
        properties={properties}
        categories={categories}
        units={units}
        suppliers={suppliers}
        warehouses={warehouses}
        isEditMode={true}
      />
    </div>
  );
}
