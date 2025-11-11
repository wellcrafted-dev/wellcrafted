---
"wellcrafted": patch
---

Improve type inference for tagged error factories

Refactored `createTaggedError` to automatically infer cause and context types from input, eliminating the need for explicit generic parameters. Added `TContext` generic parameter to `TaggedError` type for better type safety. Reorganized internal type structure with separate `TaggedErrorConstructorFn` and `TaggedErrConstructorFn` types for improved modularity.
