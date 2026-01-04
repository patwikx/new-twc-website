"use server";

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import { getWeightedAverageCost } from "./stock-movement";
import { convertUnit } from "./unit-of-measure";

// Types
export interface CreateRecipeInput {
  name: string;
  description?: string;
  yield: number;
  yieldUnitId: string;
  instructions?: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  ingredients: CreateRecipeIngredientInput[];
  subRecipes?: CreateSubRecipeInput[];
}

export interface CreateRecipeIngredientInput {
  stockItemId: string;
  quantity: number;
  unitId: string;
  notes?: string;
}

export interface CreateSubRecipeInput {
  childRecipeId: string;
  quantity: number; // Number of portions of sub-recipe needed
}

export interface UpdateRecipeInput {
  name?: string;
  description?: string;
  yield?: number;
  yieldUnitId?: string;
  instructions?: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  isActive?: boolean;
}

export interface UpdateRecipeIngredientsInput {
  ingredients: CreateRecipeIngredientInput[];
}

export interface UpdateSubRecipesInput {
  subRecipes: CreateSubRecipeInput[];
}

export interface IngredientCost {
  stockItemId: string;
  stockItemName: string;
  quantity: number;
  unitAbbreviation: string;
  unitCost: number;
  totalCost: number;
}

export interface SubRecipeCost {
  recipeId: string;
  recipeName: string;
  quantity: number;
  costPerPortion: number;
  totalCost: number;
}

export interface RecipeCost {
  recipeId: string;
  recipeName: string;
  totalCost: number;
  costPerPortion: number;
  yield: number;
  ingredientCosts: IngredientCost[];
  subRecipeCosts: SubRecipeCost[];
  calculatedAt: Date;
}

export interface IngredientAvailability {
  stockItemId: string;
  stockItemName: string;
  requiredQuantity: number;
  availableQuantity: number;
  unitAbbreviation: string;
  isAvailable: boolean;
  deficit: number;
}

export interface AvailabilityResult {
  recipeId: string;
  recipeName: string;
  isAvailable: boolean;
  portionsAvailable: number;
  requestedPortions: number;
  ingredients: IngredientAvailability[];
  unavailableIngredients: IngredientAvailability[];
}

// ============================================================================
// Recipe CRUD Operations
// ============================================================================

/**
 * Create a new recipe
 * Requirements: 6.1, 6.2, 6.6
 * 
 * Property 22: Recipe Required Ingredients
 * For any recipe creation, it SHALL have at least one ingredient with a valid stockItemId,
 * quantity > 0, and valid unitId. Recipes without ingredients SHALL be rejected.
 * 
 * Property 23: Recipe Ingredient Validation
 * For any recipe ingredient, the stockItemId SHALL reference an existing stock item in the catalog.
 * Recipes with non-existent ingredient references SHALL be rejected.
 */
