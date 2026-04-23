---
"wellcrafted": minor
---

Add `wellcrafted/logger` — a structured, level-keyed logger for libraries that use `defineErrors`.

- Five levels (`trace` / `debug` / `info` / `warn` / `error`), no `fatal`. Mirrors Rust's `tracing`.
- `log.warn(err)` / `log.error(err)` take a typed error unary (from `defineErrors`), accepting both the raw variant and the `Err<>` wrapper — level is a call-site decision, never a property of the variant.
- `log.info` / `log.debug` / `log.trace` are free-form (message + optional data).
- DI-only: no global registry, no default logger singleton. Every consumer takes a `log?: Logger` option.
- Ships pure-JS sinks (`consoleSink`, `memorySink`, `composeSinks`) and the `tapErr` Result-flow combinator (mirrors Rust's `.inspect_err`). `tapErr` is re-exported from both `wellcrafted/logger` (canonical use) and `wellcrafted/result` (where it structurally belongs).

Runtime-agnostic. Environment-specific sinks (e.g. a Bun JSONL file sink) belong in downstream packages.

The `LoggableError = AnyTaggedError | Err<AnyTaggedError>` union is safe to discriminate via `"name" in err`: `name` is already stamped (and reserved) by `defineErrors` on every tagged error, and `Err<E>` has no top-level `name`. No new field reservation was needed.

```ts
import { createLogger, consoleSink, tapErr } from "wellcrafted/logger";

const log = createLogger("my-source"); // defaults to consoleSink

const result = await tryAsync({
  try: () => writeTable(path),
  catch: (cause) => MyError.WriteFailed({ path, cause }),
}).then(tapErr(log.warn));
```
