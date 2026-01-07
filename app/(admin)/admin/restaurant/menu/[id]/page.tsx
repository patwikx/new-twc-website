import { db } from "@/lib/db";
import { MenuItemForm } from "@/components/admin/restaurant/menu-item-form";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";

interface MenuItemPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AdminMenuItemPage({ params }: MenuItemPageProps) {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  const { id } = await params;

  // Get current property scope from cookie
  const cookieStore = await cookies();
  const currentScope = cookieStore.get("admin_property_scope")?.value;
  const currentPropertyId = currentScope && currentScope !== "ALL" ? currentScope : null;

  // Get the menu item
  const menuItem = await db.menuItem.findUnique({
    where: { id },
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
          icon: true,
        },
      },
      recipe: {
        select: {
          id: true,
          name: true,
          yield: true,
          minimumServingsThreshold: true,
          yieldUnit: {
            select: {
              abbreviation: true,
            },
          },
        },
      },
    },
  });

  if (!menuItem) {
    notFound();
  }

  // Get properties for dropdown
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
      yield: true,
      minimumServingsThreshold: true,
      yieldUnit: {
        select: {
          abbreviation: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Get categories for the current property or global
  const categories = await db.menuCategory.findMany({
    where: {
      isActive: true,
      OR: [
        { propertyId: null }, // Global categories
        { propertyId: menuItem.propertyId },
      ],
    },
    select: {
      id: true,
      name: true,
      color: true,
      icon: true,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const currentProperty = currentPropertyId 
    ? properties.find(p => p.id === currentPropertyId) 
    : null;

  // Transform data for the form
  const menuItemData = {
    id: menuItem.id,
    name: menuItem.name,
    description: menuItem.description,
    categoryId: menuItem.categoryId,
    sellingPrice: Number(menuItem.sellingPrice),
    recipeId: menuItem.recipeId,
    imageUrl: menuItem.imageUrl,
    isAvailable: menuItem.isAvailable,
    unavailableReason: menuItem.unavailableReason,
    availableServings: menuItem.availableServings,
    propertyId: menuItem.propertyId,
  };

  const recipesData = recipes.map(r => ({
    id: r.id,
    name: r.name,
    yield: Number(r.yield),
    yieldUnit: r.yieldUnit.abbreviation,
    minimumServingsThreshold: r.minimumServingsThreshold,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Menu Item</h1>
        <p className="text-muted-foreground">
          Update menu item details and recipe association.
        </p>
      </div>

      <div className="rounded-lg border border-white/10 bg-neutral-900/50 p-6">
        <MenuItemForm
          menuItem={menuItemData}
          properties={properties}
          recipes={recipesData}
          categories={categories}
          isEditMode={true}
          currentPropertyId={currentPropertyId}
          currentPropertyName={currentProperty?.name}
        />
      </div>
    </div>
  );
}
