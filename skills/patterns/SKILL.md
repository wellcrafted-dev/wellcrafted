---
name: patterns
description: Architectural patterns for code that uses wellcrafted. Covers control flow with trySync/tryAsync, factory function composition, service layers with Result types, error composition across boundaries, and the single-or-array pattern.
---

# Patterns

A style guide for code that uses wellcrafted. Not API reference — architectural taste.

## Human-Readable Control Flow

Mirror natural human reasoning: try the thing, check if it failed, continue on the happy path.

### Linearizing try-catch into guards

Before — nested, mixed throw/return:

```typescript
async function handleRequest(userId: string) {
  try {
    const user = await fetchUser(userId);
    const posts = await fetchPosts(user.id);
    return Response.json({ user, posts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
```

After — linear guards with `tryAsync`:

```typescript
import { tryAsync, Err } from 'wellcrafted/result';

async function handleRequest(userId: string) {
  const { data: user, error: userError } = await tryAsync({
    try: () => fetchUser(userId),
    catch: (cause) => UserError.FetchFailed({ userId, cause }),
  });
  if (userError) return Response.json({ error: userError.message }, { status: 502 });

  const { data: posts, error: postsError } = await tryAsync({
    try: () => fetchPosts(user.id),
    catch: (cause) => PostError.FetchFailed({ userId: user.id, cause }),
  });
  if (postsError) return Response.json({ error: postsError.message }, { status: 502 });

  return Response.json({ user, posts });
}
```

Each guard has the same shape: do the thing → check → return early on failure. The happy path accumulates at the bottom.

### Natural-language boolean variables

Name booleans so they read like thoughts:

```typescript
const isAuthenticated = session && !session.expired;
const needsRefresh = token.expiresAt < Date.now() + BUFFER_MS;
const canSkipValidation = input.source === 'trusted' && input.validated;

if (!isAuthenticated) return Response.json({ error: 'Unauthorized' }, { status: 401 });
if (needsRefresh) await refreshToken(token);
```

### Early returns as guard clauses

```typescript
async function createUser(email: string): Promise<Result<User, UserError>> {
  // Guard: validate input
  if (!email.includes('@')) return UserError.InvalidEmail({ email });

  // Guard: check uniqueness
  const existing = await db.findByEmail(email);
  if (existing) return UserError.AlreadyExists({ email });

  // Happy path
  return tryAsync({
    try: () => db.users.create({ email }),
    catch: (cause) => UserError.CreateFailed({ email, cause }),
  });
}
```

## Factory Function Composition

### The universal signature

Every factory function follows this shape:

```typescript
function createSomething(dependencies, options?) {
  return { /* methods */ };
}
```

Two arguments max. First is resources, second is config. Dependencies come first because they're what makes the factory reusable — the same factory with different deps produces different behavior.

```typescript
// Single dependency
function createUserService(db: Database) {
  return {
    getById(userId: string) { /* uses db */ },
    create(data: CreateUserInput) { /* uses db */ },
  };
}

// Multiple dependencies
function createNotificationService({ email, sms }: { email: EmailClient; sms: SmsClient }) {
  return {
    notify(userId: string, message: string) { /* uses email, sms */ },
  };
}
```

### Separating option layers

Each layer owns its own configuration. Don't mix them.

```typescript
// WRONG — mixed options blob
sendEmail({
  timeout: 5000,     // client option
  retries: 3,        // client option
  to: 'alice@co.com', // method option
  subject: 'Hello',   // method option
});

// CORRECT — each layer has its own options
const client = createEmailClient({ timeout: 5000, retries: 3 });
const service = createEmailService(client);
service.send({ to: 'alice@co.com', subject: 'Hello' });
```

### Anti-patterns

```typescript
// WRONG — client creation hidden inside
function sendEmail(clientOptions: ClientOpts, emailOptions: EmailOpts) {
  const client = createClient(clientOptions); // Hidden!
  return client.send(emailOptions);
}

// CORRECT — visible dependency chain
const client = createEmailClient(clientOptions);
const service = createEmailService(client);
service.send(emailOptions);
```

```typescript
// WRONG — function takes client as first argument everywhere
function getUser(db: Database, userId: string) { ... }
function createUser(db: Database, data: UserInput) { ... }

// CORRECT — factory captures the dependency
const userService = createUserService(db);
userService.getById(userId);
userService.create(data);
```

### Internal zone ordering

Inside a factory, organize code in four zones:

```typescript
function createUserService(db: Database, options?: { maxRetries?: number }) {
  // Zone 1 — Immutable state (const from deps/options)
  const maxRetries = options?.maxRetries ?? 3;

  // Zone 2 — Mutable state (let declarations)
  let connectionCount = 0;

  // Zone 3 — Private helpers (not exposed)
  function withRetry<T>(fn: () => Promise<T>): Promise<T> { /* ... */ }

  // Zone 4 — Public API (always last)
  return {
    async getById(userId: string): Promise<Result<User, UserError>> { /* ... */ },
    async create(data: CreateUserInput): Promise<Result<User, UserError>> { /* ... */ },
  };
}
```

The return object is always last — it's the complete public API.

## Service Layer Pattern

