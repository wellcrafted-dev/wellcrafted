# Simplify Tagged Error Types

## Problem

The current `createTaggedError` implementation uses function overloads to provide precise call-site type inference. This works well for constructing errors, but breaks `ReturnType`:

```typescript
const { NetworkError } = createTaggedError('NetworkError');
type NetworkError = ReturnType<typeof NetworkError>;
// Expected: TaggedError<'NetworkError'> with optional context/cause
// Actual: TaggedError<'NetworkError', TContext, TCause> requiring BOTH
```

TypeScript's `ReturnType` picks the last overload, which is the most constrained signature.

## Solution

Simplify to two modes with NO overloads:

1. **Flexible mode** (default): `context` and `cause` are optional, loosely typed
2. **Fixed context mode**: `context` is required with exact type, `cause` is optional
3. **Both fixed mode** (optional): `context` required, `cause` constrained (but still optional at runtime)

Each mode has exactly ONE signature. No overloads.

## API Changes

### Before (Complex)

```typescript
// 4 overloads for flexible mode
type FlexibleErrorConstructor<TName> = {
    (input: { message: string }): TaggedError<TName, never, never>;
    <TContext>(input: { message: string; context: TContext }): TaggedError<TName, TContext, never>;
    <TCause>(input: { message: string; cause: TCause }): TaggedError<TName, never, TCause>;
    <TContext, TCause>(input: { message: string; context: TContext; cause: TCause }): TaggedError<TName, TContext, TCause>;
};
```

### After (Simple)

```typescript
// Single signature for flexible mode
type FlexibleErrorConstructor<TName extends string> = (input: {
    message: string;
    context?: Record<string, unknown>;
    cause?: AnyTaggedError;
}) => TaggedError<TName>;

// Single signature for fixed context mode
type FixedContextErrorConstructor<TName extends string, TContext extends Record<string, unknown>> = (input: {
    message: string;
    context: TContext;
    cause?: AnyTaggedError;
}) => TaggedError<TName, TContext>;

// Single signature for both fixed mode
type BothFixedErrorConstructor<TName extends string, TContext extends Record<string, unknown>, TCause extends AnyTaggedError> = (input: {
    message: string;
    context: TContext;
    cause?: TCause;
}) => TaggedError<TName, TContext, TCause>;
```

## Type Definition Changes

### Before

```typescript
type TaggedError<TName, TContext = never, TCause = never> = Readonly<{
    name: TName;
    message: string;
} & ([TContext] extends [never] ? {} : { context: TContext })
  & ([TCause] extends [never] ? {} : { cause: TCause })>;
```

When `TContext = never`, the `context` property doesn't exist at all.

### After

```typescript
type TaggedError<
    TName extends string,
    TContext extends Record<string, unknown> | undefined = undefined,
    TCause extends AnyTaggedError | undefined = undefined,
> = Readonly<{
    name: TName;
    message: string;
} & (TContext extends undefined
        ? { context?: Record<string, unknown> }
        : { context: TContext })
  & (TCause extends undefined
        ? { cause?: AnyTaggedError }
        : { cause?: TCause })>;
```

When `TContext = undefined` (default), `context` is OPTIONAL with loose type.
When `TContext = SomeType`, `context` is REQUIRED with exact type.

Note: `cause` is always optional at runtime (you can create errors without causes), but when `TCause` is specified, it constrains what types are ALLOWED.

## Usage Examples

### Flexible Mode (Default)

```typescript
const { NetworkError, NetworkErr } = createTaggedError('NetworkError');

// All valid:
NetworkError({ message: 'Failed' });
NetworkError({ message: 'Failed', context: { url: '...' } });
NetworkError({ message: 'Failed', cause: otherError });
NetworkError({ message: 'Failed', context: { url: '...' }, cause: otherError });

// Type annotation works:
type NetworkError = ReturnType<typeof NetworkError>;
// = TaggedError<'NetworkError'> with optional context/cause

function handleError(error: NetworkError) {
    console.log(error.name);  // 'NetworkError'
    if (error.context) {
        console.log(error.context);  // Record<string, unknown>
    }
}
```

### Fixed Context Mode

```typescript
type BlobContext = { filename: string; size: number };
const { BlobError, BlobErr } = createTaggedError<'BlobError', BlobContext>('BlobError');

// Context is REQUIRED:
BlobError({ message: 'Too large', context: { filename: 'test.txt', size: 1000 } });
// BlobError({ message: 'Error' });  // Type error: context is required

// Type annotation:
type BlobError = ReturnType<typeof BlobError>;
// = TaggedError<'BlobError', { filename: string; size: number }>

function handleBlobError(error: BlobError) {
    console.log(error.context.filename);  // Type safe!
}
```

### Both Fixed Mode (Optional, for strict error chaining)

