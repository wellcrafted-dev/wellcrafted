---
name: define-errors
description: Define named wellcrafted error variants with honest fields, constructor-owned formatting, and explicit boundary behavior.
---

# Define errors

```typescript
import {
  defineErrors,
  extractErrorMessage,
  type InferError,
  type InferErrors,
} from "wellcrafted/error";
```

## Define one vocabulary per domain

```typescript
const UploadError = defineErrors({
  Rejected: ({ fileName, reasons }: {
    fileName: string;
    reasons: string[];
  }) => ({
    message: `Upload rejected for "${fileName}".`,
    fileName,
    reasons,
  }),
  StorageUnavailable: ({ region }: { region: string }) => ({
    message: `Upload storage is unavailable in ${region}.`,
    region,
  }),
});

type UploadError = InferErrors<typeof UploadError>;
type RejectedError = InferError<typeof UploadError.Rejected>;
```

Each variant call returns an Err wrapper directly. The tagged body is under `.error`.

```typescript
const result = UploadError.Rejected({
  fileName: "report.csv",
  reasons: ["too large"],
});

result.data; // null
result.error.name; // "Rejected"
result.error.fileName; // "report.csv"
```

The key supplies `name`; the constructor must return `message: string`. Other fields are inferred but unconstrained.

## Name and shape variants honestly

Use a distinct variant when callers need to distinguish a failure. Names such as `NotFound`, `InvalidInput`, `ReadFailed`, and `StorageUnavailable` state what happened. A `Failed` suffix is fine when paired with a specific operation; avoid context-free names such as `Error`, `Service`, or bare `Failed`.

Make fields required when every occurrence needs them. Use optional fields only when absence is meaningful for the same failure mode. If cases require different fields or message branches, split them into variants.

The constructor owns message formatting. Callers pass structured inputs; they do not assemble messages or parse fields back out of human text.

## Own the cause boundary

For an in-process diagnostic error, preserve a raw cause and format it inside the constructor:

```typescript
const FileError = defineErrors({
  ReadFailed: ({ path, cause }: { path: string; cause: unknown }) => ({
    message: `Could not read "${path}": ${extractErrorMessage(cause)}`,
    path,
    cause,
  }),
});
```

For a JSON boundary, normalize the cause into compatible fields instead:

```typescript
const WireError = defineErrors({
  ReadFailed: ({ path, cause }: { path: string; cause: unknown }) => ({
    message: `Could not read "${path}".`,
    path,
    causeMessage: extractErrorMessage(cause),
  }),
});
```

`defineErrors` does not type-enforce JSON compatibility. Native Errors, functions, bigint values, class instances, and cyclic values can be accepted and may change or fail during serialization. The plain-data promise applies only when every field in the complete value is JSON-compatible.

Error bodies are shallow-frozen. Nested objects and arrays remain mutable.

The canonical vocabulary examples are in `examples/quick-start.ts`, `examples/service-boundary.ts`, and `examples/serialization-boundary.ts`. Use the public error reference for low-level exported types and extractor edge cases.
