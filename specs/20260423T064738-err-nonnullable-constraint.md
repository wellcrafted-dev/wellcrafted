# Constrain `Err<E>` so `Err(null)` is a compile error

**Date**: 2026-04-23
**Status**: Implemented in this PR — constraint applied, tests locking it in, consumer survey confirmed zero hits
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

## What shipped

1. **Survey** — grepped `~/Code/wellcrafted/src`, `packages/`, `apps/` in the epicenter monorepo for `Err(null)` / `Err(undefined)`. Zero real hits. Two hits were in JSDoc comments discussing the edge itself, not real construction.
2. **Constraint applied** to the `Err` constructor: `export const Err = <E extends NonNullable<unknown>>(error: E): Err<E> => ({ error, data: null })`. The `Err<E>` type itself is unchanged — only the constructor narrows.
3. **Tests added** in `src/result/result.test.ts` — `@ts-expect-error` directives lock in that `Err(null)` and `Err(undefined)` fail at compile time, plus positive cases for strings, Error instances, tagged errors, `0`, `false` (non-nullable falsy values still work).
4. **Changeset** — shipped as a minor bump (would be a `major` in strict SemVer, but wellcrafted is pre-1.0 where breaking type-level changes are acceptable in minor per its existing policy — same rule followed by the logger PR).

## What this does not replace

The `skills/result-types/SKILL.md` rule ("always discriminate by the error side") stays load-bearing. The type-level constraint prevents the common footgun but doesn't remove the general principle. Runtime discrimination code should still use `isErr(result)` / `result.error !== null`, never `data === null`.
