/**
 * Property-Based Tests for Shift Cash Variance Calculation
 * 
 * Feature: enterprise-gaps
 * Property 18: Shift Cash Variance Calculation
 * 
 * For any closed shift, the variance SHALL equal endingCash - expectedCash,
 * where expectedCash equals startingCash plus all cash payments minus cash refunds during the shift.
 * 
 * **Validates: Requirements 13.3, 13.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateExpectedCashPure,
  calculateVariancePure,
  verifyShiftVariance,
} from '../shift-utils';
import Decimal from 'decimal.js';

// Arbitrary for generating cash amounts (in dollars, 2 decimal places)
const cashAmountArb = fc.integer({ min: 0, max: 1000000 }) // In cents
  .map(c => c / 100); // Convert to dollars

// Arbitrary for generating starting cash (typically a round number)
const startingCashArb = fc.integer({ min: 0, max: 100000 }) // In cents
  .map(c => c / 100);

// Arbitrary for generating a list of cash payments
const cashPaymentsArb = fc.array(
  fc.integer({ min: 1, max: 100000 }).map(c => c / 100), // Positive payments
  { minLength: 0, maxLength: 100 }
);

// Arbitrary for generating a list of cash refunds
const cashRefundsArb = fc.array(
  fc.integer({ min: 1, max: 50000 }).map(c => c / 100), // Positive refunds
  { minLength: 0, maxLength: 20 }
);

describe('Property 18: Shift Cash Variance Calculation', () => {
  /**
   * Property 18.1: Expected cash equals starting cash plus payments minus refunds
   * expectedCash = startingCash + sum(cashPayments) - sum(cashRefunds)
   */
  it('should calculate expected cash as startingCash + payments - refunds', () => {
    fc.assert(
      fc.property(
        startingCashArb,
        cashPaymentsArb,
        cashRefundsArb,
        (startingCash, cashPayments, cashRefunds) => {
          const expectedCash = calculateExpectedCashPure(startingCash, cashPayments, cashRefunds);
          
          // Calculate manually
          const totalPayments = cashPayments.reduce((sum, p) => sum + p, 0);
          const totalRefunds = cashRefunds.reduce((sum, r) => sum + r, 0);
          const manualExpected = startingCash + totalPayments - totalRefunds;
          
          // Allow for small floating point differences
          expect(Math.abs(expectedCash - Math.round(manualExpected * 100) / 100)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18.2: Variance equals ending cash minus expected cash
   * variance = endingCash - expectedCash
   */
  it('should calculate variance as endingCash - expectedCash', () => {
    fc.assert(
      fc.property(
        cashAmountArb,
        cashAmountArb,
        (endingCash, expectedCash) => {
          const variance = calculateVariancePure(endingCash, expectedCash);
          
          // Calculate manually
          const manualVariance = endingCash - expectedCash;
          
          // Allow for small floating point differences
          expect(Math.abs(variance - Math.round(manualVariance * 100) / 100)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18.3: Verify shift variance returns true for correctly calculated variance
   */
  it('should verify correctly calculated variance', () => {
    fc.assert(
      fc.property(
        startingCashArb,
        cashPaymentsArb,
        cashRefundsArb,
        cashAmountArb,
        (startingCash, cashPayments, cashRefunds, endingCash) => {
          const expectedCash = calculateExpectedCashPure(startingCash, cashPayments, cashRefunds);
          const variance = calculateVariancePure(endingCash, expectedCash);
          
          // Verification should pass for correctly calculated variance
          expect(verifyShiftVariance(startingCash, cashPayments, cashRefunds, endingCash, variance)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18.4: Verify shift variance returns false for incorrectly calculated variance
   */
  it('should reject incorrectly calculated variance', () => {
    fc.assert(
      fc.property(
        startingCashArb,
        cashPaymentsArb,
        cashRefundsArb,
        cashAmountArb,
        fc.integer({ min: 100, max: 10000 }).map(e => e / 100), // Error amount
        (startingCash, cashPayments, cashRefunds, endingCash, errorAmount) => {
          const expectedCash = calculateExpectedCashPure(startingCash, cashPayments, cashRefunds);
          const correctVariance = calculateVariancePure(endingCash, expectedCash);
          const incorrectVariance = correctVariance + errorAmount;
          
          // Verification should fail for incorrect variance
          expect(verifyShiftVariance(startingCash, cashPayments, cashRefunds, endingCash, incorrectVariance)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18.5: Zero payments and refunds means expected cash equals starting cash
   */
  it('should return starting cash as expected when no payments or refunds', () => {
    fc.assert(
      fc.property(
        startingCashArb,
        (startingCash) => {
          const expectedCash = calculateExpectedCashPure(startingCash, [], []);
          
          expect(Math.abs(expectedCash - startingCash)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18.6: Positive variance indicates cash overage
   * When endingCash > expectedCash, variance should be positive
   */
  it('should produce positive variance when ending cash exceeds expected', () => {
    fc.assert(
      fc.property(
        startingCashArb,
        cashPaymentsArb,
        cashRefundsArb,
        fc.integer({ min: 1, max: 10000 }).map(e => e / 100), // Overage amount
        (startingCash, cashPayments, cashRefunds, overage) => {
          const expectedCash = calculateExpectedCashPure(startingCash, cashPayments, cashRefunds);
          const endingCash = expectedCash + overage;
          const variance = calculateVariancePure(endingCash, expectedCash);
          
          expect(variance).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18.7: Negative variance indicates cash shortage
   * When endingCash < expectedCash, variance should be negative
   */
  it('should produce negative variance when ending cash is less than expected', () => {
    fc.assert(
      fc.property(
        startingCashArb,
        cashPaymentsArb,
        cashRefundsArb,
        fc.integer({ min: 1, max: 10000 }).map(e => e / 100), // Shortage amount
        (startingCash, cashPayments, cashRefunds, shortage) => {
          const expectedCash = calculateExpectedCashPure(startingCash, cashPayments, cashRefunds);
          // Ensure we don't go negative
          const endingCash = Math.max(0, expectedCash - shortage);
          const variance = calculateVariancePure(endingCash, expectedCash);
          
          // Only check if we actually have a shortage
          if (endingCash < expectedCash) {
            expect(variance).toBeLessThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18.8: Zero variance when ending cash equals expected cash
   */
  it('should produce zero variance when ending cash equals expected', () => {
    fc.assert(
      fc.property(
        startingCashArb,
        cashPaymentsArb,
        cashRefundsArb,
        (startingCash, cashPayments, cashRefunds) => {
          const expectedCash = calculateExpectedCashPure(startingCash, cashPayments, cashRefunds);
          const variance = calculateVariancePure(expectedCash, expectedCash);
          
          expect(Math.abs(variance)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18.9: Adding a payment increases expected cash
   */
  it('should increase expected cash when adding a payment', () => {
    fc.assert(
      fc.property(
        startingCashArb,
        cashPaymentsArb,
        cashRefundsArb,
        fc.integer({ min: 1, max: 10000 }).map(p => p / 100), // New payment
        (startingCash, existingPayments, cashRefunds, newPayment) => {
          const expectedBefore = calculateExpectedCashPure(startingCash, existingPayments, cashRefunds);
          const expectedAfter = calculateExpectedCashPure(startingCash, [...existingPayments, newPayment], cashRefunds);
          
          // Expected cash should increase by the payment amount
          const increase = expectedAfter - expectedBefore;
          expect(Math.abs(increase - newPayment)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18.10: Adding a refund decreases expected cash
   */
  it('should decrease expected cash when adding a refund', () => {
    fc.assert(
      fc.property(
        startingCashArb,
        cashPaymentsArb,
        cashRefundsArb,
        fc.integer({ min: 1, max: 10000 }).map(r => r / 100), // New refund
        (startingCash, cashPayments, existingRefunds, newRefund) => {
          const expectedBefore = calculateExpectedCashPure(startingCash, cashPayments, existingRefunds);
          const expectedAfter = calculateExpectedCashPure(startingCash, cashPayments, [...existingRefunds, newRefund]);
          
          // Expected cash should decrease by the refund amount
          const decrease = expectedBefore - expectedAfter;
          expect(Math.abs(decrease - newRefund)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18.11: Variance calculation is commutative with respect to payment order
   * The order of payments should not affect the expected cash calculation
   */
  it('should produce same expected cash regardless of payment order', () => {
    fc.assert(
      fc.property(
        startingCashArb,
        fc.array(fc.integer({ min: 1, max: 10000 }).map(p => p / 100), { minLength: 2, maxLength: 20 }),
        cashRefundsArb,
        (startingCash, cashPayments, cashRefunds) => {
          // Calculate with original order
          const expected1 = calculateExpectedCashPure(startingCash, cashPayments, cashRefunds);
          
          // Calculate with reversed order
          const reversedPayments = [...cashPayments].reverse();
          const expected2 = calculateExpectedCashPure(startingCash, reversedPayments, cashRefunds);
          
          expect(Math.abs(expected1 - expected2)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 18.12: Expected cash is always non-negative when refunds don't exceed starting + payments
   */
  it('should produce non-negative expected cash when refunds are bounded', () => {
    fc.assert(
      fc.property(
        startingCashArb,
        cashPaymentsArb,
        (startingCash, cashPayments) => {
          const totalAvailable = startingCash + cashPayments.reduce((sum, p) => sum + p, 0);
          
          // Generate refunds that don't exceed available cash
          const maxRefund = Math.floor(totalAvailable * 100) / 100;
          const boundedRefunds = cashPayments.length > 0 
            ? [Math.min(maxRefund / 2, 100)] // Small bounded refund
            : [];
          
          const expectedCash = calculateExpectedCashPure(startingCash, cashPayments, boundedRefunds);
          
          expect(expectedCash).toBeGreaterThanOrEqual(-0.01); // Allow small negative due to rounding
        }
      ),
      { numRuns: 100 }
    );
  });
});
