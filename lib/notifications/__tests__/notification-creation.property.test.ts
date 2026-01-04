/**
 * Property-Based Tests for Notification Creation on Events
 * 
 * Feature: enterprise-gaps
 * Property 20: Notification Creation on Events
 * 
 * For any triggering event (low stock, PO approval needed, requisition status change, expiring batch),
 * a notification SHALL be created for the appropriate users.
 * 
 * **Validates: Requirements 15.1, 15.2, 15.3, 15.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateNotificationCreationPure,
  NotificationContext,
  isValidNotificationTypeForEvent,
} from '../notification-utils';
import { NotificationType } from '@prisma/client';

// Valid notification types
const validNotificationTypes: NotificationType[] = [
  "LOW_STOCK",
  "PO_APPROVAL",
  "REQUISITION_STATUS",
  "CYCLE_COUNT_REMINDER",
  "EXPIRING_BATCH",
  "ORDER_READY",
  "SYSTEM",
];

// Event types that trigger notifications
const eventTypes = [
  "LOW_STOCK",
  "PO_APPROVAL_NEEDED",
  "REQUISITION_STATUS_CHANGE",
  "EXPIRING_BATCH",
  "CYCLE_COUNT_REMINDER",
  "ORDER_READY",
  "SYSTEM",
];

// Arbitraries for generating test data
const validNotificationTypeArb = fc.constantFrom(...validNotificationTypes);
const eventTypeArb = fc.constantFrom(...eventTypes);
const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);
const uuidArb = fc.uuid();

// Arbitrary for empty/whitespace strings
const emptyOrWhitespaceArb = fc.oneof(
  fc.constant(''),
  fc.constant('   '),
  fc.constant('\t'),
  fc.constant('\n'),
  fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 0, maxLength: 5 }).map(arr => arr.join(''))
);

// Arbitrary for valid notification context
const validNotificationContextArb = fc.record({
  userId: uuidArb,
  type: validNotificationTypeArb.map(t => t as string),
  title: nonEmptyStringArb,
  message: nonEmptyStringArb,
});

describe('Property 20: Notification Creation on Events', () => {
  /**
   * Property 20.1: Valid notification entries pass validation
   * 
   * For any notification with valid userId, type, title, and message,
   * the creation validation SHALL pass
   */
  it('should accept notifications with all required fields', () => {
    fc.assert(
      fc.property(
        validNotificationContextArb,
        (context: NotificationContext) => {
          const result = validateNotificationCreationPure(context);
          
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 20.2: Missing userId fails validation
   * 
   * For any notification with empty or missing userId,
   * the creation validation SHALL fail
   */
  it('should reject notifications with missing or empty userId', () => {
    fc.assert(
      fc.property(
        emptyOrWhitespaceArb,
        validNotificationTypeArb,
        nonEmptyStringArb,
        nonEmptyStringArb,
        (userId: string, type: NotificationType, title: string, message: string) => {
          const context: NotificationContext = {
            userId,
            type,
            title,
            message,
          };
          
          const result = validateNotificationCreationPure(context);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('User ID');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 20.3: Missing type fails validation
   * 
   * For any notification with empty or missing type,
   * the creation validation SHALL fail
   */
  it('should reject notifications with missing or empty type', () => {
    fc.assert(
      fc.property(
        uuidArb,
        emptyOrWhitespaceArb,
        nonEmptyStringArb,
        nonEmptyStringArb,
        (userId: string, type: string, title: string, message: string) => {
          const context: NotificationContext = {
            userId,
            type,
            title,
            message,
          };
          
          const result = validateNotificationCreationPure(context);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('type');
        }
      ),
      { numRuns: 100 }
    );
  });


  /**
   * Property 20.4: Missing title fails validation
   * 
   * For any notification with empty or missing title,
   * the creation validation SHALL fail
   */
  it('should reject notifications with missing or empty title', () => {
    fc.assert(
      fc.property(
        uuidArb,
        validNotificationTypeArb,
        emptyOrWhitespaceArb,
        nonEmptyStringArb,
        (userId: string, type: NotificationType, title: string, message: string) => {
          const context: NotificationContext = {
            userId,
            type,
            title,
            message,
          };
          
          const result = validateNotificationCreationPure(context);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('Title');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 20.5: Missing message fails validation
   * 
   * For any notification with empty or missing message,
   * the creation validation SHALL fail
   */
  it('should reject notifications with missing or empty message', () => {
    fc.assert(
      fc.property(
        uuidArb,
        validNotificationTypeArb,
        nonEmptyStringArb,
        emptyOrWhitespaceArb,
        (userId: string, type: NotificationType, title: string, message: string) => {
          const context: NotificationContext = {
            userId,
            type,
            title,
            message,
          };
          
          const result = validateNotificationCreationPure(context);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('Message');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 20.6: Validation is deterministic
   * 
   * For any notification context, calling validateNotificationCreationPure twice
   * with the same input SHALL produce the same result
   */
  it('should produce deterministic results for the same input', () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.oneof(uuidArb, emptyOrWhitespaceArb),
          type: fc.oneof(validNotificationTypeArb.map(t => t as string), emptyOrWhitespaceArb),
          title: fc.oneof(nonEmptyStringArb, emptyOrWhitespaceArb),
          message: fc.oneof(nonEmptyStringArb, emptyOrWhitespaceArb),
        }),
        (context: NotificationContext) => {
          const result1 = validateNotificationCreationPure(context);
          const result2 = validateNotificationCreationPure(context);
          
          expect(result1.valid).toBe(result2.valid);
          expect(result1.error).toBe(result2.error);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 20.7: All valid notification types are accepted
   * 
   * For any valid notification type from the defined set, validation SHALL pass
   * (assuming other fields are valid)
   */
  it('should accept all valid notification types', () => {
    fc.assert(
      fc.property(
        uuidArb,
        validNotificationTypeArb,
        nonEmptyStringArb,
        nonEmptyStringArb,
        (userId: string, type: NotificationType, title: string, message: string) => {
          const context: NotificationContext = {
            userId,
            type,
            title,
            message,
          };
          
          const result = validateNotificationCreationPure(context);
          
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 20.8: Event type to notification type mapping is correct
   * 
   * For any event type, the corresponding notification type SHALL be valid
   */
  it('should map event types to correct notification types', () => {
    fc.assert(
      fc.property(
        eventTypeArb,
        (eventType: string) => {
          // Each event type should have at least one valid notification type
          const hasValidMapping = validNotificationTypes.some(
            notificationType => isValidNotificationTypeForEvent(eventType, notificationType)
          );
          
          expect(hasValidMapping).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 20.9: LOW_STOCK event creates LOW_STOCK notification
   * 
   * For any LOW_STOCK event, the notification type SHALL be LOW_STOCK
   */
  it('should map LOW_STOCK event to LOW_STOCK notification type', () => {
    const result = isValidNotificationTypeForEvent("LOW_STOCK", "LOW_STOCK");
    expect(result).toBe(true);
    
    // Other notification types should not be valid for LOW_STOCK event
    const invalidTypes: NotificationType[] = ["PO_APPROVAL", "REQUISITION_STATUS", "EXPIRING_BATCH"];
    invalidTypes.forEach(type => {
      expect(isValidNotificationTypeForEvent("LOW_STOCK", type)).toBe(false);
    });
  });

  /**
   * Property 20.10: PO_APPROVAL_NEEDED event creates PO_APPROVAL notification
   * 
   * For any PO_APPROVAL_NEEDED event, the notification type SHALL be PO_APPROVAL
   */
  it('should map PO_APPROVAL_NEEDED event to PO_APPROVAL notification type', () => {
    const result = isValidNotificationTypeForEvent("PO_APPROVAL_NEEDED", "PO_APPROVAL");
    expect(result).toBe(true);
    
    // Other notification types should not be valid for PO_APPROVAL_NEEDED event
    const invalidTypes: NotificationType[] = ["LOW_STOCK", "REQUISITION_STATUS", "EXPIRING_BATCH"];
    invalidTypes.forEach(type => {
      expect(isValidNotificationTypeForEvent("PO_APPROVAL_NEEDED", type)).toBe(false);
    });
  });

  /**
   * Property 20.11: REQUISITION_STATUS_CHANGE event creates REQUISITION_STATUS notification
   * 
   * For any REQUISITION_STATUS_CHANGE event, the notification type SHALL be REQUISITION_STATUS
   */
  it('should map REQUISITION_STATUS_CHANGE event to REQUISITION_STATUS notification type', () => {
    const result = isValidNotificationTypeForEvent("REQUISITION_STATUS_CHANGE", "REQUISITION_STATUS");
    expect(result).toBe(true);
    
    // Other notification types should not be valid for REQUISITION_STATUS_CHANGE event
    const invalidTypes: NotificationType[] = ["LOW_STOCK", "PO_APPROVAL", "EXPIRING_BATCH"];
    invalidTypes.forEach(type => {
      expect(isValidNotificationTypeForEvent("REQUISITION_STATUS_CHANGE", type)).toBe(false);
    });
  });

  /**
   * Property 20.12: EXPIRING_BATCH event creates EXPIRING_BATCH notification
   * 
   * For any EXPIRING_BATCH event, the notification type SHALL be EXPIRING_BATCH
   */
  it('should map EXPIRING_BATCH event to EXPIRING_BATCH notification type', () => {
    const result = isValidNotificationTypeForEvent("EXPIRING_BATCH", "EXPIRING_BATCH");
    expect(result).toBe(true);
    
    // Other notification types should not be valid for EXPIRING_BATCH event
    const invalidTypes: NotificationType[] = ["LOW_STOCK", "PO_APPROVAL", "REQUISITION_STATUS"];
    invalidTypes.forEach(type => {
      expect(isValidNotificationTypeForEvent("EXPIRING_BATCH", type)).toBe(false);
    });
  });

  /**
   * Property 20.13: Validation order - userId checked first
   * 
   * When multiple fields are invalid, userId validation error should be returned first
   */
  it('should check userId before other fields', () => {
    fc.assert(
      fc.property(
        emptyOrWhitespaceArb,
        emptyOrWhitespaceArb,
        emptyOrWhitespaceArb,
        emptyOrWhitespaceArb,
        (userId: string, type: string, title: string, message: string) => {
          const context: NotificationContext = {
            userId,
            type,
            title,
            message,
          };
          
          const result = validateNotificationCreationPure(context);
          
          expect(result.valid).toBe(false);
          expect(result.error).toContain('User ID');
        }
      ),
      { numRuns: 100 }
    );
  });
});
