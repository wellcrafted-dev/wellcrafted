# Prompt 2: Simplify and Document Type Overloads in utils.ts

## Context

The `src/error/utils.ts` file contains complex TypeScript type machinery for the `taggedError` function. There are multiple layers of types that work together to provide three "modes" of usage.

## Current Architecture

### The Three Modes

1. **Flexible Mode** (no type constraints):
   ```typescript
   const { NetworkError } = taggedError('NetworkError');
   NetworkError({ message: 'Error' });                    // OK
   NetworkError({ message: 'Error', context: { any: 1 } }); // OK
   ```

2. **Context-Fixed Mode** (context required with specific shape):
   ```typescript
   const { BlobError } = taggedError<'BlobError', { filename: string }>('BlobError');
   BlobError({ message: 'Error', context: { filename: 'x' } }); // OK
   BlobError({ message: 'Error' });                              // Type error!
   ```

3. **Both-Fixed Mode** (context required, cause constrained):
   ```typescript
   const { ApiError } = taggedError<'ApiError', { endpoint: string }, NetworkError>('ApiError');
   ```

### Current Type Structure

```
taggedError function
├── Overload 1: FlexibleFactories<TName>
│   ├── FlexibleErrorConstructor<TName>
│   │   └── 4 call signatures (message only, +context, +cause, +both)
│   └── FlexibleErrConstructor<TName>
│       └── 4 call signatures
├── Overload 2: ContextFixedFactories<TName, TContext>
│   ├── ContextFixedErrorConstructor<TName, TContext>
│   │   └── 2 call signatures (without cause, with cause)
│   └── ContextFixedErrConstructor<TName, TContext>
│       └── 2 call signatures
└── Overload 3: BothFixedFactories<TName, TContext, TCause>
    ├── BothFixedErrorConstructor<TName, TContext, TCause>
    │   └── 2 call signatures
    └── BothFixedErrConstructor<TName, TContext, TCause>
        └── 2 call signatures
```

## Your Tasks

### Task 1: Understand and Explain

First, thoroughly read and understand how all the types work together:

1. Read `src/error/utils.ts` completely
2. Read `src/error/types.ts` to understand `TaggedError` and `WithContext`/`WithCause`
3. Trace through how each mode works:
   - How does TypeScript pick the right overload?
   - How do the constructor function types work with call signatures?
   - Why are there 4 overloads in `FlexibleErrorConstructor` but only 2 in `ContextFixedErrorConstructor`?

### Task 2: Evaluate Naming

The current type names are:
- `FlexibleFactories`, `ContextFixedFactories`, `BothFixedFactories`
- `FlexibleErrorConstructor`, `ContextFixedErrorConstructor`, `BothFixedErrorConstructor`
- `FlexibleErrConstructor`, `ContextFixedErrConstructor`, `BothFixedErrConstructor`
- `AnyTaggedError`
- `ReplaceErrorWithErr`

Consider:
- Are these names clear?
- Could they be more descriptive or simpler?
- Is the "Flexible/ContextFixed/BothFixed" naming scheme intuitive?

### Task 3: Look for Simplification Opportunities

Ask yourself:
1. Can any of these types be combined or deduplicated?
2. Is the number of overloads necessary?
3. Could we achieve the same behavior with fewer types?
4. Are the call signature overloads (4 for flexible, 2 for fixed) the best approach?
5. Could conditional types replace some overloads?

### Task 4: Verify Correctness

Make sure the current implementation is correct:
1. Does flexible mode actually allow any context shape?
2. Does context-fixed mode actually require the exact shape?
3. Does both-fixed mode properly constrain the cause type?
4. Are the return types accurate?

Run the tests to verify: `pnpm test`

## Expected Output

1. **Explanation**: A clear explanation of how the type system works, suitable for adding to documentation
2. **Naming suggestions**: Better names for types if you find any
3. **Simplification proposal**: Any ways to reduce complexity while maintaining the same behavior
4. **Correctness assessment**: Any bugs or edge cases found

## Files to Read

- `src/error/utils.ts` - main implementation (focus here)
- `src/error/types.ts` - TaggedError type definition
- `src/error/taggedError.test.ts` - tests showing expected behavior
- `src/error/README.md` - documentation

## Notes

The goal is to make this code easier to understand and maintain. The type system is complex because it needs to provide precise types for different usage patterns. But if we can achieve the same precision with simpler types, that's better.

Don't sacrifice type safety for simplicity. The whole point is that users get proper autocomplete and type checking. But if there's unnecessary complexity, remove it.
