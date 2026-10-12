# wellcrafted/query

Adapters between Result-returning services and TanStack Query.

Your services return `Result<T, E>`. TanStack Query expects a `queryFn` that resolves with data or throws an error. `wellcrafted/query` converts in both directions:

- `resultQueryOptions` and `resultMutationOptions` turn a Result-returning function into plain TanStack options. `Ok` resolves, `Err` throws into TanStack's error channel, and the error type comes from the Result.
- `runQuery` and `runMutation` run those options through a `QueryClient` and hand you a Result again, for workflows and event handlers.

That is the whole module: four functions. Everything else is TanStack.

```sh
bun add wellcrafted @tanstack/query-core
```

`@tanstack/query-core` is an optional peer dependency (`^5.102.0`). Framework adapters such as `@tanstack/react-query` and `@tanstack/svelte-query` already depend on it.

## Quick start

```ts
// lib/query/client.ts
import { QueryClient } from '@tanstack/query-core';

export const queryClient = new QueryClient();
```

```ts
// lib/query/todos.ts
import { resultMutationOptions, resultQueryOptions } from 'wellcrafted/query';
import * as api from '$lib/services/todos'; // returns Result<T, TodoError>

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

export const addTodo = resultMutationOptions({
  mutationKey: [...todosRoot, 'add'],
  mutationFn: (title: string) => api.addTodo(title),
  onSuccess: (_todo, _title, _onMutateResult, { client }) =>
    client.invalidateQueries({ queryKey: todoKeys.lists }),
});
```

Hooks take the definitions directly:

```svelte
<script lang="ts">
  import { createMutation, createQuery } from '@tanstack/svelte-query';
  import { addTodo, todoQueries } from '$lib/query/todos';

  let { id }: { id: string } = $props();

  const todo = createQuery(() => todoQueries.detail(id));
  const add = createMutation(() => addTodo);
</script>
```

```tsx
import { useMutation, useQuery } from '@tanstack/react-query';

function Todo({ id }: { id: string }) {
  const todo = useQuery(todoQueries.detail(id));
  const add = useMutation(addTodo);
  // todo.error is TodoError | null
}
```

Anything in TanStack that accepts options takes them too: `useQueries` and `queryClient.query`.

Workflows run the same definitions and get Results back:

```ts
import { runMutation, runQuery } from 'wellcrafted/query';

const { data: todo, error } = await runQuery(queryClient, todoQueries.detail(id));
if (error) return Err(error);

const { error: addError } = await runMutation(queryClient, addTodo, 'Buy milk');
```

## API

### `resultQueryOptions(input)`

Takes TanStack query options whose `queryFn` returns `Result<TQueryFnData, TError>` (sync or async) and returns plain TanStack query options. Every other option (`staleTime`, `enabled`, `select`, `placeholderData`, and so on) passes through unchanged.

The returned `queryKey` carries a `DataTag`, the same tag TanStack's own `queryOptions()` adds. Cache reads and writes through that key are typed:

```ts
const { queryKey } = todoQueries.detail(id);
queryClient.getQueryData(queryKey); // Todo | undefined
queryClient.setQueryData(queryKey, (old) => old && { ...old, done: true });
```

`queryKey` is inferred as a literal tuple, including keys built by spreading a group, so `as const` is optional at the call site.

### `resultMutationOptions(input)`

Takes TanStack mutation options whose `mutationFn` returns `Result<TData, TError>` and returns plain TanStack mutation options. `mutationKey` is required.

`mutationFn(variables, context)` and the lifecycle callbacks receive TanStack's `MutationFunctionContext`, `{ client, meta, mutationKey }`. Use `context.client` to invalidate or update the cache, so the definition never imports a client:

```ts
export const toggleTodo = resultMutationOptions({
  mutationKey: [...todosRoot, 'toggle'],
  mutationFn: (id: string) => api.toggleTodo(id),
  onSuccess: (todo, id, _onMutateResult, { client }) => {
    client.setQueryData(todoQueries.detail(id).queryKey, todo);
    return client.invalidateQueries({ queryKey: todoKeys.lists });
  },
});
```

