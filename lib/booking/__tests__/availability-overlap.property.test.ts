/**
 * Property-Based Tests for Room Availability Service
 * 
 * Feature: booking-security-enhancements
 * Property 2: Availability Check Prevents Double Booking
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { datesOverlap } from '../availability';

describe('Property 2: Availability Check Prevents Double Booking', () => {
  /**
   * For any room and date range, if a CONFIRMED or PENDING booking exists
   * with overlapping dates, the Availability_Service SHALL return available: false.
   * 
   * This test focuses on the pure date overlap detection logic.
   */
  
  // Helper to generate a date within a reasonable range
  const dateArb = fc.date({
    min: new Date('2024-01-01'),
    max: new Date('2026-12-31')
  }).filter(d => !isNaN(d.getTime())); // Filter out invalid dates

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

  it('should detect overlapping date ranges correctly', async () => {
    await fc.assert(
      fc.property(
        dateRangeArb,
        dateRangeArb,
        (range1, range2) => {
          const overlaps = datesOverlap(range1.start, range1.end, range2.start, range2.end);
          
          // Manual overlap check for verification
          const manualOverlap = range1.start < range2.end && range1.end > range2.start;
          
          expect(overlaps).toBe(manualOverlap);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return true for identical date ranges', async () => {
    await fc.assert(
      fc.property(
        dateRangeArb,
        (range) => {
          const overlaps = datesOverlap(range.start, range.end, range.start, range.end);
          expect(overlaps).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return false for non-overlapping sequential ranges', async () => {
    await fc.assert(
      fc.property(
        dateRangeArb,
        fc.integer({ min: 1, max: 30 }), // Gap in days
        (range, gapDays) => {
          // Create a second range that starts after the first ends
          const range2Start = new Date(range.end.getTime() + gapDays * 24 * 60 * 60 * 1000);
          const range2End = new Date(range2Start.getTime() + 24 * 60 * 60 * 1000);
          
          const overlaps = datesOverlap(range.start, range.end, range2Start, range2End);
          expect(overlaps).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return true for partially overlapping ranges', async () => {
    await fc.assert(
      fc.property(
        dateRangeArb,
        fc.integer({ min: 1, max: 5 }), // Overlap days
        (range, overlapDays) => {
          // Calculate range duration in days
          const durationMs = range.end.getTime() - range.start.getTime();
          const durationDays = Math.floor(durationMs / (24 * 60 * 60 * 1000));
          
          // Only test if range is long enough for partial overlap
          if (durationDays <= overlapDays) return;
          
          // Create a second range that starts before the first ends
          const range2Start = new Date(range.end.getTime() - overlapDays * 24 * 60 * 60 * 1000);
          const range2End = new Date(range.end.getTime() + 24 * 60 * 60 * 1000);
          
          const overlaps = datesOverlap(range.start, range.end, range2Start, range2End);
          expect(overlaps).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle edge case where ranges touch but do not overlap', async () => {
    await fc.assert(
      fc.property(
        dateRangeArb,
        (range) => {
          // Create a second range that starts exactly when the first ends
          const range2Start = range.end;
          const range2End = new Date(range.end.getTime() + 24 * 60 * 60 * 1000);
          
          // Touching ranges should NOT overlap (checkout day = checkin day is allowed)
          const overlaps = datesOverlap(range.start, range.end, range2Start, range2End);
          expect(overlaps).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be symmetric - overlap detection works regardless of order', async () => {
    await fc.assert(
      fc.property(
        dateRangeArb,
        dateRangeArb,
        (range1, range2) => {
          const overlaps1 = datesOverlap(range1.start, range1.end, range2.start, range2.end);
          const overlaps2 = datesOverlap(range2.start, range2.end, range1.start, range1.end);
          
          // Overlap detection should be symmetric
          expect(overlaps1).toBe(overlaps2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
