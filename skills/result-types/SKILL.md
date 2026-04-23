---
name: result-types
description: Working with Result types, Ok, Err, trySync, tryAsync, and utility functions from wellcrafted. Use when wrapping unsafe code, handling errors with Results, or destructuring { data, error } responses.
---

# Result Types

```typescript
import { Ok, Err, trySync, tryAsync, type Result } from 'wellcrafted/result';
```

## The Shape

Results are plain objects with two properties — `data` and `error`. Successful results carry a `T` in `data` with `error: null`; failed results carry an `E` in `error` with `data: null`.

```typescript
type Ok<T>  = { data: T; error: null };
type Err<E> = { error: E; data: null };
type Result<T, E> = Ok<T> | Err<E>;
```

This is the same destructuring shape used by Supabase and SvelteKit load functions. **Always discriminate by the error side — `isErr(result)` or `result.error !== null`:**

```typescript
const { data, error } = await someOperation();
if (error) {
  // error is E, data is null
  return;
}
// data is T here
```

### Never discriminate by `data`

`Ok(null)` is a legitimate value (`T` can be `null` — common for "not found is not an error"), so `data === null` is ambiguous: it could be `Ok<null>` or `Err<E>`. The only reliable discriminator is the error side.

```typescript
// Wrong — Ok(null) is legal; this treats success as failure
if (result.data === null) { /* handle "error" */ }

// Right — non-null on the error side means Err, by convention
if (result.error !== null) { /* handle error */ }

// Right — named guard, same check, clearer intent
if (isErr(result)) { /* handle error */ }
```

**Don't call `Err(null)`.** It produces `{ data: null, error: null }` — structurally identical to `Ok(null)`. Under the shape, `isErr`/`isOk` read it as Ok, so `Err(null)` silently becomes success. `Err(undefined)` is also discouraged — the discriminator technically works (`undefined !== null` is true), but the value is meaningless and trips `if (error)` falsy checks downstream. Either:

- Use `Ok(null)`/`Ok(undefined)` (if what you meant was success-with-no-payload).
- Define a tagged error via `defineErrors` with a real name.
- Wrap a caught exception as `TaggedError.Unexpected({ cause: error })` — see below.

At every `catch (error: unknown)` boundary, don't pass the raw `unknown` to `Err`. Wrap it in a tagged error via `defineErrors`. The tagged error is non-null by construction, so the shape's invariant holds regardless of what was thrown (including `throw null`). See `docs/philosophy/err-null-is-ok-null.md` for why this is a documentation rule rather than a type-level constraint.

## Constructors

```typescript
// Success
const result = Ok({ id: '123', name: 'Alice' });

// Failure
const result = Err({ name: 'NotFound', message: 'User not found' });

// Void success — use Ok(undefined)
const result = Ok(undefined);
```

## trySync and tryAsync

Wrap throwing operations into Results. The `catch` handler receives the raw error and returns an error variant.

```typescript
import { defineErrors, extractErrorMessage } from 'wellcrafted/error';

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

// Asynchronous — always await
const { data, error } = await tryAsync({
  try: () => fetch(url).then((r) => r.json()),
  catch: (cause) => HttpError.Connection({ url, cause }),
});
```

See also: `define-errors` skill for creating error variants.

## Key Rules

1. Use `trySync` for synchronous code, `tryAsync` for async
2. Always `await` tryAsync — it returns a Promise
3. Match return types — if try returns `T`, catch should return `Err<E>` or `Ok<T>` for recovery
4. Use `Ok(undefined)` for void operations
5. Return `Err(error)` to propagate errors up the chain
6. Pass the raw caught error as `cause` — let the error factory call `extractErrorMessage`

## Recovery Pattern

When `catch` returns `Ok(fallback)` instead of `Err`, the return type narrows to `Ok<T>` — no error checking needed:

```typescript
const { data: config } = trySync({
  try: (): unknown => JSON.parse(configJson),
  catch: () => Ok({ theme: 'dark', fontSize: 14 }),
});
// config is always defined — the catch recovered
```

