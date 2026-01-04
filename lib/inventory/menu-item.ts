"use server";

import { db } from "@/lib/db";
import { Prisma, MenuCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Decimal from "decimal.js";
import { calculateRecipeCost, checkRecipeAvailability } from "./recipe";
import { getPropertyFilter } from "@/lib/property-context";

// Types
export interface CreateMenuItemInput {
  propertyId: string;
  name: string;
  description?: string;
  category: MenuCategory;
  sellingPrice: number;
  recipeId?: string;
  image?: string;
}

export interface UpdateMenuItemInput {
  name?: string;
  description?: string;
  category?: MenuCategory;
  sellingPrice?: number;
  recipeId?: string | null;
  image?: string | null;
  isAvailable?: boolean;
  unavailableReason?: string | null;
}

export interface MenuItemProfitability {
  menuItemId: string;
  menuItemName: string;
  sellingPrice: number;
  recipeCost: number;
  costPerPortion: number;
  grossProfit: number;
  foodCostPercentage: number;
  isAboveTargetCost: boolean;
}

// Default target food cost percentage (35%)
const TARGET_FOOD_COST_PERCENTAGE = 35;

// Valid menu categories
const VALID_MENU_CATEGORIES: MenuCategory[] = [
  "APPETIZER",
  "MAIN_COURSE",
  "DESSERT",
  "BEVERAGE",
  "SIDE_DISH",
];

// ============================================================================
// Menu Item CRUD Operations
// ============================================================================

/**
 * Create a new menu item
 * Requirements: 5.1, 5.2, 5.3
 * 
 * Property 18: Menu Item Required Fields
 * For any menu item creation, it SHALL have non-null values for: name, category,
 * and sellingPrice > 0. Items without these fields SHALL be rejected.
 * 
 * Property 19: Menu Category Validation
 * For any menu item category value, it SHALL be one of: APPETIZER, MAIN_COURSE,
 * DESSERT, BEVERAGE, or SIDE_DISH. Any other value SHALL be rejected.
 */
export async function createMenuItem(data: CreateMenuItemInput) {
  // Property 18: Validate required fields
  if (!data.propertyId || data.propertyId.trim() === "") {
    return { error: "Property ID is required" };
  }

  if (!data.name || data.name.trim() === "") {
    return { error: "Menu item name is required" };
  }

  if (!data.category) {
    return { error: "Menu item category is required" };
  }

  // Property 19: Validate category
  if (!VALID_MENU_CATEGORIES.includes(data.category)) {
    return {
      error: `Invalid category. Must be one of: ${VALID_MENU_CATEGORIES.join(", ")}`,
    };
  }

  // Property 18: Validate selling price
  if (data.sellingPrice === undefined || data.sellingPrice === null || data.sellingPrice <= 0) {
    return { error: "Selling price must be greater than zero" };
  }

  try {
    // Verify property exists
    const property = await db.property.findUnique({
      where: { id: data.propertyId },
    });

    if (!property) {
      return { error: "Property not found" };
    }

    // Verify recipe exists if provided
    if (data.recipeId) {
      const recipe = await db.recipe.findUnique({
        where: { id: data.recipeId },
      });

      if (!recipe) {
        return { error: "Recipe not found" };
      }

      if (!recipe.isActive) {
        return { error: "Cannot associate with an inactive recipe" };
      }
    }

    // Create menu item
    const menuItem = await db.menuItem.create({
      data: {
        propertyId: data.propertyId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        category: data.category,
        sellingPrice: data.sellingPrice,
        recipeId: data.recipeId || null,
        image: data.image || null,
        isAvailable: true,
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
          },
        },
        recipe: {
          select: {
            id: true,
            name: true,
            yield: true,
          },
        },
      },
    });

    revalidatePath("/admin/restaurant/menu");
    return { success: true, data: menuItem };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { error: "A menu item with this name already exists" };
      }
    }
    console.error("Create Menu Item Error:", error);
    return { error: "Failed to create menu item" };
  }
}

/**
 * Get a menu item by ID
 */
