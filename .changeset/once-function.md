---
"wellcrafted": minor
---

Add `once` at the new `wellcrafted/function` subpath. `once(fn)` runs the wrapped function at most once: the first call invokes it and caches the result, and every later call returns that cached result while ignoring any arguments passed after the first. It is a dependency-free combinator for idempotent disposal and lazy one-time initialization.
