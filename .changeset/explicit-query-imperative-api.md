---
"wellcrafted": minor
---

Simplify the imperative factory API so query reads choose a cache policy explicitly and mutations use the callable form as their only imperative trigger.

Queries now expose:

- `.fetch()`: run through TanStack Query's freshness-aware `fetchQuery` path.
- `.ensure()`: return cached data if it exists, fetching only when the cache has no data.

This makes the read policy visible at the call site:

```ts
const freshEnough = await userQuery.fetch();
const cacheFirst = await userQuery.ensure();
```

Mutations no longer expose a duplicate `.execute()` helper:

```ts
const saved = await saveUser(input);
```

The richer TanStack mutation observer surface still lives behind `.options` for hooks.
