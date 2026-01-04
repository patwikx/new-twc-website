/**
 * Property-Based Tests for Order Status Progression
 * 
 * Feature: enterprise-gaps
 * Property 8: Order Status Progression
 * 
 * For any order, status transitions SHALL follow valid paths:
 * OPEN → SENT_TO_KITCHEN → IN_PROGRESS → READY → SERVED → PAID
 * with CANCELLED/VOID as terminal states from any non-PAID state.
 * 
 * **Validates: Requirements 5.3, 6.5, 7.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isValidOrderStatusTransition, isValidItemStatusTransition } from '../order-utils';

// Order statuses matching the Prisma enum
const ORDER_STATUSES = [
  'OPEN',
  'SENT_TO_KITCHEN',
  'IN_PROGRESS',
  'READY',
  'SERVED',
  'PAID',
  'CANCELLED',
  'VOID',
] as const;
type OrderStatus = typeof ORDER_STATUSES[number];

// Order item statuses matching the Prisma enum
const ITEM_STATUSES = [
  'PENDING',
  'SENT',
  'PREPARING',
  'READY',
  'SERVED',
  'CANCELLED',
] as const;
type ItemStatus = typeof ITEM_STATUSES[number];

// Terminal states that cannot transition to any other state
const TERMINAL_ORDER_STATUSES: OrderStatus[] = ['PAID', 'CANCELLED', 'VOID'];
const TERMINAL_ITEM_STATUSES: ItemStatus[] = ['SERVED', 'CANCELLED'];

// Valid order status transitions (reference for testing)
const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  OPEN: ['SENT_TO_KITCHEN', 'CANCELLED', 'VOID'],
  SENT_TO_KITCHEN: ['IN_PROGRESS', 'CANCELLED', 'VOID'],
  IN_PROGRESS: ['READY', 'CANCELLED', 'VOID'],
  READY: ['SERVED', 'CANCELLED', 'VOID'],
  SERVED: ['PAID', 'CANCELLED', 'VOID'],
  PAID: [],
  CANCELLED: [],
  VOID: [],
};

// Valid item status transitions (reference for testing)
const VALID_ITEM_TRANSITIONS: Record<ItemStatus, ItemStatus[]> = {
  PENDING: ['SENT', 'CANCELLED'],
  SENT: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['SERVED', 'CANCELLED'],
  SERVED: [],
  CANCELLED: [],
};

// The happy path for order status progression
const HAPPY_PATH_ORDER: OrderStatus[] = [
  'OPEN',
  'SENT_TO_KITCHEN',
  'IN_PROGRESS',
  'READY',
  'SERVED',
  'PAID',
];

// The happy path for item status progression
const HAPPY_PATH_ITEM: ItemStatus[] = [
  'PENDING',
  'SENT',
  'PREPARING',
  'READY',
  'SERVED',
];

/**
 * Pure function to check if an order transition is valid (mirrors the service logic)
 */
function checkOrderTransitionValid(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return VALID_ORDER_TRANSITIONS[from].includes(to);
}

/**
 * Pure function to check if an item transition is valid (mirrors the service logic)
 */
function checkItemTransitionValid(from: ItemStatus, to: ItemStatus): boolean {
  if (from === to) return true;
  return VALID_ITEM_TRANSITIONS[from].includes(to);
}

