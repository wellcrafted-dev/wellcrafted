# Callable Query/Mutation Documentation Update

## Context

wellcrafted's `defineQuery` and `defineMutation` use `Object.defineProperty` to make the returned objects directly callable. This means:

```typescript
// Queries - these are equivalent:
const { data, error } = await userQuery();        // Callable (preferred)
const { data, error } = await userQuery.ensure(); // Explicit method
const { data, error } = await userQuery.fetch();  // Fetch variant

// Mutations - these are equivalent:
const { data, error } = await createUser(userData);         // Callable (preferred)
const { data, error } = await createUser.execute(userData); // Explicit method
```

The callable pattern is simpler and should be shown as the primary/preferred option in documentation.

## Task

Search through all documentation files (`.md`, `.mdx`) and ensure that:

1. **The callable pattern is shown first** when demonstrating imperative usage
2. **Explicit methods are shown as alternatives**, not the primary way
3. **Comments clarify the equivalence** where helpful

## Files to Check

Search patterns:
- `\.ensure\(\)` - Query ensure method
- `\.fetch\(\)` - Query fetch method
- `\.execute\(` - Mutation execute method
- Files: `*.md`, `*.mdx` in `docs/`, `src/`, and root directory

## Example Transformations

### Before (explicit methods as primary):
```typescript
// Use in preloaders
const { data, error } = await userQuery.fetch();

// Execute mutation
const { data, error } = await createUser.execute(userData);
```

### After (callable as primary):
```typescript
// Use in preloaders (callable - same as .ensure())
const { data, error } = await userQuery();

// Or with explicit methods:
const { data, error } = await userQuery.ensure();
const { data, error } = await userQuery.fetch();

// Execute mutation (callable - same as .execute())
const { data, error } = await createUser(userData);

// Or with explicit method:
const { data, error } = await createUser.execute(userData);
```

## Key Documentation Files

Based on recent changes, these files likely need review:

- [ ] `README.md` - Root readme
- [ ] `src/query/README.md` - Query module documentation
- [ ] `docs/integrations/tanstack-query.mdx` - TanStack Query integration
- [ ] `docs/integrations/svelte-tanstack.mdx` - Svelte-specific docs
- [ ] `docs/integrations/react-tanstack.mdx` - React-specific docs
- [ ] `docs/case-studies/whispering-architecture.mdx` - Case study
- [ ] `docs/patterns/error-transformation.mdx` - Error patterns
- [ ] `docs/core/typescript-patterns.mdx` - TypeScript patterns
- [ ] `src/query/utils.ts` - JSDoc comments in source

## Implementation Notes

1. Don't remove `.execute()`, `.ensure()`, `.fetch()` references entirely; they're still valid and useful for explicitness
2. Show callable pattern first with a comment like `// Callable (same as .ensure())`
3. Show explicit methods as alternatives: `// Or use explicit method:`
4. The callable pattern works because of this in the type definitions:
   - `DefineQueryOutput` extends `(() => Promise<Result<...>>)`
   - `DefineMutationOutput` extends `((variables) => Promise<Result<...>>)`

## Verification

After updates, grep for remaining patterns and verify they're in appropriate contexts (either showing alternatives or in "wrong" example sections).
