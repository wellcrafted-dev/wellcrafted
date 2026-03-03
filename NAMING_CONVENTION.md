# Error Naming Convention

This document establishes the clear distinction between error-related concepts in the Result library.

## Key Concepts

### 1. **Error Types** (defined via `defineErrors`, extracted via `InferErrors`/`InferError`)
- The actual error values/types that contain error information
- Defined as namespaced variants using `defineErrors`, not as standalone type aliases
- The `name` field contains the SHORT variant name (e.g., `"Validation"`, not `"ValidationError"`) -- the namespace variable provides domain context
- These are the `E` in `Result<T, E>` and `Err<E>`
- Error objects are flat: fields from the factory return are spread directly alongside `name` and `message`

```typescript
// Define a namespace of related errors
const UserError = defineErrors({
  Validation: ({ field, value }: { field: string; value: string }) => ({
    message: `Invalid ${field}: ${value}`,
    field,
    value,
  }),
  NotFound: ({ userId }: { userId: string }) => ({
    message: `User ${userId} not found`,
    userId,
  }),
});

// Extract types from the namespace
type UserError = InferErrors<typeof UserError>;
// Union of all variants: { name: "Validation"; message: string; field: string; value: string } | { name: "NotFound"; ... }

// Extract a single variant
type ValidationError = InferError<typeof UserError, "Validation">;
```

### 2. **Err Data Structure**
- The wrapper that contains an error type in the Result system
- Structure: `{ error: E; data: null }`
- One of the two variants of `Result<T, E>` (the other being `Ok<T>`)
- `defineErrors` factories return `Err<...>` directly -- no manual `Err()` wrapping needed

```typescript
// Factory returns Err<...> directly
const result = UserError.Validation({ field: "email", value: "" });
// result is Err<{ name: "Validation"; message: "Invalid email: "; field: "email"; value: "" }>
```

### 3. **Result**
- The union type `Ok<T> | Err<E>` representing either success or failure
- The top-level type that encapsulates both success and error scenarios

## Function Naming

### Key Names
- `catch` (not `mapError` or `mapErr`) -- the catch handler in trySync/tryAsync
- `InferErrors<T>` -- extracts the union of all error types from a defineErrors namespace
- `InferError<T, K>` -- extracts a single error variant type by key
- `isErr` -- checks if something is an Err data structure
- `isOk` -- checks if something is an Ok data structure

### Function Signatures
```typescript
trySync<T, E>({
  try: () => T;
  catch: (error: unknown) => Err<E>;  // Must return Err<E>, not bare E
}): Result<T, E>

tryAsync<T, E>({
  try: () => Promise<T>;
  catch: (error: unknown) => Err<E>;  // Must return Err<E>, not bare E
}): Promise<Result<T, E>>
```

## Documentation Terminology

### Consistent Language
- "Error type" or "error value" -- refers to the actual error (`{ name: "Validation"; message: string; field: string; ... }`)
- "Error namespace" -- refers to the object returned by `defineErrors` containing factory methods
- "Err data structure" -- refers to the wrapper `{ error: E; data: null }`
- "Result" -- refers to the union type that can be either Ok or Err

### Examples
```typescript
// Define error namespace with factories
const UserError = defineErrors({
  Validation: ({ field, value }: { field: string; value: string }) => ({
    message: `Invalid ${field}: ${value}`,
    field,
    value,
  }),
});

// Extract types
type UserError = InferErrors<typeof UserError>;

// Factories return Err<...> directly -- ready for catch handlers
const result = trySync({
  try: () => JSON.parse(input),
  catch: () => UserError.Validation({ field: "json", value: input }),
});

// Type guards work on the data structure level
if (isErr(result)) {
  // result.error is flat: { name: "Validation", message: "...", field: "json", value: "..." }
  console.log(result.error.name);    // "Validation"
  console.log(result.error.field);   // "json" -- flat, no context nesting
  console.log(result.error.message); // "Invalid json: ..."
}
```

## Error Naming Rules

1. **Short variant names**: `Validation`, `NotFound`, `Timeout` -- NOT `ValidationError`. The namespace variable (`UserError`, `HttpError`) provides domain context.
2. **Use PascalCase**: `NotFound`, not `not_found` or `NOT_FOUND`
3. **Be specific**: `Authentication` vs generic `Service`
4. **Group by domain**: `UserError.Validation`, `HttpError.Timeout`, `DbError.Connection`
5. **Namespace as the "Error" suffix**: The variable name carries the "Error" suffix (`UserError`), individual variants do not

This convention provides clear semantics and helps developers understand the distinction between the error data itself and the data structures that contain it.
