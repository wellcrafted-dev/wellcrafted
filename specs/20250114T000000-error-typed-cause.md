# Typed Cause Generic for TaggedError

## Problem

Currently, `TaggedError` has a single generic parameter `T` for the name, and the `cause` property is typed as `TaggedError | undefined` (implicitly, since it's optional). This means:

1. The type of `cause` is not tracked at the type level
2. You can't create type-safe error chains where each layer expects a specific error type
3. The type system can't enforce relationships between error types in a chain

## Goal

Modify `TaggedError` to accept two generic parameters:
1. `TName extends string`: The error name (existing)
2. `TCause extends TaggedError | undefined`: The type of the cause error (new)

This will enable:
- Type-safe error chaining where each error knows what type of error caused it
- Better discriminated unions for error handling
- Optional cause (undefined) or typed cause (another TaggedError)

## Design

### Type Signature

```typescript
export type TaggedError<
  TName extends string = string,
  TCause extends TaggedError = TaggedError
> = Readonly<{
  name: TName;
  message: string;
  context?: Record<string, unknown>;
  cause?: TCause;
}>;
```

Key decisions:
- Both generics have defaults: `string` for name (unchanged), `TaggedError` for cause (wide default)
- `cause` remains optional (`cause?:`), but when present, must be of type `TCause`
- When `TCause` is `TaggedError` (the default), it accepts any TaggedError (backward compatible)
- When `TCause` is a specific type like `TaggedError<"NetworkError">`, it enforces that specific type

### Examples

```typescript
// No cause (backward compatible)
type ValidationError = TaggedError<"ValidationError">;
const err1: ValidationError = {
  name: "ValidationError",
  message: "Invalid input"
};

// Specific cause type
type NetworkError = TaggedError<"NetworkError">;
type DatabaseError = TaggedError<"DatabaseError", NetworkError>;
const err2: DatabaseError = {
  name: "DatabaseError",
  message: "Connection failed",
  cause: { name: "NetworkError", message: "Timeout" }
};

// Chained errors
type ServiceError = TaggedError<"ServiceError", DatabaseError>;
const err3: ServiceError = {
  name: "ServiceError",
  message: "Service unavailable",
  cause: {
    name: "DatabaseError",
    message: "Connection failed",
    cause: { name: "NetworkError", message: "Timeout" }
  }
};
```

## Todo Items

- [x] Update `TaggedError` type in `src/error/types.ts` to accept second generic parameter
- [x] Update `createTaggedError` function in `src/error/utils.ts` to support the new generic
- [x] Update `TaggedErrorFactories` type to handle the cause generic
- [x] Update `TaggedErrorWithoutName` helper type
- [x] Test backward compatibility (existing code should still work)
- [x] Update JSDoc examples in both files

## Implementation Notes

### Backward Compatibility

The changes must be backward compatible:
- Existing `TaggedError<"SomeError">` should continue to work
- The default for `TCause` should be `TaggedError` (the widest type)
- Optional `cause?` means code without cause still works

### Factory Function Changes

The `createTaggedError` function might need minimal changes since it doesn't currently handle cause at creation time. The cause is typically added when creating error instances, not when defining the factory.

## Review

### Changes Made

1. **Updated `TaggedError` type** (src/error/types.ts:92-97)
   - Added second generic parameter `TCause extends TaggedError = TaggedError`
   - Changed property from `cause?: TaggedError` to `cause?: TCause`
   - Maintains backward compatibility with default `TaggedError` type

2. **Updated helper types** (src/error/utils.ts)
   - `TaggedErrorWithoutName`: Added `TCause` generic parameter
   - `TaggedErrorFactories`: Added `TCause` generic parameter

3. **Updated `createTaggedError` function** (src/error/utils.ts:162-174)
   - Added `TCause` generic parameter
   - Updated return type and internal types to use `TCause`

4. **Updated JSDoc examples**
   - Added examples showing type-safe error chaining
   - Demonstrated how to use the new typed cause feature
   - Kept existing examples showing backward compatibility

### Testing

Created and ran a test file that verified:
- Old single-generic usage still works: `TaggedError<"ErrorName">`
- New two-generic usage works: `TaggedError<"ErrorName", CauseType>`
- Type safety enforces correct cause types
- Discriminated unions continue to work
- Build completed successfully

### Backward Compatibility

✅ All existing code continues to work without changes
✅ The default generic parameter allows omitting the cause type
✅ The optional `cause?` property means errors without causes still work
✅ Build and manual tests confirm no breaking changes

### Circular Reference Fix

Fixed TypeScript error `Type parameter 'TCause' has a circular default`:
- Changed `TCause extends TaggedError = TaggedError` to `TCause extends TaggedError<string, any> = TaggedError<string, any>`
- This breaks the circular reference by explicitly specifying the generic parameters
- Using `<string, any>` is more precise than `<any, any>` because we know TName must be a string
- Applied fix to all related types: `TaggedError`, `TaggedErrorWithoutName`, `TaggedErrorFactories`, and `createTaggedError`
- Build succeeds with no TypeScript errors

### Documentation Updates

Updated all documentation files to reflect that `cause` is typed as `TaggedError` instead of `unknown`:
- `docs/core/error-system.mdx`
- `docs/getting-started/core-concepts.mdx`
- `README_OG.md`
- `README_MD.md`
- `ERROR_HANDLING_GUIDE.md`

Also updated `context` and `cause` to be consistently marked as optional (`?`) across documentation.
