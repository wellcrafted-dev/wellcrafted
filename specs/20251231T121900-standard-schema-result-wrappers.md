# Standard Schema Result Wrappers

**Created**: 2025-12-31T12:19:00
**Status**: Completed

## Overview

Create helper functions that wrap Standard Schema compliant schemas with wellcrafted's Result pattern (`{ data: T, error: null } | { data: null, error: E }`).

These wrappers are library-agnostic and work with any Standard Schema compliant library (Zod, Valibot, ArkType, etc.) by operating on the `~standard` interface directly.

## Goals

1. **Runtime validation**: Produce actual validation logic for Ok/Err/Result shapes
2. **JSON Schema generation**: Produce JSON Schema representations when input supports it
3. **Capability-preserving**: Output schema has same capabilities as input (validation, jsonSchema, or both)
4. **Library-agnostic**: Works with any StandardSchemaV1/StandardJSONSchemaV1 compliant schema

## API Design

### Functions

```typescript
// Wraps schema for T into schema for { data: T, error: null }
OkSchema<TSchema extends StandardTypedV1>(schema: TSchema): Ok<TSchema>

// Wraps schema for E into schema for { data: null, error: E }
ErrSchema<TSchema extends StandardTypedV1>(schema: TSchema): Err<TSchema>

// Combines data schema + error schema into discriminated union Result
ResultSchema<
  TDataSchema extends StandardTypedV1,
  TErrorSchema extends StandardTypedV1
>(dataSchema: TDataSchema, errorSchema: TErrorSchema): Result<TDataSchema, TErrorSchema>
```

### Type Definitions

```typescript
// Output type for OkSchema - preserves input capabilities
type Ok<TSchema extends StandardTypedV1> = {
  "~standard": {
    version: 1;
    vendor: "wellcrafted";
    types: {
      input: { data: StandardTypedV1.InferInput<TSchema>; error: null };
      output: { data: StandardTypedV1.InferOutput<TSchema>; error: null };
    };
    // validate included if TSchema has validate
    // jsonSchema included if TSchema has jsonSchema
  };
};

// Output type for ErrSchema - preserves input capabilities  
type Err<TSchema extends StandardTypedV1> = {
  "~standard": {
    version: 1;
    vendor: "wellcrafted";
    types: {
      input: { data: null; error: StandardTypedV1.InferInput<TSchema> };
      output: { data: null; error: StandardTypedV1.InferOutput<TSchema> };
    };
  };
};

// Output type for ResultSchema - union of Ok and Err
type Result<TDataSchema extends StandardTypedV1, TErrorSchema extends StandardTypedV1> = {
  "~standard": {
    version: 1;
    vendor: "wellcrafted";
    types: {
      input: 
        | { data: StandardTypedV1.InferInput<TDataSchema>; error: null }
        | { data: null; error: StandardTypedV1.InferInput<TErrorSchema> };
      output:
        | { data: StandardTypedV1.InferOutput<TDataSchema>; error: null }
        | { data: null; error: StandardTypedV1.InferOutput<TErrorSchema> };
    };
  };
};
```

## Runtime Behavior

### OkSchema Validation

```typescript
function validate(value: unknown) {
  // 1. Check value is non-null object
  if (typeof value !== 'object' || value === null) {
    return { issues: [{ message: "Expected object" }] };
  }
  
  // 2. Check has data and error properties
  if (!('data' in value) || !('error' in value)) {
    return { issues: [{ message: "Expected object with 'data' and 'error' properties" }] };
  }
  
  // 3. Check error is null (Ok discriminant)
  if (value.error !== null) {
    return { issues: [{ message: "Expected 'error' to be null for Ok variant" }] };
  }
  
  // 4. Delegate data validation to inner schema
  const innerResult = innerSchema["~standard"].validate(value.data);
  
  // 5. Handle sync/async, wrap result
  // ... (handle Promise case)
  if (innerResult.issues) {
    // Prefix paths with 'data'
    return { issues: innerResult.issues.map(i => ({ 
      ...i, 
      path: ['data', ...(i.path || [])] 
    })) };
  }
  
  return { value: { data: innerResult.value, error: null } };
}
```

### ErrSchema Validation

Same pattern but:
- Check `data === null` (Err discriminant)
- Validate `error` field with inner schema
- Prefix paths with 'error'

### ResultSchema Validation

