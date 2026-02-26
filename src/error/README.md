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
- **Required context**: Force yourself to always include the debugging info you'll need
- **JSON-serializable chains**: Build error stacks that survive serialization, unlike Error objects

We use plain objects instead of Error classes because they serialize cleanly to JSON, work everywhere without special handling, and integrate naturally with discriminated unions.

## The Fluent API

The `createTaggedError` function provides a chainable builder API. The builder has two stages:

- **Builder stage**: Chain `.withContext<T>()`, `.withCause<T>()`, and `.withMessage(fn)` to define the error shape.
- **Factory stage**: After calling `.withMessage(fn)`, you get the factories (`Error` and `Err`).

`.withMessage(fn)` is **required** and **terminal** — it ends the builder chain and produces the factories.

```typescript
import { createTaggedError } from 'wellcrafted/error';

// Simple - static message
const { ValidationError, ValidationErr } = createTaggedError('ValidationError')
  .withMessage(() => 'Validation failed');

// With context - message computed from context
const { FileError, FileErr } = createTaggedError('FileError')
  .withContext<{ path: string; operation: 'read' | 'write' | 'delete' }>()
  .withMessage(({ context }) => `File ${context.operation} failed: ${context.path}`);

// With context and cause
const { ApiError, ApiErr } = createTaggedError('ApiError')
  .withContext<{ endpoint: string }>()
  .withCause<NetworkError | undefined>()
  .withMessage(({ context, cause }) =>
    cause
      ? `API call to ${context.endpoint} failed: ${cause.message}`
      : `API call to ${context.endpoint} failed`
  );
```

### Builder vs FinalFactories

The builder (what `createTaggedError()` returns) only has chain methods: `.withContext()`, `.withCause()`, `.withMessage()`. There are no factories on the builder itself. Factories only exist after `.withMessage()` completes the chain.

```typescript
const builder = createTaggedError('FileError').withContext<{ path: string }>();
// builder.FileError   <- does NOT exist
// builder.withMessage <- exists

const { FileError, FileErr } = builder.withMessage(({ context }) => `Failed: ${context.path}`);
// FileError  <- exists (creates error object)
// FileErr    <- exists (wraps in Err for Result types)
```

### Explicit Opt-In Philosophy (Rust-inspired)

By default, errors only have `{ name, message }`. Context and cause must be explicitly added via `.withContext<T>()` and `.withCause<T>()`. This follows Rust's thiserror pattern where error properties are intentional architectural decisions.

### Optionality via Type Unions

Both `.withContext<T>()` and `.withCause<T>()` determine optionality from the type:

- **`T` without `undefined`** → property is **required**
- **`T | undefined`** → property is **optional** but typed when provided

## `.withMessage()` — The Terminal Step

`.withMessage(fn)` is the required final step in the builder chain. It:

1. Defines how the error message is computed from `{ name, context?, cause? }`
2. Returns the factories (`Error` and `Err`) — not another builder

```typescript
const { DbError, DbErr } = createTaggedError('DbError')
  .withContext<{ host: string; port: number }>()
  .withMessage(({ context }) => `DB connection failed at ${context.host}:${context.port}`);
```

The callback receives the same fields the error will have. Context and cause are available with their exact types.

### Message Auto-Computation vs Override

At call sites, `message` is auto-computed from the template. You do not need to provide it:

```typescript
DbErr({ context: { host: 'localhost', port: 5432 } });
// error.message -> "DB connection failed at localhost:5432"
```

For one-off cases, you can override the message by passing `message` explicitly:

```typescript
DbErr({
  message: 'Custom message for this specific case',
  context: { host: 'localhost', port: 5432 }
});
// error.message -> "Custom message for this specific case"
```

## JSON Serializability (JsonObject Constraint)

Context must be a `JsonObject` — JSON-serializable values only. This ensures the full error chain can be serialized to JSON without loss.

**Allowed:** strings, numbers, booleans, null, plain objects, arrays of the above.

