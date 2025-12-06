# Fluent Tagged Error API

## Problem

The current `createTaggedError` function uses multiple generics with optional type parameters:

```typescript
createTaggedError<TName, TContext?, TCause?>(name)
```

This works, but has downsides:
- Generic parameters in the middle can't be omitted; you must specify all preceding ones
- The relationship between parameters isn't obvious from the call site
- No discoverability; you need to know the API to use it correctly

## Solution: Fluent Builder API

Replace the generic-heavy API with a fluent builder pattern:

```typescript
// Before
const { FileError, FileErr } = createTaggedError<
  'FileError',
  { path: string; code: 'NOT_FOUND' | 'PERMISSION_DENIED' }
>('FileError')

// After
const { FileError, FileErr } = defineError('FileError')
  .withContext<{ path: string; code: 'NOT_FOUND' | 'PERMISSION_DENIED' }>()
```

## API Design

### `defineError(name)`

Entry point for defining a new tagged error type. Returns a builder with factory methods and optional chaining methods.

```typescript
const { NetworkError, NetworkErr } = defineError('NetworkError')
```

**Default behavior (no chaining):**
- `context` is **optional** and accepts any `Record<string, unknown>`
- `cause` is **optional** and accepts any `AnyTaggedError`

### Optionality via Type Unions

Both `.withContext<T>()` and `.withCause<T>()` use the same pattern to determine optionality:

- **If `T` includes `undefined`** → the key becomes optional (`context?:` or `cause?:`)
- **If `T` does NOT include `undefined`** → the key is required (`context:` or `cause:`)

This leverages TypeScript's type system rather than requiring separate methods for optional vs required variants.

### `.withContext<T>()`

Constrains the context type. Optionality is determined by whether `T` includes `undefined`.

```typescript
// Required context (T doesn't include undefined)
const { ApiError } = defineError('ApiError')
  .withContext<{ endpoint: string; status: number }>()

ApiError({ message: 'Failed' })  // Type error! context is required
ApiError({ message: 'Failed', context: { endpoint: '/users', status: 500 } })  // OK

// Optional context (T includes undefined)
const { LogError } = defineError('LogError')
  .withContext<{ file: string; line: number } | undefined>()

LogError({ message: 'Parse error' })  // OK, context omitted
LogError({ message: 'Parse error', context: { file: 'app.ts', line: 42 } })  // OK, typed
```

**JSDoc:**
```typescript
/**
 * Constrains the context type for this error.
 *
 * Optionality is determined by whether the type includes `undefined`:
 * - `withContext<T>()` where T doesn't include undefined → context is **required**
 * - `withContext<T | undefined>()` → context is **optional** but typed when provided
 *
 * @typeParam T - The shape of the context object. Include `| undefined` to make optional.
 *
 * @example Required context
 * ```ts
 * const { FileError } = defineError('FileError')
 *   .withContext<{ path: string }>()
 *
 * FileError({ message: 'Not found', context: { path: '/etc/config' } })  // OK
 * FileError({ message: 'Not found' })  // Type error: context required
 * ```
 *
 * @example Optional but typed context
 * ```ts
 * const { LogError } = defineError('LogError')
 *   .withContext<{ file: string; line: number } | undefined>()
 *
 * LogError({ message: 'Parse error' })  // OK
 * LogError({ message: 'Parse error', context: { file: 'app.ts', line: 42 } })  // OK
 * ```
 */
withContext<T extends Record<string, unknown> | undefined>(): Builder<TName, T, TCause>
```

### `.withCause<T>()`

Constrains the cause type. Optionality is determined by whether `T` includes `undefined`.

```typescript
// Required cause (rare, for wrapper patterns)
const { UnhandledError } = defineError('UnhandledError')
  .withCause<AnyTaggedError>()

UnhandledError({ message: 'Unexpected' })  // Type error! cause required
UnhandledError({ message: 'Unexpected', cause: someError })  // OK

// Optional but typed cause (common)
const { ServiceError } = defineError('ServiceError')
  .withCause<DbError | CacheError | undefined>()

ServiceError({ message: 'Failed' })  // OK, no cause
ServiceError({ message: 'Failed', cause: dbError })  // OK, typed
ServiceError({ message: 'Failed', cause: networkError })  // Type error: wrong cause type
```

**JSDoc:**
```typescript
/**
 * Constrains the cause type for this error.
 *
 * Optionality is determined by whether the type includes `undefined`:
 * - `withCause<T>()` where T doesn't include undefined → cause is **required**
 * - `withCause<T | undefined>()` → cause is **optional** but typed when provided
 *
 * Since cause is typically optional, include `| undefined` in most cases.
 *
 * @typeParam T - The allowed cause type(s). Include `| undefined` to make optional.
 *
 * @example Optional typed cause (common)
 * ```ts
 * const { ServiceError } = defineError('ServiceError')
 *   .withCause<DbError | CacheError | undefined>()
 *
 * ServiceError({ message: 'Failed' })  // OK
 * ServiceError({ message: 'Failed', cause: dbError })  // OK
 * ```
 *
 * @example Required cause (for wrapper errors)
 * ```ts
 * const { UnhandledError } = defineError('UnhandledError')
 *   .withCause<AnyTaggedError>()
 *
 * UnhandledError({ message: 'Unexpected', cause: originalError })  // OK
 * UnhandledError({ message: 'Unexpected' })  // Type error: cause required
 * ```
 *
 * @example Multiple cause types
 * ```ts
 * const { RepoError } = defineError('RepoError')
 *   .withCause<DbError | CacheError | undefined>()
 * ```
 */
withCause<T extends AnyTaggedError | undefined>(): Builder<TName, TContext, T>
```

