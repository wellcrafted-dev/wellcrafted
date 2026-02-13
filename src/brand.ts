/**
 * Internal symbol used to create nominal typing for branded types.
 */
declare const brand: unique symbol;

/**
 * Creates a brand type for nominal typing in TypeScript.
 *
 * Branded types create distinct types from primitive types, preventing
 * accidental mixing of values that should be semantically different.
 *
 * ## Why wellcrafted Brand?
 *
 * **Composable** — Brands stack to create hierarchical type relationships.
 * Child types are assignable to parent types, but not vice versa. Multiple
 * inheritance works via intersection. This is possible because of the nested
 * object structure `{ [brand]: { [K in T]: true } }` — when brands intersect,
 * their properties merge instead of conflicting.
 *
 * **Framework-agnostic** — Unlike Zod's `.brand()`, ArkType's `.brand()`, or
 * Valibot's `v.brand()` — which each produce library-specific branded types —
 * wellcrafted's `Brand<T>` is a pure type utility with zero runtime footprint.
 * Define your branded type once, then plug it into any runtime validator.
 * Switch validation libraries without touching your type definitions.
 *
 * **Dual-declaration friendly** — TypeScript has two parallel namespaces: types
 * and values. You can use the same PascalCase name for both the branded type and
 * its runtime validator. JSDoc written on the type shows up everywhere the name
 * appears — function signatures, schema definitions, and imports — giving you a
 * single hover experience across your entire codebase.
 *
 * @template T - A string literal type that serves as the brand identifier
 *
 * @example Single brand — preventing ID mix-ups
 * ```typescript
 * type UserId = string & Brand<"UserId">;
 * type OrderId = string & Brand<"OrderId">;
 *
 * const userId: UserId = "user-123" as UserId;
 * const orderId: OrderId = userId; // ❌ Type error
 * ```
 *
 * @example Hierarchical brands — child assignable to parent
 * ```typescript
 * type AbsolutePath = string & Brand<"AbsolutePath">;
 * type ConfigPath = AbsolutePath & Brand<"ConfigPath">;
 *
 * declare const configPath: ConfigPath;
 * const abs: AbsolutePath = configPath;  // ✅ Child assignable to parent
 * const cfg: ConfigPath = abs;           // ❌ Parent not assignable to child
 * ```
 *
 * @example Multiple inheritance
 * ```typescript
 * type Serializable = unknown & Brand<"Serializable">;
 * type Validated = unknown & Brand<"Validated">;
 * type SafeData = Serializable & Validated & Brand<"SafeData">;
 *
 * // SafeData is assignable to both Serializable and Validated
 * ```
 *
 * @example Dual-declaration — same name for type and runtime validator
 *
 * TypeScript resolves the name from context: type position = branded type,
 * value position = runtime validator. One name, zero ambiguity.
 *
 * ```typescript
 * // Type-only brand (no runtime validation needed)
 * type Guid = string & Brand<"Guid">;
 *
 * // Dual-declaration: type + runtime validator share the same name.
 * // Hover over FileId anywhere — IDE shows the same JSDoc whether
 * // it appears as a type annotation or a runtime schema.
 * type FileId = Guid & Brand<"FileId">;
 * const FileId = type("string").pipe((s): FileId => s as FileId);
 * ```
 *
 * @example Framework-agnostic — same Brand, any validator
 *
 * Define the type once with `Brand<T>`, then create runtime validators
 * with whichever library you prefer. Your branded types are never locked
 * to a specific validation library.
 *
 * ```typescript
 * import { type } from "arktype";
 * import { z } from "zod";
 * import * as v from "valibot";
 *
 * // Define the type ONCE — it's just a type, no library dependency
 * type FileId = string & Brand<"FileId">;
 *
 * // ArkType
 * const FileId = type("string").pipe((s): FileId => s as FileId);
 *
 * // Zod
 * const FileId = z.string().transform((s): FileId => s as FileId);
 *
 * // Valibot
 * const FileId = v.pipe(v.string(), v.transform((s): FileId => s as FileId));
 * ```
 *
 * @see {@link https://wellcrafted.dev/integrations/validation-libraries | Using Brand with Validation Libraries}
 */
type Brand<T extends string> = {
	[brand]: { [K in T]: true };
};

export type { Brand };