describe('Property 8: Order Status Progression', () => {
  // ============================================================================
  // Order Status Tests
  // ============================================================================

  /**
   * Property 8.1: Same status transition is always valid
   */
  it('should allow transitioning to the same order status (no-op)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ORDER_STATUSES),
        (status) => {
          const isValid = isValidOrderStatusTransition(status, status);
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.2: Happy path order progression is valid
   * OPEN → SENT_TO_KITCHEN → IN_PROGRESS → READY → SERVED → PAID
   */
  it('should allow the complete happy path order progression', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          for (let i = 0; i < HAPPY_PATH_ORDER.length - 1; i++) {
            const from = HAPPY_PATH_ORDER[i];
            const to = HAPPY_PATH_ORDER[i + 1];
            expect(isValidOrderStatusTransition(from, to)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.3: Terminal states cannot transition to any other state
   * PAID, CANCELLED, and VOID are terminal states
   */
  it('should not allow transitions from terminal order states', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TERMINAL_ORDER_STATUSES),
        fc.constantFrom(...ORDER_STATUSES.filter(s => !TERMINAL_ORDER_STATUSES.includes(s))),
        (terminalStatus, otherStatus) => {
          const isValid = isValidOrderStatusTransition(terminalStatus, otherStatus);
          expect(isValid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.4: CANCELLED can be reached from any non-terminal state
   */
  it('should allow cancellation from any non-terminal order state', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ORDER_STATUSES.filter(s => !TERMINAL_ORDER_STATUSES.includes(s))),
        (fromStatus) => {
          const isValid = isValidOrderStatusTransition(fromStatus, 'CANCELLED');
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.5: VOID can be reached from any non-terminal state
   */
  it('should allow voiding from any non-terminal order state', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ORDER_STATUSES.filter(s => !TERMINAL_ORDER_STATUSES.includes(s))),
        (fromStatus) => {
          const isValid = isValidOrderStatusTransition(fromStatus, 'VOID');
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.6: Cannot skip steps in the happy path
   * For example, OPEN cannot go directly to READY
   */
  it('should not allow skipping steps in order progression', () => {
    // Define invalid skip transitions
    const invalidSkips: [OrderStatus, OrderStatus][] = [
      ['OPEN', 'IN_PROGRESS'],
      ['OPEN', 'READY'],
      ['OPEN', 'SERVED'],
      ['OPEN', 'PAID'],
      ['SENT_TO_KITCHEN', 'READY'],
      ['SENT_TO_KITCHEN', 'SERVED'],
      ['SENT_TO_KITCHEN', 'PAID'],
      ['IN_PROGRESS', 'SERVED'],
      ['IN_PROGRESS', 'PAID'],
      ['READY', 'PAID'],
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...invalidSkips),
        ([from, to]) => {
          const isValid = isValidOrderStatusTransition(from, to);
          expect(isValid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.7: Cannot go backwards in the happy path
   */
  it('should not allow going backwards in order progression', () => {
    // Define invalid backward transitions
    const invalidBackwards: [OrderStatus, OrderStatus][] = [
      ['SENT_TO_KITCHEN', 'OPEN'],
      ['IN_PROGRESS', 'OPEN'],
      ['IN_PROGRESS', 'SENT_TO_KITCHEN'],
      ['READY', 'OPEN'],
      ['READY', 'SENT_TO_KITCHEN'],
      ['READY', 'IN_PROGRESS'],
      ['SERVED', 'OPEN'],
      ['SERVED', 'SENT_TO_KITCHEN'],
      ['SERVED', 'IN_PROGRESS'],
      ['SERVED', 'READY'],
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...invalidBackwards),
        ([from, to]) => {
          const isValid = isValidOrderStatusTransition(from, to);
          expect(isValid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.8: Service implementation matches expected behavior
   */
  it('should have order status service match expected transition rules', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ORDER_STATUSES),
        fc.constantFrom(...ORDER_STATUSES),
        (fromStatus, toStatus) => {
          const serviceResult = isValidOrderStatusTransition(fromStatus, toStatus);
          const expectedResult = checkOrderTransitionValid(fromStatus, toStatus);
          
          expect(serviceResult).toBe(expectedResult);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================================================
  // Order Item Status Tests
  // ============================================================================

  /**
   * Property 8.9: Same item status transition is always valid
   */
  it('should allow transitioning to the same item status (no-op)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ITEM_STATUSES),
        (status) => {
          const isValid = isValidItemStatusTransition(status, status);
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.10: Happy path item progression is valid
   * PENDING → SENT → PREPARING → READY → SERVED
   */
  it('should allow the complete happy path item progression', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          for (let i = 0; i < HAPPY_PATH_ITEM.length - 1; i++) {
            const from = HAPPY_PATH_ITEM[i];
            const to = HAPPY_PATH_ITEM[i + 1];
            expect(isValidItemStatusTransition(from, to)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.11: Terminal item states cannot transition
   */
  it('should not allow transitions from terminal item states', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TERMINAL_ITEM_STATUSES),
        fc.constantFrom(...ITEM_STATUSES.filter(s => !TERMINAL_ITEM_STATUSES.includes(s))),
        (terminalStatus, otherStatus) => {
          const isValid = isValidItemStatusTransition(terminalStatus, otherStatus);
          expect(isValid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.12: Items can be cancelled from any non-terminal state
   */
  it('should allow cancellation from any non-terminal item state', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ITEM_STATUSES.filter(s => !TERMINAL_ITEM_STATUSES.includes(s))),
        (fromStatus) => {
          const isValid = isValidItemStatusTransition(fromStatus, 'CANCELLED');
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.13: Service implementation matches expected item behavior
   */
  it('should have item status service match expected transition rules', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ITEM_STATUSES),
        fc.constantFrom(...ITEM_STATUSES),
        (fromStatus, toStatus) => {
          const serviceResult = isValidItemStatusTransition(fromStatus, toStatus);
          const expectedResult = checkItemTransitionValid(fromStatus, toStatus);
          
          expect(serviceResult).toBe(expectedResult);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.14: Transition validity is deterministic
   */
  it('should return consistent results for the same status pair', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ORDER_STATUSES),
        fc.constantFrom(...ORDER_STATUSES),
        fc.integer({ min: 1, max: 10 }),
        (fromStatus, toStatus, iterations) => {
          const results: boolean[] = [];
          
          for (let i = 0; i < iterations; i++) {
            results.push(isValidOrderStatusTransition(fromStatus, toStatus));
          }
          
          // All results should be the same
          const allSame = results.every(r => r === results[0]);
          expect(allSame).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8.15: PAID is only reachable from SERVED
   * Requirements: 7.5
   */
  it('should only allow PAID status from SERVED', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ORDER_STATUSES.filter(s => s !== 'SERVED' && s !== 'PAID')),
        (fromStatus) => {
          const isValid = isValidOrderStatusTransition(fromStatus, 'PAID');
          expect(isValid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );

    // And verify SERVED -> PAID is valid
    expect(isValidOrderStatusTransition('SERVED', 'PAID')).toBe(true);
  });

  /**
   * Property 8.16: IN_PROGRESS is only reachable from SENT_TO_KITCHEN
   * Requirements: 6.5
   */
  it('should only allow IN_PROGRESS status from SENT_TO_KITCHEN', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ORDER_STATUSES.filter(s => s !== 'SENT_TO_KITCHEN' && s !== 'IN_PROGRESS')),
        (fromStatus) => {
          const isValid = isValidOrderStatusTransition(fromStatus, 'IN_PROGRESS');
          expect(isValid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );

    // And verify SENT_TO_KITCHEN -> IN_PROGRESS is valid
    expect(isValidOrderStatusTransition('SENT_TO_KITCHEN', 'IN_PROGRESS')).toBe(true);
  });
});
