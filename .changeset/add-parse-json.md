---
"wellcrafted": minor
---

Add `parseJson` and `JsonParseError` to `wellcrafted/json`.

`parseJson(text)` parses a JSON string into a `Result<JsonValue, JsonParseError>` instead of throwing. It is the Result-returning counterpart to `JSON.parse`:

- the success value is typed as `JsonValue` rather than `any`, so you must narrow or validate it before treating it as a known shape
- malformed input is reported as a tagged `JsonParseError` (built with `defineErrors`) carrying the underlying `SyntaxError` as `cause`, instead of throwing

```ts
import { parseJson } from "wellcrafted/json";

const { data, error } = parseJson(raw);
if (error) return Err(error); // JsonParseError
data; // JsonValue
```

No reviver argument is accepted: a reviver can return arbitrary values, which would make the `JsonValue` success type unsound.
