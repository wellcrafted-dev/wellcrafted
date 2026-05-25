---
"wellcrafted": minor
---

Add `defineHttpErrors`: typed HTTP error factories with a static `.status` property.

Like `defineErrors`, but each variant is paired with its HTTP status code via a `[status, factory]` tuple. The status is attached to the factory function as a literal type (e.g. `AssetError.MissingFile.status` is `400`), never serialized into the error body.

```ts
const AssetError = defineHttpErrors({
  MissingFile:          [400, () => ({ message: 'Missing file' })],
  FileTooLarge:         [413, ({ size }: { size: number }) => ({ message: `File too large: ${size}`, size })],
  StorageLimitExceeded: [402, () => ({ message: 'Storage limit exceeded' })],
});

// Hono route handler:
return c.json(AssetError.MissingFile(), AssetError.MissingFile.status);
// body:   { error: { name: 'MissingFile', message: 'Missing file' }, data: null }
// status: 400
```

Also exports `InferHttpError`, `InferHttpErrors`, `HttpErrorFactory`, `DefineHttpErrorsReturn`, `HttpErrorsConfig`, and `ValidatedHttpConfig`.