**Not allowed:** `Date` instances, `Error` instances, class instances, functions, `undefined` values, symbols.

```typescript
// OK
.withContext<{ path: string; retries: number; metadata: { key: string } }>()

// Type error - Date is not JsonObject
.withContext<{ createdAt: Date }>()

// Type error - Error instance is not JsonObject
.withContext<{ originalError: Error }>()
```

If you need to include a timestamp, use an ISO string. If you need to reference a cause error, use `.withCause<T>()` which has its own typed field.

## Usage Modes

### Simple Errors

Use this when you just need a named error type with a static message.

```typescript
const { ValidationError, ValidationErr } = createTaggedError('ValidationError')
  .withMessage(() => 'Validation failed');

ValidationErr();
// Result: Err({ name: 'ValidationError', message: 'Validation failed' })
```

**When to use:** Simple errors where the message tells the whole story.

### Required Context Mode: Enforcing Essential Information

Use this when you know what debugging information is ALWAYS needed for this error type.

```typescript
const { FileError, FileErr } = createTaggedError('FileError')
  .withContext<{
    path: string;
    operation: 'read' | 'write' | 'delete';
  }>()
  .withMessage(({ context }) => `File ${context.operation} failed: ${context.path}`);

// TypeScript REQUIRES context
FileErr({ context: { path: '/etc/passwd', operation: 'write' } });
// message auto-computed: "File write failed: /etc/passwd"

// FileErr({}) // Type error! context is missing
```

Every file error without a path is useless for debugging. Required context makes it impossible to forget.

**When to use:** Application-level errors where you know exactly what context matters. File operations need paths. API calls need endpoints. Database queries need table and query info.

### Optional Typed Context: Best of Both Worlds

Include `undefined` in the union to make context optional but still typed when provided.

```typescript
const { LogError, LogErr } = createTaggedError('LogError')
  .withContext<{ file: string; line: number } | undefined>()
  .withMessage(({ context }) =>
    context ? `Parse failed at ${context.file}:${context.line}` : 'Parse failed'
  );

// Context is optional
LogErr();

// But when provided, it's fully typed
LogErr({ context: { file: 'app.ts', line: 42 } });
// LogErr({ context: { wrong: true } }); // Type error!
```

**When to use:** Errors where context is helpful but not always available.

### Type-Safe Error Hierarchies

Use `.withCause<T>()` when errors have predictable causes.

```typescript
const { NetworkError } = createTaggedError('NetworkError')
  .withContext<{ url: string }>()
  .withMessage(({ context }) => `Network request failed: ${context.url}`);
type NetworkError = ReturnType<typeof NetworkError>;

const { ApiError, ApiErr } = createTaggedError('ApiError')
  .withContext<{ endpoint: string }>()
  .withCause<NetworkError | undefined>()
  .withMessage(({ context, cause }) =>
    cause
      ? `API call to ${context.endpoint} failed: ${cause.message}`
      : `API call to ${context.endpoint} failed`
  );

// Cause is optional, but when provided, MUST be NetworkError
ApiErr({ context: { endpoint: '/users/123' } });

ApiErr({
  context: { endpoint: '/users/123' },
  cause: networkError  // Type-checked!
});
```

This encodes domain knowledge: "API errors fail because of network issues, not validation issues."

**When to use:** Building error hierarchies in layered architectures. Network → API → Repository → Service.

## Error Chaining

Tagged error chains are just nested objects that serialize perfectly to JSON:

