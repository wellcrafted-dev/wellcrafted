# Tagged Error Minimal Design: First Principles Redesign

**Created**: 2026-02-26
**Status**: In progress — flat design landed, message simplification next
**Scope**: wellcrafted `TaggedError` type, `createTaggedError` builder API
**Related**: `20260226T000000-granular-error-migration.md` (service-by-service migration, depends on this)

## Summary

A critical examination of `TaggedError`'s shape, stripped to first principles. The original design had four fields: `name`, `message`, `context`, `cause`. This spec argues for two non-negotiable fields (`name`, `message`) with additional properties spread flat on the error object rather than nested under `context`.

Through iterative design, the spec further simplifies: `message` is primarily a call-site input. `.withMessage()` is an **optional** builder step that provides a default message — call sites can always override it. When `.withMessage()` is absent, `message` is required at the call site. The builder's core job is to stamp `name` onto a typed flat object.

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

Every error needs a string to show or record. Logs, toast notifications, debugging — `message` is consumed everywhere. By default, `message` is provided by the call site, because the call site has the most context about what just happened. For errors with predictable, static messages, `.withMessage()` provides a default so call sites don't have to repeat themselves.

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

**2. Simpler mental model**

An error IS its properties. `{ name: 'ResponseError', message: 'HTTP 401', status: 401, provider: 'openai' }` reads as a single coherent object, not a wrapper around some inner data bag.

### The namespace collision argument (and why it's solvable)

The main counter-argument: "what if a context field is named `name` or `message`?" This is trivially prevented at the type level. Two approaches:

**Approach 1: Conditional type (standalone utility)**

```typescript
type ReservedKeys = 'name' | 'message';
type ValidFields<T extends JsonObject> =
  keyof T & ReservedKeys extends never ? T : never;
```

This resolves to `T` when valid, `never` when a reserved key is present. Useful as a standalone utility type, but cannot be used as a self-referential generic constraint (`<P extends ValidFields<P>>` causes circular reference errors in TypeScript).

**Approach 2: Intersection constraint (used in the builder)**

```typescript
type NoReservedKeys = { name?: never; message?: never };
// In the builder:
withFields<T extends JsonObject & NoReservedKeys>(): ErrorBuilder<TName, T>;
```

Any type with `name` or `message` as a key fails to extend `{ name?: never }`, producing a clear compile error. This is the pattern used in the actual implementation because it works cleanly as a generic constraint without circular references.

TypeScript rejects `.withFields<{ name: string }>()` at compile time with either approach. The builder uses Approach 2. `ValidFields<T>` was removed from the public API — it was never imported by any consumer.

**Note**: Once `message` moves to a call-site input (see Decision 7 below), `NoReservedKeys` changes to `{ name?: never }` only — `message` is no longer a reserved field key because it's a built-in input handled separately from `TFields`.

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
  .withFields<{ backend: string; cause: string }>();

BackendErr({ message: `${backend} failed`, backend: 'indexeddb', cause: extractErrorMessage(error) })
```

No special type machinery. No `WithCause<TCause>` conditional type. No `.withCause()` builder step. Just a field, like any other.

---

## Type Design

### The TaggedError type

```typescript
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = Record<string, JsonValue>;

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
// No extra fields, no default — message required at call site
const { SimpleError, SimpleErr } = createTaggedError('SimpleError');
SimpleErr({ message: 'Something went wrong' })
// Shape: { name: 'SimpleError', message: string }

// No extra fields, with default — message optional at call site
const { RecorderBusyError, RecorderBusyErr } = createTaggedError('RecorderBusyError')
  .withMessage(() => 'A recording is already in progress');
RecorderBusyErr()                                        // uses default
RecorderBusyErr({ message: 'Custom: already recording' }) // override
// Shape: { name: 'RecorderBusyError', message: string }

// With fields, no default — message required
const { FsReadError, FsReadErr } = createTaggedError('FsReadError')
  .withFields<{ path: string }>();
