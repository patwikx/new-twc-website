/**
 * Property-Based Tests for PO Receiving Quantity Consistency
 * 
 * Feature: enterprise-gaps
 * Property 14: PO Receiving Quantity Consistency
 * 
 * For any PO item, the receivedQty SHALL equal the sum of quantities from all POReceiptItems
 * for that item, and SHALL NOT exceed the ordered quantity.
 * 
 * **Validates: Requirements 9.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateReceivingQuantityPure } from '../purchase-order-utils';
import Decimal from 'decimal.js';

// Use integers to avoid floating point issues, then convert
const orderedQtyArb = fc.integer({ min: 10, max: 10000 });
const receivedQtyArb = fc.integer({ min: 0, max: 10000 });
const newReceiveQtyArb = fc.integer({ min: 1, max: 10000 });

describe('Property 14: PO Receiving Quantity Consistency', () => {
  /**
   * Property 14.1: Receiving within ordered quantity is valid
   */
  it('should accept receiving when total does not exceed ordered quantity', () => {
    fc.assert(
      fc.property(
        orderedQtyArb,
        (orderedQty) => {
          // Receive exactly the ordered quantity
          const result = validateReceivingQuantityPure(orderedQty, 0, orderedQty);
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14.2: Receiving that exceeds ordered quantity is rejected
   */
  it('should reject receiving when total exceeds ordered quantity', () => {
    fc.assert(
      fc.property(
        orderedQtyArb,
        fc.integer({ min: 1, max: 1000 }),
        (orderedQty, excess) => {
          // Try to receive more than ordered
          const result = validateReceivingQuantityPure(orderedQty, 0, orderedQty + excess);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14.3: Partial receiving is valid when within limits
   */
  it('should accept partial receiving when within ordered quantity', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 1000 }),
        fc.integer({ min: 1, max: 99 }),
        (orderedQty, receiveQty) => {
          fc.pre(receiveQty < orderedQty);
          const result = validateReceivingQuantityPure(orderedQty, 0, receiveQty);
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14.4: Multiple partial receives that sum to ordered quantity is valid
   */
  it('should accept multiple partial receives that sum to ordered quantity', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 1000 }),
        fc.integer({ min: 2, max: 10 }),
        (orderedQty, numReceives) => {
          // Use integer division to avoid floating point issues
          const baseReceiveQty = Math.floor(orderedQty / numReceives);
          const remainder = orderedQty - (baseReceiveQty * numReceives);
          
          let alreadyReceived = 0;
          
          for (let i = 0; i < numReceives; i++) {
            // Add remainder to last receive
            const receiveQty = i === numReceives - 1 ? baseReceiveQty + remainder : baseReceiveQty;
            const result = validateReceivingQuantityPure(orderedQty, alreadyReceived, receiveQty);
            expect(result.valid).toBe(true);
            alreadyReceived += receiveQty;
          }
          
          // Total received should equal ordered
          expect(alreadyReceived).toBe(orderedQty);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14.5: Receiving after already fully received is rejected
   */
  it('should reject receiving when already fully received', () => {
    fc.assert(
      fc.property(
        orderedQtyArb,
        newReceiveQtyArb,
        (orderedQty, newReceiveQty) => {
          // Already received full amount
          const result = validateReceivingQuantityPure(orderedQty, orderedQty, newReceiveQty);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14.6: Receiving remaining quantity after partial receive is valid
   */
  it('should accept receiving remaining quantity after partial receive', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 1000 }),
        fc.integer({ min: 1, max: 99 }),
        (orderedQty, partialPercent) => {
          const partialReceive = Math.floor(orderedQty * partialPercent / 100);
          fc.pre(partialReceive > 0 && partialReceive < orderedQty);
          
          const remaining = orderedQty - partialReceive;
          
          // First partial receive
          const result1 = validateReceivingQuantityPure(orderedQty, 0, partialReceive);
          expect(result1.valid).toBe(true);
          
          // Receive remaining
          const result2 = validateReceivingQuantityPure(orderedQty, partialReceive, remaining);
          expect(result2.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14.7: Zero receive quantity is handled correctly
   */
  it('should handle zero receive quantity', () => {
    fc.assert(
      fc.property(
        orderedQtyArb,
        receivedQtyArb,
        (orderedQty, alreadyReceived) => {
          // Constrain already received to not exceed ordered
          const constrainedReceived = Math.min(alreadyReceived, orderedQty);
          
          // Zero receive should be valid (no change)
          const result = validateReceivingQuantityPure(orderedQty, constrainedReceived, 0);
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14.8: Total received never exceeds ordered
   */
  it('should never allow total received to exceed ordered', () => {
    fc.assert(
      fc.property(
        orderedQtyArb,
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 20 }),
        (orderedQty, receiveSequence) => {
          let totalReceived = 0;
          
          for (const receiveQty of receiveSequence) {
            const result = validateReceivingQuantityPure(orderedQty, totalReceived, receiveQty);
            
            if (result.valid) {
              totalReceived += receiveQty;
            }
            
            // Invariant: totalReceived should never exceed orderedQty
            expect(totalReceived).toBeLessThanOrEqual(orderedQty);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14.9: Receiving exactly remaining quantity is valid
   */
  it('should accept receiving exactly the remaining quantity', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 1000 }),
        fc.integer({ min: 0, max: 99 }),
        (orderedQty, alreadyReceivedPercent) => {
          const alreadyReceived = Math.floor(orderedQty * alreadyReceivedPercent / 100);
          const remaining = orderedQty - alreadyReceived;
          
          const result = validateReceivingQuantityPure(orderedQty, alreadyReceived, remaining);
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14.10: Error message contains relevant information
   */
  it('should provide informative error message when receiving exceeds ordered', () => {
    fc.assert(
      fc.property(
        orderedQtyArb,
        fc.integer({ min: 1, max: 100 }),
        (orderedQty, excess) => {
          const result = validateReceivingQuantityPure(orderedQty, 0, orderedQty + excess);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('exceed');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14.11: Receiving is commutative (order doesn't matter for validity)
   */
  it('should allow receiving in any order as long as total does not exceed ordered', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 1000 }),
        fc.integer({ min: 10, max: 40 }),
        fc.integer({ min: 10, max: 40 }),
        (orderedQty, receiveA, receiveB) => {
          // Ensure both receives together don't exceed ordered
          fc.pre(receiveA + receiveB <= orderedQty);
          
          // Order 1: A then B
          const result1A = validateReceivingQuantityPure(orderedQty, 0, receiveA);
          const result1B = validateReceivingQuantityPure(orderedQty, receiveA, receiveB);
          
          // Order 2: B then A
          const result2B = validateReceivingQuantityPure(orderedQty, 0, receiveB);
          const result2A = validateReceivingQuantityPure(orderedQty, receiveB, receiveA);
          
          // Both orders should be valid
          expect(result1A.valid).toBe(true);
          expect(result1B.valid).toBe(true);
          expect(result2B.valid).toBe(true);
          expect(result2A.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14.12: Boundary case - receiving exactly ordered quantity in one go
   */
  it('should accept receiving full ordered quantity in single receive', () => {
    fc.assert(
      fc.property(
        orderedQtyArb,
        (orderedQty) => {
          const result = validateReceivingQuantityPure(orderedQty, 0, orderedQty);
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
