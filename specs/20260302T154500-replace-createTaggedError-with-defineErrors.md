# Spec: Replace `createTaggedError` with `defineErrors`

## Context

The current `createTaggedError` builder API in `wellcrafted` (v0.32.0) has accumulated design problems:

1. **`.withFields<T>()` is a phantom runtime call** — purely type-level, disguised as fluent API
2. **`type X = ReturnType<typeof X>` boilerplate** at every definition site
3. **`fields` + `message` is an artificial split** — in reality, the message is just one of the output fields. Rust's `thiserror` and Effect's `TaggedError` both treat message as derived from data, not a separate concept.
4. **Builder chain is ceremonious** — 3 indirection layers to produce what is conceptually a constructor function
5. **Four "modes"** (bare, fields-only, message-only, fields+message) that are really just different shapes of the same thing: input → output

## Target repository

`wellcrafted` — the wellcrafted library. Breaking change (pre-1.0, minor version bump).

## Core insight

Every error definition is just a **constructor function**: take input, produce an error object. The `fields` vs `message` distinction is artificial. There is no need for modes. There is only:

```
(input) → { message, ...data }
```

`defineErrors` stamps `name` from the key. That's it.

## API Design

### `defineErrors` — errors are constructor functions

```typescript
import { defineErrors, type InferError, type InferErrorUnion } from 'wellcrafted/error';
```

Each key is an error name (must end in `Error`). Each value is a **constructor function** that takes input and returns the error body. `defineErrors` auto-stamps `name` from the key and generates both a plain factory (`FooError`) and an `Err`-wrapped factory (`FooErr`).

```typescript
const httpErrors = defineErrors({
  ConnectionError: ({ cause }: { cause: string }) => ({
    message: `Failed to connect to the server: ${cause}`,
    cause,
  }),

  ResponseError: ({ status, bodyMessage }: { status: number; bodyMessage?: string }) => ({
    message: bodyMessage ? `HTTP ${status}: ${bodyMessage}` : `HTTP ${status} response`,
    status,
    bodyMessage,
  }),

  ParseError: ({ cause }: { cause: string }) => ({
    message: `Failed to parse response body: ${cause}`,
    cause,
  }),
});

// Destructure factories
export const {
  ConnectionError, ConnectionErr,
  ResponseError, ResponseErr,
  ParseError, ParseErr,
} = httpErrors;

// Type extraction
export type ConnectionError = InferError<typeof httpErrors, 'ConnectionError'>;
export type ResponseError = InferError<typeof httpErrors, 'ResponseError'>;
export type ParseError = InferError<typeof httpErrors, 'ParseError'>;
export type HttpServiceError = InferErrorUnion<typeof httpErrors>;
```

### What `defineErrors` does at runtime

For each key `FooError` with constructor `fn`:

1. Creates `FooError(input)` → calls `fn(input)`, stamps `name: 'FooError'`, freezes, returns
2. Creates `FooErr(input)` → calls `FooError(input)`, wraps in `Err()`

That's the entire runtime. ~15 lines of implementation.

### Every pattern, one abstraction

There are no "modes". Every previous mode is just a different function shape:

```typescript
const errors = defineErrors({
  // Static message, no input → zero-arg factory
  RecorderBusyError: () => ({
    message: 'A recording is already in progress',
  }),

  // Computed message from fields
  ServiceError: ({ operation, cause }: {
    operation: 'check' | 'enable' | 'disable';
    cause: string;
  }) => ({
    message: `Failed to ${operation}: ${cause}`,
    operation,
    cause,
  }),

  // Message at call site (caller provides it as input)
  DbServiceError: ({ message }: { message: string }) => ({
    message,
  }),

  // Fields + call-site message
  OperationError: ({ operation, message }: {
    operation: string;
    message: string;
  }) => ({
    message,
    operation,
  }),

  // Complex switch-based message
  InvalidInputError: (input: {
    reason: 'invalid_format' | 'missing_field' | 'type_mismatch';
    detail?: string;
  }) => {
    const messages = {
      invalid_format: `Invalid format: '${input.detail}'`,
      missing_field: 'Required field is missing',
      type_mismatch: `Type mismatch: ${input.detail}`,
    } as const;
    return { message: messages[input.reason], ...input };
  },
});
```

No modes. No `withFields`. No `withMessage`. No phantom type calls. Just functions.

### Call sites do NOT change

Factory signatures are identical to the current API:

```typescript
// These are unchanged:
ServiceErr({ operation: 'check', cause: extractErrorMessage(error) })
ResponseErr({ status: 404 })
DbServiceErr({ message: 'Failed to insert recording' })
```

## Why `message` should remain required

The existing type system depends on it:

