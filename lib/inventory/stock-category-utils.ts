/**
 * Pure utility functions for stock category operations
 * These are used for property-based testing and don't require server actions
 */

// Pure validation types for property-based testing
export interface CategoryDeletionContext {
  isSystem: boolean;
  stockItemCount: number;
}

export interface CategoryDeletionResult {
  canDelete: boolean;
  error?: string;
}

/**
 * Pure function to validate if a category can be deleted
 * This function contains no side effects and can be tested with property-based testing
 * 
 * Property 15: Category Deletion Protection
 * For any stock category with associated stock items, deletion attempts SHALL be rejected.
 * 
 * **Validates: Requirements 11.5**
 */
export function validateCategoryDeletionPure(context: CategoryDeletionContext): CategoryDeletionResult {
  // System categories cannot be deleted
  if (context.isSystem) {
    return {
      canDelete: false,
      error: "Cannot delete system categories",
    };
  }

  // Categories with stock items cannot be deleted
  if (context.stockItemCount > 0) {
    return {
      canDelete: false,
      error: "Cannot delete category with existing stock items. Deactivate instead.",
    };
  }

  // Category can be deleted
  return {
    canDelete: true,
  };
}

/**
 * Pure function to validate category name
 */
export function validateCategoryNamePure(name: string | undefined | null): { valid: boolean; error?: string } {
  if (!name || name.trim() === "") {
    return { valid: false, error: "Category name is required" };
  }
  return { valid: true };
}

/**
 * Pure function to validate if a system category can be renamed
 */
export function validateSystemCategoryRenamePure(
  isSystem: boolean,
  currentName: string,
  newName: string | undefined
): { valid: boolean; error?: string } {
  if (isSystem && newName && newName !== currentName) {
    return { valid: false, error: "Cannot rename system categories" };
  }
  return { valid: true };
}

/**
 * Pure function to validate if a system category can be deactivated
 */
export function validateSystemCategoryDeactivationPure(
  isSystem: boolean,
  newActiveState: boolean | undefined
): { valid: boolean; error?: string } {
  if (isSystem && newActiveState === false) {
    return { valid: false, error: "Cannot deactivate system categories" };
  }
  return { valid: true };
}
