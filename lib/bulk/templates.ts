"use server";

import { db } from "@/lib/db";
import {
  generateHeaderRow,
  generateExampleRow,
  STOCK_ITEM_TEMPLATE_SPEC,
  PRICE_UPDATE_TEMPLATE_SPEC,
  SUPPLIER_TEMPLATE_SPEC,
  type TemplateSpec,
} from "./template-utils";

// Re-export types only (types are allowed)
export type { TemplateField, TemplateSpec } from "./template-utils";

// ============================================================================
// Import Template Generation Service
// Requirements: 17.5
// ============================================================================

/**
 * Template result
 */
export interface TemplateResult {
  success: boolean;
  csvContent: string;
  filename: string;
  mimeType: string;
  spec: TemplateSpec;
  error?: string;
}

/**
 * Generate stock item import template with dynamic valid values
 * Requirements: 17.5
 */
export async function generateStockItemTemplate(): Promise<TemplateResult> {
  try {
    // Fetch current categories and units for reference
    const [categories, units, suppliers] = await Promise.all([
      db.stockCategory.findMany({ where: { isActive: true }, select: { name: true } }),
      db.unitOfMeasure.findMany({ select: { abbreviation: true, name: true } }),
      db.supplier.findMany({ where: { isActive: true }, select: { name: true } }),
    ]);

    // Create spec with valid values
    const spec: TemplateSpec = {
      ...STOCK_ITEM_TEMPLATE_SPEC,
      fields: STOCK_ITEM_TEMPLATE_SPEC.fields.map((field) => {
        if (field.name === "category") {
          return {
            ...field,
            validValues: categories.map((c) => c.name),
          };
        }
        if (field.name === "unit") {
          return {
            ...field,
            validValues: units.map((u) => `${u.abbreviation} (${u.name})`),
          };
        }
        if (field.name === "supplier") {
          return {
            ...field,
            validValues: suppliers.map((s) => s.name),
          };
        }
        return field;
      }),
    };

    // Generate CSV content
    const headerRow = generateHeaderRow(spec);
    const exampleRow = generateExampleRow(spec);
    
    // Add comments with field descriptions
    const comments = [
      "# Stock Items Import Template",
      "# ",
      "# Field Descriptions:",
      ...spec.fields.map((f) => `# - ${f.name}: ${f.description}${f.required ? " (REQUIRED)" : " (optional)"}`),
      "# ",
      "# Valid Categories: " + categories.map((c) => c.name).join(", "),
      "# Valid Units: " + units.map((u) => u.abbreviation).join(", "),
      "# Valid Suppliers: " + suppliers.map((s) => s.name).join(", "),
      "# ",
      "# Delete this example row and add your data below:",
    ];

    const csvContent = [...comments, headerRow, exampleRow].join("\n");

    return {
      success: true,
      csvContent,
      filename: "stock_items_import_template.csv",
      mimeType: "text/csv;charset=utf-8;",
      spec,
    };
  } catch (error) {
    console.error("Generate Stock Item Template Error:", error);
    return {
      success: false,
      csvContent: "",
      filename: "",
      mimeType: "",
      spec: STOCK_ITEM_TEMPLATE_SPEC,
      error: "Failed to generate template",
    };
  }
}

/**
 * Generate price update template
 * Requirements: 17.5
 */
export async function generatePriceUpdateTemplate(propertyId: string): Promise<TemplateResult> {
  try {
    // Fetch some existing item codes for reference
    const items = await db.stockItem.findMany({
      where: { propertyId, isActive: true },
      select: { itemCode: true, name: true },
      take: 10,
      orderBy: { itemCode: "asc" },
    });

    const spec = PRICE_UPDATE_TEMPLATE_SPEC;

    // Generate CSV content
    const headerRow = generateHeaderRow(spec);
    
    // Add comments with field descriptions
    const comments = [
      "# Price Update Template",
      "# ",
      "# Field Descriptions:",
      ...spec.fields.map((f) => `# - ${f.name}: ${f.description}${f.required ? " (REQUIRED)" : " (optional)"}`),
      "# ",
      "# Example Item Codes from your inventory:",
      ...items.slice(0, 5).map((i) => `# - ${i.itemCode}: ${i.name}`),
      "# ",
      "# Delete the example rows and add your data below:",
    ];

    // Generate example rows using actual item codes if available
    const exampleRows = items.length > 0
      ? items.slice(0, 3).map((item, idx) => `${item.itemCode},${(10 + idx * 5).toFixed(2)}`)
      : [generateExampleRow(spec)];

    const csvContent = [...comments, headerRow, ...exampleRows].join("\n");

    return {
      success: true,
      csvContent,
      filename: "price_update_template.csv",
      mimeType: "text/csv;charset=utf-8;",
      spec,
    };
  } catch (error) {
    console.error("Generate Price Update Template Error:", error);
    return {
      success: false,
      csvContent: "",
      filename: "",
      mimeType: "",
      spec: PRICE_UPDATE_TEMPLATE_SPEC,
      error: "Failed to generate template",
    };
  }
}

/**
 * Generate supplier import template
 * Requirements: 17.5
 */
export async function generateSupplierTemplate(): Promise<TemplateResult> {
  try {
    const spec = SUPPLIER_TEMPLATE_SPEC;

    // Generate CSV content
    const headerRow = generateHeaderRow(spec);
    const exampleRow = generateExampleRow(spec);
    
    // Add comments with field descriptions
    const comments = [
      "# Suppliers Import Template",
      "# ",
      "# Field Descriptions:",
      ...spec.fields.map((f) => `# - ${f.name}: ${f.description}${f.required ? " (REQUIRED)" : " (optional)"}`),
      "# ",
      "# Delete this example row and add your data below:",
    ];

    const csvContent = [...comments, headerRow, exampleRow].join("\n");

    return {
      success: true,
      csvContent,
      filename: "suppliers_import_template.csv",
      mimeType: "text/csv;charset=utf-8;",
      spec,
    };
  } catch (error) {
    console.error("Generate Supplier Template Error:", error);
    return {
      success: false,
      csvContent: "",
      filename: "",
      mimeType: "",
      spec: SUPPLIER_TEMPLATE_SPEC,
      error: "Failed to generate template",
    };
  }
}