FsReadErr({ message: `Failed to read '${path}'`, path })
// Shape: { name: 'FsReadError', message: string, path: string }

// With fields + default — message computed from fields, overridable
const { ResponseError, ResponseErr } = createTaggedError('ResponseError')
  .withFields<{ status: number }>()
  .withMessage(({ status }) => `HTTP ${status}`);
ResponseErr({ status: 404 })                          // message: "HTTP 404"
ResponseErr({ status: 404, message: 'Not found' })    // override
// Shape: { name: 'ResponseError', message: string, status: number }
```

### How the builder changes

```
Original chain:     createTaggedError('XError').withContext<C>().withCause<E>().withMessage(fn)
Intermediate:       createTaggedError('XError').withFields<F>().withMessage(fn)
Final design:       createTaggedError('XError').withFields<F>()              — message required
                    createTaggedError('XError').withFields<F>().withMessage(fn)  — message optional (has default)
```

- `.withContext()` → renamed to `.withFields()`
- `.withCause()` → removed as a builder step
- `.withMessage()` → **optional** builder step that provides a default message (see Decision 7)
- `message` is always part of the factory's input type — required when no `.withMessage()`, optional when `.withMessage()` provides a default

### Call site input

```typescript
// Without .withMessage(): message required
createTaggedError('XError')                    → factory({ message })
createTaggedError('XError').withFields<F>()    → factory({ message, ...fields })

// With .withMessage(): message optional (defaults to template)
createTaggedError('XError').withMessage(fn)              → factory() or factory({ message })
createTaggedError('XError').withFields<F>().withMessage(fn) → factory({ ...fields }) or factory({ message, ...fields })
```

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

## Builder Implementation Sketch

### Original implementation (simplified)

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

### Intermediate implementation (flat + withMessage as terminal)

This was the first landing: flat fields, `.withMessage()` as required terminal step. `message` was never a factory input — the template was the sole source.

```typescript
type NoReservedKeys = { name?: never; message?: never };

