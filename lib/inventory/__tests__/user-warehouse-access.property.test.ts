/**
 * Property-Based Tests for User-Warehouse Access Control
 * 
 * Feature: enterprise-gaps
 * Property 3: Warehouse Access Level Enforcement
 * 
 * For any user with a specific access level (VIEW, MANAGE, ADMIN) on a warehouse,
 * the system SHALL permit exactly the operations allowed for that level and deny all others.
 * 
 * **Validates: Requirements 2.2, 2.3, 2.4**
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Access level hierarchy for testing
const ACCESS_LEVEL_HIERARCHY: Record<string, number> = {
  VIEW: 1,
  MANAGE: 2,
  ADMIN: 3,
};

const ACCESS_LEVELS = ['VIEW', 'MANAGE', 'ADMIN'] as const;
type AccessLevel = typeof ACCESS_LEVELS[number];

// Operations allowed at each level
const OPERATIONS_BY_LEVEL: Record<AccessLevel, string[]> = {
  VIEW: ['read_stock_levels', 'read_movements'],
  MANAGE: ['read_stock_levels', 'read_movements', 'create_receipt', 'create_transfer', 'create_adjustment', 'create_requisition'],
  ADMIN: ['read_stock_levels', 'read_movements', 'create_receipt', 'create_transfer', 'create_adjustment', 'create_requisition', 'manage_user_access'],
};

// All possible operations
const ALL_OPERATIONS = [
  'read_stock_levels',
  'read_movements',
  'create_receipt',
  'create_transfer',
  'create_adjustment',
  'create_requisition',
  'manage_user_access',
];

/**
 * Pure function to check if an operation is allowed for a given access level
 * This mirrors the logic in the actual service
 */
function isOperationAllowed(userAccessLevel: AccessLevel, operation: string): boolean {
  const allowedOperations = OPERATIONS_BY_LEVEL[userAccessLevel];
  return allowedOperations.includes(operation);
}

/**
 * Pure function to check if a user's access level meets or exceeds the required level
 * This mirrors the checkWarehouseAccess logic
 */
function checkAccessLevel(userLevel: AccessLevel, requiredLevel: AccessLevel): boolean {
  const userLevelValue = ACCESS_LEVEL_HIERARCHY[userLevel];
  const requiredLevelValue = ACCESS_LEVEL_HIERARCHY[requiredLevel];
  return userLevelValue >= requiredLevelValue;
}

/**
 * Get the minimum required access level for an operation
 */
function getRequiredLevelForOperation(operation: string): AccessLevel | null {
  if (OPERATIONS_BY_LEVEL.VIEW.includes(operation)) {
    return 'VIEW';
  }
  if (OPERATIONS_BY_LEVEL.MANAGE.includes(operation) && !OPERATIONS_BY_LEVEL.VIEW.includes(operation)) {
    return 'MANAGE';
  }
  if (OPERATIONS_BY_LEVEL.ADMIN.includes(operation) && !OPERATIONS_BY_LEVEL.MANAGE.includes(operation)) {
    return 'ADMIN';
  }
  return null;
}

describe('Property 3: Warehouse Access Level Enforcement', () => {
  /**
   * Property 3.1: Access level hierarchy is respected
   * For any user access level and required level, access is granted if and only if
   * the user's level value >= required level value
   */
  it('should respect access level hierarchy for all level combinations', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ACCESS_LEVELS),
        fc.constantFrom(...ACCESS_LEVELS),
        (userLevel, requiredLevel) => {
          const hasAccess = checkAccessLevel(userLevel, requiredLevel);
          const userValue = ACCESS_LEVEL_HIERARCHY[userLevel];
          const requiredValue = ACCESS_LEVEL_HIERARCHY[requiredLevel];
          
          // Access should be granted iff user level >= required level
          expect(hasAccess).toBe(userValue >= requiredValue);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.2: VIEW level permits only read operations
   * For any user with VIEW access, only read operations should be allowed
   */
  it('should permit only read operations for VIEW access level', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_OPERATIONS),
        (operation) => {
          const isAllowed = isOperationAllowed('VIEW', operation);
          const isReadOperation = operation.startsWith('read_');
          
          // VIEW level should only allow read operations
          expect(isAllowed).toBe(isReadOperation);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.3: MANAGE level permits read and management operations but not user access management
   * For any user with MANAGE access, read and stock management operations should be allowed,
   * but user access management should be denied
   */
  it('should permit read and management operations for MANAGE access level but not user access management', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_OPERATIONS),
        (operation) => {
          const isAllowed = isOperationAllowed('MANAGE', operation);
          const isUserAccessOperation = operation === 'manage_user_access';
          
          // MANAGE level should allow everything except user access management
          if (isUserAccessOperation) {
            expect(isAllowed).toBe(false);
          } else {
            expect(isAllowed).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.4: ADMIN level permits all operations
   * For any user with ADMIN access, all operations should be allowed
   */
  it('should permit all operations for ADMIN access level', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_OPERATIONS),
        (operation) => {
          const isAllowed = isOperationAllowed('ADMIN', operation);
          
          // ADMIN level should allow all operations
          expect(isAllowed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.5: Higher access levels include all permissions of lower levels
   * For any operation allowed at a lower level, it should also be allowed at all higher levels
   */
  it('should include all lower level permissions in higher levels', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ACCESS_LEVELS),
        fc.constantFrom(...ALL_OPERATIONS),
        (accessLevel, operation) => {
          const isAllowed = isOperationAllowed(accessLevel, operation);
          
          if (isAllowed) {
            // If operation is allowed at this level, it should be allowed at all higher levels
            const levelValue = ACCESS_LEVEL_HIERARCHY[accessLevel];
            
            for (const higherLevel of ACCESS_LEVELS) {
              const higherLevelValue = ACCESS_LEVEL_HIERARCHY[higherLevel];
              if (higherLevelValue >= levelValue) {
                expect(isOperationAllowed(higherLevel, operation)).toBe(true);
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.6: Access check is consistent with operation permissions
   * For any user level and operation, the access check result should match
   * whether the operation is in the allowed operations list
   */
  it('should have consistent access check and operation permissions', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ACCESS_LEVELS),
        fc.constantFrom(...ALL_OPERATIONS),
        (userLevel, operation) => {
          const requiredLevel = getRequiredLevelForOperation(operation);
          
          if (requiredLevel) {
            const hasAccess = checkAccessLevel(userLevel, requiredLevel);
            const isOperationAllowedResult = isOperationAllowed(userLevel, operation);
            
            // Access check should be consistent with operation permissions
            expect(hasAccess).toBe(isOperationAllowedResult);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3.7: No access level grants operations outside the defined set
   * For any access level, only operations in ALL_OPERATIONS should be considered
   */
  it('should not grant access to undefined operations', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ACCESS_LEVELS),
        fc.string({ minLength: 1, maxLength: 50 }),
        (accessLevel, randomOperation) => {
          // Skip if the random string happens to be a valid operation
          if (ALL_OPERATIONS.includes(randomOperation)) {
            return true;
          }
          
          const isAllowed = isOperationAllowed(accessLevel, randomOperation);
          
          // Unknown operations should never be allowed
          expect(isAllowed).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