- `AnyTaggedError = { name: string; message: string }` — the base type for all errors
- `TaggedError<TName, TFields> = Readonly<{ name: TName; message: string } & TFields>` — the output type
- Pattern matching everywhere: `if (error) toast(error.message)`
- Serialization/logging assumes `message` exists

Dropping `message` would break structural assignability to `AnyTaggedError` and every consumer that reads `error.message`. All current errors have `message`. It's the human-readable representation — every error needs to be displayable.

**Enforcement**: The constructor function's return type must include `message: string`. This is enforced at the type level — if you forget `message`, it's a compile error.

## Decision: Keys require the `Error` suffix

**Decided**: Option A. Keys must match `` `${string}Error` ``. Enables auto-generation of `FooErr` variant by replacing `Error` → `Err`. Consistent with TypeScript ecosystem (`TypeError`, `RangeError`, etc.).

```typescript
// ✅ Works
defineErrors({ ConnectionError: ... })
// Produces: ConnectionError + ConnectionErr

// ❌ Compile error
defineErrors({ NotFound: ... })
```

## Type machinery

```typescript
// --- Constraints ---

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = Record<string, JsonValue>;

/** Constructor return must include message and be JSON-serializable. name is reserved. */
type ErrorBody = { message: string; name?: never } & JsonObject;

/** The config: each key is an error name, each value is a constructor function */
type ErrorsConfig = Record<`${string}Error`, (...args: any[]) => ErrorBody>;

// --- Name transform ---

type ReplaceErrorWithErr<T extends `${string}Error`> =
  T extends `${infer TBase}Error` ? `${TBase}Err` : never;

// --- Return type ---

type FactoryPair<TName extends `${string}Error`, TFn extends (...args: any[]) => ErrorBody> = {
  [K in TName]: (...args: Parameters<TFn>) => Readonly<{ name: TName } & ReturnType<TFn>>;
} & {
  [K in ReplaceErrorWithErr<TName>]: (...args: Parameters<TFn>) => Err<Readonly<{ name: TName } & ReturnType<TFn>>>;
};

type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

type DefineErrorsReturn<TConfig extends ErrorsConfig> = UnionToIntersection<
  {
    [K in keyof TConfig & `${string}Error`]:
      FactoryPair<K & `${string}Error`, TConfig[K]>;
  }[keyof TConfig & `${string}Error`]
>;

// --- Utility types ---

/** Extract a single error type by name from a defineErrors return */
type InferError<T, K extends string> =
  K extends keyof T
    ? T[K] extends (...args: any[]) => infer R ? R : never
    : never;

/** Extract union of ALL error types from a defineErrors return */
type InferErrorUnion<T> = {
  [K in keyof T as K extends `${string}Error` ? K : never]:
    T[K] extends (...args: any[]) => infer R ? R : never;
}[keyof T & `${string}Error`];
```

### Key simplification

Notice: **one `FactoryPair` type replaces `SealedFactoryPair` + `UnsealedFactoryPair`**. There are no modes to distinguish. The factory's input/output types are entirely determined by the constructor function the user provides. TypeScript infers everything from the function signature.

The `IsInputOptional` check is also gone. If the user writes `() => ({ message: '...' })`, the factory takes zero args. If they write `(input: { status: number }) => ...`, the factory takes `{ status: number }`. TypeScript handles this naturally via `Parameters<TFn>`.

## Runtime implementation

```typescript
import { Err } from '../result/result.js';
import type { ErrorBody, ErrorsConfig, DefineErrorsReturn } from './types.js';

export function defineErrors<const TConfig extends ErrorsConfig>(
  config: TConfig,
): DefineErrorsReturn<TConfig> {
  const result: Record<string, unknown> = {};

  for (const [name, constructor] of Object.entries(config)) {
    const errName = name.replace(/Error$/, 'Err');

    const factory = (...args: unknown[]) => {
      const body = (constructor as Function)(...args);
      return Object.freeze({ name, ...body });
    };

    result[name] = factory;
    result[errName] = (...args: unknown[]) => Err(factory(...args));
  }

  return result as DefineErrorsReturn<TConfig>;
}
```

That's the entire implementation. ~12 lines. Compare to the current 60-line builder with `createBuilder`, `sealedErrorConstructor`, `errConstructor`, `withFields`, `withMessage`.

## What changes in `wellcrafted/error` exports

| Export | Status |
|--------|--------|
| `defineErrors` | **NEW** — replaces `createTaggedError` |
| `InferError<T, K>` | **NEW** — extract single error type |
| `InferErrorUnion<T>` | **NEW** — extract error union type |
| `createTaggedError` | **REMOVED** |
| `TaggedError<TName, TFields>` | **REMOVED** — replaced by `InferError` |
| `AnyTaggedError` | Unchanged — `{ name: string; message: string }` remains the base constraint |
| `JsonValue`, `JsonObject` | Unchanged |
| `extractErrorMessage` | Unchanged |