Services are factory functions that return objects with methods returning `Result<T, E>`. Each service defines its own error vocabulary with `defineErrors`.

### Complete example

```typescript
import { defineErrors, extractErrorMessage, type InferErrors } from 'wellcrafted/error';
import { Ok, tryAsync, type Result } from 'wellcrafted/result';

// 1. Define domain errors
const UserError = defineErrors({
  NotFound: ({ userId }: { userId: string }) => ({
    message: `User ${userId} not found`,
    userId,
  }),
  CreateFailed: ({ email, cause }: { email: string; cause: unknown }) => ({
    message: `Failed to create user ${email}: ${extractErrorMessage(cause)}`,
    email,
    cause,
  }),
  FetchFailed: ({ cause }: { cause: unknown }) => ({
    message: `Failed to fetch users: ${extractErrorMessage(cause)}`,
    cause,
  }),
});
type UserError = InferErrors<typeof UserError>;

// 2. Factory function returns service object
function createUserService(db: Database) {
  return {
    async getById(userId: string): Promise<Result<User, UserError>> {
      const { data: user, error } = await tryAsync({
        try: () => db.users.findById(userId),
        catch: (cause) => UserError.FetchFailed({ cause }),
      });
      if (error) return error;
      if (!user) return UserError.NotFound({ userId });
      return Ok(user);
    },

    async create(email: string): Promise<Result<User, UserError>> {
      return tryAsync({
        try: () => db.users.insert({ email }),
        catch: (cause) => UserError.CreateFailed({ email, cause }),
      });
    },
  };
}

// 3. Export factory + Live instance
type UserService = ReturnType<typeof createUserService>;
const UserServiceLive = createUserService(productionDb);
```

The factory is for testing (inject mocks), the Live instance is for production.

### Namespace re-exports

Organize services hierarchically:

```typescript
// services/index.ts
import { UserServiceLive } from './user';
import { PostServiceLive } from './post';

export const services = {
  users: UserServiceLive,
  posts: PostServiceLive,
} as const;
```

## Error Composition Across Layers

Each layer defines its own error vocabulary. Inner errors become `cause` fields in higher-level errors. `extractErrorMessage` formats them inside the factory.

```typescript
// Layer 1: HTTP client errors
const HttpError = defineErrors({
  Connection: ({ url, cause }: { url: string; cause: unknown }) => ({
    message: `Failed to connect to ${url}: ${extractErrorMessage(cause)}`,
    url,
    cause,
  }),
  Response: ({ url, status }: { url: string; status: number }) => ({
    message: `${url} returned HTTP ${status}`,
    url,
    status,
  }),
});

// Layer 2: domain service wraps HTTP errors via cause
const UserError = defineErrors({
  FetchFailed: ({ userId, cause }: { userId: string; cause: unknown }) => ({
    message: `Failed to fetch user ${userId}: ${extractErrorMessage(cause)}`,
    userId,
    cause,
  }),
});

// The HTTP error becomes cause in the domain error
async function getUser(userId: string): Promise<Result<User, UserError>> {
  const { data: response, error } = await tryAsync({
    try: () => fetch(`/api/users/${userId}`),
    catch: (cause) => UserError.FetchFailed({ userId, cause }),
    //                 raw fetch error ^^^^ becomes cause
  });
  if (error) return error;

  if (response.status === 404) return UserError.NotFound({ userId });

  return tryAsync({
    try: () => response.json() as Promise<User>,
    catch: (cause) => UserError.FetchFailed({ userId, cause }),
  });
}
```

The full error chain is JSON-serializable at every level. Log it, send it over the wire, display it in a toast.

See also: `define-errors` skill for error variant definitions. `result-types` skill for trySync/tryAsync patterns.

## The Single-or-Array Pattern

Accept both single items and arrays, normalize at the top, process uniformly.

```typescript
function deleteUsers(userOrUsers: User | User[]): Promise<Result<void, DbError>> {
  const users = Array.isArray(userOrUsers) ? userOrUsers : [userOrUsers];

  // One code path for both cases
  const ids = users.map((u) => u.id);
  return tryAsync({
    try: () => db.users.bulkDelete(ids),
    catch: (cause) => DbError.DeleteFailed({ cause }),
  });
}

// Works with one
await deleteUsers(user);

// Works with many
await deleteUsers([user1, user2, user3]);
```

### Naming convention

| Parameter | Normalized Variable |
| --- | --- |
| `userOrUsers` | `users` |
| `itemOrItems` | `items` |
| `postOrPosts` | `posts` |

### Anti-patterns

```typescript
// WRONG — separate functions for single vs array
function deleteUser(user: User): Promise<...>;
function deleteUsers(users: User[]): Promise<...>;

// WRONG — forcing arrays everywhere
deleteUsers([user]); // awkward for single items

// WRONG — duplicated logic in overloads
function deleteUser(user: User) { return db.delete(user.id); }
function deleteUsers(users: User[]) { return db.bulkDelete(users.map(u => u.id)); }

// CORRECT — single implementation
function deleteUsers(userOrUsers: User | User[]) {
  const users = Array.isArray(userOrUsers) ? userOrUsers : [userOrUsers];
  return db.bulkDelete(users.map((u) => u.id));
}
```
