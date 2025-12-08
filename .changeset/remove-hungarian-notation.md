---
"wellcrafted": minor
---

**BREAKING**: Rename `resultQueryFn` to `queryFn` and `resultMutationFn` to `mutationFn`

The `result` prefix was redundant since the TypeScript signature already encodes that these functions return Result types. This removes unnecessary Hungarian notation from the API.

Migration:

```typescript
// Before
defineQuery({
  queryKey: ['users'],
  resultQueryFn: () => getUsers(),
});

defineMutation({
  mutationKey: ['users', 'create'],
  resultMutationFn: (input) => createUser(input),
});

// After
defineQuery({
  queryKey: ['users'],
  queryFn: () => getUsers(),
});

defineMutation({
  mutationKey: ['users', 'create'],
  mutationFn: (input) => createUser(input),
});
```
