/**
 * Property-Based Tests for Room Type Display Filtering
 * 
 * Feature: unit-based-availability
 * Property 4: Room Type Display Filtering
 * Validates: Requirements 3.2, 3.3, 3.4
 * 
 * For any property and date range, the booking widget SHALL display only room types
 * where availableUnits > 0, and each displayed room type SHALL show the correct
 * availableUnits count and limitedAvailability flag (true when availableUnits <= 2).
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { filterAvailableRooms } from '@/components/booking/BookingWidget';

// Type definitions matching the component
interface Room {
  id: string;
  name: string;
  image: string;
  price: number;
  capacity: number;
}

interface AvailabilityResult {
  roomTypeId: string;
  availableUnits: number;
  totalUnits: number;
  limitedAvailability: boolean;
}

// Arbitraries for generating test data
const roomArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  image: fc.webUrl(),
  price: fc.integer({ min: 100, max: 100000 }),
  capacity: fc.integer({ min: 1, max: 20 })
});

const availabilityResultArb = (roomTypeId: string) => fc.record({
  roomTypeId: fc.constant(roomTypeId),
  availableUnits: fc.integer({ min: 0, max: 50 }),
  totalUnits: fc.integer({ min: 0, max: 50 }),
  limitedAvailability: fc.boolean()
});

// Generate rooms with matching availability results
const roomsWithAvailabilityArb = fc.array(roomArb, { minLength: 1, maxLength: 10 })
  .chain(rooms => {
    const availabilityArbs = rooms.map(room => availabilityResultArb(room.id));
    return fc.tuple(
      fc.constant(rooms),
      fc.tuple(...availabilityArbs)
    );
  });

describe('Property 4: Room Type Display Filtering', () => {
  /**
   * Property 4.1: Only rooms with availableUnits > 0 should be displayed
   * Validates: Requirement 3.2
   */
  it('should only display room types with availableUnits > 0', async () => {
    await fc.assert(
      fc.property(
        roomsWithAvailabilityArb,
        ([rooms, availabilityResults]) => {
          const result = filterAvailableRooms(rooms, availabilityResults);
          
          // All returned rooms should have availableUnits > 0
          for (const room of result) {
            expect(room.availableUnits).toBeGreaterThan(0);
          }
          
          // Count rooms that should be displayed
          const expectedCount = availabilityResults.filter(a => a.availableUnits > 0).length;
          expect(result.length).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.2: Displayed rooms should show correct availableUnits count
   * Validates: Requirement 3.3
   */
  it('should display correct availableUnits count for each room', async () => {
    await fc.assert(
      fc.property(
        roomsWithAvailabilityArb,
        ([rooms, availabilityResults]) => {
          const result = filterAvailableRooms(rooms, availabilityResults);
          
          // Create a map for quick lookup
          const availabilityMap = new Map(
            availabilityResults.map(a => [a.roomTypeId, a])
          );
          
          // Each displayed room should have the correct availableUnits
          for (const room of result) {
            const availability = availabilityMap.get(room.roomId);
            expect(availability).toBeDefined();
            expect(room.availableUnits).toBe(availability!.availableUnits);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.3: Displayed rooms should show correct limitedAvailability flag
   * Validates: Requirement 3.4
   */
  it('should display correct limitedAvailability flag for each room', async () => {
    await fc.assert(
      fc.property(
        roomsWithAvailabilityArb,
        ([rooms, availabilityResults]) => {
          const result = filterAvailableRooms(rooms, availabilityResults);
          
          // Create a map for quick lookup
          const availabilityMap = new Map(
            availabilityResults.map(a => [a.roomTypeId, a])
          );
          
          // Each displayed room should have the correct limitedAvailability flag
          for (const room of result) {
            const availability = availabilityMap.get(room.roomId);
            expect(availability).toBeDefined();
            expect(room.limitedAvailability).toBe(availability!.limitedAvailability);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.4: Rooms with zero availability should never be displayed
   * Validates: Requirement 3.2 (negative case)
   */
  it('should never display rooms with zero availability', async () => {
    await fc.assert(
      fc.property(
        roomsWithAvailabilityArb,
        ([rooms, availabilityResults]) => {
          const result = filterAvailableRooms(rooms, availabilityResults);
          
          // Get IDs of rooms with zero availability
          const zeroAvailabilityIds = new Set(
            availabilityResults
              .filter(a => a.availableUnits <= 0)
              .map(a => a.roomTypeId)
          );
          
          // None of the returned rooms should have zero availability
          for (const room of result) {
            expect(zeroAvailabilityIds.has(room.roomId)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.5: Room data should be correctly mapped from input
   * Validates: Requirements 3.2, 3.3
   */
  it('should correctly map room data from input', async () => {
    await fc.assert(
      fc.property(
        roomsWithAvailabilityArb,
        ([rooms, availabilityResults]) => {
          const result = filterAvailableRooms(rooms, availabilityResults);
          
          // Create a map for quick lookup
          const roomMap = new Map(rooms.map(r => [r.id, r]));
          
          // Each displayed room should have correct data from input
          for (const displayedRoom of result) {
            const originalRoom = roomMap.get(displayedRoom.roomId);
            expect(originalRoom).toBeDefined();
            expect(displayedRoom.roomName).toBe(originalRoom!.name);
            expect(displayedRoom.roomImage).toBe(originalRoom!.image);
            expect(displayedRoom.price).toBe(originalRoom!.price);
            expect(displayedRoom.capacity).toBe(originalRoom!.capacity);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.6: Rooms without availability data should not be displayed
   * Validates: Requirement 3.2
   */
  it('should not display rooms without availability data', async () => {
    await fc.assert(
      fc.property(
        fc.array(roomArb, { minLength: 2, maxLength: 10 }),
        (rooms) => {
          // Only provide availability for half the rooms
          const halfRooms = rooms.slice(0, Math.floor(rooms.length / 2));
          const availabilityResults = halfRooms.map(room => ({
            roomTypeId: room.id,
            availableUnits: 5, // All available
            totalUnits: 10,
            limitedAvailability: false
          }));
          
          const result = filterAvailableRooms(rooms, availabilityResults);
          
          // Only rooms with availability data should be returned
          const availableIds = new Set(availabilityResults.map(a => a.roomTypeId));
          for (const room of result) {
            expect(availableIds.has(room.roomId)).toBe(true);
          }
          expect(result.length).toBeLessThanOrEqual(halfRooms.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4.7: Empty inputs should return empty results
   */
  it('should return empty array for empty inputs', async () => {
    // Empty rooms
    expect(filterAvailableRooms([], [])).toEqual([]);
    
    // Empty availability
    await fc.assert(
      fc.property(
        fc.array(roomArb, { minLength: 1, maxLength: 5 }),
        (rooms) => {
          const result = filterAvailableRooms(rooms, []);
          expect(result).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });
});
