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

## The `defineErrors` API

`defineErrors` takes an object where each key is a short variant name (the namespace provides context). Every factory returns `Err<...>` directly — ready for `trySync`/`tryAsync` catch handlers. The variant name is stamped as `name` on the error object.

```typescript
import { defineErrors, type InferError, type InferErrors } from 'wellcrafted/error';

const HttpError = defineErrors({
  Network: () => ({
    message: 'Network request failed',
  }),
  /** reason is optional — HTTP/2 dropped reason phrases, so it may be absent. */
  Response: ({ status, reason }: { status: number; reason?: string }) => ({
    message: `HTTP ${status}${reason ? `: ${reason}` : ''}`,
    status,
    reason,
  }),
});

type HttpError = InferErrors<typeof HttpError>;

const result = HttpError.Network();      // Err<{ name: 'Network'; message: string }>
const result2 = HttpError.Response({ status: 404 }); // Err<{ name: 'Response'; ... }>
```

## Tiers of Error Complexity

### Tier 0: Minimal Errors — message at call site

The constructor takes `message` as input and passes it through. The call site provides the message directly.

```typescript
const AppError = defineErrors({
  Simple: ({ message }: { message: string }) => ({ message }),

  FsRead: ({ message, path }: { message: string; path: string }) => ({
    message,
    path,
  }),
});

AppError.Simple({ message: 'Something went wrong' });
// → Err<{ name: 'Simple', message: 'Something went wrong' }>

AppError.FsRead({ message: 'Failed to read config', path: '/etc/config' });
// → Err<{ name: 'FsRead', message: 'Failed to read config', path: '/etc/config' }>
```

### Tier 1: Static Errors — no fields, no arguments

Zero-arg constructor with a fixed message. Use when there's no dynamic content.

```typescript
const RecorderError = defineErrors({
  Busy: () => ({
    message: 'A recording is already in progress',
  }),
});

RecorderError.Busy();
// → Err<{ name: 'Busy', message: 'A recording is already in progress' }>
```

### Tier 2: Cause-Wrapping — `cause` carries the raw caught error

Use when wrapping a caught error. Accept `cause: unknown` and call `extractErrorMessage` inside the message template — not at the call site.

```typescript
const SoundError = defineErrors({
  Play: ({ cause }: { cause: unknown }) => ({
    message: `Failed to play sound: ${extractErrorMessage(cause)}`,
    cause,
  }),
});

SoundError.Play({ cause: error });
// → Err<{ name: 'Play', message: 'Failed to play sound: device busy', cause: <original error> }>
```

### Tier 3: Structured Data — domain-specific fields

Use when there's data worth preserving as named fields that callers branch on.

```typescript
const ApiError = defineErrors({
  /** reason is optional — HTTP/2 dropped reason phrases, so it may be absent. */
  Response: ({ status, reason }: { status: number; reason?: string }) => ({
    message: `HTTP ${status}${reason ? `: ${reason}` : ''}`,
    status,
    reason,
  }),
});

ApiError.Response({ status: 404 });
// → Err<{ name: 'Response', message: 'HTTP 404', status: 404 }>

ApiError.Response({ status: 500, reason: 'Internal error' });
// → Err<{ name: 'Response', message: 'HTTP 500: Internal error', status: 500, reason: 'Internal error' }>
```

## Mixing Error Shapes

A single `defineErrors` call can contain any mix of tiers:

```typescript
const AppError = defineErrors({
  // Tier 1: Static
  RecorderBusy: () => ({
    message: 'A recording is already in progress',
  }),

  // Tier 3: Structured
  Response: ({ provider, status, model }: { provider: string; status: number; model: string }) => ({
    message: `HTTP ${status}`,
    provider,
    status,
    model,
  }),

  // Tier 2: Cause-wrapping
  Upload: ({ cause }: { cause: unknown }) => ({
    message: `Upload failed: ${extractErrorMessage(cause)}`,
    cause,
  }),

  // Tier 0: Call-site message with fields
  Export: ({ format, message }: { format: string; message: string }) => ({
    message,
    format,
  }),
});
```

## Flat Fields — No Nesting

Fields are spread directly on the error object. Access them as top-level properties:

```typescript
const err = ApiError.Response({ status: 401, reason: 'Unauthorized' });
// err.error → { name: 'Response', status: 401, reason: 'Unauthorized', message: 'HTTP 401: Unauthorized' }

// Rest spread extracts just the extra fields
const { name, message, ...rest } = err.error;
// rest = { status: 401, reason: 'Unauthorized' }
```

## Reserved Keys

