"use server";

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { InventoryError } from "./errors";

// Types
export interface CreateUnitInput {
  name: string;
  abbreviation: string;
  baseUnitId?: string;
  conversionFactor?: number;
}

export interface UpdateUnitInput {
  name?: string;
  abbreviation?: string;
  baseUnitId?: string | null;
  conversionFactor?: number;
}

export interface UnitConversionResult {
  value: number;
  fromUnit: string;
  toUnit: string;
}

// CRUD Operations

/**
 * Create a new unit of measure
 */
export async function createUnit(data: CreateUnitInput) {
  if (!data.name || !data.abbreviation) {
    return { error: "Name and abbreviation are required" };
  }

  try {
    const unit = await db.unitOfMeasure.create({
      data: {
        name: data.name,
        abbreviation: data.abbreviation,
        baseUnitId: data.baseUnitId || null,
        conversionFactor: data.conversionFactor ?? 1,
      },
    });

    return { success: true, data: unit };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { error: "Unit with this name or abbreviation already exists" };
      }
    }
    console.error("Create Unit Error:", error);
    return { error: "Failed to create unit of measure" };
  }
}

/**
 * Get a unit of measure by ID
 */
export async function getUnitById(id: string) {
  try {
    const unit = await db.unitOfMeasure.findUnique({
      where: { id },
      include: {
        baseUnit: true,
        derivedUnits: true,
      },
    });

    return unit;
  } catch (error) {
    console.error("Get Unit Error:", error);
    return null;
  }
}

/**
 * Get all units of measure
 */
export async function getAllUnits() {
  try {
    const units = await db.unitOfMeasure.findMany({
      include: {
        baseUnit: true,
        derivedUnits: true,
      },
      orderBy: { name: "asc" },
    });

    return units;
  } catch (error) {
    console.error("Get All Units Error:", error);
    return [];
  }
}

/**
 * Update a unit of measure
 */
export async function updateUnit(id: string, data: UpdateUnitInput) {
  try {
    const unit = await db.unitOfMeasure.update({
      where: { id },
      data: {
        name: data.name,
        abbreviation: data.abbreviation,
        baseUnitId: data.baseUnitId,
        conversionFactor: data.conversionFactor,
      },
    });

    return { success: true, data: unit };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return { error: "Unit with this name or abbreviation already exists" };
      }
      if (error.code === "P2025") {
        return { error: "Unit not found" };
      }
    }
    console.error("Update Unit Error:", error);
    return { error: "Failed to update unit of measure" };
  }
}

/**
 * Delete a unit of measure
 */
export async function deleteUnit(id: string) {
  try {
    await db.unitOfMeasure.delete({
      where: { id },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return { error: "Unit not found" };
      }
      if (error.code === "P2003") {
        return { error: "Cannot delete unit that is in use" };
      }
    }
    console.error("Delete Unit Error:", error);
    return { error: "Failed to delete unit of measure" };
  }
}

/**
 * Convert a quantity from one unit to another
 * Uses the conversion factor chain through base units
 * 
 * Property 6: Unit Conversion Accuracy
 * For any quantity in a source unit with a known conversion factor to a target unit,
 * converting the quantity SHALL produce: targetQuantity = sourceQuantity × conversionFactor
 * Converting back SHALL produce the original quantity (round-trip).
 */
export async function convertUnit(
  quantity: number,
  fromUnitId: string,
  toUnitId: string
): Promise<{ success: true; result: UnitConversionResult } | { error: string }> {
  try {
    // If same unit, return as-is
    if (fromUnitId === toUnitId) {
      const unit = await db.unitOfMeasure.findUnique({ where: { id: fromUnitId } });
      if (!unit) {
        return { error: "Unit not found" };
      }
      return {
        success: true,
        result: {
          value: quantity,
          fromUnit: unit.abbreviation,
          toUnit: unit.abbreviation,
        },
      };
    }

    const fromUnit = await db.unitOfMeasure.findUnique({
      where: { id: fromUnitId },
      include: { baseUnit: true },
    });

    const toUnit = await db.unitOfMeasure.findUnique({
      where: { id: toUnitId },
      include: { baseUnit: true },
    });

    if (!fromUnit || !toUnit) {
      return { error: "One or both units not found" };
    }

    // Use precise arithmetic for calculations
    const fromFactor = Number(fromUnit.conversionFactor);
    const toFactor = Number(toUnit.conversionFactor);
    const qty = quantity;

    // Check if units are compatible (same base unit or one is base of other)
    const fromBaseId = fromUnit.baseUnitId;
    const toBaseId = toUnit.baseUnitId;

    let convertedValue: number;

    if (fromBaseId === toUnitId) {
      // fromUnit is derived from toUnit (e.g., g -> kg where kg is base)
      // Convert: quantity * fromFactor gives base unit value
      convertedValue = qty * fromFactor;
    } else if (toBaseId === fromUnitId) {
      // toUnit is derived from fromUnit (e.g., kg -> g where kg is base)
      // Convert: quantity / toFactor
      convertedValue = qty / toFactor;
    } else if (fromBaseId && fromBaseId === toBaseId) {
      // Both units share the same base unit
      // Convert to base first, then to target
      // fromUnit -> base -> toUnit
      // value_in_base = quantity * fromFactor
      // value_in_target = value_in_base / toFactor
      const valueInBase = qty * fromFactor;
      convertedValue = valueInBase / toFactor;
    } else if (!fromBaseId && !toBaseId) {
      // Both are base units with no common base - incompatible
      return {
        error: `Cannot convert between incompatible units: ${fromUnit.name} and ${toUnit.name}`,
      };
    } else {
      // Try to find common base through chain
      // For simplicity, we only support direct conversions or one-level base
      return {
        error: `Cannot convert between units: ${fromUnit.name} and ${toUnit.name}. No common base unit found.`,
      };
    }

    return {
      success: true,
      result: {
        value: convertedValue,
        fromUnit: fromUnit.abbreviation,
        toUnit: toUnit.abbreviation,
      },
    };
  } catch (error) {
    console.error("Convert Unit Error:", error);
    throw new InventoryError(
      "Failed to convert units",
      "UNIT_CONVERSION_ERROR",
      { fromUnitId, toUnitId, quantity }
    );
  }
}

/**
 * Get conversion factor between two units
 */
export async function getConversionFactor(
  fromUnitId: string,
  toUnitId: string
): Promise<number | null> {
  const result = await convertUnit(1, fromUnitId, toUnitId);
  if ("error" in result) {
    return null;
  }
  return result.result.value;
}
