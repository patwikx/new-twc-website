/**
 * Property-Based Tests for Order Total Calculation
 * 
 * Feature: enterprise-gaps
 * Property 6: Order Total Calculation Consistency
 * 
 * For any order, the total SHALL equal subtotal + taxAmount + serviceCharge - discountAmount + tipAmount,
 * and subtotal SHALL equal the sum of (item.quantity × item.unitPrice) for all items.
 * 
 * **Validates: Requirements 5.2, 5.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateOrderTotalsPure, verifyOrderTotals, OrderTotals } from '../order-utils';
import Decimal from 'decimal.js';

// Arbitrary for generating order items
const orderItemArb = fc.record({
  quantity: fc.integer({ min: 1, max: 100 }),
  unitPrice: fc.integer({ min: 1, max: 1000000 }) // Price in cents
    .map(p => p / 100), // Convert to dollars with 2 decimal places
});

// Arbitrary for generating a list of order items
const orderItemsArb = fc.array(orderItemArb, { minLength: 0, maxLength: 50 });

// Arbitrary for tax rate (0% to 25%) - using integers to avoid float issues
const taxRateArb = fc.integer({ min: 0, max: 2500 })
  .map(r => r / 10000); // Convert to decimal rate (e.g., 1200 -> 0.12)

// Arbitrary for service charge rate (0% to 20%)
const serviceChargeRateArb = fc.integer({ min: 0, max: 2000 })
  .map(r => r / 10000);

// Arbitrary for discount amount (will be constrained to not exceed subtotal)
const discountArb = fc.integer({ min: 0, max: 100000 }) // In cents
  .map(d => d / 100);

// Arbitrary for tip amount
const tipArb = fc.integer({ min: 0, max: 50000 }) // In cents
  .map(t => t / 100);

describe('Property 6: Order Total Calculation Consistency', () => {
  /**
   * Property 6.1: Subtotal equals sum of item line totals
   * subtotal = sum of (item.quantity × item.unitPrice) for all items
   */
  it('should calculate subtotal as sum of (quantity × unitPrice) for all items', () => {
    fc.assert(
      fc.property(
        orderItemsArb,
        taxRateArb,
        serviceChargeRateArb,
        (items, taxRate, serviceChargeRate) => {
          const totals = calculateOrderTotalsPure(items, taxRate, serviceChargeRate, 0, 0);
          
          // Calculate expected subtotal manually
          const expectedSubtotal = items.reduce((sum, item) => {
            return sum + (item.quantity * item.unitPrice);
          }, 0);
          
          // Allow for small floating point differences
          expect(Math.abs(totals.subtotal - Math.round(expectedSubtotal * 100) / 100)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.2: Total equals subtotal + tax + serviceCharge - discount + tip
   * total = subtotal + taxAmount + serviceCharge - discountAmount + tipAmount
   */
  it('should calculate total as subtotal + tax + serviceCharge - discount + tip', () => {
    fc.assert(
      fc.property(
        orderItemsArb,
        taxRateArb,
        serviceChargeRateArb,
        discountArb,
        tipArb,
        (items, taxRate, serviceChargeRate, discount, tip) => {
          // Calculate subtotal first to constrain discount
          const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
          const constrainedDiscount = Math.min(discount, subtotal);
          
          const totals = calculateOrderTotalsPure(items, taxRate, serviceChargeRate, constrainedDiscount, tip);
          
          // Verify the total formula
          const expectedTotal = new Decimal(totals.subtotal)
            .add(totals.taxAmount)
            .add(totals.serviceCharge)
            .sub(totals.discountAmount)
            .add(totals.tipAmount)
            .toDecimalPlaces(2)
            .toNumber();
          
          // Allow for small floating point differences (0.02 to account for rounding)
          expect(Math.abs(totals.total - expectedTotal)).toBeLessThan(0.02);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.3: Tax amount equals subtotal × taxRate
   */
  it('should calculate tax as subtotal × taxRate', () => {
    fc.assert(
      fc.property(
        orderItemsArb,
        taxRateArb,
        (items, taxRate) => {
          const totals = calculateOrderTotalsPure(items, taxRate, 0, 0, 0);
          
          const expectedTax = new Decimal(totals.subtotal)
            .mul(taxRate)
            .toDecimalPlaces(2)
            .toNumber();
          
          expect(Math.abs(totals.taxAmount - expectedTax)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.4: Service charge equals subtotal × serviceChargeRate
   */
  it('should calculate service charge as subtotal × serviceChargeRate', () => {
    fc.assert(
      fc.property(
        orderItemsArb,
        serviceChargeRateArb,
        (items, serviceChargeRate) => {
          const totals = calculateOrderTotalsPure(items, 0, serviceChargeRate, 0, 0);
          
          const expectedServiceCharge = new Decimal(totals.subtotal)
            .mul(serviceChargeRate)
            .toDecimalPlaces(2)
            .toNumber();
          
          expect(Math.abs(totals.serviceCharge - expectedServiceCharge)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.5: Empty order has zero totals
   */
  it('should return zero totals for empty order', () => {
    fc.assert(
      fc.property(
        taxRateArb,
        serviceChargeRateArb,
        (taxRate, serviceChargeRate) => {
          const totals = calculateOrderTotalsPure([], taxRate, serviceChargeRate, 0, 0);
          
          expect(totals.subtotal).toBe(0);
          expect(totals.taxAmount).toBe(0);
          expect(totals.serviceCharge).toBe(0);
          expect(totals.total).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.6: Discount reduces total
   * Adding a discount should reduce the total by exactly the discount amount
   */
  it('should reduce total by exactly the discount amount', () => {
    fc.assert(
      fc.property(
        fc.array(orderItemArb, { minLength: 1, maxLength: 20 }), // At least one item
        taxRateArb,
        serviceChargeRateArb,
        discountArb,
        (items, taxRate, serviceChargeRate, discount) => {
          // Calculate without discount
          const totalsNoDiscount = calculateOrderTotalsPure(items, taxRate, serviceChargeRate, 0, 0);
          
          // Constrain discount to not exceed subtotal
          const constrainedDiscount = Math.min(discount, totalsNoDiscount.subtotal);
          
          // Calculate with discount
          const totalsWithDiscount = calculateOrderTotalsPure(items, taxRate, serviceChargeRate, constrainedDiscount, 0);
          
          // Total should be reduced by exactly the discount amount
          const expectedTotal = new Decimal(totalsNoDiscount.total)
            .sub(constrainedDiscount)
            .toDecimalPlaces(2)
            .toNumber();
          
          expect(Math.abs(totalsWithDiscount.total - expectedTotal)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.7: Tip increases total
   * Adding a tip should increase the total by exactly the tip amount
   */
  it('should increase total by exactly the tip amount', () => {
    fc.assert(
      fc.property(
        orderItemsArb,
        taxRateArb,
        serviceChargeRateArb,
        tipArb,
        (items, taxRate, serviceChargeRate, tip) => {
          // Calculate without tip
          const totalsNoTip = calculateOrderTotalsPure(items, taxRate, serviceChargeRate, 0, 0);
          
          // Calculate with tip
          const totalsWithTip = calculateOrderTotalsPure(items, taxRate, serviceChargeRate, 0, tip);
          
          // Total should be increased by exactly the tip amount
          const expectedTotal = new Decimal(totalsNoTip.total)
            .add(tip)
            .toDecimalPlaces(2)
            .toNumber();
          
          expect(Math.abs(totalsWithTip.total - expectedTotal)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.8: verifyOrderTotals returns true for correctly calculated totals
   */
  it('should verify correctly calculated totals', () => {
    fc.assert(
      fc.property(
        orderItemsArb,
        taxRateArb,
        serviceChargeRateArb,
        discountArb,
        tipArb,
        (items, taxRate, serviceChargeRate, discount, tip) => {
          // Calculate subtotal to constrain discount
          const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
          const constrainedDiscount = Math.min(discount, subtotal);
          
          const totals = calculateOrderTotalsPure(items, taxRate, serviceChargeRate, constrainedDiscount, tip);
          
          // Verification should pass for correctly calculated totals
          expect(verifyOrderTotals(totals)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.9: verifyOrderTotals returns false for incorrectly calculated totals
   */
  it('should reject incorrectly calculated totals', () => {
    fc.assert(
      fc.property(
        fc.array(orderItemArb, { minLength: 1, maxLength: 20 }),
        taxRateArb,
        serviceChargeRateArb,
        fc.integer({ min: 100, max: 10000 }).map(e => e / 100), // Error amount in dollars
        (items, taxRate, serviceChargeRate, errorAmount) => {
          const totals = calculateOrderTotalsPure(items, taxRate, serviceChargeRate, 0, 0);
          
          // Create incorrect totals by adding error to total
          const incorrectTotals: OrderTotals = {
            ...totals,
            total: totals.total + errorAmount,
          };
          
          // Verification should fail for incorrect totals
          expect(verifyOrderTotals(incorrectTotals)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.10: Subtotal is non-negative
   * With valid inputs (positive quantities and prices), subtotal should never be negative
   */
  it('should always produce non-negative subtotal', () => {
    fc.assert(
      fc.property(
        orderItemsArb,
        taxRateArb,
        serviceChargeRateArb,
        (items, taxRate, serviceChargeRate) => {
          const totals = calculateOrderTotalsPure(items, taxRate, serviceChargeRate, 0, 0);
          
          expect(totals.subtotal).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.11: Tax and service charge are non-negative
   */
  it('should always produce non-negative tax and service charge', () => {
    fc.assert(
      fc.property(
        orderItemsArb,
        taxRateArb,
        serviceChargeRateArb,
        (items, taxRate, serviceChargeRate) => {
          const totals = calculateOrderTotalsPure(items, taxRate, serviceChargeRate, 0, 0);
          
          expect(totals.taxAmount).toBeGreaterThanOrEqual(0);
          expect(totals.serviceCharge).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6.12: Adding items increases subtotal
   * Adding an item to an order should increase the subtotal
   */
  it('should increase subtotal when adding items', () => {
    fc.assert(
      fc.property(
        orderItemsArb,
        orderItemArb,
        taxRateArb,
        serviceChargeRateArb,
        (existingItems, newItem, taxRate, serviceChargeRate) => {
          const totalsBefore = calculateOrderTotalsPure(existingItems, taxRate, serviceChargeRate, 0, 0);
          const totalsAfter = calculateOrderTotalsPure([...existingItems, newItem], taxRate, serviceChargeRate, 0, 0);
          
          // Subtotal should increase by the new item's line total
          const expectedIncrease = newItem.quantity * newItem.unitPrice;
          const actualIncrease = totalsAfter.subtotal - totalsBefore.subtotal;
          
          expect(Math.abs(actualIncrease - expectedIncrease)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });
});
