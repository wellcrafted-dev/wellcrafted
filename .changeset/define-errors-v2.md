---
"wellcrafted": minor
---

**BREAKING**: `defineErrors` v2 — Rust-style namespaced errors with Err-by-default

- Factories now return `Err<...>` directly (no dual `FooError`/`FooErr` factories)
- Keys are short variant names (`Connection`, `Parse`) instead of `ConnectionError`
- `InferError<T>` takes a single factory (`typeof HttpError.Connection`)
- `InferErrors<T>` replaces `InferErrorUnion<T>` for union extraction
- `ValidatedConfig` provides descriptive error when reserved `name` key is used
