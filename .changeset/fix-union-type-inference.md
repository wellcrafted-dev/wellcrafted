---
"wellcrafted": patch
---

Fix `trySync` and `tryAsync` type inference for catch handlers returning union Err types

When a catch handler returned multiple Err variants (e.g., `Err<A> | Err<B>`), TypeScript could not infer the union, requiring explicit return type annotations. Replaced three overloads per function with a single generic signature that infers the full catch return type.
