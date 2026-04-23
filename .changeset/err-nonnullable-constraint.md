---
"wellcrafted": minor
---

`Err` constructor now rejects `null` and `undefined` at the type level.

```ts
// Before — compiled fine; structurally identical to Ok(null), broke isErr
Err(null);

// After — compile error
// @ts-expect-error — null is not assignable to NonNullable<unknown>
Err(null);
```

Why: `Err(null)` produces `{ error: null, data: null }`, which is structurally identical to `Ok(null)`, silently misclassifying as Ok under `isErr` (which checks `error !== null`). `Err(null)` has no meaningful semantics — a failure with no reason. If you want "completed with no payload," use `Ok(undefined)` or `Ok(null)`. If you want to represent failure, pass a real error value (string, `Error`, tagged error from `defineErrors`, etc.).

The `Err<E>` *type* is unchanged — you can still type arguments as `Err<E>` with any `E`. The constraint only applies at construction time.

Survey confirmed zero real `Err(null)` / `Err(undefined)` calls across the canonical consumers (epicenter monorepo).
