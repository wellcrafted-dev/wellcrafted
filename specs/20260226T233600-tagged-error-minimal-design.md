# Tagged Error Minimal Design: First Principles Redesign

**Created**: 2026-02-26
**Status**: Accepted — all decisions finalized
**Scope**: wellcrafted `TaggedError` type, `createTaggedError` builder API
**Related**: `20260226T000000-granular-error-migration.md` (service-by-service migration, depends on this)

## Summary

A critical examination of `TaggedError`'s shape, stripped to first principles. The current design has four fields: `name`, `message`, `context`, `cause`. This spec argues for two non-negotiable fields (`name`, `message`) with additional properties spread flat on the error object rather than nested under `context`.

---

## The Console Log Test

The design principle: imagine every error in the app hits one logging function. What do you actually want to see?

```
[RecorderBusyError] A recording is already in progress

[ResponseError] HTTP 401
  provider: openai
  status: 401
  model: gpt-4o

[DbQueryError] Database insert on recordings failed
  table: recordings
  operation: insert
  backend: indexeddb
```

Three completely different shapes. The only universal fields are **name** and **message**. Everything else is domain-specific.

---

## Decision: Non-Negotiable Fields

### `name` — The discriminant tag

```typescript
switch (error.name) {
  case 'ResponseError': ...
  case 'ConnectionError': ...
  case 'ParseError': ...
}
```

This is the entire reason the pattern exists. Machine-readable. Exhaustive matching. Type narrowing. No debate.

### `message` — Human-readable description

Every error needs a string to show or record. Logs, toast notifications, debugging — `message` is consumed everywhere. And critically, `message` is computed from the error's data via `.withMessage()`, which is the whole point of the builder: define the template once, every call site gets a consistent message.

### The minimum TaggedError

```typescript
type TaggedError<TName extends string> = Readonly<{
  name: TName;
  message: string;
}>;
```

This is already defined as `AnyTaggedError` in the current codebase (line 21 of `types.ts`). It's sufficient for discriminated unions, human-readable output, and serialization.

---

## Decision: Flat Spreading Over Nested `context`

### The current design (nested)

```typescript
type TaggedError<TName, TContext, TCause> = Readonly<
  { name: TName; message: string }
  & WithContext<TContext>  // → { context: TContext }
  & WithCause<TCause>     // → { cause: TCause }
>;
```

Access: `error.context.status`, `error.context.provider`

### The new design (flat)

```typescript
type TaggedError<TName extends string, TFields extends JsonObject = Record<never, never>> = Readonly<
  { name: TName; message: string } & TFields
>;
```

Access: `error.status`, `error.provider`

### Why flat is better

**1. Ergonomics at consumption sites**

```typescript
// Nested (current) — awkward destructuring
case 'ResponseError': {
  const { context: { status }, message } = postError;
}

// Flat (new) — just works
case 'ResponseError': {
  const { status, message } = postError;
}
```

**2. Ergonomics in message templates**

```typescript
// Nested
.withMessage(({ context }) => `HTTP ${context.status}`)

// Flat
.withMessage(({ status }) => `HTTP ${status}`)
```

**3. Simpler mental model**

An error IS its properties. `{ name: 'ResponseError', message: 'HTTP 401', status: 401, provider: 'openai' }` reads as a single coherent object, not a wrapper around some inner data bag.

### The namespace collision argument (and why it's solvable)

The main counter-argument: "what if a context field is named `name` or `message`?" This is trivially prevented at the type level:

```typescript
type ReservedKeys = 'name' | 'message';

type ValidFields<T extends Record<string, JsonValue>> =
  keyof T & ReservedKeys extends never ? T : never;
```

TypeScript would reject `.withFields<{ name: string }>()` at compile time. The builder API already enforces types — adding one more constraint is trivial.

### The structured logging argument (and why it's minor)

Nested context is slightly easier to scan in JSON logs:

```json
// Flat — all fields mixed
{ "name": "ResponseError", "message": "HTTP 401", "status": 401, "provider": "openai" }

// Nested — grouped
{ "name": "ResponseError", "message": "HTTP 401", "context": { "status": 401, "provider": "openai" } }
```

But this is a readability preference, not a structural problem. And the grouping is trivially reconstructible:

```typescript
const { name, message, ...rest } = error;
// rest = { status: 401, provider: 'openai' }
```

### The serialization win

