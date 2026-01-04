import { db } from "@/lib/db";
import { RecipesTable } from "@/components/admin/restaurant/recipes-table";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getRecipeCostSummary } from "@/lib/inventory/recipe";

export default async function AdminRecipesPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/auth/login");
  }

  // Get all recipes with their relations
  const recipes = await db.recipe.findMany({
    include: {
      yieldUnit: {
        select: {
          abbreviation: true,
        },
      },
      _count: {
        select: {
          ingredients: true,
          childRecipes: true,
          menuItems: true,
        },
      },
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

  // Calculate costs for all recipes if kitchen warehouse exists
  let costMap: Record<string, { totalCost: number; costPerPortion: number }> = {};
  
  if (kitchenWarehouse && recipes.length > 0) {
    const recipeIds = recipes.map(r => r.id);
    const costSummary = await getRecipeCostSummary(recipeIds, kitchenWarehouse.id);
    
    for (const cost of costSummary) {
      if (!cost.error) {
        costMap[cost.recipeId] = {
          totalCost: cost.totalCost,
          costPerPortion: cost.costPerPortion,
        };
      }
    }
  }

  // Transform recipes with cost data
  const recipesWithCosts = recipes.map((recipe) => ({
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    yield: Number(recipe.yield),
    yieldUnit: recipe.yieldUnit.abbreviation,
    prepTimeMinutes: recipe.prepTimeMinutes,
    cookTimeMinutes: recipe.cookTimeMinutes,
    isActive: recipe.isActive,
    ingredientCount: recipe._count.ingredients,
    subRecipeCount: recipe._count.childRecipes,
    menuItemCount: recipe._count.menuItems,
    totalCost: costMap[recipe.id]?.totalCost ?? null,
    costPerPortion: costMap[recipe.id]?.costPerPortion ?? null,
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Recipes</h1>
        <p className="text-muted-foreground">
          Manage recipes with ingredients, sub-recipes, and cost calculations.
        </p>
      </div>

      <RecipesTable recipes={recipesWithCosts} />
    </div>
  );
}
