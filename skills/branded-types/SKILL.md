---
name: branded-types
description: Type-safe distinct primitives with Brand from wellcrafted. Use when creating nominal types for IDs, tokens, or any primitive that shouldn't be interchangeable.
---

# Branded Types

```typescript
import type { Brand } from 'wellcrafted/brand';
```

## The Problem

TypeScript's structural typing lets you pass any `string` where another `string` is expected. A `UserId` and an `OrderId` are both strings — the compiler won't stop you from mixing them up.

```typescript
function getUser(id: string) { /* ... */ }
function getOrder(id: string) { /* ... */ }

const userId = '123';
const orderId = '456';
getUser(orderId); // No error — but wrong
```

## The Brand Type

`Brand<T>` creates a phantom brand on a primitive. Two branded types from the same base are incompatible.

```typescript
type UserId = string & Brand<'UserId'>;
type OrderId = string & Brand<'OrderId'>;

function getUser(id: UserId) { /* ... */ }

const userId = 'abc' as UserId;
const orderId = 'xyz' as OrderId;
getUser(userId);   // compiles
getUser(orderId);  // type error
```

Zero runtime footprint — `Brand<T>` exists only at the type level.

## Brand Constructor Pattern

Never scatter `as UserId` casts across the codebase. Create a brand constructor — one function, one `as` cast, single source of truth.

```typescript
import type { Brand } from 'wellcrafted/brand';

// 1. Define the branded type
type UserId = string & Brand<'UserId'>;

// 2. Create the brand constructor — THE ONLY place with `as UserId`
// PascalCase matches the type name (TypeScript allows same-name type + value)
function UserId(id: string): UserId {
  return id as UserId;
}

// 3. Use everywhere
const id = UserId('abc-123');
getUser(UserId(rawString));
```

PascalCase constructors avoid parameter shadowing:

```typescript
// No shadowing — UserId() is PascalCase, userId is camelCase
function processUser(userId: string) {
  getUser(UserId(userId));
}
```

## Adding Runtime Validation

Brand constructors can validate before casting:

```typescript
function Email(value: string): Email {
  if (!value.includes('@')) {
    throw new Error(`Invalid email: ${value}`);
  }
  return value as Email;
}
type Email = string & Brand<'Email'>;
```

Add validation when the brand represents a constrained value (emails, UUIDs, positive numbers). Skip it when the brand is purely for identity distinction (UserId, OrderId).

## Anti-Patterns

### Scattered as casts

```typescript
// WRONG — assertions everywhere, no single source of truth
const id = someString as UserId;           // file1.ts
doSomething(otherId as UserId);            // file2.ts
const parsed = key.split(':')[0] as UserId; // file3.ts

// CORRECT — one constructor, used everywhere
const id = UserId(someString);
doSomething(UserId(otherId));
const parsed = UserId(key.split(':')[0]);
```

### Missing constructor

```typescript
// WRONG — type exists but no constructor
type PostId = string & Brand<'PostId'>;
// Consumers forced to write `as PostId` everywhere

// CORRECT — always pair the type with a constructor
type PostId = string & Brand<'PostId'>;
function PostId(id: string): PostId {
  return id as PostId;
}
```

## Naming Convention

| Branded Type | Constructor |
| --- | --- |
| `UserId` | `UserId()` |
| `OrderId` | `OrderId()` |
| `Email` | `Email()` |
| `ApiToken` | `ApiToken()` |

The constructor uses PascalCase matching the type name. TypeScript allows a type and value to share the same name since they occupy different namespaces.

See also: `patterns` skill for factory function patterns.
