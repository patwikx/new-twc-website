/**
 * Property-Based Tests for Room Charge Folio Consistency
 * 
 * Feature: enterprise-gaps
 * Property 11: Room Charge Folio Consistency
 * 
 * For any room charge processed, the booking's total charges SHALL increase by exactly the order total amount.
 * 
 * **Validates: Requirements 8.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateFolioAfterRoomCharge } from '../payment';
import Decimal from 'decimal.js';

// Arbitrary for amount due (in cents, converted to dollars)
const amountDueArb = fc.integer({ min: 0, max: 100000000 }) // 0 to 1,000,000.00
  .map(cents => cents / 100);

// Arbitrary for charge amount (positive)
const chargeAmountArb = fc.integer({ min: 1, max: 10000000 }) // 0.01 to 100,000.00
  .map(cents => cents / 100);

// Arbitrary for multiple charges
const multipleChargesArb = fc.array(
  fc.integer({ min: 1, max: 1000000 }).map(cents => cents / 100),
  { minLength: 1, maxLength: 10 }
);

describe('Property 11: Room Charge Folio Consistency', () => {
  /**
   * Property 11.1: Folio increases by exactly the charge amount
   * Requirement 8.3: Room charge SHALL add the order total to the booking's charges
   */
  it('should increase folio by exactly the charge amount', () => {
    fc.assert(
      fc.property(
        amountDueArb,
        chargeAmountArb,
        (currentAmountDue, chargeAmount) => {
          const newAmountDue = calculateFolioAfterRoomCharge(currentAmountDue, chargeAmount);
          
          // The increase should be exactly the charge amount
          const increase = new Decimal(newAmountDue)
            .sub(currentAmountDue)
            .toDecimalPlaces(2)
            .toNumber();
          
          // Allow small tolerance for floating point
          expect(Math.abs(increase - chargeAmount)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.2: Folio is always non-negative after charge
   * Charges should only increase the amount due
   */
  it('should always produce non-negative folio after charge', () => {
    fc.assert(
      fc.property(
        amountDueArb,
        chargeAmountArb,
        (currentAmountDue, chargeAmount) => {
          const newAmountDue = calculateFolioAfterRoomCharge(currentAmountDue, chargeAmount);
          expect(newAmountDue).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.3: Folio is always greater than or equal to original after charge
   * Adding a positive charge should never decrease the folio
   */
  it('should never decrease folio when adding a charge', () => {
    fc.assert(
      fc.property(
        amountDueArb,
        chargeAmountArb,
        (currentAmountDue, chargeAmount) => {
          const newAmountDue = calculateFolioAfterRoomCharge(currentAmountDue, chargeAmount);
          expect(newAmountDue).toBeGreaterThanOrEqual(currentAmountDue);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.4: Zero charge leaves folio unchanged
   */
  it('should leave folio unchanged with zero charge', () => {
    fc.assert(
      fc.property(
        amountDueArb,
        (currentAmountDue) => {
          const newAmountDue = calculateFolioAfterRoomCharge(currentAmountDue, 0);
          expect(Math.abs(newAmountDue - currentAmountDue)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.5: Multiple charges are additive
   * Applying charges sequentially should equal applying the sum at once
   */
  it('should be additive for multiple charges', () => {
    fc.assert(
      fc.property(
        amountDueArb,
        multipleChargesArb,
        (initialAmountDue, charges) => {
          // Apply charges sequentially
          let sequentialResult = initialAmountDue;
          for (const charge of charges) {
            sequentialResult = calculateFolioAfterRoomCharge(sequentialResult, charge);
          }

          // Apply sum of charges at once
          const totalCharge = charges.reduce((sum, c) => sum + c, 0);
          const singleResult = calculateFolioAfterRoomCharge(initialAmountDue, totalCharge);

          // Results should be equal (within tolerance)
          expect(Math.abs(sequentialResult - singleResult)).toBeLessThan(0.02);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.6: Calculation is deterministic
   * Same inputs should always produce same outputs
   */
  it('should produce deterministic results', () => {
    fc.assert(
      fc.property(
        amountDueArb,
        chargeAmountArb,
        (currentAmountDue, chargeAmount) => {
          const result1 = calculateFolioAfterRoomCharge(currentAmountDue, chargeAmount);
          const result2 = calculateFolioAfterRoomCharge(currentAmountDue, chargeAmount);
          
          expect(result1).toBe(result2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.7: Result is properly rounded to 2 decimal places
   */
  it('should round result to 2 decimal places', () => {
    fc.assert(
      fc.property(
        amountDueArb,
        chargeAmountArb,
        (currentAmountDue, chargeAmount) => {
          const newAmountDue = calculateFolioAfterRoomCharge(currentAmountDue, chargeAmount);
          
          // Check that the result has at most 2 decimal places
          const rounded = Math.round(newAmountDue * 100) / 100;
          expect(Math.abs(newAmountDue - rounded)).toBeLessThan(0.001);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.8: Starting from zero, folio equals charge amount
   */
  it('should equal charge amount when starting from zero', () => {
    fc.assert(
      fc.property(
        chargeAmountArb,
        (chargeAmount) => {
          const newAmountDue = calculateFolioAfterRoomCharge(0, chargeAmount);
          expect(Math.abs(newAmountDue - chargeAmount)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.9: Order of charges doesn't matter (commutativity)
   */
  it('should produce same result regardless of charge order', () => {
    fc.assert(
      fc.property(
        amountDueArb,
        chargeAmountArb,
        chargeAmountArb,
        (initialAmountDue, charge1, charge2) => {
          // Apply charge1 then charge2
          const result1 = calculateFolioAfterRoomCharge(
            calculateFolioAfterRoomCharge(initialAmountDue, charge1),
            charge2
          );

          // Apply charge2 then charge1
          const result2 = calculateFolioAfterRoomCharge(
            calculateFolioAfterRoomCharge(initialAmountDue, charge2),
            charge1
          );

          // Results should be equal
          expect(Math.abs(result1 - result2)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11.10: Large charges are handled correctly
   */
  it('should handle large charges correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000000 }).map(c => c / 100), // Up to 10,000.00
        fc.integer({ min: 100000, max: 10000000 }).map(c => c / 100), // 1,000.00 to 100,000.00
        (currentAmountDue, largeCharge) => {
          const newAmountDue = calculateFolioAfterRoomCharge(currentAmountDue, largeCharge);
          
          // Verify the calculation is correct
          const expected = new Decimal(currentAmountDue)
            .add(largeCharge)
            .toDecimalPlaces(2)
            .toNumber();
          
          expect(Math.abs(newAmountDue - expected)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });
});
