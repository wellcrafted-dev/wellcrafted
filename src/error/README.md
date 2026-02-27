# Tagged Errors

Type-safe error handling without throw/catch. Return errors as values with full type inference.

## Why This Folder Exists

Traditional error handling with `throw`/`catch` has a fundamental problem: you lose all type information. When you catch an error, TypeScript gives you `unknown`. You have to manually check types, guess at properties, and hope you didn't miss an error case.

```typescript
try {
  await apiCall();
} catch (error) {
  // What is error? Who knows! TypeScript can't help you.
  if (error.statusCode === 404) { /* hope this property exists */ }
}
```

Tagged errors solve this by treating errors as plain data structures instead of exceptions:

- **Discriminated unions**: Switch on `error.name` and TypeScript narrows the type automatically
- **Explicit in signatures**: `Result<Data, NetworkError | ValidationError>` tells you exactly what can go wrong
- **Flat properties**: All fields live directly on the error object — `error.status`, not `error.context.status`
- **JSON-serializable**: Plain objects that survive serialization without special handling

## The Mental Model

```
┌─────────────────────────────────────────────────────────┐
│ name     →  "What broke?" (for code / switch matching)  │
│ message  →  "What do I tell the user?" (for UI / logs)  │
│ ...rest  →  "What else matters?" (typed per error)      │
└─────────────────────────────────────────────────────────┘
```

## The Fluent API

The `createTaggedError` function provides a chainable builder API with two stages:

- **Builder stage**: Chain `.withFields<T>()` and `.withMessage(fn)` to define the error shape.
- **Factory stage**: After calling `.withMessage(fn)`, you get the factories (`Error` and `Err`).

`.withMessage(fn)` is **required** and **terminal** — it ends the builder chain and produces the factories.

## Three Tiers of Error Complexity

### Tier 1: Static Errors — no fields, no arguments

The error name + template IS the message. Use when there's no dynamic content.

```typescript
const { RecorderBusyError, RecorderBusyErr } = createTaggedError('RecorderBusyError')
  .withMessage(() => 'A recording is already in progress');

RecorderBusyErr();
// → { name: 'RecorderBusyError', message: 'A recording is already in progress' }
```

### Tier 2: Reason-Only — `reason` carries the dynamic context

Use when the only dynamic content is a stringified caught error.

```typescript
const { PlaySoundError, PlaySoundErr } = createTaggedError('PlaySoundError')
  .withFields<{ reason: string }>()
  .withMessage(({ reason }) => `Failed to play sound: ${reason}`);

PlaySoundErr({ reason: extractErrorMessage(error) });
// → { name: 'PlaySoundError', message: 'Failed to play sound: device busy', reason: 'device busy' }
```

### Tier 3: Structured Data — domain-specific fields

Use when there's data worth preserving as named fields that callers branch on.

```typescript
const { ResponseError, ResponseErr } = createTaggedError('ResponseError')
  .withFields<{ status: number; reason?: string }>()
  .withMessage(({ status, reason }) =>
    `HTTP ${status}${reason ? `: ${reason}` : ''}`
  );

ResponseErr({ status: 404 });
// → { name: 'ResponseError', message: 'HTTP 404', status: 404 }

ResponseErr({ status: 500, reason: 'Internal error' });
// → { name: 'ResponseError', message: 'HTTP 500: Internal error', status: 500, reason: 'Internal error' }
```

## Builder vs FinalFactories

The builder (what `createTaggedError()` returns) only has chain methods: `.withFields()`, `.withMessage()`. Factories only exist after `.withMessage()` completes the chain.

```typescript
const builder = createTaggedError('FileError').withFields<{ path: string }>();
// builder.FileError   <- does NOT exist
// builder.withMessage <- exists

const { FileError, FileErr } = builder.withMessage(({ path }) => `Failed: ${path}`);
// FileError  <- exists (creates error object)
// FileErr    <- exists (wraps in Err for Result types)
```

## `.withMessage()` — The Terminal Step

