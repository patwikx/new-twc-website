/**
 * Property-Based Tests for Split Payment Integrity
 * 
 * Feature: enterprise-gaps
 * Property 7: Split Payment Integrity
 * 
 * For any order with split payments, the sum of all OrderPayment amounts SHALL equal the order total.
 * 
 * **Validates: Requirements 5.5, 7.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
  validateSplitPayments, 
  verifySplitPaymentIntegrity,
  calculateChangeDue,
  PaymentInput 
} from '../payment';
import { PaymentMethod } from '@prisma/client';
import Decimal from 'decimal.js';

// Valid payment methods
const paymentMethods: PaymentMethod[] = [
  "CASH",
  "CREDIT_CARD",
  "DEBIT_CARD",
  "ROOM_CHARGE",
  "VOUCHER",
  "COMPLIMENTARY",
];

// Arbitrary for generating payment method
const paymentMethodArb = fc.constantFrom(...paymentMethods);

// Arbitrary for generating a positive amount (in cents, converted to dollars)
const amountArb = fc.integer({ min: 1, max: 1000000 })
  .map(cents => cents / 100);

// Arbitrary for generating order total
const orderTotalArb = fc.integer({ min: 100, max: 10000000 }) // 1.00 to 100,000.00
  .map(cents => cents / 100);

// Arbitrary for generating a single payment
const paymentArb = fc.record({
  method: paymentMethodArb,
  amount: amountArb,
  reference: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
});

// Arbitrary for generating split payments that sum to a specific total
function splitPaymentsArb(total: number, numPayments: number): fc.Arbitrary<PaymentInput[]> {
  if (numPayments <= 0) {
    return fc.constant([]);
  }
  
  if (numPayments === 1) {
    return fc.tuple(paymentMethodArb).map(([method]) => [{
      method,
      amount: total,
    }]);
  }

  // Generate random splits
  return fc.array(
    fc.integer({ min: 1, max: 100 }), 
    { minLength: numPayments, maxLength: numPayments }
  ).chain(weights => {
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const amounts = weights.map((w, i) => {
      if (i === weights.length - 1) {
        // Last payment gets the remainder to ensure exact total
        const previousSum = weights.slice(0, -1).reduce((sum, weight) => {
          return sum + Math.round((weight / totalWeight) * total * 100) / 100;
        }, 0);
        return Math.round((total - previousSum) * 100) / 100;
      }
      return Math.round((w / totalWeight) * total * 100) / 100;
    });

    return fc.array(paymentMethodArb, { minLength: numPayments, maxLength: numPayments })
      .map(methods => methods.map((method, i) => ({
        method,
        amount: amounts[i],
      })));
  });
}

describe('Property 7: Split Payment Integrity', () => {
  /**
   * Property 7.1: Sum of split payments equals order total
   * For any order with split payments, the sum of all OrderPayment amounts SHALL equal the order total.
   */
  it('should validate that split payments sum to order total', () => {
    fc.assert(
      fc.property(
        orderTotalArb,
        fc.integer({ min: 1, max: 5 }),
        (orderTotal, numPayments) => {
          // Generate payments that sum to order total
          const totalCents = Math.round(orderTotal * 100);
          const payments: PaymentInput[] = [];
          let remainingCents = totalCents;

          for (let i = 0; i < numPayments; i++) {
            const isLast = i === numPayments - 1;
            const method = paymentMethods[i % paymentMethods.length];
            
            let amountCents: number;
            if (isLast) {
              amountCents = remainingCents;
            } else {
              // Random portion of remaining
              amountCents = Math.max(1, Math.floor(remainingCents / (numPayments - i)));
            }
            
            payments.push({
              method,
              amount: amountCents / 100,
            });
            remainingCents -= amountCents;
          }

          // Verify the payments sum to order total
          const result = verifySplitPaymentIntegrity(orderTotal, payments.map(p => p.amount));
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.2: Validation rejects payments that don't sum to order total
   */
  it('should reject payments that do not sum to order total (non-cash)', () => {
    fc.assert(
      fc.property(
        orderTotalArb,
        fc.integer({ min: 2, max: 10000 }).map(c => c / 100), // Difference amount (min 0.02 to exceed tolerance)
        (orderTotal, difference) => {
          // Create a single non-cash payment with wrong amount
          const wrongAmount = orderTotal + difference;
          const payments: PaymentInput[] = [{
            method: "CREDIT_CARD", // Non-cash method
            amount: wrongAmount,
          }];

          const validation = validateSplitPayments(orderTotal, payments);
          
          // Should be invalid because amount doesn't match (difference > 0.01 tolerance)
          expect(validation.valid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.3: Cash payments allow overpayment (change due)
   */
  it('should allow cash overpayment and calculate correct change', () => {
    fc.assert(
      fc.property(
        orderTotalArb,
        fc.integer({ min: 1, max: 10000 }).map(c => c / 100), // Extra amount
        (orderTotal, extraAmount) => {
          const cashAmount = orderTotal + extraAmount;
          const payments: PaymentInput[] = [{
            method: "CASH",
            amount: cashAmount,
          }];

          // Validation should pass for cash overpayment
          const validation = validateSplitPayments(orderTotal, payments);
          expect(validation.valid).toBe(true);

          // Change due should equal the extra amount
          const changeDue = calculateChangeDue(orderTotal, payments);
          expect(Math.abs(changeDue - extraAmount)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.4: Cash underpayment is rejected
   */
  it('should reject cash underpayment', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 10000000 }).map(c => c / 100), // Order total (at least 10.00)
        fc.integer({ min: 100, max: 500 }).map(c => c / 100), // Shortfall (1.00 to 5.00)
        (orderTotal, shortfall) => {
          const cashAmount = orderTotal - shortfall;
          const payments: PaymentInput[] = [{
            method: "CASH",
            amount: cashAmount,
          }];

          const validation = validateSplitPayments(orderTotal, payments);
          expect(validation.valid).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.5: Empty payments are rejected
   */
  it('should reject empty payments', () => {
    fc.assert(
      fc.property(
        orderTotalArb,
        (orderTotal) => {
          const validation = validateSplitPayments(orderTotal, []);
          expect(validation.valid).toBe(false);
          expect(validation.error).toBe("At least one payment is required");
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.6: Negative payment amounts are rejected
   */
  it('should reject negative payment amounts', () => {
    fc.assert(
      fc.property(
        orderTotalArb,
        paymentMethodArb,
        fc.integer({ min: -10000, max: -1 }).map(c => c / 100),
        (orderTotal, method, negativeAmount) => {
          const payments: PaymentInput[] = [{
            method,
            amount: negativeAmount,
          }];

          const validation = validateSplitPayments(orderTotal, payments);
          expect(validation.valid).toBe(false);
          expect(validation.error).toBe("Payment amount must be positive");
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.7: Zero payment amounts are rejected
   */
  it('should reject zero payment amounts', () => {
    fc.assert(
      fc.property(
        orderTotalArb,
        paymentMethodArb,
        (orderTotal, method) => {
          const payments: PaymentInput[] = [{
            method,
            amount: 0,
          }];

          const validation = validateSplitPayments(orderTotal, payments);
          expect(validation.valid).toBe(false);
          expect(validation.error).toBe("Payment amount must be positive");
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.8: Mixed payment methods work correctly
   */
  it('should handle mixed payment methods summing to order total', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 100000 }).map(c => c / 100), // Order total
        (orderTotal) => {
          // Split into 3 payments with different methods
          const amount1 = Math.round(orderTotal * 0.4 * 100) / 100;
          const amount2 = Math.round(orderTotal * 0.35 * 100) / 100;
          const amount3 = Math.round((orderTotal - amount1 - amount2) * 100) / 100;

          const payments: PaymentInput[] = [
            { method: "CREDIT_CARD", amount: amount1 },
            { method: "CASH", amount: amount2 },
            { method: "VOUCHER", amount: amount3 },
          ];

          const validation = validateSplitPayments(orderTotal, payments);
          expect(validation.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.9: verifySplitPaymentIntegrity is consistent with validateSplitPayments
   */
  it('should have consistent verification between functions', () => {
    fc.assert(
      fc.property(
        orderTotalArb,
        fc.integer({ min: 1, max: 4 }),
        (orderTotal, numPayments) => {
          // Generate exact payments
          const payments: PaymentInput[] = [];
          let remaining = orderTotal;

          for (let i = 0; i < numPayments; i++) {
            const isLast = i === numPayments - 1;
            const method = paymentMethods[(i + 1) % paymentMethods.length]; // Skip CASH for exact matching
            
            let amount: number;
            if (isLast) {
              amount = Math.round(remaining * 100) / 100;
            } else {
              amount = Math.round((remaining / (numPayments - i)) * 100) / 100;
            }
            
            payments.push({ method, amount });
            remaining -= amount;
          }

          // Both functions should agree
          const validationResult = validateSplitPayments(orderTotal, payments);
          const verifyResult = verifySplitPaymentIntegrity(orderTotal, payments.map(p => p.amount));

          // If validation passes, verification should also pass
          if (validationResult.valid) {
            expect(verifyResult).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7.10: Change due is always non-negative
   */
  it('should always return non-negative change due', () => {
    fc.assert(
      fc.property(
        orderTotalArb,
        fc.array(paymentArb, { minLength: 1, maxLength: 5 }),
        (orderTotal, payments) => {
          const changeDue = calculateChangeDue(orderTotal, payments);
          expect(changeDue).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
