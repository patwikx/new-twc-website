/**
 * Property-Based Tests for Notification Read State
 * 
 * Feature: enterprise-gaps
 * Property 21: Notification Read State
 * 
 * For any notification marked as read, the isRead flag SHALL be true and readAt SHALL contain
 * the timestamp of when it was read.
 * 
 * **Validates: Requirements 15.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateNotificationReadStatePure,
  NotificationReadContext,
} from '../notification-utils';

// Arbitrary for generating dates
const dateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') });

// Arbitrary for valid read state (isRead = true, readAt = Date)
const validReadStateArb = fc.record({
  isRead: fc.constant(true),
  readAt: dateArb,
});

// Arbitrary for valid unread state (isRead = false, readAt = null)
const validUnreadStateArb = fc.record({
  isRead: fc.constant(false),
  readAt: fc.constant(null),
});

// Arbitrary for invalid read state (isRead = true, readAt = null)
const invalidReadStateNoTimestampArb = fc.record({
  isRead: fc.constant(true),
  readAt: fc.constant(null),
});

// Arbitrary for invalid unread state (isRead = false, readAt = Date)
const invalidUnreadStateWithTimestampArb = fc.record({
  isRead: fc.constant(false),
  readAt: dateArb,
});

describe('Property 21: Notification Read State', () => {
  /**
   * Property 21.1: Valid read state passes validation
   * 
   * For any notification with isRead = true and a valid readAt timestamp,
   * the read state validation SHALL pass
   */
  it('should accept notifications with isRead=true and valid readAt timestamp', () => {
    fc.assert(
      fc.property(
        validReadStateArb,
        (context: NotificationReadContext) => {
          const result = validateNotificationReadStatePure(context);
          
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 21.2: Valid unread state passes validation
   * 
   * For any notification with isRead = false and readAt = null,
   * the read state validation SHALL pass
   */
  it('should accept notifications with isRead=false and readAt=null', () => {
    fc.assert(
      fc.property(
        validUnreadStateArb,
        (context: NotificationReadContext) => {
          const result = validateNotificationReadStatePure(context);
          
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 21.3: Read state without timestamp fails validation
   * 
   * For any notification with isRead = true but readAt = null,
   * the read state validation SHALL fail
   */
  it('should reject notifications with isRead=true but no readAt timestamp', () => {
    fc.assert(
      fc.property(
        invalidReadStateNoTimestampArb,
        (context: NotificationReadContext) => {
          const result = validateNotificationReadStatePure(context);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('readAt');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 21.4: Unread state with timestamp fails validation
   * 
   * For any notification with isRead = false but readAt has a value,
   * the read state validation SHALL fail
   */
  it('should reject notifications with isRead=false but has readAt timestamp', () => {
    fc.assert(
      fc.property(
        invalidUnreadStateWithTimestampArb,
        (context: NotificationReadContext) => {
          const result = validateNotificationReadStatePure(context);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('readAt');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 21.5: Validation is deterministic
   * 
   * For any notification read context, calling validateNotificationReadStatePure twice
   * with the same input SHALL produce the same result
   */
  it('should produce deterministic results for the same input', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          validReadStateArb,
          validUnreadStateArb,
          invalidReadStateNoTimestampArb,
          invalidUnreadStateWithTimestampArb
        ),
        (context: NotificationReadContext) => {
          const result1 = validateNotificationReadStatePure(context);
          const result2 = validateNotificationReadStatePure(context);
          
          expect(result1.valid).toBe(result2.valid);
          expect(result1.error).toBe(result2.error);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 21.6: Read state consistency - isRead and readAt are coupled
   * 
   * For any valid notification state, isRead and readAt SHALL be consistent:
   * - isRead = true implies readAt is not null
   * - isRead = false implies readAt is null
   */
  it('should enforce consistency between isRead and readAt', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.option(dateArb, { nil: null }),
        (isRead: boolean, readAt: Date | null) => {
          const context: NotificationReadContext = { isRead, readAt };
          const result = validateNotificationReadStatePure(context);
          
          // Valid states: (true, Date) or (false, null)
          // Invalid states: (true, null) or (false, Date)
          const isValidState = (isRead && readAt !== null) || (!isRead && readAt === null);
          
          expect(result.valid).toBe(isValidState);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 21.7: Any valid timestamp is accepted for read notifications
   * 
   * For any notification with isRead = true, any valid Date object for readAt
   * SHALL be accepted
   */
  it('should accept any valid timestamp for read notifications', () => {
    fc.assert(
      fc.property(
        dateArb,
        (readAt: Date) => {
          const context: NotificationReadContext = {
            isRead: true,
            readAt,
          };
          
          const result = validateNotificationReadStatePure(context);
          
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 21.8: State transition from unread to read
   * 
   * For any notification transitioning from unread to read,
   * the new state SHALL have isRead = true and a valid readAt timestamp
   */
  it('should validate state transition from unread to read', () => {
    fc.assert(
      fc.property(
        dateArb,
        (readAt: Date) => {
          // Initial unread state
          const unreadState: NotificationReadContext = {
            isRead: false,
            readAt: null,
          };
          
          // Validate initial state
          const unreadResult = validateNotificationReadStatePure(unreadState);
          expect(unreadResult.valid).toBe(true);
          
          // Transition to read state
          const readState: NotificationReadContext = {
            isRead: true,
            readAt,
          };
          
          // Validate new state
          const readResult = validateNotificationReadStatePure(readState);
          expect(readResult.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 21.9: Error message specificity for missing timestamp
   * 
   * When isRead is true but readAt is null, the error message SHALL
   * indicate that readAt timestamp is required
   */
  it('should provide specific error message for missing timestamp', () => {
    const context: NotificationReadContext = {
      isRead: true,
      readAt: null,
    };
    
    const result = validateNotificationReadStatePure(context);
    
    expect(result.valid).toBe(false);
    expect(result.error).toContain('readAt');
    expect(result.error).toContain('required');
  });

  /**
   * Property 21.10: Error message specificity for unexpected timestamp
   * 
   * When isRead is false but readAt has a value, the error message SHALL
   * indicate that readAt should be null
   */
  it('should provide specific error message for unexpected timestamp', () => {
    const context: NotificationReadContext = {
      isRead: false,
      readAt: new Date(),
    };
    
    const result = validateNotificationReadStatePure(context);
    
    expect(result.valid).toBe(false);
    expect(result.error).toContain('readAt');
    expect(result.error).toContain('null');
  });
});
