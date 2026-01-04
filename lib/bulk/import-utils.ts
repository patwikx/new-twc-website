// ============================================================================
// Bulk Import Utility Functions (Pure functions for validation and parsing)
// Requirements: 17.1, 17.2, 17.4
// ============================================================================

/**
 * Stock item import row structure
 */
export interface StockItemImportRow {
  name: string;
  sku?: string;
  categoryName: string;
  unitAbbreviation: string;
  isConsignment?: boolean;
  supplierName?: string;
}

/**
 * Validation error for a single row
 */
export interface ImportRowError {
  row: number;
  field: string;
  message: string;
  value?: string;
}

/**
 * Result of import validation
 */
export interface ImportValidationResult {
  valid: boolean;
  errors: ImportRowError[];
  validRows: StockItemImportRow[];
  totalRows: number;
}

/**
 * Price update row structure
 */
export interface PriceUpdateRow {
  itemCode: string;
  newPrice: number;
}

/**
 * Parse CSV content into rows
 */
export function parseCSV(content: string): string[][] {
  const lines = content.trim().split(/\r?\n/);
  return lines.map((line) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"' && inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
}

/**
 * Validate stock item import data (pure function for testing)
 * Requirements: 17.1, 17.4
 */
export function validateStockItemImportPure(
  rows: StockItemImportRow[],
  existingCategories: Set<string>,
  existingUnits: Set<string>,
  existingSuppliers: Set<string>,
  existingSkus: Set<string>
): ImportValidationResult {
  const errors: ImportRowError[] = [];
  const validRows: StockItemImportRow[] = [];
  const seenSkus = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2 for 1-indexed and header row
    let rowValid = true;

    // Validate name (required)
    if (!row.name || row.name.trim() === "") {
      errors.push({
        row: rowNum,
        field: "name",
        message: "Name is required",
        value: row.name,
      });
      rowValid = false;
    }

    // Validate category (required, must exist)
    if (!row.categoryName || row.categoryName.trim() === "") {
      errors.push({
        row: rowNum,
        field: "categoryName",
        message: "Category is required",
        value: row.categoryName,
      });
      rowValid = false;
    } else if (!existingCategories.has(row.categoryName.toLowerCase())) {
      errors.push({
        row: rowNum,
        field: "categoryName",
        message: `Category "${row.categoryName}" does not exist`,
        value: row.categoryName,
      });
      rowValid = false;
    }

    // Validate unit (required, must exist)
    if (!row.unitAbbreviation || row.unitAbbreviation.trim() === "") {
      errors.push({
        row: rowNum,
        field: "unitAbbreviation",
        message: "Unit abbreviation is required",
        value: row.unitAbbreviation,
      });
      rowValid = false;
    } else if (!existingUnits.has(row.unitAbbreviation.toLowerCase())) {
      errors.push({
        row: rowNum,
        field: "unitAbbreviation",
        message: `Unit "${row.unitAbbreviation}" does not exist`,
        value: row.unitAbbreviation,
      });
      rowValid = false;
    }

    // Validate SKU (optional, but must be unique if provided)
    if (row.sku && row.sku.trim() !== "") {
      const skuLower = row.sku.toLowerCase();
      if (existingSkus.has(skuLower)) {
        errors.push({
          row: rowNum,
          field: "sku",
          message: `SKU "${row.sku}" already exists in the system`,
          value: row.sku,
        });
        rowValid = false;
      } else if (seenSkus.has(skuLower)) {
        errors.push({
          row: rowNum,
          field: "sku",
          message: `Duplicate SKU "${row.sku}" in import file`,
          value: row.sku,
        });
        rowValid = false;
      } else {
        seenSkus.add(skuLower);
      }
    }

    // Validate supplier (required if consignment)
    if (row.isConsignment) {
      if (!row.supplierName || row.supplierName.trim() === "") {
        errors.push({
          row: rowNum,
          field: "supplierName",
          message: "Supplier is required for consignment items",
          value: row.supplierName,
        });
        rowValid = false;
      } else if (!existingSuppliers.has(row.supplierName.toLowerCase())) {
        errors.push({
          row: rowNum,
          field: "supplierName",
          message: `Supplier "${row.supplierName}" does not exist`,
          value: row.supplierName,
        });
        rowValid = false;
      }
    }

    if (rowValid) {
      validRows.push(row);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    validRows,
    totalRows: rows.length,
  };
}

/**
 * Validate price update data (pure function for testing)
 * Requirements: 17.2
 */
export function validatePriceUpdatePure(
  rows: PriceUpdateRow[],
  existingItemCodes: Set<string>
): ImportValidationResult {
  const errors: ImportRowError[] = [];
  const validRows: StockItemImportRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    let rowValid = true;

    // Validate item code (required, must exist)
    if (!row.itemCode || row.itemCode.trim() === "") {
      errors.push({
        row: rowNum,
        field: "itemCode",
        message: "Item code is required",
        value: row.itemCode,
      });
      rowValid = false;
    } else if (!existingItemCodes.has(row.itemCode.toUpperCase())) {
      errors.push({
        row: rowNum,
        field: "itemCode",
        message: `Item code "${row.itemCode}" does not exist`,
        value: row.itemCode,
      });
      rowValid = false;
    }

    // Validate price (required, must be positive)
    if (row.newPrice === undefined || row.newPrice === null) {
      errors.push({
        row: rowNum,
        field: "newPrice",
        message: "New price is required",
        value: String(row.newPrice),
      });
      rowValid = false;
    } else if (isNaN(row.newPrice) || row.newPrice < 0) {
      errors.push({
        row: rowNum,
        field: "newPrice",
        message: "Price must be a non-negative number",
        value: String(row.newPrice),
      });
      rowValid = false;
    }

    if (rowValid) {
      // Cast to any to satisfy the type - we're reusing the structure
      validRows.push(row as unknown as StockItemImportRow);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    validRows,
    totalRows: rows.length,
  };
}
