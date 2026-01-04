/**
 * Pure utility functions for shift operations
 * These are used for property-based testing and don't require server actions
 */

import Decimal from "decimal.js";

/**
 * Pure function to calculate expected cash
 * Property 18: Shift Cash Variance Calculation
 * 
 * expectedCash = startingCash + sum(cashPayments) - sum(cashRefunds)
 * 
 * @param startingCash - The starting cash amount
 * @param cashPayments - Array of cash payment amounts
 * @param cashRefunds - Array of cash refund amounts
 * @returns The expected cash amount
 */
export function calculateExpectedCashPure(
  startingCash: number,
  cashPayments: number[],
  cashRefunds: number[]
): number {
  const starting = new Decimal(startingCash);
  
  const totalPayments = cashPayments.reduce(
    (sum, payment) => sum.add(new Decimal(payment)),
    new Decimal(0)
  );
  
  const totalRefunds = cashRefunds.reduce(
    (sum, refund) => sum.add(new Decimal(refund)),
    new Decimal(0)
  );
  
  return starting
    .add(totalPayments)
    .sub(totalRefunds)
    .toDecimalPlaces(2)
    .toNumber();
}

/**
 * Pure function to calculate variance
 * Property 18: Shift Cash Variance Calculation
 * 
 * variance = endingCash - expectedCash
 * 
 * @param endingCash - The actual ending cash amount
 * @param expectedCash - The calculated expected cash amount
 * @returns The variance (positive = overage, negative = shortage)
 */
export function calculateVariancePure(
  endingCash: number,
  expectedCash: number
): number {
  return new Decimal(endingCash)
    .sub(new Decimal(expectedCash))
    .toDecimalPlaces(2)
    .toNumber();
}

/**
 * Verify shift variance calculation
 * Property 18: Shift Cash Variance Calculation
 * 
 * @param startingCash - The starting cash amount
 * @param cashPayments - Array of cash payment amounts
 * @param cashRefunds - Array of cash refund amounts
 * @param endingCash - The actual ending cash amount
 * @param reportedVariance - The reported variance
 * @returns True if the variance is correctly calculated
 */
export function verifyShiftVariance(
  startingCash: number,
  cashPayments: number[],
  cashRefunds: number[],
  endingCash: number,
  reportedVariance: number
): boolean {
  const expectedCash = calculateExpectedCashPure(startingCash, cashPayments, cashRefunds);
  const calculatedVariance = calculateVariancePure(endingCash, expectedCash);
  
  // Allow for small floating point differences
  return Math.abs(calculatedVariance - reportedVariance) < 0.01;
}
