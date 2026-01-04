"use server";

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

// Types
export interface CreateSupplierInput {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface UpdateSupplierInput {
  name?: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive?: boolean;
}

export interface SupplierSearchQuery {
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

// CRUD Operations

/**
 * Create a new supplier
 * Requirements: 2.4, 9.1
 */
export async function createSupplier(data: CreateSupplierInput) {
  if (!data.name || data.name.trim() === "") {
    return { error: "Supplier name is required" };
  }

  try {
    const supplier = await db.supplier.create({
      data: {
        name: data.name.trim(),
        contactName: data.contactName?.trim() || null,
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        address: data.address?.trim() || null,
        isActive: true,
      },
    });

    revalidatePath("/admin/inventory/suppliers");
    return { success: true, data: supplier };
  } catch (error) {
    console.error("Create Supplier Error:", error);
    return { error: "Failed to create supplier" };
  }
}

/**
 * Get a supplier by ID
 */
export async function getSupplierById(id: string) {
  try {
    const supplier = await db.supplier.findUnique({
      where: { id },
      include: {
        stockItems: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            stockItems: true,
            consignmentReceipts: true,
            consignmentSettlements: true,
          },
        },
      },
    });

    return supplier;
  } catch (error) {
    console.error("Get Supplier Error:", error);
    return null;
  }
}

/**
 * Get all suppliers with optional filtering
 */
export async function getSuppliers(query?: SupplierSearchQuery) {
  try {
    const where: Prisma.SupplierWhereInput = {};

    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { contactName: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
      ];
    }

    if (query?.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const page = query?.page ?? 1;
    const pageSize = query?.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    const [suppliers, total] = await Promise.all([
      db.supplier.findMany({
        where,
        include: {
          _count: {
            select: {
              stockItems: true,
              consignmentReceipts: true,
            },
          },
        },
        orderBy: { name: "asc" },
        skip,
        take: pageSize,
      }),
      db.supplier.count({ where }),
    ]);

    return {
      suppliers,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Get Suppliers Error:", error);
    return {
      suppliers: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    };
  }
}

/**
 * Get all active suppliers (for dropdowns)
 */
export async function getActiveSuppliers() {
  try {
    const suppliers = await db.supplier.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        contactName: true,
      },
      orderBy: { name: "asc" },
    });

    return suppliers;
  } catch (error) {
    console.error("Get Active Suppliers Error:", error);
    return [];
  }
}

/**
 * Update a supplier
 */
export async function updateSupplier(id: string, data: UpdateSupplierInput) {
  try {
    const updateData: Prisma.SupplierUpdateInput = {};

    if (data.name !== undefined) {
      if (!data.name || data.name.trim() === "") {
        return { error: "Supplier name cannot be empty" };
      }
      updateData.name = data.name.trim();
    }

    if (data.contactName !== undefined) {
      updateData.contactName = data.contactName?.trim() || null;
    }

    if (data.email !== undefined) {
      updateData.email = data.email?.trim() || null;
    }

    if (data.phone !== undefined) {
      updateData.phone = data.phone?.trim() || null;
    }

    if (data.address !== undefined) {
      updateData.address = data.address?.trim() || null;
    }

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    const supplier = await db.supplier.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/admin/inventory/suppliers");
    revalidatePath(`/admin/inventory/suppliers/${id}`);
    return { success: true, data: supplier };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Supplier not found" };
      }
    }
    console.error("Update Supplier Error:", error);
    return { error: "Failed to update supplier" };
  }
}

/**
 * Deactivate a supplier (soft delete)
 */
export async function deactivateSupplier(id: string) {
  try {
    const supplier = await db.supplier.update({
      where: { id },
      data: { isActive: false },
    });

    revalidatePath("/admin/inventory/suppliers");
    return { success: true, data: supplier };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Supplier not found" };
      }
    }
    console.error("Deactivate Supplier Error:", error);
    return { error: "Failed to deactivate supplier" };
  }
}

/**
 * Reactivate a supplier
 */
export async function reactivateSupplier(id: string) {
  try {
    const supplier = await db.supplier.update({
      where: { id },
      data: { isActive: true },
    });

    revalidatePath("/admin/inventory/suppliers");
    return { success: true, data: supplier };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Supplier not found" };
      }
    }
    console.error("Reactivate Supplier Error:", error);
    return { error: "Failed to reactivate supplier" };
  }
}

/**
 * Delete a supplier permanently
 * Note: This will fail if the supplier has related records
 */
export async function deleteSupplier(id: string) {
  try {
    // Check if supplier has related records
    const supplier = await db.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            stockItems: true,
            consignmentReceipts: true,
            consignmentSettlements: true,
          },
        },
      },
    });

    if (!supplier) {
      return { error: "Supplier not found" };
    }

    const totalRelated =
      supplier._count.stockItems +
      supplier._count.consignmentReceipts +
      supplier._count.consignmentSettlements;

    if (totalRelated > 0) {
      return {
        error:
          "Cannot delete supplier with existing stock items or consignment records. Deactivate instead.",
      };
    }

    await db.supplier.delete({
      where: { id },
    });

    revalidatePath("/admin/inventory/suppliers");
    return { success: true };
  } catch (error) {
    console.error("Delete Supplier Error:", error);
    return { error: "Failed to delete supplier" };
  }
}
