# 0001. Result namespaces produce native TanStack options

- **Status:** Proposed
- **Date:** 2026-10-21; revised 2026-11-11 to take functions only
- **Implementation:** `resultQueries` and `resultMutations` in `wellcrafted/query` (`src/query/namespaces.ts`), with contract tests.
- **Relates:** [Epicenter](https://github.com/EpicenterHQ/epicenter), `docs/adr/0661-apps-compose-result-services-through-wellcrafted-option-namespaces.md`, for application composition and cache policy.

## Context

`wellcrafted/query` adapts Result-returning functions through
`resultQueryOptions` and `resultMutationOptions`. Both return ordinary TanStack
options. `runQuery` and `runMutation` execute those options through an explicitly
supplied client and return Results. Query keys already carry TanStack's `DataTag`.

A service namespace repeats its method names and arguments when it becomes a
query namespace. A `get(id)` read needs a matching key, a forwarding
`queryFn`, and a place in the exported query object. A separate key map repeats
that identity again. Most of those choices follow one convention:
namespace, method name, and supplied arguments.

Policy is different. Which reads a write affects, how fresh a read must be, and
whether an update is optimistic are application decisions a Result signature
cannot supply. TanStack already has places for each: options spread at a use
site, defaults registered on the client by key prefix, and the client's
`MutationCache`. The first version of this decision also let each map entry
carry options and callbacks as a descriptor. Typing callbacks written inside a
map needed two extra inferred type maps, still could not infer an optimistic
rollback without annotations, and gave policy a third home.

## Decision

**`resultQueries(namespace, methods)` and `resultMutations(namespace, methods)`
take a map of Result-returning functions and return native TanStack options
keyed by namespace and method name. They take functions only.** Neither takes a
`QueryClient`, creates an observer, or calls a method while building options.

```ts
import { resultMutations, resultQueries } from 'wellcrafted/query';

const users = resultQueries(['users'], {
  get: userService.get,
  list: userService.list,
});

const userWrites = resultMutations(['users'], {
  update: userService.update,
});

const user = createQuery(() => users.get(userId));
const update = createMutation(() => userWrites.update);
```

### Entries and keys

| Expression | Meaning |
| --- | --- |
| `users.get(id)` | Query options with `queryKey: ['users', 'get', [id]]` and a Result-adapting `queryFn` |
| `users.get(id).queryKey` | The native key, tagged with the cached data and error types |
| `users.get.key` | Untagged prefix `['users', 'get']`, matching every argument variant |
| `userWrites.update` | Mutation options with `mutationKey: ['users', 'update']` and a Result-adapting `mutationFn` |

A query entry is a function because its key depends on arguments. A mutation
entry is the options object itself because its variables arrive at execution;
a function returning the same object each time would add a call and a second
name for its key.

Query keys are `[...namespace, method, args]`, with every supplied argument in
one final tuple, `[]` for none. The tuple separates arguments from namespace
paths: `get('list')` under `['users']` is `['users', 'get', ['list']]`, while
`list()` under `['users', 'get']` is `['users', 'get', 'list', []]`. Mutation
keys are `[...namespace, method]`.

The key's tag describes cached data before `select`. A prefix carries no claim
about one value's type and can also match nested namespaces. Use the full
`.queryKey` for exact cache reads, writes, and filters.

### Where behavior goes

**Entries carry identity and the Result conversion. Behavior goes where its
scope is, using TanStack's existing mechanisms.**

- **One use:** spread the entry into the hook's options.
  `createQuery(() => ({ ...users.list(), select: (all) => all.length }))`.
  TanStack infers what is added.
- **A method or namespace:** register defaults on the client by prefix,
  `client.setQueryDefaults(users.list.key, { staleTime: 30_000 })` or
  `setMutationDefaults`. A rule for every write goes in the client's
  `MutationCache`; the documented one invalidates
  `mutationKey.slice(0, -1)`, the writing method's namespace, `onSettled`.
- **A shared variant:** spread the entry into the adapter's `mutationOptions`
  or `queryOptions` and export the result. These infer callback types,
  including an optimistic rollback, without annotations.

A `MutationCache` rule runs in addition to an entry's own callbacks, so a
component spreading an entry cannot drop it. Returning its invalidation promise
keeps the mutation pending until the refresh finishes. The library ships the
rule as a documented recipe, not an export, because it depends on the
application's key layout: it assumes `[...namespace, method]` keys, skips
mutations without a key, and would invalidate everything for a one-segment key.

Matching defaults merge in registration order, not by specificity, so the
broad prefix is registered first. Defaults are not typed by a query's data;
anything that needs the data's type, such as `select` or a cache update, is
spread where the type is known.

### Scope of automatic mapping

**The helpers map plain objects of functions without classifying service
behavior or reflecting over arbitrary clients.** Mapping covers own enumerable
string properties; numeric names become strings and symbols are skipped. Methods
are called without a receiver, so callers pass bound methods or closures, and
annotate the parameters of new wrappers.

Query arguments must be stable, JSON-serializable cache inputs. Keys describe
supplied arguments: `get()` and `get(undefined)` are different entries. The
helpers do not trim arguments, inspect defaults, or serialize signals,
callbacks, or streams. A method receives only its arguments, not TanStack's
query context, so it cannot see the abort signal.

Mutation methods accept zero arguments or one variables argument, including an
optional one; others are a type error. Only the variables reach the method, so
TanStack's execution context cannot become a service's transport-options
argument. Callbacks still receive the native context, including its client.

`resultQueryOptions` and `resultMutationOptions` remain the Result-conversion
boundary and the path for custom keys, query context, and generic or
overloaded signatures. The runners consume either form.

## Consequences

- Service reads and writes lose handwritten key maps, forwarding functions, and
  repeated parameter types. A whole service's query layer is two calls.
- Policy has two homes: the client, by key, and the use site, by spread. A
  shared variant is an ordinary exported options object.
- Method names become cache identity. Renaming a method changes its key; a
  persisted query cache needs an invalidation or version policy.
- Per-method options move out of the definition. A setting that one map entry
  once carried is now a `setQueryDefaults` line beside the client or a spread.
- Services cannot cancel their own requests from these entries. That suits
  local and short calls; a cancellable request uses `resultQueryOptions`.
- The inferred error type describes expected service failures. Callback and
  programming exceptions keep the existing TanStack and runner behavior.

## Considered alternatives

- **Keep only explicit adapters.** Every key is independent, but regular
  namespaces repeat derivable identity and forwarding. They remain the path for
  exceptions.
- **Descriptors in the map** (`{ queryFn, staleTime, select }`, the first
  version of this decision). Typing them took two extra inferred type maps, an
  optimistic `onMutate` still needed every parameter annotated, and a setting
  could live in the definition, the client, or the use site. Spreading and
  client defaults cover the same cases with TanStack's own inference.
- **Mutation entries as functions** (`writes.update()`). The call returns the
  same options every time and needs a separate `.key` beside `.mutationKey`.
- **One grouped query-and-mutation factory.** Mutation callbacks would refer
  back into a result still under construction.
- **Annotate original services or expose both modes on every method.** This
  couples services to one observation policy. The selected maps state that
  choice once at the consuming edge.
- **A recursive proxy.** Plain selected functions already exist at runtime.
- **An `invalidates` metadata language.** It needs a dispatcher for
  relationships the key layout and a `MutationCache` rule already express. The
  first version rejected global configuration altogether; the rule is now a
  recommendation, not a requirement, and needs no library machinery.

## References

- [TanStack mutation callbacks](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)
- [Invalidation from mutations](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations)
- [Query defaults](https://tanstack.com/query/latest/docs/reference/QueryClient#queryclientsetquerydefaults)
- [tRPC's native options integration](https://trpc.io/blog/introducing-tanstack-react-query-client)