function createTaggedError<TName extends `${string}Error`>(name: TName) {
  function createBuilder<TFields extends JsonObject>() {
    return {
      withFields: <T extends JsonObject & NoReservedKeys>() => createBuilder<T>(),
      withMessage: (fn: (input: TFields) => string) => {
        const errorConstructor = (input?: TFields) => {
          const fields = (input ?? {}) as TFields;
          return {
            name,
            message: fn(fields),
            ...fields,
          };
        };
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

### Final implementation (message at call site, optional default via withMessage)

`.withMessage()` is optional. Without it, `message` is required at the call site. With it, `message` is optional — the template provides a default, but the call site can always override.

```typescript
// Only `name` is reserved — `message` is a built-in input, not a field.
type NoReservedKeys = { name?: never };

function createTaggedError<TName extends `${string}Error`>(name: TName) {
  function createBuilder<TFields extends JsonObject>() {
    const errName = name.replace(/Error$/, 'Err') as ReplaceErrorWithErr<TName>;

    // Without .withMessage(): message is required in the input
    const errorConstructor = (input: { message: string } & TFields) => {
      const { message, ...fields } = input;
      return { name, message, ...fields } as TaggedError<TName, TFields>;
    };

    const errConstructor = (input: { message: string } & TFields) =>
      Err(errorConstructor(input));

    return {
      [name]: errorConstructor,
      [errName]: errConstructor,

      withFields: <T extends JsonObject & NoReservedKeys>() => createBuilder<T>(),

      // Optional: provide a default message template.
      // When present, `message` becomes optional in the factory input.
      // The template receives TFields and returns a default message string.
      // Call sites can still pass `message` to override the default.
      withMessage(fn: (input: TFields) => string) {
        const defaultedErrorConstructor = (input?: { message?: string } & TFields) => {
          const { message: messageOverride, ...fields } = (input ?? {}) as { message?: string } & TFields;
          const message = messageOverride ?? fn(fields as TFields);
          return { name, message, ...fields } as TaggedError<TName, TFields>;
        };

        const defaultedErrConstructor = (input?: { message?: string } & TFields) =>
          Err(defaultedErrorConstructor(input));

        return {
          [name]: defaultedErrorConstructor,
          [errName]: defaultedErrConstructor,
        };
      },
    };
  }

  return createBuilder<Record<never, never>>();
}
```

Key changes from intermediate → final:
- **`.withMessage()` is optional** — the builder returns usable factories immediately, without requiring a terminal step
- **`message` is always a valid input** — required when no `.withMessage()`, optional when a default is provided
- **`NoReservedKeys` only reserves `name`** — `message` is a built-in input, not a field collision risk
- **Call-site `message` always wins** — when both a default and a call-site message exist, the call-site value overrides
- **No `IsOptionalInput` / `IsEmptyFields`** — input optionality is determined solely by whether `.withMessage()` was called and whether TFields has required keys

---

## Resolved Decisions

### 1. `.withContext()` renamed to `.withFields()` — DECIDED

The concept of "context" is gone entirely. `.withFields()` says exactly what it is — additional fields spread flat on the error object. No React "props" baggage, no ambiguous "context" implying nesting.

```typescript
createTaggedError('ResponseError')
  .withFields<{ status: number }>()
```

### 2. Fully flat input at call sites — DECIDED

```typescript
ResponseErr({ message: `HTTP ${status}`, status: 404 })
```

The input shape mirrors the output shape (minus `name`). No wrapper key.

### 3. Reserved keys: only `name` — DECIDED

`name` is the only reserved key. `message` was originally reserved to prevent field collisions, but since `message` is now a built-in input (not a field), it's handled separately. If we add a built-in field later, we add it to the reserved list at that time.

### 4. `.because()` — does not exist, not adding it — DECIDED

The method doesn't exist in the current v0.31.0 API. No code uses it. Not adding it.

### 5. Remove explicit `message` overrides — DECIDED, THEN REVERSED

**Original decision**: `message` is an output of the template, not an input from the call site. The factory input type should not include `message` at all — the builder computes it.

**Reversal**: See Decision 7. `message` is a call-site input. `.withMessage()` provides an optional default, not an exclusive source.

### 6. Reconcile with the granular migration spec — DECIDED

The granular error migration spec (`20260226T000000-granular-error-migration.md`) should be updated to target the flat design from this spec.

### 7. `.withMessage()` is optional — provides a default, not a requirement — DECIDED

This is the biggest revision to the spec and supersedes Decision 5.

**The problem with `.withMessage()` as a required terminal step**: The intermediate design made `.withMessage()` mandatory, with the template as the sole source of message computation. This had three issues:

1. **Templates can't serve broad error types.** `FsServiceError` is used for reading blobs, writing configs, creating directories. No single template can produce a good message for all of those. The template either becomes so generic it's useless (`"File system operation failed"`) or the error type must be split into many granular types just to make the template specific enough.

2. **The `reason` convention is a code smell.** To work around templates that can't be specific enough, the migration spec introduced a `reason: string` field convention — always populated with `extractErrorMessage(error)`. But `reason` is just `message` with a different name. Every Tier 2 error in the migration spec has `reason: string` as its only field, with a template that does nothing more than prepend a static prefix. The template's "value" is a prefix string. That's not worth a required builder step.

3. **Call sites have the most context.** The call site knows what operation was attempted, what file path was involved, what the user was trying to do. The template, defined once at the error type level, doesn't know any of this. Forcing all message information through typed fields means either: (a) lots of granular error types, or (b) a `reason` escape hatch that defeats the purpose.

**But removing `.withMessage()` entirely was too aggressive.** Analyzing 321 error call sites across the Epicenter codebase revealed:

| Category | Count | % |
|---|---|---|
| Static / could use a default message | ~189 | 59% |
| Dynamic / genuinely needs call-site message | ~132 | 41% |

59% of call sites have static or predictable messages that could be baked into the error type. Examples:
- **Recorder**: 13 pure-static messages like `'A recording is already in progress'`, `'No active recording to stop'`, `'Recording file is empty'`
- **Completion**: 36 calls with `message ?? 'static fallback'` patterns, repeated identically across 4+ providers
- **Transform**: 7 calls, almost all static
- **Transcription guards**: API key missing, file too large, rate limit — repeated verbatim across OpenAI, Groq, ElevenLabs, Deepgram

Meanwhile, 41% of call sites genuinely need dynamic messages — caught exception text via `extractErrorMessage(error)`, file paths, HTTP status codes, runtime values.

**The decision**: `.withMessage()` is an **optional** builder step that provides a **default** message. It is not a required terminal step. It is not the exclusive source of message computation. The rules are simple:

1. **Without `.withMessage()`**: `message` is required in the factory input.
2. **With `.withMessage()`**: `message` is optional in the factory input. If provided, it overrides the default. If omitted, the template computes it.

```typescript
// The full API:
createTaggedError('XError')                              → factory({ message })
createTaggedError('XError').withMessage(fn)              → factory() or factory({ message })
createTaggedError('XError').withFields<F>()              → factory({ message, ...fields })
createTaggedError('XError').withFields<F>().withMessage(fn) → factory({ ...fields }) or factory({ message, ...fields })
```

**What this preserves from the intermediate design**:
- Templates that compute messages from fields (e.g., `({ status }) => \`HTTP ${status}\``)
- Static default messages for simple errors

**What this adds**:
- Call-site `message` override — the call site always has the final say
- No `.withMessage()` required — errors without predictable messages skip it entirely

**What this eliminates**:
- The `reason: string` convention (call sites that need custom messages just pass `message` directly)
- The three-tier complexity model (no need to classify errors into tiers — just decide: does this error type have a good default message?)
- The `IsOptionalInput` / `IsEmptyFields` conditional types (input optionality is determined by `.withMessage()` presence + TFields shape)

### 8. `reason` is not a convention — DECIDED

The migration spec proposed `reason: string` as a reserved field convention meaning "the output of `extractErrorMessage(error)`." This is rejected.

`reason` is just `message` laundered through a field. If every Tier 2 error is `{ reason: string }` with a template of `({ reason }) => 'X failed: ${reason}'`, then the template is doing nothing useful — it's prepending a static string that the call site could just include in `message` directly.

With `.withMessage()` as an optional default, the need for `reason` disappears entirely:
- Errors with predictable messages → use `.withMessage()` as a default
- Errors with dynamic messages → call site passes `message` directly
- No need for an intermediate `reason` field in either case

If an error type has a specific named field that happens to be called `reason` for domain-specific purposes, that's fine — it's just a field. But `reason` as a codebase-wide convention for "the stringified caught error" doesn't carry its weight.

---

## History / Decision Log

### Why we examined this

The granular error migration work forced a question: if we're touching every error definition and every call site anyway, should we also fix the shape of `TaggedError` itself? The answer was yes — the nested `context` bag and first-class `cause` field were adding complexity without proportional value.

### The namespace collision debate

**Initial position**: Flat spreading is dangerous because context fields could collide with `name` or `message`.

**Resolution**: This is trivially solved at the type level. TypeScript rejects collisions at compile time. The collision argument was a lazy justification for the status quo, not a real problem.

```typescript
// This would be a compile error:
createTaggedError('X').withFields<{ name: string }>()  // ← rejected
```

### The cause debate

**Initial position**: `cause` is valuable for error chaining and stack trace preservation.

**Counter-evidence**: Every call site in the codebase does `extractErrorMessage(error)`, destroying the original error. No code walks cause chains. JavaScript already has `Error.cause` (ES2022) for native error chaining. `cause` as a first-class field is ceremony nobody consumes.

**Resolution**: Remove `cause` as a built-in concept. If an error type needs it, it's just another typed field in its props.

### The access pattern comparison

The decisive argument for flat over nested. Side by side:

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

Flat wins on ergonomics in both consumption and definition. The nested form adds a layer of indirection that nobody benefits from.

### The message template debate (three iterations)

**Position 1 (pre-spec, v0.31.0)**: Factories accept an optional `message` override so call sites can provide specific context. `.withMessage()` provides a template, but call sites always override it.

**Problem**: Every single call site passed an explicit `{ message: '...' }`, making every template dead code. The template existed but never ran.

**Position 2 (intermediate, first landing)**: Remove `message` from factory input entirely. The template (`.withMessage()`) is the sole source of message computation. Force all dynamic content through typed fields.

**Problem**: This just shifted `message` to `reason: string` — a field convention that appeared in nearly every error definition. Templates for broad error types could only produce generic prefixes. The three-tier model (static / reason-only / structured) was really just "static" and "call site writes the interesting part through fields."

**Position 3 (final)**: `message` is a call-site input. `.withMessage()` is an optional default. This was informed by analyzing all 321 error call sites across the Epicenter codebase:

- **~189 (59%)** had static or predictable messages → benefit from `.withMessage()` defaults
- **~132 (41%)** had genuinely dynamic messages (caught exceptions, runtime values) → need call-site `message`

This data killed two extreme positions:
- "Always derive from template" (Position 2) — 41% of call sites can't use a template
- "Never use templates" (briefly considered between Position 2 and 3) — 59% of call sites benefit from defaults

The final design serves both: `.withMessage()` as optional default for the 59%, call-site `message` for the 41%, and overridability for edge cases.

---

## What This Spec Does NOT Cover

- **Service-by-service migration**: See `20260226T000000-granular-error-migration.md`
- **The `Result` type (`Ok`/`Err`)**: Unchanged by this work
- **`trySync`/`tryAsync`**: Unchanged by this work
- **The `Err` factory suffix convention** (`ResponseErr` wraps in `{ error, data: null }`): Unchanged

---

## Implementation Status

### Phase 1: Flat design (COMPLETE)

1. ~~Resolve open questions~~ — All decided (see Resolved Decisions above)
2. ~~Implement flat `TaggedError` type and `createTaggedError` builder~~
   - ~~Flatten the error shape (no `context` wrapper)~~ — `TaggedError<TName, TFields>` with flat spread
   - ~~`NoReservedKeys` constraint via `{ name?: never; message?: never }` pattern~~
   - ~~Rename `.withContext()` → `.withFields()`~~
   - ~~Remove `.withCause()` from the builder~~
   - ~~Remove `message` from factory input — template is the sole source~~
   - ~~Tests rewritten for new API~~ — 41 tests, all 3 tiers, builder shape, JSON serialization, edge cases
   - ~~Documentation updated~~ — README.md rewritten for flat API

### Phase 2: Message as call-site input with optional default (TODO)

3. Make `message` a call-site input, `.withMessage()` an optional default
   - Update `NoReservedKeys` from `{ name?: never; message?: never }` to `{ name?: never }`
   - Remove `IsEmptyFields`, `IsOptionalInput` conditional types
   - Without `.withMessage()`: factory input is `{ message: string } & TFields`
   - With `.withMessage()`: factory input is `{ message?: string } & TFields`, template provides default
   - Builder returns factories directly (`.withMessage()` is no longer a required terminal step)
   - Call-site `message` always overrides the template when both exist
   - Rewrite tests for the new API shape
   - Update documentation

### Remaining Work (Out of Scope for This Spec)

4. Update the granular error migration spec to target the simplified design
5. Migrate all error definitions and call sites (per-service, as planned in the migration spec)
