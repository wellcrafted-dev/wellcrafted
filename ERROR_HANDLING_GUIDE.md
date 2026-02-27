# Comprehensive Error Handling Guide

A deep dive into effective error handling patterns using the lightweight tagged error system.

## Philosophy: Errors as Data

This library treats errors as first-class data rather than exceptional control flow. This approach, inspired by functional programming languages like Rust and Go, offers several advantages:

1. **Explicit Error Handling**: All potential failures are visible in function signatures
2. **Composable Error Handling**: Errors can be transformed, chained, and recovered from systematically
3. **Serializable by Design**: Errors are plain objects that can cross any boundary
4. **Type-Safe Error Handling**: Full TypeScript support for tagged union error types and recovery patterns

## Terminology

### Key Concepts

- **Error Type**: The actual error value (e.g., `ValidationError`, `NetworkError`) that follows the convention of ending with "Error" suffix
- **Err Data Structure**: The wrapper `{ error: E; data: null }` that contains an error type in the Result system
- **Result**: The union type `Ok<T> | Err<E>` that represents either success or failure

## Tagged Union Error System

### Why "Tagged" Errors?

The error system uses **tagged unions** (also called discriminated unions), where the `name` property acts as a **tag** that allows TypeScript to:

1. **Discriminate between error types** at compile time
2. **Enable exhaustive pattern matching** in switch statements
3. **Provide intelligent autocomplete** and type narrowing
4. **Catch missing error handling cases** at compile time

```typescript
// The "name" property is the tag that discriminates between error types
// Note: Error types follow the convention of ending with "Error" suffix
// Additional fields are spread flat on the error object
type AppError =
  | { name: "ValidationError"; message: string; field: string; value: unknown }
  | { name: "NetworkError"; message: string; url: string; status: number }
  | { name: "DatabaseError"; message: string; query: string; table: string };

// TypeScript can exhaustively check all cases
function handleAppError(error: AppError) {
  switch (error.name) { // TypeScript knows this is the discriminant tag
    case "ValidationError":
      // TypeScript narrows to ValidationError type here
      console.log(`Validation failed for field: ${error.field}`);
      break;
    case "NetworkError":
      // TypeScript narrows to NetworkError type here
      console.log(`Network error: ${error.status}`);
      break;
    case "DatabaseError":
      // TypeScript narrows to DatabaseError type here
      console.log(`Database error in table: ${error.table}`);
      break;
    // TypeScript will warn if we miss any cases!
  }
}
```

## Creating Errors with createTaggedError

The recommended way to create typed errors is with the `createTaggedError` builder. It eliminates boilerplate while giving you full type safety over fields and message computation.

### The Three Tiers

**Tier 1 — Static (no fields):**
```typescript
const { RecorderBusyError, RecorderBusyErr } = createTaggedError('RecorderBusyError')
  .withMessage(() => 'A recording is already in progress');

RecorderBusyErr() // no args
```

**Tier 2 — Reason-only (single descriptive field):**
```typescript
const { PlaySoundError, PlaySoundErr } = createTaggedError('PlaySoundError')
  .withFields<{ reason: string }>()
  .withMessage(({ reason }) => `Failed to play sound: ${reason}`);

PlaySoundErr({ reason: extractErrorMessage(error) })
```

**Tier 3 — Structured (multiple fields):**
```typescript
const { ResponseError, ResponseErr } = createTaggedError('ResponseError')
  .withFields<{ status: number; reason?: string }>()
  .withMessage(({ status, reason }) => `HTTP ${status}${reason ? `: ${reason}` : ''}`);

ResponseErr({ status: 404 })
```

### Key Principles

- `name` + `message` are the only built-in fields
- Additional fields spread **flat** on the error object (no nested `context` bag)
- Two mutually exclusive modes for `message`:
  - **Without `.withMessage()`**: `message` is required at the call site
  - **With `.withMessage()`**: the template **seals** the message — `message` is NOT in the input type
- `cause` is not special — if needed, it's just another field
- Only `name` is a reserved key — prevented by `NoReservedKeys` at compile time
- Builder chain: `createTaggedError('XError').withFields<F>()` (factories available immediately)
- `.withMessage(fn)` is **optional** — it seals the message when present

### Full Example

```typescript
import { createTaggedError } from 'wellcrafted/error';

const { ClipboardServiceError, ClipboardServiceErr } = createTaggedError('ClipboardServiceError')
  .withFields<{ text: string; cause?: unknown }>()
  .withMessage(() => 'Clipboard operation failed');

type ClipboardServiceError = ReturnType<typeof ClipboardServiceError>;
```

