"use server";

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

// Re-export types from utils for backward compatibility
export type { CategoryDeletionContext, CategoryDeletionResult } from "./stock-category-utils";

// Types
export interface CreateStockCategoryInput {
  name: string;
  description?: string;
  color?: string;
}

export interface UpdateStockCategoryInput {
  name?: string;
  description?: string | null;
  color?: string | null;
  isActive?: boolean;
}

// CRUD Operations

/**
 * Create a new stock category
 */
export async function createStockCategory(data: CreateStockCategoryInput) {
  if (!data.name || data.name.trim() === "") {
    return { error: "Category name is required" };
  }

  try {
    const category = await db.stockCategory.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        color: data.color?.trim() || null,
        isSystem: false,
        isActive: true,
      },
    });

    revalidatePath("/admin/inventory/categories");
    revalidatePath("/admin/inventory/items");
    return { success: true, data: category };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { error: "A category with this name already exists" };
      }
    }
    console.error("Create Stock Category Error:", error);
    return { error: "Failed to create category" };
  }
}

/**
 * Get a stock category by ID
 */
export async function getStockCategoryById(id: string) {
  try {
    const category = await db.stockCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            stockItems: true,
          },
        },
      },
    });

    return category;
  } catch (error) {
    console.error("Get Stock Category Error:", error);
    return null;
  }
}

/**
 * Get all stock categories
 */
export async function getAllStockCategories() {
  try {
    const categories = await db.stockCategory.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            stockItems: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return categories;
  } catch (error) {
    console.error("Get All Stock Categories Error:", error);
    return [];
  }
}

/**
 * Get all stock categories including inactive
 */
export async function getAllStockCategoriesAdmin() {
  try {
    const categories = await db.stockCategory.findMany({
      include: {
        _count: {
          select: {
            stockItems: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return categories;
  } catch (error) {
    console.error("Get All Stock Categories Admin Error:", error);
    return [];
  }
}

/**
 * Update a stock category
 */
export async function updateStockCategory(id: string, data: UpdateStockCategoryInput) {
  try {
    // Check if it's a system category
    const existing = await db.stockCategory.findUnique({ where: { id } });
    if (!existing) {
      return { error: "Category not found" };
    }

    if (existing.isSystem && data.name && data.name !== existing.name) {
      return { error: "Cannot rename system categories" };
    }

    const updateData: Prisma.StockCategoryUpdateInput = {};

    if (data.name !== undefined) {
      if (!data.name || data.name.trim() === "") {
        return { error: "Category name cannot be empty" };
      }
      updateData.name = data.name.trim();
    }

    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }

    if (data.color !== undefined) {
      updateData.color = data.color?.trim() || null;
    }

    if (data.isActive !== undefined) {
      if (existing.isSystem && !data.isActive) {
        return { error: "Cannot deactivate system categories" };
      }
      updateData.isActive = data.isActive;
    }

    const category = await db.stockCategory.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/admin/inventory/categories");
    revalidatePath("/admin/inventory/items");
    return { success: true, data: category };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { error: "A category with this name already exists" };
      }
      if (error.code === "P2025") {
        return { error: "Category not found" };
      }
    }
    console.error("Update Stock Category Error:", error);
    return { error: "Failed to update category" };
  }
}

/**
 * Delete a stock category
 * Note: System categories and categories with stock items cannot be deleted
 */
export async function deleteStockCategory(id: string) {
  try {
    const category = await db.stockCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            stockItems: true,
          },
        },
      },
    });

    if (!category) {
      return { error: "Category not found" };
    }

    if (category.isSystem) {
      return { error: "Cannot delete system categories" };
    }

    if (category._count.stockItems > 0) {
      return { error: "Cannot delete category with existing stock items. Deactivate instead." };
    }

    await db.stockCategory.delete({
      where: { id },
    });

    revalidatePath("/admin/inventory/categories");
    return { success: true };
  } catch (error) {
    console.error("Delete Stock Category Error:", error);
    return { error: "Failed to delete category" };
  }
}

// Default categories to seed
export const DEFAULT_STOCK_CATEGORIES = [
  { name: "Ingredient", description: "Food and beverage ingredients", color: "orange", isSystem: true },
  { name: "Linen", description: "Bed sheets, towels, and linens", color: "blue", isSystem: true },
  { name: "Consumable", description: "Cleaning supplies and disposables", color: "green", isSystem: true },
  { name: "Consignment", description: "Supplier-owned items for resale", color: "purple", isSystem: true },
  { name: "Equipment", description: "Tools and equipment", color: "cyan", isSystem: true },
];

/**
 * Seed default stock categories
 */
export async function seedStockCategories() {
  try {
    for (const cat of DEFAULT_STOCK_CATEGORIES) {
      await db.stockCategory.upsert({
        where: { name: cat.name },
        update: {},
        create: {
          name: cat.name,
          description: cat.description,
          color: cat.color,
          isSystem: cat.isSystem,
          isActive: true,
        },
      });
    }
    console.log("Stock categories seeded successfully");
    return { success: true };
  } catch (error) {
    console.error("Seed Stock Categories Error:", error);
    return { error: "Failed to seed categories" };
  }
}
