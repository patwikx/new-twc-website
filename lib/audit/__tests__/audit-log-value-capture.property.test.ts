/**
 * Property-Based Tests for Audit Log Value Capture
 * 
 * Feature: enterprise-gaps
 * Property 17: Audit Log Value Capture
 * 
 * For any update operation, the AuditLog SHALL contain the old values before the update
 * and new values after the update.
 * 
 * **Validates: Requirements 12.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateAuditLogValueCapturePure,
  hasValueChangedPure,
  extractChangedFields,
  createAuditSnapshot,
  AuditLogContext,
  AuditEntityType,
} from '../audit-utils';

// Valid entity types
const validEntityTypes: AuditEntityType[] = [
  "StockItem",
  "StockMovement",
  "StockAdjustment",
  "WasteRecord",
  "PurchaseOrder",
];

const validEntityTypeArb = fc.constantFrom(...validEntityTypes);
const uuidArb = fc.uuid();

// Arbitrary for non-empty record (at least one key-value pair)
const nonEmptyRecordArb = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.jsonValue(),
  { minKeys: 1, maxKeys: 10 }
);

// Arbitrary for empty record
const emptyRecordArb = fc.constant({});

describe('Property 17: Audit Log Value Capture', () => {
  /**
   * Property 17.1: UPDATE actions require both old and new values
   * 
   * For any UPDATE action, validation SHALL fail if oldValues is missing or empty
   */
  it('should reject UPDATE actions without old values', () => {
    fc.assert(
      fc.property(
        validEntityTypeArb,
        uuidArb,
        nonEmptyRecordArb,
        fc.oneof(fc.constant(null), fc.constant(undefined), emptyRecordArb),
        (entityType: string, entityId: string, newValues: Record<string, unknown>, oldValues: Record<string, unknown> | null | undefined) => {
          const context: AuditLogContext = {
            action: "UPDATE",
            entityType,
            entityId,
            oldValues,
            newValues,
          };
          
          const result = validateAuditLogValueCapturePure(context);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('Old values');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17.2: UPDATE actions require new values
   * 
   * For any UPDATE action, validation SHALL fail if newValues is missing or empty
   */
  it('should reject UPDATE actions without new values', () => {
    fc.assert(
      fc.property(
        validEntityTypeArb,
        uuidArb,
        nonEmptyRecordArb,
        fc.oneof(fc.constant(null), fc.constant(undefined), emptyRecordArb),
        (entityType: string, entityId: string, oldValues: Record<string, unknown>, newValues: Record<string, unknown> | null | undefined) => {
          const context: AuditLogContext = {
            action: "UPDATE",
            entityType,
            entityId,
            oldValues,
            newValues,
          };
          
          const result = validateAuditLogValueCapturePure(context);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('values');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17.3: UPDATE actions with both values pass validation
   * 
   * For any UPDATE action with both old and new values present,
   * validation SHALL pass
   */
  it('should accept UPDATE actions with both old and new values', () => {
    fc.assert(
      fc.property(
        validEntityTypeArb,
        uuidArb,
        nonEmptyRecordArb,
        nonEmptyRecordArb,
        (entityType: string, entityId: string, oldValues: Record<string, unknown>, newValues: Record<string, unknown>) => {
          const context: AuditLogContext = {
            action: "UPDATE",
            entityType,
            entityId,
            oldValues,
            newValues,
          };
          
          const result = validateAuditLogValueCapturePure(context);
          
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17.4: CREATE actions require new values
   * 
   * For any CREATE action, validation SHALL fail if newValues is missing or empty
   */
  it('should reject CREATE actions without new values', () => {
    fc.assert(
      fc.property(
        validEntityTypeArb,
        uuidArb,
        fc.oneof(fc.constant(null), fc.constant(undefined), emptyRecordArb),
        (entityType: string, entityId: string, newValues: Record<string, unknown> | null | undefined) => {
          const context: AuditLogContext = {
            action: "CREATE",
            entityType,
            entityId,
            oldValues: null,
            newValues,
          };
          
          const result = validateAuditLogValueCapturePure(context);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('New values');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17.5: CREATE actions with new values pass validation
   * 
   * For any CREATE action with new values present, validation SHALL pass
   */
  it('should accept CREATE actions with new values', () => {
    fc.assert(
      fc.property(
        validEntityTypeArb,
        uuidArb,
        nonEmptyRecordArb,
        (entityType: string, entityId: string, newValues: Record<string, unknown>) => {
          const context: AuditLogContext = {
            action: "CREATE",
            entityType,
            entityId,
            oldValues: null,
            newValues,
          };
          
          const result = validateAuditLogValueCapturePure(context);
          
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17.6: DELETE actions require old values
   * 
   * For any DELETE action, validation SHALL fail if oldValues is missing or empty
   */
  it('should reject DELETE actions without old values', () => {
    fc.assert(
      fc.property(
        validEntityTypeArb,
        uuidArb,
        fc.oneof(fc.constant(null), fc.constant(undefined), emptyRecordArb),
        (entityType: string, entityId: string, oldValues: Record<string, unknown> | null | undefined) => {
          const context: AuditLogContext = {
            action: "DELETE",
            entityType,
            entityId,
            oldValues,
            newValues: null,
          };
          
          const result = validateAuditLogValueCapturePure(context);
          
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
          expect(result.error).toContain('Old values');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17.7: DELETE actions with old values pass validation
   * 
   * For any DELETE action with old values present, validation SHALL pass
   */
  it('should accept DELETE actions with old values', () => {
    fc.assert(
      fc.property(
        validEntityTypeArb,
        uuidArb,
        nonEmptyRecordArb,
        (entityType: string, entityId: string, oldValues: Record<string, unknown>) => {
          const context: AuditLogContext = {
            action: "DELETE",
            entityType,
            entityId,
            oldValues,
            newValues: null,
          };
          
          const result = validateAuditLogValueCapturePure(context);
          
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17.8: Other actions don't require values
   * 
   * For actions other than CREATE, UPDATE, DELETE, validation SHALL pass
   * regardless of old/new values
   */
  it('should accept other actions without value requirements', () => {
    const otherActions = ["APPROVE", "REJECT", "RECEIVE", "TRANSFER", "ADJUST", "WASTE", "VOID", "CANCEL"];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...otherActions),
        validEntityTypeArb,
        uuidArb,
        fc.option(nonEmptyRecordArb, { nil: null }),
        fc.option(nonEmptyRecordArb, { nil: null }),
        (action: string, entityType: string, entityId: string, oldValues: Record<string, unknown> | null, newValues: Record<string, unknown> | null) => {
          const context: AuditLogContext = {
            action,
            entityType,
            entityId,
            oldValues,
            newValues,
          };
          
          const result = validateAuditLogValueCapturePure(context);
          
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Value Change Detection', () => {
  /**
   * Property: Identical objects have no changes
   */
  it('should detect no changes for identical objects', () => {
    fc.assert(
      fc.property(
        nonEmptyRecordArb,
        (obj: Record<string, unknown>) => {
          const result = hasValueChangedPure(obj, obj);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Different objects have changes
   */
  it('should detect changes when values differ', () => {
    fc.assert(
      fc.property(
        fc.record({
          key: fc.string({ minLength: 1, maxLength: 10 }),
          oldValue: fc.string(),
          newValue: fc.string(),
        }).filter(({ oldValue, newValue }) => oldValue !== newValue),
        ({ key, oldValue, newValue }) => {
          const oldObj = { [key]: oldValue };
          const newObj = { [key]: newValue };
          
          const result = hasValueChangedPure(oldObj, newObj);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Null vs undefined are treated as equivalent
   */
  it('should treat null and undefined as equivalent', () => {
    const result1 = hasValueChangedPure(null, undefined);
    const result2 = hasValueChangedPure(undefined, null);
    
    expect(result1).toBe(false);
    expect(result2).toBe(false);
  });
});

describe('Extract Changed Fields', () => {
  /**
   * Property: Identical objects produce empty change sets
   */
  it('should produce empty change sets for identical objects', () => {
    fc.assert(
      fc.property(
        nonEmptyRecordArb,
        (obj: Record<string, unknown>) => {
          const { oldValues, newValues } = extractChangedFields(obj, obj);
          
          expect(Object.keys(oldValues).length).toBe(0);
          expect(Object.keys(newValues).length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Changed fields are captured in both old and new values
   */
  it('should capture changed fields in both old and new values', () => {
    // Filter out special JavaScript property names that can cause issues
    const safeKeyArb = fc.string({ minLength: 1, maxLength: 10 })
      .filter(key => !['__proto__', 'constructor', 'prototype'].includes(key));
    
    fc.assert(
      fc.property(
        safeKeyArb,
        fc.string(),
        fc.string(),
        (key: string, oldValue: string, newValue: string) => {
          // Skip if values are the same
          if (oldValue === newValue) return true;
          
          const oldObj = { [key]: oldValue };
          const newObj = { [key]: newValue };
          
          const { oldValues, newValues } = extractChangedFields(oldObj, newObj);
          
          expect(oldValues[key]).toBe(oldValue);
          expect(newValues[key]).toBe(newValue);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Create Audit Snapshot', () => {
  /**
   * Property: Sensitive fields are excluded
   */
  it('should exclude sensitive fields from snapshot', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        fc.string(),
        (password: string, token: string, secret: string) => {
          const obj = {
            id: "test-id",
            name: "test-name",
            password,
            token,
            secret,
          };
          
          const snapshot = createAuditSnapshot(obj);
          
          expect(snapshot.id).toBe("test-id");
          expect(snapshot.name).toBe("test-name");
          expect(snapshot.password).toBeUndefined();
          expect(snapshot.token).toBeUndefined();
          expect(snapshot.secret).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Date objects are converted to ISO strings
   */
  it('should convert Date objects to ISO strings', () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date("2024-01-01T00:00:00.000Z"),
          max: new Date("2030-12-31T23:59:59.000Z"),
        }),
        (date: Date) => {
          const obj = { createdAt: date };
          const snapshot = createAuditSnapshot(obj);
          
          expect(typeof snapshot.createdAt).toBe('string');
          expect(snapshot.createdAt).toBe(date.toISOString());
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Undefined values are excluded
   */
  it('should exclude undefined values from snapshot', () => {
    const obj = {
      id: "test-id",
      name: undefined,
      value: null,
    };
    
    const snapshot = createAuditSnapshot(obj);
    
    expect(snapshot.id).toBe("test-id");
    expect('name' in snapshot).toBe(false);
    expect(snapshot.value).toBe(null);
  });
});