```typescript
type RetryContext = { attempts: number; maxAttempts: number };
const { RetryError } = createTaggedError<'RetryError', RetryContext, NetworkError>('RetryError');

// Context required, cause optional but constrained:
RetryError({ message: 'Retry exhausted', context: { attempts: 3, maxAttempts: 3 } });
RetryError({
    message: 'Retry exhausted',
    context: { attempts: 3, maxAttempts: 3 },
    cause: networkError  // Must be NetworkError type
});
```

## Trade-offs

### What We Lose

In flexible mode, you no longer get precise inference of context shape at call sites:

```typescript
// Before: context inferred as { url: string }
const err = NetworkError({ message: 'x', context: { url: '...' } });
err.context.url;  // Type safe

// After: context is Record<string, unknown>
const err = NetworkError({ message: 'x', context: { url: '...' } });
err.context?.url;  // Type is unknown
```

### What We Gain

1. `ReturnType` works correctly
2. Simpler type definitions (no overloads)
3. Clear mental model: "want typed context? specify the type parameter"
4. Easier to understand and maintain

### Migration Path

Users who relied on call-site context inference should migrate to fixed context mode:

```typescript
// Before (flexible mode with inference)
const { ApiError } = createTaggedError('ApiError');
const err = ApiError({ message: 'x', context: { endpoint: '/users' } });
// err.context.endpoint was typed as string

// After (fixed context mode)
const { ApiError } = createTaggedError<'ApiError', { endpoint: string }>('ApiError');
const err = ApiError({ message: 'x', context: { endpoint: '/users' } });
// err.context.endpoint is still typed as string
```

## Implementation Tasks

- [x] Update `TaggedError` type in `types.ts`
- [x] Update `WithContext` and `WithCause` helper types
- [x] Simplify `FlexibleErrorConstructor` (remove overloads)
- [x] Simplify `FlexibleErrConstructor` (remove overloads)
- [x] Update `ContextFixedErrorConstructor` (single signature)
- [x] Update `ContextFixedErrConstructor` (single signature)
- [x] Keep `BothFixedErrorConstructor` with single signature
- [x] Update `createTaggedError` overloads to match
- [x] Update tests
- [x] Update README/documentation

## Review

### Summary of Changes

**types.ts:**
- Changed `TaggedError` type parameters to default to `undefined` instead of `never`
- Updated `WithContext` helper: when `TContext` is `undefined`, returns `{ context?: Record<string, unknown> }` (optional, loosely typed)
- Updated `WithCause` helper: when `TCause` is `undefined`, returns `{ cause?: AnyTaggedError }` (optional)
- When `TContext`/`TCause` are specified, they become required/constrained as before
- Exported `AnyTaggedError` type for use in utils.ts

**utils.ts:**
- Removed all function overloads from constructor types
- Each constructor type now has a single signature
- Flexible mode: `context` and `cause` are optional with loose typing
- Fixed context mode: `context` is required, `cause` is optional
- Both fixed mode: `context` is required, `cause` is optional but constrained
- Imports `AnyTaggedError` from types.ts

**Tests:**
- Updated type assertions to reflect new behavior
- Added explicit tests for `ReturnType` working correctly
- Fixed deep chain access to use optional chaining and type casts
- Updated complex nested context test to use fixed context mode

**Documentation:**
- Added section on "Type Annotations with ReturnType"
- Updated Quick Reference with type annotation examples

### Breaking Changes

1. **Flexible mode context type**: In flexible mode, `context` is now typed as `Record<string, unknown> | undefined` instead of precisely inferred at call sites. Users who relied on precise inference should migrate to fixed context mode.

2. **cause always optional**: Even in "both fixed" mode, `cause` is optional at runtime (you can create errors without causes). The type constraint only limits what types are allowed when cause IS provided.

### Test Results

All 25 tests pass. TypeScript compilation succeeds.

### Follow-up: Optional Typed Context (Separate Changeset)

After the initial simplification, we added support for "optional but typed" context via union with `undefined`.

**The Pattern:**
```typescript
type LogContext = { file: string; line: number } | undefined;
const { LogError } = createTaggedError<'LogError', LogContext>('LogError');

// Can omit context
LogError({ message: 'Parse failed' });

// But when provided, it's typed
LogError({ message: 'Parse failed', context: { file: 'app.ts', line: 42 } });
```

**Implementation:**
- Updated `WithContext` helper to detect `undefined` in the union: `[undefined] extends [TContext]`
- Uses bracket notation to prevent distributive conditional types
- `Exclude<TContext, undefined>` strips the undefined from the union to get the typed part
- Same pattern applied to `WithCause` for consistency

**New Tests:**
- `optional typed context via union with undefined` - verifies both runtime behavior and compile-time types
- `TaggedError type with optional typed context` - verifies the pattern works directly with the type

**Documentation:**
- Added "Optional Typed Context: Best of Both Worlds" section to README
- Added example to Quick Reference
