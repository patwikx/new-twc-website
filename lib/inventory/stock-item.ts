"use server";

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getPropertyFilter } from "@/lib/property-context";

// Types
export interface CreateStockItemInput {
  propertyId: string;
  name: string;
  sku?: string; // Optional manual SKU
  categoryId: string;
  primaryUnitId: string;
  isConsignment?: boolean;
  supplierId?: string;
}

export interface UpdateStockItemInput {
  name?: string;
  sku?: string | null;
  categoryId?: string;
  primaryUnitId?: string;
  isConsignment?: boolean;
  supplierId?: string | null;
  isActive?: boolean;
}

export interface StockItemSearchQuery {
  propertyId?: string;
  categoryId?: string;
  isConsignment?: boolean;
  isActive?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface SetParLevelInput {
  stockItemId: string;
  warehouseId: string;
  parLevel: number;
}

export interface LowStockAlert {
  stockItemId: string;
  stockItemName: string;
  stockItemCode: string;
  warehouseId: string;
  warehouseName: string;
  currentQuantity: number;
  parLevel: number;
  deficit: number;
  unit: string;
}

/**
 * Generate the next item code in sequence (ITM-0001, ITM-0002, etc.)
 */
async function generateItemCode(): Promise<string> {
  // Get the highest existing item code
  const lastItem = await db.stockItem.findFirst({
    where: {
      itemCode: {
        startsWith: "ITM-",
      },
    },
    orderBy: {
      itemCode: "desc",
    },
    select: {
      itemCode: true,
    },
  });

  let nextNumber = 1;
  if (lastItem?.itemCode) {
    const match = lastItem.itemCode.match(/ITM-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `ITM-${nextNumber.toString().padStart(4, "0")}`;
}

// CRUD Operations

/**
 * Create a new stock item
 * Requirements: 2.1, 2.2, 2.4
 */
export async function createStockItem(data: CreateStockItemInput) {
  // Validate required fields
  if (!data.propertyId || data.propertyId.trim() === "") {
    return { error: "Property ID is required" };
  }

  if (!data.name || data.name.trim() === "") {
    return { error: "Stock item name is required" };
  }

  if (!data.categoryId || data.categoryId.trim() === "") {
    return { error: "Category is required" };
  }

  if (!data.primaryUnitId || data.primaryUnitId.trim() === "") {
    return { error: "Primary unit of measure is required" };
  }

  // Validate consignment items require supplier
  if (data.isConsignment && (!data.supplierId || data.supplierId.trim() === "")) {
    return { error: "Consignment items require a supplier" };
  }

  try {
    // Check if property exists
    const property = await db.property.findUnique({
      where: { id: data.propertyId },
    });

    if (!property) {
      return { error: "Property not found" };
    }

    // Check if category exists
    const category = await db.stockCategory.findUnique({
      where: { id: data.categoryId },
    });

    if (!category) {
      return { error: "Category not found" };
    }

    // Check if unit of measure exists
    const unit = await db.unitOfMeasure.findUnique({
      where: { id: data.primaryUnitId },
    });

    if (!unit) {
      return { error: "Unit of measure not found" };
    }

    // Check if supplier exists (if provided)
    if (data.supplierId) {
      const supplier = await db.supplier.findUnique({
        where: { id: data.supplierId },
      });

      if (!supplier) {
        return { error: "Supplier not found" };
      }
    }

    // Generate item code
    const itemCode = await generateItemCode();

    const stockItem = await db.stockItem.create({
      data: {
        itemCode,
        propertyId: data.propertyId,
        name: data.name.trim(),
        sku: data.sku?.trim() || null,
        categoryId: data.categoryId,
        primaryUnitId: data.primaryUnitId,
        isConsignment: data.isConsignment ?? false,
        supplierId: data.supplierId || null,
        isActive: true,
      },
      include: {
        primaryUnit: true,
        supplier: true,
        category: true,
      },
    });

    revalidatePath("/admin/inventory/items");
    return { success: true, data: stockItem };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Unique constraint violation
      if (error.code === "P2002") {
        const target = (error.meta?.target as string[]) || [];
        if (target.includes("itemCode")) {
          return { error: "Failed to generate unique item code. Please try again." };
        }
        if (target.includes("sku")) {
          return { error: "A stock item with this SKU already exists for this property" };
        }
      }
    }
    console.error("Create Stock Item Error:", error);
    return { error: "Failed to create stock item" };
  }
}

/**
 * Get a stock item by ID
 */
export async function getStockItemById(id: string) {
  try {
    const stockItem = await db.stockItem.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        primaryUnit: true,
        category: true,
        supplier: {
          select: {
            id: true,
            name: true,
            contactName: true,
          },
        },
        stockLevels: {
          include: {
            warehouse: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
        parLevels: {
          include: {
            warehouse: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
        _count: {
          select: {
            stockLevels: true,
            stockBatches: true,
            movements: true,
            recipeIngredients: true,
          },
        },
      },
    });

    return stockItem;
  } catch (error) {
    console.error("Get Stock Item Error:", error);
    return null;
  }
}


/**
 * Get all stock items with optional filtering
 * Requirements: 1.1, 1.2
 * 
 * Property 1: Property Scope Filtering
 * For any data query executed while a user has a specific property selected,
 * all returned records SHALL belong to that property.
 */
export async function getStockItems(query?: StockItemSearchQuery) {
  try {
    const where: Prisma.StockItemWhereInput = {};

    // Apply property context filtering (Requirements 1.1, 1.2)
    if (query?.propertyId) {
      where.propertyId = query.propertyId;
    } else {
      // Get property filter from context
      const propertyFilter = await getPropertyFilter();
      if (propertyFilter.propertyId) {
        where.propertyId = propertyFilter.propertyId;
      }
    }

    if (query?.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query?.isConsignment !== undefined) {
      where.isConsignment = query.isConsignment;
    }

    if (query?.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { itemCode: { contains: query.search, mode: "insensitive" } },
        { sku: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const [stockItems, total] = await Promise.all([
      db.stockItem.findMany({
        where,
        include: {
          property: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          primaryUnit: true,
          category: true,
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
          stockLevels: {
            include: {
              warehouse: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                },
              },
            },
          },
        },
        orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
        skip,
        take: pageSize,
      }),
      db.stockItem.count({ where }),
    ]);

    return {
      stockItems,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Get Stock Items Error:", error);
    return {
      stockItems: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    };
  }
}

/**
 * Get stock items by property (for dropdowns)
 */
export async function getStockItemsByProperty(propertyId: string) {
  try {
    const stockItems = await db.stockItem.findMany({
      where: {
        propertyId,
        isActive: true,
      },
      include: {
        primaryUnit: true,
        category: true,
      },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    });

    return stockItems;
  } catch (error) {
    console.error("Get Stock Items By Property Error:", error);
    return [];
  }
}

/**
 * Update a stock item
 */
export async function updateStockItem(id: string, data: UpdateStockItemInput) {
  try {
    // Get existing item to check consignment status
    const existingItem = await db.stockItem.findUnique({
      where: { id },
    });

    if (!existingItem) {
      return { error: "Stock item not found" };
    }

    const updateData: Prisma.StockItemUpdateInput = {};

    if (data.name !== undefined) {
      if (!data.name || data.name.trim() === "") {
        return { error: "Stock item name cannot be empty" };
      }
      updateData.name = data.name.trim();
    }

    if (data.sku !== undefined) {
      updateData.sku = data.sku?.trim() || null;
    }

    if (data.categoryId !== undefined) {
      if (!data.categoryId || data.categoryId.trim() === "") {
        return { error: "Category cannot be empty" };
      }
      // Check if category exists
      const category = await db.stockCategory.findUnique({
        where: { id: data.categoryId },
      });
      if (!category) {
        return { error: "Category not found" };
      }
      updateData.category = { connect: { id: data.categoryId } };
    }

    if (data.primaryUnitId !== undefined) {
      if (!data.primaryUnitId || data.primaryUnitId.trim() === "") {
        return { error: "Primary unit of measure cannot be empty" };
      }
      // Check if unit exists
      const unit = await db.unitOfMeasure.findUnique({
        where: { id: data.primaryUnitId },
      });
      if (!unit) {
        return { error: "Unit of measure not found" };
      }
      updateData.primaryUnit = { connect: { id: data.primaryUnitId } };
    }

    // Handle consignment and supplier updates
    const newIsConsignment = data.isConsignment ?? existingItem.isConsignment;
    const newSupplierId = data.supplierId !== undefined ? data.supplierId : existingItem.supplierId;

    // Validate consignment items require supplier
    if (newIsConsignment && (!newSupplierId || newSupplierId.trim() === "")) {
      return { error: "Consignment items require a supplier" };
    }

    if (data.isConsignment !== undefined) {
      updateData.isConsignment = data.isConsignment;
    }

    if (data.supplierId !== undefined) {
      if (data.supplierId) {
        // Check if supplier exists
        const supplier = await db.supplier.findUnique({
          where: { id: data.supplierId },
        });
        if (!supplier) {
          return { error: "Supplier not found" };
        }
        updateData.supplier = { connect: { id: data.supplierId } };
      } else {
        updateData.supplier = { disconnect: true };
      }
    }

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    const stockItem = await db.stockItem.update({
      where: { id },
      data: updateData,
      include: {
        primaryUnit: true,
        supplier: true,
        category: true,
      },
    });

    revalidatePath("/admin/inventory/items");
    revalidatePath(`/admin/inventory/items/${id}`);
    return { success: true, data: stockItem };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Stock item not found" };
      }
      if (error.code === "P2002") {
        return {
          error: "A stock item with this SKU already exists for this property",
        };
      }
    }
    console.error("Update Stock Item Error:", error);
    return { error: "Failed to update stock item" };
  }
}

/**
 * Deactivate a stock item (soft delete)
 */
export async function deactivateStockItem(id: string) {
  try {
    const stockItem = await db.stockItem.update({
      where: { id },
      data: { isActive: false },
    });

    revalidatePath("/admin/inventory/items");
    return { success: true, data: stockItem };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Stock item not found" };
      }
    }
    console.error("Deactivate Stock Item Error:", error);
    return { error: "Failed to deactivate stock item" };
  }
}