`.withMessage(fn)` is the required final step. The callback receives the fields directly (flat, not nested):

```typescript
const { DbError, DbErr } = createTaggedError('DbError')
  .withFields<{ host: string; port: number }>()
  .withMessage(({ host, port }) => `DB connection failed at ${host}:${port}`);
```

Message is always computed by the template — call sites cannot override it.

```typescript
DbErr({ host: 'localhost', port: 5432 });
// error.message -> "DB connection failed at localhost:5432"
```

## Flat Fields — No Nesting

Fields are spread directly on the error object. Access them as top-level properties:

```typescript
const error = ResponseError({ status: 401, provider: 'openai' });

// Flat — just works
const { status, message } = error;

// Rest spread extracts just the extra fields
const { name, message, ...rest } = error;
// rest = { status: 401, provider: 'openai' }
```

## Reserved Keys

The fields `name` and `message` are reserved — they're part of every tagged error. Attempting to use them in `.withFields()` produces a compile error.

## JSON Serializability

Fields must be JSON-serializable values (`JsonObject`). This ensures errors can round-trip through `JSON.stringify`/`JSON.parse` perfectly:

```typescript
const error = ResponseError({ status: 401, provider: 'openai' });
const parsed = JSON.parse(JSON.stringify(error));
// parsed.status === 401, parsed.provider === 'openai'
```

**Allowed:** strings, numbers, booleans, null, plain objects, arrays of the above.

**Not allowed:** `Date` instances, `Error` instances, class instances, functions, `undefined` values, symbols.

## Cause Is Just Another Field

There's no special `cause` machinery. If an error type needs to carry a cause, it's just another field:

```typescript
const { BackendError } = createTaggedError('BackendError')
  .withFields<{ backend: string; cause: string }>()
  .withMessage(({ backend }) => `${backend} failed`);

BackendError({ backend: 'postgres', cause: 'connection timeout' });
```

## Type Annotations with ReturnType

`ReturnType` works correctly for all tiers:

```typescript
const { NetworkError } = createTaggedError('NetworkError')
  .withMessage(() => 'Network request failed');
type NetworkError = ReturnType<typeof NetworkError>;
// = Readonly<{ name: 'NetworkError'; message: string }>

const { FileError } = createTaggedError('FileError')
  .withFields<{ path: string }>()
  .withMessage(({ path }) => `File not found: ${path}`);
type FileError = ReturnType<typeof FileError>;
// = Readonly<{ name: 'FileError'; message: string; path: string }>

// Use in discriminated union switches
function handleErrors(error: NetworkError | FileError) {
  switch (error.name) {
    case 'NetworkError':
      console.log('Network failed:', error.message);
      break;
    case 'FileError':
      console.log('File failed:', error.path);
      break;
  }
}
```

## Quick Reference

```typescript
import { createTaggedError, type TaggedError, type AnyTaggedError } from 'wellcrafted/error';

// Tier 1: Static — no fields
const { NetworkError, NetworkErr } = createTaggedError('NetworkError')
  .withMessage(() => 'Network request failed');

// Tier 2: Reason — single dynamic field
const { FsServiceError, FsServiceErr } = createTaggedError('FsServiceError')
  .withFields<{ reason: string }>()
  .withMessage(({ reason }) => `File system operation failed: ${reason}`);

// Tier 3: Structured — multiple typed fields
const { ResponseError, ResponseErr } = createTaggedError('ResponseError')
  .withFields<{ status: number; provider: string; reason?: string }>()
  .withMessage(({ status, provider }) => `${provider}: HTTP ${status}`);
```

Each builder call returns two functions:
- `NetworkError`: Creates a plain tagged error object
- `NetworkErr`: Wraps it in `Err` for use with Result types

Call sites provide fields directly (flat). `message` is always computed by the `.withMessage(fn)` template:

```typescript
ResponseErr({ status: 404, provider: 'openai' });
// message -> "openai: HTTP 404"
```