### `runQuery(client, options)`

```ts
runQuery(client: QueryClient, options): Promise<Result<TData, TError | CancelledError>>
```

Wraps `client.query(options)`, TanStack's imperative read (added in 5.102, replacing `fetchQuery` and `ensureQueryData`). Fresh cached data comes back without a request; stale or missing data is fetched; an in-flight request for the same key is shared. The result lands in the cache, so every observer sees it.

`staleTime` decides what counts as fresh. To accept any cached data and fetch only when the cache is empty, pass `staleTime: 'static'`:

```ts
await runQuery(queryClient, { ...todoQueries.detail(id), staleTime: 'static' });
```

The error side includes TanStack's `CancelledError`, which the call rejects with when the query is cancelled or the client is cleared mid-flight. Check it with `instanceof` (`isCancelledError` is deprecated upstream):

```ts
import { CancelledError } from '@tanstack/query-core';

const { data, error } = await runQuery(queryClient, todoQueries.detail(id));
if (error instanceof CancelledError) return;
if (error) return report(error);
```

### `runMutation(client, options, variables)`

```ts
runMutation(client: QueryClient, options, variables): Promise<Result<TData, TError>>
```

Runs the mutation through a `MutationObserver`, TanStack's public way to run a mutation outside a hook, then detaches the observer so the finished mutation is garbage collected after `gcTime`. Because it goes through the mutation cache, the definition's `onMutate`/`onSuccess`/`onError`/`onSettled` run (and with them any invalidation), and `useIsMutating`, `useMutationState`, mutation scopes, and devtools all see it.

```ts
const { data: todo, error } = await runMutation(queryClient, addTodo, 'Buy milk');
```

## Keys and option factories

The key factory holds groups: the root and the prefixes you invalidate together. A group belongs to no single query. Option factories own the leaf keys, and build each one by spreading a group:

```ts
const todosRoot = ['todos'] as const;

export const todoKeys = {
  all: todosRoot,
  lists: [...todosRoot, 'list'] as const,
};

export const todoQueries = {
  list: (filter: TodoFilter) =>
    resultQueryOptions({ queryKey: [...todoKeys.lists, filter], queryFn: () => api.listTodos(filter) }),
  detail: (id: string) =>
    resultQueryOptions({ queryKey: [...todosRoot, 'detail', id], queryFn: () => api.getTodo(id) }),
};
```

Every key spreads the root, so every key starts with it, and `invalidateQueries({ queryKey: todoKeys.all })` reaches every leaf by construction. The root is its own constant because referencing `todoKeys.all` inside its own object literal can trip TypeScript's circularity check.

Which key to use:

| You want to | Use | Why |
| --- | --- | --- |
| Invalidate, cancel, or refetch a group | `todoKeys.all`, `todoKeys.lists` | A group belongs to no single query, and the key factory imports without the API client or session. |
| Do anything with one entry: read or write its data, invalidate exactly it | `todoQueries.detail(id).queryKey` | The `DataTag` types `getQueryData` and `setQueryData`, and the leaf key lives in one place. |

Extract a leaf key into the key factory only when some code needs it without the option factory, for example a module that cannot reach the API client or session. Keep the smaller piece underneath, and pull it out on its own only when it must be reused on its own.

## Imperative use

`runQuery` and `runMutation` exist to go through the cache: request deduplication, cache fill, staleness, mutation callbacks, and `isMutating`. Use them when something else observes the data, such as a component showing the same todo, or a spinner keyed on `useIsMutating`.

If nothing observes the data, call the service directly. A one-off export script that reads every todo does not need a cache entry.

## Result in, Result out