### Usage at Call Sites

At call sites, provide fields directly as a flat object. When `.withMessage()` is used, the message is sealed by the template — you only pass fields:

```typescript
export function createClipboardServiceExtension(): ClipboardService {
  return {
    setClipboardText: (text) =>
      tryAsync({
        try: () => navigator.clipboard.writeText(text),
        catch: (error) => ClipboardServiceErr({
          text,
          cause: error,
        }),
      }),

    writeTextToCursor: (text) =>
      trySync({
        try: () => writeTextToCursor(text),
        catch: (error) => ClipboardServiceErr({
          text,
          cause: error,
        }),
      }),
  };
}
```

### Why Hand-Rolled Constructor Functions Are Still Discouraged

Before `createTaggedError`, some codebases used hand-rolled constructor functions like:

```typescript
export const ClipboardServiceErr = (error: Omit<ClipboardServiceError, 'name'>) =>
  Err({ name: 'ClipboardServiceError', ...error });
```

These have several problems:
- **Hidden behavior**: The function could add extra properties, have side effects, or change over time without it being obvious at the call site.
- **No field type enforcement**: `Omit<..., 'name'>` accepts any shape without checking.
- **Manual `name` wiring**: You can forget or misspell it.

`createTaggedError` is the better version of this pattern — it provides the same ergonomic factory shorthand while enforcing field types and message computation via the builder API.

## Error Classification Framework

### By Origin: New vs. Bubbled-Up Errors

