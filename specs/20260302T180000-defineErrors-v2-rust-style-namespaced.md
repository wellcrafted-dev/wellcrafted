# Spec: `defineErrors` v2 — Rust-style Namespaced Errors with Err-by-Default

**Status**: Implemented

**Supersedes**: `20260302T154500-replace-createTaggedError-with-defineErrors.md` (the v1 design)

## Context

The v1 `defineErrors` design required keys ending in `Error`, generated dual factories (`FooError` + `FooErr`), and encouraged destructuring. After reviewing the API surface, three insights emerged:

1. **Rust's `thiserror` pattern is better** — `enum HttpError { Connection, Response, Parse }` uses short variant names under a singular namespace. The enum name provides context; the variant name is just the discriminant.
2. **`Err` wrapping is the 90% use case** — `trySync`/`tryAsync` `catch` handlers expect `Err<E>`. Dual factories add complexity for a rare use case (plain error objects).
3. **TypeScript allows value/type name sharing** — `const HttpError` and `type HttpError` coexist naturally, just like `class` declarations.

## API Design

### Definition

```typescript
import { defineErrors, type InferError, type InferErrors } from 'wellcrafted/error';

const HttpError = defineErrors({
  Connection: ({ cause }: { cause: string }) => ({
    message: `Failed to connect: ${cause}`,
    cause,
  }),

  Response: ({ status }: { status: number; bodyMessage?: string }) => ({
    message: `HTTP ${status}`,
    status,
  }),

  Parse: ({ cause }: { cause: string }) => ({
    message: `Failed to parse response body: ${cause}`,
    cause,
  }),
});

// Value and type share the same name (like class declarations)
type HttpError = InferErrors<typeof HttpError>;

// Individual error types extracted from the factory directly
type ConnectionError = InferError<typeof HttpError.Connection>;
type ResponseError = InferError<typeof HttpError.Response>;
```

### Call sites

```typescript
// trySync/tryAsync — the primary use case. No Err() wrapping needed.
const result = trySync({
  try: () => JSON.parse(input),
  catch: () => HttpError.Parse({ cause: 'invalid json' }),
});

// Direct construction — returns Err<...>
const err = HttpError.Connection({ cause: 'timeout' });

// Accessing the plain error when needed (rare)
const plainError = HttpError.Connection({ cause: 'timeout' }).error;

// Discrimination
if (result.error.name === 'Connection') { ... }

// Type annotation
function handle(error: HttpError) { ... }
```

### Every pattern, one abstraction

No modes. Just different function shapes:

```typescript
const RecordingError = defineErrors({
  // Static message, zero-arg
  Busy: () => ({
    message: 'A recording is already in progress',
  }),

  // Computed message from fields
  Service: ({ operation, cause }: {
    operation: 'check' | 'enable' | 'disable';
    cause: string;
  }) => ({
    message: `Failed to ${operation}: ${cause}`,
    operation,
    cause,
  }),

  // Message at call site
  Unknown: ({ message }: { message: string }) => ({
    message,
  }),

  // Fields + call-site message
  Operation: ({ operation, message }: {
    operation: string;
    message: string;
  }) => ({
    message,
    operation,
  }),
});
```

## Constraints and Compile-Time Feedback

### `message` is required

The constructor return type must include `message: string`. Omitting it is a compile error:

```typescript
defineErrors({
  Bad: () => ({ cause: 'x' }),
  //          ^^^^^^^^^^^^^^ Property 'message' is missing in type '{ cause: string }'
  //                         but required in type 'ErrorBody'.
});
```

TypeScript's native error message is clear enough here — "message is missing" is unambiguous.

### `name` is reserved — descriptive error shows the computed name

If a user provides `name` in the return object, they see a descriptive string literal error that tells them exactly what the `name` will be auto-stamped as:

```typescript
// ErrorBody stays simple — no name knowledge needed
type ErrorBody = { message: string };

// Validation happens at the config level, parameterized by key
type ValidateErrorBody<K extends string> = {
  message: string;
  name?: `The 'name' key is reserved as '${K}'. Remove it.`;
};
```

When a user writes:

```typescript
defineErrors({
  Connection: ({ cause }) => ({
    name: cause,   // ← TypeScript error on hover:
    //   Type 'string' is not assignable to type
    //   "The 'name' key is reserved as 'Connection'. Remove it."
    message: `Failed: ${cause}`,
    cause,
  }),
});
```

### Errors are always `Readonly`

All error objects are `Object.freeze`d at runtime and `Readonly<...>` at the type level. This is automatic — the user doesn't need to think about it.

### JSON serializability