Flat errors are trivially JSON-serializable and reconstructible. No nested structure to preserve or recreate across boundaries (IPC, worker messages, network). `JSON.parse(JSON.stringify(error))` round-trips perfectly since every field is a top-level `JsonValue`. The nested `context` design required consumers to know about the nesting to reconstruct errors — flat errors are just plain objects.

### The generic operations argument (and why it's fine)

"How do you write a function that takes any tagged error and accesses just the extra fields?"

```typescript
// Nested: error.context
// Flat: const { name, message, ...context } = error;
```

One extra line. And in practice, generic error handling rarely needs to iterate over context fields — it uses `name` for routing and `message` for display. The specific typed fields are only accessed after narrowing, where the flat form is better.

---

## Decision: `cause` Is Not a First-Class Field

### How `cause` is used today

| Claim | Reality |
|---|---|
| Preserves original error for debugging | `extractErrorMessage(error)` destroys it everywhere — the original error object is gone |
| Sentry uses it for stack grouping | No Sentry integration exists. If it did, JavaScript's native `Error.cause` (ES2022) is the standard |
| Error chain traversal | No code in the codebase walks a cause chain |

### The honest assessment

```
┌──────────┬─────────────────────────┬──────────────────────────────────┐
│ Field    │ Consumer                │ Reality                         │
├──────────┼─────────────────────────┼──────────────────────────────────┤
│ name     │ Code (switch/match)     │ Essential. No debate.           │
│          │ Logs (filtering)        │                                 │
├──────────┼─────────────────────────┼──────────────────────────────────┤
│ message  │ User (toast)            │ Essential. No debate.           │
│          │ Logs (human-readable)   │                                 │
├──────────┼─────────────────────────┼──────────────────────────────────┤
│ context  │ Code (structured data)  │ Useful but varies wildly.       │
│          │ Logs (searchable fields)│ → Spread flat, not nested.      │
├──────────┼─────────────────────────┼──────────────────────────────────┤
│ cause    │ Developers (debugging)  │ Currently destroyed everywhere. │
│          │ Sentry (grouping)       │ Nobody uses it today.           │
└──────────┴─────────────────────────┴──────────────────────────────────┘
```

`cause` as a top-level field on `TaggedError` is ceremony nobody uses. If a specific error type wants to carry the original error, it's just another typed field:

```typescript
const { BackendError, BackendErr } = createTaggedError('BackendError')
  .withFields<{ backend: string; cause: string }>()
  .withMessage(({ backend }) => `${backend} failed`);
```

No special type machinery. No `WithCause<TCause>` conditional type. No `.withCause()` builder step. Just a field, like any other.

---

## Type Design

### The TaggedError type

```typescript
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = Record<string, JsonValue>;

// Prevent collision with reserved error fields
type ReservedKeys = 'name' | 'message';
type ValidFields<T extends JsonObject> =
  keyof T & ReservedKeys extends never ? T : never;

// The error type — two required fields, additional props spread flat
type TaggedError<
  TName extends string = string,
  TFields extends JsonObject = Record<never, never>,
> = Readonly<{ name: TName; message: string } & TFields>;

// Minimum constraint for "any tagged error"
type AnyTaggedError = { name: string; message: string };
```

### What the builder produces

```typescript
// No extra props — just name + message
const { FsServiceError, FsServiceErr } = createTaggedError('FsServiceError')
  .withMessage(() => 'File system operation failed');
// Shape: { name: 'FsServiceError', message: string }

// With props — spread flat on the error
const { ResponseError, ResponseErr } = createTaggedError('ResponseError')
  .withFields<{ status: number; reason?: string }>()
  .withMessage(({ status }) => `HTTP ${status}`);
// Shape: { name: 'ResponseError', message: string, status: number, reason?: string }

// "Cause" is just another field if you want it
const { BackendError, BackendErr } = createTaggedError('BackendError')
  .withFields<{ backend: string; cause: string }>()
  .withMessage(({ backend }) => `${backend} failed`);
// Shape: { name: 'BackendError', message: string, backend: string, cause: string }
```

### How the builder changes

```
Current chain:     createTaggedError('XError').withContext<C>().withCause<E>().withMessage(fn)
New chain:         createTaggedError('XError').withFields<F>().withMessage(fn)
```

- `.withContext()` → renamed to `.withFields()`
- `.withCause()` → removed as a builder step
- `.withMessage()` — still the required terminal step, but the message function receives `TFields` instead of `{ name, context?, cause? }`
- **`message` is no longer accepted as factory input** — the template is the sole source of message computation

### Call site input changes