Only `name` is reserved — `defineErrors` stamps it automatically from the key. `message` is always part of the constructor's return type.

## JSON Serializability

Fields must be JSON-serializable values (`JsonObject`). This ensures errors can round-trip through `JSON.stringify`/`JSON.parse` perfectly:

```typescript
const result = ApiError.Response({ status: 401, reason: 'Unauthorized' });
const parsed = JSON.parse(JSON.stringify(result.error));
// parsed.status === 401, parsed.reason === 'Unauthorized'
```

**Allowed:** strings, numbers, booleans, null, plain objects, arrays of the above.

**Not allowed:** `Date` instances, `Error` instances, class instances, functions, `undefined` values, symbols.

## Wrapping Caught Errors with `cause: unknown`

When an error type needs to wrap a caught error, accept `cause: unknown` and extract the message inside the factory:

```typescript
const DbError = defineErrors({
  Backend: ({ backend, cause }: { backend: string; cause: unknown }) => ({
    message: `${backend} failed: ${extractErrorMessage(cause)}`,
    backend,
    cause,
  }),
});

DbError.Backend({ backend: 'postgres', cause: error });
```

Call sites stay clean — pass the raw caught error, no transformation needed:

```typescript
try {
  await db.query(sql);
} catch (error) {
  return DbError.Backend({ backend: 'postgres', cause: error });
}
```

The constructor owns the message template, so it should also own the cause-to-string transformation. This keeps call sites minimal and preserves the raw `cause` for programmatic access.

## Avoid String Literal Unions in Variant Inputs

When a variant's input includes a string literal union like `reason: 'timeout' | 'refused' | 'dns'`, that field is acting as a sub-discriminant — duplicating what variant names already provide. Split into separate variants instead:

```typescript
// Avoid: consumers must narrow on name AND reason
const NetworkError = defineErrors({
  Request: ({ reason }: { reason: 'timeout' | 'refused' | 'dns' }) => ({
    message: `Request failed: ${reason}`,
    reason,
  }),
});

// Prefer: each failure is its own variant with honest types
const NetworkError = defineErrors({
  Timeout: ({ duration }: { duration: number }) => ({
    message: `Request timed out after ${duration}ms`,
    duration,
  }),
  Refused: ({ host }: { host: string }) => ({
    message: `Connection refused by ${host}`,
    host,
  }),
  DnsFailure: ({ hostname }: { hostname: string }) => ({
    message: `DNS lookup failed for ${hostname}`,
    hostname,
  }),
});
```

Freeform `string` fields (like `reason: string` for a human-readable description) are fine. The anti-pattern is specifically **literal unions** that consumers would need to narrow on. If no consumer ever switches on a string literal field (it is purely metadata for logging), keeping it as a field is acceptable.

## Type Annotations with `InferError` and `InferErrors`

Use `InferError` to extract the error type from a single factory, and `InferErrors` for the union of all errors from a namespace:

```typescript
import { defineErrors, type InferError, type InferErrors } from 'wellcrafted/error';

const AppError = defineErrors({
  Network: () => ({
    message: 'Network request failed',
  }),
  File: ({ path }: { path: string }) => ({
    message: `File not found: ${path}`,
    path,
  }),
});

type NetworkError = InferError<typeof AppError.Network>;
// = Readonly<{ name: 'Network'; message: string }>

type FileError = InferError<typeof AppError.File>;
// = Readonly<{ name: 'File'; message: string; path: string }>

// Union of all errors defined in this namespace
type AppError = InferErrors<typeof AppError>;
// = NetworkError | FileError

// Use in discriminated union switches
function handleErrors(error: AppError) {
  switch (error.name) {
    case 'Network':
      console.log('Network failed:', error.message);
      break;
    case 'File':
      console.log('File failed:', error.path);
      break;
  }
}
```

## Quick Reference

```typescript
import { defineErrors, type InferError, type InferErrors, type AnyTaggedError, extractErrorMessage } from 'wellcrafted/error';

const AppError = defineErrors({
  // Call-site message
  Simple: ({ message }: { message: string }) => ({ message }),

  // Static message
  Network: () => ({
    message: 'Network request failed',
  }),

  // Computed message from fields
  Response: ({ status, provider }: { status: number; provider: string }) => ({
    message: `${provider}: HTTP ${status}`,
    status,
    provider,
  }),
});

AppError.Simple({ message: 'Something went wrong' });
AppError.Network();  // message: 'Network request failed'
AppError.Response({ status: 404, provider: 'openai' });  // message: "openai: HTTP 404"

// Type extraction
type NetworkError = InferError<typeof AppError.Network>;
type AppError = InferErrors<typeof AppError>;
```