export async function createRecipe(data: CreateRecipeInput) {
  // Validate required fields
  if (!data.name || data.name.trim() === "") {
    return { error: "Recipe name is required" };
  }

  if (data.yield === undefined || data.yield === null || data.yield <= 0) {
    return { error: "Recipe yield must be greater than zero" };
  }

  if (!data.yieldUnitId || data.yieldUnitId.trim() === "") {
    return { error: "Yield unit is required" };
  }

  // Property 22: Validate at least one ingredient
  if (!data.ingredients || data.ingredients.length === 0) {
    return { error: "Recipe must have at least one ingredient" };
  }

  // Validate each ingredient
  for (const ingredient of data.ingredients) {
    if (!ingredient.stockItemId || ingredient.stockItemId.trim() === "") {
      return { error: "Each ingredient must have a stock item ID" };
    }
    if (ingredient.quantity === undefined || ingredient.quantity === null || ingredient.quantity <= 0) {
      return { error: "Each ingredient must have a quantity greater than zero" };
    }
    if (!ingredient.unitId || ingredient.unitId.trim() === "") {
      return { error: "Each ingredient must have a unit of measure" };
    }
  }

  try {
    // Verify yield unit exists
    const yieldUnit = await db.unitOfMeasure.findUnique({
      where: { id: data.yieldUnitId },
    });

    if (!yieldUnit) {
      return { error: "Yield unit of measure not found" };
    }

    // Property 23: Validate all ingredients exist in catalog
    const stockItemIds = data.ingredients.map((i) => i.stockItemId);
    const stockItems = await db.stockItem.findMany({
      where: { id: { in: stockItemIds } },
      select: { id: true },
    });

    const foundIds = new Set(stockItems.map((s) => s.id));
    const missingIds = stockItemIds.filter((id) => !foundIds.has(id));

    if (missingIds.length > 0) {
      return { error: `Stock items not found: ${missingIds.join(", ")}` };
    }

    // Validate all ingredient units exist
    const unitIds = data.ingredients.map((i) => i.unitId);
    const units = await db.unitOfMeasure.findMany({
      where: { id: { in: unitIds } },
      select: { id: true },
    });

    const foundUnitIds = new Set(units.map((u) => u.id));
    const missingUnitIds = unitIds.filter((id) => !foundUnitIds.has(id));

    if (missingUnitIds.length > 0) {
      return { error: `Units of measure not found: ${missingUnitIds.join(", ")}` };
    }

    // Validate sub-recipes if provided
    if (data.subRecipes && data.subRecipes.length > 0) {
      const subRecipeIds = data.subRecipes.map((sr) => sr.childRecipeId);
      const subRecipes = await db.recipe.findMany({
        where: { id: { in: subRecipeIds }, isActive: true },
        select: { id: true },
      });

      const foundSubRecipeIds = new Set(subRecipes.map((r) => r.id));
      const missingSubRecipeIds = subRecipeIds.filter((id) => !foundSubRecipeIds.has(id));

      if (missingSubRecipeIds.length > 0) {
        return { error: `Sub-recipes not found: ${missingSubRecipeIds.join(", ")}` };
      }

      // Validate sub-recipe quantities
      for (const subRecipe of data.subRecipes) {
        if (subRecipe.quantity <= 0) {
          return { error: "Sub-recipe quantity must be greater than zero" };
        }
      }
    }

    // Create recipe with ingredients and sub-recipes in a transaction
    const recipe = await db.$transaction(async (tx) => {
      // Create the recipe
      const newRecipe = await tx.recipe.create({
        data: {
          name: data.name.trim(),
          description: data.description?.trim() || null,
          yield: data.yield,
          yieldUnitId: data.yieldUnitId,
          instructions: data.instructions?.trim() || null,
          prepTimeMinutes: data.prepTimeMinutes || null,
          cookTimeMinutes: data.cookTimeMinutes || null,
          isActive: true,
        },
      });

      // Create ingredients
      await tx.recipeIngredient.createMany({
        data: data.ingredients.map((ingredient) => ({
          recipeId: newRecipe.id,
          stockItemId: ingredient.stockItemId,
          quantity: ingredient.quantity,
          unitId: ingredient.unitId,
          notes: ingredient.notes?.trim() || null,
        })),
      });

      // Create sub-recipes if provided
      if (data.subRecipes && data.subRecipes.length > 0) {
        await tx.recipeSubRecipe.createMany({
          data: data.subRecipes.map((subRecipe) => ({
            parentRecipeId: newRecipe.id,
            childRecipeId: subRecipe.childRecipeId,
            quantity: subRecipe.quantity,
          })),
        });
      }

      // Return the complete recipe with relations
      return tx.recipe.findUnique({
        where: { id: newRecipe.id },
        include: {
          yieldUnit: true,
          ingredients: {
            include: {
              stockItem: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  category: true,
                },
              },
              unit: true,
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
    });

    revalidatePath("/admin/restaurant/recipes");
    return { success: true, data: recipe };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { error: "A recipe with this name already exists" };
      }
    }
    console.error("Create Recipe Error:", error);
    return { error: "Failed to create recipe" };
  }
}

/**
 * Get a recipe by ID
 */
export async function getRecipeById(id: string) {
  try {
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
                category: true,
                primaryUnit: true,
              },
            },
            unit: true,
          },
        },
        childRecipes: {
          include: {
            childRecipe: {
              select: {
                id: true,
                name: true,
                description: true,
                yield: true,
                isActive: true,
              },
            },
          },
        },
        parentRecipes: {
          include: {
            parentRecipe: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        menuItems: {
          select: {
            id: true,
            name: true,
            sellingPrice: true,
            isAvailable: true,
          },
        },
        _count: {
          select: {
            ingredients: true,
            childRecipes: true,
            menuItems: true,
            cogsRecords: true,
          },
        },
      },
    });

    return recipe;
  } catch (error) {
    console.error("Get Recipe Error:", error);
    return null;
  }
}


/**
 * Get all recipes with optional filtering
 */