JSON serializability is a convention, not enforced at the type level. The previous `& JsonObject` constraint broke when optional fields produced `T | undefined` (which doesn't satisfy `JsonObject`). Users should use JSON-serializable values by convention.

## Type Machinery

```typescript
// --- Constraints ---

/** Constructor return must include `message: string`. */
type ErrorBody = { message: string };

/** Per-key validation: tells the user exactly what `name` will be stamped as. */
type ValidateErrorBody<K extends string> = {
  message: string;
  name?: `The 'name' key is reserved as '${K}'. Remove it.`;
};

/** Config: each key is a variant name, each value is a constructor function. */
type ErrorsConfig = Record<string, (...args: any[]) => ErrorBody>;

/** Validates each config entry, injecting the key-specific `name` reservation message. */
type ValidatedConfig<T extends ErrorsConfig> = {
  [K in keyof T & string]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => R & ValidateErrorBody<K>
    : T[K];
};

// --- Return type ---

/** Single factory: returns Err-wrapped error. */
type ErrorFactory<
  TName extends string,
  TFn extends (...args: any[]) => ErrorBody,
> = {
  [K in TName]: (
    ...args: Parameters<TFn>
  ) => Err<Readonly<{ name: TName } & ReturnType<TFn>>>;
};

type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

/** Return type of `defineErrors`. Maps each config key to its factory. */
type DefineErrorsReturn<TConfig extends ErrorsConfig> = UnionToIntersection<
  {
    [K in keyof TConfig & string]: ErrorFactory<K, TConfig[K]>;
  }[keyof TConfig & string]
>;

// --- Utility types ---

/** Extract the error type from a single factory. */
type InferError<T> =
  T extends (...args: any[]) => Err<infer R> ? R : never;

/** Extract union of ALL error types from a defineErrors return. */
type InferErrors<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => Err<infer R> ? R : never;
}[keyof T];
```

### Key simplifications from v1

| v1 | v2 | Why |
|---|---|---|
| `FactoryPair` (plain + Err) | `ErrorFactory` (Err only) | One factory per key, not two |
| `ReplaceErrorWithErr` suffix transform | Removed | No `*Err` companion factories |
| `${string}Error` key constraint | `string` | Short variant names |
| `InferError<T, K>` (group + key) | `InferError<T>` (factory directly) | `typeof HttpError.Connection` is cleaner |
| `InferErrorUnion<T>` | `InferErrors<T>` (plural) | Simpler name, no suffix filtering needed |

## Runtime Implementation

```typescript
import { Err } from '../result/result.js';
import type { DefineErrorsReturn, ErrorsConfig } from './types.js';

export function defineErrors<const TConfig extends ErrorsConfig>(
  config: TConfig & ValidatedConfig<TConfig>,
): DefineErrorsReturn<TConfig> {
  const result: Record<string, unknown> = {};

  for (const [name, ctor] of Object.entries(config)) {
    result[name] = (...args: unknown[]) => {
      const body = (ctor as (...a: unknown[]) => Record<string, unknown>)(...args);
      return Err(Object.freeze({ ...body, name }));
    };
  }

  return result as DefineErrorsReturn<TConfig>;
}
```

~10 lines. Down from ~15 in v1, ~60 in the original builder.

## What changes in `wellcrafted/error` exports

| Export | Status |
|--------|--------|
| `defineErrors` | **CHANGED** — factories now return `Err<...>` directly |
| `InferError<T>` | **CHANGED** — takes a single factory, not `<T, K>` |
| `InferErrors<T>` | **NEW** — replaces `InferErrorUnion<T>` |
| `InferErrorUnion<T>` | **REMOVED** — replaced by `InferErrors<T>` |
| `AnyTaggedError` | Unchanged — `{ name: string; message: string }` |
| `ErrorBody` | Unchanged — `{ message: string }` |
| `JsonValue`, `JsonObject` | Unchanged |
| `extractErrorMessage` | Unchanged |

## Lineage: Rust's `thiserror` → Wellcrafted's `defineErrors`

The v2 design traces directly to how Rust's `thiserror` crate works. Here's the same `HttpError` type expressed in both:

### Rust with `thiserror`

```rust
use thiserror::Error;

#[derive(Error, Debug)]
enum HttpError {
    #[error("Failed to connect: {cause}")]
    Connection { cause: String },

    #[error("HTTP {status}")]
    Response { status: u16, body_message: Option<String> },

    #[error("Failed to parse response body: {cause}")]
    Parse { cause: String },
}
```

### TypeScript with `defineErrors`

```typescript
const HttpError = defineErrors({
  Connection: ({ cause }: { cause: string }) => ({
    message: `Failed to connect: ${cause}`,
    cause,
  }),

  Response: ({ status }: { status: number; bodyMessage?: string }) => ({
    message: `HTTP ${status}`,
    status,
  }),

  Parse: ({ cause }: { cause: string }) => ({
    message: `Failed to parse response body: ${cause}`,
    cause,
  }),
});

type HttpError = InferErrors<typeof HttpError>;
```

### What maps 1:1

| Rust concept | TypeScript equivalent | Notes |
|---|---|---|
| `enum HttpError` | `const HttpError = defineErrors(...)` | The namespace. Both use a singular noun. |
| `Connection { cause: String }` | `Connection: ({ cause }) => (...)` | Variant name + fields. Short names, no `Error` suffix. |
| `#[error("Failed: {cause}")]` | `message: \`Failed: ${cause}\`` | Display format / human message. |
| `match error { Connection { .. } => }` | `if (error.name === 'Connection')` | Discrimination by variant name. |
| `HttpError::Connection { cause: "timeout".into() }` | `HttpError.Connection({ cause: "timeout" })` | Construction via namespace. |
| `fn handle(err: HttpError)` | `function handle(err: HttpError)` | Type annotation on the union. |

### What diverges (and why)

| Difference | Rust | TypeScript | Rationale |
|---|---|---|---|
| Construction | Struct literal `HttpError::Connection { cause: "x".into() }` | Factory call `HttpError.Connection({ cause: "x" })` | TS has no struct literals. Functions fill the gap. |
| Message | Compile-time `#[error(...)]` format string | Runtime template literal | TS lacks proc macros. Template literals are the natural equivalent. |
| Return wrapping | Returns the enum directly | Returns `Err<...>` wrapping the error | `trySync`/`tryAsync` expect `Err<E>`. Rust's `?` operator handles this natively. |
| Immutability | Ownership system enforces it | `Object.freeze` + `Readonly<...>` | Different mechanisms, same goal. |
| Pattern matching | `match` with exhaustiveness checking | `switch`/`if` on `error.name` | TS lacks native pattern matching (yet). |

The core insight from Rust: **the enum name is the namespace, the variant name is the discriminant**. `defineErrors` brings this exact model to TypeScript — short variant names under a descriptive namespace, with the namespace doubling as both the constructor object and the union type.

## Comparison: v1 → v2

### Definition site

```typescript
// V1: destructure + explicit type extraction
const httpErrors = defineErrors({
  ConnectionError: ({ cause }: { cause: string }) => ({
    message: `Failed to connect: ${cause}`, cause,
  }),
});
export const { ConnectionError, ConnectionErr } = httpErrors;
export type ConnectionError = InferError<typeof httpErrors, 'ConnectionError'>;
export type HttpServiceError = InferErrorUnion<typeof httpErrors>;

// V2: namespace + value/type name sharing
const HttpError = defineErrors({
  Connection: ({ cause }: { cause: string }) => ({
    message: `Failed to connect: ${cause}`, cause,
  }),
});
type HttpError = InferErrors<typeof HttpError>;
type ConnectionError = InferError<typeof HttpError.Connection>;
```

### Call site

```typescript
// V1: plain factory or Err factory
const err = ConnectionError({ cause: 'timeout' });       // plain
const result = ConnectionErr({ cause: 'timeout' });      // Err<...>

// V2: everything returns Err — namespace access
const result = HttpError.Connection({ cause: 'timeout' }); // Err<...>
```

## Decision Log

| Decision | Choice | Rationale |
|---|---|---|
| Keys | Short variant names (no `Error` suffix) | Mirrors Rust. Namespace provides context. |
| Factory return | Always `Err<...>` | `trySync`/`tryAsync` `catch` handlers expect `Err<E>`. This is the 90% case. |
| `name` stamp | Short key (e.g., `'Connection'`) | `message` is for humans; `name` is for code. Mirrors Rust variant names. |
| `InferError` | `<T>` taking factory directly | `typeof HttpError.Connection` — no string key needed. |
| JSON enforcement | Convention, not type-level | Optional fields break `& JsonObject`. |
| `name` forbidden | Key-specific template literal via `ValidatedConfig` | Shows the computed name (e.g., `'Connection'`) in the error message. |
| `Readonly` | Always, via `Object.freeze` + type | Errors are immutable values. |

## Review

**Completed**: 2026-03-02
**Branch**: braden-w/specs-article

### Summary

Implemented the v2 defineErrors API exactly as specified. Factories now return `Err<...>` directly with short variant names under a namespace. All type machinery (`ValidateErrorBody`, `ValidatedConfig`, `ErrorFactory`, `InferError`, `InferErrors`) implemented as designed. 35 tests pass covering all patterns.

### Deviations from Spec

- None. Implementation matched the spec precisely.

### Follow-up Work

- Update `src/error/README.md` documentation to reflect v2 API
- Update any external docs referencing `InferErrorUnion` or the `FooError`/`FooErr` dual factory pattern
