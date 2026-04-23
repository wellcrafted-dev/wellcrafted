---
title: "Err(null) Is Ok(null)"
description: "Why wellcrafted can't tell a null-valued failure from a null-valued success, what we tried to do about it, and why we stopped trying"
icon: 'equal'
---

# Err(null) Is Ok(null)

wellcrafted's Result shape has a blind spot. If you pass `null` to the `Err` constructor, the runtime can't tell the resulting value apart from `Ok(null)`. We noticed. We tried to fix it with a type-level ban. Then we reverted. This is the story.

## The shape

Wellcrafted's headline feature is that a Result looks like what you already know — the same `{ data, error }` shape Supabase and SvelteKit load functions use:

```typescript
type Ok<T>  = { data: T;    error: null };
type Err<E> = { error: E;   data: null };
type Result<T, E> = Ok<T> | Err<E>;
```

And the built-in discriminator checks the error side:

```typescript
const isErr = <T, E>(r: Result<T, E>): r is Err<E> => r.error !== null;
```

That shape is why you can destructure a Result the same way you destructure a Supabase response, and why the library fits any codebase that already uses this pattern. It's the trade that earns the library its keep.

It's also why `Err(null)` breaks.

## The collision

Construct an Ok with a null payload and an Err with a null reason:

```typescript
Ok(null)   // { data: null, error: null }
Err(null)  // { error: null, data: null }
```

Same runtime object. Property order doesn't matter in JavaScript. `isErr` checks `error !== null`, which returns `false` for both. So:

```typescript
const result = Err(null);
isOk(result);   // true  — wrong
isErr(result);  // false — wrong
```

Your failure became a success. The type system said the variable was `Err<null>`; the runtime said it was `Ok<null>`. The discriminator lied.

This isn't a bug we can patch. It's the shape telling you what it can and can't represent.

## Shape-based Result libraries have a structural limit: they can't distinguish "success with null payload" from "failure with null reason."

A tagged-union Result can:

```rust
// Rust — two variants with a discriminant byte
enum Result<T, E> { Ok(T), Err(E) }

let success: Result<(), ()> = Ok(());
let failure: Result<(), ()> = Err(());
matches!(failure, Err(_))  // true
```

`Ok(())` and `Err(())` are runtime-distinguishable even when `T` and `E` are both the unit type. The discriminant byte holds the tag. `match` reads the byte, not the payload.

Wellcrafted can't do this without giving up the destructuring shape. No discriminant byte lives in `{ data, error }`. The shape *is* the discriminator, and when both slots are `null`, the shape has nothing to say.

This isn't a universal property of Results. It's a consequence of the shape we chose. Rust disagrees with wellcrafted because Rust chose differently.

## The type-level ban we tried

The obvious patch: ban `Err(null)` at the constructor.

```typescript
// The attempt
export const Err = <E extends NonNullable<unknown>>(error: E): Err<E> =>
  ({ error, data: null });
```

`NonNullable<unknown>` excludes `null` and `undefined`. `Err(null)` becomes a compile error. Problem solved.

We shipped it. Reviewed it. Reverted it. Here's why.

### The enforcement is shallow

The ban catches the literal case: `Err(null)` as written. Everything else slips through.

```typescript
Err(value as any)                          // bypassed — any cast defeats the constraint
Err(value as NonNullable<typeof value>)    // bypassed — the cast is a lie if value is actually null
Err(value)                                 // bypassed if typeof value permits null via a bad upstream type
({ error: null, data: null }) as Err<null> // bypassed — direct object construction
```

Most damning: the migration for the ban itself used this pattern:

```typescript
// From src/query/utils.ts in the ban PR
catch (error) {
  return Err(error as NonNullable<TError>);
}
```

The `as NonNullable<TError>` cast silences TypeScript without preventing the runtime case. If `TError` includes null-thrown values (and `catch (e: unknown)` always does — `throw null` is legal JavaScript), this cast *is* the bug it claims to fix. The ban's own migration produced unsafe casts.

### The cost is wide

The ban added friction at every `catch` boundary in every downstream codebase. The TC39/TS consensus is `catch (e): unknown`. That's the type every catch in every codebase has. When you write:

```typescript
catch: (error) => Err(error)
```

...the ban triggers a type error because `unknown` includes `null | undefined`. You now have to reach for either a cast (which doesn't enforce the invariant) or a different pattern (which is the real answer, but the type error doesn't tell you so).

