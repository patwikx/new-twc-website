/**
 * Property-Based Tests for Bulk Import Atomicity
 * 
 * Feature: enterprise-gaps
 * Property 22: Bulk Import Atomicity
 * 
 * For any bulk import operation with validation errors, no records SHALL be created
 * and all errors SHALL be reported.
 * 
 * **Validates: Requirements 17.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  validateStockItemImportPure, 
  StockItemImportRow,
  parseCSV 
} from '../import-utils';

// Arbitraries for generating test data
const validNameArb = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => s.trim().length > 0);

const validSkuArb = fc.option(
  fc.string({ minLength: 3, maxLength: 20 }).filter(s => s.trim().length > 0),
  { nil: undefined }
);

const categoryNameArb = fc.constantFrom('Food', 'Beverage', 'Supplies', 'Equipment');
const unitAbbrevArb = fc.constantFrom('kg', 'g', 'L', 'ml', 'pcs', 'ea');
const supplierNameArb = fc.constantFrom('Supplier A', 'Supplier B', 'Supplier C');

// Valid row generator
const validRowArb = fc.record({
  name: validNameArb,
  sku: validSkuArb,
  categoryName: categoryNameArb,
  unitAbbreviation: unitAbbrevArb,
  isConsignment: fc.boolean(),
  supplierName: fc.option(supplierNameArb, { nil: undefined }),
}).map(row => {
  // If consignment, ensure supplier is set
  if (row.isConsignment && !row.supplierName) {
    row.supplierName = 'Supplier A';
  }
  return row as StockItemImportRow;
});

// Invalid row generators
const rowWithEmptyNameArb = validRowArb.map(row => ({
  ...row,
  name: '',
}));

const rowWithInvalidCategoryArb = validRowArb.map(row => ({
  ...row,
  categoryName: 'NonExistentCategory',
}));

const rowWithInvalidUnitArb = validRowArb.map(row => ({
  ...row,
  unitAbbreviation: 'xyz',
}));

const rowWithConsignmentNoSupplierArb = validRowArb.map(row => ({
  ...row,
  isConsignment: true,
  supplierName: undefined,
}));

// Reference data sets
const existingCategories = new Set(['food', 'beverage', 'supplies', 'equipment']);
const existingUnits = new Set(['kg', 'g', 'l', 'ml', 'pcs', 'ea']);
const existingSuppliers = new Set(['supplier a', 'supplier b', 'supplier c']);
const existingSkus = new Set<string>();

describe('Property 22: Bulk Import Atomicity', () => {
  /**
   * Property 22.1: All valid rows pass validation
   */
  it('should accept all valid rows when no errors exist', () => {
    fc.assert(
      fc.property(
        fc.array(validRowArb, { minLength: 1, maxLength: 20 }),
        (rows) => {
          const result = validateStockItemImportPure(
            rows,
            existingCategories,
            existingUnits,
            existingSuppliers,
            existingSkus
          );
          
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
          expect(result.validRows).toHaveLength(rows.length);
          expect(result.totalRows).toBe(rows.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22.2: Single invalid row causes entire import to fail
   */
  it('should reject entire import when any row has validation errors', () => {
    fc.assert(
      fc.property(
        fc.array(validRowArb, { minLength: 0, maxLength: 10 }),
        rowWithEmptyNameArb,
        fc.array(validRowArb, { minLength: 0, maxLength: 10 }),
        (validBefore, invalidRow, validAfter) => {
          const allRows = [...validBefore, invalidRow, ...validAfter];
          
          const result = validateStockItemImportPure(
            allRows,
            existingCategories,
            existingUnits,
            existingSuppliers,
            existingSkus
          );
          
          // Import should fail
          expect(result.valid).toBe(false);
          // At least one error should be reported
          expect(result.errors.length).toBeGreaterThan(0);
          // Valid rows count should not include invalid row
          expect(result.validRows.length).toBeLessThan(allRows.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22.3: All errors are reported, not just the first one
   */
  it('should report all validation errors, not just the first', () => {
    fc.assert(
      fc.property(
        fc.array(rowWithEmptyNameArb, { minLength: 2, maxLength: 10 }),
        (invalidRows) => {
          const result = validateStockItemImportPure(
            invalidRows,
            existingCategories,
            existingUnits,
            existingSuppliers,
            existingSkus
          );
          
          // Should have at least one error per invalid row
          expect(result.errors.length).toBeGreaterThanOrEqual(invalidRows.length);
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22.4: Invalid category is detected
   */
  it('should detect invalid category names', () => {
    fc.assert(
      fc.property(
        rowWithInvalidCategoryArb,
        (invalidRow) => {
          const result = validateStockItemImportPure(
            [invalidRow],
            existingCategories,
            existingUnits,
            existingSuppliers,
            existingSkus
          );
          
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.field === 'categoryName')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22.5: Invalid unit is detected
   */
  it('should detect invalid unit abbreviations', () => {
    fc.assert(
      fc.property(
        rowWithInvalidUnitArb,
        (invalidRow) => {
          const result = validateStockItemImportPure(
            [invalidRow],
            existingCategories,
            existingUnits,
            existingSuppliers,
            existingSkus
          );
          
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.field === 'unitAbbreviation')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22.6: Consignment without supplier is detected
   */
  it('should detect consignment items without supplier', () => {
    fc.assert(
      fc.property(
        rowWithConsignmentNoSupplierArb,
        (invalidRow) => {
          const result = validateStockItemImportPure(
            [invalidRow],
            existingCategories,
            existingUnits,
            existingSuppliers,
            existingSkus
          );
          
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => e.field === 'supplierName')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22.7: Duplicate SKUs within import are detected
   */
  it('should detect duplicate SKUs within the same import', () => {
    fc.assert(
      fc.property(
        validRowArb,
        fc.string({ minLength: 3, maxLength: 10 }).filter(s => s.trim().length > 0),
        (baseRow, sku) => {
          const row1 = { ...baseRow, sku };
          const row2 = { ...baseRow, sku, name: baseRow.name + ' Copy' };
          
          const result = validateStockItemImportPure(
            [row1, row2],
            existingCategories,
            existingUnits,
            existingSuppliers,
            existingSkus
          );
          
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => 
            e.field === 'sku' && e.message.includes('Duplicate')
          )).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22.8: Existing SKUs are detected
   */
  it('should detect SKUs that already exist in the system', () => {
    fc.assert(
      fc.property(
        validRowArb,
        (row) => {
          const existingSku = 'EXISTING-SKU-001';
          const rowWithExistingSku = { ...row, sku: existingSku };
          const skusWithExisting = new Set([existingSku.toLowerCase()]);
          
          const result = validateStockItemImportPure(
            [rowWithExistingSku],
            existingCategories,
            existingUnits,
            existingSuppliers,
            skusWithExisting
          );
          
          expect(result.valid).toBe(false);
          expect(result.errors.some(e => 
            e.field === 'sku' && e.message.includes('already exists')
          )).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22.9: Error row numbers are correct
   */
  it('should report correct row numbers for errors', () => {
    fc.assert(
      fc.property(
        fc.array(validRowArb, { minLength: 0, maxLength: 5 }),
        rowWithEmptyNameArb,
        (validBefore, invalidRow) => {
          const allRows = [...validBefore, invalidRow];
          
          const result = validateStockItemImportPure(
            allRows,
            existingCategories,
            existingUnits,
            existingSuppliers,
            existingSkus
          );
          
          // Row number should be index + 2 (1-indexed + header row)
          const expectedRowNum = validBefore.length + 2;
          expect(result.errors.some(e => e.row === expectedRowNum)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22.10: Valid rows count matches when no errors
   */
  it('should have validRows count equal to totalRows when all valid', () => {
    fc.assert(
      fc.property(
        fc.array(validRowArb, { minLength: 1, maxLength: 20 }),
        (rows) => {
          const result = validateStockItemImportPure(
            rows,
            existingCategories,
            existingUnits,
            existingSuppliers,
            existingSkus
          );
          
          if (result.valid) {
            expect(result.validRows.length).toBe(result.totalRows);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22.11: Empty import is handled
   */
  it('should handle empty import gracefully', () => {
    const result = validateStockItemImportPure(
      [],
      existingCategories,
      existingUnits,
      existingSuppliers,
      existingSkus
    );
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.validRows).toHaveLength(0);
    expect(result.totalRows).toBe(0);
  });

  /**
   * Property 22.12: Multiple error types in single row are all reported
   */
  it('should report multiple errors for a single row with multiple issues', () => {
    fc.assert(
      fc.property(
        fc.constant({
          name: '',
          sku: undefined,
          categoryName: 'InvalidCategory',
          unitAbbreviation: 'invalidunit',
          isConsignment: true,
          supplierName: undefined,
        } as StockItemImportRow),
        (badRow) => {
          const result = validateStockItemImportPure(
            [badRow],
            existingCategories,
            existingUnits,
            existingSuppliers,
            existingSkus
          );
          
          expect(result.valid).toBe(false);
          // Should have multiple errors for the same row
          expect(result.errors.length).toBeGreaterThan(1);
          
          // Check that different fields are reported
          const errorFields = new Set(result.errors.map(e => e.field));
          expect(errorFields.size).toBeGreaterThan(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 22.13: CSV parsing handles quoted fields correctly
   */
  it('should parse CSV with quoted fields containing commas', () => {
    const csvContent = 'name,category,unit\n"Item, with comma",Food,kg';
    const parsed = parseCSV(csvContent);
    
    expect(parsed).toHaveLength(2);
    expect(parsed[1][0]).toBe('Item, with comma');
  });

  /**
   * Property 22.14: CSV parsing handles escaped quotes
   */
  it('should parse CSV with escaped quotes', () => {
    const csvContent = 'name,category,unit\n"Item ""quoted"" name",Food,kg';
    const parsed = parseCSV(csvContent);
    
    expect(parsed).toHaveLength(2);
    expect(parsed[1][0]).toBe('Item "quoted" name');
  });

  /**
   * Property 22.15: Validation is case-insensitive for lookups
   */
  it('should perform case-insensitive validation for categories and units', () => {
    fc.assert(
      fc.property(
        validRowArb,
        (row) => {
          // Modify to use different case
          const rowWithDifferentCase = {
            ...row,
            categoryName: row.categoryName.toUpperCase(),
            unitAbbreviation: row.unitAbbreviation.toUpperCase(),
          };
          
          const result = validateStockItemImportPure(
            [rowWithDifferentCase],
            existingCategories,
            existingUnits,
            existingSuppliers,
            existingSkus
          );
          
          // Should still be valid due to case-insensitive matching
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