export async function getMenuItemById(id: string) {
  try {
    const menuItem = await db.menuItem.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        recipe: {
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
        _count: {
          select: {
            cogsRecords: true,
          },
        },
      },
    });

    return menuItem;
  } catch (error) {
    console.error("Get Menu Item Error:", error);
    return null;
  }
}

/**
 * Get all menu items with optional filtering
 * Requirements: 1.1, 1.2
 * 
 * Property 1: Property Scope Filtering
 * For any data query executed while a user has a specific property selected,
 * all returned records SHALL belong to that property.
 */
export async function getMenuItems(options?: {
  propertyId?: string;
  category?: MenuCategory;
  isAvailable?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  try {
    const where: Prisma.MenuItemWhereInput = {};

    // Apply property context filtering (Requirements 1.1, 1.2)
    if (options?.propertyId) {
      where.propertyId = options.propertyId;
    } else {
      // Get property filter from context
      const propertyFilter = await getPropertyFilter();
      if (propertyFilter.propertyId) {
        where.propertyId = propertyFilter.propertyId;
      }
    }

    if (options?.category) {
      where.category = options.category;
    }

    if (options?.isAvailable !== undefined) {
      where.isAvailable = options.isAvailable;
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

    const [menuItems, total] = await Promise.all([
      db.menuItem.findMany({
        where,
        include: {
          property: {
            select: {
              id: true,
              name: true,
            },
          },
          recipe: {
            select: {
              id: true,
              name: true,
              yield: true,
            },
          },
        },
        orderBy: [{ category: "asc" }, { name: "asc" }],
        skip,
        take: pageSize,
      }),
      db.menuItem.count({ where }),
    ]);

    return {
      menuItems,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Get Menu Items Error:", error);
    return {
      menuItems: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    };
  }
}

/**
 * Get menu items by property (for public display)
 */
export async function getMenuItemsByProperty(propertyId: string) {
  try {
    const menuItems = await db.menuItem.findMany({
      where: {
        propertyId,
        isAvailable: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        sellingPrice: true,
        image: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    // Group by category
    const groupedItems = menuItems.reduce(
      (acc, item) => {
        if (!acc[item.category]) {
          acc[item.category] = [];
        }
        acc[item.category].push(item);
        return acc;
      },
      {} as Record<MenuCategory, typeof menuItems>
    );

    return groupedItems;
  } catch (error) {
    console.error("Get Menu Items By Property Error:", error);
    return {};
  }
}

/**
 * Update a menu item
 * Requirements: 5.1, 5.2, 5.3
 */
export async function updateMenuItem(id: string, data: UpdateMenuItemInput) {
  try {
    // Validate menu item exists
    const existingItem = await db.menuItem.findUnique({
      where: { id },
    });

    if (!existingItem) {
      return { error: "Menu item not found" };
    }

    const updateData: Prisma.MenuItemUpdateInput = {};

    // Validate and set name
    if (data.name !== undefined) {
      if (!data.name || data.name.trim() === "") {
        return { error: "Menu item name cannot be empty" };
      }
      updateData.name = data.name.trim();
    }

    // Set description
    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }

    // Validate and set category
    if (data.category !== undefined) {
      if (!VALID_MENU_CATEGORIES.includes(data.category)) {
        return {
          error: `Invalid category. Must be one of: ${VALID_MENU_CATEGORIES.join(", ")}`,
        };
      }
      updateData.category = data.category;
    }

    // Validate and set selling price
    if (data.sellingPrice !== undefined) {
      if (data.sellingPrice <= 0) {
        return { error: "Selling price must be greater than zero" };
      }
      updateData.sellingPrice = data.sellingPrice;
    }

    // Validate and set recipe
    if (data.recipeId !== undefined) {
      if (data.recipeId === null) {
        updateData.recipe = { disconnect: true };
      } else {
        const recipe = await db.recipe.findUnique({
          where: { id: data.recipeId },
        });

        if (!recipe) {
          return { error: "Recipe not found" };
        }

        if (!recipe.isActive) {
          return { error: "Cannot associate with an inactive recipe" };
        }

        updateData.recipe = { connect: { id: data.recipeId } };
      }
    }

    // Set image
    if (data.image !== undefined) {
      updateData.image = data.image || null;
    }

    // Set availability
    if (data.isAvailable !== undefined) {
      updateData.isAvailable = data.isAvailable;
    }

    // Set unavailable reason
    if (data.unavailableReason !== undefined) {
      updateData.unavailableReason = data.unavailableReason || null;
    }

    const menuItem = await db.menuItem.update({
      where: { id },
      data: updateData,
      include: {
        property: {
          select: {
            id: true,
            name: true,
          },
        },
        recipe: {
          select: {
            id: true,
            name: true,
            yield: true,
          },
        },
      },
    });

    revalidatePath("/admin/restaurant/menu");
    revalidatePath(`/admin/restaurant/menu/${id}`);
    return { success: true, data: menuItem };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Menu item not found" };
      }
    }
    console.error("Update Menu Item Error:", error);
    return { error: "Failed to update menu item" };
  }
}

/**
 * Delete a menu item
 */
export async function deleteMenuItem(id: string) {
  try {
    // Check if menu item has COGS records
    const cogsCount = await db.cOGSRecord.count({
      where: { menuItemId: id },
    });

    if (cogsCount > 0) {
      return {
        error: "Cannot delete menu item with sales history. Consider marking it unavailable instead.",
      };
    }

    await db.menuItem.delete({
      where: { id },
    });

    revalidatePath("/admin/restaurant/menu");
    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Menu item not found" };
      }
    }
    console.error("Delete Menu Item Error:", error);
    return { error: "Failed to delete menu item" };
  }
}


// ============================================================================
// Menu Availability and COGS Tracking
// ============================================================================

/**
 * Set a menu item as unavailable with a reason
 * Requirements: 5.4
 * 
 * Property 20: Menu Unavailability Tracking
 * For any menu item marked as unavailable (isAvailable = false), the unavailableReason
 * field SHALL be non-null and non-empty.
 */
export async function setMenuItemUnavailable(id: string, reason: string) {
  // Property 20: Validate reason is provided
  if (!reason || reason.trim() === "") {
    return { error: "Unavailable reason is required when marking item unavailable" };
  }

  try {
    const menuItem = await db.menuItem.update({
      where: { id },
      data: {
        isAvailable: false,
        unavailableReason: reason.trim(),
      },
      include: {
        recipe: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    revalidatePath("/admin/restaurant/menu");
    revalidatePath(`/admin/restaurant/menu/${id}`);
    return { success: true, data: menuItem };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Menu item not found" };
      }
    }
    console.error("Set Menu Item Unavailable Error:", error);
    return { error: "Failed to update menu item availability" };
  }
}

/**
 * Set a menu item as available (clears unavailable reason)
 */
export async function setMenuItemAvailable(id: string) {
  try {
    const menuItem = await db.menuItem.update({
      where: { id },
      data: {
        isAvailable: true,
        unavailableReason: null,
      },
      include: {
        recipe: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    revalidatePath("/admin/restaurant/menu");
    revalidatePath(`/admin/restaurant/menu/${id}`);
    return { success: true, data: menuItem };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Menu item not found" };
      }
    }
    console.error("Set Menu Item Available Error:", error);
    return { error: "Failed to update menu item availability" };
  }
}


/**
 * Calculate food cost percentage for a menu item
 * Requirements: 7.4
 * 
 * Property 26: Food Cost Percentage Calculation
 * For any menu item with recipe cost C and selling price P, the food cost percentage
 * SHALL equal (C / P) × 100.
 */
export async function calculateMenuItemFoodCostPercentage(
  menuItemId: string,
  warehouseId: string
): Promise<{ success: true; data: MenuItemProfitability } | { error: string }> {
  try {
    const menuItem = await db.menuItem.findUnique({
      where: { id: menuItemId },
      include: {
        recipe: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!menuItem) {
      return { error: "Menu item not found" };
    }

    if (!menuItem.recipeId) {
      return { error: "Menu item has no associated recipe" };
    }

    // Calculate recipe cost
    const costResult = await calculateRecipeCost(menuItem.recipeId, warehouseId);

    if ("error" in costResult) {
      return costResult;
    }

    const sellingPrice = new Decimal(menuItem.sellingPrice.toString());
    const costPerPortion = new Decimal(costResult.data.costPerPortion);

    // Property 26: Food cost percentage = (cost / price) × 100
    const foodCostPercentage = sellingPrice.isZero()
      ? new Decimal(0)
      : costPerPortion.div(sellingPrice).mul(100);

    const grossProfit = sellingPrice.sub(costPerPortion);
    const isAboveTargetCost = foodCostPercentage.greaterThan(TARGET_FOOD_COST_PERCENTAGE);

    const profitability: MenuItemProfitability = {
      menuItemId: menuItem.id,
      menuItemName: menuItem.name,
      sellingPrice: sellingPrice.toNumber(),
      recipeCost: costResult.data.totalCost,
      costPerPortion: costPerPortion.toDecimalPlaces(4).toNumber(),
      grossProfit: grossProfit.toDecimalPlaces(2).toNumber(),
      foodCostPercentage: foodCostPercentage.toDecimalPlaces(2).toNumber(),
      isAboveTargetCost,
    };

    return { success: true, data: profitability };
  } catch (error) {
    console.error("Calculate Menu Item Food Cost Error:", error);
    return { error: "Failed to calculate food cost percentage" };
  }
}


/**
 * Record COGS when a menu item is sold
 * Requirements: 7.5
 * 
 * Property 27: COGS Snapshot at Sale Time
 * For any menu item sale, the system SHALL create a COGSRecord with the recipe cost
 * calculated at the time of sale, not a reference to a dynamically calculated value.
 */
export async function recordMenuItemSale(
  menuItemId: string,
  warehouseId: string,
  quantity: number
): Promise<{ success: true; data: { cogsRecord: unknown; totalCost: number } } | { error: string }> {
  if (quantity <= 0) {
    return { error: "Quantity must be greater than zero" };
  }

  try {
    const menuItem = await db.menuItem.findUnique({
      where: { id: menuItemId },
      include: {
        recipe: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!menuItem) {
      return { error: "Menu item not found" };
    }

    if (!menuItem.recipeId) {
      return { error: "Menu item has no associated recipe for COGS tracking" };
    }

    if (!menuItem.isAvailable) {
      return { error: "Cannot record sale for unavailable menu item" };
    }

    // Calculate recipe cost at time of sale
    const costResult = await calculateRecipeCost(menuItem.recipeId, warehouseId);

    if ("error" in costResult) {
      return { error: `Failed to calculate COGS: ${costResult.error}` };
    }

    const unitCost = new Decimal(costResult.data.costPerPortion);
    const totalCost = unitCost.mul(quantity);
    const sellingPrice = new Decimal(menuItem.sellingPrice.toString());

    // Property 27: Create COGS snapshot record
    const cogsRecord = await db.cOGSRecord.create({
      data: {
        menuItemId: menuItem.id,
        recipeId: menuItem.recipeId,
        quantity,
        unitCost: unitCost.toDecimalPlaces(4).toNumber(),
        totalCost: totalCost.toDecimalPlaces(2).toNumber(),
        sellingPrice: sellingPrice.toDecimalPlaces(2).toNumber(),
      },
    });

    return {
      success: true,
      data: {
        cogsRecord,
        totalCost: totalCost.toDecimalPlaces(2).toNumber(),
      },
    };
  } catch (error) {
    console.error("Record Menu Item Sale Error:", error);
    return { error: "Failed to record menu item sale" };
  }
}


/**
 * Check menu item availability based on stock
 * Requirements: 5.5
 * 
 * Property 21: Menu Availability Based on Stock
 * For any menu item with an associated recipe, the item SHALL be marked available
 * if and only if all recipe ingredients have sufficient stock in the kitchen warehouse
 * to produce at least one portion.
 */
export async function checkMenuItemAvailability(
  menuItemId: string,
  warehouseId: string
): Promise<{ success: true; data: { isAvailable: boolean; portionsAvailable: number; reason?: string } } | { error: string }> {
  try {
    const menuItem = await db.menuItem.findUnique({
      where: { id: menuItemId },
      include: {
        recipe: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!menuItem) {
      return { error: "Menu item not found" };
    }

    // If no recipe, availability is based on manual setting
    if (!menuItem.recipeId) {
      return {
        success: true,
        data: {
          isAvailable: menuItem.isAvailable,
          portionsAvailable: menuItem.isAvailable ? Infinity : 0,
          reason: menuItem.isAvailable ? undefined : menuItem.unavailableReason || "Manually set unavailable",
        },
      };
    }

    // Check recipe availability
    const availabilityResult = await checkRecipeAvailability(menuItem.recipeId, warehouseId, 1);

    if ("error" in availabilityResult) {
      return { error: `Failed to check availability: ${availabilityResult.error}` };
    }

    const recipeAvailability = availabilityResult.data;

    // Property 21: Available if all ingredients have sufficient stock
    let reason: string | undefined;
    if (!recipeAvailability.isAvailable) {
      const missingIngredients = recipeAvailability.unavailableIngredients
        .map((i) => i.stockItemName)
        .join(", ");
      reason = `Insufficient stock for: ${missingIngredients}`;
    }

    return {
      success: true,
      data: {
        isAvailable: recipeAvailability.isAvailable,
        portionsAvailable: recipeAvailability.portionsAvailable,
        reason,
      },
    };
  } catch (error) {
    console.error("Check Menu Item Availability Error:", error);
    return { error: "Failed to check menu item availability" };
  }
}


/**
 * Update menu item availability based on current stock levels
 * This can be called periodically or after stock changes
 */
export async function updateMenuItemAvailabilityFromStock(
  menuItemId: string,
  warehouseId: string
): Promise<{ success: true; data: { menuItemId: string; isAvailable: boolean; reason?: string } } | { error: string }> {
  const availabilityResult = await checkMenuItemAvailability(menuItemId, warehouseId);

  if ("error" in availabilityResult) {
    return availabilityResult;
  }

  const { isAvailable, reason } = availabilityResult.data;

  try {
    await db.menuItem.update({
      where: { id: menuItemId },
      data: {
        isAvailable,
        unavailableReason: isAvailable ? null : reason || "Out of stock",
      },
    });

    revalidatePath("/admin/restaurant/menu");
    return {
      success: true,
      data: {
        menuItemId,
        isAvailable,
        reason,
      },
    };
  } catch (error) {
    console.error("Update Menu Item Availability Error:", error);
    return { error: "Failed to update menu item availability" };
  }
}

/**
 * Get menu items with profitability analysis
 * Requirements: 7.4, 7.6
 * 
 * Property 28: Food Cost Alert Threshold
 * For any menu item where the food cost percentage exceeds the configured target (e.g., 35%),
 * the system SHALL flag that item as above target cost in profitability reports.
 */
export async function getMenuItemsProfitability(
  propertyId: string,
  warehouseId: string
): Promise<MenuItemProfitability[]> {
  try {
    const menuItems = await db.menuItem.findMany({
      where: {
        propertyId,
        recipeId: { not: null },
      },
      include: {
        recipe: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const profitabilityResults: MenuItemProfitability[] = [];

    for (const menuItem of menuItems) {
      const result = await calculateMenuItemFoodCostPercentage(menuItem.id, warehouseId);

      if ("success" in result) {
        profitabilityResults.push(result.data);
      }
    }

    // Sort by food cost percentage (highest first to highlight problem items)
    profitabilityResults.sort((a, b) => b.foodCostPercentage - a.foodCostPercentage);

    return profitabilityResults;
  } catch (error) {
    console.error("Get Menu Items Profitability Error:", error);
    return [];
  }
}


/**
 * Get COGS history for a menu item
 */
export async function getMenuItemCOGSHistory(
  menuItemId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
  }
) {
  try {
    const where: Prisma.COGSRecordWhereInput = {
      menuItemId,
    };

    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) {
        where.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        where.createdAt.lte = options.endDate;
      }
    }

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const [records, total, aggregates] = await Promise.all([
      db.cOGSRecord.findMany({
        where,
        include: {
          recipe: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.cOGSRecord.count({ where }),
      db.cOGSRecord.aggregate({
        where,
        _sum: {
          quantity: true,
          totalCost: true,
        },
        _avg: {
          unitCost: true,
        },
      }),
    ]);

    return {
      records,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      summary: {
        totalQuantitySold: aggregates._sum.quantity || 0,
        totalCOGS: aggregates._sum.totalCost?.toNumber() || 0,
        averageUnitCost: aggregates._avg.unitCost?.toNumber() || 0,
      },
    };
  } catch (error) {
    console.error("Get Menu Item COGS History Error:", error);
    return {
      records: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
      summary: { totalQuantitySold: 0, totalCOGS: 0, averageUnitCost: 0 },
    };
  }
}

/**
 * Get COGS summary report for a property
 */
export async function getCOGSSummaryReport(
  propertyId: string,
  startDate: Date,
  endDate: Date
) {
  try {
    const menuItems = await db.menuItem.findMany({
      where: { propertyId },
      select: { id: true, name: true, category: true, sellingPrice: true },
    });

    const menuItemIds = menuItems.map((m) => m.id);

    const cogsRecords = await db.cOGSRecord.groupBy({
      by: ["menuItemId"],
      where: {
        menuItemId: { in: menuItemIds },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        quantity: true,
        totalCost: true,
      },
    });

    const report = menuItems.map((menuItem) => {
      const cogsData = cogsRecords.find((r) => r.menuItemId === menuItem.id);
      const quantitySold = cogsData?._sum.quantity || 0;
      const totalCOGS = cogsData?._sum.totalCost?.toNumber() || 0;
      const totalRevenue = Number(menuItem.sellingPrice) * quantitySold;
      const grossProfit = totalRevenue - totalCOGS;
      const foodCostPercentage = totalRevenue > 0 ? (totalCOGS / totalRevenue) * 100 : 0;

      return {
        menuItemId: menuItem.id,
        menuItemName: menuItem.name,
        category: menuItem.category,
        quantitySold,
        totalRevenue,
        totalCOGS,
        grossProfit,
        foodCostPercentage: Math.round(foodCostPercentage * 100) / 100,
        isAboveTargetCost: foodCostPercentage > TARGET_FOOD_COST_PERCENTAGE,
      };
    });

    // Calculate totals
    const totals = report.reduce(
      (acc, item) => ({
        totalQuantitySold: acc.totalQuantitySold + item.quantitySold,
        totalRevenue: acc.totalRevenue + item.totalRevenue,
        totalCOGS: acc.totalCOGS + item.totalCOGS,
        totalGrossProfit: acc.totalGrossProfit + item.grossProfit,
      }),
      { totalQuantitySold: 0, totalRevenue: 0, totalCOGS: 0, totalGrossProfit: 0 }
    );

    const overallFoodCostPercentage =
      totals.totalRevenue > 0 ? (totals.totalCOGS / totals.totalRevenue) * 100 : 0;

    return {
      items: report.filter((r) => r.quantitySold > 0).sort((a, b) => b.totalRevenue - a.totalRevenue),
      totals: {
        ...totals,
        overallFoodCostPercentage: Math.round(overallFoodCostPercentage * 100) / 100,
      },
      period: { startDate, endDate },
    };
  } catch (error) {
    console.error("Get COGS Summary Report Error:", error);
    return {
      items: [],
      totals: {
        totalQuantitySold: 0,
        totalRevenue: 0,
        totalCOGS: 0,
        totalGrossProfit: 0,
        overallFoodCostPercentage: 0,
      },
      period: { startDate, endDate },
    };
  }
}
