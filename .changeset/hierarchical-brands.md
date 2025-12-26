---
"wellcrafted": patch
---

Fix Brand type to support hierarchical/stacked brands

Previously, stacking brands resulted in `never` because intersecting `{ [brand]: 'A' }` with `{ [brand]: 'B' }` collapsed the property to `never`.

Now brands use a nested object structure `{ [brand]: { [K in T]: true } }` (following Effect-TS pattern), allowing brand stacking to work correctly:

```typescript
type AbsolutePath = string & Brand<"AbsolutePath">;
type ProjectDir = AbsolutePath & Brand<"ProjectDir">;

const projectDir = "/home/project" as ProjectDir;
const abs: AbsolutePath = projectDir; // Works - child assignable to parent
```