export async function getRecipes(options?: {
  isActive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  try {
    const where: Prisma.RecipeWhereInput = {};

    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    if (options?.search) {
      where.OR = [
        { name: { contains: options.search, mode: "insensitive" } },
        { description: { contains: options.search, mode: "insensitive" } },
      ];
    }

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const [recipes, total] = await Promise.all([
      db.recipe.findMany({
        where,
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
              unit: true,
            },
          },
          childRecipes: {
            include: {
              childRecipe: {
                select: {
                  id: true,
                  name: true,
                },
              },
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
        skip,
        take: pageSize,
      }),
      db.recipe.count({ where }),
    ]);

    return {
      recipes,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Get Recipes Error:", error);
    return {
      recipes: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    };
  }
}

/**
 * Get all active recipes (for dropdowns)
 */
export async function getActiveRecipes() {
  try {
    const recipes = await db.recipe.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        yield: true,
        yieldUnit: {
          select: {
            abbreviation: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return recipes;
  } catch (error) {
    console.error("Get Active Recipes Error:", error);
    return [];
  }
}

/**
 * Update a recipe's basic information
 */
export async function updateRecipe(id: string, data: UpdateRecipeInput) {
  try {
    // Validate recipe exists
    const existingRecipe = await db.recipe.findUnique({
      where: { id },
    });

    if (!existingRecipe) {
      return { error: "Recipe not found" };
    }

    const updateData: Prisma.RecipeUpdateInput = {};

    if (data.name !== undefined) {
      if (!data.name || data.name.trim() === "") {
        return { error: "Recipe name cannot be empty" };
      }
      updateData.name = data.name.trim();
    }

    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }

    if (data.yield !== undefined) {
      if (data.yield <= 0) {
        return { error: "Recipe yield must be greater than zero" };
      }
      updateData.yield = data.yield;
    }

    if (data.yieldUnitId !== undefined) {
      if (!data.yieldUnitId || data.yieldUnitId.trim() === "") {
        return { error: "Yield unit cannot be empty" };
      }
      // Verify unit exists
      const unit = await db.unitOfMeasure.findUnique({
        where: { id: data.yieldUnitId },
      });
      if (!unit) {
        return { error: "Yield unit of measure not found" };
      }
      updateData.yieldUnit = { connect: { id: data.yieldUnitId } };
    }

    if (data.instructions !== undefined) {
      updateData.instructions = data.instructions?.trim() || null;
    }

    if (data.prepTimeMinutes !== undefined) {
      updateData.prepTimeMinutes = data.prepTimeMinutes;
    }

    if (data.cookTimeMinutes !== undefined) {
      updateData.cookTimeMinutes = data.cookTimeMinutes;
    }

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    const recipe = await db.recipe.update({
      where: { id },
      data: updateData,
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
            unit: true,
          },
        },
        childRecipes: {
          include: {
            childRecipe: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    revalidatePath("/admin/restaurant/recipes");
    revalidatePath(`/admin/restaurant/recipes/${id}`);
    return { success: true, data: recipe };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Recipe not found" };
      }
    }
    console.error("Update Recipe Error:", error);
    return { error: "Failed to update recipe" };
  }
}

/**
 * Update recipe ingredients (replaces all existing ingredients)
 * Requirements: 6.1, 6.2
 */
export async function updateRecipeIngredients(
  recipeId: string,
  data: UpdateRecipeIngredientsInput
) {
  // Property 22: Validate at least one ingredient
  if (!data.ingredients || data.ingredients.length === 0) {
    return { error: "Recipe must have at least one ingredient" };
  }

  // Validate each ingredient
  for (const ingredient of data.ingredients) {
    if (!ingredient.stockItemId || ingredient.stockItemId.trim() === "") {
      return { error: "Each ingredient must have a stock item ID" };
    }
    if (ingredient.quantity === undefined || ingredient.quantity === null || ingredient.quantity <= 0) {
      return { error: "Each ingredient must have a quantity greater than zero" };
    }
    if (!ingredient.unitId || ingredient.unitId.trim() === "") {
      return { error: "Each ingredient must have a unit of measure" };
    }
  }

  try {
    // Verify recipe exists
    const recipe = await db.recipe.findUnique({
      where: { id: recipeId },
    });

    if (!recipe) {
      return { error: "Recipe not found" };
    }

    // Property 23: Validate all ingredients exist in catalog
    const stockItemIds = data.ingredients.map((i) => i.stockItemId);
    const stockItems = await db.stockItem.findMany({
      where: { id: { in: stockItemIds } },
      select: { id: true },
    });

    const foundIds = new Set(stockItems.map((s) => s.id));
    const missingIds = stockItemIds.filter((id) => !foundIds.has(id));

    if (missingIds.length > 0) {
      return { error: `Stock items not found: ${missingIds.join(", ")}` };
    }

    // Validate all ingredient units exist
    const unitIds = data.ingredients.map((i) => i.unitId);
    const units = await db.unitOfMeasure.findMany({
      where: { id: { in: unitIds } },
      select: { id: true },
    });

    const foundUnitIds = new Set(units.map((u) => u.id));
    const missingUnitIds = unitIds.filter((id) => !foundUnitIds.has(id));

    if (missingUnitIds.length > 0) {
      return { error: `Units of measure not found: ${missingUnitIds.join(", ")}` };
    }

    // Replace ingredients in a transaction
    const result = await db.$transaction(async (tx) => {
      // Delete existing ingredients
      await tx.recipeIngredient.deleteMany({
        where: { recipeId },
      });

      // Create new ingredients
      await tx.recipeIngredient.createMany({
        data: data.ingredients.map((ingredient) => ({
          recipeId,
          stockItemId: ingredient.stockItemId,
          quantity: ingredient.quantity,
          unitId: ingredient.unitId,
          notes: ingredient.notes?.trim() || null,
        })),
      });

      // Return updated recipe
      return tx.recipe.findUnique({
        where: { id: recipeId },
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
              unit: true,
            },
          },
        },
      });
    });

    revalidatePath("/admin/restaurant/recipes");
    revalidatePath(`/admin/restaurant/recipes/${recipeId}`);
    return { success: true, data: result };
  } catch (error) {
    console.error("Update Recipe Ingredients Error:", error);
    return { error: "Failed to update recipe ingredients" };
  }
}

