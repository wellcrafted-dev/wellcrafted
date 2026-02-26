---
"wellcrafted": major
---

**Breaking**: `createTaggedError` now requires `.withMessage(fn)` as a mandatory terminal builder step before factories are available.

### What Changed

- **`.withMessage(fn)` is now required**: Factories (`XxxError`, `XxxErr`) are only returned after calling `.withMessage()`. Previously you could destructure factories after just `.withContext()` or `.withCause()`.
- **Message is auto-computed**: The `message` field is no longer a required input at the factory call site — it is derived from the template function passed to `.withMessage()`. You can still pass `message:` as an optional override.
- **Context type tightened**: `context` constraint changed from `Record<string, unknown>` to `JsonObject` (values must be JSON-serializable).
- **Strict builder/factory separation**: `ErrorBuilder` only has chain methods (`.withContext()`, `.withCause()`, `.withMessage()`). `FinalFactories` only has factory functions — no more mixing.

### Migration

**Before:**
```ts
const { UserError, UserErr } = createTaggedError('UserError')
  .withContext<{ userId: string }>();
// ❌ Error: factories not available without .withMessage()
```

**After:**
```ts
const { UserError, UserErr } = createTaggedError('UserError')
  .withContext<{ userId: string }>()
  .withMessage(({ context }) => `User ${context.userId} failed`);
// ✅ Factories now available
```
