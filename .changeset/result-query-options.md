---
"wellcrafted": minor
---

`wellcrafted/query` is now four functions: two adapters that turn Result-returning functions into plain TanStack options, and two helpers that run those options through a `QueryClient` and return Results.

```ts
import {
  resultQueryOptions,
  resultMutationOptions,
  runQuery,
  runMutation,
} from "wellcrafted/query";
```

**Breaking change.** `createQueryFactories`, `defineQuery`, `defineMutation`, and `defineKeys` are removed, along with the `.options` property, `.fetch()`, `.ensure()`, and callable mutations.

Why: hooks never used the client that `createQueryFactories` bound, because they take theirs from the provider. Binding made every query module a factory that needed a client passed in, and put an `.options` hop at every hook call site. Definitions are now plain TanStack options, so they work with every TanStack API and with any client: one singleton, one per request, or one per signed-in session. The client is passed where you run something, not captured where you define it.

What changed:

- `resultQueryOptions` tags `queryKey` with the data and error types, as TanStack's `queryOptions()` does. `queryClient.getQueryData(options.queryKey)` and `setQueryData` are typed without a cast.
- `resultMutationOptions` passes TanStack's mutation context (`{ client, meta, mutationKey }`) to `mutationFn` and to every lifecycle callback. Invalidate through `context.client` instead of importing a client.
- New `runQuery(client, options)` wraps `client.query` and returns `Result<TData, TError | CancelledError>`. Fresh cached data comes back without a request. Pass `staleTime: 'static'` to accept any cached data, which replaces `.ensure()`. A query cancelled mid-flight, including by `client.clear()`, returns `Err` with TanStack's `CancelledError`; check it with `error instanceof CancelledError`.
- New `runMutation(client, options, variables)` runs the mutation through a `MutationObserver` and returns `Result<TData, TError>`. Definition callbacks, `useIsMutating`, `useMutationState`, mutation scopes, and devtools all see it.
- Keys are plain data. Keep groups such as `['todos']` in an `as const` object and build each query's own key inside its option factory by spreading a group. Read one entry through `options.queryKey`; invalidate a group through the key object.

`@tanstack/query-core` is now an optional peer dependency at `^5.102.0`, the first release with `client.query`. TanStack deprecated `fetchQuery` and `ensureQueryData` in that release.

The `query-factories` agent skill is renamed to `tanstack-query`. If you installed it, run `npx skills add wellcrafted-dev/wellcrafted` again.

Migration:

```diff
-const { defineQuery, defineMutation } = createQueryFactories(queryClient);
-const todoKeys = defineKeys({ all: ["todos"], detail: (id: string) => ["todos", id] });
+const todosRoot = ["todos"] as const;
+export const todoKeys = { all: todosRoot };

-const todoQuery = (id: string) =>
-  defineQuery({ queryKey: todoKeys.detail(id), queryFn: () => api.getTodo(id) });
+const todoQuery = (id: string) =>
+  resultQueryOptions({ queryKey: [...todosRoot, "detail", id], queryFn: () => api.getTodo(id) });

-const addTodo = defineMutation({
+const addTodo = resultMutationOptions({
   mutationKey: ["todos", "add"],
   mutationFn: (title: string) => api.addTodo(title),
-  onSuccess: () => queryClient.invalidateQueries({ queryKey: todoKeys.all }),
+  onSuccess: (_todo, _title, _onMutateResult, { client }) =>
+    client.invalidateQueries({ queryKey: todoKeys.all }),
 });

-createQuery(() => todoQuery(id).options);
-createMutation(() => addTodo.options);
+createQuery(() => todoQuery(id));
+createMutation(() => addTodo);

-await todoQuery(id).fetch();
-await todoQuery(id).ensure();
-await addTodo("Buy milk");
+await runQuery(queryClient, todoQuery(id));
+await runQuery(queryClient, { ...todoQuery(id), staleTime: "static" });
+await runMutation(queryClient, addTodo, "Buy milk");
```
