/**
 * Property-Based Tests for Audit Log Completeness
 * 
 * Feature: enterprise-gaps
 * Property 16: Audit Log Completeness
 * 
 * For any inventory operation (create, update, delete), an AuditLog record SHALL be created
 * with the correct action, entity type, entity ID, and user ID.
 * 
 * **Validates: Requirements 12.1**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateAuditLogCompletenessPure,
  AuditLogContext,
  AuditAction,
  AuditEntityType,
} from '../audit-utils';

// Valid audit actions
const validActions: AuditAction[] = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "APPROVE",
  "REJECT",
  "RECEIVE",
  "TRANSFER",
  "ADJUST",
  "WASTE",
  "VOID",
  "CANCEL",
];

// Valid entity types
const validEntityTypes: AuditEntityType[] = [
  "StockItem",
  "StockMovement",
  "StockAdjustment",
  "WasteRecord",
  "PurchaseOrder",
  "PurchaseOrderItem",
  "POReceipt",
  "Requisition",
  "CycleCount",
  "Warehouse",
  "Supplier",
  "StockCategory",
  "MenuItem",
  "Recipe",
  "Order",
  "OrderPayment",
  "Shift",
  "User",
  "Role",
];

// Arbitraries for generating test data
const validActionArb = fc.constantFrom(...validActions);
const validEntityTypeArb = fc.constantFrom(...validEntityTypes);
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

// Arbitrary for valid audit log context
const validAuditLogContextArb = fc.record({
  action: validActionArb,
  entityType: validEntityTypeArb,
  entityId: uuidArb,
  oldValues: fc.option(fc.dictionary(fc.string(), fc.jsonValue()), { nil: null }),
  newValues: fc.option(fc.dictionary(fc.string(), fc.jsonValue()), { nil: null }),
});

describe('Property 16: Audit Log Completeness', () => {
  /**
   * Property 16.1: Valid audit log entries pass validation
   * 
   * For any audit log entry with valid action, entityType, and entityId,
   * the completeness validation SHALL pass
   */
  it('should accept audit log entries with all required fields', () => {
    fc.assert(
      fc.property(
        validAuditLogContextArb,
        (context: AuditLogContext) => {
          const result = validateAuditLogCompletenessPure(context);
          
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.2: Missing action fails validation
   * 
   * For any audit log entry with empty or missing action,
   * the completeness validation SHALL fail
   */
  it('should reject audit log entries with missing or empty action', () => {
    fc.assert(
      fc.property(
        emptyOrWhitespaceArb,
        validEntityTypeArb,
        uuidArb,
        (action: string, entityType: string, entityId: string) => {
          const context: AuditLogContext = {
            action,
            entityType,
            entityId,
          };
          
          const result = validateAuditLogCompletenessPure(context);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('Action');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.3: Missing entityType fails validation
   * 
   * For any audit log entry with empty or missing entityType,
   * the completeness validation SHALL fail
   */
  it('should reject audit log entries with missing or empty entityType', () => {
    fc.assert(
      fc.property(
        validActionArb,
        emptyOrWhitespaceArb,
        uuidArb,
        (action: string, entityType: string, entityId: string) => {
          const context: AuditLogContext = {
            action,
            entityType,
            entityId,
          };
          
          const result = validateAuditLogCompletenessPure(context);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('Entity type');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.4: Missing entityId fails validation
   * 
   * For any audit log entry with empty or missing entityId,
   * the completeness validation SHALL fail
   */
  it('should reject audit log entries with missing or empty entityId', () => {
    fc.assert(
      fc.property(
        validActionArb,
        validEntityTypeArb,
        emptyOrWhitespaceArb,
        (action: string, entityType: string, entityId: string) => {
          const context: AuditLogContext = {
            action,
            entityType,
            entityId,
          };
          
          const result = validateAuditLogCompletenessPure(context);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('Entity ID');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.5: Validation is deterministic
   * 
   * For any audit log context, calling validateAuditLogCompletenessPure twice
   * with the same input SHALL produce the same result
   */
  it('should produce deterministic results for the same input', () => {
    fc.assert(
      fc.property(
        fc.record({
          action: fc.oneof(validActionArb, emptyOrWhitespaceArb),
          entityType: fc.oneof(validEntityTypeArb, emptyOrWhitespaceArb),
          entityId: fc.oneof(uuidArb, emptyOrWhitespaceArb),
          oldValues: fc.option(fc.dictionary(fc.string(), fc.jsonValue()), { nil: null }),
          newValues: fc.option(fc.dictionary(fc.string(), fc.jsonValue()), { nil: null }),
        }),
        (context: AuditLogContext) => {
          const result1 = validateAuditLogCompletenessPure(context);
          const result2 = validateAuditLogCompletenessPure(context);
          
          expect(result1.valid).toBe(result2.valid);
          expect(result1.error).toBe(result2.error);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.6: All valid actions are accepted
   * 
   * For any valid action from the defined set, validation SHALL pass
   * (assuming other fields are valid)
   */
  it('should accept all valid action types', () => {
    fc.assert(
      fc.property(
        validActionArb,
        validEntityTypeArb,
        uuidArb,
        (action: string, entityType: string, entityId: string) => {
          const context: AuditLogContext = {
            action,
            entityType,
            entityId,
          };
          
          const result = validateAuditLogCompletenessPure(context);
          
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.7: All valid entity types are accepted
   * 
   * For any valid entity type from the defined set, validation SHALL pass
   * (assuming other fields are valid)
   */
  it('should accept all valid entity types', () => {
    fc.assert(
      fc.property(
        validActionArb,
        validEntityTypeArb,
        uuidArb,
        (action: string, entityType: string, entityId: string) => {
          const context: AuditLogContext = {
            action,
            entityType,
            entityId,
          };
          
          const result = validateAuditLogCompletenessPure(context);
          
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 16.8: Validation order - action checked first
   * 
   * When multiple fields are invalid, action validation error should be returned first
   */
  it('should check action before other fields', () => {
    fc.assert(
      fc.property(
        emptyOrWhitespaceArb,
        emptyOrWhitespaceArb,
        emptyOrWhitespaceArb,
        (action: string, entityType: string, entityId: string) => {
          const context: AuditLogContext = {
            action,
            entityType,
            entityId,
          };
          
          const result = validateAuditLogCompletenessPure(context);
          
          expect(result.valid).toBe(false);
          expect(result.error).toContain('Action');
        }
      ),
      { numRuns: 100 }
    );
  });
});
