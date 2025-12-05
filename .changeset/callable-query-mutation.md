---
"wellcrafted": minor
---

Make query and mutation definitions directly callable

Query and mutation definitions from `defineQuery` and `defineMutation` are now directly callable functions:

```ts
// Queries - callable defaults to ensure() behavior
const { data, error } = await userQuery();  // same as userQuery.ensure()

// Mutations - callable defaults to execute() behavior
const { data, error } = await createUser({ name: 'John' });  // same as createUser.execute()
```

The explicit methods (`.ensure()`, `.fetch()`, `.execute()`) remain available for when you need different behavior or prefer explicit code.

**Breaking change**: `.options` is now a property instead of a function. Update `createQuery(query.options())` to `createQuery(query.options)`.
