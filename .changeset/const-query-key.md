---
"wellcrafted": minor
---

Infer literal `queryKey` tuples in `defineQuery` without requiring `as const`. The `TQueryKey` type parameter now uses TypeScript 5.0's `const` modifier, so `queryKey: ['users', userId]` is inferred as `readonly ['users', string]` instead of being widened to `string[]`. This preserves the narrow key type on `.options.queryKey` and inside `queryFn`'s context, matching how TanStack Query types keys when you write them inline.

Before:

```ts
const userQuery = defineQuery({
  queryKey: ['users', userId] as const, // `as const` required to keep the tuple
  queryFn: ({ queryKey }) => services.getUser(queryKey[1]),
});
```

After:

```ts
const userQuery = defineQuery({
  queryKey: ['users', userId], // inferred as readonly ['users', string]
  queryFn: ({ queryKey }) => services.getUser(queryKey[1]),
});
```