```typescript
// File existence check with fallback
const { data: exists } = trySync({
  try: () => fs.existsSync(path),
  catch: () => Ok(false),
});
```

## Wrapping Guidelines

### Minimal wrap — only the risky operation

```typescript
// CORRECT: Wrap only the call that can throw
const { data: response, error } = await tryAsync({
  try: () => fetch(`/api/users/${userId}`),
  catch: (cause) => UserError.FetchFailed({ userId, cause }),
});
if (error) return Err(error);

// Continue with non-throwing operations
const user = await response.json();
return Ok(user);
```

```typescript
// WRONG: Wrapping too much
const { data, error } = await tryAsync({
  try: async () => {
    const response = await fetch(`/api/users/${userId}`);
    const user = await response.json();
    await updateCache(user);
    return user;
  },
  catch: (error) => Err(error), // Too vague
});
```

### Immediate return pattern

Return errors immediately after checking. This creates linear control flow.

```typescript
// CORRECT: Check and return immediately
const { data: user, error: fetchError } = await getUser(userId);
if (fetchError) return Err(fetchError);

const { data: posts, error: postsError } = await getPosts(user.id);
if (postsError) return Err(postsError);

return Ok({ user, posts });
```

```typescript
// WRONG: Nested error handling
const { data: user, error: fetchError } = await getUser(userId);
if (!fetchError) {
  const { data: posts, error: postsError } = await getPosts(user.id);
  if (!postsError) {
    return Ok({ user, posts });
  } else {
    return Err(postsError);
  }
} else {
  return Err(fetchError);
}
```

### When to extend the try block

Include multiple operations in one block when they must succeed or fail together:

```typescript
// Atomic operation — all steps are part of "save document"
const { data, error } = await tryAsync({
  try: async () => {
    const validated = schema.parse(document);
    const saved = await db.documents.insert(validated);
    await index.add(saved.id, saved.content);
    return saved;
  },
  catch: (cause) => DbError.InsertFailed({ cause }),
});
```

## The Destructured-Error Gotcha

When you destructure `{ data, error }`, the `error` variable is the raw error value — NOT wrapped in `Err`. You must wrap it before returning from a function that returns `Result`:

```typescript
// WRONG — error is the raw value, not a Result
const { data, error } = await tryAsync({ ... });
if (error) return error; // Type error: returns raw error, not Result

// CORRECT — wrap with Err() to return a proper Result
const { data, error } = await tryAsync({ ... });
if (error) return Err(error);
```

This is different from returning the entire result object:

```typescript
// Also correct — result is already a Result type
const result = await tryAsync({ ... });
if (result.error) return result; // Returns the full Result
```

## Utility Functions

### isOk / isErr — type guards

```typescript
import { isOk, isErr } from 'wellcrafted/result';

const result = await getUser(userId);

if (isOk(result)) {
  console.log(result.data.name);
}

if (isErr(result)) {
  console.log(result.error.message);
}
```

### unwrap — extract data or throw

```typescript
import { unwrap } from 'wellcrafted/result';

// Returns data if Ok, throws error if Err
const user = unwrap(await getUser(userId));
```

Use sparingly — `unwrap` throws, which defeats the purpose of Result types. Useful in tests and scripts where you know the operation should succeed.

### resolve — handle values that may or may not be Results

```typescript
import { resolve } from 'wellcrafted/result';

// If value is a Result, returns it as-is
// If value is not a Result, wraps it in Ok()
const result = resolve(maybeResult);
```

### partitionResults — split an array of Results

```typescript
import { partitionResults } from 'wellcrafted/result';

const results = await Promise.all(userIds.map(getUser));
const { ok, err } = partitionResults(results);
// ok:  User[]        — just the successful values
// err: UserError[]   — just the errors
```

## Wrapping Summary

| Scenario | Approach |
| --- | --- |
| Single risky operation | Wrap just that operation |
| Sequential operations | Wrap each separately, return immediately on error |
| Atomic operations | Wrap together in one block |
| Different error types | Separate blocks with appropriate error types |

See also: `define-errors` skill for error variant definitions. `patterns` skill for service architecture.
