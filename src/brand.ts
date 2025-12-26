/**
 * Internal symbol used to create nominal typing for branded types.
 */
declare const brand: unique symbol;

/**
 * Creates a brand type for nominal typing in TypeScript.
 *
 * Branded types help create distinct types from primitive types, preventing
 * accidental mixing of values that should be semantically different.
 *
 * Brands can be stacked to create hierarchical type relationships:
 *
 * @template T - A string literal type that serves as the brand identifier
 *
 * @example Single brand
 * ```typescript
 * type UserId = string & Brand<"UserId">;
 * type OrderId = string & Brand<"OrderId">;
 *
 * // UserId and OrderId are incompatible
 * const userId: UserId = "user-123" as UserId;
 * const orderId: OrderId = userId; // ❌ Type error
 * ```
 *
 * @example Hierarchical brands
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
 */
type Brand<T extends string> = {
	[brand]: { [K in T]: true };
};

export { Brand };
