---
"wellcrafted": minor
---

Add `defineKeys` and infer literal `mutationKey` tuples in `defineMutation` without `as const`.

**`defineMutation`** now uses TypeScript 5.0's `const` type parameter modifier on `TMutationKey`, mirroring the recent change to `defineQuery`. `mutationKey: ['users', 'create']` infers as `readonly ['users', 'create']` instead of widening to `string[]`.

```ts
// Before
defineMutation({
  mutationKey: ['users', 'create'] as const,
  mutationFn: ...
});

// After
defineMutation({
  mutationKey: ['users', 'create'],
  mutationFn: ...
});
```

**`defineKeys`** is a new identity helper for declaring TanStack Query key maps. It uses the `const` modifier to preserve tuple types on static entries, and a strict tuple constraint to narrow factory return shapes without `as const`. Factory bodies still need `as const` for literal narrowing of static positions.

```ts
import { defineKeys } from 'wellcrafted/query';

const userKeys = defineKeys({
  all: ['users'],                                 // readonly ['users']
  active: ['users', 'active'],                    // readonly ['users', 'active']
  detail: (id: string) => ['users', id],          // [string, string]
  page: (n: number) => ['users', n] as const,     // readonly ['users', number]
});
```

Without `defineKeys`, the same map requires `as const` on every line. The const modifier on a generic does not reach into function-body return-type inference, which is why factory entries with literal positions like `'users'` still need `as const` inside the body to preserve the literal.
