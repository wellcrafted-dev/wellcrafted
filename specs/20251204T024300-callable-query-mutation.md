# Callable Query/Mutation Objects

## Problem

Currently, to execute a mutation or query imperatively, you need to call `.execute()`:

```ts
const createUser = defineMutation({...});
await createUser.execute({ name: 'John' });
```

This is verbose. Since functions are objects in JavaScript, we can make the mutation/query object itself callable while still exposing `.options` and `.execute` as properties.

## Desired API

```ts
const createUser = defineMutation({...});

// New: directly callable
await createUser({ name: 'John' });

// Still works: access options for createMutation()
createMutation(createUser.options);

// Still works: explicit .execute() for backwards compatibility
await createUser.execute({ name: 'John' });
```

## Implementation

In JavaScript, functions are objects. We can create a function and attach properties to it using `Object.assign`:

```ts
const executeFn = async (variables: TVariables) => {
  // execute logic
};

return Object.assign(executeFn, {
  options: newOptions,
  execute: executeFn,
});
```

## TypeScript Types

We need callable/hybrid types:

```ts
type DefineMutationOutput<TData, TError, TVariables, TContext> =
  ((variables: TVariables) => Promise<Result<TData, TError>>) & {
    options: MutationOptions<TData, TError, TVariables, TContext>;
    execute: (variables: TVariables) => Promise<Result<TData, TError>>;
  };
```

## Tasks

- [x] Update `DefineMutationOutput` type to be callable
- [x] Update `defineMutation` implementation to return callable function
- [x] Update `DefineQueryOutput` type to be callable (defaults to `ensure`)
- [x] Update `defineQuery` implementation to return callable function
- [x] Update JSDoc comments to reflect callable behavior

## Notes

For queries:
- Default callable behavior = `ensure()` (the recommended method for preloaders)
- `.fetch()` and `.ensure()` still available as explicit methods
- Consulted TanStack Query docs: `ensureQueryData` prioritizes cached data and only fetches if cache is empty; `fetchQuery` always evaluates freshness

For mutations:
- Default callable behavior = `execute()`
- `.execute()` still available for backwards compatibility

## Breaking Change

Changed `.options` from a function `options()` to a property `.options` for simpler access:

```ts
// Before
createMutation(createUser.options());

// After
createMutation(createUser.options);
```

## Review

Implemented callable query/mutation objects using `Object.assign` to create functions with attached properties.

Key changes to `src/query/utils.ts`:
1. Updated `DefineQueryOutput` and `DefineMutationOutput` types to be callable intersection types
2. Changed implementation to use standalone functions + `Object.assign` pattern
3. Renamed internal `executeMutation` to `runMutation` to avoid shadowing
4. Updated all JSDoc comments to document the callable behavior with examples
5. Changed `.options` from a function to a direct property (simpler API)

The build passes successfully.
