---
name: result-types
description: Use wellcrafted Result values, exact guards, throwing boundaries, recovery, and small Result utilities.
---

# Result types

```typescript
import {
  Err,
  Ok,
  isErr,
  isOk,
  partitionResults,
  resolve,
  tapErr,
  tryAsync,
  trySync,
  unwrap,
  type Result,
} from "wellcrafted/result";
```

## Shape and discrimination

```typescript
type Result<T, E> =
  | { data: T; error: null }
  | { data: null; error: E };
```

Use `result.error !== null`, `isErr(result)`, or `isOk(result)`. Do not use generic truthiness: the public Err type permits `0`, `false`, `""`, `undefined`, and `NaN`.

```typescript
const result = await loadUser(userId);
if (result.error !== null) return result;

return Ok(result.data.name);
```

`Ok(null)` is valid. `Err(null)` creates the same `{ data: null, error: null }` structure, so no guard can recover the intended branch. Keep error values non-null and meaningful. `isResult` checks only for a non-null object with both keys; it does not validate payloads.

## Wrap a narrow throwing operation

Use `trySync` or `tryAsync` around the smallest operation with one failure meaning. The catch callback returns an Err-producing variant or an Ok fallback.

```typescript
const userResult = trySync({
  try: () => records.get(userId) ?? null,
  catch: (cause) =>
    UserError.ReadFailed({ cause: extractErrorMessage(cause) }),
});

if (userResult.error !== null) return userResult;
if (userResult.data === null) return UserError.NotFound({ userId });
return Ok(userResult.data);
```

When destructuring, `error` is the raw error body. Wrap it to return a Result:

```typescript
const { data, error } = await operation();
if (error !== null) return Err(error);
return Ok(data);
```

Return `Ok(fallback)` only when the current layer can honestly recover.

```typescript
const config = trySync({
  try: () => JSON.parse(text) as unknown,
  catch: () => Ok(defaultConfig),
});
```

The helpers catch only the `try` callback. A throwing catch callback escapes.

## Deliberate throwing boundaries

`unwrap(result)` returns Ok data and throws the contained Err value. `resolve(value)` does the same for a value that may already be plain. Use them where a throwing consumer requires that contract, not as routine Result flow.

## Small utilities

`tapErr(logFn)` calls the function for Err and returns the same Result reference; a throwing callback escapes.

`partitionResults(results)` returns the original wrappers grouped as `{ oks, errs }`. It requires runtime support for `Object.groupBy`.

The canonical runnable flows are `examples/quick-start.ts` and `examples/service-boundary.ts`. Use the public Result reference for the complete current surface.
