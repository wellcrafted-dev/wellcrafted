---
"wellcrafted": minor
---

Add `queryOptions` and `mutationOptions` as the canonical Result-to-TanStack adapters.

`wellcrafted/query` now exposes two lower-level helpers alongside `defineQuery` / `defineMutation`:

- `queryOptions(input)` accepts a `queryKey` plus a Result-returning `queryFn` and returns standard `QueryObserverOptions` whose `queryFn` resolves `Ok(data)` and throws `Err(error)`.
- `mutationOptions(input)` accepts a `mutationKey` plus a Result-returning `mutationFn` and returns standard `MutationOptions` with the same Result unwrapping behavior.

These helpers are platform-agnostic: no `QueryClient` required. They compose cleanly inside framework hooks:

```ts
import { queryOptions, mutationOptions } from "wellcrafted/query";

const user = createQuery(() =>
  queryOptions({
    queryKey: ["user", userId],
    queryFn: () => services.getUser(userId),
  }),
);

const save = createMutation(() =>
  mutationOptions({
    mutationKey: ["saveUser"],
    mutationFn: (input: SaveUserInput) => services.saveUser(input),
  }),
);
```

`defineQuery` and `defineMutation` now compose through these helpers, so there is exactly one canonical conversion path from `Result<TData, TError>` to TanStack's throwing contract. The `.options` produced by `defineQuery` and `defineMutation` is the same shape returned by `queryOptions` and `mutationOptions`.

Use `queryOptions` / `mutationOptions` when options are local to a hook call site. Use `defineQuery` / `defineMutation` when you also want imperative helpers (`.fetch`, `.ensure`, `.execute`, callable form) bound to a specific `QueryClient`.

The new helpers share names with TanStack Query's framework-adapter identity helpers (`@tanstack/react-query`, `@tanstack/svelte-query`). This is intentional: Wellcrafted's versions are the Result-aware equivalents. If you need both in one file, alias one on import.