## Comparison: old vs new

### Definition site

```typescript
// OLD: builder chain + phantom type + mode selection
const { ServiceError, ServiceErr } = createTaggedError('ServiceError')
  .withFields<{ operation: 'check' | 'enable' | 'disable'; cause: string }>()
  .withMessage(({ operation, cause }) => `Failed to ${operation}: ${cause}`);
export type ServiceError = ReturnType<typeof ServiceError>;

// NEW: just a function
const serviceErrors = defineErrors({
  ServiceError: ({ operation, cause }: {
    operation: 'check' | 'enable' | 'disable';
    cause: string;
  }) => ({
    message: `Failed to ${operation}: ${cause}`,
    operation,
    cause,
  }),
});
export const { ServiceError, ServiceErr } = serviceErrors;
export type ServiceError = InferError<typeof serviceErrors, 'ServiceError'>;
```

### What changed

| Aspect | Old | New |
|--------|-----|-----|
| Abstraction | Builder chain with modes | Plain function |
| Phantom types | `.withFields<T>()` | None — input type inferred from function param |
| Message derivation | Separate `.withMessage()` step | Part of the function body |
| Type extraction | `ReturnType<typeof FooError>` | `InferError<typeof errors, 'FooError'>` |
| Union types | Manual: `A \| B \| C` | `InferErrorUnion<typeof errors>` |
| Modes | 4 distinct modes | None — just different function shapes |
| Runtime lines | ~60 | ~12 |
| Input/output control | Framework controls output shape | User controls output shape |
| `name` | Stamped by builder | Stamped by `defineErrors` from key |

### Tradeoff: field repetition

The function approach requires listing input fields in the return when you want them on the error object:

```typescript
// Input 'cause' must be explicitly included in the return
ConnectionError: ({ cause }: { cause: string }) => ({
  message: `Failed to connect: ${cause}`,
  cause,  // ← must repeat
}),
```

This is a conscious tradeoff. `...input` spread works for the common case:

```typescript
InvalidInputError: (input: { reason: string; detail?: string }) => ({
  message: messages[input.reason],
  ...input,  // ← spread all input fields onto output
}),
```

The repetition is the price of full control over the output shape. The old `withFields` hid this but at the cost of phantom types and mode complexity.

## Implementation plan

### Step 1: Create `src/error/defineErrors.ts` ✅
~12-line runtime implementation. Done.

### Step 2: Add type machinery to `src/error/types.ts` ✅
`ErrorBody`, `ErrorsConfig`, `FactoryPair`, `DefineErrorsReturn`, `InferError`, `InferErrorUnion`. Done. Removed old `TaggedError` type (replaced by `InferError`).

### Step 3: Port tests → `src/error/defineErrors.test.ts` ✅
Port all existing tests (36 tests pass). Added new tests for:
- Mixed function shapes in one `defineErrors` call
- `InferError` and `InferErrorUnion` type extraction
- Zero-arg factories
- Functions with block bodies and complex logic (switch-based, spread)
- `AnyTaggedError` assignability
- Frozen/immutable error objects

### Step 4: Update `src/error/index.ts` ✅
Export `defineErrors`, `InferError`, `InferErrorUnion` alongside existing exports. Old exports remain until Wave 3 cleanup.

### Step 5: Move `extractErrorMessage` out of `utils.ts` ✅
Moved to `src/error/extractErrorMessage.ts`.

### Step 6: Delete old code ✅
Deleted `utils.ts` (contained `createTaggedError` builder) and `createTaggedError.test.ts`.

### Step 7: Update docs
README, ERROR_HANDLING_GUIDE.md, all docs/ referencing old API.

## Critical files

| File | Action |
|------|--------|
| `src/error/utils.ts` | Remove `createTaggedError`, keep `extractErrorMessage` |
| `src/error/types.ts` | Add `ErrorBody`, `ErrorsConfig`, `FactoryPair`, `DefineErrorsReturn`, `InferError`, `InferErrorUnion` |
| `src/error/index.ts` | Update exports |
| `src/error/createTaggedError.test.ts` | Delete (replace with new tests) |
| `src/result/result.ts` | No changes (dependency: `Err` constructor) |

## Verification

1. `bun test` — all ported + new tests pass
2. `bun run typecheck` — no type errors
3. Build succeeds: `bun run build`
4. Type-test: `expectTypeOf` assertions for all function shapes
5. Verify: define all real-world errors with the new API in a scratch file to confirm inference
