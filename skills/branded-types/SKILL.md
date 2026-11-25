---
name: branded-types
description: Use wellcrafted Brand for compile-time distinctions and pair it with explicit constructor or validator boundaries.
---

# Branded types

```typescript
import type { Brand } from "wellcrafted/brand";
```

`Brand<T>` is type-only. It adds no runtime validation, parsing, or serialization behavior.

```typescript
type UserId = string & Brand<"UserId">;
type OrderId = string & Brand<"OrderId">;

function getUser(userId: UserId) {}

declare const orderId: OrderId;
getUser(orderId); // type error
```

## Create one boundary

For an identity-only distinction, centralize the assertion in a PascalCase constructor:

```typescript
type UserId = string & Brand<"UserId">;

function UserId(value: string): UserId {
  return value as UserId;
}

const userId = UserId(rawId);
```

Do not scatter `as UserId` through application code. One constructor keeps the conversion searchable and gives you one place to add validation later.

For constrained data, validate before branding. The type and validator can share a name because TypeScript has separate type and value namespaces.

```typescript
import { z } from "zod";

type Email = string & Brand<"Email">;
const Email = z
  .string()
  .email()
  .transform((value): Email => value as Email);
```

The assertion is safe only to the extent that the preceding runtime checks establish the application's rule. A direct assertion elsewhere bypasses that evidence.

## Assignability

Different markers on the same base are incompatible. Brands can also form hierarchies through intersection:

```typescript
type AbsolutePath = string & Brand<"AbsolutePath">;
type ConfigPath = AbsolutePath & Brand<"ConfigPath">;

declare const configPath: ConfigPath;
const absolutePath: AbsolutePath = configPath;
```

The child is assignable to the parent; the parent is not assignable to the child.

Branding does not change the runtime value. A branded string crosses JSON as a string, and the receiving boundary must validate and brand it again.

Use the validation integration page for focused ArkType, Zod, and Valibot recipes. Use the brand reference for the exact exported type contract.
