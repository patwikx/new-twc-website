// ============================================================================
// Import Template Utility Functions (Pure functions for template generation)
// Requirements: 17.5
// ============================================================================

/**
 * Template field specification
 */
export interface TemplateField {
  name: string;
  required: boolean;
  description: string;
  example: string;
  validValues?: string[];
}

/**
 * Template specification
 */
export interface TemplateSpec {
  name: string;
  description: string;
  fields: TemplateField[];
}

/**
 * Stock item import template specification
 */
export const STOCK_ITEM_TEMPLATE_SPEC: TemplateSpec = {
  name: "Stock Items Import Template",
  description: "Template for bulk importing stock items into the inventory system",
  fields: [
    {
      name: "name",
      required: true,
      description: "The name of the stock item",
      example: "Chicken Breast",
    },
    {
      name: "sku",
      required: false,
      description: "Optional Stock Keeping Unit code (must be unique)",
      example: "CHKN-001",
    },
    {
      name: "category",
      required: true,
      description: "The category name (must exist in the system)",
      example: "Food",
    },
    {
      name: "unit",
      required: true,
      description: "The unit of measure abbreviation (must exist in the system)",
      example: "kg",
    },
    {
      name: "consignment",
      required: false,
      description: "Whether this is a consignment item (true/false)",
      example: "false",
    },
    {
      name: "supplier",
      required: false,
      description: "Supplier name (required if consignment is true, must exist in the system)",
      example: "ABC Suppliers",
    },
  ],
};

/**
 * Price update template specification
 */
export const PRICE_UPDATE_TEMPLATE_SPEC: TemplateSpec = {
  name: "Price Update Template",
  description: "Template for bulk updating stock item prices",
  fields: [
    {
      name: "itemCode",
      required: true,
      description: "The item code of the stock item (e.g., ITM-0001)",
      example: "ITM-0001",
    },
    {
      name: "price",
      required: true,
      description: "The new price/cost for the item (non-negative number)",
      example: "25.50",
    },
  ],
};

/**
 * Supplier import template specification
 */
export const SUPPLIER_TEMPLATE_SPEC: TemplateSpec = {
  name: "Suppliers Import Template",
  description: "Template for bulk importing suppliers",
  fields: [
    {
      name: "name",
      required: true,
      description: "The name of the supplier",
      example: "ABC Food Distributors",
    },
    {
      name: "contactName",
      required: false,
      description: "Primary contact person name",
      example: "John Smith",
    },
    {
      name: "email",
      required: false,
      description: "Contact email address",
      example: "john@abcfoods.com",
    },
    {
      name: "phone",
      required: false,
      description: "Contact phone number",
      example: "+63 912 345 6789",
    },
    {
      name: "address",
      required: false,
      description: "Business address",
      example: "123 Main St, Manila",
    },
  ],
};

/**
 * Generate CSV header row from template spec
 */
export function generateHeaderRow(spec: TemplateSpec): string {
  return spec.fields.map((f) => f.name).join(",");
}

/**
 * Generate example data row from template spec
 */
export function generateExampleRow(spec: TemplateSpec): string {
  return spec.fields.map((f) => {
    const value = f.example;
    // Escape if contains comma or quotes
    if (value.includes(",") || value.includes('"')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }).join(",");
}

/**
 * Get template specification without generating CSV
 * Useful for displaying field requirements in UI
 */
export function getTemplateSpec(templateType: "stockItem" | "priceUpdate" | "supplier"): TemplateSpec {
  switch (templateType) {
    case "stockItem":
      return STOCK_ITEM_TEMPLATE_SPEC;
    case "priceUpdate":
      return PRICE_UPDATE_TEMPLATE_SPEC;
    case "supplier":
      return SUPPLIER_TEMPLATE_SPEC;
    default:
      return STOCK_ITEM_TEMPLATE_SPEC;
  }
}

/**
 * Generate a simple CSV template without comments (for programmatic use)
 */
export function generateSimpleTemplate(spec: TemplateSpec): string {
  const headerRow = generateHeaderRow(spec);
  const exampleRow = generateExampleRow(spec);
  return `${headerRow}\n${exampleRow}`;
}
