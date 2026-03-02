# wellcrafted

[![npm version](https://badge.fury.io/js/wellcrafted.svg)](https://www.npmjs.com/package/wellcrafted)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/wellcrafted)](https://bundlephobia.com/package/wellcrafted)

*Delightful TypeScript utilities for elegant, type-safe applications*

## Transform unpredictable errors into type-safe results

```typescript
// ❌ Before: Which errors can this throw? 🤷
try {
  await saveUser(user);
} catch (error) {
  // ... good luck debugging in production
}

// ✅ After: Every error is visible and typed
const { data, error } = await saveUser(user);
if (error) {
  switch (error.name) {
    case "ValidationError":
      showToast(`Invalid ${error.field}`);
      break;
    case "AuthError":
      redirectToLogin();
      break;
    // TypeScript ensures you handle all cases!
  }
}
```

## A collection of simple, powerful primitives

### 🎯 Result Type
Make errors explicit in function signatures
```typescript
function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return Err("Division by zero");
  return Ok(a / b);
}
```

### 🏷️ Brand Types
Create distinct types from primitives
```typescript
type UserId = string & Brand<"UserId">;
type OrderId = string & Brand<"OrderId">;

// TypeScript prevents mixing them up!
function getUser(id: UserId) { /* ... */ }
```

### 📋 Tagged Errors
Structured, serializable errors with a fluent API
```typescript
import { createTaggedError } from "wellcrafted/error";

// Static error — no fields needed
const { ValidationError } = createTaggedError("ValidationError")
  .withMessage(() => "Email is required");
ValidationError();

// Structured error — fields are spread flat on the error object
const { ApiError } = createTaggedError("ApiError")
  .withFields<{ endpoint: string }>()
  .withMessage(({ endpoint }) => `Request to ${endpoint} failed`);
```

### 🔄 Query Integration
Seamless TanStack Query integration with dual interfaces
```typescript
import { createQueryFactories } from "wellcrafted/query";
import { QueryClient } from "@tanstack/query-core";

const queryClient = new QueryClient();
const { defineQuery, defineMutation } = createQueryFactories(queryClient);

// Define operations that return Result types
const userQuery = defineQuery({
  queryKey: ['users', userId],
  queryFn: () => getUserFromAPI(userId) // Returns Result<User, ApiError>
});

// Use reactively in components with automatic state management
// Svelte 5 requires accessor function; React uses options directly
const query = createQuery(() => userQuery.options); // Svelte
// query.data, query.error, query.isPending all managed automatically

// Or use imperatively for direct execution (perfect for event handlers)
const { data, error } = await userQuery.fetch();
// Or shorthand: await userQuery() (same as .ensure())
if (error) {
  showErrorToast(error.message);
  return;
}
// Use data...
```

## Installation

```bash
npm install wellcrafted
```

## Quick Start

```typescript
import { tryAsync } from "wellcrafted/result";
import { createTaggedError } from "wellcrafted/error";

// Define your error with factory function
const { ApiError, ApiErr } = createTaggedError("ApiError")
  .withFields<{ endpoint: string }>()
  .withMessage(({ endpoint }) => `Failed to fetch ${endpoint}`);
type ApiError = ReturnType<typeof ApiError>;

// Wrap any throwing operation
const { data, error } = await tryAsync({
  try: () => fetch('/api/user').then(r => r.json()),
  catch: (e) => ApiErr({ endpoint: '/api/user' })
});

if (error) {
  console.error(`${error.name}: ${error.message}`);
} else {
  console.log("User:", data);
}
```

## Core Features

<table>
<tr>
<td>

**🎯 Explicit Error Handling**  
All errors visible in function signatures

</td>
<td>

**📦 Serialization-Safe**  
Plain objects work everywhere

</td>
<td>

**✨ Elegant API**  
Clean, intuitive patterns

</td>
</tr>
<tr>
<td>

**🔍 Zero Magic**  
~50 lines of core code

</td>
<td>

**🚀 Lightweight**  
Zero dependencies, < 2KB

</td>
<td>

**🎨 Composable**  
Mix and match utilities

</td>
</tr>
</table>

## The Result Pattern Explained

The Result type makes error handling explicit and type-safe:

```typescript
type Ok<T> = { data: T; error: null };
type Err<E> = { error: E; data: null };
type Result<T, E> = Ok<T> | Err<E>;
```

This creates a discriminated union where TypeScript automatically narrows types:

```typescript
if (result.error) {
  // TypeScript knows: error is E, data is null
} else {
  // TypeScript knows: data is T, error is null
}
```

## Basic Patterns

### Handle Results with Destructuring

```typescript
const { data, error } = await someOperation();

if (error) {
  // Handle error with full type safety
  return;
}

// Use data - TypeScript knows it's safe
```

### Wrap Unsafe Operations

```typescript
// Define errors with fields and message template
const { ParseError, ParseErr } = createTaggedError("ParseError")
  .withFields<{ input: string }>()
  .withMessage(({ input }) => `Invalid JSON: ${input.slice(0, 50)}`);

const { NetworkError, NetworkErr } = createTaggedError("NetworkError")
  .withFields<{ url: string }>()
  .withMessage(({ url }) => `Request to ${url} failed`);

// Synchronous
const result = trySync({
  try: () => JSON.parse(jsonString),
  catch: () => ParseErr({ input: jsonString })
});

// Asynchronous
const result = await tryAsync({
  try: () => fetch(url),
  catch: () => NetworkErr({ url })
});
```

### Real-World Service + Query Layer Example

```typescript
// 1. Service Layer - Pure business logic
import { createTaggedError } from "wellcrafted/error";
import { tryAsync, Result, Ok } from "wellcrafted/result";

const { RecorderServiceError, RecorderServiceErr } = createTaggedError("RecorderServiceError")
  .withFields<{ currentState?: string; permissions?: string }>()
  .withMessage(({ permissions, currentState }) => {
    if (permissions) return `Missing ${permissions} permission`;
    return `Invalid recorder state: ${currentState}`;
  });
type RecorderServiceError = ReturnType<typeof RecorderServiceError>;

export function createRecorderService() {
  let isRecording = false;
  let currentBlob: Blob | null = null;

  return {
    async startRecording(): Promise<Result<void, RecorderServiceError>> {
      if (isRecording) {
        return RecorderServiceErr({ currentState: 'recording' });
      }

      return tryAsync({
        try: async () => {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const recorder = new MediaRecorder(stream);
          // ... recording setup
          isRecording = true;
        },
        catch: () => RecorderServiceErr({ permissions: 'microphone' })
      });
    },

    async stopRecording(): Promise<Result<Blob, RecorderServiceError>> {
      if (!isRecording) {
        return RecorderServiceErr({ currentState: 'idle' });
      }

      // Stop recording and return blob...
      isRecording = false;
      return Ok(currentBlob!);
    }
  };
}

// 2. Query Layer - Adds caching, reactivity, and UI error handling
import { createQueryFactories } from "wellcrafted/query";

const { defineQuery, defineMutation } = createQueryFactories(queryClient);

export const recorder = {
  getRecorderState: defineQuery({
    queryKey: ['recorder', 'state'],
    queryFn: async () => {
      const { data, error } = await services.recorder.getState();
      if (error) {
        // Transform service error to UI-friendly error
        return Err({
          title: "❌ Failed to get recorder state",
          description: error.message,
          action: { type: 'retry' }
        });
      }
      return Ok(data);
    },
    refetchInterval: 1000, // Poll for state changes
  }),

  startRecording: defineMutation({
    mutationKey: ['recorder', 'start'],
    mutationFn: async () => {
      const { error } = await services.recorder.startRecording();
      if (error) {
        return Err({
          title: "❌ Failed to start recording",  
          description: error.message,
          action: { type: 'more-details', error }
        });
      }

      // Optimistically update cache
      queryClient.setQueryData(['recorder', 'state'], 'recording');
      return Ok(undefined);
    }
  })
};

// 3. Component Usage - Choose reactive or imperative based on needs
// Reactive: Automatic state management (Svelte 5 requires accessor function)
const recorderState = createQuery(() => recorder.getRecorderState.options);

// Imperative: Direct execution for event handlers
async function handleStartRecording() {
  const { error } = await recorder.startRecording.execute();
  // Or shorthand: await recorder.startRecording()
  if (error) {
    showToast(error.title, { description: error.description });
  }
}
```

## Smart Return Type Narrowing

The `catch` parameter in `trySync` and `tryAsync` enables smart return type narrowing based on your error handling strategy:

### Recovery Pattern (Always Succeeds)
```typescript
// ❌ Before: Mutable variable required
let parsed: unknown;
try {
  parsed = JSON.parse(riskyJson);
} catch {
  parsed = [];
}
// Now use parsed...

// ✅ After: Clean, immutable pattern
const { data: parsed } = trySync({
  try: () => JSON.parse(riskyJson),
  catch: () => Ok([])
});
// parsed is always defined and type-safe!

// When catch always returns Ok<T>, the function returns Ok<T>
// This means no error checking needed - you can safely destructure and use data directly
```

### Propagation Pattern (May Fail)
```typescript
const { ParseError, ParseErr } = createTaggedError("ParseError")
  .withMessage(() => "Invalid JSON");

// When catch can return Err<E>, function returns Result<T, E>
const mayFail = trySync({
  try: () => JSON.parse(riskyJson),
  catch: () => ParseErr()
});
// mayFail: Result<object, ParseError> - Must check for errors
if (isOk(mayFail)) {
  console.log(mayFail.data); // Only safe after checking
}
```

### Mixed Strategy (Conditional Recovery)
```typescript
const smartParse = trySync({
  try: () => JSON.parse(input),
  catch: () => {
    // Recover from empty input
    if (input.trim() === "") {
      return Ok({}); // Return Ok<T> for fallback
    }
    // Propagate other errors
    return ParseErr();
  }
});
// smartParse: Result<object, ParseError> - Mixed handling = Result type
```

This eliminates unnecessary error checking when you always recover, while still requiring proper error handling when failures are possible.

## Why wellcrafted?

JavaScript's `try-catch` has fundamental problems:

1. **Invisible Errors**: Function signatures don't show what errors can occur
2. **Lost in Transit**: `JSON.stringify(new Error())` loses critical information  
3. **No Type Safety**: TypeScript can't help with `catch (error)` blocks
4. **Inconsistent**: Libraries throw different things (strings, errors, objects, undefined)

wellcrafted solves these with simple, composable primitives that make errors:
- **Explicit** in function signatures
- **Serializable** across all boundaries
- **Type-safe** with full TypeScript support
- **Consistent** with structured error objects

## Service Pattern Best Practices

Based on real-world usage, here's the recommended pattern for creating services with wellcrafted:

### Factory Function Pattern

```typescript
import { createTaggedError } from "wellcrafted/error";
import { Result, Ok } from "wellcrafted/result";

// 1. Define service-specific errors with typed fields and message
const { RecorderServiceError, RecorderServiceErr } = createTaggedError("RecorderServiceError")
  .withFields<{ isRecording: boolean }>()
  .withMessage(({ isRecording }) =>
    isRecording ? "Already recording" : "Not currently recording"
  );
type RecorderServiceError = ReturnType<typeof RecorderServiceError>;

// 2. Create service with factory function
export function createRecorderService() {
  // Private state in closure
  let isRecording = false;

  // Return object with methods
  return {
    startRecording(): Result<void, RecorderServiceError> {
      if (isRecording) {
        return RecorderServiceErr({ isRecording });
      }

      isRecording = true;
      return Ok(undefined);
    },

    stopRecording(): Result<Blob, RecorderServiceError> {
      if (!isRecording) {
        return RecorderServiceErr({ isRecording });
      }

      isRecording = false;
      return Ok(new Blob(["audio data"]));
    }
  };
}

// 3. Export type
export type RecorderService = ReturnType<typeof createRecorderService>;

// 4. Create singleton instance
export const RecorderServiceLive = createRecorderService();
```

### Platform-Specific Services

For services that need different implementations per platform:

```typescript
// types.ts - shared interface
export type FileService = {
  readFile(path: string): Promise<Result<string, FileServiceError>>;
  writeFile(path: string, content: string): Promise<Result<void, FileServiceError>>;
};

// desktop.ts
export function createFileServiceDesktop(): FileService {
  return {
    async readFile(path) {
      // Desktop implementation using Node.js APIs
    },
    async writeFile(path, content) {
      // Desktop implementation
    }
  };
}

// web.ts  
export function createFileServiceWeb(): FileService {
  return {
    async readFile(path) {
      // Web implementation using File API
    },
    async writeFile(path, content) {
      // Web implementation
    }
  };
}

// index.ts - runtime selection
export const FileServiceLive = typeof window !== 'undefined' 
  ? createFileServiceWeb()
  : createFileServiceDesktop();
```

## Common Use Cases

<details>
<summary><b>API Route Handler</b></summary>

```typescript
export async function GET(request: Request) {
  const result = await userService.getUser(params.id);
  
  if (result.error) {
    switch (result.error.name) {
      case "UserNotFoundError":
        return new Response("Not found", { status: 404 });
      case "DatabaseError":
        return new Response("Server error", { status: 500 });
    }
  }
  
  return Response.json(result.data);
}
```
</details>

<details>
<summary><b>Form Validation</b></summary>

```typescript
const { FormError, FormErr } = createTaggedError("FormError")
  .withFields<{ fields: Record<string, string[]> }>()
  .withMessage(({ fields }) => {
    const fieldNames = Object.keys(fields).join(", ");
    return `Validation failed for: ${fieldNames}`;
  });

function validateLoginForm(data: unknown): Result<LoginData, FormError> {
  const errors: Record<string, string[]> = {};

  if (!isValidEmail(data?.email)) {
    errors.email = ["Invalid email format"];
  }

  if (Object.keys(errors).length > 0) {
    return FormErr({ fields: errors });
  }

  return Ok(data as LoginData);
}
```
</details>

<details>
<summary><b>React Hook</b></summary>

```typescript
function useUser(id: number) {
  const [state, setState] = useState<{
    loading: boolean;
    user?: User;
    error?: ApiError;
  }>({ loading: true });

  useEffect(() => {
    fetchUser(id).then(result => {
      if (result.error) {
        setState({ loading: false, error: result.error });
      } else {
        setState({ loading: false, user: result.data });
      }
    });
  }, [id]);

  return state;
}
```
</details>

## Comparison with Alternatives

| | wellcrafted | fp-ts | Effect | neverthrow |
|---|---|---|---|---|
| **Bundle Size** | < 2KB | ~30KB | ~50KB | ~5KB |
| **Learning Curve** | Minimal | Steep | Steep | Moderate |
| **Syntax** | Native async/await | Pipe operators | Generators | Method chains |
| **Type Safety** | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **Serializable Errors** | ✅ Built-in | ❌ Classes | ❌ Classes | ❌ Classes |
| **Runtime Overhead** | Zero | Minimal | Moderate | Minimal |

## Advanced Usage

For comprehensive examples, service layer patterns, framework integrations, and migration guides, see the **[full documentation →](https://docs.wellcrafted.dev)**

## API Reference

### Result Functions
- **`Ok(data)`** - Create success result
- **`Err(error)`** - Create failure result  
- **`isOk(result)`** - Type guard for success
- **`isErr(result)`** - Type guard for failure
- **`trySync(options)`** - Wrap throwing function
- **`tryAsync(options)`** - Wrap async function
- **`unwrap(result)`** - Extract data or throw error
- **`resolve(value)`** - Handle values that may or may not be Results
- **`partitionResults(results)`** - Split array into oks/errs

### Query Functions
- **`createQueryFactories(client)`** - Create query/mutation factories for TanStack Query
- **`defineQuery(options)`** - Define a query with dual interface (`.options` + callable/`.ensure()`/`.fetch()`)
- **`defineMutation(options)`** - Define a mutation with dual interface (`.options` + callable/`.execute()`)

### Error Functions
- **`createTaggedError(name)`** - Creates error factory functions with fluent API
  - Returns `{ErrorName}` (plain error) and `{ErrorName}Err` (Err-wrapped)
  - Chain `.withFields<T>()` to add typed fields (spread flat on the error object)
  - Chain `.withMessage(fn)` *(optional)* to seal the message with a template — `message` is not in the factory input type when present
  - Without `.withMessage()`, `message` is required at the call site
  - `name` is a reserved key — prevented at compile time by `NoReservedKeys`
  - Factory input is flat (e.g., `{ endpoint: '/api' }`), not nested
- **`extractErrorMessage(error)`** - Extract readable message from unknown error

### Types
- **`Result<T, E>`** - Union of Ok<T> | Err<E>
- **`Ok<T>`** - Success result type
- **`Err<E>`** - Error result type
- **`TaggedError<T>`** - Structured error type
- **`Brand<T, B>`** - Branded type wrapper
- **`ExtractOkFromResult<R>`** - Extract Ok variant from Result union
- **`ExtractErrFromResult<R>`** - Extract Err variant from Result union
- **`UnwrapOk<R>`** - Extract success value type from Result
- **`UnwrapErr<R>`** - Extract error value type from Result

## Development Setup

### Peer Directory Requirement

Wellcrafted shares AI agent skills (`.agents/skills/`, `.claude/skills/`) with the [Epicenter](https://github.com/EpicenterHQ/epicenter) repo via relative symlinks. Epicenter is the source of truth for skill definitions — they're authored and maintained there, and wellcrafted consumes them to stay in sync.

**Both repos must be sibling directories under the same parent:**

```
Code/
├── epicenter/       # Source of truth for skills
│   └── .agents/skills/
└── wellcrafted/     # Symlinks to epicenter
    ├── .agents/skills/<name> → ../../../epicenter/.agents/skills/<name>
    └── .claude/skills/<name> → ../../.agents/skills/<name>
```

If symlinks appear broken after cloning, ensure epicenter is cloned alongside wellcrafted:

```bash
cd "$(git rev-parse --show-toplevel)/.."
git clone https://github.com/EpicenterHQ/epicenter.git
```

## License

MIT

---

Made with ❤️ by developers who believe error handling should be delightful.