```typescript
const { DbError } = createTaggedError('DbError')
  .withContext<{ host: string; port: number }>()
  .withMessage(({ context }) => `DB connection failed at ${context.host}:${context.port}`);
type DbError = ReturnType<typeof DbError>;

const { RepoError } = createTaggedError('RepoError')
  .withContext<{ userId: string }>()
  .withCause<DbError | undefined>()
  .withMessage(({ context, cause }) =>
    cause ? `Failed to fetch user ${context.userId}: ${cause.message}` : `Failed to fetch user ${context.userId}`
  );
type RepoError = ReturnType<typeof RepoError>;

const { ServiceError } = createTaggedError('ServiceError')
  .withContext<{ operation: string }>()
  .withCause<RepoError | undefined>()
  .withMessage(({ context }) => `Service operation '${context.operation}' failed`);

const dbError = DbError({ context: { host: 'localhost', port: 5432 } });
const repoError = RepoError({ context: { userId: '123' }, cause: dbError });
const serviceError = ServiceError({ context: { operation: 'getProfile' }, cause: repoError });

// The whole chain serializes to JSON cleanly
console.log(JSON.stringify(serviceError, null, 2));
```

Each layer adds its own context while preserving the full chain.

## Type Annotations with ReturnType

`ReturnType` works correctly for all modes:

```typescript
// Simple mode
const { NetworkError } = createTaggedError('NetworkError')
  .withMessage(() => 'Network request failed');
type NetworkError = ReturnType<typeof NetworkError>;
// = { name: 'NetworkError', message: string }

// Required context mode
const { FileError } = createTaggedError('FileError')
  .withContext<{ path: string }>()
  .withMessage(({ context }) => `File operation failed: ${context.path}`);
type FileError = ReturnType<typeof FileError>;
// = { name: 'FileError', message: string, context: { path: string } }

// Use in function signatures
function handleErrors(error: NetworkError | FileError) {
  switch (error.name) {
    case 'NetworkError':
      console.log('Network failed:', error.message);
      break;
    case 'FileError':
      console.log('File failed:', error.context.path);
      break;
  }
}
```

## Quick Reference

```typescript
import { createTaggedError, type TaggedError, type AnyTaggedError } from 'wellcrafted/error';

// Simple: static message, no context
const { NetworkError, NetworkErr } = createTaggedError('NetworkError')
  .withMessage(() => 'Network request failed');
type NetworkError = ReturnType<typeof NetworkError>;

// Required context: context required with exact shape, message computed from it
const { FileError, FileErr } = createTaggedError('FileError')
  .withContext<{ path: string; operation: 'read' | 'write' | 'delete' }>()
  .withMessage(({ context }) => `File ${context.operation} failed: ${context.path}`);
type FileError = ReturnType<typeof FileError>;

// Optional typed context: context optional but typed when provided
const { LogError, LogErr } = createTaggedError('LogError')
  .withContext<{ file: string; line: number } | undefined>()
  .withMessage(({ context }) =>
    context ? `Parse failed at ${context.file}:${context.line}` : 'Parse failed'
  );
type LogError = ReturnType<typeof LogError>;

// Optional typed cause: cause optional but constrained when provided
const { ServiceError, ServiceErr } = createTaggedError('ServiceError')
  .withCause<DbError | CacheError | undefined>()
  .withMessage(({ cause }) => cause ? `Service failed: ${cause.message}` : 'Service failed');
type ServiceError = ReturnType<typeof ServiceError>;

// Both: required context, optional typed cause
const { ApiError, ApiErr } = createTaggedError('ApiError')
  .withContext<{ endpoint: string }>()
  .withCause<NetworkError | undefined>()
  .withMessage(({ context, cause }) =>
    cause
      ? `API call to ${context.endpoint} failed: ${cause.message}`
      : `API call to ${context.endpoint} failed`
  );
type ApiError = ReturnType<typeof ApiError>;
```

Each builder call returns two functions:
- `NetworkError`: Creates a plain tagged error object
- `NetworkErr`: Wraps it in `Err` for use with Result types

Call sites provide `context` and/or `cause` as needed. `message` is auto-computed but can be overridden:

```typescript
// Auto-computed message
FileErr({ context: { path: '/tmp/x', operation: 'read' } });

// Overridden message
FileErr({ message: 'Custom message', context: { path: '/tmp/x', operation: 'read' } });
```
