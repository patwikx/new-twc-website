/**
 * Property-Based Tests for Date Overlap Detection
 * 
 * Feature: unit-based-availability
 * Property 2: Date Overlap Detection Accuracy
 * Validates: Requirements 1.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { datesOverlap } from '../availability';

describe('Property 2: Date Overlap Detection Accuracy', () => {
  /**
   * For any two date ranges (checkIn1, checkOut1) and (checkIn2, checkOut2),
   * they overlap if and only if checkIn1 < checkOut2 AND checkOut1 > checkIn2.
   * The availability service SHALL correctly identify all and only overlapping bookings.
   */

  // Helper to generate a date within a reasonable range
  const dateArb = fc.date({
    min: new Date('2024-01-01'),
    max: new Date('2027-12-31')
  }).filter(d => !isNaN(d.getTime()));

  // Helper to generate a valid date range (start < end)
  const dateRangeArb = fc.tuple(dateArb, dateArb)
    .filter(([d1, d2]) => !isNaN(d1.getTime()) && !isNaN(d2.getTime()))
    .map(([d1, d2]) => {
      const sorted = [d1, d2].sort((a, b) => a.getTime() - b.getTime());
      // Ensure at least 1 day difference
      if (sorted[0].getTime() === sorted[1].getTime()) {
        sorted[1] = new Date(sorted[1].getTime() + 24 * 60 * 60 * 1000);
      }
      return { start: sorted[0], end: sorted[1] };
    })
    .filter(range => !isNaN(range.start.getTime()) && !isNaN(range.end.getTime()));

  it('should match the mathematical definition of overlap: start1 < end2 AND end1 > start2', async () => {
    await fc.assert(
      fc.property(
        dateRangeArb,
        dateRangeArb,
        (range1, range2) => {
          const result = datesOverlap(range1.start, range1.end, range2.start, range2.end);
          
          // Mathematical definition of overlap
          const mathematicalOverlap = range1.start < range2.end && range1.end > range2.start;
          
          expect(result).toBe(mathematicalOverlap);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect overlap when one range contains another', async () => {
    await fc.assert(
      fc.property(
        dateRangeArb,
        fc.integer({ min: 1, max: 10 }), // Days to shrink
        (outerRange, shrinkDays) => {
          const durationMs = outerRange.end.getTime() - outerRange.start.getTime();
          const shrinkMs = shrinkDays * 24 * 60 * 60 * 1000;
          
          // Only test if outer range is long enough
          if (durationMs <= shrinkMs * 2) return;
          
          // Create inner range contained within outer
          const innerStart = new Date(outerRange.start.getTime() + shrinkMs);
          const innerEnd = new Date(outerRange.end.getTime() - shrinkMs);
          
          const result = datesOverlap(outerRange.start, outerRange.end, innerStart, innerEnd);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not detect overlap for completely separate ranges', async () => {
    await fc.assert(
      fc.property(
        dateRangeArb,
        fc.integer({ min: 1, max: 365 }), // Gap in days
        (range1, gapDays) => {
          // Create range2 that starts after range1 ends with a gap
          const range2Start = new Date(range1.end.getTime() + gapDays * 24 * 60 * 60 * 1000);
          const range2End = new Date(range2Start.getTime() + 24 * 60 * 60 * 1000);
          
          const result = datesOverlap(range1.start, range1.end, range2Start, range2End);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not detect overlap when ranges are adjacent (checkout = checkin)', async () => {
    await fc.assert(
      fc.property(
        dateRangeArb,
        (range1) => {
          // Range2 starts exactly when range1 ends (same-day checkout/checkin)
          const range2Start = new Date(range1.end.getTime());
          const range2End = new Date(range2Start.getTime() + 24 * 60 * 60 * 1000);
          
          const result = datesOverlap(range1.start, range1.end, range2Start, range2End);
          // Adjacent ranges should NOT overlap (checkout day = checkin day is allowed)
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be commutative - order of ranges does not matter', async () => {
    await fc.assert(
      fc.property(
        dateRangeArb,
        dateRangeArb,
        (range1, range2) => {
          const result1 = datesOverlap(range1.start, range1.end, range2.start, range2.end);
          const result2 = datesOverlap(range2.start, range2.end, range1.start, range1.end);
          
          expect(result1).toBe(result2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect overlap for identical ranges', async () => {
    await fc.assert(
      fc.property(
        dateRangeArb,
        (range) => {
          const result = datesOverlap(range.start, range.end, range.start, range.end);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect partial overlap at the start', async () => {
    await fc.assert(
      fc.property(
        dateRangeArb,
        fc.integer({ min: 1, max: 5 }),
        (range1, overlapDays) => {
          const durationMs = range1.end.getTime() - range1.start.getTime();
          const overlapMs = overlapDays * 24 * 60 * 60 * 1000;
          
          // Only test if range is long enough
          if (durationMs <= overlapMs) return;
          
          // Range2 starts before range1 ends
          const range2Start = new Date(range1.end.getTime() - overlapMs);
          const range2End = new Date(range1.end.getTime() + 24 * 60 * 60 * 1000);
          
          const result = datesOverlap(range1.start, range1.end, range2Start, range2End);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should detect partial overlap at the end', async () => {
    await fc.assert(
      fc.property(
        dateRangeArb,
        fc.integer({ min: 1, max: 5 }),
        (range1, overlapDays) => {
          const durationMs = range1.end.getTime() - range1.start.getTime();
          const overlapMs = overlapDays * 24 * 60 * 60 * 1000;
          
          // Only test if range is long enough
          if (durationMs <= overlapMs) return;
          
          // Range2 ends after range1 starts
          const range2End = new Date(range1.start.getTime() + overlapMs);
          const range2Start = new Date(range1.start.getTime() - 24 * 60 * 60 * 1000);
          
          const result = datesOverlap(range1.start, range1.end, range2Start, range2End);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
