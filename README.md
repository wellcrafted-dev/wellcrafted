# wellcrafted

[![npm version](https://badge.fury.io/js/wellcrafted.svg)](https://www.npmjs.com/package/wellcrafted)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/wellcrafted)](https://bundlephobia.com/package/wellcrafted)

*Define your errors. Type the rest.*

Tagged errors and Result types as plain objects. < 2KB, zero dependencies.

`try/catch` throws away your error's type the moment you catch it. You get `catch (error: unknown)` and you're guessing again. And a thrown `Error` travels badly: `JSON.stringify(new Error("boom"))` is `{}`, so the message vanishes the moment it hits a log line, a Web Worker, or an IPC boundary, where `instanceof` stops working too.

wellcrafted fixes both. Define your errors once as plain data, return them instead of throwing, and check them with the `{ data, error }` shape you already know from Supabase, SvelteKit load functions, and TanStack Query. No `.isOk()` method chains, no `.map().andThen().orElse()` pipelines. Check `error`, use `data`.

```typescript
import { defineErrors } from "wellcrafted/error";
import { trySync } from "wellcrafted/result";

// The key becomes error.name. The fields you return are typed on the error.
const { ParseError } = defineErrors({
  ParseError: ({ path }: { path: string }) => ({
    message: `Could not parse ${path}`,
    path,
  }),
});

const { data, error } = trySync({
  try: () => JSON.parse(raw),
  catch: () => ParseError({ path: "config.json" }),
});

if (error) {
  // error is { name: "ParseError"; message: string; path: string }
  console.error(error.message, error.path);
} else {
  // data is the parsed value, error is null
  use(data);
}
```

That's the whole idea: define an error, wrap the throwing call, destructure the result, check `error`. A *tagged error* is just an object with a `name` field you can `switch` on. Everything below is that pattern at scale.

## Install

```bash
npm install wellcrafted
```

## A real service

Here is the pattern in shipping code, lightly trimmed from [Whispering](https://github.com/EpicenterHQ/epicenter)'s transcription layer. Each service owns a small vocabulary of things that can go wrong, declared up front with `defineErrors`.

```typescript
import {
  defineErrors,
  extractErrorMessage,
  type InferErrors,
} from "wellcrafted/error";
import { type Result, tryAsync } from "wellcrafted/result";

export const ElevenLabsError = defineErrors({
  MissingApiKey: () => ({ message: "ElevenLabs API key is required" }),
  FileTooLarge: ({ sizeMb, maxMb }: { sizeMb: number; maxMb: number }) => ({
    message: `File ${sizeMb.toFixed(1)}MB exceeds ${maxMb}MB limit`,
    sizeMb,
    maxMb,
  }),
  Unexpected: ({ cause }: { cause: unknown }) => ({
    message: extractErrorMessage(cause),
    cause,
  }),
});
export type ElevenLabsError = InferErrors<typeof ElevenLabsError>;

async function transcribe(
  audio: Blob,
  apiKey: string,
): Promise<Result<string, ElevenLabsError>> {
  if (!apiKey) return ElevenLabsError.MissingApiKey(); // a factory already is an Err

  const sizeMb = audio.size / (1024 * 1024);
  if (sizeMb > 1000) return ElevenLabsError.FileTooLarge({ sizeMb, maxMb: 1000 });

  return tryAsync({
    try: () => callElevenLabs(apiKey, audio), // may throw
    catch: (cause) => ElevenLabsError.Unexpected({ cause }),
  });
}
```

The caller checks `error`, then `switch`es on `error.name` to handle each case with the right fields in scope:

```typescript
const { data, error } = await transcribe(audio, apiKey);
if (error) {
  switch (error.name) {
    case "MissingApiKey": return promptForKey();
    case "FileTooLarge":  return warn(`Audio too large: ${error.sizeMb}MB`);
    case "Unexpected":    return report(error.cause);
  }
}
showTranscript(data); // data is string, error is null
```

Three things are doing the work here, and the rest of this README is just those three things.

## Define your errors

You can put any value in `Ok` and `Err`. So why `defineErrors`?

Because errors aren't random. Every service has a handful of things that can go wrong, and you want to name them up front. A user service has `AlreadyExists`, `CreateFailed`, `InvalidEmail`. An HTTP client has `Connection`, `Timeout`, `Response`. Rust codified this with [thiserror](https://docs.rs/thiserror); `defineErrors` brings the same pattern to TypeScript, but outputs plain objects instead of classes.

Each key becomes a variant. Your constructor returns `{ message, ...fields }`; `defineErrors` stamps the key on as `name` and hands back a factory that returns `Err<...>` directly. `InferErrors` extracts the union of every variant for your `Result<T, E>` signatures.

```typescript
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
//    | { name: "CreateFailed";  message: string; email: string; cause: unknown }
```

Two properties make this pay off:

**Errors are data, not classes.** Plain frozen objects, no prototype chain. The fields you put on them are plain own properties, so they survive `JSON.stringify`, a Web Worker, or an IPC hop with no `stack` noise and no `instanceof` that breaks across package boundaries. The error you create is the error that arrives.

**Every factory returns `Err<...>` directly.** No wrapping step. Return it from a `tryAsync` catch handler or as a standalone early return (`if (existing) return UserError.AlreadyExists({ email })`). The `Result` type flows out naturally.

## Wrap throwing code

`trySync` and `tryAsync` turn a throwing operation into a `Result`. The `catch` handler receives the raw error and returns one of your `defineErrors` variants. Anything you don't wrap keeps throwing exactly as before, so you can adopt this one function at a time.

```typescript
import { trySync, tryAsync, Ok } from "wellcrafted/result";

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

When `catch` returns `Ok(fallback)` instead of an error, there is no error branch left: the return type narrows to `Ok<T>`, so `error` is always `null` and you can skip the check.

```typescript
const { data: items } = trySync({
  try: (): string[] => JSON.parse(riskyJson),
  catch: () => Ok([] as string[]), // recovered; there is no error to check
});
```

## Compose across layers

Each layer defines its own vocabulary and folds the layer below into a `cause` field. `extractErrorMessage` formats that cause inside the factory, so call sites stay clean. You propagate with a plain `if (error) return` (there is no `?` operator; see [what you give up](#what-you-give-up)).

```typescript
async function getUser(userId: string): Promise<Result<User, UserServiceError>> {
  const { data: response, error } = await tryAsync({
    try: () => fetch(`/api/users/${userId}`),
    catch: (cause) => UserServiceError.FetchFailed({ userId, cause }),
    //                  raw fetch error becomes cause ^^^^^
  });
  if (error) return Err(error); // propagate as-is

  if (response.status === 404) return UserServiceError.NotFound({ userId });
  return Ok(await response.json());
}
```

Your tagged fields are plain data, so the chain logs and crosses the wire cleanly. The raw `cause` is the exception: it serializes only as well as whatever you caught, which is why the factories above fold it through `extractErrorMessage` into the `message` string.

## The Result type

The foundation is one discriminated union:

```typescript
type Ok<T>        = { data: T; error: null };
type Err<E>       = { error: E; data: null };
type Result<T, E> = Ok<T> | Err<E>;
```

Check `error` first and TypeScript narrows `data` for you:

```typescript
const { data, error } = await someOperation();
if (error) return; // error is E, data is null
// data is T, error is null
```

`if (error)` works because errors from `defineErrors` are always objects, and an object is truthy. The exact check is `error !== null` (or the `isErr` guard); reach for it if you ever put a falsy value like `0` or `""` in an `Err`.

### Exhaustiveness

`switch (error.name)` narrows each case, and your editor autocompletes every variant. To make a *new* variant a compile error until it is handled, add a `never` check in `default`:

```typescript
switch (error.name) {
  case "NotFound":    return notFound();
  case "FetchFailed": return badGateway();
  default:
    error satisfies never; // add a variant and this line fails to compile
}
```

Plain TypeScript does not enforce exhaustive `switch` on its own; this one line is how you opt in.

## What you give up

wellcrafted is not an effect system, and the honest cost is control flow. There is no `?` operator, so you propagate with an explicit `if (error) return` at each step. There is no dependency injection, no automatic short-circuiting, and no built-in concurrency. If you need those, reach for [Effect](https://effect.website); that is what it is for.

In exchange, the whole API is `{ data, error }`, `async/await`, and `switch`: no new runtime, no generators, no pipe operators to learn.

## Also in the box

Each lives behind its own subpath import, so you pay for only what you use. The [docs](https://wellcrafted.dev) cover each in depth.

- `wellcrafted/brand`: `Brand<T>` makes distinct types from primitives (`type UserId = string & Brand<"UserId">`) so the compiler catches mix-ups. Zero runtime.
- `wellcrafted/logger`: a small DI-based structured logger keyed on log level, built to take your `defineErrors` types directly. No global singleton.
- `wellcrafted/testing`: `expectOk` / `expectErr` unwrap a `Result` in a test, or throw with a readable message.
- `wellcrafted/json`: `parseJson` is `JSON.parse` that returns a `Result` instead of throwing.
- `wellcrafted/query`: TanStack Query adapters for Result-returning functions. Queries expose `.options`, `.fetch`, and `.ensure`; mutations are callable and expose `.options`.
- `wellcrafted/standard-schema`: wrap a `Result` as a [Standard Schema](https://github.com/standard-schema/standard-schema) for validators that speak the spec.

## How it compares

|  | wellcrafted | neverthrow | better-result | fp-ts | Effect |
|---|---|---|---|---|---|
| Error definition | `defineErrors` factories | Bring your own | `TaggedError` classes | Bring your own | Class-based with `_tag` |
| Error shape | Plain frozen objects | Any type | Class instances | Any type | Class instances |
| Composition | Manual `if (error)` | `.map().andThen()` | `Result.gen()` generators | Pipe operators | `yield*` generators |
| Bundle size | < 2KB | ~5KB | ~2KB | ~30KB | ~50KB |
| Syntax | async/await | Method chains | Method chains + generators | Pipe operators | Generators |

Every Result library hands you a container. wellcrafted hands you what goes inside it, then gets out of the way.

## API at a glance

From `wellcrafted/result`:

- `Ok(data)` / `Err(error)`: construct a success or failure
- `trySync` / `tryAsync`: wrap a throwing operation, sync or async
- `Result<T, E>`: the `Ok<T> | Err<E>` union

From `wellcrafted/error`:

- `defineErrors(config)`: define a namespace of error variant factories
- `extractErrorMessage(value)`: pull a readable string out of any `unknown`
- `InferErrors<typeof MyError>`: the union of all variants; `InferError<typeof MyError.Variant>`: one variant

Less common but there when you need them: `isOk` / `isErr` type guards, `unwrap` (extract or throw), `partitionResults` (split an array of Results), and `resolve` (handle values that may or may not be Results).

## Teach your AI agent

If you use an AI coding agent, install the skills that teach it the patterns and anti-patterns directly:

```bash
npx skills add wellcrafted-dev/wellcrafted
```

This installs five skills: `define-errors`, `result-types`, `query-factories`, `branded-types`, and `patterns` (the architectural style guide). They work with any agent that supports [`npx skills`](https://www.npmjs.com/package/skills). Install once, update with `npx skills update`.

## License

MIT
