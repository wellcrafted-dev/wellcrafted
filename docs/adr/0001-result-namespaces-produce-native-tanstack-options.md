# 0001. Result namespaces produce native TanStack options

- **Status:** Proposed
- **Date:** 2026-10-21
- **Unbuilt:** `createQueries` and `createMutations` in `wellcrafted/query`, including generated method keys, descriptor inference, and contract tests.
- **Relates:** [Epicenter](https://github.com/EpicenterHQ/epicenter), `docs/adr/0661-apps-compose-result-services-through-wellcrafted-option-namespaces.md`, for application composition and cache policy.

## Context

`wellcrafted/query` adapts Result-returning functions through
`resultQueryOptions` and `resultMutationOptions`. Both return ordinary TanStack
options. `runQuery` and `runMutation` execute those options through an explicitly
supplied client and return Results. Query keys already carry TanStack's `DataTag`.

A service namespace repeats its method names and arguments when it becomes a
query namespace. A `getUser(id)` read needs a matching key, a forwarding
`queryFn`, and a place in the exported query object. A separate key map repeats
that identity again. Most of those choices follow one convention:
namespace, method name, and supplied arguments.

Mutation policy carries information that a Result signature cannot supply.
The application chooses how to observe an operation and which cached reads its
success affects. A plan preview can use mutation state even though it reads
data. The library can derive wiring without trying to infer that policy.

## Decision

**`createQueries(namespace, definitions)` and
`createMutations(namespace, definitions)` convert explicitly selected
Result-returning functions into namespaces of native options factories.** Both
exports belong to `wellcrafted/query`. Neither takes a `QueryClient`, creates
an observer, executes a service method during options construction, or adds
client-bound execution methods to its output.

The examples use the proposed exports; they are not an available API until
implemented.

```ts
import { createMutations, createQueries } from 'wellcrafted/query';

const usersKey = ['users'] as const;

const userQueries = createQueries(usersKey, {
  getUser: userService.getUser,
  listUsers: userService.listUsers,
});

const userMutations = createMutations(usersKey, {
  updateUser: {
    mutationFn: userService.updateUser,
    onSuccess: async (_saved, input, _rollback, { client }) => {
      await Promise.all([
        client.invalidateQueries({
          queryKey: userQueries.getUser(input.id).queryKey,
          exact: true,
        }),
        client.invalidateQueries({ queryKey: userQueries.listUsers.key }),
      ]);
    },
  },
});
```

### Factory inputs and outputs

**A query factory accepts its service function's arguments; a mutation factory
leaves variables to TanStack's mutation execution.** Both support synchronous
Results and promises of Results. Each entry accepts a function shorthand or a
descriptor with the corresponding Result-returning function and native options:

```ts
const queries = createQueries(['billing'], {
  overview: {
    queryFn: billingApi.overview,
    refetchOnWindowFocus: 'always',
  },
  plans: billingApi.plans,
});

const mutations = createMutations(['billing'], {
  previewPlanChange: billingApi.previewPlanChange,
});
```

The descriptor's `queryFn` or `mutationFn` supplies the service function;
the helper supplies the key. Other options keep their TanStack meaning.
`queryFn` in a query descriptor receives service arguments, not TanStack's
`QueryFunctionContext`.

| Expression | Meaning |
| --- | --- |
| `userQueries.getUser(id)` | Query options with `queryKey: [...usersKey, 'getUser', [id]]` and a Result-adapting `queryFn` |
| `userQueries.listUsers.key` | Untagged prefix `[...usersKey, 'listUsers']`, matching every argument variant |
| `userQueries.getUser(id).queryKey` | Native query key tagged with the cached success type and service error type |
| `userMutations.updateUser()` | Mutation options with `mutationKey: [...usersKey, 'updateUser']`, a Result-adapting `mutationFn`, and configured callbacks |
| `userMutations.updateUser.key` | Operation prefix `[...usersKey, 'updateUser']` |

Namespaces are readonly arrays of strings. Query keys use
`[...namespace, methodName, args]`, with one final tuple containing every
supplied argument, including `[]` for a zero-argument read. Mutation keys use
`[...namespace, methodName]`; mutation variables are supplied later. `.key` is
custom data on each generated factory, not a field added to the returned
options. `.queryKey` and `.mutationKey` retain their native TanStack names.
Keep the namespace prefix in an ordinary constant when it is needed separately.

The tuple separates arguments from namespace paths. Flattening would give both
`getUser('list')` under `['users']` and `list()` under `['users', 'getUser']`
the same key. Their bounded keys are `['users', 'getUser', ['list']]` and
`['users', 'getUser', 'list', []]`.

The query's key tag describes cached data before `select`. Prefixes carry no
claim about one cached value's type and can also match nested namespaces. Use
the full generated `.queryKey` for exact cache updates or filters, including
zero-argument reads; a factory's `.key` is only a prefix. The helper preserves
each method's argument, success, and error types, including the contextual types of mutation
callbacks. Calling a factory returns options directly, without an `.options`
property, `.fetch()`, or `.ensure()`.

```ts
const user = createQuery(() => userQueries.getUser(userId));
const updateUser = createMutation(() => userMutations.updateUser());
updateUser.mutate({ id: userId, name });

const cached = queryClient.getQueryData(userQueries.getUser(userId).queryKey);
// User | undefined

await runQuery(queryClient, userQueries.getUser(userId));
await runMutation(queryClient, userMutations.updateUser(), { id: userId, name });
```

`resultQueryOptions` and `resultMutationOptions` remain the Result-conversion
boundary. The namespace helpers build on them. The explicit adapters remain
available for custom keys, query context, or signatures outside the namespace
contract; the Result-returning runners consume either form.

### Scope of automatic mapping

**Namespace helpers map plain function objects without classifying service
behavior or reflecting over arbitrary clients.** Read arguments must be stable,
JSON-serializable cache inputs. Keys describe supplied arguments; `events()`
and `events({})` can occupy different entries. If those calls must share an
entry, normalize before calling the generated factory or use an explicit
`resultQueryOptions` adapter. Exact-entry writes use the same canonical inputs
as reads. TanStack's JSON hashing can equate values such as array elements
`undefined` and `null`; a service that distinguishes them needs an explicit
cache-input representation. The mapper does not trim arguments, inspect default
parameters, or invent a serializer for signals, callbacks, or streams.

Mutation functions accept zero arguments or one variables argument, including
an optional argument. Adapt a service with several arguments to one object
explicitly. Forward only the service variables, so TanStack's execution context
cannot accidentally become a service's transport-options argument. Lifecycle
callbacks still receive the native context, including its executing `client`.

Selected functions must be callable without an implicit receiver. Bind or wrap
a receiver-dependent method before selecting it. Generic or overloaded methods
need an explicit adapter when their argument-to-result relationship cannot be
preserved. Recursive namespaces, proxies, infinite queries, and streaming
adapters are outside these helpers' contract.

### Shared policy and component effects

**Mutation descriptors own shared lifecycle policy; components add interaction
effects through native per-call mutation callbacks.** Invalidation uses ordinary
`onSuccess`, `onSettled`, and client methods. There is no `invalidates` metadata
language or mandatory global `MutationCache` configuration.

Returning an invalidation promise from the descriptor's `onSuccess` includes
that refresh in the mutation's pending lifetime. Per-call callbacks remain
component effects and may be skipped after observer removal or replacement.
Spreading options and replacing `onSuccess` replaces the shared policy; the
library does not claim to make ordinary options immutable or unoverrideable.
The helper adds no callback-merging overload or optimistic rollback protocol.

Direct service calls continue to return Results and bypass query-layer policy.
Shared invalidation runs when hooks or `runMutation` execute the generated
mutation options. Invalidation stays outside `mutationFn`: a failure in cache
policy must not cause mutation retries to repeat a completed service operation.

## Consequences

- Regular service reads lose handwritten key maps, forwarding functions, and
  repeated parameter types. The key and service arguments come from the same
  factory invocation.
- Classification and cache relationships remain explicit. Mutations can refer
  to query prefixes without a registry or annotations on the original service.
- Method names become cache identity. Renaming an entry changes its key; any
  persisted query cache needs a corresponding invalidation or version policy.
- The library takes on mapped-type inference, precise options types, and two
  construction helpers. Explicit adapters remain necessary for exceptions.
- An inferred service error type describes expected service failures. Callback
  and programming exceptions retain the existing TanStack and runner behavior;
  a namespace helper does not establish an exhaustive error model for them.
- Implementation must verify heterogeneous method inference, optional inputs,
  `select`, typed cache reads, callback context, mutation variable rejection,
  key layout, and Result conversion against the supported TanStack versions.
  Declaration experiments establish feasibility, not a shipped implementation.

## Considered alternatives

- **Keep only explicit adapters.** They give every key and argument transform
  an independent definition, but regular namespaces repeat derivable identity
  and forwarding. They remain the path for exceptional operations.
- **One grouped query-and-mutation factory.** It bundles two maps while making
  mutation callbacks refer back into a result still under construction. Two
  declarations express that dependency without self-reference.
- **Annotate original services or expose both modes on every method.** This
  couples services to one observation policy or leaves classification to every
  component. The selected maps state that choice once at the consuming edge.
- **A recursive proxy.** Plain selected functions already exist at runtime;
  eager wrappers do not need dynamic path interception.
- **Global invalidation metadata.** It adds client installation and dispatch
  machinery for relationships that native typed callbacks already express.

## References

- [TanStack mutation callbacks](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)
- [Invalidation from mutations](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations)
- [tRPC's native options integration](https://trpc.io/blog/introducing-tanstack-react-query-client)
