---
"wellcrafted": patch
---

fix(error): simplify TaggedError types for better ReturnType inference

Previously, `createTaggedError` used function overloads to provide precise call-site type inference. While this worked well for constructing errors, it broke `ReturnType<typeof MyError>` because TypeScript picks the last overload (the most constrained signature).

This change simplifies to single signatures per mode:

1. **Flexible mode** (no type params): context and cause are optional with loose typing
2. **Fixed context mode** (TContext specified): context is required with exact type
3. **Both fixed mode** (TContext + TCause): context required, cause optional but constrained

`ReturnType` now works correctly:
```typescript
const { NetworkError } = createTaggedError('NetworkError');
type NetworkError = ReturnType<typeof NetworkError>;
// = TaggedError<'NetworkError'> with optional context/cause
```

**BREAKING CHANGE**: In flexible mode, `context` is now typed as `Record<string, unknown> | undefined` instead of precisely inferred at call sites. Users who need typed context should use fixed context mode:

```typescript
// Before (flexible with inference - no longer works)
const { ApiError } = createTaggedError('ApiError');
const err = ApiError({ message: 'x', context: { endpoint: '/users' } });

// After (fixed context mode)
const { ApiError } = createTaggedError<'ApiError', { endpoint: string }>('ApiError');
const err = ApiError({ message: 'x', context: { endpoint: '/users' } });
```