```typescript
// Current — nested under `context`
ResponseErr({ context: { status: 404 } })

// New — flat
ResponseErr({ status: 404 })
```

The factory function's input is just `TFields` (or optional when `TFields` is empty):

```typescript
// When TFields = Record<never, never>: no argument needed
FsServiceErr()

// When TFields has required fields: argument required
ResponseErr({ status: 404 })

// When all TFields fields are optional: argument optional
SomeErr()  // or SomeErr({ reason: 'details' })
```

---

## Three Tiers of Error Complexity (Flat Design)

These tiers carry forward from the granular migration spec, adapted for flat props.

### Tier 1: Static errors — no props, no arguments

The error name + template IS the message. Use when there's no dynamic content.

```typescript
const { RecorderBusyError, RecorderBusyErr } = createTaggedError('RecorderBusyError')
  .withMessage(() => 'A recording is already in progress');

RecorderBusyErr()  // no argument needed
// → { name: 'RecorderBusyError', message: 'A recording is already in progress' }
```

### Tier 2: Reason-only — `reason` carries `extractErrorMessage(error)`

Use when the only dynamic content is the stringified caught error.

```typescript
const { PlaySoundError, PlaySoundErr } = createTaggedError('PlaySoundError')
  .withFields<{ reason: string }>()
  .withMessage(({ reason }) => `Failed to play sound: ${reason}`);

PlaySoundErr({ reason: extractErrorMessage(error) })
// → { name: 'PlaySoundError', message: 'Failed to play sound: device busy', reason: 'device busy' }
```

### Tier 3: Structured data — domain-specific fields

Use when there's data worth preserving as named fields that callers branch on.

```typescript
const { ResponseError, ResponseErr } = createTaggedError('ResponseError')
  .withFields<{ status: number; reason?: string }>()
  .withMessage(({ status, reason }) =>
    `HTTP ${status}${reason ? `: ${reason}` : ''}`
  );

ResponseErr({ status: 404 })
// → { name: 'ResponseError', message: 'HTTP 404', status: 404 }

ResponseErr({ status: 500, reason: 'Internal error' })
// → { name: 'ResponseError', message: 'HTTP 500: Internal error', status: 500, reason: 'Internal error' }
```

---

## Message Function Signature

The `.withMessage()` callback receives the error's props (without `name` and `message`, since `message` is what it's computing and `name` is always the literal string from `createTaggedError`).

```typescript
// Current signature (nested)
type MessageFn<TContext, TCause> = (input: {
  name: TName;
  context?: TContext;
  cause?: TCause;
}) => string;

// New signature (flat)
type MessageFn<TFields extends JsonObject> = (input: TFields) => string;
```

Examples of what the message function receives:

```typescript
// Tier 1: no props → receives {}
.withMessage(() => 'Static message')

// Tier 2: { reason: string } → receives { reason: string }
.withMessage(({ reason }) => `Failed: ${reason}`)

// Tier 3: { status: number; provider: string } → receives { status, provider }
.withMessage(({ status, provider }) => `${provider}: HTTP ${status}`)
```

Note: `name` is NOT passed to the message function. It's redundant — the message function is already defined inside `createTaggedError('XError')`, so the name is known at definition time. If a message template truly needs the name (rare), it can close over it.

---

## Builder Implementation Sketch

The runtime implementation of `createTaggedError` changes minimally. The builder is already a closure that captures `name` and returns chain methods. The key differences:

### Current implementation (simplified)

```typescript
function createTaggedError<TName extends `${string}Error`>(name: TName) {
  function createBuilder<TContext, TCause>() {
    return {
      withContext: <C>() => createBuilder<C, TCause>(),
      withCause: <E>() => createBuilder<TContext, E>(),
      withMessage: (fn) => {
        const errorConstructor = (input = {}) => ({
          name,
          message: fn({ name, ...input }),
          ...('context' in input ? { context: input.context } : {}),
          ...('cause' in input ? { cause: input.cause } : {}),
        });
        // ... return { [name]: errorConstructor, [errName]: errConstructor }
      },
    };
  }
  return createBuilder();
}
```

### New implementation (simplified)

