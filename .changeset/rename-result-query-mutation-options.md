---
"wellcrafted": minor
---

Rename the hook-local Result adapters: `queryOptions` → `resultQueryOptions` and `mutationOptions` → `resultMutationOptions`.

**Breaking change.** Update imports and call sites:

```diff
-import { queryOptions, mutationOptions } from "wellcrafted/query";
+import { resultQueryOptions, resultMutationOptions } from "wellcrafted/query";
```

`createQueryFactories`, `defineQuery`, and `defineMutation` are unchanged — they still compose through the renamed adapters, so there is still exactly one place that unwraps `Result` into TanStack's throwing contract.

Why: the old names collided with TanStack Query's own `queryOptions` / `mutationOptions` identity helpers. The `result*` prefix removes that collision and names what the adapters do — adapt a `Result`-returning `queryFn` / `mutationFn` — so both can coexist in one file without aliasing.

This clarifies the two-family model:

- **`resultQueryOptions` / `resultMutationOptions`** — hook-local, reactive, or local-`QueryClient` operations passed straight to a framework hook.
- **`createQueryFactories(...).defineQuery` / `defineMutation`** — reusable, `QueryClient`-bound handles with imperative helpers (`.fetch`, `.ensure`, callable mutations).

Cache operations (`invalidateQueries`, `setQueryData`, `ensureQueryData`, …) stay on the `QueryClient` and are intentionally not wrapped.
