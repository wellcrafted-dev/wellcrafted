---
name: tanstack-query
description: TanStack Query with wellcrafted/query, resultQueryOptions, resultMutationOptions, runQuery, and runMutation. Use when wiring Result-returning services into TanStack Query, organizing query keys and option factories, invalidating from mutations, or running queries and mutations imperatively.
---

# TanStack Query with wellcrafted

```typescript
import {
	resultMutationOptions,
	resultQueryOptions,
	runMutation,
	runQuery,
} from 'wellcrafted/query';
```

Ground behavior claims in `src/query/utils.ts` for the installed version. The module exports exactly these four functions and requires `@tanstack/query-core` 5.102 or later (optional peer dependency).

`createQueryFactories`, `defineQuery`, `defineMutation`, `defineKeys`, `.options`, `.fetch()`, `.ensure()`, and callable mutations no longer exist. If you see them in a codebase on 0.45 or later, migrate them (table at the end).

## 1. Definitions are plain TanStack options

`resultQueryOptions` and `resultMutationOptions` take a Result-returning `queryFn`/`mutationFn` and return ordinary TanStack options. `Ok` resolves, `Err` throws into TanStack's error channel, and the error type is inferred from the Result.

Pass them straight to hooks. There is no `.options` hop:

```typescript
// Svelte 5
const todo = createQuery(() => todoQueries.detail(id));
const add = createMutation(() => addTodo);

// React
const todo = useQuery(todoQueries.detail(id));
const add = useMutation(addTodo);
```

Anything in TanStack that accepts options takes them: `useQueries` and `queryClient.query`. Override by spreading: `{ ...todoQueries.detail(id), enabled: !!id }`.

## 2. Pass the client where you call; never capture it where you define

Definitions take no client.

- Hooks get the client from the framework provider.
- `runQuery(client, options)` and `runMutation(client, options, variables)` take it as an argument.
- Mutation `mutationFn(variables, context)` and every lifecycle callback receive TanStack's `MutationFunctionContext` (`{ client, meta, mutationKey }`). Invalidate through `context.client`:

```typescript
export const addTodo = resultMutationOptions({
	mutationKey: [...todosRoot, 'add'],
	mutationFn: (title: string) => api.addTodo(title),
	onSuccess: (_todo, _title, _onMutateResult, { client }) =>
		client.invalidateQueries({ queryKey: todoKeys.lists }),
});
```

Client lifetime:

- Single-page app: `export const queryClient = new QueryClient()` in one module.
- SSR or per-session isolation: one client per request or session, same definitions.
- Per-session transport (authenticated fetch, session database): build the option factories inside the session constructor. They close over the transport and still take no client. Keep the key factory at module level.

Flag any definition that imports a `queryClient` to call `invalidateQueries` or `setQueryData`; use `context.client` instead.

## 3. Key factory holds groups; option factories own leaf keys

```typescript
const todosRoot = ['todos'] as const;

export const todoKeys = {
	all: todosRoot,
	lists: [...todosRoot, 'list'] as const,
};

export const todoQueries = {
	list: (filter: TodoFilter) =>
		resultQueryOptions({
			queryKey: [...todoKeys.lists, filter],
			queryFn: () => api.listTodos(filter),
		}),
	detail: (id: string) =>
		resultQueryOptions({
			queryKey: [...todosRoot, 'detail', id],
			queryFn: () => api.getTodo(id),
		}),
};
```

- The key factory holds groups (root and prefixes). A group belongs to no single query.
- Option factories build each leaf key by spreading a group. Spread keys stay literal tuples; `as const` is optional on leaves.
- Every key spreads the root, so `invalidateQueries({ queryKey: todoKeys.all })` reaches every leaf by construction.
- The root is its own constant: referencing `todoKeys.all` inside its own object literal can trip TypeScript's circularity check.

## 4. Which key to use

| You want to | Use |
| --- | --- |
| Invalidate, cancel, or refetch a group | `todoKeys.all`, `todoKeys.lists` |
| Anything about one entry: read or write its data, invalidate exactly it | `todoQueries.detail(id).queryKey` |

`options.queryKey` carries a `DataTag`, so `getQueryData` and `setQueryData` infer the type without a cast, and the leaf key lives in one place:

```typescript
const { queryKey } = todoQueries.detail(id);
queryClient.getQueryData(queryKey); // Todo | undefined
```

Extract a leaf key into the key factory only when some code needs it without the option factory, for example a module that cannot reach the API client or session. Do not pre-extract every leaf "for symmetry".

## 5. Imperative calls go through the cache, or not at all

`runQuery` and `runMutation` exist for deduplication, cache fill, staleness, mutation callbacks, and `isMutating`.

```typescript
const { data: todo, error } = await runQuery(queryClient, todoQueries.detail(id));
if (error instanceof CancelledError) return;
if (error) return Err(error);

const { error: addError } = await runMutation(queryClient, addTodo, todo.title);
```

- `runQuery` wraps `client.query` and returns `Result<TData, TError | CancelledError>`. Fresh cached data returns without a request; stale or missing data is fetched.
- "Any cached data is fine, fetch only on a miss": `runQuery(client, { ...opts, staleTime: 'static' })`.
- Check cancellation with `error instanceof CancelledError` from `@tanstack/query-core`. `isCancelledError` is deprecated upstream.
- `runMutation` runs through a `MutationObserver`, so definition callbacks and invalidation run, and `useIsMutating`, `useMutationState`, scopes, and devtools see it. Returns `Result<TData, TError>`.

If nothing observes the data, call the service directly. Do not route a one-off script through the cache.

## 6. Result in, Result out

Services return Results. The `result*Options` adapters turn them into TanStack's contract; `runQuery`/`runMutation` turn TanStack back into Results.

```typescript
// WRONG: unwraps and throws by hand before the adapter
queryFn: async () => {
	const { data, error } = await api.getTodo(id);
	if (error) throw error;
	return data;
},

// RIGHT
queryFn: () => api.getTodo(id),
```

Mapping a service error to a UI error is fine; keep returning a Result:

```typescript
queryFn: async () => {
	const { data, error } = await api.getTodo(id);
	if (error) return Err({ title: 'Could not load todo', description: error.message });
	return Ok(data);
},
```

Also wrong: wrapping `runQuery` or `runMutation` results in `try/catch`. They do not throw.

## Testing

Fresh `QueryClient` per test with `retry: false`, then assert on the Results from `runQuery`/`runMutation` and on the cache:

```typescript
const client = new QueryClient({
	defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
const todo = expectOk(await runQuery(client, todoQueries.detail('t1')));
expect(client.getQueryData(todoQueries.detail('t1').queryKey)).toEqual(todo);
```

## Migrating from 0.44

| Before | After |
| --- | --- |
| `createQueryFactories(queryClient)` | Delete it. |
| `defineQuery(...)` / `defineMutation(...)` | `resultQueryOptions(...)` / `resultMutationOptions(...)` |
| `createQuery(() => q.options)` / `useQuery(q.options)` | `createQuery(() => q)` / `useQuery(q)` |
| `await q.fetch()` | `await runQuery(queryClient, q)` |
| `await q.ensure()` | `await runQuery(queryClient, { ...q, staleTime: 'static' })` |
| `await mutation(vars)` | `await runMutation(queryClient, mutation, vars)` |
| Captured `queryClient` in a mutation | `context.client` |
| `defineKeys(...)` | Plain `as const` group keys; leaf keys inside option factories |

See also: `result-types` for the Result shape, `define-errors` for error variants.