/**
 * Update recipe sub-recipes (replaces all existing sub-recipes)
 * Requirements: 6.6
 */
export async function updateRecipeSubRecipes(
  recipeId: string,
  data: UpdateSubRecipesInput
) {
  try {
    // Verify recipe exists
    const recipe = await db.recipe.findUnique({
      where: { id: recipeId },
    });

    if (!recipe) {
      return { error: "Recipe not found" };
    }

    // Validate sub-recipes if provided
    if (data.subRecipes && data.subRecipes.length > 0) {
      // Check for circular dependency (recipe cannot include itself)
      if (data.subRecipes.some((sr) => sr.childRecipeId === recipeId)) {
        return { error: "Recipe cannot include itself as a sub-recipe" };
      }

      const subRecipeIds = data.subRecipes.map((sr) => sr.childRecipeId);
      const subRecipes = await db.recipe.findMany({
        where: { id: { in: subRecipeIds }, isActive: true },
        select: { id: true },
      });

      const foundSubRecipeIds = new Set(subRecipes.map((r) => r.id));
      const missingSubRecipeIds = subRecipeIds.filter((id) => !foundSubRecipeIds.has(id));

      if (missingSubRecipeIds.length > 0) {
        return { error: `Sub-recipes not found: ${missingSubRecipeIds.join(", ")}` };
      }

      // Validate sub-recipe quantities
      for (const subRecipe of data.subRecipes) {
        if (subRecipe.quantity <= 0) {
          return { error: "Sub-recipe quantity must be greater than zero" };
        }
      }

      // Check for circular dependencies (sub-recipe cannot include parent)
      const circularCheck = await checkCircularDependency(recipeId, subRecipeIds);
      if (circularCheck.hasCircular) {
        return { error: `Circular dependency detected: ${circularCheck.path}` };
      }
    }

    // Replace sub-recipes in a transaction
    const result = await db.$transaction(async (tx) => {
      // Delete existing sub-recipes
      await tx.recipeSubRecipe.deleteMany({
        where: { parentRecipeId: recipeId },
      });

      // Create new sub-recipes if provided
      if (data.subRecipes && data.subRecipes.length > 0) {
        await tx.recipeSubRecipe.createMany({
          data: data.subRecipes.map((subRecipe) => ({
            parentRecipeId: recipeId,
            childRecipeId: subRecipe.childRecipeId,
            quantity: subRecipe.quantity,
          })),
        });
      }

      // Return updated recipe
      return tx.recipe.findUnique({
        where: { id: recipeId },
        include: {
          yieldUnit: true,
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
    });

    revalidatePath("/admin/restaurant/recipes");
    revalidatePath(`/admin/restaurant/recipes/${recipeId}`);
    return { success: true, data: result };
  } catch (error) {
    console.error("Update Recipe Sub-Recipes Error:", error);
    return { error: "Failed to update recipe sub-recipes" };
  }
}

/**
 * Check for circular dependencies in sub-recipes
 */
async function checkCircularDependency(
  parentRecipeId: string,
  childRecipeIds: string[],
  visited: Set<string> = new Set(),
  path: string[] = []
): Promise<{ hasCircular: boolean; path: string }> {
  for (const childId of childRecipeIds) {
    if (childId === parentRecipeId) {
      return { hasCircular: true, path: [...path, childId].join(" -> ") };
    }

    if (visited.has(childId)) {
      continue;
    }

    visited.add(childId);

    // Get sub-recipes of this child
    const childSubRecipes = await db.recipeSubRecipe.findMany({
      where: { parentRecipeId: childId },
      select: { childRecipeId: true },
    });

    if (childSubRecipes.length > 0) {
      const grandchildIds = childSubRecipes.map((sr) => sr.childRecipeId);
      const result = await checkCircularDependency(
        parentRecipeId,
        grandchildIds,
        visited,
        [...path, childId]
      );
      if (result.hasCircular) {
        return result;
      }
    }
  }

  return { hasCircular: false, path: "" };
}

/**
 * Deactivate a recipe (soft delete)
 */
export async function deactivateRecipe(id: string) {
  try {
    const recipe = await db.recipe.update({
      where: { id },
      data: { isActive: false },
    });

    revalidatePath("/admin/restaurant/recipes");
    return { success: true, data: recipe };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Recipe not found" };
      }
    }
    console.error("Deactivate Recipe Error:", error);
    return { error: "Failed to deactivate recipe" };
  }
}

/**
 * Reactivate a recipe
 */
export async function reactivateRecipe(id: string) {
  try {
    const recipe = await db.recipe.update({
      where: { id },
      data: { isActive: true },
    });

    revalidatePath("/admin/restaurant/recipes");
    return { success: true, data: recipe };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Recipe not found" };
      }
    }
    console.error("Reactivate Recipe Error:", error);
    return { error: "Failed to reactivate recipe" };
  }
}

