---
"wellcrafted": minor
---

Add function overloads to `createTaggedError` for opt-in type strictness

The `createTaggedError` function now supports three overload signatures:

1. **Fully flexible (default)**: No generics required, both context and cause are optional
2. **Context fixed**: Specify `TContext` generic to require context, cause remains flexible
3. **Both fixed**: Specify both `TContext` and `TCause` generics to require both

This allows callers to opt-in to stricter type safety when needed while maintaining backward compatibility with the flexible default behavior. When a type is explicitly specified at factory creation time, it becomes required at every call site.

Updated type definitions:
- `FlexibleTaggedErrorFactories`, `ContextFixedTaggedErrorFactories`, `BothFixedTaggedErrorFactories`
- `FlexibleTaggedErrorConstructorFn`, `ContextFixedTaggedErrorConstructorFn`, `BothFixedTaggedErrorConstructorFn`
- And corresponding `Err` constructor function variants
