/**
 * Property-Based Tests for PO Status Workflow Integrity
 * 
 * Feature: enterprise-gaps
 * Property 13: PO Status Workflow Integrity
 * 
 * For any purchase order, status transitions SHALL follow:
 * DRAFT → PENDING_APPROVAL → APPROVED → SENT → (PARTIALLY_RECEIVED | RECEIVED) → CLOSED,
 * with CANCELLED as terminal from non-RECEIVED states.
 * 
 * **Validates: Requirements 9.2, 9.3, 9.5, 9.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  isValidStatusTransition, 
  validateStatusTransitionPure,
  determinePOStatusAfterReceivingPure 
} from '../purchase-order-utils';
import { POStatus } from '@prisma/client';

// All possible PO statuses
const ALL_STATUSES: POStatus[] = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SENT',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CLOSED',
  'CANCELLED',
];

// Valid transitions map for reference
const VALID_TRANSITIONS: Record<POStatus, POStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['SENT', 'CANCELLED'],
  SENT: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  PARTIALLY_RECEIVED: ['PARTIALLY_RECEIVED', 'RECEIVED'],
  RECEIVED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};

// Arbitrary for PO status
const poStatusArb = fc.constantFrom(...ALL_STATUSES);

// Arbitrary for generating PO items with ordered and received quantities
const poItemArb = fc.record({
  orderedQty: fc.integer({ min: 1, max: 1000 }),
  receivedQty: fc.integer({ min: 0, max: 1000 }),
}).filter(item => item.receivedQty <= item.orderedQty);

const poItemsArb = fc.array(poItemArb, { minLength: 1, maxLength: 20 });

describe('Property 13: PO Status Workflow Integrity', () => {
  /**
   * Property 13.1: Valid transitions are accepted
   */
  it('should accept all valid status transitions', () => {
    fc.assert(
      fc.property(
        poStatusArb,
        (currentStatus) => {
          const validNextStatuses = VALID_TRANSITIONS[currentStatus];
          
          for (const nextStatus of validNextStatuses) {
            expect(isValidStatusTransition(currentStatus, nextStatus)).toBe(true);
            
            const result = validateStatusTransitionPure(currentStatus, nextStatus);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13.2: Invalid transitions are rejected
   */
  it('should reject all invalid status transitions', () => {
    fc.assert(
      fc.property(
        poStatusArb,
        poStatusArb,
        (currentStatus, targetStatus) => {
          const validNextStatuses = VALID_TRANSITIONS[currentStatus];
          
          // Skip if this is a valid transition
          if (validNextStatuses.includes(targetStatus)) {
            return true;
          }
          
          expect(isValidStatusTransition(currentStatus, targetStatus)).toBe(false);
          
          const result = validateStatusTransitionPure(currentStatus, targetStatus);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13.3: DRAFT can only transition to PENDING_APPROVAL or CANCELLED
   */
  it('should only allow DRAFT to transition to PENDING_APPROVAL or CANCELLED', () => {
    fc.assert(
      fc.property(
        poStatusArb,
        (targetStatus) => {
          const isValid = isValidStatusTransition('DRAFT', targetStatus);
          const expectedValid = targetStatus === 'PENDING_APPROVAL' || targetStatus === 'CANCELLED';
          expect(isValid).toBe(expectedValid);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13.4: PENDING_APPROVAL can transition to APPROVED, DRAFT (rejection), or CANCELLED
   */
  it('should allow PENDING_APPROVAL to transition to APPROVED, DRAFT, or CANCELLED', () => {
    fc.assert(
      fc.property(
        poStatusArb,
        (targetStatus) => {
          const isValid = isValidStatusTransition('PENDING_APPROVAL', targetStatus);
          const expectedValid = ['APPROVED', 'DRAFT', 'CANCELLED'].includes(targetStatus);
          expect(isValid).toBe(expectedValid);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13.5: APPROVED can only transition to SENT or CANCELLED
   */
  it('should only allow APPROVED to transition to SENT or CANCELLED', () => {
    fc.assert(
      fc.property(
        poStatusArb,
        (targetStatus) => {
          const isValid = isValidStatusTransition('APPROVED', targetStatus);
          const expectedValid = targetStatus === 'SENT' || targetStatus === 'CANCELLED';
          expect(isValid).toBe(expectedValid);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13.6: SENT can transition to PARTIALLY_RECEIVED, RECEIVED, or CANCELLED
   */
  it('should allow SENT to transition to PARTIALLY_RECEIVED, RECEIVED, or CANCELLED', () => {
    fc.assert(
      fc.property(
        poStatusArb,
        (targetStatus) => {
          const isValid = isValidStatusTransition('SENT', targetStatus);
          const expectedValid = ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'].includes(targetStatus);
          expect(isValid).toBe(expectedValid);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13.7: PARTIALLY_RECEIVED can only transition to PARTIALLY_RECEIVED or RECEIVED
   */
  it('should only allow PARTIALLY_RECEIVED to transition to PARTIALLY_RECEIVED or RECEIVED', () => {
    fc.assert(
      fc.property(
        poStatusArb,
        (targetStatus) => {
          const isValid = isValidStatusTransition('PARTIALLY_RECEIVED', targetStatus);
          const expectedValid = targetStatus === 'PARTIALLY_RECEIVED' || targetStatus === 'RECEIVED';
          expect(isValid).toBe(expectedValid);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13.8: RECEIVED can only transition to CLOSED
   */
  it('should only allow RECEIVED to transition to CLOSED', () => {
    fc.assert(
      fc.property(
        poStatusArb,
        (targetStatus) => {
          const isValid = isValidStatusTransition('RECEIVED', targetStatus);
          const expectedValid = targetStatus === 'CLOSED';
          expect(isValid).toBe(expectedValid);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13.9: CLOSED and CANCELLED are terminal states
   */
  it('should not allow any transitions from CLOSED or CANCELLED', () => {
    fc.assert(
      fc.property(
        poStatusArb,
        (targetStatus) => {
          expect(isValidStatusTransition('CLOSED', targetStatus)).toBe(false);
          expect(isValidStatusTransition('CANCELLED', targetStatus)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13.10: Fully received items result in RECEIVED status
   */
  it('should return RECEIVED status when all items are fully received', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.integer({ min: 1, max: 1000 }).map(qty => ({
            orderedQty: qty,
            receivedQty: qty, // Fully received
          })),
          { minLength: 1, maxLength: 20 }
        ),
        (items) => {
          const status = determinePOStatusAfterReceivingPure(items);
          expect(status).toBe('RECEIVED');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13.11: Partially received items result in PARTIALLY_RECEIVED status
   */
  it('should return PARTIALLY_RECEIVED status when some items are partially received', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            orderedQty: fc.integer({ min: 2, max: 1000 }),
            receivedQty: fc.integer({ min: 1, max: 999 }),
          }).filter(item => item.receivedQty < item.orderedQty && item.receivedQty > 0),
          { minLength: 1, maxLength: 20 }
        ),
        (items) => {
          const status = determinePOStatusAfterReceivingPure(items);
          expect(status).toBe('PARTIALLY_RECEIVED');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13.12: No received items result in SENT status
   */
  it('should return SENT status when no items have been received', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.integer({ min: 1, max: 1000 }).map(qty => ({
            orderedQty: qty,
            receivedQty: 0, // Nothing received
          })),
          { minLength: 1, maxLength: 20 }
        ),
        (items) => {
          const status = determinePOStatusAfterReceivingPure(items);
          expect(status).toBe('SENT');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13.13: Mixed receiving (some full, some partial) results in correct status
   */
  it('should correctly determine status with mixed receiving states', () => {
    fc.assert(
      fc.property(
        poItemsArb,
        (items) => {
          const status = determinePOStatusAfterReceivingPure(items);
          
          const isFullyReceived = items.every(item => item.receivedQty >= item.orderedQty);
          const hasAnyReceived = items.some(item => item.receivedQty > 0);
          
          if (isFullyReceived) {
            expect(status).toBe('RECEIVED');
          } else if (hasAnyReceived) {
            expect(status).toBe('PARTIALLY_RECEIVED');
          } else {
            expect(status).toBe('SENT');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13.14: Happy path workflow is valid
   * DRAFT → PENDING_APPROVAL → APPROVED → SENT → RECEIVED → CLOSED
   */
  it('should allow complete happy path workflow', () => {
    const happyPath: POStatus[] = [
      'DRAFT',
      'PENDING_APPROVAL',
      'APPROVED',
      'SENT',
      'RECEIVED',
      'CLOSED',
    ];

    for (let i = 0; i < happyPath.length - 1; i++) {
      const current = happyPath[i];
      const next = happyPath[i + 1];
      expect(isValidStatusTransition(current, next)).toBe(true);
    }
  });

  /**
   * Property 13.15: Partial receiving path is valid
   * DRAFT → PENDING_APPROVAL → APPROVED → SENT → PARTIALLY_RECEIVED → RECEIVED → CLOSED
   */
  it('should allow partial receiving workflow', () => {
    const partialPath: POStatus[] = [
      'DRAFT',
      'PENDING_APPROVAL',
      'APPROVED',
      'SENT',
      'PARTIALLY_RECEIVED',
      'RECEIVED',
      'CLOSED',
    ];

    for (let i = 0; i < partialPath.length - 1; i++) {
      const current = partialPath[i];
      const next = partialPath[i + 1];
      expect(isValidStatusTransition(current, next)).toBe(true);
    }
  });
});
