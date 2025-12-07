---
"wellcrafted": minor
---

Replace `defineError` with fluent `createTaggedError` API

The `createTaggedError` function now uses a fluent builder pattern for type constraints:

```typescript
// Simple usage (flexible mode)
const { NetworkError, NetworkErr } = createTaggedError('NetworkError')

// Required context
const { ApiError } = createTaggedError('ApiError')
  .withContext<{ endpoint: string; status: number }>()

// Optional typed context
const { LogError } = createTaggedError('LogError')
  .withContext<{ file: string; line: number } | undefined>()

// Chaining both context and cause
const { RepoError } = createTaggedError('RepoError')
  .withContext<{ entity: string }>()
  .withCause<DbError | undefined>()
```

**Breaking changes:**
- `defineError` has been removed (use `createTaggedError` instead)
- The old `createTaggedError` generic overloads are removed in favor of the fluent API