/**
 * Reactivate a stock item
 */
export async function reactivateStockItem(id: string) {
  try {
    const stockItem = await db.stockItem.update({
      where: { id },
      data: { isActive: true },
    });

    revalidatePath("/admin/inventory/items");
    return { success: true, data: stockItem };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Stock item not found" };
      }
    }
    console.error("Reactivate Stock Item Error:", error);
    return { error: "Failed to reactivate stock item" };
  }
}

/**
 * Delete a stock item permanently
 * Note: This will fail if the stock item has related records
 */
export async function deleteStockItem(id: string) {
  try {
    // Check if stock item has related records
    const stockItem = await db.stockItem.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            stockLevels: true,
            stockBatches: true,
            movements: true,
            recipeIngredients: true,
            linens: true,
            consignmentItems: true,
            wasteRecords: true,
          },
        },
      },
    });

    if (!stockItem) {
      return { error: "Stock item not found" };
    }

    const totalRelated =
      stockItem._count.stockLevels +
      stockItem._count.stockBatches +
      stockItem._count.movements +
      stockItem._count.recipeIngredients +
      stockItem._count.linens +
      stockItem._count.consignmentItems +
      stockItem._count.wasteRecords;

    if (totalRelated > 0) {
      return {
        error:
          "Cannot delete stock item with existing inventory records. Deactivate instead.",
      };
    }

    // Delete par levels first (they don't have cascade delete)
    await db.stockParLevel.deleteMany({
      where: { stockItemId: id },
    });

    await db.stockItem.delete({
      where: { id },
    });

    revalidatePath("/admin/inventory/items");
    return { success: true };
  } catch (error) {
    console.error("Delete Stock Item Error:", error);
    return { error: "Failed to delete stock item" };
  }
}


