---
name: patterns
description: Compose wellcrafted service, propagation, serialization, validation, and UI boundaries with explicit ownership.
---

# Application patterns

Use this skill for architecture decisions. Use the public references for exhaustive API signatures.

## Service boundary

Create services as factory functions with explicit dependencies. Wrap only the dependency call that throws, then keep Result propagation linear.

```typescript
function createUserService({
  readRecord,
}: {
  readRecord(userId: string): User | null;
}) {
  function findUser(userId: string): Result<User | null, UserError> {
    return trySync({
      try: () => readRecord(userId),
      catch: (cause) =>
        UserError.ReadFailed({ cause: extractErrorMessage(cause) }),
    });
  }

  return {
    getDisplayName(userId: string): Result<string, UserError> {
      const userResult = findUser(userId);
      if (userResult.error !== null) return userResult;
      if (userResult.data === null) return UserError.NotFound({ userId });
      return Ok(userResult.data.displayName);
    },
  };
}
```

Services do not reach into UI state. Pass clients, storage, configuration, and clocks through factory or method inputs.

## Propagation and recovery

Use `error !== null`, `isErr`, or `isOk`; never generic truthiness. Falsy Err values are permitted, and `Ok(null)` is valid.

When you keep the whole Result, return its narrowed Err branch directly. When you destructure, wrap the raw error again:

```typescript
const result = await readUser(userId);
if (result.error !== null) return result;

const { data, error } = await readPosts(result.data.id);
if (error !== null) return Err(error);

return Ok({ user: result.data, posts: data });
```

Recover with `Ok(fallback)` only at a layer that can honestly satisfy its success contract.

## Serialization boundary

Reuse the domain vocabulary across JSON, HTTP, workers, IPC, logs, or persistence when the complete Result, data, and error values are JSON-compatible. No separate wire type is required in that case.

When an existing payload is not boundary-friendly, normalize the incompatible fields or introduce a boundary-specific wire vocabulary. Choose based on ownership: change the domain variant when every caller needs the normalized field; add a wire variant when in-process callers still need richer values such as a raw cause.

```typescript
const WireError = defineErrors({
  ReadFailed: ({ resourceId, cause }: {
    resourceId: string;
    cause: unknown;
  }) => ({
    message: `Could not read "${resourceId}".`,
    resourceId,
    causeMessage: extractErrorMessage(cause),
  }),
});
```

`defineErrors` does not enforce JSON-compatible fields. Do not claim a raw native Error, arbitrary cause chain, class instance, bigint value, function, or cycle is wire-safe. The conditional promise applies only when every field in the complete value is JSON-compatible.

## Validation boundary

Treat parsed JSON as unknown. Preserving a Result-shaped envelope does not validate its payload.

```typescript
const unknownBody: unknown = await response.json();
const parsed = resultEnvelopeSchema.safeParse(unknownBody);
if (!parsed.success) {
  reportInvalidResponse(parsed.error.issues);
  return;
}

const result = parsed.data;
```

Do not write `await response.json() as Result<User, UserError>`. A static assertion inspects no bytes. Validate the full envelope and active data or error payload.

## UI and query boundary

Transform domain errors when the UI owns a different error contract. Then let the TanStack adapter convert the Result into its data/error channels.

```typescript
const profileOptions = resultQueryOptions({
  queryKey: ["profile", userId],
  queryFn: async () => {
    const result = await userService.getProfile(userId);
    if (result.error !== null) {
      return Err({
        title: "Could not load the profile",
        description: result.error.message,
      });
    }
    return Ok(result.data);
  },
});
```

Keep cache reads, writes, and invalidation on `QueryClient`. Use the query-factories skill for the direct-adapter and bound-factory shapes.

Canonical checked examples live in `examples/`. Public guides own the longer explanations; this skill should stay a compact implementation checklist.
