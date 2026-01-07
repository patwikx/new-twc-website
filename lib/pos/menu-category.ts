"use server";

/**
 * Menu Category Management
 * 
 * CRUD operations for dynamic menu categories.
 */

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

interface CreateCategoryInput {
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  propertyId?: string | null;
  sortOrder?: number;
}

interface UpdateCategoryInput extends Partial<CreateCategoryInput> {
  isActive?: boolean;
}

/**
 * Create a new menu category
 */
export async function createCategory(data: CreateCategoryInput) {
  try {
    if (!data.name || data.name.trim() === "") {
      return { error: "Category name is required" };
    }

    // Check for duplicate name within property scope
    const existing = await db.menuCategory.findFirst({
      where: {
        name: data.name.trim(),
        propertyId: data.propertyId || null,
      },
    });

    if (existing) {
      return { error: "A category with this name already exists" };
    }

    const category = await db.menuCategory.create({
      data: {
        name: data.name.trim(),
        description: data.description || null,
        color: data.color || "orange",
        icon: data.icon || "UtensilsCrossed",
        propertyId: data.propertyId || null,
        sortOrder: data.sortOrder ?? 0,
        isActive: true,
      },
    });

    revalidatePath("/admin/pos/catalog/categories");
    revalidatePath("/admin/pos");
    revalidatePath("/admin/restaurant/menu");

    return { success: true, data: category };
  } catch (error) {
    console.error("Create Category Error:", error);
    return { error: "Failed to create category" };
  }
}

/**
 * Update an existing menu category
 */
export async function updateCategory(id: string, data: UpdateCategoryInput) {
  try {
    if (!id || id.trim() === "") {
      return { error: "Category ID is required" };
    }

    // Check if category exists
    const existing = await db.menuCategory.findUnique({
      where: { id },
    });

    if (!existing) {
      return { error: "Category not found" };
    }

    // If name is changing, check for duplicates
    if (data.name && data.name !== existing.name) {
      const duplicate = await db.menuCategory.findFirst({
        where: {
          name: data.name.trim(),
          propertyId: data.propertyId !== undefined ? data.propertyId : existing.propertyId,
          id: { not: id },
        },
      });

      if (duplicate) {
        return { error: "A category with this name already exists" };
      }
    }

    const category = await db.menuCategory.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.propertyId !== undefined && { propertyId: data.propertyId }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    revalidatePath("/admin/pos/catalog/categories");
    revalidatePath("/admin/pos");
    revalidatePath("/admin/restaurant/menu");

    return { success: true, data: category };
  } catch (error) {
    console.error("Update Category Error:", error);
    return { error: "Failed to update category" };
  }
}

/**
 * Delete a menu category
 */
export async function deleteCategory(id: string) {
  try {
    if (!id || id.trim() === "") {
      return { error: "Category ID is required" };
    }

    // Check if category exists
    const existing = await db.menuCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            menuItems: true,
          },
        },
      },
    });

    if (!existing) {
      return { error: "Category not found" };
    }

    // Check if category has menu items
    if (existing._count.menuItems > 0) {
      return { error: "Cannot delete category with associated menu items" };
    }

    await db.menuCategory.delete({
      where: { id },
    });

    revalidatePath("/admin/pos/catalog/categories");
    revalidatePath("/admin/pos");
    revalidatePath("/admin/restaurant/menu");

    return { success: true };
  } catch (error) {
    console.error("Delete Category Error:", error);
    return { error: "Failed to delete category" };
  }
}

/**
 * Get all categories for a property
 */
export async function getCategoriesForProperty(propertyId: string | null) {
  try {
    const categories = await db.menuCategory.findMany({
      where: {
        isActive: true,
        OR: [
          { propertyId: null }, // Global categories
          { propertyId: propertyId || undefined },
        ],
      },
      orderBy: [
        { sortOrder: "asc" },
        { name: "asc" },
      ],
    });

    return categories;
  } catch (error) {
    console.error("Get Categories Error:", error);
    return [];
  }
}

/**
 * Seed default categories (for migration from enum)
 */
export async function seedDefaultCategories() {
  const defaultCategories = [
    { name: "Appetizers", icon: "Salad", color: "green", sortOrder: 0 },
    { name: "Main Course", icon: "UtensilsCrossed", color: "orange", sortOrder: 1 },
    { name: "Desserts", icon: "IceCream", color: "pink", sortOrder: 2 },
    { name: "Beverages", icon: "Coffee", color: "blue", sortOrder: 3 },
    { name: "Side Dishes", icon: "Pizza", color: "yellow", sortOrder: 4 },
  ];

  try {
    for (const cat of defaultCategories) {
      // Check if exists
      const existing = await db.menuCategory.findFirst({
        where: { name: cat.name, propertyId: null },
      });

      if (!existing) {
        await db.menuCategory.create({
          data: {
            name: cat.name,
            icon: cat.icon,
            color: cat.color,
            sortOrder: cat.sortOrder,
            propertyId: null, // Global
            isActive: true,
          },
        });
      }
    }

    console.log("Default categories seeded successfully");
    return { success: true };
  } catch (error) {
    console.error("Seed Default Categories Error:", error);
    return { error: "Failed to seed default categories" };
  }
}