```typescript
function validate(value: unknown) {
  // 1. Check value is non-null object with data and error
  // ... (same checks)
  
  // 2. Determine variant by discriminant
  if (value.error === null) {
    // Ok variant - delegate to data schema
    const innerResult = dataSchema["~standard"].validate(value.data);
    // ... wrap as Ok
  } else if (value.data === null) {
    // Err variant - delegate to error schema
    const innerResult = errorSchema["~standard"].validate(value.error);
    // ... wrap as Err
  } else {
    // Invalid - neither variant (both non-null)
    return { issues: [{ message: "Invalid Result: exactly one of 'data' or 'error' must be null" }] };
  }
}
```

## JSON Schema Generation

### OkSchema JSON Schema

```json
{
  "type": "object",
  "properties": {
    "data": { /* inner schema's JSON Schema */ },
    "error": { "type": "null" }
  },
  "required": ["data", "error"],
  "additionalProperties": false
}
```

### ErrSchema JSON Schema

```json
{
  "type": "object",
  "properties": {
    "data": { "type": "null" },
    "error": { /* inner schema's JSON Schema */ }
  },
  "required": ["data", "error"],
  "additionalProperties": false
}
```

### ResultSchema JSON Schema

```json
{
  "oneOf": [
    { /* OkSchema JSON Schema */ },
    { /* ErrSchema JSON Schema */ }
  ]
}
```

## File Structure

```
src/standard-schema/
  types.ts       # StandardSchemaV1, StandardJSONSchemaV1 interfaces (copied from spec)
  ok.ts          # OkSchema function + Ok type
  err.ts         # ErrSchema function + Err type
  result.ts      # ResultSchema function + Result type
  index.ts       # Re-exports all
```

## Todo

- [x] Create `src/standard-schema/types.ts` with Standard Schema interfaces
- [x] Create `src/standard-schema/ok.ts` with OkSchema function
- [x] Create `src/standard-schema/err.ts` with ErrSchema function
- [x] Create `src/standard-schema/result.ts` with ResultSchema function
- [x] Create `src/standard-schema/index.ts` with re-exports
- [x] Add tests for validation behavior
- [x] Add tests for JSON Schema generation
- [x] Update package.json exports
- [x] Update tsdown.config.ts to include new entry point

## Open Questions

1. Should we handle async validation (when inner schema returns Promise)?
   - **Proposal**: Yes, preserve async behavior - if inner returns Promise, outer returns Promise

2. Should `additionalProperties: false` be configurable?
   - **Proposal**: Default to false for strictness, could add option later

3. Error message format - should we namespace with "wellcrafted:" prefix?
   - **Proposal**: Keep simple for now, can enhance later

## Review

### Implementation Summary

Successfully implemented Standard Schema Result wrappers with the following files:

1. **`types.ts`** (230 lines): Copied Standard Schema interfaces (StandardTypedV1, StandardSchemaV1, StandardJSONSchemaV1) plus utility functions `hasValidate()` and `hasJsonSchema()` for capability detection.

2. **`ok.ts`** (165 lines): `OkSchema()` function that wraps a schema into `{ data: T, error: null }` structure. Includes validation logic that checks discriminant and delegates to inner schema, plus JSON Schema generation.

3. **`err.ts`** (165 lines): `ErrSchema()` function that wraps a schema into `{ data: null, error: E }` structure. Mirror of OkSchema with inverted discriminant.

4. **`result.ts`** (270 lines): `ResultSchema()` function that combines data and error schemas into a discriminated union. Validation determines variant by checking which field is null.

5. **`index.ts`**: Re-exports all public API.

6. **`standard-schema.test.ts`** (460 lines): 23 tests covering:
   - OkSchema validation (valid, invalid structure, wrong variant, inner errors)
   - ErrSchema validation (valid, wrong variant, inner errors)
   - ResultSchema validation (Ok variant, Err variant, invalid states)
   - JSON Schema generation for all three
   - Capability preservation (validate-only schemas don't get jsonSchema)
   - Type inference verification

### Key Design Decisions

1. **Capability preservation**: Output schema only includes `validate` if input has it; same for `jsonSchema`. This allows wrapping validation-only schemas without runtime errors.

2. **Path prefixing**: Inner schema validation errors get their paths prefixed with `data` or `error` to indicate location in the Result structure.

3. **Async support**: When inner schema's validate returns a Promise, the wrapper preserves this and returns a Promise as well.

4. **Edge case handling**: `{ data: null, error: null }` is treated as valid (Ok with null data value), matching wellcrafted's existing Result semantics.

### Test Results

All 100 tests pass (23 new + 77 existing).