/**
 * Delete a recipe permanently
 * Note: This will fail if the recipe is used by menu items
 */
export async function deleteRecipe(id: string) {
  try {
    // Check if recipe is used by menu items
    const menuItemCount = await db.menuItem.count({
      where: { recipeId: id },
    });

    if (menuItemCount > 0) {
      return {
        error: "Cannot delete recipe that is used by menu items. Deactivate instead.",
      };
    }

    // Check if recipe is used as a sub-recipe
    const parentRecipeCount = await db.recipeSubRecipe.count({
      where: { childRecipeId: id },
    });

    if (parentRecipeCount > 0) {
      return {
        error: "Cannot delete recipe that is used as a sub-recipe in other recipes.",
      };
    }

    // Delete recipe (ingredients and sub-recipes will cascade)
    await db.recipe.delete({
      where: { id },
    });

    revalidatePath("/admin/restaurant/recipes");
    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Recipe not found" };
      }
    }
    console.error("Delete Recipe Error:", error);
    return { error: "Failed to delete recipe" };
  }
}


// ============================================================================
// Recipe Cost Calculation (COGS)
// ============================================================================

/**
 * Calculate the cost of a recipe based on current ingredient costs
 * Requirements: 6.3, 7.1, 7.2, 7.3
 * 
 * Property 24: Recipe Cost Calculation (COGS Formula)
 * For any recipe with ingredients, the total recipe cost SHALL equal the sum of
 * (ingredient.quantity × ingredient.unitCost) for all ingredients, where unitCost
 * is the weighted average cost from the specified warehouse.
 * 
 * Property 25: Cost Per Portion Calculation
 * For any recipe with total cost T and yield Y portions, the cost per portion SHALL equal T / Y.
 */