Services return Results. `resultQueryOptions` and `resultMutationOptions` adapt them for TanStack. `runQuery` and `runMutation` adapt back for workflows. Pass the Result-returning function straight in; do not unwrap first.

```ts
// Wrong: throws by hand
queryFn: async () => {
  const { data, error } = await api.getTodo(id);
  if (error) throw error;
  return data;
},

// Right
queryFn: () => api.getTodo(id),
```

To change the error a component sees, map it inside `queryFn` and keep returning a Result:

```ts
queryFn: async () => {
  const { data, error } = await api.getTodo(id);
  if (error) return Err({ title: 'Could not load todo', description: error.message });
  return Ok(data);
},
```

## Client lifetime

Definitions take no client. You pass the client where you call: a framework provider for hooks, an argument for `runQuery` and `runMutation`, `context.client` inside mutation callbacks.

- Single-page app: create one client in one module (`export const queryClient = new QueryClient()`) and import it where you call.
- SSR or per-session isolation: create a client per request or session and use the same definitions with it. Nothing leaks between requests because no definition holds a client.

When a definition needs per-session transport (an authenticated fetch, a session-scoped database), build the option factories inside the session constructor. They close over the transport and still take no client. The key factory stays at module level, so code outside the session can still invalidate groups:

```ts
export function createTodoQueries(api: TodoApi) {
  return {
    detail: (id: string) =>
      resultQueryOptions({ queryKey: [...todosRoot, 'detail', id], queryFn: () => api.getTodo(id) }),
  };
}
```

## Testing

Create a fresh `QueryClient` per test with retries off, then drive the definitions with `runQuery` and `runMutation`:

```ts
import { beforeEach, expect, it } from 'bun:test';
import { QueryClient } from '@tanstack/query-core';
import { runMutation, runQuery } from 'wellcrafted/query';
import { expectErr, expectOk } from 'wellcrafted/testing';

let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

it('reads a todo into the cache', async () => {
  const todo = expectOk(await runQuery(client, todoQueries.detail('t1')));
  expect(client.getQueryData(todoQueries.detail('t1').queryKey)).toEqual(todo);
});

it('invalidates lists after adding a todo', async () => {
  const list = todoQueries.list('all');
  await runQuery(client, list);
  expectOk(await runMutation(client, addTodo, 'Buy milk'));
  expect(client.getQueryState(list.queryKey)?.isInvalidated).toBe(true);
});

it('returns the service error', async () => {
  const error = expectErr(await runQuery(client, todoQueries.detail('missing')));
  expect(error.name).toBe('NotFound');
});
```

Because the client is an argument, tests never share cache state and never mock a module-level client.

## Migrating from 0.44

| Before | After |
| --- | --- |
| `const { defineQuery, defineMutation } = createQueryFactories(queryClient)` | Delete. Import `resultQueryOptions` and `resultMutationOptions`. |
| `defineQuery({ queryKey, queryFn })` | `resultQueryOptions({ queryKey, queryFn })` |
| `defineMutation({ mutationKey, mutationFn })` | `resultMutationOptions({ mutationKey, mutationFn })` |
| `createQuery(() => userQuery.options)` | `createQuery(() => userQuery)` |
| `useMutation(createPost.options)` | `useMutation(createPost)` |
| `await userQuery.fetch()` | `await runQuery(queryClient, userQuery)` |
| `await userQuery.ensure()` | `await runQuery(queryClient, { ...userQuery, staleTime: 'static' })` |
| `await createPost(input)` | `await runMutation(queryClient, createPost, input)` |
| A captured `queryClient` inside `mutationFn` or a callback | `onSuccess: (data, vars, onMutateResult, { client }) => client.invalidateQueries(...)` |
| `defineKeys(...)` | A plain `as const` key factory for groups; leaf keys inside the option factories (see [Keys and option factories](#keys-and-option-factories)). |

Upgrade `@tanstack/query-core` (or your framework adapter) to `5.102.0` or later; `runQuery` calls `client.query`.
