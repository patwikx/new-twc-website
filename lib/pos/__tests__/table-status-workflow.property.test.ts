/**
 * Property-Based Tests for Table Status Workflow
 * 
 * Feature: enterprise-gaps
 * Property 5: Table Status Workflow Integrity
 * 
 * For any table, status transitions SHALL follow the valid workflow:
 * creating an order sets OCCUPIED, paying sets DIRTY, cleaning sets AVAILABLE.
 * 
 * **Validates: Requirements 4.3, 4.4, 4.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isValidStatusTransition } from '../table-utils';

// Table statuses matching the Prisma enum
const TABLE_STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'DIRTY', 'OUT_OF_SERVICE'] as const;
type TableStatus = typeof TABLE_STATUSES[number];

/**
 * Valid status transitions based on the workflow defined in requirements
 * Requirements: 4.3, 4.4, 4.5
 * 
 * - WHEN an order is created for a table, THE System SHALL automatically set the table status to OCCUPIED
 * - WHEN an order is paid and closed, THE System SHALL set the table status to DIRTY
 * - WHEN a table is marked as cleaned, THE System SHALL set the table status to AVAILABLE
 */
const VALID_TRANSITIONS: Record<TableStatus, TableStatus[]> = {
  AVAILABLE: ['OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE'],
  OCCUPIED: ['DIRTY', 'OUT_OF_SERVICE'], // After order is paid
  RESERVED: ['OCCUPIED', 'AVAILABLE', 'OUT_OF_SERVICE'],
  DIRTY: ['AVAILABLE', 'OUT_OF_SERVICE'], // After cleaning
  OUT_OF_SERVICE: ['AVAILABLE', 'DIRTY'],
};

/**
 * Pure function to check if a transition is valid (mirrors the service logic)
 */
function checkTransitionValid(from: TableStatus, to: TableStatus): boolean {
  if (from === to) return true; // No change is always valid
  return VALID_TRANSITIONS[from].includes(to);
}

describe('Property 5: Table Status Workflow Integrity', () => {
  /**
   * Property 5.1: Same status transition is always valid
   * For any table status, transitioning to the same status should always be allowed
   */
  it('should allow transitioning to the same status (no-op)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TABLE_STATUSES),
        (status) => {
          const isValid = isValidStatusTransition(status, status);
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.2: Order creation sets table to OCCUPIED
   * Requirements: 4.3
   * 
   * WHEN an order is created for a table, THE System SHALL automatically set the table status to OCCUPIED
   * This means AVAILABLE -> OCCUPIED and RESERVED -> OCCUPIED must be valid
   */
  it('should allow transition to OCCUPIED when creating an order (from AVAILABLE or RESERVED)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('AVAILABLE' as TableStatus, 'RESERVED' as TableStatus),
        (fromStatus) => {
          const isValid = isValidStatusTransition(fromStatus, 'OCCUPIED');
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.3: Order payment sets table to DIRTY
   * Requirements: 4.4
   * 
   * WHEN an order is paid and closed, THE System SHALL set the table status to DIRTY
   * This means OCCUPIED -> DIRTY must be valid
   */
  it('should allow transition from OCCUPIED to DIRTY when order is paid', () => {
    fc.assert(
      fc.property(
        fc.constant('OCCUPIED' as TableStatus),
        (fromStatus) => {
          const isValid = isValidStatusTransition(fromStatus, 'DIRTY');
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.4: Cleaning sets table to AVAILABLE
   * Requirements: 4.5
   * 
   * WHEN a table is marked as cleaned, THE System SHALL set the table status to AVAILABLE
   * This means DIRTY -> AVAILABLE must be valid
   */
  it('should allow transition from DIRTY to AVAILABLE when table is cleaned', () => {
    fc.assert(
      fc.property(
        fc.constant('DIRTY' as TableStatus),
        (fromStatus) => {
          const isValid = isValidStatusTransition(fromStatus, 'AVAILABLE');
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.5: Complete workflow cycle is valid
   * The full workflow: AVAILABLE -> OCCUPIED -> DIRTY -> AVAILABLE should be valid
   */
  it('should support the complete table workflow cycle', () => {
    fc.assert(
      fc.property(
        fc.constant(null), // Just need to run the test
        () => {
          // Step 1: Table starts AVAILABLE, order created -> OCCUPIED
          expect(isValidStatusTransition('AVAILABLE', 'OCCUPIED')).toBe(true);
          
          // Step 2: Order paid -> DIRTY
          expect(isValidStatusTransition('OCCUPIED', 'DIRTY')).toBe(true);
          
          // Step 3: Table cleaned -> AVAILABLE
          expect(isValidStatusTransition('DIRTY', 'AVAILABLE')).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.6: Invalid transitions are rejected
   * Certain transitions should not be allowed to maintain workflow integrity
   */
  it('should reject invalid status transitions', () => {
    // Define explicitly invalid transitions
    const invalidTransitions: [TableStatus, TableStatus][] = [
      ['AVAILABLE', 'DIRTY'],      // Can't go directly to dirty without being occupied
      ['OCCUPIED', 'AVAILABLE'],   // Must go through DIRTY first
      ['OCCUPIED', 'RESERVED'],    // Can't reserve an occupied table
      ['DIRTY', 'OCCUPIED'],       // Must clean first (go to AVAILABLE)
      ['DIRTY', 'RESERVED'],       // Must clean first
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...invalidTransitions),
        ([fromStatus, toStatus]) => {
          const isValid = isValidStatusTransition(fromStatus, toStatus);
          expect(isValid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.7: OUT_OF_SERVICE can be reached from any status
   * Tables can be taken out of service from any state for maintenance
   */
  it('should allow transition to OUT_OF_SERVICE from any status', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TABLE_STATUSES.filter(s => s !== 'OUT_OF_SERVICE')),
        (fromStatus) => {
          const isValid = isValidStatusTransition(fromStatus, 'OUT_OF_SERVICE');
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.8: Service implementation matches expected behavior
   * The isValidStatusTransition function should match our expected transition rules
   */
  it('should have service implementation match expected transition rules', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TABLE_STATUSES),
        fc.constantFrom(...TABLE_STATUSES),
        (fromStatus, toStatus) => {
          const serviceResult = isValidStatusTransition(fromStatus, toStatus);
          const expectedResult = checkTransitionValid(fromStatus, toStatus);
          
          expect(serviceResult).toBe(expectedResult);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.9: Reserved tables can become occupied or available
   * Reserved tables should be able to transition when guests arrive or reservation is cancelled
   */
  it('should allow reserved tables to become occupied or available', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('OCCUPIED' as TableStatus, 'AVAILABLE' as TableStatus),
        (toStatus) => {
          const isValid = isValidStatusTransition('RESERVED', toStatus);
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.10: Transition validity is deterministic
   * For any given pair of statuses, the transition validity should always return the same result
   */
  it('should return consistent results for the same status pair', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TABLE_STATUSES),
        fc.constantFrom(...TABLE_STATUSES),
        fc.integer({ min: 1, max: 10 }),
        (fromStatus, toStatus, iterations) => {
          const results: boolean[] = [];
          
          for (let i = 0; i < iterations; i++) {
            results.push(isValidStatusTransition(fromStatus, toStatus));
          }
          
          // All results should be the same
          const allSame = results.every(r => r === results[0]);
          expect(allSame).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
