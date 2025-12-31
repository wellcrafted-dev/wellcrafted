# Error as Sole Discriminant for Result Type

**Date:** 2025-12-31
**Status:** In Progress

## Problem

The current Result validation has ambiguity around `{ data: null, error: null }`:
- Is it `Ok<null>` or an invalid state?
- Current code has special cases and redundant checks

## Insight

Use `error` as the **sole discriminant**:
- `error === null` → **Ok** (data can be anything, including null)
- `error !== null` → **Err**

This means `{ data: null, error: null }` is always `Ok<null>`, which makes semantic sense: you almost never pass `null` to `Err()`.

## Changes

### 1. `src/standard-schema/result.ts`

**Before:**
```typescript
const isOkVariant = obj.error === null;
const isErrVariant = obj.data === null;

if (isOkVariant && isErrVariant) {
  return { value: { data: null, error: null } as never };
}

if (!isOkVariant && !isErrVariant) {
  return FAILURES.INVALID_RESULT;
}

if (isOkVariant) {
  // validate data
}
// validate error
```

**After:**
```typescript
const isOk = obj.error === null;

if (isOk) {
  // validate data against dataSchema (handles null if schema allows)
} else {
  // Err path - also verify structural constraint
  if (obj.data !== null) {
    return FAILURES.INVALID_RESULT;
  }
  // validate error against errorSchema
}
```

### 2. `src/standard-schema/err.ts`

**Before:**
```typescript
if (obj.data !== null) {
  return FAILURES.EXPECTED_DATA_NULL;
}
```

**After:**
```typescript
if (obj.error === null) {
  return FAILURES.EXPECTED_ERROR_NOT_NULL;
}
if (obj.data !== null) {
  return FAILURES.EXPECTED_DATA_NULL;
}
```

### 3. `src/standard-schema/failures.ts`

Add new failure:
```typescript
EXPECTED_ERROR_NOT_NULL: {
  issues: [{ message: "Expected 'error' to be non-null for Err variant", path: ["error"] }],
},
```

### 4. Tests

Update test expectations:
- `{ data: null, error: null }` with `z.string()` data schema → validation error (null is not string)
- `{ data: null, error: null }` with `z.null()` data schema → valid Ok<null>

## Todo

- [x] Remove special case for both-null in ResultSchema (already done in previous session)
- [ ] Add EXPECTED_ERROR_NOT_NULL failure
- [ ] Update ErrSchema to check error === null first
- [ ] Update tests
- [ ] Run all tests to verify

## Benefits

1. **Simpler mental model**: error is the discriminant, period
2. **Fewer special cases**: no "both null" handling needed
3. **Consistent with core Result**: `isOk` and `isErr` already use this pattern

## Review

### Changes Made

1. **`src/standard-schema/failures.ts`**: Added `EXPECTED_ERROR_NOT_NULL` failure message
2. **`src/standard-schema/err.ts`**: Added check for `error === null` before `data !== null` check
3. **`src/standard-schema/result.ts`**: Simplified discrimination logic
   - Removed `isErrVariant` variable
   - Renamed `isOkVariant` to `isOk`
   - Moved `INVALID_RESULT` check to Err path (only for `data !== null`)
4. **`src/standard-schema/standard-schema.test.ts`**: Updated test expectations
   - Renamed test: "rejects Ok variant (data not null)" → "rejects Ok variant (error is null)"
   - Changed expected error from `EXPECTED_DATA_NULL` to `EXPECTED_ERROR_NOT_NULL`
   - Previous session: changed "handles both data and error being null" to expect validation error

### Summary

The `error` property is now the **sole discriminant** for Result types:
- `error === null` → Ok variant
- `error !== null` → Err variant

This aligns the standard-schema validation with the core Result module's `isOk`/`isErr` functions, which already used this pattern. The change simplifies reasoning about Result types: just check the error field.

### Behavior Changes

| Input | Before | After |
|-------|--------|-------|
| `{ data: null, error: null }` | Special case, returned as-is | Ok path, validates data against schema |
| `{ data: "x", error: null }` | Ok path | Ok path (unchanged) |
| `{ data: null, error: "x" }` | Err path | Err path (unchanged) |
| `{ data: "x", error: "x" }` | `INVALID_RESULT` | Err path, validates error against schema |

The key semantic changes:
1. `{ data: null, error: null }` → `Ok<null>`, validated accordingly
2. `{ data: "x", error: "x" }` → Err (because error !== null), data is ignored

### Additional Simplifications (Second Commit)

Removed all "invalid Result" concept since error is now the sole discriminant:

1. **`src/standard-schema/result.ts`**: Removed `INVALID_RESULT` check
2. **`src/standard-schema/err.ts`**: Removed `EXPECTED_DATA_NULL` check  
3. **`src/result/result.ts`**: Removed `isNeitherNull` check from `isResult()` function
4. **`src/standard-schema/failures.ts`**: Removed unused `EXPECTED_DATA_NULL` and `INVALID_RESULT` messages
5. **Test updated**: "rejects invalid Result (neither null)" → "treats both non-null as Err (error is discriminant)"

The Result type is now simpler:
- Any object with `data` and `error` properties is a valid Result structure
- `error === null` → Ok
- `error !== null` → Err (regardless of data value)