export async function calculateRecipeCost(
  recipeId: string,
  warehouseId: string
): Promise<{ success: true; data: RecipeCost } | { error: string }> {
  try {
    // Get recipe with ingredients and sub-recipes
    const recipe = await db.recipe.findUnique({
      where: { id: recipeId },
      include: {
        yieldUnit: true,
        ingredients: {
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                sku: true,
                primaryUnitId: true,
                primaryUnit: {
                  select: {
                    id: true,
                    abbreviation: true,
                  },
                },
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
      return { error: "Recipe not found" };
    }

    // Verify warehouse exists
    const warehouse = await db.warehouse.findUnique({
      where: { id: warehouseId },
    });

    if (!warehouse) {
      return { error: "Warehouse not found" };
    }

    // Calculate ingredient costs
    const ingredientCosts: IngredientCost[] = [];
    let totalIngredientCost = new Decimal(0);

    for (const ingredient of recipe.ingredients) {
      // Get weighted average cost for this stock item in the warehouse
      const avgCost = await getWeightedAverageCost(
        ingredient.stockItemId,
        warehouseId
      );

      // Convert ingredient quantity to stock item's primary unit if needed
      let quantityInPrimaryUnit = Number(ingredient.quantity);
      
      if (ingredient.unitId !== ingredient.stockItem.primaryUnitId) {
        const conversionResult = await convertUnit(
          Number(ingredient.quantity),
          ingredient.unitId,
          ingredient.stockItem.primaryUnitId
        );
        
        if ("error" in conversionResult) {
          // If conversion fails, use the original quantity
          console.warn(
            `Unit conversion failed for ingredient ${ingredient.stockItem.name}: ${conversionResult.error}`
          );
        } else {
          quantityInPrimaryUnit = conversionResult.result.value;
        }
      }

      // Property 24: Calculate ingredient cost = quantity × unitCost
      const ingredientTotalCost = new Decimal(quantityInPrimaryUnit).mul(avgCost);
      totalIngredientCost = totalIngredientCost.add(ingredientTotalCost);

      ingredientCosts.push({
        stockItemId: ingredient.stockItemId,
        stockItemName: ingredient.stockItem.name,
        quantity: Number(ingredient.quantity),
        unitAbbreviation: ingredient.unit.abbreviation,
        unitCost: avgCost,
        totalCost: ingredientTotalCost.toDecimalPlaces(2).toNumber(),
      });
    }

    // Calculate sub-recipe costs recursively
    const subRecipeCosts: SubRecipeCost[] = [];
    let totalSubRecipeCost = new Decimal(0);

    for (const subRecipeRef of recipe.childRecipes) {
      // Recursively calculate sub-recipe cost
      const subRecipeCostResult = await calculateRecipeCost(
        subRecipeRef.childRecipeId,
        warehouseId
      );

      if ("error" in subRecipeCostResult) {
        return {
          error: `Failed to calculate sub-recipe cost for ${subRecipeRef.childRecipe.name}: ${subRecipeCostResult.error}`,
        };
      }

      const subRecipeData = subRecipeCostResult.data;
      
      // Calculate cost for the required portions of sub-recipe
      const portionsNeeded = Number(subRecipeRef.quantity);
      const subRecipeTotalCost = new Decimal(subRecipeData.costPerPortion).mul(portionsNeeded);
      totalSubRecipeCost = totalSubRecipeCost.add(subRecipeTotalCost);

      subRecipeCosts.push({
        recipeId: subRecipeRef.childRecipeId,
        recipeName: subRecipeRef.childRecipe.name,
        quantity: portionsNeeded,
        costPerPortion: subRecipeData.costPerPortion,
        totalCost: subRecipeTotalCost.toDecimalPlaces(2).toNumber(),
      });
    }

    // Calculate total cost and cost per portion
    const totalCost = totalIngredientCost.add(totalSubRecipeCost);
    const recipeYield = new Decimal(recipe.yield.toString());
    
    // Property 25: Cost per portion = total cost / yield
    const costPerPortion = recipeYield.isZero()
      ? new Decimal(0)
      : totalCost.div(recipeYield);

    const recipeCost: RecipeCost = {
      recipeId: recipe.id,
      recipeName: recipe.name,
      totalCost: totalCost.toDecimalPlaces(2).toNumber(),
      costPerPortion: costPerPortion.toDecimalPlaces(4).toNumber(),
      yield: Number(recipe.yield),
      ingredientCosts,
      subRecipeCosts,
      calculatedAt: new Date(),
    };

    return { success: true, data: recipeCost };
  } catch (error) {
    console.error("Calculate Recipe Cost Error:", error);
    return { error: "Failed to calculate recipe cost" };
  }
}

/**
 * Calculate food cost percentage for a recipe
 * Requirements: 7.4
 * 
 * Property 26: Food Cost Percentage Calculation
 * For any menu item with recipe cost C and selling price P, the food cost percentage
 * SHALL equal (C / P) × 100.
 */
export async function calculateFoodCostPercentage(
  recipeId: string,
  warehouseId: string,
  sellingPrice: number
): Promise<{ success: true; data: { costPerPortion: number; foodCostPercentage: number; isAboveTarget: boolean } } | { error: string }> {
  if (sellingPrice <= 0) {
    return { error: "Selling price must be greater than zero" };
  }

  const costResult = await calculateRecipeCost(recipeId, warehouseId);
  
  if ("error" in costResult) {
    return costResult;
  }

  const costPerPortion = new Decimal(costResult.data.costPerPortion);
  const price = new Decimal(sellingPrice);
  
  // Property 26: Food cost percentage = (cost / price) × 100
  const foodCostPercentage = costPerPortion.div(price).mul(100);
  
  // Default target is 35%
  const TARGET_FOOD_COST_PERCENTAGE = 35;
  const isAboveTarget = foodCostPercentage.greaterThan(TARGET_FOOD_COST_PERCENTAGE);

  return {
    success: true,
    data: {
      costPerPortion: costPerPortion.toDecimalPlaces(4).toNumber(),
      foodCostPercentage: foodCostPercentage.toDecimalPlaces(2).toNumber(),
      isAboveTarget,
    },
  };
}

/**
 * Get recipe cost summary for multiple recipes
 */
export async function getRecipeCostSummary(
  recipeIds: string[],
  warehouseId: string
): Promise<{ recipeId: string; recipeName: string; totalCost: number; costPerPortion: number; error?: string }[]> {
  const results: { recipeId: string; recipeName: string; totalCost: number; costPerPortion: number; error?: string }[] = [];

  for (const recipeId of recipeIds) {
    const costResult = await calculateRecipeCost(recipeId, warehouseId);
    
    if ("error" in costResult) {
      // Get recipe name for error reporting
      const recipe = await db.recipe.findUnique({
        where: { id: recipeId },
        select: { name: true },
      });
      
      results.push({
        recipeId,
        recipeName: recipe?.name || "Unknown",
        totalCost: 0,
        costPerPortion: 0,
        error: costResult.error,
      });
    } else {
      results.push({
        recipeId: costResult.data.recipeId,
        recipeName: costResult.data.recipeName,
        totalCost: costResult.data.totalCost,
        costPerPortion: costResult.data.costPerPortion,
      });
    }
  }

  return results;
}


// ============================================================================
// Recipe Availability Check
// ============================================================================

/**
 * Check if a recipe can be produced with available stock
 * Requirements: 5.5
 * 
 * Property 21: Menu Availability Based on Stock
 * For any menu item with an associated recipe, the item SHALL be marked available
 * if and only if all recipe ingredients have sufficient stock in the kitchen warehouse
 * to produce at least one portion.
 */
export async function checkRecipeAvailability(
  recipeId: string,
  warehouseId: string,
  portions: number = 1
): Promise<{ success: true; data: AvailabilityResult } | { error: string }> {
  if (portions <= 0) {
    return { error: "Portions must be greater than zero" };
  }

  try {
    // Get recipe with ingredients and sub-recipes
    const recipe = await db.recipe.findUnique({
      where: { id: recipeId },
      include: {
        ingredients: {
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                sku: true,
                primaryUnitId: true,
                primaryUnit: {
                  select: {
                    id: true,
                    abbreviation: true,
                  },
                },
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
      return { error: "Recipe not found" };
    }

    // Verify warehouse exists
    const warehouse = await db.warehouse.findUnique({
      where: { id: warehouseId },
    });

    if (!warehouse) {
      return { error: "Warehouse not found" };
    }

    // Calculate the multiplier based on portions requested vs recipe yield
    const recipeYield = Number(recipe.yield);
    const portionMultiplier = portions / recipeYield;

    // Collect all required ingredients (including from sub-recipes)
    const ingredientRequirements = new Map<string, {
      stockItemId: string;
      stockItemName: string;
      requiredQuantity: number;
      unitId: string;
      unitAbbreviation: string;
      primaryUnitId: string;
    }>();

    // Add direct ingredients
    for (const ingredient of recipe.ingredients) {
      const requiredQty = Number(ingredient.quantity) * portionMultiplier;
      const existing = ingredientRequirements.get(ingredient.stockItemId);
      
      if (existing) {
        existing.requiredQuantity += requiredQty;
      } else {
        ingredientRequirements.set(ingredient.stockItemId, {
          stockItemId: ingredient.stockItemId,
          stockItemName: ingredient.stockItem.name,
          requiredQuantity: requiredQty,
          unitId: ingredient.unitId,
          unitAbbreviation: ingredient.unit.abbreviation,
          primaryUnitId: ingredient.stockItem.primaryUnitId,
        });
      }
    }

    // Add ingredients from sub-recipes recursively
    for (const subRecipeRef of recipe.childRecipes) {
      const subRecipePortions = Number(subRecipeRef.quantity) * portionMultiplier;
      const subRecipeIngredients = await getRecipeIngredientRequirements(
        subRecipeRef.childRecipeId,
        subRecipePortions
      );

      for (const [stockItemId, requirement] of subRecipeIngredients) {
        const existing = ingredientRequirements.get(stockItemId);
        
        if (existing) {
          existing.requiredQuantity += requirement.requiredQuantity;
        } else {
          ingredientRequirements.set(stockItemId, requirement);
        }
      }
    }

    // Check availability for each ingredient
    const ingredientAvailability: IngredientAvailability[] = [];
    const unavailableIngredients: IngredientAvailability[] = [];
    let isAvailable = true;
    let minPortionsAvailable = Infinity;

    for (const [stockItemId, requirement] of ingredientRequirements) {
      // Get current stock level
      const stockLevel = await db.stockLevel.findUnique({
        where: {
          stockItemId_warehouseId: {
            stockItemId,
            warehouseId,
          },
        },
      });

      let availableQuantity = stockLevel ? Number(stockLevel.quantity) : 0;
      let requiredQuantityInPrimaryUnit = requirement.requiredQuantity;

      // Convert required quantity to primary unit if needed
      if (requirement.unitId !== requirement.primaryUnitId) {
        const conversionResult = await convertUnit(
          requirement.requiredQuantity,
          requirement.unitId,
          requirement.primaryUnitId
        );
        
        if (!("error" in conversionResult)) {
          requiredQuantityInPrimaryUnit = conversionResult.result.value;
        }
      }

      const ingredientIsAvailable = availableQuantity >= requiredQuantityInPrimaryUnit;
      const deficit = ingredientIsAvailable ? 0 : requiredQuantityInPrimaryUnit - availableQuantity;

      // Calculate how many portions could be made with available stock
      if (requiredQuantityInPrimaryUnit > 0) {
        const portionsFromThisIngredient = (availableQuantity / requiredQuantityInPrimaryUnit) * portions;
        minPortionsAvailable = Math.min(minPortionsAvailable, portionsFromThisIngredient);
      }

      const availability: IngredientAvailability = {
        stockItemId,
        stockItemName: requirement.stockItemName,
        requiredQuantity: requiredQuantityInPrimaryUnit,
        availableQuantity,
        unitAbbreviation: requirement.unitAbbreviation,
        isAvailable: ingredientIsAvailable,
        deficit,
      };

      ingredientAvailability.push(availability);

      if (!ingredientIsAvailable) {
        isAvailable = false;
        unavailableIngredients.push(availability);
      }
    }

    // Handle case where no ingredients (shouldn't happen but be safe)
    if (minPortionsAvailable === Infinity) {
      minPortionsAvailable = 0;
    }

    const result: AvailabilityResult = {
      recipeId: recipe.id,
      recipeName: recipe.name,
      isAvailable,
      portionsAvailable: Math.floor(minPortionsAvailable),
      requestedPortions: portions,
      ingredients: ingredientAvailability,
      unavailableIngredients,
    };

    return { success: true, data: result };
  } catch (error) {
    console.error("Check Recipe Availability Error:", error);
    return { error: "Failed to check recipe availability" };
  }
}

/**
 * Helper function to get all ingredient requirements for a recipe (including sub-recipes)
 */
async function getRecipeIngredientRequirements(
  recipeId: string,
  portions: number
): Promise<Map<string, {
  stockItemId: string;
  stockItemName: string;
  requiredQuantity: number;
  unitId: string;
  unitAbbreviation: string;
  primaryUnitId: string;
}>> {
  const requirements = new Map<string, {
    stockItemId: string;
    stockItemName: string;
    requiredQuantity: number;
    unitId: string;
    unitAbbreviation: string;
    primaryUnitId: string;
  }>();

  const recipe = await db.recipe.findUnique({
    where: { id: recipeId },
    include: {
      ingredients: {
        include: {
          stockItem: {
            select: {
              id: true,
              name: true,
              primaryUnitId: true,
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
              yield: true,
            },
          },
        },
      },
    },
  });

  if (!recipe) {
    return requirements;
  }

  const recipeYield = Number(recipe.yield);
  const portionMultiplier = portions / recipeYield;

  // Add direct ingredients
  for (const ingredient of recipe.ingredients) {
    const requiredQty = Number(ingredient.quantity) * portionMultiplier;
    const existing = requirements.get(ingredient.stockItemId);
    
    if (existing) {
      existing.requiredQuantity += requiredQty;
    } else {
      requirements.set(ingredient.stockItemId, {
        stockItemId: ingredient.stockItemId,
        stockItemName: ingredient.stockItem.name,
        requiredQuantity: requiredQty,
        unitId: ingredient.unitId,
        unitAbbreviation: ingredient.unit.abbreviation,
        primaryUnitId: ingredient.stockItem.primaryUnitId,
      });
    }
  }

  // Recursively add sub-recipe ingredients
  for (const subRecipeRef of recipe.childRecipes) {
    const subRecipePortions = Number(subRecipeRef.quantity) * portionMultiplier;
    const subRecipeIngredients = await getRecipeIngredientRequirements(
      subRecipeRef.childRecipeId,
      subRecipePortions
    );

    for (const [stockItemId, requirement] of subRecipeIngredients) {
      const existing = requirements.get(stockItemId);
      
      if (existing) {
        existing.requiredQuantity += requirement.requiredQuantity;
      } else {
        requirements.set(stockItemId, requirement);
      }
    }
  }

  return requirements;
}

/**
 * Check availability for multiple recipes
 */
export async function checkMultipleRecipeAvailability(
  recipeIds: string[],
  warehouseId: string
): Promise<{ recipeId: string; recipeName: string; isAvailable: boolean; portionsAvailable: number; error?: string }[]> {
  const results: { recipeId: string; recipeName: string; isAvailable: boolean; portionsAvailable: number; error?: string }[] = [];

  for (const recipeId of recipeIds) {
    const availabilityResult = await checkRecipeAvailability(recipeId, warehouseId, 1);
    
    if ("error" in availabilityResult) {
      // Get recipe name for error reporting
      const recipe = await db.recipe.findUnique({
        where: { id: recipeId },
        select: { name: true },
      });
      
      results.push({
        recipeId,
        recipeName: recipe?.name || "Unknown",
        isAvailable: false,
        portionsAvailable: 0,
        error: availabilityResult.error,
      });
    } else {
      results.push({
        recipeId: availabilityResult.data.recipeId,
        recipeName: availabilityResult.data.recipeName,
        isAvailable: availabilityResult.data.isAvailable,
        portionsAvailable: availabilityResult.data.portionsAvailable,
      });
    }
  }

  return results;
}

/**
 * Get recipes that can be produced with current stock
 */
export async function getAvailableRecipes(warehouseId: string): Promise<{
  recipeId: string;
  recipeName: string;
  portionsAvailable: number;
}[]> {
  try {
    // Get all active recipes
    const recipes = await db.recipe.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    const availableRecipes: { recipeId: string; recipeName: string; portionsAvailable: number }[] = [];

    for (const recipe of recipes) {
      const availabilityResult = await checkRecipeAvailability(recipe.id, warehouseId, 1);
      
      if (!("error" in availabilityResult) && availabilityResult.data.isAvailable) {
        availableRecipes.push({
          recipeId: recipe.id,
          recipeName: recipe.name,
          portionsAvailable: availabilityResult.data.portionsAvailable,
        });
      }
    }

    // Sort by portions available (descending)
    availableRecipes.sort((a, b) => b.portionsAvailable - a.portionsAvailable);

    return availableRecipes;
  } catch (error) {
    console.error("Get Available Recipes Error:", error);
    return [];
  }
}
