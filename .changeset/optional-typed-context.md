---
"wellcrafted": patch
---

feat(error): support optional typed context via union with undefined

You can now specify context that is optional but still type-checked when provided by using a union with `undefined`:

```typescript
type LogContext = { file: string; line: number } | undefined;
const { LogError } = createTaggedError<'LogError', LogContext>('LogError');

// Context is optional
LogError({ message: 'Parse failed' });

// But when provided, it's typed
LogError({ message: 'Parse failed', context: { file: 'app.ts', line: 42 } });
```

This gives you the best of both worlds: optional context like flexible mode, but with type enforcement like fixed context mode.

The same pattern works for `cause`:
```typescript
type NetworkError = TaggedError<'NetworkError'>;
type CauseType = NetworkError | undefined;
const { ApiError } = createTaggedError<'ApiError', { endpoint: string }, CauseType>('ApiError');
```