## Chaining Order

Methods can be chained in any order:

```typescript
// These are equivalent
defineError('ServiceError')
  .withContext<{ operation: string }>()
  .withCause<DbError>()

defineError('ServiceError')
  .withCause<DbError>()
  .withContext<{ operation: string }>()
```

## Complete Example

```typescript
import { defineError, type TaggedError, type AnyTaggedError } from 'wellcrafted/error'

// Simple error - flexible context and cause (default behavior)
const { NetworkError, NetworkErr } = defineError('NetworkError')

// Error with required context
const { DbError, DbErr } = defineError('DbError')
  .withContext<{ query: string; table: string }>()

// Error with optional typed context
const { LogError, LogErr } = defineError('LogError')
  .withContext<{ file: string; line: number } | undefined>()

// Error with optional typed cause (common pattern)
const { RepoError, RepoErr } = defineError('RepoError')
  .withCause<DbError | undefined>()

// Error with required cause (wrapper pattern)
const { UnhandledError, UnhandledErr } = defineError('UnhandledError')
  .withCause<AnyTaggedError>()

// Error with both required context and optional cause
const { UserServiceError, UserServiceErr } = defineError('UserServiceError')
  .withContext<{ userId: string; action: string }>()
  .withCause<RepoError | NetworkError | undefined>()

// Type extraction works as expected
type UserServiceError = ReturnType<typeof UserServiceError>
```

## Type Implementation

The optionality detection uses a conditional type:

```typescript
type WithContext<T> = undefined extends T
  ? { context?: Exclude<T, undefined> }  // optional when T includes undefined
  : { context: T }                        // required otherwise

type WithCause<T> = undefined extends T
  ? { cause?: Exclude<T, undefined> }
  : { cause: T }
```

`undefined extends T` checks if `undefined` is assignable to `T` (i.e., `T` is a union that includes `undefined`).

## Naming Discussion

### Current: `createTaggedError`

Pros:
- Explicit about what it creates
- "Tagged" indicates discriminated union pattern

Cons:
- Verbose
- "Tagged" is implementation detail users don't need to think about

### Proposed: `defineError`

Pros:
- Concise
- Mirrors common patterns (`defineConfig`, `defineComponent`)
- Focuses on what user is doing: defining an error type
- Reads naturally: "define error called FileError"

Cons:
- Loses "tagged" which hints at the pattern
- Could be confused with native Error

### Alternatives Considered

| Name | Verdict |
|------|---------|
| `declareError` | Similar to `defineError`, slightly more formal |
| `errorFactory` | Describes output, not action |
| `taggedError` | Too similar to the type name |
| `createError` | Conflicts with native Error.constructor semantics |
| `error` | Too generic |

### Recommendation

**`defineError`** - clean, concise, action-oriented.

The "tagged" aspect is an implementation detail. What matters to users is they're defining a new error type with specific characteristics.

## Implementation Notes

The builder pattern should be implemented with proper TypeScript inference so that:

1. Each chaining method returns a new builder with refined types
2. The factories (`XxxError`, `XxxErr`) are available at every stage
3. `ReturnType<typeof XxxError>` correctly infers the full `TaggedError` type
4. IDE autocomplete shows available chaining methods with JSDoc

## Todo

- [x] Implement `defineError` function with builder pattern
- [x] Add comprehensive JSDoc to all builder methods
- [x] Update exports in `src/error/index.ts`
- [x] Deprecate `createTaggedError` (keep for backward compatibility)
- [x] Add tests for the fluent API
- [ ] Update README/documentation

## Review

### Summary

Implemented the fluent `defineError` API as specified. The new API provides a cleaner alternative to `createTaggedError` with the following key features:

1. **Fluent builder pattern**: Chain `.withContext<T>()` and `.withCause<T>()` in any order
2. **Optionality via type unions**: Include `| undefined` in the type to make the property optional
3. **Factories available at every stage**: Can destructure factories immediately or after chaining
4. **Full JSDoc documentation**: All methods have comprehensive examples

### Files Changed

- `src/error/utils.ts`: Added `defineError` function and supporting types (~200 lines)
- `src/error/defineError.test.ts`: Added 16 tests covering all use cases
- `src/error/utils.ts`: Added `@deprecated` tag to `createTaggedError`

### Key Design Decisions

1. **Single mechanism for optionality**: Rather than having separate methods like `withOptionalContext`, the type union approach (`T | undefined`) determines optionality. This is consistent with TypeScript idioms.

2. **Builder returns factories at every stage**: The builder object includes both the chaining methods AND the factories, so users can destructure immediately or continue chaining.

3. **Backward compatibility**: `createTaggedError` is deprecated but still functional for existing code.

### Test Results

All 16 tests pass, covering:
- Basic usage (flexible mode)
- Required context via `.withContext<T>()`
- Optional typed context via `.withContext<T | undefined>()`
- Required cause via `.withCause<T>()`
- Optional typed cause via `.withCause<T | undefined>()`
- Chaining in both orders
- Type extraction with `ReturnType`
- Factories available at every builder stage
