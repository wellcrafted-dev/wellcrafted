---
name: result-types
description: Working with Result types, Ok, Err, trySync, tryAsync, and result utilities from wellcrafted. Use when adapting thrown operations into Results, propagating or recovering from Result errors, choosing an adapter boundary, or consuming { data, error } values.
---

# Result Types

Ground behavior claims in the official `wellcrafted-dev/wellcrafted` source and
tests for the installed package version, then confirm the built declarations
and package exports. Examples, downstream skills, generated documentation, and
codebase indexes are useful leads, not the source of truth.

```typescript
import {
	Err,
	Ok,
	isErr,
	isOk,
	tryAsync,
	trySync,
	type Result,
} from 'wellcrafted/result';
```

## The Shape

```typescript
type Ok<T> = { data: T; error: null };
type Err<E> = { data: null; error: E };
type Result<T, E> = Ok<T> | Err<E>;
```

Discriminate on `error`, never `data`. `Ok(null)` is valid, so `data === null`
cannot distinguish success from failure.

```typescript
const result = await loadUser();

if (result.error !== null) {
	return Err(result.error);
}

useUser(result.data);
```

`isErr(result)` and `isOk(result)` express the same check as type guards.
Prefer `error !== null` over truthiness when reading the field directly because
`Err(false)`, `Err(0)`, and `Err('')` are valid Results.

Do not call `Err(null)`: it creates the same runtime shape as `Ok(null)` and is
therefore read as success. Avoid `Err(undefined)` because it carries no useful
failure information and is easy to lose in truthiness checks. At a
`catch (cause: unknown)` boundary, wrap the cause in a non-null tagged error
from `defineErrors`.

## Adapt Thrown Operations

Use `trySync` for an operation that returns a plain value and may throw. Use
`tryAsync` for an operation that returns a Promise and may throw or reject.

```typescript
const parsed = trySync({
	try: () => JSON.parse(rawInput),
	catch: (cause) => JsonError.ParseFailed({ input: rawInput, cause }),
});

const response = await tryAsync({
	try: () => fetch(url),
	catch: (cause) => HttpError.ConnectionFailed({ url, cause }),
});
```

The `try` callback returns the success value `T`. The adapter wraps it in
`Ok(T)`. Do not use `trySync` or `tryAsync` around a function that already
returns `Result<T, E>` merely to forward it: that produces a nested
`Ok(Result<T, E>)` on success.

The `catch` callback returns `Err<E>` to propagate a typed failure or `Ok<T>`
to recover with a fallback. A `defineErrors` variant factory already returns an
`Err`, so do not wrap it again.

## Await To Consume, Return To Forward

`tryAsync` returns `Promise<Result<T, E>>`.

```typescript
// Consume the Result here.
const { data, error } = await tryAsync({
	try: () => client.read(id),
	catch: (cause) => ReadError.Failed({ id, cause }),
});

// Forward ownership to the caller without an unnecessary await.
return tryAsync({
	try: () => client.read(id),
	catch: (cause) => ReadError.Failed({ id, cause }),
});
```

Await when this scope needs to inspect or transform the Result. Return the
Promise directly when the caller owns the unchanged Result. Do not discard it
with `void tryAsync(...)`: ordinary failures fulfill with `Err`, so a Promise
`.catch(...)` does not observe them. A best-effort operation still needs an
async owner that awaits the Result and deliberately logs or ignores its Err
branch.

## Choose One Failure Boundary

Wrap the smallest coherent operation whose thrown failures intentionally map to
one error vocabulary.

Keep operations separate when they need different variants, recovery, cleanup,
or retry behavior:

```typescript
const responseResult = await tryAsync({
	try: () => fetch(url),
	catch: (cause) => ImportError.RequestFailed({ url, cause }),
});
if (responseResult.error !== null) return responseResult;

if (!responseResult.data.ok) {
	return ImportError.HttpFailed({
		url,
		status: responseResult.data.status,
	});
}

return tryAsync({
	try: () => responseResult.data.json(),
	catch: (cause) => ImportError.InvalidJson({ url, cause }),
});
```

Group multiple calls only when they genuinely share one failure meaning and no
intermediate result needs separate handling.

`tryAsync` catches and maps failures. It does not make several side effects
atomic and does not roll back completed work. Only call a grouped operation
atomic when one transaction primitive covers every side effect:

```typescript
return tryAsync({
	try: () =>
		db.transaction(async (tx) => {
			const document = await tx.documents.insert(input);
			await tx.audit.insert({ documentId: document.id });
			return document;
		}),
	catch: (cause) => SaveError.TransactionFailed({ cause }),
});
```

For cross-system work, an outbox can atomically record intent for eventual
delivery and compensation can remediate partial completion. Neither makes the
combined side effects atomic.

## Propagate Without Losing The Wrapper

After destructuring, `error` is the raw `E`, not an `Err<E>`.

```typescript
const { data, error } = await loadUser(id);
if (error !== null) return Err(error);

return Ok(data);
```

When you kept the intact Result, return it directly:

```typescript
const result = await loadUser(id);
if (result.error !== null) return result;
```

## Recover With A Concrete Success Type

When `catch` returns `Ok<T>`, the inferred Result type has no Err branch if the
handler returns normally. The handler can still throw. Keep both branches on
the same concrete `T`.

```typescript
type Config = { theme: 'light' | 'dark'; fontSize: number };

const defaultConfig: Config = { theme: 'dark', fontSize: 14 };

const { data: config } = trySync({
	try: (): Config => ConfigSchema.parse(JSON.parse(configJson)),
	catch: () => Ok(defaultConfig),
});
```

## Constructors And Utilities

```typescript
const userResult = Ok({ id: '123', name: 'Alice' });
const missingResult = Err({ name: 'NotFound', message: 'User not found' });
const completedResult = Ok(undefined);
```

- `isOk` / `isErr`: narrow a known Result.
- `isResult`: make a shallow check for the `{ data, error }` property shape; it
  does not validate either payload.
- `unwrap`: return `data` or throw `error`; reserve it for an intentional
  exception boundary, tests, and scripts.
- `resolve`: unwrap a Result or pass a plain value through; useful when an
  adapter accepts either form.
- `tapErr`: run a side effect for `Err` and return the original Result.
- `partitionResults`: split Results into `oks` and `errs`; both arrays retain
  the Result wrappers.

## Final Check

- Discriminate with `error !== null` or `isErr`.
- Use `trySync` only for sync operations and `tryAsync` only for Promise-returning operations.
- Await to consume; return directly to forward.
- Do not wrap an existing Result and create a nested Result.
- Map each caught failure to a non-null, intentional error variant.
- Do not claim atomicity unless another primitive provides it.
- After destructuring, use `Err(error)` to propagate the failure wrapper.

See `define-errors` for tagged error factories and `patterns` for broader
service composition.
