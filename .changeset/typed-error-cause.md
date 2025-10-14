---
"wellcrafted": minor
---

feat: add typed cause generic to TaggedError for type-safe error chaining

- Add second generic parameter `TCause` to `TaggedError` type
- Enable compile-time validation of error cause relationships
- Use `TaggedError<string, any>` constraint to avoid circular references
- Add comprehensive JSDoc with JSON serialization examples
- Update all documentation to show typed cause
- Maintain full backward compatibility with existing single-generic usage

Example:
```typescript
type NetworkError = TaggedError<"NetworkError">;
type DatabaseError = TaggedError<"DatabaseError", NetworkError>;

const dbError: DatabaseError = {
  name: "DatabaseError",
  message: "Connection failed",
  cause: networkError // TypeScript enforces NetworkError type
};
```
