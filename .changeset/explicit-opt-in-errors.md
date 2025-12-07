---
"wellcrafted": minor
---

feat(error): explicit opt-in for context and cause properties

Following Rust's thiserror pattern, `createTaggedError` now uses explicit opt-in for `context` and `cause` properties. By default, errors only have `{ name, message }`.

**Breaking Change:** Previously, all errors had optional `context` and `cause` properties by default. Now you must explicitly chain `.withContext<T>()` and/or `.withCause<T>()` to add these properties.

Before (old behavior):
```typescript
const { ApiError } = createTaggedError("ApiError");
// ApiError had: { name, message, context?: Record<string, unknown>, cause?: AnyTaggedError }
```

After (new behavior):
```typescript
// Minimal error - only name and message
const { ApiError } = createTaggedError("ApiError");
// ApiError has: { name, message }

// With required context
const { ApiError } = createTaggedError("ApiError")
  .withContext<{ endpoint: string }>();
// ApiError has: { name, message, context: { endpoint: string } }

// With optional typed cause
const { ApiError } = createTaggedError("ApiError")
  .withCause<NetworkError | undefined>();
// ApiError has: { name, message, cause?: NetworkError }
```

**Migration:** To replicate the old permissive behavior, either specify the types explicitly:
```typescript
const { FlexibleError } = createTaggedError("FlexibleError")
  .withContext<Record<string, unknown> | undefined>()
  .withCause<AnyTaggedError | undefined>();
```

Or use the new defaults by calling without generics:
```typescript
const { FlexibleError } = createTaggedError("FlexibleError")
  .withContext()   // Defaults to Record<string, unknown> | undefined
  .withCause();    // Defaults to AnyTaggedError | undefined
```