// Par Level Management

/**
 * Set par level for a stock item in a warehouse
 * Requirements: 2.5
 */
export async function setParLevel(data: SetParLevelInput) {
  if (!data.stockItemId || data.stockItemId.trim() === "") {
    return { error: "Stock item ID is required" };
  }

  if (!data.warehouseId || data.warehouseId.trim() === "") {
    return { error: "Warehouse ID is required" };
  }

  if (data.parLevel < 0) {
    return { error: "Par level cannot be negative" };
  }

  try {
    // Check if stock item exists
    const stockItem = await db.stockItem.findUnique({
      where: { id: data.stockItemId },
    });

    if (!stockItem) {
      return { error: "Stock item not found" };
    }

    // Check if warehouse exists
    const warehouse = await db.warehouse.findUnique({
      where: { id: data.warehouseId },
    });

    if (!warehouse) {
      return { error: "Warehouse not found" };
    }

    // Upsert par level
    const parLevel = await db.stockParLevel.upsert({
      where: {
        stockItemId_warehouseId: {
          stockItemId: data.stockItemId,
          warehouseId: data.warehouseId,
        },
      },
      update: {
        parLevel: data.parLevel,
      },
      create: {
        stockItemId: data.stockItemId,
        warehouseId: data.warehouseId,
        parLevel: data.parLevel,
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            itemCode: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    revalidatePath("/admin/inventory/items");
    return { success: true, data: parLevel };
  } catch (error) {
    console.error("Set Par Level Error:", error);
    return { error: "Failed to set par level" };
  }
}

/**
 * Get par level for a stock item in a warehouse
 */
export async function getParLevel(stockItemId: string, warehouseId: string) {
  try {
    const parLevel = await db.stockParLevel.findUnique({
      where: {
        stockItemId_warehouseId: {
          stockItemId,
          warehouseId,
        },
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            itemCode: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    return parLevel;
  } catch (error) {
    console.error("Get Par Level Error:", error);
    return null;
  }
}

/**
 * Delete par level for a stock item in a warehouse
 */
export async function deleteParLevel(stockItemId: string, warehouseId: string) {
  try {
    await db.stockParLevel.delete({
      where: {
        stockItemId_warehouseId: {
          stockItemId,
          warehouseId,
        },
      },
    });

    revalidatePath("/admin/inventory/items");
    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Par level not found" };
      }
    }
    console.error("Delete Par Level Error:", error);
    return { error: "Failed to delete par level" };
  }
}

/**
 * Get all par levels for a stock item
 */
export async function getParLevelsByStockItem(stockItemId: string) {
  try {
    const parLevels = await db.stockParLevel.findMany({
      where: { stockItemId },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { warehouse: { name: "asc" } },
    });

    return parLevels;
  } catch (error) {
    console.error("Get Par Levels By Stock Item Error:", error);
    return [];
  }
}

/**
 * Get all par levels for a warehouse
 */
export async function getParLevelsByWarehouse(warehouseId: string) {
  try {
    const parLevels = await db.stockParLevel.findMany({
      where: { warehouseId },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            itemCode: true,
          },
        },
      },
      orderBy: { stockItem: { name: "asc" } },
    });

    return parLevels;
  } catch (error) {
    console.error("Get Par Levels By Warehouse Error:", error);
    return [];
  }
}

// Low Stock Alert Generation

/**
 * Get low stock alerts for a property
 * Requirements: 2.6
 */
export async function getLowStockAlerts(propertyId: string): Promise<LowStockAlert[]> {
  try {
    // Get all par levels for the property with their current stock levels
    const parLevels = await db.stockParLevel.findMany({
      where: {
        stockItem: {
          propertyId,
          isActive: true,
        },
        warehouse: {
          isActive: true,
        },
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            itemCode: true,
            primaryUnit: {
              select: {
                abbreviation: true,
              },
            },
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const alerts: LowStockAlert[] = [];

    for (const parLevel of parLevels) {
      // Get current stock level for this item-warehouse combination
      const stockLevel = await db.stockLevel.findUnique({
        where: {
          stockItemId_warehouseId: {
            stockItemId: parLevel.stockItemId,
            warehouseId: parLevel.warehouseId,
          },
        },
      });

      const currentQuantity = stockLevel ? Number(stockLevel.quantity) : 0;
      const parLevelValue = Number(parLevel.parLevel);

      // Include in alerts if quantity < parLevel
      if (currentQuantity < parLevelValue) {
        alerts.push({
          stockItemId: parLevel.stockItem.id,
          stockItemName: parLevel.stockItem.name,
          stockItemCode: parLevel.stockItem.itemCode,
          warehouseId: parLevel.warehouse.id,
          warehouseName: parLevel.warehouse.name,
          currentQuantity,
          parLevel: parLevelValue,
          deficit: parLevelValue - currentQuantity,
          unit: parLevel.stockItem.primaryUnit.abbreviation,
        });
      }
    }

    // Sort by deficit (highest first)
    alerts.sort((a, b) => b.deficit - a.deficit);

    return alerts;
  } catch (error) {
    console.error("Get Low Stock Alerts Error:", error);
    return [];
  }
}

/**
 * Get low stock alerts for a specific warehouse
 * Requirements: 2.6
 */
export async function getLowStockAlertsByWarehouse(warehouseId: string): Promise<LowStockAlert[]> {
  try {
    // Get all par levels for the warehouse with their current stock levels
    const parLevels = await db.stockParLevel.findMany({
      where: {
        warehouseId,
        stockItem: {
          isActive: true,
        },
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            itemCode: true,
            primaryUnit: {
              select: {
                abbreviation: true,
              },
            },
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const alerts: LowStockAlert[] = [];

    for (const parLevel of parLevels) {
      // Get current stock level for this item-warehouse combination
      const stockLevel = await db.stockLevel.findUnique({
        where: {
          stockItemId_warehouseId: {
            stockItemId: parLevel.stockItemId,
            warehouseId: parLevel.warehouseId,
          },
        },
      });

      const currentQuantity = stockLevel ? Number(stockLevel.quantity) : 0;
      const parLevelValue = Number(parLevel.parLevel);

      // Include in alerts if quantity < parLevel
      if (currentQuantity < parLevelValue) {
        alerts.push({
          stockItemId: parLevel.stockItem.id,
          stockItemName: parLevel.stockItem.name,
          stockItemCode: parLevel.stockItem.itemCode,
          warehouseId: parLevel.warehouse.id,
          warehouseName: parLevel.warehouse.name,
          currentQuantity,
          parLevel: parLevelValue,
          deficit: parLevelValue - currentQuantity,
          unit: parLevel.stockItem.primaryUnit.abbreviation,
        });
      }
    }

    // Sort by deficit (highest first)
    alerts.sort((a, b) => b.deficit - a.deficit);

    return alerts;
  } catch (error) {
    console.error("Get Low Stock Alerts By Warehouse Error:", error);
    return [];
  }
}

/**
 * Get stock level for a specific item in a warehouse
 */
export async function getStockLevel(stockItemId: string, warehouseId: string) {
  try {
    const stockLevel = await db.stockLevel.findUnique({
      where: {
        stockItemId_warehouseId: {
          stockItemId,
          warehouseId,
        },
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            itemCode: true,
            primaryUnit: {
              select: {
                abbreviation: true,
              },
            },
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    return stockLevel;
  } catch (error) {
    console.error("Get Stock Level Error:", error);
    return null;
  }
}

/**
 * Get all stock levels for a stock item across all warehouses
 */
export async function getStockLevelsByItem(stockItemId: string) {
  try {
    const stockLevels = await db.stockLevel.findMany({
      where: { stockItemId },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            type: true,
            isActive: true,
          },
        },
      },
      orderBy: { warehouse: { name: "asc" } },
    });

    return stockLevels;
  } catch (error) {
    console.error("Get Stock Levels By Item Error:", error);
    return [];
  }
}

/**
 * Get total stock quantity for an item across all warehouses
 */
export async function getTotalStockQuantity(stockItemId: string): Promise<number> {
  try {
    const result = await db.stockLevel.aggregate({
      where: {
        stockItemId,
        warehouse: {
          isActive: true,
        },
      },
      _sum: {
        quantity: true,
      },
    });

    return Number(result._sum.quantity) || 0;
  } catch (error) {
    console.error("Get Total Stock Quantity Error:", error);
    return 0;
  }
}
