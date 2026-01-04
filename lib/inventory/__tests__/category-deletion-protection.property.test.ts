/**
 * Property-Based Tests for Category Deletion Protection
 * 
 * Feature: enterprise-gaps
 * Property 15: Category Deletion Protection
 * 
 * For any stock category with associated stock items, deletion attempts SHALL be rejected.
 * 
 * **Validates: Requirements 11.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateCategoryDeletionPure,
  validateCategoryNamePure,
  validateSystemCategoryRenamePure,
  validateSystemCategoryDeactivationPure,
  CategoryDeletionContext,
} from '../stock-category-utils';

// Arbitrary for category deletion context
const categoryDeletionContextArb = fc.record({
  isSystem: fc.boolean(),
  stockItemCount: fc.integer({ min: 0, max: 10000 }),
});

// Arbitrary for non-empty strings (category names)
const categoryNameArb = fc.string({ minLength: 1, maxLength: 100 });

// Arbitrary for whitespace-only strings
const whitespaceOnlyArb = fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 0, maxLength: 10 }).map(arr => arr.join(''));

describe('Property 15: Category Deletion Protection', () => {
  /**
   * Property 15.1: Categories with stock items cannot be deleted
   * 
   * For any non-system category with stockItemCount > 0, deletion SHALL be rejected
   * due to having stock items
   */
  it('should reject deletion for any category with stock items', () => {
    fc.assert(
      fc.property(
        fc.record({
          isSystem: fc.constant(false), // Non-system category
          stockItemCount: fc.integer({ min: 1, max: 10000 }), // At least 1 item
        }),
        (context: CategoryDeletionContext) => {
          const result = validateCategoryDeletionPure(context);
          
          // If category has items, it cannot be deleted
          expect(result.canDelete).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('stock items');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15.2: System categories cannot be deleted regardless of item count
   * 
   * For any system category, deletion SHALL be rejected
   */
  it('should reject deletion for any system category', () => {
    fc.assert(
      fc.property(
        fc.record({
          isSystem: fc.constant(true),
          stockItemCount: fc.integer({ min: 0, max: 10000 }),
        }),
        (context: CategoryDeletionContext) => {
          const result = validateCategoryDeletionPure(context);
          
          // System categories cannot be deleted
          expect(result.canDelete).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('system');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15.3: Non-system categories with zero items can be deleted
   * 
   * For any non-system category with stockItemCount === 0, deletion SHALL be allowed
   */
  it('should allow deletion for non-system categories with no items', () => {
    fc.assert(
      fc.property(
        fc.record({
          isSystem: fc.constant(false),
          stockItemCount: fc.constant(0),
        }),
        (context: CategoryDeletionContext) => {
          const result = validateCategoryDeletionPure(context);
          
          // Non-system categories with no items can be deleted
          expect(result.canDelete).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15.4: Deletion validation is deterministic
   * 
   * For any category context, calling validateCategoryDeletionPure twice
   * with the same input SHALL produce the same result
   */
  it('should produce deterministic results for the same input', () => {
    fc.assert(
      fc.property(
        categoryDeletionContextArb,
        (context: CategoryDeletionContext) => {
          const result1 = validateCategoryDeletionPure(context);
          const result2 = validateCategoryDeletionPure(context);
          
          expect(result1.canDelete).toBe(result2.canDelete);
          expect(result1.error).toBe(result2.error);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15.5: System check takes precedence over item count check
   * 
   * For any system category, the error message should mention "system"
   * regardless of item count
   */
  it('should prioritize system category check over item count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        (stockItemCount: number) => {
          const context: CategoryDeletionContext = {
            isSystem: true,
            stockItemCount,
          };
          
          const result = validateCategoryDeletionPure(context);
          
          // System category error should be returned first
          expect(result.canDelete).toBe(false);
          expect(result.error).toContain('system');
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Category Name Validation', () => {
  /**
   * Property: Valid category names are accepted
   */
  it('should accept non-empty category names', () => {
    fc.assert(
      fc.property(
        categoryNameArb.filter(name => name.trim().length > 0),
        (name: string) => {
          const result = validateCategoryNamePure(name);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Empty or whitespace-only names are rejected
   */
  it('should reject empty or whitespace-only names', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''),
          fc.constant(null),
          fc.constant(undefined),
          whitespaceOnlyArb
        ),
        (name: string | null | undefined) => {
          const result = validateCategoryNamePure(name);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('System Category Rename Validation', () => {
  /**
   * Property: System categories cannot be renamed
   */
  it('should reject renaming system categories', () => {
    fc.assert(
      fc.property(
        categoryNameArb,
        categoryNameArb.filter(name => name.trim().length > 0),
        (currentName: string, newName: string) => {
          // Only test when names are different
          if (currentName === newName) return true;
          
          const result = validateSystemCategoryRenamePure(true, currentName, newName);
          expect(result.valid).toBe(false);
          expect(result.error).toContain('rename');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Non-system categories can be renamed
   */
  it('should allow renaming non-system categories', () => {
    fc.assert(
      fc.property(
        categoryNameArb,
        categoryNameArb,
        (currentName: string, newName: string) => {
          const result = validateSystemCategoryRenamePure(false, currentName, newName);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Keeping the same name is always valid
   */
  it('should allow keeping the same name for any category', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        categoryNameArb,
        (isSystem: boolean, name: string) => {
          const result = validateSystemCategoryRenamePure(isSystem, name, name);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('System Category Deactivation Validation', () => {
  /**
   * Property: System categories cannot be deactivated
   */
  it('should reject deactivating system categories', () => {
    fc.assert(
      fc.property(
        fc.constant(true), // isSystem
        fc.constant(false), // newActiveState (deactivating)
        (isSystem: boolean, newActiveState: boolean) => {
          const result = validateSystemCategoryDeactivationPure(isSystem, newActiveState);
          expect(result.valid).toBe(false);
          expect(result.error).toContain('deactivate');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Non-system categories can be deactivated
   */
  it('should allow deactivating non-system categories', () => {
    fc.assert(
      fc.property(
        fc.constant(false), // isSystem
        fc.boolean(), // any active state
        (isSystem: boolean, newActiveState: boolean) => {
          const result = validateSystemCategoryDeactivationPure(isSystem, newActiveState);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Activating any category is always valid
   */
  it('should allow activating any category', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // any isSystem value
        fc.constant(true), // activating
        (isSystem: boolean, newActiveState: boolean) => {
          const result = validateSystemCategoryDeactivationPure(isSystem, newActiveState);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Undefined active state is always valid (no change)
   */
  it('should allow undefined active state for any category', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (isSystem: boolean) => {
          const result = validateSystemCategoryDeactivationPure(isSystem, undefined);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
