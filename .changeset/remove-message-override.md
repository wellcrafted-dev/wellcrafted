---
"wellcrafted": minor
---

Redesign `createTaggedError` builder: flat `.withFields()` API replaces nested `.withContext()`/`.withCause()`, `.withMessage()` is optional and seals the message (not in factory input type), `message` required at call site when `.withMessage()` is absent. Removes `context` nesting, `cause` as first-class field, and `reason` convention.
