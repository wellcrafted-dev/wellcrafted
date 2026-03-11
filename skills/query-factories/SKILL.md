---
name: query-factories
description: TanStack Query integration with wellcrafted's createQueryFactories, defineQuery, and defineMutation. Use when setting up queries/mutations that return Result types or using the dual interface pattern.
---

# Query Factories

```typescript
import { createQueryFactories } from 'wellcrafted/query';
```

## Setup

`createQueryFactories` takes a TanStack `QueryClient` and returns `defineQuery` and `defineMutation`:

```typescript
import { QueryClient } from '@tanstack/react-query'; // or @tanstack/svelte-query
import { createQueryFactories } from 'wellcrafted/query';

const queryClient = new QueryClient();
const { defineQuery, defineMutation } = createQueryFactories(queryClient);
```

## defineQuery

Define a query whose `queryFn` returns a `Result<T, E>`:

```typescript
import { Ok, Err, type Result } from 'wellcrafted/result';

const userQuery = defineQuery({
  queryKey: ['users', userId],
  queryFn: async (): Promise<Result<User, UserError>> => {
    const { data, error } = await getUser(userId);
    if (error) {
      return Err({
        title: 'Failed to load user',
        description: error.message,
      });
    }
    return Ok(data);
  },
});
```

## defineMutation

Same pattern for mutations:

```typescript
const createPost = defineMutation({
  mutationFn: async (input: { title: string; body: string }) => {
    const { data, error } = await postService.create(input);
    if (error) {
      return Err({
        title: 'Failed to create post',
        description: error.message,
      });
    }
    return Ok(data);
  },
});
```

## Dual Interface

Every query and mutation provides two ways to use it — reactive and imperative.

### Reactive: `.options`

Pass `.options` to your framework's query hook. It's a static object — wrap it in an accessor for Svelte, pass directly in React.

```typescript
// React
import { useQuery, useMutation } from '@tanstack/react-query';

const query = useQuery(userQuery.options);
const mutation = useMutation(createPost.options);
```

```typescript
// Svelte
import { createQuery, createMutation } from '@tanstack/svelte-query';

const query = createQuery(() => userQuery.options);
const mutation = createMutation(() => createPost.options);
```

### Imperative: `.fetch()` / `.execute()`

Use in event handlers and workflows without reactive overhead:

```typescript
// Queries use .fetch()
const { data, error } = await userQuery.fetch();

// Mutations use .execute()
const { data, error } = await createPost.execute({
  title: 'Hello',
  body: 'World',
});
```

### When to use each

| `.options` (reactive) | `.fetch()` / `.execute()` (imperative) |
| --- | --- |
| Component data display | Event handlers |
| Loading/error states | Sequential workflows |
| Auto-refetch | One-time operations |
| Cache synchronization | Outside component context |

## Error Transformation

Transform service errors into user-facing errors at the query boundary. Service errors describe what went wrong technically; user-facing errors describe what to show the user.

```typescript
const userQuery = defineQuery({
  queryKey: ['users', userId],
  queryFn: async () => {
    // Service returns technical error (UserError.NotFound, UserError.FetchFailed)
    const { data, error } = await getUser(userId);

    if (error) {
      // Transform to user-facing error
      return Err({
        title: 'Failed to load user',
        description: error.message,
      });
    }

    return Ok(data);
  },
});
```

### Anti-pattern: returning raw service errors

```typescript
// WRONG — raw service errors leak into the UI layer
const userQuery = defineQuery({
  queryKey: ['users', userId],
  queryFn: () => getUser(userId), // Raw UserError reaches components
});

// CORRECT — transform at the boundary
const userQuery = defineQuery({
  queryKey: ['users', userId],
  queryFn: async () => {
    const { data, error } = await getUser(userId);
    if (error) return Err({ title: 'Failed to load user', description: error.message });
    return Ok(data);
  },
});
```

## Query Key Organization

Organize keys hierarchically for targeted cache invalidation:

```typescript
const userKeys = {
  all: ['users'] as const,
  lists: ['users', 'list'] as const,
  byId: (id: string) => ['users', id] as const,
  posts: (id: string) => ['users', id, 'posts'] as const,
};
```

Invalidating `['users']` clears everything; invalidating `['users', id]` clears just that user.

## Cache Management

Optimistic updates for instant UI feedback:

```typescript
const updateUser = defineMutation({
  mutationFn: async (input: { userId: string; name: string }) => {
    const { data, error } = await userService.update(input);
    if (error) return Err({ title: 'Failed to update user', description: error.message });

    // Optimistic cache update
    queryClient.setQueryData<User>(
      userKeys.byId(input.userId),
      (old) => old ? { ...old, name: input.name } : old,
    );

    // Invalidate to refetch fresh data in background
    queryClient.invalidateQueries({ queryKey: userKeys.all });

    return Ok(data);
  },
});
```

See also: `result-types` skill for the Result type pattern. `define-errors` skill for creating error variants.
