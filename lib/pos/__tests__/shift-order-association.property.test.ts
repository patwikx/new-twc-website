/**
 * Property-Based Tests for Shift Order Association
 * 
 * Feature: enterprise-gaps
 * Property 19: Shift Order Association
 * 
 * For any order created while a cashier has an open shift, the order SHALL be associated with that shift.
 * 
 * **Validates: Requirements 13.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  determineOrderShiftAssociation,
  verifyOrderShiftAssociation,
} from '../order-utils';

// Arbitrary for generating UUIDs
const uuidArb = fc.uuid();

// Arbitrary for generating shift state
const shiftStateArb = fc.record({
  hasOpenShift: fc.boolean(),
  shiftId: fc.option(fc.uuid(), { nil: null }),
});

describe('Property 19: Shift Order Association', () => {
  /**
   * Property 19.1: When cashier has open shift, order is associated with it
   */
  it('should associate order with shift when cashier has open shift', () => {
    fc.assert(
      fc.property(
        uuidArb,
        (shiftId) => {
          const result = determineOrderShiftAssociation(true, shiftId);
          
          expect(result).toBe(shiftId);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 19.2: When cashier has no open shift, order is not associated with any shift
   */
  it('should not associate order with shift when cashier has no open shift', () => {
    fc.assert(
      fc.property(
        fc.option(fc.uuid(), { nil: null }),
        (shiftId) => {
          const result = determineOrderShiftAssociation(false, shiftId);
          
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 19.3: Verification passes for correctly associated orders
   */
  it('should verify correctly associated orders', () => {
    fc.assert(
      fc.property(
        uuidArb,
        (shiftId) => {
          // When cashier has open shift, order should be associated with it
          const isValid = verifyOrderShiftAssociation(shiftId, shiftId, true);
          
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 19.4: Verification passes for orders without shift when cashier had no shift
   */
  it('should verify orders without shift when cashier had no open shift', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const isValid = verifyOrderShiftAssociation(null, null, false);
          
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 19.5: Verification fails when order has wrong shift association
   */
  it('should reject orders with wrong shift association', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        (orderShiftId, cashierShiftId) => {
          // Only test when IDs are different
          fc.pre(orderShiftId !== cashierShiftId);
          
          const isValid = verifyOrderShiftAssociation(orderShiftId, cashierShiftId, true);
          
          expect(isValid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 19.6: Verification fails when order has shift but cashier had no shift
   */
  it('should reject orders with shift when cashier had no open shift', () => {
    fc.assert(
      fc.property(
        uuidArb,
        (orderShiftId) => {
          const isValid = verifyOrderShiftAssociation(orderShiftId, null, false);
          
          expect(isValid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 19.7: Verification fails when order has no shift but cashier had open shift
   */
  it('should reject orders without shift when cashier had open shift', () => {
    fc.assert(
      fc.property(
        uuidArb,
        (cashierShiftId) => {
          const isValid = verifyOrderShiftAssociation(null, cashierShiftId, true);
          
          expect(isValid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 19.8: determineOrderShiftAssociation is idempotent
   */
  it('should be idempotent for shift association determination', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.option(fc.uuid(), { nil: null }),
        (hasOpenShift, shiftId) => {
          const result1 = determineOrderShiftAssociation(hasOpenShift, shiftId);
          const result2 = determineOrderShiftAssociation(hasOpenShift, shiftId);
          
          expect(result1).toBe(result2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 19.9: Shift association is deterministic
   * Same inputs always produce same outputs
   */
  it('should produce deterministic shift association', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        uuidArb,
        fc.integer({ min: 1, max: 10 }),
        (hasOpenShift, shiftId, iterations) => {
          const results = Array.from({ length: iterations }, () =>
            determineOrderShiftAssociation(hasOpenShift, shiftId)
          );
          
          // All results should be identical
          const allSame = results.every(r => r === results[0]);
          expect(allSame).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 19.10: Verification is consistent with determination
   * If we determine a shift association and then verify it, it should pass
   */
  it('should verify associations that were correctly determined', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.option(fc.uuid(), { nil: null }),
        (hasOpenShift, shiftId) => {
          // Determine the association
          const determinedShiftId = determineOrderShiftAssociation(hasOpenShift, shiftId);
          
          // Verify it - should always pass
          const isValid = verifyOrderShiftAssociation(
            determinedShiftId,
            shiftId,
            hasOpenShift
          );
          
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 19.11: Null shift ID with hasOpenShift=true returns null
   * Edge case: hasOpenShift is true but shiftId is null (shouldn't happen in practice)
   */
  it('should return null when hasOpenShift is true but shiftId is null', () => {
    const result = determineOrderShiftAssociation(true, null);
    expect(result).toBeNull();
  });

  /**
   * Property 19.12: Multiple orders from same cashier get same shift
   * Simulates multiple orders being created during the same shift
   */
  it('should associate multiple orders with the same shift', () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.integer({ min: 1, max: 20 }),
        (shiftId, orderCount) => {
          const associations = Array.from({ length: orderCount }, () =>
            determineOrderShiftAssociation(true, shiftId)
          );
          
          // All orders should be associated with the same shift
          const allSameShift = associations.every(a => a === shiftId);
          expect(allSameShift).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
