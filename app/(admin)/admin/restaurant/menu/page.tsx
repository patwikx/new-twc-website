import { db } from "@/lib/db";
import { MenuItemsTable } from "@/components/admin/restaurant/menu-items-table";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMenuItemsProfitability } from "@/lib/inventory/menu-item";

export default async function AdminMenuItemsPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  // Get menu items with recipe and category information
  const menuItems = await db.menuItem.findMany({
    include: {
      property: {
        select: {
          id: true,
          name: true,
        },
      },
      category: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
      recipe: {
        select: {
          id: true,
          name: true,
          yield: true,
          yieldUnit: {
            select: {
              abbreviation: true,
            },
          },
        },
      },
      _count: {
        select: {
          cogsRecords: true,
        },
      },
    },
    orderBy: [
      { category: { name: "asc" } },
      { name: "asc" },
    ],
  });

  // Get properties for filter dropdown
  const properties = await db.property.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  // Get active recipes for association
  const recipes = await db.recipe.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  // Get kitchen warehouse for cost calculation (if exists)
  const kitchenWarehouse = await db.warehouse.findFirst({
    where: {
      type: "KITCHEN",
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  // Calculate profitability for items with recipes if kitchen warehouse exists
  let profitabilityMap: Record<string, { foodCostPercentage: number; isAboveTargetCost: boolean }> = {};
  
  if (kitchenWarehouse) {
    // Get profitability for each property
    for (const property of properties) {
      const profitability = await getMenuItemsProfitability(property.id, kitchenWarehouse.id);
      for (const item of profitability) {
        profitabilityMap[item.menuItemId] = {
          foodCostPercentage: item.foodCostPercentage,
          isAboveTargetCost: item.isAboveTargetCost,
        };
      }
    }
  }

  // Transform menu items with profitability data
  const menuItemsWithProfitability = menuItems.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    category: {
      id: item.category.id,
      name: item.category.name,
      color: item.category.color,
    },
    sellingPrice: Number(item.sellingPrice),
    isAvailable: item.isAvailable,
    unavailableReason: item.unavailableReason,
    imageUrl: item.imageUrl,
    propertyId: item.propertyId,
    propertyName: item.property.name,
    recipe: item.recipe ? {
      id: item.recipe.id,
      name: item.recipe.name,
      yield: Number(item.recipe.yield),
      yieldUnit: item.recipe.yieldUnit.abbreviation,
    } : null,
    salesCount: item._count.cogsRecords,
    foodCostPercentage: profitabilityMap[item.id]?.foodCostPercentage ?? null,
    isAboveTargetCost: profitabilityMap[item.id]?.isAboveTargetCost ?? false,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Menu Items</h1>
        <p className="text-muted-foreground">
          Manage restaurant menu items, pricing, and recipe associations.
        </p>
      </div>

      <MenuItemsTable 
        menuItems={menuItemsWithProfitability} 
        properties={properties}
        recipes={recipes}
      />
    </div>
  );
}