```typescript
function createTaggedError<TName extends `${string}Error`>(name: TName) {
  function createBuilder<TFields extends JsonObject>() {
    return {
      withFields: <P extends ValidFields<P>>() => createBuilder<P>(),
      withMessage: (fn: (input: TFields) => string) => {
        // Input is optional only when TFields has no required keys (Tier 1).
        // When TFields has required keys (Tier 2/3), the argument is required.
        // This is enforced via a conditional type on the factory signature:
        //   TFields extends Record<never, never>
        //     ? (input?: TFields) => TaggedError<TName, TFields>
        //     : (input: TFields) => TaggedError<TName, TFields>
        const errorConstructor = (input?: TFields) => ({
          name,
          message: fn(input ?? {} as TFields),
          ...(input ?? {}),
        });
        const errName = name.replace(/Error$/, 'Err');
        const errConstructor = (input?: TFields) => Err(errorConstructor(input));
        return {
          [name]: errorConstructor,
          [errName]: errConstructor,
        };
      },
    };
  }
  return createBuilder<Record<never, never>>();
}
```

Key changes:
- **One type parameter** (`TFields`) instead of two (`TContext`, `TCause`)
- **No nesting** — `input` is spread directly onto the error object
- **No conditional context/cause handling** — just `...(input ?? {})`
- **`ValidFields` enforced** at the `.withFields()` call to prevent reserved key collisions
- **Implementation note on `ValidFields`**: The self-referential constraint `<P extends ValidFields<P>>` works in TypeScript but may produce cryptic error messages (e.g., "Type 'X' does not satisfy constraint 'never'" instead of "'name' is a reserved field"). During implementation, test the developer experience and consider alternative approaches (e.g., a branded error type or mapped type with `@ts-expect-error` guidance) if the diagnostics are unclear.

---

## The Mental Model

```
┌─────────────────────────────────────────────────────────┐
│ name     →  "What broke?" (for code / switch matching)  │
│ message  →  "What do I tell the user?" (for UI / logs)  │
│ ...rest  →  "What else matters?" (typed per error)      │
└─────────────────────────────────────────────────────────┘
```

- **Small services** (autostart, tray, sound): no extra props. `name` + `message` is the whole error.
- **API services** (completion, transcription): extra props carry `provider`, `status`, `retryable`.
- **CRUD services** (DB, recorder): extra props carry `operation`, `table`, `backend`.
- **`cause`**: If a specific error type wants it, it's `cause: string` as a regular prop. Not special.

---

## Resolved Decisions

### 1. `.withContext()` renamed to `.withFields()` — DECIDED

The concept of "context" is gone entirely. `.withFields()` says exactly what it is — additional fields spread flat on the error object. No React "props" baggage, no ambiguous "context" implying nesting.

```typescript
createTaggedError('ResponseError')
  .withFields<{ status: number }>()
  .withMessage(({ status }) => `HTTP ${status}`)
```

### 2. Fully flat input at call sites — DECIDED

```typescript
ResponseErr({ status: 404, reason: 'Not found' })
```

The input shape mirrors the output shape (minus `name` and `message`). No wrapper key.

### 3. Reserved keys: only `name` and `message` — DECIDED

Don't design for hypothetical futures. If we add a field later, we add it to the reserved list at that time.

### 4. `.because()` — does not exist, not adding it — DECIDED

The method doesn't exist in the current v0.31.0 API. No code uses it. Not adding it.

### 5. Remove explicit `message` overrides — DECIDED

This is the biggest migration concern and the most important decision in this spec.

**The problem**: In the current codebase, **every single call site** passes an explicit `{ message: '...' }` string, bypassing the template function entirely. The templates are dead code at runtime:

```typescript
// Current reality — template never runs
const { FsServiceError, FsServiceErr } = createTaggedError('FsServiceError')
  .withMessage(() => 'File system operation failed');  // ← dead code

FsServiceErr({ message: 'Failed to read config file' })  // ← always overrides
FsServiceErr({ message: 'Failed to write recording' })   // ← always overrides
```

**The decision**: `message` is an output of the template, not an input from the call site. The factory input type should not include `message` at all — the builder computes it. The migration must:

1. **Upgrade error definitions** to have templates that produce useful messages from their fields
2. **Remove explicit `message` overrides** at every call site — pass only the fields, let the template compute the message
3. **For errors that need per-site messages**: add a `reason: string` field (Tier 2) instead of overriding `message` directly

**Before (current — message override):**

```typescript
FsServiceErr({ message: `Failed to read config: ${extractErrorMessage(error)}` })
```

**After (Tier 2 — reason field, template computes message):**

```typescript
const { FsServiceError, FsServiceErr } = createTaggedError('FsServiceError')
  .withFields<{ reason: string }>()
  .withMessage(({ reason }) => `File system operation failed: ${reason}`);

FsServiceErr({ reason: extractErrorMessage(error) })
```

