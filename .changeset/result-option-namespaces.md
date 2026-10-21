---
"wellcrafted": minor
---

Add `createQueries` and `createMutations` to `wellcrafted/query` for composing selected Result-returning service methods into native TanStack options factories.

```ts
const queries = createQueries(['users'], {
  getUser: userService.getUser,
});
const mutations = createMutations(['users'], {
  updateUser: userService.updateUser,
});

const user = createQuery(() => queries.getUser(userId));
const update = createMutation(() => mutations.updateUser());
update.mutate({ id: userId, name: 'Ada' });
```

Query keys use `[...namespace, method, args]`, with the supplied arguments in one final tuple. Each factory's `.key` is an untagged operation prefix; returned options retain native `.queryKey` and `.mutationKey`. Mutation descriptors accept shared callbacks such as `onSuccess`, with the executing client supplied by TanStack.

Services keep their Result API. The existing explicit options adapters and Result runners remain available. Optimistic namespace callbacks need annotated `onMutate` parameters to infer rollback data across callbacks; `resultMutationOptions` retains full unannotated optimistic inference.
