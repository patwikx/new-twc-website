import { db } from "@/lib/db";
import { RecipeForm } from "@/components/admin/restaurant/recipe-form";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";

interface RecipeDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RecipeDetailPage({ params }: RecipeDetailPageProps) {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  const { id } = await params;

  // Get the recipe with all relations
  const recipe = await db.recipe.findUnique({
    where: { id },
    include: {
      yieldUnit: true,
      ingredients: {
        include: {
          stockItem: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
          unit: {
            select: {
              id: true,
              abbreviation: true,
            },
          },
        },
      },
      childRecipes: {
        include: {
          childRecipe: {
            select: {
              id: true,
              name: true,
              yield: true,
            },
          },
        },
      },
    },
  });

  if (!recipe) {
    notFound();
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

  // Get available recipes for sub-recipe selection (exclude current recipe)
  const availableRecipes = await db.recipe.findMany({
    where: {
      isActive: true,
      id: { not: id },
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

  // Get kitchen warehouse for cost calculation
  const kitchenWarehouse = await db.warehouse.findFirst({
    where: {
      type: "KITCHEN",
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  // Transform recipe data for the form
  const recipeData = {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    yield: Number(recipe.yield),
    yieldUnitId: recipe.yieldUnitId,
    instructions: recipe.instructions,
    prepTimeMinutes: recipe.prepTimeMinutes,
    cookTimeMinutes: recipe.cookTimeMinutes,
    isActive: recipe.isActive,
    ingredients: recipe.ingredients.map((ing) => ({
      id: ing.id,
      stockItemId: ing.stockItemId,
      stockItem: ing.stockItem,
      quantity: Number(ing.quantity),
      unitId: ing.unitId,
      unit: ing.unit,
      notes: ing.notes,
    })),
    childRecipes: recipe.childRecipes.map((sr) => ({
      id: sr.id,
      childRecipeId: sr.childRecipeId,
      childRecipe: {
        id: sr.childRecipe.id,
        name: sr.childRecipe.name,
        yield: Number(sr.childRecipe.yield),
      },
      quantity: Number(sr.quantity),
    })),
  };

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
        recipe={recipeData}
        stockItems={stockItems}
        units={units}
        availableRecipes={availableRecipesData}
        warehouseId={kitchenWarehouse?.id}
        isEditMode={true}
      />
    </div>
  );
}
