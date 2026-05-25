---
"wellcrafted": major
---

Remove `defineHttpErrors` and its type companions.

`defineHttpErrors` coupled error definition to one specific transport (HTTP). The right primitive is `defineErrors`, with HTTP status (or any other per-variant metadata) carried in a sibling map keyed by variant name. This deletion shrinks the public surface and keeps `wellcrafted/error` transport-agnostic, so the same errors can flow through HTTP, queues, RPC, CLIs, or anywhere else without per-transport variants of the primitive.

Removed exports:

- `defineHttpErrors`
- `HttpErrorFactory`
- `HttpErrorsConfig`
- `ValidatedHttpConfig`
- `DefineHttpErrorsReturn`
- `InferHttpError`
- `InferHttpErrors`

## Migration

Replace the tuple-configured factory with `defineErrors` plus a `satisfies`-checked side-map:

```ts
// before
import { defineHttpErrors, type InferHttpErrors } from "wellcrafted/error";

const AiChatError = defineHttpErrors({
  Unauthorized:          [401, () => ({ message: "Unauthorized" })],
  ProviderNotConfigured: [503, ({ provider }: { provider: string }) => ({
    message: `${provider} not configured`, provider,
  })],
});
type AiChatError = InferHttpErrors<typeof AiChatError>;

return c.json(
  AiChatError.ProviderNotConfigured({ provider }),
  AiChatError.ProviderNotConfigured.status,
);
```

```ts
// after
import { defineErrors, type InferErrors } from "wellcrafted/error";

const AiChatError = defineErrors({
  Unauthorized:          () => ({ message: "Unauthorized" }),
  ProviderNotConfigured: ({ provider }: { provider: string }) => ({
    message: `${provider} not configured`, provider,
  }),
});
type AiChatError = InferErrors<typeof AiChatError>;

const AiChatErrorStatus = {
  Unauthorized:          401,
  ProviderNotConfigured: 503,
} as const satisfies Record<AiChatError["name"], number>;

return c.json(
  AiChatError.ProviderNotConfigured({ provider }),
  AiChatErrorStatus.ProviderNotConfigured,
);
```

The `satisfies Record<E["name"], number>` clause enforces exhaustiveness at compile time: adding a variant without a status (or a stale key after a rename) is a type error.

The same shape generalizes to any other per-variant metadata you want to attach without polluting the error body or forking the primitive: icons, log levels, retry classifications, gRPC codes, problem-type URIs, etc. Each lives in its own `as const satisfies Record<E["name"], T>` table next to the consumer that cares.