Multiply that by every `tryAsync`/`trySync` catch in every service file in every consumer, and you've added a lot of friction for a nudge the type error can't clearly articulate.

### The teaching value is replaceable

What the ban *wanted* to teach: "don't pass raw `unknown` to `Err` — wrap it in a tagged error instead."

What the ban *actually* taught, most of the time: "add `as NonNullable<T>` to make the type error go away."

The fix at hand is a cast. The cast is wrong. The type error doesn't explain the right fix. So the ban teaches the wrong lesson more often than the right one.

The correct lesson — **use `defineErrors` and pass `{ cause: error }`** — is better taught by documentation than by a compile error. The tagged error is non-null by construction, so the shape's invariant holds even if the cause was `null`. Documentation + idiom enforces the rule more reliably than the constraint does.

## What we shipped instead

Errs can still be constructed with any value. `Err<E>` has no `NonNullable` constraint. Pre-validation, like every Result library in the shape family, is a documentation and idiom problem, not a type-system problem.

The documented rule:

> `Err(null)` produces `{ data: null, error: null }` — structurally identical to `Ok(null)`. Under our shape, `isErr`/`isOk` read it as Ok, so `Err(null)` silently becomes success. `Err(undefined)` is also discouraged — the discriminator technically works (the error field is `undefined`, not `null`), but `undefined` is falsy so `if (error)` checks trip downstream, and the error carries no information. **Don't call `Err` with `null` or `undefined`.** Either:
>
> - Use `Ok(null)`/`Ok(undefined)` (if what you meant was success-with-no-payload).
> - Define a tagged error via `defineErrors` with a real name.
> - Wrap a caught exception as `TaggedError.Unexpected({ cause: error })`.

And the deeper rule, which the tagged-errors idiom expresses automatically:

> At every `catch (error: unknown)` boundary, don't pass the raw `unknown` to `Err`. Wrap it in a tagged error. The tagged error is non-null by construction, so the shape's invariant holds regardless of what was caught.

```typescript
// The pattern
const Errors = defineErrors({
  Unexpected: ({ cause }: { cause: unknown }) => ({
    message: extractErrorMessage(cause),
    cause,
  }),
});

const result = await tryAsync({
  try:   async () => fetchThing(),
  catch: (error) => Errors.Unexpected({ cause: error }),
});
```

The tagged error `{ name: 'Unexpected', message, cause, ... }` is always non-null — it's a constructed object. `Err(taggedError)` produces `{ error: taggedError, data: null }`, which has a non-null error side. `isErr` reads it correctly. The shape's invariant is preserved, and the author didn't have to know the invariant existed.

## The meta-lesson

Shape choices are invariant choices. When wellcrafted picked the destructure-friendly `{ data, error }` shape, it picked a discriminator (`error !== null`) that implicitly assumes error values are never null. That assumption isn't documented in the shape — the shape has no way to document it — so it has to live as a convention.

We tried to promote the convention into a type-level constraint. The attempt failed because:

1. The constraint only catches literal null errors, not the broader class of runtime-null errors coming through `unknown`-typed boundaries.
2. The friction is paid at every catch boundary in every consumer codebase.
3. The intended lesson (use tagged errors) is better delivered by documentation than by a type error whose natural fix is a cast.

The honest move is to keep the shape, document the convention, and let the tagged-errors idiom carry the enforcement. The shape has a limit. We can't patch around it in the types. We can make the limit easy to avoid in practice.

If you ever find yourself writing `Err(null)`, the shape is telling you something: either you meant `Ok(null)`, or you haven't defined the error type yet. Both are fixable by looking at the call site. Neither is fixable by the constructor.

## What this does and doesn't change

- **The shape:** unchanged. Still `{ data: T; error: null } | { data: null; error: E }`.
- **Discriminators:** unchanged. Still `isErr(r) === r.error !== null`.
- **The `Err` constructor:** accepts any `E`. No `NonNullable` constraint.
- **The skill:** stronger. The rule was implicit; now it's documented with examples.
- **Existing consumers:** nothing to migrate. Code that uses tagged errors (the recommended pattern) is unaffected either way.

If you came here looking for a type-level guarantee that `Err(null)` won't happen, you won't find one. What you'll find is a library that makes the right pattern the path of least resistance, and a documentation page (this one) explaining why the alternative didn't work.
