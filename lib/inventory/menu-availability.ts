"use server";

/**
 * Menu Availability Service
 * 
 * Handles real-time availability checking for menu items based on:
 * - Recipe ingredient requirements
 * - Kitchen warehouse stock levels
 * - Minimum servings threshold
 * 
 * This service is called after orders are placed to update availability.
 */

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";

interface IngredientRequirement {
  stockItemId: string;
  stockItemName: string;
  requiredPerServing: number;
  unitAbbr: string;
  availableQty: number;
  possibleServings: number;
}

interface AvailabilityResult {
  menuItemId: string;
  menuItemName: string;
  isAvailable: boolean;
  availableServings: number;
  missingIngredients: string[];
  limitingIngredient?: string;
  threshold: number;
}

/**
 * Calculate how many servings of a menu item can be made based on current stock
 */
export async function calculateAvailableServings(
  menuItemId: string,
  kitchenWarehouseId: string
): Promise<AvailabilityResult | null> {
  try {
    // Get menu item with recipe and ingredients
    const menuItem = await db.menuItem.findUnique({
      where: { id: menuItemId },
      include: {
        recipe: {
          include: {
            ingredients: {
              include: {
                stockItem: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                unit: {
                  select: {
                    abbreviation: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!menuItem) {
      return null;
    }

    // If no recipe, menu item is always available
    if (!menuItem.recipe) {
      return {
        menuItemId: menuItem.id,
        menuItemName: menuItem.name,
        isAvailable: true,
        availableServings: 999, // Unlimited
        missingIngredients: [],
        threshold: 0,
      };
    }

    const recipe = menuItem.recipe;
    const recipeYield = new Decimal(recipe.yield.toString()).toNumber();
    const threshold = recipe.minimumServingsThreshold;
    
    // Get stock levels for all ingredients in the recipe
    const stockItemIds = recipe.ingredients.map((i) => i.stockItemId);
    
    const stockLevels = await db.stockLevel.findMany({
      where: {
        warehouseId: kitchenWarehouseId,
        stockItemId: { in: stockItemIds },
      },
    });

    const stockMap = new Map(
      stockLevels.map((s) => [s.stockItemId, new Decimal(s.quantity.toString()).toNumber()])
    );

    // Calculate possible servings for each ingredient
    const ingredientRequirements: IngredientRequirement[] = [];
    const missingIngredients: string[] = [];
    let minServings = Infinity;
    let limitingIngredient: string | undefined;

    for (const ingredient of recipe.ingredients) {
      const requiredQty = new Decimal(ingredient.quantity.toString()).toNumber();
      const requiredPerServing = requiredQty / recipeYield;
      const availableQty = stockMap.get(ingredient.stockItemId) || 0;
      const possibleServings = availableQty > 0 ? Math.floor(availableQty / requiredPerServing) : 0;

      ingredientRequirements.push({
        stockItemId: ingredient.stockItemId,
        stockItemName: ingredient.stockItem.name,
        requiredPerServing,
        unitAbbr: ingredient.unit.abbreviation,
        availableQty,
        possibleServings,
      });

      if (possibleServings === 0) {
        missingIngredients.push(ingredient.stockItem.name);
      }

      if (possibleServings < minServings) {
        minServings = possibleServings;
        limitingIngredient = ingredient.stockItem.name;
      }
    }

    const availableServings = minServings === Infinity ? 999 : minServings;
    const isAvailable = availableServings >= threshold;

    return {
      menuItemId: menuItem.id,
      menuItemName: menuItem.name,
      isAvailable,
      availableServings,
      missingIngredients,
      limitingIngredient: availableServings < threshold ? limitingIngredient : undefined,
      threshold,
    };
  } catch (error) {
    console.error("Calculate Available Servings Error:", error);
    return null;
  }
}

/**
 * Update a single menu item's availability based on current stock
 */
export async function updateMenuItemAvailability(
  menuItemId: string,
  kitchenWarehouseId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const availability = await calculateAvailableServings(menuItemId, kitchenWarehouseId);

    if (!availability) {
      return { success: false, error: "Menu item not found" };
    }

    // Build unavailable reason
    let unavailableReason: string | null = null;
    if (!availability.isAvailable) {
      if (availability.missingIngredients.length > 0) {
        unavailableReason = `Out of stock: ${availability.missingIngredients.join(", ")}`;
      } else if (availability.limitingIngredient) {
        unavailableReason = `Low stock: ${availability.limitingIngredient} (${availability.availableServings} servings left)`;
      } else {
        unavailableReason = "Insufficient ingredients";
      }
    }

    // Update the menu item
    await db.menuItem.update({
      where: { id: menuItemId },
      data: {
        isAvailable: availability.isAvailable,
        unavailableReason,
        availableServings: availability.availableServings,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Update Menu Item Availability Error:", error);
    return { success: false, error: "Failed to update availability" };
  }
}

/**
 * Update availability for all menu items at an outlet
 * Called after stock movements or periodically
 */
export async function updateMenuAvailabilityForProperty(
  propertyId: string
): Promise<{ success: boolean; updated: number; errors: string[] }> {
  try {
    // Get the kitchen warehouse for this property
    const kitchenWarehouse = await db.warehouse.findFirst({
      where: {
        propertyId,
        type: "KITCHEN",
        isActive: true,
      },
    });

    if (!kitchenWarehouse) {
      return { success: false, updated: 0, errors: ["No kitchen warehouse found for property"] };
    }

    // Get all menu items for this property that have recipes
    const menuItems = await db.menuItem.findMany({
      where: {
        propertyId,
        recipeId: { not: null },
      },
      select: { id: true },
    });

    let updated = 0;
    const errors: string[] = [];

    for (const item of menuItems) {
      const result = await updateMenuItemAvailability(item.id, kitchenWarehouse.id);
      if (result.success) {
        updated++;
      } else {
        errors.push(`${item.id}: ${result.error}`);
      }
    }

    revalidatePath("/admin/pos");
    revalidatePath("/admin/restaurant/menu");

    return { success: true, updated, errors };
  } catch (error) {
    console.error("Update Menu Availability For Property Error:", error);
    return { success: false, updated: 0, errors: ["Failed to update availability"] };
  }
}

/**
 * Update availability for menu items affected by a specific stock item change
 * Called in real-time after orders are placed
 */
export async function updateAvailabilityForStockItem(
  stockItemId: string,
  propertyId: string
): Promise<{ success: boolean; affected: number }> {
  try {
    // Get kitchen warehouse for property
    const kitchenWarehouse = await db.warehouse.findFirst({
      where: {
        propertyId,
        type: "KITCHEN",
        isActive: true,
      },
    });

    if (!kitchenWarehouse) {
      return { success: false, affected: 0 };
    }

    // Find recipes that use this stock item
    const recipesWithIngredient = await db.recipeIngredient.findMany({
      where: { stockItemId },
      select: { recipeId: true },
    });

    const recipeIds = [...new Set(recipesWithIngredient.map((r) => r.recipeId))];

    // Find menu items that use these recipes
    const menuItems = await db.menuItem.findMany({
      where: {
        propertyId,
        recipeId: { in: recipeIds },
      },
      select: { id: true },
    });

    let affected = 0;
    for (const item of menuItems) {
      const result = await updateMenuItemAvailability(item.id, kitchenWarehouse.id);
      if (result.success) affected++;
    }

    if (affected > 0) {
      revalidatePath("/admin/pos");
    }

    return { success: true, affected };
  } catch (error) {
    console.error("Update Availability For Stock Item Error:", error);
    return { success: false, affected: 0 };
  }
}

/**
 * Get availability summary for POS display
 */
export async function getMenuAvailabilitySummary(propertyId: string) {
  try {
    const kitchenWarehouse = await db.warehouse.findFirst({
      where: {
        propertyId,
        type: "KITCHEN",
        isActive: true,
      },
    });

    if (!kitchenWarehouse) {
      return { total: 0, available: 0, unavailable: 0, noRecipe: 0 };
    }

    const menuItems = await db.menuItem.findMany({
      where: { propertyId },
      select: {
        isAvailable: true,
        recipeId: true,
      },
    });

    const total = menuItems.length;
    const noRecipe = menuItems.filter((m) => !m.recipeId).length;
    const available = menuItems.filter((m) => m.isAvailable).length;
    const unavailable = menuItems.filter((m) => !m.isAvailable).length;

    return { total, available, unavailable, noRecipe };
  } catch (error) {
    console.error("Get Menu Availability Summary Error:", error);
    return { total: 0, available: 0, unavailable: 0, noRecipe: 0 };
  }
}
