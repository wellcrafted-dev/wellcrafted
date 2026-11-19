---
"wellcrafted": patch
---

`extractErrorMessage` now returns a string for any input and never throws, falling back to JSON, then `String(error)`, then `"[unprintable error]"` for cyclic arrays, throwing getters, hostile or revoked Proxies, and objects that cannot be converted to a string.
