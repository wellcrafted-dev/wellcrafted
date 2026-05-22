---
"wellcrafted": minor
---

Add the `wellcrafted/testing` entry point with `expectOk` and `expectErr`.

These are test-only assertion helpers for `Result` values. Each unwraps the expected branch and returns it narrowed, throwing if the `Result` is the other variant:

```ts
import { expectOk, expectErr } from "wellcrafted/testing";

const value = expectOk(parseConfig(raw));   // success value, narrowed
const error = expectErr(parseConfig("x"));  // error value, narrowed
expect(error.name).toBe("ConfigParseError");
```

They intentionally throw: a failed expectation should abort the test, which every runner reports as a failure. Throwing is fenced into this separate `wellcrafted/testing` entry point so `wellcrafted/result` stays throw-free. The helpers throw a plain `Error`, so they work under bun, vitest, jest, or `node:test` without depending on a test framework.
