---
"wellcrafted": minor
---

feat: simplify error system with unified TaggedError type

- Combined `BaseError` and `TaggedError` into a single unified type
- Made `cause` property optional and strongly typed as `TaggedError` for error chaining
- Created JSON-serializable call stacks through error chaining
- Each error in the chain maintains full TypeScript typing and context
- Updated documentation with comprehensive examples of error chaining patterns

BREAKING CHANGE: `BaseError` type has been removed. Use `TaggedError` or `TaggedError<string>` instead.