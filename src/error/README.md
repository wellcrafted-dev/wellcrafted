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

`defineErrors` takes an object where each key is an error name (must end in `Error`) and each value is a constructor function. The constructor receives input and returns `{ message, ...data }`. `defineErrors` stamps `name` from the key and generates both a plain factory and an `Err`-wrapped factory.

```typescript
import { defineErrors, type InferError, type InferErrorUnion } from 'wellcrafted/error';

const errors = defineErrors({
  NetworkError: () => ({
    message: 'Network request failed',
  }),
  ResponseError: ({ status, reason }: { status: number; reason?: string }) => ({
    message: `HTTP ${status}${reason ? `: ${reason}` : ''}`,
    status,
    reason,
  }),
});

const { NetworkError, NetworkErr, ResponseError, ResponseErr } = errors;
```

Each entry produces two factories:
- `NetworkError(...)`: Creates a plain tagged error object
- `NetworkErr(...)`: Wraps it in `Err` for use with Result types

## Tiers of Error Complexity

### Tier 0: Minimal Errors — message at call site

The constructor takes `message` as input and passes it through. The call site provides the message directly.

```typescript
const errors = defineErrors({
  SimpleError: ({ message }: { message: string }) => ({ message }),

  FsReadError: ({ message, path }: { message: string; path: string }) => ({
    message,
    path,
  }),
});

const { SimpleError, SimpleErr, FsReadError, FsReadErr } = errors;

SimpleErr({ message: 'Something went wrong' });
// → { name: 'SimpleError', message: 'Something went wrong' }

FsReadErr({ message: 'Failed to read config', path: '/etc/config' });
// → { name: 'FsReadError', message: 'Failed to read config', path: '/etc/config' }
```

### Tier 1: Static Errors — no fields, no arguments

Zero-arg constructor with a fixed message. Use when there's no dynamic content.

```typescript
const errors = defineErrors({
  RecorderBusyError: () => ({
    message: 'A recording is already in progress',
  }),
});

const { RecorderBusyError, RecorderBusyErr } = errors;

RecorderBusyErr();
// → { name: 'RecorderBusyError', message: 'A recording is already in progress' }
```

### Tier 2: Reason-Only — `reason` carries the dynamic context

Use when the only dynamic content is a stringified caught error.

```typescript
const errors = defineErrors({
  PlaySoundError: ({ reason }: { reason: string }) => ({
    message: `Failed to play sound: ${reason}`,
    reason,
  }),
});

const { PlaySoundError, PlaySoundErr } = errors;

PlaySoundErr({ reason: extractErrorMessage(error) });
// → { name: 'PlaySoundError', message: 'Failed to play sound: device busy', reason: 'device busy' }
```

### Tier 3: Structured Data — domain-specific fields

Use when there's data worth preserving as named fields that callers branch on.

```typescript
const errors = defineErrors({
  ResponseError: ({ status, reason }: { status: number; reason?: string }) => ({
    message: `HTTP ${status}${reason ? `: ${reason}` : ''}`,
    status,
    reason,
  }),
});

const { ResponseError, ResponseErr } = errors;

ResponseErr({ status: 404 });
// → { name: 'ResponseError', message: 'HTTP 404', status: 404 }

ResponseErr({ status: 500, reason: 'Internal error' });
// → { name: 'ResponseError', message: 'HTTP 500: Internal error', status: 500, reason: 'Internal error' }
```

## Mixing Error Shapes

A single `defineErrors` call can contain any mix of tiers:

```typescript
const errors = defineErrors({
  // Tier 1: Static
  RecorderBusyError: () => ({
    message: 'A recording is already in progress',
  }),

  // Tier 3: Structured
  ResponseError: ({ provider, status, model }: { provider: string; status: number; model: string }) => ({
    message: `HTTP ${status}`,
    provider,
    status,
    model,
  }),

  // Tier 0: Call-site message with fields
  OperationError: ({ operation, message }: { operation: string; message: string }) => ({
    message,
    operation,
  }),
});
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

Only `name` is reserved — `defineErrors` stamps it automatically from the key. `message` is always part of the constructor's return type.

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
const errors = defineErrors({
  BackendError: ({ backend, cause }: { backend: string; cause: string }) => ({
    message: `${backend} failed`,
    backend,
    cause,
  }),
});

const { BackendError } = errors;
BackendError({ backend: 'postgres', cause: 'connection timeout' });
```

## Type Annotations with `InferError` and `InferErrorUnion`

Use `InferError` to extract a single error type from a `defineErrors` return, and `InferErrorUnion` for the union of all errors:

```typescript
import { defineErrors, type InferError, type InferErrorUnion } from 'wellcrafted/error';

const errors = defineErrors({
  NetworkError: () => ({
    message: 'Network request failed',
  }),
  FileError: ({ path }: { path: string }) => ({
    message: `File not found: ${path}`,
    path,
  }),
});

type NetworkError = InferError<typeof errors, 'NetworkError'>;
// = Readonly<{ name: 'NetworkError'; message: string }>

type FileError = InferError<typeof errors, 'FileError'>;
// = Readonly<{ name: 'FileError'; message: string; path: string }>

// Union of all errors defined in this group
type AppError = InferErrorUnion<typeof errors>;
// = NetworkError | FileError

// Use in discriminated union switches
function handleErrors(error: AppError) {
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
import { defineErrors, type InferError, type InferErrorUnion, type AnyTaggedError, extractErrorMessage } from 'wellcrafted/error';

const errors = defineErrors({
  // Call-site message
  SimpleError: ({ message }: { message: string }) => ({ message }),

  // Static message
  NetworkError: () => ({
    message: 'Network request failed',
  }),

  // Computed message from fields
  ResponseError: ({ status, provider }: { status: number; provider: string }) => ({
    message: `${provider}: HTTP ${status}`,
    status,
    provider,
  }),
});

const { SimpleError, SimpleErr } = errors;
const { NetworkError, NetworkErr } = errors;
const { ResponseError, ResponseErr } = errors;

SimpleErr({ message: 'Something went wrong' });
NetworkErr();  // message: 'Network request failed'
ResponseErr({ status: 404, provider: 'openai' });  // message: "openai: HTTP 404"

// Type extraction
type NetworkError = InferError<typeof errors, 'NetworkError'>;
type AllErrors = InferErrorUnion<typeof errors>;
```

Each entry produces two factories:
- `NetworkError`: Creates a plain tagged error object
- `NetworkErr`: Wraps it in `Err` for use with Result types
