---
name: query-factories
description: Adapt wellcrafted Results to TanStack Query through direct options adapters or QueryClient-bound factories.
---

# TanStack Query adapters

Install the tested type prerequisite explicitly; wellcrafted does not currently declare it for consumers.

```bash
bun add @tanstack/query-core@5.82.0
```

```typescript
import {
  createQueryFactories,
  defineKeys,
  resultMutationOptions,
  resultQueryOptions,
} from "wellcrafted/query";
```

## Choose one family

Use `resultQueryOptions` and `resultMutationOptions` when a framework hook owns execution:

```typescript
const profileOptions = resultQueryOptions({
  queryKey: ["account-profile", accountId],
  queryFn: () => accountService.getProfile(accountId),
});

const signOutOptions = resultMutationOptions({
  mutationKey: ["account", "signOut"],
  mutationFn: () => accountService.signOut(),
});
```

Ok resolves into TanStack's data channel. Err throws its contained value into TanStack's error channel.

Options are snapshots. In reactive frameworks, construct them inside the hook's reactive accessor when keys, `enabled`, or other options depend on reactive state.

```typescript
const profile = createQuery(() =>
  resultQueryOptions({
    queryKey: ["account-profile", accountId],
    queryFn: () => accountService.getProfile(accountId),
    enabled: accountId !== null,
  }),
);
```

Use `createQueryFactories(queryClient)` when the same client should own options and imperative handles:

```typescript
const { defineQuery, defineMutation } = createQueryFactories(queryClient);

const profile = defineQuery({
  queryKey: ["account-profile", accountId],
  queryFn: () => accountService.getProfile(accountId),
});

const signOut = defineMutation({
  mutationKey: ["account", "signOut"],
  mutationFn: () => accountService.signOut(),
});
```

The query shape is `{ options, fetch(), ensure() }` and is not callable. `fetch()` uses TanStack's freshness policy; `ensure()` prefers existing cache data.

The mutation is callable and has `.options`:

```typescript
await signOut(undefined);
signOut.options;
```

There is no `.execute()` method.

## Keep cache work on QueryClient

Call `invalidateQueries`, `setQueryData`, `getQueryData`, prefetching, and other cache methods directly on the owning `QueryClient`. wellcrafted adapts Result-returning functions; it does not replace TanStack's cache API.

Thrown values caught by bound helpers are cast to the configured error type, not runtime-validated.

## Define keys

```typescript
const accountKeys = defineKeys({
  all: ["accounts"],
  detail: (accountId: string) => ["accounts", accountId],
  exactDetail: (accountId: string) => ["accounts", accountId] as const,
});
```

Static entries preserve readonly literal tuples. Factory entries preserve tuple shape but widen literal positions unless the return uses `as const`.

`examples/tanstack-query.ts` is the canonical checked example. Use the public integration guide for the attributed reactive account pattern and the query reference for exact contracts.
