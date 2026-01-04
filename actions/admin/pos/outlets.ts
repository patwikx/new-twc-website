"use server";

import { OutletType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  createOutlet,
  updateOutlet,
  deactivateOutlet,
  reactivateOutlet,
  getOutletById,
  getOutlets,
  getActiveOutlets,
  getOutletsByProperty,
  type CreateOutletInput,
  type UpdateOutletInput,
  type OutletSearchQuery,
} from "@/lib/pos/outlet";

/**
 * Server action to create a new sales outlet
 * Requirements: 3.1, 3.2
 */
export async function createOutletAction(formData: FormData) {
  const propertyId = formData.get("propertyId") as string;
  const name = formData.get("name") as string;
  const type = formData.get("type") as OutletType;
  const warehouseId = formData.get("warehouseId") as string;

  if (!propertyId) {
    return { error: "Property ID is required" };
  }

  if (!name || name.trim() === "") {
    return { error: "Outlet name is required" };
  }

  if (!type) {
    return { error: "Outlet type is required" };
  }

  if (!warehouseId) {
    return { error: "Warehouse is required" };
  }

  const input: CreateOutletInput = {
    propertyId,
    name: name.trim(),
    type,
    warehouseId,
  };

  const result = await createOutlet(input);

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/admin/pos/outlets");
  return { success: true, data: result.data };
}

/**
 * Server action to update a sales outlet
 * Requirements: 3.2
 */
export async function updateOutletAction(id: string, formData: FormData) {
  if (!id) {
    return { error: "Outlet ID is required" };
  }

  const name = formData.get("name") as string | null;
  const type = formData.get("type") as OutletType | null;
  const warehouseId = formData.get("warehouseId") as string | null;

  const input: UpdateOutletInput = {};

  if (name !== null) {
    input.name = name;
  }

  if (type !== null) {
    input.type = type;
  }

  if (warehouseId !== null) {
    input.warehouseId = warehouseId;
  }

  const result = await updateOutlet(id, input);

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/admin/pos/outlets");
  revalidatePath(`/admin/pos/outlets/${id}`);
  return { success: true, data: result.data };
}

/**
 * Server action to deactivate a sales outlet
 * Requirements: 3.3
 */
export async function deactivateOutletAction(id: string) {
  if (!id) {
    return { error: "Outlet ID is required" };
  }

  const result = await deactivateOutlet(id);

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/admin/pos/outlets");
  return { success: true, data: result.data };
}

/**
 * Server action to reactivate a sales outlet
 */
export async function reactivateOutletAction(id: string) {
  if (!id) {
    return { error: "Outlet ID is required" };
  }

  const result = await reactivateOutlet(id);

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/admin/pos/outlets");
  return { success: true, data: result.data };
}

/**
 * Server action to get a sales outlet by ID
 */
export async function getOutletByIdAction(id: string) {
  if (!id) {
    return null;
  }

  return getOutletById(id);
}

/**
 * Server action to get all sales outlets with optional filtering
 * Requirements: 3.4
 */
export async function getOutletsAction(query?: OutletSearchQuery) {
  return getOutlets(query);
}

/**
 * Server action to get all active outlets for a property
 * Requirements: 3.4
 */
export async function getActiveOutletsAction(propertyId: string) {
  if (!propertyId) {
    return [];
  }

  return getActiveOutlets(propertyId);
}

/**
 * Server action to get outlets by property
 * Requirements: 3.4
 */
export async function getOutletsByPropertyAction(propertyId: string) {
  if (!propertyId) {
    return [];
  }

  return getOutletsByProperty(propertyId);
}
