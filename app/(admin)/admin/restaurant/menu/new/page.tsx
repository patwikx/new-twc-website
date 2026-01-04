import { db } from "@/lib/db";
import { MenuItemForm } from "@/components/admin/restaurant/menu-item-form";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function NewMenuItemPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
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
      yieldUnit: {
        select: {
          abbreviation: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Get current property scope from cookie
  const cookieStore = await cookies();
  const currentScope = cookieStore.get("admin_property_scope")?.value;
  const currentPropertyId = currentScope && currentScope !== "ALL" ? currentScope : null;
  const currentProperty = currentPropertyId 
    ? properties.find(p => p.id === currentPropertyId) 
    : null;

  const recipesData = recipes.map(r => ({
    id: r.id,
    name: r.name,
    yield: Number(r.yield),
    yieldUnit: r.yieldUnit.abbreviation,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Menu Item</h1>
        <p className="text-muted-foreground">
          Add a new item to your restaurant menu.
        </p>
      </div>

      <div className="rounded-lg border border-white/10 bg-neutral-900/50 p-6">
        <MenuItemForm
          properties={properties}
          recipes={recipesData}
          isEditMode={false}
          currentPropertyId={currentPropertyId}
          currentPropertyName={currentProperty?.name}
        />
      </div>
    </div>
  );
}
