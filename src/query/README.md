# Query Utilities

A set of utilities for integrating wellcrafted's Result types with TanStack Query, providing a clean pattern for organizing your data fetching layer.

## Overview

The query utilities solve a common integration challenge: your service functions return `Result<T, E>` types, but TanStack Query expects functions that either return data or throw errors. These utilities bridge that gap while providing two convenient interfaces for each query and mutation.

## Quick Start

```typescript
import { QueryClient } from '@tanstack/query-core';
import { createQueryFactories } from 'wellcrafted/query';

// Create your query client
const queryClient = new QueryClient();

// Create factory functions
const { defineQuery, defineMutation } = createQueryFactories(queryClient);
```

## Architecture Pattern: The RPC-like Approach

The query utilities enable a powerful architectural pattern inspired by RPC (Remote Procedure Call), where your query layer acts as a bridge between UI components and pure service functions. This pattern is used successfully in production apps like [Whispering](https://github.com/braden-w/whispering).

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│     UI      │ --> │ Query/RPC   │ --> │   Services   │
│ Components  │     │    Layer    │     │    (Pure)    │
└─────────────┘     └─────────────┘     └──────────────┘
      ↑                    │
      └────────────────────┘
         Reactive Updates
```

### Layer Responsibilities

1. **Services Layer**: Pure functions with no UI dependencies
   - Business logic only
   - Return `Result<T, E>` types
   - Platform-agnostic
   - Easily testable

2. **Query Layer**: Adds reactivity and caching
   - Wraps service calls with TanStack Query
   - Handles runtime dependency injection
   - Transforms errors for UI consumption
   - Manages cache updates

3. **UI Layer**: Consumes queries reactively or imperatively
   - Uses the dual interface pattern
   - Handles loading states
   - Displays errors

## Recommended Folder Structure

Here's how to organize your code for maximum clarity:

```
src/
├── services/           # Pure business logic
│   ├── api/           # External API calls
│   │   ├── users.ts
│   │   └── products.ts
│   ├── db/            # Database operations
│   │   └── index.ts
│   └── platform/      # Platform-specific code
│       ├── web.ts
│       └── desktop.ts
│
├── query/             # Query layer with caching
│   ├── _factories.ts  # createQueryFactories setup
│   ├── users.ts       # User-related queries
│   ├── products.ts    # Product-related queries
│   └── index.ts       # RPC namespace export
│
└── components/        # UI components
    └── UserList.svelte
```

## Real-World Example: Building an RPC Namespace

This example shows how to build a complete data fetching layer:

### Step 1: Create Your Services

```typescript
// services/api/users.ts
import { Ok, Err, type Result } from 'wellcrafted/result';

export type User = {
  id: string;
  name: string;
  email: string;
};

export type UserServiceError = {
  code: 'NOT_FOUND' | 'NETWORK_ERROR' | 'UNAUTHORIZED';
  message: string;
};

export async function getUser(id: string): Promise<Result<User, UserServiceError>> {
  try {
    const response = await fetch(`/api/users/${id}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return Err({ code: 'NOT_FOUND', message: 'User not found' });
      }
      return Err({ code: 'NETWORK_ERROR', message: 'Failed to fetch user' });
    }
    
    return Ok(await response.json());
  } catch (error) {
    return Err({ code: 'NETWORK_ERROR', message: error.message });
  }
}

export async function updateUser(user: User): Promise<Result<User, UserServiceError>> {
  // Implementation...
}
```

### Step 2: Create Query Definitions

```typescript
// query/_factories.ts
import { QueryClient } from '@tanstack/query-core';
import { createQueryFactories } from 'wellcrafted/query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

export const { defineQuery, defineMutation } = createQueryFactories(queryClient);
```

```typescript
// query/users.ts
import { defineQuery, defineMutation, queryClient } from './_factories';
import * as userService from '../services/api/users';

export const users = {
  // Query with parameters
  getUser: (userId: string) => 
    defineQuery({
      queryKey: ['users', userId],
      queryFn: () => userService.getUser(userId),
    }),

  // Query all users
  getAllUsers: defineQuery({
    queryKey: ['users'],
    queryFn: () => userService.getAllUsers(),
  }),

  // Mutation with optimistic updates
  updateUser: defineMutation({
    mutationKey: ['users', 'update'],
    mutationFn: async (user: User) => {
      const result = await userService.updateUser(user);
      
      if (result.error) return result;

      // Optimistic cache update
      queryClient.setQueryData(['users', user.id], user);
      queryClient.invalidateQueries({ queryKey: ['users'] });

      return result;
    },
    onError: (error) => {
      // Error is already in the right format for UI
      console.error('Failed to update user:', error);
    },
  }),
};
```

### Step 3: Create the RPC Namespace

```typescript
// query/index.ts
export { queryClient } from './_factories';

import { users } from './users';
import { products } from './products';
import { settings } from './settings';

// This creates your RPC-like interface
export const rpc = {
  users,
  products,
  settings,
} as const;
```

### Step 4: Use in Components

```svelte
<!-- components/UserProfile.svelte -->
<script lang="ts">
  import { createQuery, createMutation } from '@tanstack/svelte-query';
  import { rpc } from '$lib/query';

  let { userId } = $props<{ userId: string }>();

  // Reactive query - automatically updates UI
  const userQuery = createQuery(rpc.users.getUser(() => userId).options);

  // Reactive mutation - provides loading states
  const updateMutation = createMutation(rpc.users.updateUser.options);

  // Or use imperatively in event handlers
  async function handleQuickUpdate(updates: Partial<User>) {
    const { data, error } = await rpc.users.updateUser.execute({
      ...userQuery.data,
      ...updates
    });

    if (error) {
      toast.error(error.message);
    }
  }
</script>

{#if userQuery.isPending}
  <div>Loading user...</div>
{:else if userQuery.error}
  <div>Error: {userQuery.error.message}</div>
{:else if userQuery.data}
  <UserForm 
    user={userQuery.data}
    onSave={(user) => updateMutation.mutate(user)}
    isSaving={updateMutation.isPending}
  />
{/if}
```

**React equivalent:**

```tsx
// components/UserProfile.tsx
import { useQuery, useMutation } from '@tanstack/react-query';
import { rpc } from '../query';
import { toast } from '../toast';

interface UserProfileProps {
  userId: string;
}

export function UserProfile({ userId }: UserProfileProps) {
  // Reactive query - automatically updates UI
  const userQuery = useQuery(rpc.users.getUser(userId).options());

  // Reactive mutation - provides loading states
  const updateMutation = useMutation(rpc.users.updateUser.options());

  // Or use imperatively in event handlers
  async function handleQuickUpdate(updates: Partial<User>) {
    const { data, error } = await rpc.users.updateUser.execute({
      ...userQuery.data,
      ...updates
    });

    if (error) {
      toast.error(error.message);
    }
  }

  if (userQuery.isPending) return <div>Loading user...</div>;
  if (userQuery.error) return <div>Error: {userQuery.error.message}</div>;
  if (!userQuery.data) return null;

  return (
    <UserForm
      user={userQuery.data}
      onSave={(user) => updateMutation.mutate(user)}
      isSaving={updateMutation.isPending}
    />
  );
}
```

## The Dual Interface Pattern

Every query and mutation provides two ways to use it:

### 1. Reactive Interface (`.options`)

Best for UI components that need to track state:

```typescript
// With reactive parameter - creates a reactive subscription
const userId = $state('abc-123');
const query = createQuery(rpc.users.getUser(() => userId).options);
// Access: query.data, query.isPending, query.error
// Query automatically re-runs when userId changes

// With static parameter - simpler when value never changes
const query = createQuery(rpc.users.getUser('static-id').options);
```

**React equivalent:**

```tsx
// With reactive parameter - creates a reactive subscription
const [userId, setUserId] = useState('abc-123');
const query = useQuery(rpc.users.getUser(userId).options());
// Access: query.data, query.isPending, query.error
// Query automatically re-runs when userId changes

// With static parameter - simpler when value never changes
const query = useQuery(rpc.users.getUser('static-id').options());
```

**Important**:
- **Svelte**: Pass `.options` as a **property reference** (no parentheses). For reactive parameters, wrap them in accessor functions `() => param`.
- **React**: Call `.options()` as a **function** (with parentheses). Pass reactive parameters directly (no accessor function needed).

### 2. Imperative Interface (`.execute()` / `.fetch()`)

Best for event handlers and workflows:

```typescript
// Direct execution without subscriptions
const { data, error } = await rpc.users.updateUser.execute(user);
// No reactive overhead, just the result
```

## Common Mistakes with `.options`

Understanding the `.options` pattern is crucial for proper reactive behavior. Here are the most common mistakes:

### ❌ Mistake 1: Wrong `.options` pattern for your framework

**Svelte:**

```typescript
// WRONG: Calling .options() instead of passing the function reference
const query = createQuery(rpc.users.getUser(userId).options());
//                                                         ^^
//                                                      Don't call it

// ALSO WRONG: Not using accessor for reactive parameter
const userId = $state('abc-123');
const query = createQuery(rpc.users.getUser(userId).options);
//                                            ^^^^^^
//                                     Breaks reactivity!
```

```typescript
// CORRECT: Pass .options as property, use accessor for reactive param
const userId = $state('abc-123');
const query = createQuery(rpc.users.getUser(() => userId).options);
//                                          ^^^^^^^^^^^ accessor preserves reactivity
//                                                             no parentheses!
```

**React:**

```tsx
// WRONG: Not calling .options() as a function
const [userId, setUserId] = useState('abc-123');
const query = useQuery(rpc.users.getUser(userId).options);
//                                                     ^
//                                              Missing parentheses!

// ALSO WRONG: Using unnecessary accessor function
const [userId, setUserId] = useState('abc-123');
const query = useQuery(rpc.users.getUser(() => userId).options());
//                                       ^^^^^^^^^^^
//                                    Don't need accessor in React!
```

```tsx
// CORRECT: Call .options() as function, pass param directly
const [userId, setUserId] = useState('abc-123');
const query = useQuery(rpc.users.getUser(userId).options());
//                                       ^^^^^^^ direct param
//                                                      ^^ call it!
```

**Why it's wrong**:
- **Svelte**: Requires `.options` as property (no parentheses) and accessor functions `() => param` for reactive values
- **React**: Requires `.options()` as function call (with parentheses) and direct parameter passing (no accessor)

### ❌ Mistake 2: Passing reactive values directly (Svelte-specific)

```typescript
// WRONG: Passes a snapshot, breaks reactivity
const id = $state('abc-123');
const query = createQuery(rpc.users.getUser(id).options);
//                                            ^^
//                                      Direct value breaks reactivity
```

```typescript
// CORRECT: Use accessor function for reactive tracking
const id = $state('abc-123');
const query = createQuery(rpc.users.getUser(() => id).options);
//                                          ^^^^^^^^
//                                    Accessor preserves reactivity
```

**Why it's wrong**: In Svelte, when you pass `id` directly, the query definition runs once with the current value. Changes to `id` won't trigger new queries. Using `() => id` creates a function that TanStack Query can call each time it needs the value, preserving reactivity.

**Note**: This is Svelte-specific. React hooks automatically track dependencies, so you pass values directly.

### ❌ Mistake 3: Wrong method call order

**Svelte:**

```typescript
// WRONG: Can't access .options before calling the method
const query = createQuery(rpc.users.getUser.options(() => userId));
//                                          ^^^^^^^^^^^^^^^^^^^^^^^
//                                          .options isn't a function
```

```typescript
// CORRECT: Call method with accessor, then access .options property
const query = createQuery(rpc.users.getUser(() => userId).options);
//                                  ^^^^^^^^^^^^^ call with accessor
//                                                         ^^^^^^^ then .options property
```

**React:**

```tsx
// WRONG: Can't access .options before calling the method
const query = useQuery(rpc.users.getUser.options(userId));
//                                      ^^^^^^^^^^^^^^^^^
//                                      .options isn't a function
```

```tsx
// CORRECT: Call method with param, then call .options() function
const query = useQuery(rpc.users.getUser(userId).options());
//                              ^^^^^^^^^^^^ call with param
//                                                  ^^^^^^^^^ then call .options()
```

**Why it's wrong**: The RPC method structure is:
- **Svelte**: `method(() => param).options` (accessor, then property)
- **React**: `method(param).options()` (direct param, then function call)

First call the method with its parameter, which returns an object containing the `.options` property/function.

### When to Use Accessor Functions (Svelte-Specific)

**Note**: Accessor functions are only needed in Svelte. React hooks automatically track dependencies, so you pass values directly.

In Svelte, use accessor functions (arrow functions) for **reactive values**:

```typescript
// ✅ Props (Svelte 5)
let { userId } = $props<{ userId: string }>();
const query = createQuery(rpc.users.getUser(() => userId).options);

// ✅ $state variables
const searchTerm = $state('');
const query = createQuery(rpc.products.search(() => searchTerm).options);

// ✅ $derived values
const fullName = $derived(`${firstName} ${lastName}`);
const query = createQuery(rpc.users.searchByName(() => fullName).options);

// ✅ Store values
const settings = getSettings(); // returns a store
const query = createQuery(rpc.api.getData(() => settings.apiKey).options);
```

**Don't use** accessor functions for **static values**:

```typescript
// ✅ String literals
const query = createQuery(rpc.users.getUser('user-123').options);

// ✅ Numbers
const query = createQuery(rpc.products.getProduct(42).options);

// ✅ Constants
const ADMIN_ID = 'admin-001';
const query = createQuery(rpc.users.getUser(ADMIN_ID).options);
```

### Quick Reference

| Pattern | Svelte | React | Use Case |
|---------|--------|-------|----------|
| **No parameters** | `createQuery(rpc.users.getAll.options)` | `useQuery(rpc.users.getAll.options())` | Static query, no params |
| **Static parameter** | `createQuery(rpc.users.getUser('id-123').options)` | `useQuery(rpc.users.getUser('id-123').options())` | Non-reactive value |
| **Reactive parameter** | `createQuery(rpc.users.getUser(() => userId).options)` | `useQuery(rpc.users.getUser(userId).options())` | Props, state, derived |
| **Multiple parameters** | `createQuery(rpc.products.search(() => term, () => category).options)` | `useQuery(rpc.products.search(term, category).options())` | Multiple reactive values |

**Key differences:**
- **Svelte**: `.options` property (no parentheses), accessor functions `() => param` for reactive values
- **React**: `.options()` function call (with parentheses), direct parameter passing

## Advanced Patterns

### Runtime Dependency Injection

The query layer can handle dynamic service selection based on runtime conditions:

```typescript
// query/transcription.ts
import { settings } from '../stores/settings';

export const transcription = {
  transcribe: defineMutation({
    mutationFn: async (audio: Blob) => {
      // Select service based on user settings
      const provider = settings.value.transcriptionProvider;
      
      switch (provider) {
        case 'openai':
          return services.openai.transcribe(audio, {
            apiKey: settings.value.openaiKey,
            model: settings.value.openaiModel,
          });
        case 'whisper':
          return services.whisper.transcribe(audio);
        default:
          return Err({ code: 'INVALID_PROVIDER', message: `Unknown provider: ${provider}` });
      }
    },
  }),
};
```

### Error Transformation

Transform service errors into UI-friendly formats:

```typescript
// query/users.ts
export const users = {
  createUser: defineMutation({
    mutationFn: async (userData: CreateUserInput) => {
      const result = await userService.createUser(userData);
      
      if (result.error) {
        // Transform service error to UI error
        return Err({
          title: 'Failed to create user',
          description: getErrorMessage(result.error.code),
          action: { type: 'retry', data: userData },
        });
      }
      
      return result;
    },
  }),
};

function getErrorMessage(code: string): string {
  switch (code) {
    case 'DUPLICATE_EMAIL':
      return 'A user with this email already exists';
    case 'INVALID_DATA':
      return 'Please check your input and try again';
    default:
      return 'An unexpected error occurred';
  }
}
```

### Coordinating Multiple Services

The query layer can orchestrate complex operations:

```typescript
// query/orders.ts
export const orders = {
  placeOrder: defineMutation({
    mutationFn: async (orderData: OrderInput) => {
      // Step 1: Validate inventory
      const inventory = await rpc.inventory.checkAvailability.fetch();
      if (!hasStock(orderData.items, inventory.data)) {
        return Err({ code: 'OUT_OF_STOCK', message: 'Some items are out of stock' });
      }

      // Step 2: Process payment
      const payment = await services.payment.charge(orderData.payment);
      if (payment.error) return Err(payment.error);

      // Step 3: Create order
      const order = await services.orders.create({
        ...orderData,
        paymentId: payment.data.id,
      });

      // Step 4: Update caches
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });

      return order;
    },
  }),
};
```

## Testing

The factory pattern makes testing straightforward:

```typescript
// tests/users.test.ts
import { QueryClient } from '@tanstack/query-core';
import { createQueryFactories } from 'wellcrafted/query';
import { vi } from 'vitest';

describe('User Queries', () => {
  let queryClient: QueryClient;
  let defineQuery: ReturnType<typeof createQueryFactories>['defineQuery'];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    ({ defineQuery } = createQueryFactories(queryClient));
  });

  it('should fetch user data', async () => {
    const mockUser = { id: '1', name: 'Test User', email: 'test@example.com' };
    vi.mocked(userService.getUser).mockResolvedValue(Ok(mockUser));

    const userQuery = defineQuery({
      queryKey: ['users', '1'],
      queryFn: () => userService.getUser('1'),
    });

    const result = await userQuery.fetch();
    expect(result.data).toEqual(mockUser);
  });
});
```

## Best Practices

1. **Keep Services Pure**: Services should only contain business logic, no UI concerns
2. **Use Result Types**: Always return `Result<T, E>` from services for consistent error handling
3. **Transform Errors in Query Layer**: Convert service errors to UI-friendly formats
4. **Leverage Both Interfaces**: Use reactive for UI state, imperative for workflows
5. **Organize by Feature**: Group related queries together (users, products, etc.)
6. **Cache Thoughtfully**: Update related caches after mutations

## Migration Guide

If you're migrating from a traditional setup:

```typescript
// Before: Direct API calls in components
async function loadUser() {
  try {
    const response = await fetch(`/api/users/${userId}`);
    user = await response.json();
  } catch (error) {
    errorMessage = error.message;
  }
}

// After: Using the query pattern
const userQuery = createQuery(rpc.users.getUser(() => userId).options);
// Automatically handles loading, error, caching, and refetching
```

## Troubleshooting `.options` Errors

If you're getting errors with `.options`, use this quick diagnostic guide:

### Error: "Cannot read property 'options' of undefined"

**Problem**: The RPC method itself is undefined.

**Common causes**:
```typescript
// ❌ Typo in method name
createQuery(rpc.users.getUzer(id).options);  // 'getUzer' doesn't exist

// ❌ Method not exported from RPC namespace
createQuery(rpc.users.privateMethod(id).options);  // not in exports
```

**Fix**: Check that the method exists and is properly exported in your RPC namespace.

### Error: "options is not a function" (when calling it)

**Problem**: You're trying to call `.options()` with parentheses.

**Fix**: Remove the parentheses from `.options` and use accessor for reactive param:
```typescript
// ❌ Wrong: calling .options() and not using accessor
createQuery(rpc.users.getUser(id).options())

// ✅ Correct: .options as property, accessor for reactive value
const id = $state('abc-123');
createQuery(rpc.users.getUser(() => id).options)
```

### Query doesn't update when reactive value changes

**Problem**: You're passing the value directly instead of using an accessor function.

**Symptoms**: Query runs once but doesn't re-run when `userId` changes.

**Fix**: Wrap reactive values in accessor functions:
```typescript
let { userId } = $props<{ userId: string }>();

// ❌ Wrong: Passes snapshot, doesn't track changes
createQuery(rpc.users.getUser(userId).options)

// ✅ Correct: Accessor preserves reactivity
createQuery(rpc.users.getUser(() => userId).options)
```

### Type error: "Type 'string' is not assignable to type '() => string'"

**Problem**: Your RPC method expects an accessor function but you're passing a static value.

**When this happens**: The method was defined to always use accessors for reactivity.

**Fix**: Either wrap in an accessor or update the RPC method definition:
```typescript
// Option 1: Wrap in accessor (if value might change)
createQuery(rpc.users.getUser(() => CONSTANT_ID).options)

// Option 2: Update RPC definition to accept both
// In query/users.ts:
getUser: (userId: string | (() => string)) => defineQuery({
  queryKey: ['users', typeof userId === 'function' ? userId() : userId],
  queryFn: () => services.getUser(
    typeof userId === 'function' ? userId() : userId
  ),
}),
```

### Query runs too many times

**Problem**: Accessor function has side effects or creates new objects on each call.

**Symptoms**: You see excessive network requests or query re-runs.

**Fix**: Make accessor functions pure and stable:
```typescript
// ❌ Wrong: Creates new object every call
createQuery(
  rpc.products.search(() => ({ term: searchTerm, category })).options
)

// ✅ Correct: Pass primitive values separately or use $derived
const searchParams = $derived({ term: searchTerm, category });
createQuery(
  rpc.products.searchWithParams(() => searchParams).options
)
```

## Additional Resources

- [Whispering App](https://github.com/braden-w/whispering) - A real-world example using this pattern
- [TanStack Query Docs](https://tanstack.com/query) - Learn more about the underlying query library
- [Result Type Pattern](/result/README.md) - Understanding Result types for error handling