---
name: define-errors
description: Define typed, serializable error variants with defineErrors from wellcrafted. Use when creating error types, handling domain errors, or reviewing error definitions.
---

# defineErrors

```typescript
import {
  defineErrors,
  extractErrorMessage,
  type InferErrors,
  type InferError,
} from 'wellcrafted/error';
```

## Core Rules

1. All variants for a domain live in one `defineErrors` call — never spread across multiple calls
2. The factory returns `{ message, ...fields }` — no `.withMessage()` or `.withContext()` chains
3. `cause: unknown` is a field like any other — accept it in input, forward in return
4. Call `extractErrorMessage(cause)` inside the factory, never at the call site
5. Each call like `MyError.Variant({ ... })` returns `Err(...)` automatically
6. Shadow the const with a same-name type using `InferErrors`
7. Use `InferError<typeof MyError.Variant>` for a single variant's type
8. Variant names describe the specific failure mode — never `Service`, `Error`, or `Failed`
9. Aim for 2–5 variants per domain, each named by failure mode

See also: `result-types` skill for `trySync`/`tryAsync` wrapping patterns.

## Patterns

### Zero-arg variant — static message

```typescript
const UserError = defineErrors({
  AlreadyExists: () => ({
    message: 'A user with this email already exists',
  }),
});
type UserError = InferErrors<typeof UserError>;

// Call site
return UserError.AlreadyExists();
```

### Structured fields — message computed from input

```typescript
const DbError = defineErrors({
  NotFound: ({ table, id }: { table: string; id: string }) => ({
    message: `${table} '${id}' not found`,
    table,
    id,
  }),
});
type DbError = InferErrors<typeof DbError>;

// Call site
return DbError.NotFound({ table: 'users', id: '123' });
// error.message → "users '123' not found"
// error.table   → "users"
// error.id      → "123"
```

### Cause wrapping — extractErrorMessage inside the factory

```typescript
import { extractErrorMessage } from 'wellcrafted/error';

const FileError = defineErrors({
  ReadFailed: ({ path, cause }: { path: string; cause: unknown }) => ({
    message: `Failed to read '${path}': ${extractErrorMessage(cause)}`,
    path,
    cause,
  }),
  WriteFailed: ({ path, cause }: { path: string; cause: unknown }) => ({
    message: `Failed to write '${path}': ${extractErrorMessage(cause)}`,
    path,
    cause,
  }),
});
type FileError = InferErrors<typeof FileError>;

// Call site — pass the raw caught error, never call extractErrorMessage here
catch: (error) => FileError.ReadFailed({ path: '/tmp/config.json', cause: error }),
```

### Multiple variants — discriminated union built-in

```typescript
const HttpError = defineErrors({
  Connection: ({ url, cause }: { url: string; cause: unknown }) => ({
    message: `Failed to connect to ${url}: ${extractErrorMessage(cause)}`,
    url,
    cause,
  }),
  Timeout: ({ url, ms }: { url: string; ms: number }) => ({
    message: `Request to ${url} timed out after ${ms}ms`,
    url,
    ms,
  }),
  Response: ({ status, body }: { status: number; body: unknown }) => ({
    message: `HTTP ${status}: ${extractErrorMessage(body)}`,
    status,
    body,
  }),
});
type HttpError = InferErrors<typeof HttpError>;
// HttpError is automatically the union of all three variants

// Extracting a single variant type
type TimeoutError = InferError<typeof HttpError.Timeout>;
```

### Composing errors across layers

Each layer defines its own error vocabulary. Inner errors become `cause` fields in higher-level errors.

