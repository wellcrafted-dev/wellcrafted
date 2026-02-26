---
"wellcrafted": minor
---

Remove `message` override from `ErrorCallInput` — the template function now always owns the message. Factory input is optional for errors with no context or cause, enabling `FooErr()` instead of `FooErr({})`.
