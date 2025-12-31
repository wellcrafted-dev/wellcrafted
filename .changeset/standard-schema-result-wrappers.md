---
"wellcrafted": minor
---

Add Standard Schema v1 compliant Result wrappers for schema validation libraries

New `wellcrafted/standard-schema` module provides:
- `OkSchema(schema)` - wraps any Standard Schema into `{ data: T, error: null }`
- `ErrSchema(schema)` - wraps any Standard Schema into `{ data: null, error: E }`
- `ResultSchema(dataSchema, errorSchema)` - creates discriminated union of Ok | Err

Works with Zod, Valibot, ArkType, and any Standard Schema v1 compliant library. Preserves schema capabilities (validate, jsonSchema) based on input schema features.
