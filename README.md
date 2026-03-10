# wellcrafted

[![npm version](https://badge.fury.io/js/wellcrafted.svg)](https://www.npmjs.com/package/wellcrafted)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/wellcrafted)](https://bundlephobia.com/package/wellcrafted)

*Define your errors. Type the rest.*

Tagged errors and Result types as plain objects. < 2KB, zero dependencies.

Most Result libraries hand you a container and leave the error type as an exercise. You get `Ok` and `Err` but nothing to help you define, compose, or serialize the errors themselves. So you end up with string literals, ad-hoc objects, or class hierarchies that break the moment you call `JSON.stringify`.

wellcrafted takes the opposite approach: start with the errors. `defineErrors` gives you typed, serializable, composable error variants inspired by Rust's [thiserror](https://docs.rs/thiserror). The Result type is just `{ data, error }` destructuring — the same shape you already know from Supabase, SvelteKit load functions, and TanStack Query. No `.isOk()` method chains, no `.map().andThen().orElse()` pipelines. Check `error`, use `data`. That's it.

```typescript
import { defineErrors, extractErrorMessage, type InferErrors } from "wellcrafted/error";
import { tryAsync, Ok, type Result } from "wellcrafted/result";

// Define domain errors — all variants in one call
const UserError = defineErrors({
  AlreadyExists: ({ email }: { email: string }) => ({
    message: `User ${email} already exists`,
    email,
  }),
  CreateFailed: ({ email, cause }: { email: string; cause: unknown }) => ({
    message: `Failed to create user ${email}: ${extractErrorMessage(cause)}`,
    email,
    cause,
  }),
});
type UserError = InferErrors<typeof UserError>;
//   ^? { name: "AlreadyExists"; message: string; email: string }
//    | { name: "CreateFailed"; message: string; email: string; cause: unknown }

// Each factory returns Err<...> directly — no wrapping needed
async function createUser(email: string): Promise<Result<User, UserError>> {
  const existing = await db.findByEmail(email);
  if (existing) return UserError.AlreadyExists({ email });

  return tryAsync({
    try: () => db.users.create({ email }),
    catch: (error) => UserError.CreateFailed({ email, cause: error }),
  });
}

// Discriminate with switch — TypeScript narrows automatically
const { data, error } = await createUser("alice@example.com");
if (error) {
  switch (error.name) {
    case "AlreadyExists": console.log(error.email);   break;
    case "CreateFailed":  console.log(error.email);   break;
    //                           ^ TypeScript knows exactly which fields exist
  }
}
```

## Install

```bash
npm install wellcrafted
```

## Why define errors at all?

You can use `Ok` and `Err` with any value. So why bother with `defineErrors`?

Because in practice, errors aren't random. Every service has a handful of things that can go wrong, and you want to enumerate them upfront. A user service has `AlreadyExists`, `CreateFailed`, `InvalidEmail`. An HTTP client has `Connection`, `Timeout`, `Response`. These are logical groups — the error vocabulary for a domain. Rust codified this with [thiserror](https://docs.rs/thiserror). `defineErrors` brings the same pattern to TypeScript, but outputs plain objects instead of classes.

**Errors are data, not classes.** Plain frozen objects with no prototype chain. `JSON.stringify` just works — no `stack` property eating up your logs, no `instanceof` checks that break across package boundaries. This matters anywhere errors cross a serialization boundary: Web Workers, server actions, sync engines, IPC. The error you create is the error that arrives.

**Every factory returns `Err<...>` directly.** No wrapping step. Return it from a `tryAsync` catch handler or as a standalone early return — `if (existing) return UserError.AlreadyExists({ email })`. The Result type flows naturally.

**Discriminated unions for free.** `switch (error.name)` gives you full TypeScript narrowing. No `instanceof`, no type predicates, no manual union types. Add a new variant and every consumer that switches gets a compile error until they handle it.

## Wrapping unsafe code

`trySync` and `tryAsync` turn throwing operations into `Result` types. The `catch` handler receives the raw error and returns an `Err<...>` from your `defineErrors` factories.

```typescript
import { trySync, tryAsync } from "wellcrafted/result";

const JsonError = defineErrors({
  ParseFailed: ({ input, cause }: { input: string; cause: unknown }) => ({
    message: `Invalid JSON: ${extractErrorMessage(cause)}`,
    input: input.slice(0, 100),
    cause,
  }),
});

// Synchronous
const { data, error } = trySync({
  try: () => JSON.parse(rawInput),
  catch: (cause) => JsonError.ParseFailed({ input: rawInput, cause }),
});

// Asynchronous
const { data, error } = await tryAsync({
  try: () => fetch(url).then((r) => r.json()),
  catch: (cause) => HttpError.Connection({ url, cause }),
});
```

When `catch` returns `Ok(fallback)` instead of `Err`, the return type narrows to `Ok<T>` — no error checking needed:

```typescript
const { data: parsed } = trySync({
  try: (): unknown => JSON.parse(riskyJson),
  catch: () => Ok([]),
});
// parsed is always defined — the catch recovered
```

## Composing errors across layers

This is where the pattern pays off. Each layer defines its own error vocabulary; inner errors become `cause` fields, and `extractErrorMessage` formats them inside the factory so call sites stay clean.

```typescript
// Service layer: domain errors wrap raw failures via cause
const UserServiceError = defineErrors({
  NotFound: ({ userId }: { userId: string }) => ({
    message: `User ${userId} not found`,
    userId,
  }),
  FetchFailed: ({ userId, cause }: { userId: string; cause: unknown }) => ({
    message: `Failed to fetch user ${userId}: ${extractErrorMessage(cause)}`,
    userId,
    cause,
  }),
});
type UserServiceError = InferErrors<typeof UserServiceError>;

async function getUser(userId: string): Promise<Result<User, UserServiceError>> {
  const response = await tryAsync({
    try: () => fetch(`/api/users/${userId}`),
    catch: (cause) => UserServiceError.FetchFailed({ userId, cause }),
    //                 raw fetch error becomes cause ^^^^^
  });
  if (response.error) return response;

  if (response.data.status === 404) return UserServiceError.NotFound({ userId });

  return tryAsync({
    try: () => response.data.json() as Promise<User>,
    catch: (cause) => UserServiceError.FetchFailed({ userId, cause }),
  });
}

// API handler: maps domain errors to HTTP responses
async function handleGetUser(request: Request, userId: string) {
  const { data, error } = await getUser(userId);

  if (error) {
    switch (error.name) {
      case "NotFound":
        return Response.json({ error: error.message }, { status: 404 });
      case "FetchFailed":
        return Response.json({ error: error.message }, { status: 502 });
    }
  }

  return Response.json(data);
}
```

The full error chain is JSON-serializable at every level. Log it, send it over the wire, display it in a toast. The structure survives.

## The Result type

The foundation is a simple discriminated union:

```typescript
import { Ok, Err, trySync, tryAsync, type Result } from "wellcrafted/result";

type Ok<T>      = { data: T; error: null };
type Err<E>     = { error: E; data: null };
type Result<T, E> = Ok<T> | Err<E>;
```

Check `error` first, and TypeScript narrows `data` automatically:

```typescript
const { data, error } = await someOperation();
if (error) {
  // error is E, data is null
  return;
}
// data is T, error is null
```

## Also in the box

### Brand Types

Create distinct types from primitives so TypeScript catches mix-ups at compile time. Zero runtime footprint — purely a type utility.

```typescript
import type { Brand } from "wellcrafted/brand";

type UserId = string & Brand<"UserId">;
type OrderId = string & Brand<"OrderId">;

function getUser(id: UserId) { /* ... */ }

const userId = "abc" as UserId;
const orderId = "xyz" as OrderId;
getUser(userId);   // compiles
getUser(orderId);  // type error
```

### Query Integration

TanStack Query factories with a dual interface: `.options` for reactive components, callable for imperative use in event handlers.

```typescript
import { createQueryFactories } from "wellcrafted/query";

const { defineQuery, defineMutation } = createQueryFactories(queryClient);

const userQuery = defineQuery({
  queryKey: ["users", userId],
  queryFn: () => getUser(userId), // returns Result<User, UserError>
});

// Reactive — pass to useQuery (React) or createQuery (Svelte)
const query = createQuery(() => userQuery.options);

// Imperative — direct execution for event handlers
const { data, error } = await userQuery.fetch();
```

## Comparison

|  | wellcrafted | neverthrow | better-result | fp-ts | Effect |
|---|---|---|---|---|---|
| Error definition | `defineErrors` factories | Bring your own | `TaggedError` classes | Bring your own | Class-based with `_tag` |
| Error shape | Plain frozen objects | Any type | Class instances | Any type | Class instances |
| Composition | Manual `if (error)` | `.map().andThen()` | `Result.gen()` generators | Pipe operators | `yield*` generators |
| Bundle size | < 2KB | ~5KB | ~2KB | ~30KB | ~50KB |
| Syntax | async/await | Method chains | Method chains + generators | Pipe operators | Generators |

Every Result library gives you a container. wellcrafted gives you what goes inside it — then gets out of the way.

## Philosophy

wellcrafted is deliberately idiomatic to JavaScript. The `{ data, error }` shape isn't novel — it's the same pattern used by Supabase, SvelteKit load functions, and TanStack Query. We chose it because it's already familiar, already destructurable, and requires zero new mental models.

The same principle applies throughout: async/await instead of generators, `switch` instead of `.match()`, plain objects instead of class hierarchies. The best abstractions are the ones your team already knows. wellcrafted adds type-safe error definition on top of patterns that JavaScript developers use every day — it doesn't ask you to learn a new programming paradigm to handle errors.

## API Reference

### Error functions

- **`defineErrors(config)`** — define multiple error factories in a single call. Each key becomes a variant; the value is a factory returning `{ message, ...fields }`. Every factory returns `Err<...>` directly.
- **`extractErrorMessage(error)`** — extract a readable string from any `unknown` error value.

### Error types

- **`InferErrors<T>`** — extract union of all error types from a `defineErrors` return value.
- **`InferError<T>`** — extract a single variant's error type from one factory.

### Result functions

- **`Ok(data)`** — create a success result
- **`Err(error)`** — create a failure result
- **`trySync({ try, catch })`** — wrap a synchronous throwing operation
- **`tryAsync({ try, catch })`** — wrap an async throwing operation
- **`isOk(result)` / `isErr(result)`** — type guards
- **`unwrap(result)`** — extract data or throw error
- **`resolve(value)`** — handle values that may or may not be Results
- **`partitionResults(results)`** — split an array of Results into separate ok/err arrays

### Query functions

- **`createQueryFactories(client)`** — create query/mutation factories for TanStack Query
- **`defineQuery(options)`** — define a query with dual interface (`.options` for reactive, callable for imperative)
- **`defineMutation(options)`** — define a mutation with dual interface

### Standard Schema

- **`ResultSchema(dataSchema, errorSchema)`** — [Standard Schema](https://github.com/standard-schema/standard-schema) wrapper for Result types, interoperable with any validator that supports the spec.

### Other types

- **`Result<T, E>`** — union of `Ok<T> | Err<E>`
- **`Brand<T, B>`** — branded type wrapper for distinct primitives

## License

MIT
