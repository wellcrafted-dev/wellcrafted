---
"wellcrafted": minor
---

Align `TaggedError` type parameter order with `createTaggedError`

Changed `TaggedError<TName, TCause, TContext>` to `TaggedError<TName, TContext, TCause>` so both APIs use consistent ordering. This simplifies context-only error definitions:

**Before:**
```typescript
type NetworkError = TaggedError<"NetworkError", never, { host: string }>;
```

**After:**
```typescript
type NetworkError = TaggedError<"NetworkError", { host: string }>;
```

Single-generic usage (`TaggedError<"Name">`) is unaffected.
