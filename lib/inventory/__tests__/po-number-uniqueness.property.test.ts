/**
 * Property-Based Tests for Purchase Order Number Uniqueness
 * 
 * Feature: enterprise-gaps
 * Property 12: Purchase Order Number Uniqueness
 * 
 * For any two purchase orders, their PO numbers SHALL be unique across the entire system.
 * 
 * **Validates: Requirements 9.1**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generatePONumberPure } from '../purchase-order-utils';

// Valid date arbitrary - using integer timestamps to avoid invalid dates
const validDateArb = fc.integer({ 
  min: new Date('2024-01-01').getTime(), 
  max: new Date('2026-12-31').getTime() 
}).map(ts => new Date(ts));

// Arbitrary for generating a list of existing PO numbers for a specific date
const existingPONumbersForDateArb = (date: Date) => {
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  return fc.array(
    fc.integer({ min: 1, max: 9999 }).map(seq => 
      `PO-${dateStr}-${seq.toString().padStart(4, '0')}`
    ),
    { minLength: 0, maxLength: 50 }
  );
};

// Arbitrary for generating random existing PO numbers (mixed dates)
// Limit max sequence to 9998 to avoid overflow in tests
const randomExistingPONumbersArb = fc.array(
  fc.tuple(
    fc.integer({ min: new Date('2024-01-01').getTime(), max: new Date('2026-12-31').getTime() }).map(ts => new Date(ts)),
    fc.integer({ min: 1, max: 9998 })
  ).map(([date, seq]) => {
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    return `PO-${dateStr}-${seq.toString().padStart(4, '0')}`;
  }),
  { minLength: 0, maxLength: 50 }
);

describe('Property 12: Purchase Order Number Uniqueness', () => {
  /**
   * Property 12.1: Generated PO numbers follow the correct format
   * Format: PO-YYYYMMDD-XXXX
   */
  it('should generate PO numbers in correct format', () => {
    fc.assert(
      fc.property(
        randomExistingPONumbersArb,
        validDateArb,
        (existingNumbers, date) => {
          const poNumber = generatePONumberPure(existingNumbers, date);
          
          // Verify format: PO-YYYYMMDD-XXXX
          const formatRegex = /^PO-\d{8}-\d{4}$/;
          expect(poNumber).toMatch(formatRegex);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.2: Generated PO number is unique among existing numbers
   */
  it('should generate unique PO numbers not in existing set', () => {
    fc.assert(
      fc.property(
        randomExistingPONumbersArb,
        validDateArb,
        (existingNumbers, date) => {
          const poNumber = generatePONumberPure(existingNumbers, date);
          
          // The generated number should not be in the existing set
          expect(existingNumbers).not.toContain(poNumber);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.3: Sequential generation produces unique numbers
   * Generating multiple PO numbers in sequence should all be unique
   */
  it('should generate unique numbers when called sequentially', () => {
    fc.assert(
      fc.property(
        validDateArb,
        fc.integer({ min: 1, max: 20 }),
        (date, count) => {
          const generatedNumbers: string[] = [];
          let currentExisting: string[] = [];
          
          for (let i = 0; i < count; i++) {
            const poNumber = generatePONumberPure(currentExisting, date);
            generatedNumbers.push(poNumber);
            currentExisting = [...currentExisting, poNumber];
          }
          
          // All generated numbers should be unique
          const uniqueNumbers = new Set(generatedNumbers);
          expect(uniqueNumbers.size).toBe(generatedNumbers.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.4: PO number contains correct date
   */
  it('should include the correct date in PO number', () => {
    fc.assert(
      fc.property(
        validDateArb,
        (date) => {
          const poNumber = generatePONumberPure([], date);
          
          // Extract date from PO number
          const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
          expect(poNumber).toContain(dateStr);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.5: Sequence number increments correctly
   * When existing numbers exist for the same date, the new number should have a higher sequence
   */
  it('should increment sequence number correctly', () => {
    fc.assert(
      fc.property(
        validDateArb,
        fc.integer({ min: 1, max: 100 }),
        (date, existingCount) => {
          const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
          
          // Create existing numbers for this date
          const existingNumbers: string[] = [];
          for (let i = 1; i <= existingCount; i++) {
            existingNumbers.push(`PO-${dateStr}-${i.toString().padStart(4, '0')}`);
          }
          
          const poNumber = generatePONumberPure(existingNumbers, date);
          
          // Extract sequence from generated number
          const sequence = parseInt(poNumber.slice(-4), 10);
          
          // Sequence should be one more than the count of existing numbers
          expect(sequence).toBe(existingCount + 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.6: Different dates produce independent sequences
   */
  it('should start sequence at 1 for new dates', () => {
    fc.assert(
      fc.property(
        validDateArb,
        validDateArb,
        fc.integer({ min: 1, max: 50 }),
        (date1, date2, existingCount) => {
          // Ensure dates are different
          const dateStr1 = date1.toISOString().slice(0, 10);
          const dateStr2 = date2.toISOString().slice(0, 10);
          fc.pre(dateStr1 !== dateStr2);
          
          const dateStrFormatted1 = dateStr1.replace(/-/g, '');
          
          // Create existing numbers for date1 only
          const existingNumbers: string[] = [];
          for (let i = 1; i <= existingCount; i++) {
            existingNumbers.push(`PO-${dateStrFormatted1}-${i.toString().padStart(4, '0')}`);
          }
          
          // Generate for date2 (which has no existing numbers)
          const poNumber = generatePONumberPure(existingNumbers, date2);
          
          // Sequence should be 1 for the new date
          const sequence = parseInt(poNumber.slice(-4), 10);
          expect(sequence).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.7: Empty existing numbers starts at 1
   */
  it('should start at sequence 1 when no existing numbers', () => {
    fc.assert(
      fc.property(
        validDateArb,
        (date) => {
          const poNumber = generatePONumberPure([], date);
          
          // Sequence should be 1
          const sequence = parseInt(poNumber.slice(-4), 10);
          expect(sequence).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.8: Sequence number is always 4 digits with leading zeros
   */
  it('should always produce 4-digit sequence with leading zeros', () => {
    fc.assert(
      fc.property(
        randomExistingPONumbersArb,
        validDateArb,
        (existingNumbers, date) => {
          const poNumber = generatePONumberPure(existingNumbers, date);
          
          // Extract sequence part
          const sequencePart = poNumber.slice(-4);
          
          // Should be exactly 4 characters
          expect(sequencePart.length).toBe(4);
          
          // Should be all digits
          expect(sequencePart).toMatch(/^\d{4}$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.9: Generated number is always greater than max existing for same date
   */
  it('should generate sequence greater than max existing for same date', () => {
    fc.assert(
      fc.property(
        validDateArb,
        fc.array(fc.integer({ min: 1, max: 9998 }), { minLength: 1, maxLength: 20 }),
        (date, sequences) => {
          const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
          
          // Create existing numbers with the given sequences
          const existingNumbers = sequences.map(
            seq => `PO-${dateStr}-${seq.toString().padStart(4, '0')}`
          );
          
          const poNumber = generatePONumberPure(existingNumbers, date);
          
          // The generated sequence should be greater than max existing
          const maxSeq = Math.max(...sequences);
          const newSeq = parseInt(poNumber.slice(-4), 10);
          expect(newSeq).toBeGreaterThan(maxSeq);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12.10: Overflow protection - throws error when sequence exceeds 9999
   */
  it('should throw error when sequence would exceed 9999', () => {
    const date = new Date('2024-01-01');
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Create existing number at max sequence
    const existingNumbers = [`PO-${dateStr}-9999`];
    
    // Should throw an error when trying to generate the next number
    expect(() => generatePONumberPure(existingNumbers, date)).toThrow('PO sequence overflow');
  });
});
