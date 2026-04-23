# Constrain `Err<E>` so `Err(null)` is a compile error

**Date**: 2026-04-23
**Status**: Design proposal — not implementing yet, soliciting feedback
**Author**: Review surfaced during `wellcrafted/logger` integration

## The problem

`Ok(null)` and `Err(null)` are structurally identical:

```ts
Ok(null)   // { data: null, error: null }
Err(null)  // { error: null, data: null }
```

The built-in `isErr` is `result.error !== null`, which classifies `Err(null)` as Ok. `Err(null)` has no meaningful semantics (a failure with no reason), but the type system accepts it. The convention "don't call `Err(null)`" is implicit.

This surfaced while integrating `wellcrafted/logger`. See [skills/result-types/SKILL.md](../skills/result-types/SKILL.md) for the now-documented discriminator rule.

## The proposal

Narrow the `Err` constructor's type:

```ts
// Before
export const Err = <E>(error: E): Err<E> => ({ error, data: null });

// After
export const Err = <E extends NonNullable<unknown>>(error: E): Err<E> =>
  ({ error, data: null });
```

`NonNullable<unknown>` is `{} | Function | <all the primitives except null and undefined>` — it excludes `null` and `undefined`. `Err(null)` becomes a type error; everything else continues working.

The `Err<E>` *type* stays as-is. Only the constructor narrows. Downstream code that types arguments as `Err<E>` where `E` is the caller's discretion keeps working, because the constraint only applies at construction time.

## What breaks

Any code currently calling `Err(null)` or `Err(undefined)`:
- Gives a type error. Refactor: pass a meaningful error, or use `Ok(undefined)` if what you meant was "completed with no payload."

We should survey the wellcrafted public users before shipping. If the breakage is zero or near-zero, ship as a minor bump with a changeset noting the constraint.

## What this does and doesn't fix

Fixes: `Err(null)` at call sites — the most common way to accidentally collide with `Ok(null)`.

Doesn't fix: constructing an `Err<null>` through other paths (e.g., `as Err<null>` casts, `{ error: null, data: null } as Err<null>`). The runtime value still exists; the type system only flags construction. If we want to fix those, we'd need the type itself to be `{ error: NonNullable<E>; data: null }` — but that would break downstream code that uses `Err<E>` generically with nullable `E`. Too disruptive for the size of the problem.

Alternate approach considered: tag-based discrimination (`{ _tag: "Ok" | "Err", ... }`). Biggest safety, biggest disruption, bigger runtime payload. Not recommended.

## Proposed path

1. Survey — grep the canonical wellcrafted consumers (epicenter monorepo at minimum) for `Err(null)` / `Err(undefined)` usage. Predict: zero hits.
2. If zero: ship the constraint as a minor bump.
3. If nonzero: file separate issues per caller, decide whether to refactor them or bump to a major instead.

## What this does not replace

The `skills/result-types/SKILL.md` rule ("always discriminate by the error side") stays load-bearing. The type-level constraint prevents the common footgun but doesn't remove the general principle. Runtime discrimination code should still use `isErr(result)` / `result.error !== null`, never `data === null`.
