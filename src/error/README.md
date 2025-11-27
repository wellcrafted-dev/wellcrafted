# Tagged Errors

Type-safe error handling with discriminated unions and error chaining.

## Why Tagged Errors?

Traditional `throw`/`catch` loses type information. Tagged errors give you:

- **Discriminated unions**: Switch on `error.name` with full type narrowing
- **Required context**: Enforce that errors always include necessary debugging info
- **Error chaining**: Build JSON-serializable error stacks with `cause`
- **Result integration**: Return `Err<TaggedError>` instead of throwing

## Quick Start

```typescript
import { taggedError } from 'wellcrafted/error';

const { NetworkError, NetworkErr } = taggedError('NetworkError');

// Plain error object
const error = NetworkError({ message: 'Connection failed' });

// Wrapped in Err result (for Result-based flows)
const result = NetworkErr({ message: 'Connection failed' });
```

## Three Modes

### Mode 1: Flexible (No Constraints)

Context and cause are optional. Any shape accepted.

```typescript
const { NetworkError, NetworkErr } = taggedError('NetworkError');

// Just message
NetworkError({ message: 'Timeout' });

// With any context shape
NetworkError({
  message: 'DNS failed',
  context: { host: 'example.com', resolver: '8.8.8.8' }
});

// With cause (error chaining)
NetworkError({
  message: 'Request failed',
  context: { url: 'https://api.example.com' },
  cause: someOtherError
});
```

### Mode 2: Fixed Context

Context is **required** with a specific shape. Cause remains optional.

```typescript
type BlobContext = {
  filename: string;
  code: 'INVALID_FILENAME' | 'FILE_TOO_LARGE' | 'PERMISSION_DENIED';
};

const { BlobError, BlobErr } = taggedError<'BlobError', BlobContext>('BlobError');

// Context is required and type-checked
BlobError({
  message: 'Invalid filename',
  context: { filename: 'test.txt', code: 'INVALID_FILENAME' }
});

// Type error: context is missing
// BlobError({ message: 'Error' });

// Type error: 'WRONG_CODE' is not valid
// BlobError({ message: 'Error', context: { filename: 'x', code: 'WRONG_CODE' } });
```

### Mode 3: Fixed Context + Cause

Both context and cause types are constrained.

```typescript
// Define the cause error type
type NetworkErrorType = TaggedError<'NetworkError', never, { url: string }>;

// ApiError requires context and constrains cause type
const { ApiError, ApiErr } = taggedError<
  'ApiError',
  { endpoint: string; method: string },
  NetworkErrorType
>('ApiError');

// Context required, cause optional but must be NetworkErrorType if provided
ApiError({
  message: 'Request failed',
  context: { endpoint: '/users', method: 'GET' }
});

ApiError({
  message: 'Request failed',
  context: { endpoint: '/users', method: 'GET' },
  cause: networkError  // Must match NetworkErrorType
});
```

## Type Behavior

| Mode | Context | Cause |
|------|---------|-------|
| Flexible | Optional, any shape | Optional, any TaggedError |
| Fixed Context | **Required**, exact shape | Optional, any TaggedError |
| Both Fixed | **Required**, exact shape | Optional, must match type |

## Error Chaining

Build structured error chains for debugging:

```typescript
const { DatabaseError } = taggedError('DatabaseError');
const { RepositoryError } = taggedError('RepositoryError');
const { ServiceError } = taggedError('ServiceError');

// Level 1: Root cause
const dbError = DatabaseError({
  message: 'Query failed',
  context: { query: 'SELECT * FROM users', table: 'users' }
});

// Level 2: Wrap database error
const repoError = RepositoryError({
  message: 'Failed to fetch user',
  context: { entity: 'User', operation: 'findById' },
  cause: dbError
});

// Level 3: Wrap repository error
const serviceError = ServiceError({
  message: 'User service failed',
  context: { service: 'UserService', method: 'getProfile' },
  cause: repoError
});

// The entire chain is JSON-serializable
console.log(JSON.stringify(serviceError, null, 2));
```

## Result Integration

Use with the Result type for explicit error handling:

```typescript
import { taggedError } from 'wellcrafted/error';
import { Ok, type Result } from 'wellcrafted/result';

type ValidationContext = { field: string; value: unknown };
const { ValidationError, ValidationErr } = taggedError<
  'ValidationError',
  ValidationContext
>('ValidationError');

function validateEmail(email: string): Result<string, ValidationError> {
  if (!email.includes('@')) {
    return ValidationErr({
      message: 'Invalid email format',
      context: { field: 'email', value: email }
    });
  }
  return Ok(email);
}

// Usage
const result = validateEmail('invalid');
if (result.error) {
  console.error(`${result.error.context.field}: ${result.error.message}`);
}
```

## Discriminated Unions

Switch on error types with full type narrowing:

```typescript
const { NetworkError } = taggedError('NetworkError');
const { ValidationError } = taggedError('ValidationError');
const { AuthError } = taggedError('AuthError');

type AppError =
  | ReturnType<typeof NetworkError>
  | ReturnType<typeof ValidationError>
  | ReturnType<typeof AuthError>;

function handleError(error: AppError) {
  switch (error.name) {
    case 'NetworkError':
      // TypeScript knows this is NetworkError
      console.error('Network issue');
      break;
    case 'ValidationError':
      // TypeScript knows this is ValidationError
      console.error('Validation failed');
      break;
    case 'AuthError':
      // TypeScript knows this is AuthError
      console.error('Authentication required');
      break;
  }
}
```

## API Reference

### `taggedError(name)`

Creates error factory functions.

**Parameters:**
- `name`: String ending in "Error" (e.g., `'NetworkError'`, `'ValidationError'`)

**Type Parameters:**
- `TName`: The error name (inferred from `name` parameter)
- `TContext`: Optional fixed context shape
- `TCause`: Optional fixed cause type

**Returns:**
- `[Name]`: Factory that creates plain error objects
- `[Name with 'Err' suffix]`: Factory that creates `Err<TaggedError>` results

### `TaggedError<TName, TCause, TContext>`

The error type itself.

**Properties:**
- `name`: The discriminator string
- `message`: Human-readable error message
- `context`: Additional data (exists only if `TContext !== never`)
- `cause`: Wrapped error (exists only if `TCause !== never`)

## Migration from `createTaggedError`

`createTaggedError` is now deprecated but still works as an alias:

```typescript
// Old (still works)
const { NetworkError } = createTaggedError('NetworkError');

// New (preferred)
const { NetworkError } = taggedError('NetworkError');
```
