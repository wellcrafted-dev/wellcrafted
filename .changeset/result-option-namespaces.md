---
"wellcrafted": minor
---

Add `resultQueries` and `resultMutations` to `wellcrafted/query`. They turn selected Result-returning service methods into native TanStack options, with keys derived from a namespace and the method names.

```ts
const users = resultQueries(['users'], { get: userService.get });
const userWrites = resultMutations(['users'], { update: userService.update });

const user = createQuery(() => users.get(userId));
const update = createMutation(() => userWrites.update);
update.mutate({ id: userId, name: 'Ada' });
```

Query keys are `[...namespace, method, args]`, with the arguments in one final tuple; each query factory's `.key` is the prefix of every argument variant. A mutation entry is the options object itself, keyed `[...namespace, method]`. The helpers take functions only. The docs recommend one `MutationCache` rule that invalidates every query after any write, which refetches only what is on screen; a write can narrow it with `meta.invalidates`. Add options for one use by spreading an entry, set defaults for a method or namespace with `setQueryDefaults`/`setMutationDefaults`, and name a shared variant by spreading into your adapter's `mutationOptions` or `queryOptions`.