Following principles from [Miguel Grinberg's error handling guide](https://blog.miguelgrinberg.com/post/the-ultimate-guide-to-error-handling-in-python), we classify errors by their origin:

#### New Errors
Error types that your code detects and creates:


```typescript
import { createTaggedError } from "wellcrafted/error";

// Input validation error type
const { ValidationError, ValidationErr } = createTaggedError('ValidationError')
  .withFields<{ providedAge: unknown; validRange: [number, number] }>()
  .withMessage(({ validRange }) =>
    `Age must be a number between ${validRange[0]} and ${validRange[1]}`
  );
type ValidationError = ReturnType<typeof ValidationError>;

function validateAge(age: unknown): Result<number, ValidationError> {
  if (typeof age !== "number" || age < 0 || age > 150) {
    return ValidationErr({
      providedAge: age, validRange: [0, 150],
    });
  }
  return Ok(age);
}

// Business logic error type
const { BusinessError, BusinessErr } = createTaggedError('BusinessError')
  .withFields<{ accountId: string; requestedAmount: number; availableBalance: number }>()
  .withMessage(({ requestedAmount, availableBalance }) =>
    `Insufficient funds: requested ${requestedAmount}, available ${availableBalance}`
  );
type BusinessError = ReturnType<typeof BusinessError>;

function withdrawFunds(account: Account, amount: number): Result<Account, BusinessError> {
  if (account.balance < amount) {
    return BusinessErr({
      accountId: account.id,
      requestedAmount: amount,
      availableBalance: account.balance,
    });
  }

  return Ok({
    ...account,
    balance: account.balance - amount,
  });
}
```

#### Bubbled-Up Errors
Error types that your code receives from functions it calls:

```typescript
import { createTaggedError } from "wellcrafted/error";

const { StorageError, StorageErr } = createTaggedError('StorageError')
  .withFields<{ userId: string; timestamp: string; cause?: unknown }>()
  .withMessage(() => 'Failed to save user data');
type StorageError = ReturnType<typeof StorageError>;

// Catching and re-wrapping external errors into typed error types
async function saveUserData(user: User): Promise<Result<void, StorageError>> {
  return await tryAsync({
    try: () => database.save(user),
    catch: (error) => StorageErr({
      userId: user.id,
      timestamp: new Date().toISOString(),
      cause: error, // Preserve the original error as a field
    }),
  });
}
```

### By Recoverability: What Should You Do?

#### 1. Recoverable Errors (Handle Locally)

Error types that your current function can meaningfully address:

```typescript
const { NetworkError, NetworkErr } = createTaggedError('NetworkError')
  .withFields<{ url: string; attempt: number; maxRetries: number; cause?: unknown }>()
  .withMessage(({ attempt, maxRetries }) =>
    `Request failed (attempt ${attempt}/${maxRetries})`
  );
type NetworkError = ReturnType<typeof NetworkError>;

async function fetchWithRetry<T>(
  url: string,
  maxRetries = 3
): Promise<Result<T, NetworkError>> {
  let lastError: NetworkError | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await tryAsync({
      try: () => fetch(url).then(r => r.json()),
      catch: (error) => NetworkErr({
        url, attempt, maxRetries,
        cause: error,
      }),
    });

    if (isOk(result)) {
      return result;
    }

    lastError = result.error;

    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  // All retries exhausted — message template handles it
  return NetworkErr({
    url, attempt: maxRetries, maxRetries,
    cause: lastError ?? undefined,
  });
}
```

#### 2. Non-Recoverable Errors (Propagate Up)

Error types that should be handled by a higher-level function:

```typescript
const { UserValidationError, UserValidationErr } = createTaggedError('UserValidationError')
  .withFields<{ providedId: number }>()
  .withMessage(({ providedId }) => `User ID must be positive, got ${providedId}`);
type UserValidationError = ReturnType<typeof UserValidationError>;

// Just propagate database error types up - the HTTP handler will deal with them
async function getUser(id: number): Promise<Result<User, DbError | UserValidationError>> {
  // Validate input
  if (id <= 0) {
    return UserValidationErr({ providedId: id });
  }

  // Let database error types bubble up unchanged
  const result = await database.findUser(id);
  return result; // Result<User, DbError>
}

// HTTP handler deals with different error types appropriately
async function handleGetUser(req: Request): Promise<Response> {
  const userId = parseInt(req.params.id);
  const result = await getUser(userId);

  if (isErr(result)) {
    switch (result.error.name) {
      case "UserValidationError":
        return new Response(JSON.stringify(result.error), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      case "DbError":
        // Log the full error but return generic message
        console.error("Database error:", result.error);
        return new Response(
          JSON.stringify({ message: "Internal server error" }),
          { status: 500, headers: { "Content-Type": "application/json" }}
        );
    }
  }

  return new Response(JSON.stringify(result.data), {
    headers: { "Content-Type": "application/json" }
  });
}
```

#### 3. Transformative Errors (Convert and Propagate)

Error types that need to be converted to a more appropriate type for the calling context:

```typescript
const { DbError, DbErr } = createTaggedError('DbError')
  .withFields<{ sql: string; cause?: unknown }>()
  .withMessage(() => 'Query execution failed');
type DbError = ReturnType<typeof DbError>;

// Low-level database function
async function executeQuery(sql: string): Promise<Result<any[], DbError>> {
  return await tryAsync({
    try: () => database.query(sql),
    catch: (error) => DbErr({
      sql: sql.substring(0, 100), // Truncate for logging
      cause: error,
    }),
  });
}

const { UserServiceError, UserServiceErr } = createTaggedError('UserServiceError')
  .withFields<{ userData: { name: string; email: string }; cause?: DbError }>()
  .withMessage(() => 'Failed to create user');
type UserServiceError = ReturnType<typeof UserServiceError>;

// Higher-level user service transforms DB error types to domain error types
async function createUser(userData: UserData): Promise<Result<User, UserServiceError>> {
  const result = await executeQuery(
    "INSERT INTO users (name, email) VALUES (?, ?)",
    [userData.name, userData.email]
  );

  if (isErr(result)) {
    // Transform database error type to domain-specific error type
    return UserServiceErr({
      userData: { name: userData.name, email: userData.email },
      cause: result.error,
    });
  }

  return Ok(result.data[0]);
}
```

## Advanced Patterns

### Error Aggregation

When you need to collect multiple errors:

```typescript
type ValidationResult<T> = Result<T, ValidationError[]>;

function validateUser(data: unknown): ValidationResult<User> {
  const errors: ValidationError[] = [];
  const result: Partial<User> = {};

  // Validate each field
  const nameResult = validateName(data.name);
  if (isErr(nameResult)) {
    errors.push(nameResult.error);
  } else {
    result.name = nameResult.data;
  }

  const emailResult = validateEmail(data.email);
  if (isErr(emailResult)) {
    errors.push(emailResult.error);
  } else {
    result.email = emailResult.data;
  }

  const ageResult = validateAge(data.age);
  if (isErr(ageResult)) {
    errors.push(ageResult.error);
  } else {
    result.age = ageResult.data;
  }

  if (errors.length > 0) {
    return Err(errors);
  }

  return Ok(result as User);
}
```

### Error Field Enrichment

Add fields as errors bubble up through layers:

```typescript
const { StorageError, StorageErr } = createTaggedError('StorageError')
  .withFields<{ path: string; contentLength: number; cause?: unknown }>()
  .withMessage(() => 'File write failed');
type StorageError = ReturnType<typeof StorageError>;

// Storage layer
async function writeFile(path: string, content: string): Promise<Result<void, StorageError>> {
  return await tryAsync({
    try: () => fs.writeFile(path, content),
    catch: (error) => StorageErr({
      path,
      contentLength: content.length,
      cause: error,
    }),
  });
}

const { DocumentServiceError, DocumentServiceErr } = createTaggedError('DocumentServiceError')
  .withFields<{
    documentId: string;
    documentTitle: string;
    userId: string;
    attemptTimestamp: string;
    documentSize: number;
    cause?: StorageError;
  }>()
  .withMessage(({ documentId }) => `Failed to save document ${documentId}`);
type DocumentServiceError = ReturnType<typeof DocumentServiceError>;

// Service layer - adds business fields
async function saveDocument(doc: Document): Promise<Result<void, DocumentServiceError>> {
  const filePath = `/documents/${doc.id}.json`;
  const content = JSON.stringify(doc);

  const result = await writeFile(filePath, content);
  if (isErr(result)) {
    return DocumentServiceErr({
      documentId: doc.id,
      documentTitle: doc.title,
      userId: doc.authorId,
      attemptTimestamp: new Date().toISOString(),
      documentSize: content.length,
      cause: result.error,
    });
  }

  return Ok(undefined);
}

// API layer - adds request context by spreading additional info
async function handleSaveDocument(req: Request): Promise<Response> {
  const document = await req.json();
  const result = await saveDocument(document);

  if (isErr(result)) {
    // Log the error with its flat fields
    console.error("Document save failed:", {
      ...result.error,
      // Add request-specific info for logging
      requestId: req.headers.get("x-request-id"),
      userAgent: req.headers.get("user-agent"),
      timestamp: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ error: "Failed to save document" }),
      { status: 500, headers: { "Content-Type": "application/json" }}
    );
  }

  return new Response(JSON.stringify({ success: true }));
}
```

### Parallel Error Handling

When dealing with multiple independent operations:

```typescript
import { partitionResults } from "wellcrafted/result";

const { ProcessingError, ProcessingErr } = createTaggedError('ProcessingError')
  .withFields<{
    totalFiles: number;
    successCount: number;
    failureCount: number;
    failures: unknown[];
    successfulPaths: string[];
    cause?: unknown;
  }>()
  .withMessage(({ failureCount, totalFiles }) =>
    `Failed to process ${failureCount} out of ${totalFiles} files`
  );
type ProcessingError = ReturnType<typeof ProcessingError>;

async function processMultipleFiles(paths: string[]): Promise<Result<ProcessedFile[], ProcessingError>> {
  // Process all files in parallel
  const results = await Promise.all(
    paths.map(path => processFile(path))
  );

  // Partition successes and failures
  const { oks, errs } = partitionResults(results);

  if (errs.length > 0) {
    return ProcessingErr({
      totalFiles: paths.length,
      successCount: oks.length,
      failureCount: errs.length,
      failures: errs.map(err => err.error),
      successfulPaths: oks.map((ok, i) => paths[results.indexOf(ok)]),
      cause: errs[0]?.error, // Use first error as primary cause
    });
  }

  return Ok(oks.map(ok => ok.data));
}
```

### Circuit Breaker Pattern

Implement resilience patterns with typed errors:

```typescript
type CircuitState = "closed" | "open" | "half-open";

const { CircuitBreakerError, CircuitBreakerErr } = createTaggedError('CircuitBreakerError')
  .withFields<{
    state: CircuitState;
    failureCount: number;
    lastFailureTime: number;
    resetTimeout: number;
  }>()
  .withMessage(({ state, failureCount }) =>
    `Circuit breaker is ${state} after ${failureCount} failures`
  );
type CircuitBreakerError = ReturnType<typeof CircuitBreakerError>;

class CircuitBreaker<T, E extends BaseError> {
  private state: CircuitState = "closed";
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(
    private readonly operation: () => Promise<Result<T, E>>,
    private readonly failureThreshold = 5,
    private readonly resetTimeout = 60000
  ) {}

  async execute(): Promise<Result<T, CircuitBreakerError | E>> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime < this.resetTimeout) {
        return CircuitBreakerErr({
          state: this.state,
          failureCount: this.failureCount,
          lastFailureTime: this.lastFailureTime,
          resetTimeout: this.resetTimeout,
        });
      }
      this.state = "half-open";
    }

    const result = await this.operation();

    if (isErr(result)) {
      this.onFailure();
      return result;
    }

    this.onSuccess();
    return result;
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = "closed";
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = "open";
    }
  }
}
```

## Error Monitoring and Observability

### Structured Logging

```typescript
interface ErrorLogEntry {
  level: "error";
  message: string;
  error: BaseError;
  timestamp: string;
  traceId?: string;
  spanId?: string;
}

function logError(error: BaseError, traceId?: string): void {
  const logEntry: ErrorLogEntry = {
    level: "error",
    message: error.message,
    error,
    timestamp: new Date().toISOString(),
    traceId,
  };

  console.error(JSON.stringify(logEntry));

  // Send to monitoring service
  monitoring.recordError(logEntry);
}
```

### Error Metrics

```typescript
function recordErrorMetrics(error: BaseError): void {
  // Increment error counter by type
  metrics.increment("errors.total", {
    errorType: error.name,
  });

  // Record error rate
  metrics.histogram("errors.rate", 1, {
    errorType: error.name,
  });
}
```

## Testing Error Scenarios

### Unit Testing Errors

```typescript
import { describe, it, expect } from "vitest";

describe("file operations", () => {
  it("should return FsError when file does not exist", async () => {
    const result = await readFileContent("/nonexistent/file.txt");

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.name).toBe("FsError");
      expect(result.error.message).toContain("Failed to read file content");
      expect(result.error.path).toBe("/nonexistent/file.txt");
      expect(result.error.cause).toBeDefined();
    }
  });

  it("should handle error propagation correctly", async () => {
    const result = await initializeApp();

    if (isErr(result)) {
      // Should be either ValidationError or FsError
      expect(["ValidationError", "FsError"]).toContain(result.error.name);
    }
  });
});
```

### Integration Testing with Error Injection

```typescript
// Mock that can be configured to fail
class MockDatabase {
  private shouldFail = false;

  configureFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }

  async findUser(id: number): Promise<Result<User, DbError>> {
    if (this.shouldFail) {
      return DbErr({
        sql: `SELECT * FROM users WHERE id = ${id}`,
        cause: new Error("Connection timeout"),
      });
    }

    return Ok({ id, name: "Test User", email: "test@example.com" });
  }
}

describe("user service with database failures", () => {
  it("should handle database failures gracefully", async () => {
    const mockDb = new MockDatabase();
    mockDb.configureFail(true);

    const result = await getUserService.getUser(123);

    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.name).toBe("DbError");
    }
  });
});
```

## Migration Strategies

### Gradual Migration from Throwing Errors

```typescript
const { ValidationError, ValidationErr } = createTaggedError('ValidationError')
  .withFields<{ input: string; cause?: unknown }>()
  .withMessage(() => 'Input is required');
type ValidationError = ReturnType<typeof ValidationError>;

// Legacy function that throws
function legacyFunction(input: string): string {
  if (!input) {
    throw new Error("Input is required");
  }
  return input.toUpperCase();
}

// Wrapper that converts to Result
function safeLegacyFunction(input: string): Result<string, ValidationError> {
  return trySync({
    try: () => legacyFunction(input),
    catch: (error) => ValidationErr({
      input,
      cause: error,
    }),
  });
}

// New function using Result pattern directly
function newFunction(input: string): Result<string, ValidationError> {
  if (!input) {
    return ValidationErr({ input });
  }
  return Ok(input.toUpperCase());
}
```

### Interoperability with Promise-based APIs

```typescript
// Convert Result to Promise (for libraries expecting promises)
function resultToPromise<T, E extends BaseError>(result: Result<T, E>): Promise<T> {
  if (isOk(result)) {
    return Promise.resolve(result.data);
  }

  // Convert error object to Error instance for promise rejection
  const error = new Error(result.error.message);
  error.name = result.error.name;

  return Promise.reject(error);
}

// Convert Promise to Result (for integrating promise-based libraries)
async function promiseToResult<T, E extends BaseError>(
  promise: Promise<T>,
  catch: (error: unknown) => Err<E>
): Promise<Result<T, E>> {
  return await tryAsync({
    try: () => promise,
    catch,
  });
}
```

This comprehensive approach to error handling provides a robust foundation for building reliable, maintainable applications with excellent observability and debugging capabilities.