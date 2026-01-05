/**
 * Guest Capacity Validation Service
 * 
 * Validates that guest counts do not exceed room capacities.
 * Checks each room's capacity individually and returns detailed
 * error messages per room.
 * 
 * Requirements: 8.1, 8.2
 */

/**
 * Represents a booking item with guest count for validation
 */
export interface BookingItemForCapacity {
  roomId: string;
  guests: number;
}

/**
 * Represents a room with its capacity
 */
export interface RoomWithCapacity {
  id: string;
  name: string;
  capacity: number;
}

/**
 * Error details for a single room capacity violation
 */
export interface CapacityError {
  roomId: string;
  roomName: string;
  capacity: number;
  requested: number;
}

/**
 * Result of capacity validation
 */
export interface CapacityValidationResult {
  valid: boolean;
  errors: CapacityError[];
}

/**
 * Validate guest capacity for booking items against room capacities.
 * 
 * Property 5: Guest Count Cannot Exceed Room Capacity
 * For any booking with guest count G and room capacity C,
 * if G > C then validation SHALL fail.
 * If G <= C then validation SHALL pass (assuming other criteria are met).
 * 
 * @param items - Array of booking items with guest counts
 * @param rooms - Array of rooms with their capacities
 * @returns Validation result with detailed errors per room
 */
export function validateGuestCapacity(
  items: BookingItemForCapacity[],
  rooms: RoomWithCapacity[]
): CapacityValidationResult {
  const errors: CapacityError[] = [];
  
  // Create a map for quick room lookup
  const roomMap = new Map<string, RoomWithCapacity>();
  for (const room of rooms) {
    roomMap.set(room.id, room);
  }
  
  // Check each booking item's guest count against room capacity
  for (const item of items) {
    const room = roomMap.get(item.roomId);
    
    if (!room) {
      // Room not found - skip validation (other validation should catch this)
      continue;
    }
    
    if (item.guests > room.capacity) {
      errors.push({
        roomId: room.id,
        roomName: room.name,
        capacity: room.capacity,
        requested: item.guests
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if a single guest count exceeds room capacity.
 * Pure function for testing purposes.
 * 
 * @param guestCount - Number of guests
 * @param roomCapacity - Maximum room capacity
 * @returns true if guest count exceeds capacity
 */
export function exceedsCapacity(guestCount: number, roomCapacity: number): boolean {
  return guestCount > roomCapacity;
}

/**
 * Format a capacity error message for display.
 * 
 * @param error - The capacity error
 * @returns Human-readable error message
 */
export function formatCapacityError(error: CapacityError): string {
  return `${error.roomName} has a maximum capacity of ${error.capacity} guests, but ${error.requested} were requested.`;
}

/**
 * Format all capacity errors into a single message.
 * 
 * @param result - The validation result
 * @returns Human-readable error message or empty string if valid
 */
export function formatCapacityErrors(result: CapacityValidationResult): string {
  if (result.valid) {
    return '';
  }
  
  if (result.errors.length === 1) {
    return formatCapacityError(result.errors[0]);
  }
  
  const messages = result.errors.map(formatCapacityError);
  return `Guest count exceeds capacity for ${result.errors.length} rooms:\n${messages.join('\n')}`;
}