```typescript
// Low-level: HTTP errors
const HttpError = defineErrors({
  Connection: ({ url, cause }: { url: string; cause: unknown }) => ({
    message: `Failed to connect to ${url}: ${extractErrorMessage(cause)}`,
    url,
    cause,
  }),
});

// High-level: domain errors wrap HTTP errors via cause
const UserError = defineErrors({
  FetchFailed: ({ userId, cause }: { userId: string; cause: unknown }) => ({
    message: `Failed to fetch user ${userId}: ${extractErrorMessage(cause)}`,
    userId,
    cause,
  }),
});

// The HTTP error becomes cause in the domain error
const { data, error } = await tryAsync({
  try: () => fetch(`/api/users/${userId}`),
  catch: (cause) => UserError.FetchFailed({ userId, cause }),
});
```

See also: `patterns` skill for service layer architecture with error composition.

## Type Extraction

```typescript
// Full union type for all variants
type HttpError = InferErrors<typeof HttpError>;

// Single variant type
type ConnectionError = InferError<typeof HttpError.Connection>;
```

## Anti-Patterns

### One defineErrors per variant

```typescript
// WRONG — defeats the namespace grouping
const NotFoundError = defineErrors({ NotFound: () => ({ message: 'Not found' }) });
const TimeoutError = defineErrors({ Timeout: () => ({ message: 'Timed out' }) });

// CORRECT — all variants for a domain in one call
const HttpError = defineErrors({
  NotFound: () => ({ message: 'Not found' }),
  Timeout: () => ({ message: 'Timed out' }),
});
```

### extractErrorMessage at the call site

```typescript
// WRONG — call site does message extraction
catch: (error) => MyError.Failed({ message: extractErrorMessage(error) });

// CORRECT — pass raw cause, factory calls extractErrorMessage
catch: (error) => MyError.Failed({ cause: error });
```

### Generic variant names

```typescript
// WRONG — "Service" says nothing about the failure mode
const UserError = defineErrors({
  Service: ({ message }: { message: string }) => ({ message }),
});

// CORRECT — name each variant by what actually went wrong
const UserError = defineErrors({
  AlreadyExists: ({ email }: { email: string }) => ({
    message: `User ${email} already exists`,
    email,
  }),
  CreateFailed: ({ cause }: { cause: unknown }) => ({
    message: `Failed to create user: ${extractErrorMessage(cause)}`,
    cause,
  }),
});
```

### Monolithic catch-all variant

```typescript
// WRONG — one variant with an operation string hides failure modes
const DbError = defineErrors({
  Failed: ({ operation, cause }: { operation: string; cause: unknown }) => ({
    message: `Failed to ${operation}: ${extractErrorMessage(cause)}`,
    operation,
    cause,
  }),
});

// CORRECT — each operation is its own variant
const DbError = defineErrors({
  QueryFailed: ({ cause }: { cause: unknown }) => ({
    message: `Query failed: ${extractErrorMessage(cause)}`,
    cause,
  }),
  InsertFailed: ({ cause }: { cause: unknown }) => ({
    message: `Insert failed: ${extractErrorMessage(cause)}`,
    cause,
  }),
});
```

### Discriminated union inputs (sub-discriminants)

```typescript
// WRONG — reason field creates a sub-discriminant, forces double narrowing
const FormError = defineErrors({
  Invalid: (input: {
    reason: 'bad_email' | 'weak_password' | 'mismatch';
    value?: string;
  }) => ({
    message: { bad_email: `Invalid email: '${input.value}'`, /* ... */ }[input.reason],
    ...input,
  }),
});

// CORRECT — each failure is its own variant with honest types
const FormError = defineErrors({
  InvalidEmail: ({ value }: { value: string }) => ({
    message: `Invalid email: '${value}'`,
    value,
  }),
  WeakPassword: () => ({
    message: 'Password must be at least 8 characters',
  }),
  PasswordMismatch: () => ({
    message: 'Passwords do not match',
  }),
});
```

### Conditional logic in factories

If the factory branches on its inputs to decide the message, each branch should be its own variant. The branching is evidence that multiple errors are hiding in one.

### Using ReturnType instead of InferErrors

```typescript
// WRONG
type MyError = ReturnType<typeof MyError>;

// CORRECT
type MyError = InferErrors<typeof MyError>;
```
