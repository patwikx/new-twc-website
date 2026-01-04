import { db } from "@/lib/db";
import { RecipeForm } from "@/components/admin/restaurant/recipe-form";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function NewRecipePage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  // Get stock items for ingredient selection (only INGREDIENT category)
  const stockItems = await db.stockItem.findMany({
    where: {
      isActive: true,
      category: {
        name: "Ingredient",
      },
    },
    select: {
      id: true,
      name: true,
      sku: true,
      category: {
        select: {
          name: true,
        },
      },
      primaryUnit: {
        select: {
          id: true,
          abbreviation: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // Get units of measure
  const units = await db.unitOfMeasure.findMany({
    select: {
      id: true,
      name: true,
      abbreviation: true,
    },
    orderBy: { name: "asc" },
  });

  // Get available recipes for sub-recipe selection
  const availableRecipes = await db.recipe.findMany({
    where: {
      isActive: true,
    },
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

  // Transform available recipes for the form
  const availableRecipesData = availableRecipes.map((r) => ({
    id: r.id,
    name: r.name,
    yield: Number(r.yield),
    yieldUnit: r.yieldUnit.abbreviation,
  }));

  return (
    <div className="space-y-4">
      <RecipeForm
        stockItems={stockItems}
        units={units}
        availableRecipes={availableRecipesData}
        isEditMode={false}
      />
    </div>
  );
}
