---
"wellcrafted": patch
---

`extractErrorMessage` now returns a string for any input and never throws. An `Error` without a string message reads as `String(error)`, such as `"Error: 42"`; anything else falls back to JSON, then `String(error)`, then `"[unprintable error]"`, for cyclic arrays, throwing getters, hostile or revoked Proxies, and objects that cannot be converted to a string.