**After (Tier 3 — structured fields, template computes message):**

```typescript
const { FsServiceError, FsServiceErr } = createTaggedError('FsServiceError')
  .withFields<{ operation: string; path: string; reason: string }>()
  .withMessage(({ operation, path }) => `Failed to ${operation} ${path}`);

FsServiceErr({ operation: 'read', path: '/config.json', reason: extractErrorMessage(error) })
```

This is the whole point of the builder pattern — define the template once, every call site gets a consistent message format. If call sites can override `message`, the template is pointless and message formats become inconsistent across the codebase.

### 6. Reconcile with the granular migration spec — DECIDED

The granular error migration spec (`20260226T000000-granular-error-migration.md`) should be updated to target the flat design from this spec. Each service's migration must include removing `message` overrides and upgrading templates to be the sole source of message computation.

---

## History / Decision Log

### Why we examined this

The granular error migration work forced a question: if we're touching every error definition and every call site anyway, should we also fix the shape of `TaggedError` itself? The answer was yes — the nested `context` bag and first-class `cause` field were adding complexity without proportional value.

### The namespace collision debate

**Initial position**: Flat spreading is dangerous because context fields could collide with `name` or `message`.

**Resolution**: This is trivially solved at the type level with `ValidFields<T>`. TypeScript rejects collisions at compile time. The collision argument was a lazy justification for the status quo, not a real problem.

```typescript
type ReservedKeys = 'name' | 'message';
type ValidFields<T extends JsonObject> =
  keyof T & ReservedKeys extends never ? T : never;

// This would be a compile error:
createTaggedError('X').withFields<{ name: string }>()  // ← rejected
```

### The cause debate

**Initial position**: `cause` is valuable for error chaining and stack trace preservation.

**Counter-evidence**: Every call site in the codebase does `extractErrorMessage(error)`, destroying the original error. No code walks cause chains. JavaScript already has `Error.cause` (ES2022) for native error chaining. `cause` as a first-class field is ceremony nobody consumes.

**Resolution**: Remove `cause` as a built-in concept. If an error type needs it, it's just another typed field in its props.

### The access pattern comparison

The decisive argument. Side by side:

```typescript
// Nested — current
case 'ResponseError': {
  const { context: { status }, message } = postError;
}

// Flat — new
case 'ResponseError': {
  const { status, message } = postError;
}
```

```typescript
// Nested — message template
.withMessage(({ context }) => `HTTP ${context.status}`)

// Flat — message template
.withMessage(({ status }) => `HTTP ${status}`)
```

Flat wins on ergonomics in both consumption and definition. The nested form adds a layer of indirection that nobody benefits from.

### The message override debate

**Initial position**: Factories should accept an optional `message` override so call sites can provide specific context.

**Counter-evidence**: Every single call site in the codebase passes an explicit `{ message: '...' }` override, making every template function dead code. The templates never run. This defeats the entire purpose of the builder pattern — consistent message formats defined once, not ad-hoc strings scattered across dozens of call sites.

**Resolution**: Remove `message` from factory input entirely. The template is the sole source of message computation. Call sites that need per-instance context use a `reason: string` field (Tier 2) or structured fields (Tier 3), and the template incorporates them into a consistent format.

---

## What This Spec Does NOT Cover

- **Service-by-service migration**: See `20260226T000000-granular-error-migration.md`
- **The `Result` type (`Ok`/`Err`)**: Unchanged by this work
- **`trySync`/`tryAsync`**: Unchanged by this work
- **The `Err` factory suffix convention** (`ResponseErr` wraps in `{ error, data: null }`): Unchanged

---

## Next Steps

1. ~~Resolve open questions~~ — All decided (see Resolved Decisions above)
2. Implement the new `TaggedError` type and `createTaggedError` builder in wellcrafted
   - ~~Flatten the error shape (no `context` wrapper)~~ — Done: `TaggedError<TName, TFields>` with flat spread
   - ~~Add `ValidFields<T>` compile-time guard for reserved keys~~ — Done: rejects `name` | `message` at compile time
   - Rename `.withContext()` → `.withFields()` — In progress (builder implementation)
   - Remove `.withCause()` from the builder — In progress (builder implementation)
   - Remove `message` from factory input — template is the sole source — In progress (builder implementation)
3. Update the granular error migration spec to target the flat design with message override removal
4. Migrate all error definitions and call sites (per-service, as planned in the migration spec)
