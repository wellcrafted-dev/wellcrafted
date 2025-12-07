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

The `createTaggedError` function provides a clean, chainable API for defining error types:

```typescript
import { createTaggedError } from 'wellcrafted/error';

// Simple error (flexible mode)
const { NetworkError, NetworkErr } = createTaggedError('NetworkError');

// Error with required context
const { FileError, FileErr } = createTaggedError('FileError')
  .withContext<{ path: string; operation: 'read' | 'write' | 'delete' }>();

// Error with optional typed context (include undefined in union)
const { LogError, LogErr } = createTaggedError('LogError')
  .withContext<{ file: string; line: number } | undefined>();

// Error with optional typed cause
const { ServiceError, ServiceErr } = createTaggedError('ServiceError')
  .withCause<DbError | CacheError | undefined>();

// Both context and cause
const { ApiError, ApiErr } = createTaggedError('ApiError')
  .withContext<{ endpoint: string }>()
  .withCause<NetworkError | undefined>();
```

### Optionality via Type Unions

Both `.withContext<T>()` and `.withCause<T>()` determine optionality from the type:

- **`T` without `undefined`** → property is **required**
- **`T | undefined`** → property is **optional** but typed when provided

This is consistent with TypeScript idioms and requires no separate "optional" methods.

## Usage Modes

### Flexible Mode: Exploring and Prototyping

Use this when you don't know what context you need yet, or when context varies wildly between call sites.

```typescript
const { NetworkError, NetworkErr } = createTaggedError('NetworkError');

// Just a message
NetworkError({ message: 'Timeout' });

// Add context as you discover what's useful
NetworkError({ message: 'DNS failed', context: { host: 'example.com' } });

// Chain errors when debugging
NetworkError({ message: 'Request failed', cause: someOtherError });
```

**When to use:** Early development, wrapping unpredictable third-party code, or when different call sites genuinely need different context shapes.

### Required Context Mode: Enforcing Essential Information

Use this when you know what debugging information is ALWAYS needed for this error type.

```typescript
const { FileError, FileErr } = createTaggedError('FileError')
  .withContext<{
    path: string;
    operation: 'read' | 'write' | 'delete';
  }>();

// TypeScript REQUIRES context now
FileError({
  message: 'Permission denied',
  context: { path: '/etc/passwd', operation: 'write' }
});

// FileError({ message: 'Oops' }); // Type error! context is missing
```

Every file error without a path is useless for debugging. Every API error without an endpoint is useless. Required context mode makes it impossible to forget this information.

**When to use:** Application-level errors where you know exactly what context matters. File operations need paths. API calls need endpoints. Database queries need SQL.

### Optional Typed Context: Best of Both Worlds

Sometimes you want context to be optional (not every error needs it), but when provided, it should be typed. Include `undefined` in the union:

```typescript
const { LogError, LogErr } = createTaggedError('LogError')
  .withContext<{ file: string; line: number } | undefined>();

// Context is optional
LogError({ message: 'Parse failed' });

// But when provided, it's fully typed
LogError({ message: 'Parse failed', context: { file: 'app.ts', line: 42 } });
// LogError({ message: 'x', context: { wrong: true } }); // Type error!
```

This differs from flexible mode: flexible mode accepts any shape, while optional typed mode enforces the exact shape when context is present.

**When to use:** Errors where context is helpful but not always available. Log messages where you sometimes have source location. API errors where you sometimes have request details.

### Type-Safe Error Hierarchies

Use `.withCause<T>()` when errors have predictable causes. An API error wraps a network error. A service error wraps a repository error.

```typescript
const { NetworkError } = createTaggedError('NetworkError')
  .withContext<{ url: string }>();
type NetworkError = ReturnType<typeof NetworkError>;

const { ApiError, ApiErr } = createTaggedError('ApiError')
  .withContext<{ endpoint: string }>()
  .withCause<NetworkError | undefined>();

// Cause is optional, but if provided, MUST be NetworkError
ApiError({
  message: 'Failed to fetch user',
  context: { endpoint: '/users/123' }
});

ApiError({
  message: 'Failed to fetch user',
  context: { endpoint: '/users/123' },
  cause: networkError  // Type-checked!
});
```

This encodes domain knowledge: "API errors fail because of network issues, not validation issues." If you find yourself passing a ValidationError as the cause of an ApiError, that's a sign your error architecture is wrong.

**When to use:** Building error hierarchies in layered architectures. Network → API → Repository → Service. Each layer wraps the layer below with its own context.

## Error Chaining

Tagged error chains are just nested objects that serialize perfectly to JSON:

```typescript
const { DbError } = createTaggedError('DbError');
const { RepoError } = createTaggedError('RepoError');
const { ServiceError } = createTaggedError('ServiceError');

const dbError = DbError({
  message: 'Connection timeout',
  context: { host: 'localhost', port: 5432 }
});

const repoError = RepoError({
  message: 'Failed to fetch user',
  context: { userId: '123' },
  cause: dbError
});

const serviceError = ServiceError({
  message: 'User profile unavailable',
  context: { operation: 'getProfile' },
  cause: repoError
});

// The whole chain serializes to JSON
console.log(JSON.stringify(serviceError, null, 2));
```

Each layer adds its own context while preserving the full chain.

## Type Annotations with ReturnType

`ReturnType` works correctly for all modes:

```typescript
// Flexible mode
const { NetworkError } = createTaggedError('NetworkError');
type NetworkError = ReturnType<typeof NetworkError>;
// = TaggedError<'NetworkError'> with optional context/cause

// Required context mode
const { FileError } = createTaggedError('FileError')
  .withContext<{ path: string }>();
type FileError = ReturnType<typeof FileError>;
// = TaggedError<'FileError', { path: string }> with required context

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
import { createTaggedError, type TaggedError } from 'wellcrafted/error';

// Flexible: context and cause optional, loosely typed
const { NetworkError, NetworkErr } = createTaggedError('NetworkError');
type NetworkError = ReturnType<typeof NetworkError>;

// Required context: context required with exact shape
const { FileError, FileErr } = createTaggedError('FileError')
  .withContext<{ filename: string }>();
type FileError = ReturnType<typeof FileError>;

// Optional typed context: context optional but typed when provided
const { LogError, LogErr } = createTaggedError('LogError')
  .withContext<{ file: string; line: number } | undefined>();
type LogError = ReturnType<typeof LogError>;

// Optional typed cause: cause optional but constrained when provided
const { ServiceError, ServiceErr } = createTaggedError('ServiceError')
  .withCause<DbError | CacheError | undefined>();
type ServiceError = ReturnType<typeof ServiceError>;

// Both: required context, optional typed cause
const { ApiError, ApiErr } = createTaggedError('ApiError')
  .withContext<{ endpoint: string }>()
  .withCause<NetworkError | undefined>();
type ApiError = ReturnType<typeof ApiError>;
```

Each factory returns two functions:
- `NetworkError`: Creates a plain tagged error object
- `NetworkErr`: Wraps it in `Err` for use with Result types
