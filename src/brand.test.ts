import { describe, it, expectTypeOf } from "vitest";
import type { Brand } from "./brand.js";

describe("Brand", () => {
	// =============================================================================
	// Basic Branding (UserId / OrderId)
	// =============================================================================

	type UserId = string & Brand<"UserId">;
	type OrderId = string & Brand<"OrderId">;
	const UserId = (s: string): UserId => s as UserId;
	const OrderId = (s: string): OrderId => s as OrderId;

	it("single brand creates nominal type", () => {
		const userId = UserId("user-123");
		const orderId = OrderId("order-456");

		expectTypeOf(userId).toEqualTypeOf<UserId>();
		expectTypeOf(orderId).toEqualTypeOf<OrderId>();

		// @ts-expect-error - UserId not assignable to OrderId
		const _test1: OrderId = userId;

		// @ts-expect-error - OrderId not assignable to UserId
		const _test2: UserId = orderId;
	});

	it("raw primitive not assignable to branded type", () => {
		// @ts-expect-error - string not assignable to UserId
		const _test: UserId = "raw-string";
	});

	it("branded type assignable to primitive", () => {
		const userId = UserId("user-123");

		const str: string = userId;
		expectTypeOf(str).toBeString();
	});

	// =============================================================================
	// Hierarchical Branding (AbsolutePath / ProjectDir / ProviderDir)
	// =============================================================================

	type AbsolutePath = string & Brand<"AbsolutePath">;
	type ProjectDir = AbsolutePath & Brand<"ProjectDir">;
	type ProviderDir = AbsolutePath & Brand<"ProviderDir">;
	const AbsolutePath = (s: string): AbsolutePath => s as AbsolutePath;
	const ProjectDir = (s: string): ProjectDir => s as ProjectDir;
	const ProviderDir = (s: string): ProviderDir => s as ProviderDir;

	it("stacked brands are not never", () => {
		type Base = string & Brand<"Base">;
		type Child = Base & Brand<"Child">;

		type IsNever<T> = [T] extends [never] ? true : false;
		expectTypeOf<IsNever<Child>>().toEqualTypeOf<false>();
	});

	it("child brand assignable to parent brand", () => {
		const projectDir = ProjectDir("/home/project");

		const abs: AbsolutePath = projectDir;
		expectTypeOf(abs).toExtend<AbsolutePath>();
	});

	it("parent brand NOT assignable to child brand", () => {
		const absolutePath = AbsolutePath("/home");

		// @ts-expect-error
		const _test: ProjectDir = absolutePath;
	});

	it("sibling brands are distinct", () => {
		const projectDir = ProjectDir("/project");
		const providerDir = ProviderDir("/provider");

		// @ts-expect-error
		const _test1: ProviderDir = projectDir;

		// @ts-expect-error
		const _test2: ProjectDir = providerDir;
	});

	it("string methods work on hierarchical brands", () => {
		const projectDir = ProjectDir("/Project");

		const lower = projectDir.toLowerCase();
		const upper = projectDir.toUpperCase();
		const len = projectDir.length;

		expectTypeOf(lower).toBeString();
		expectTypeOf(upper).toBeString();
		expectTypeOf(len).toBeNumber();
	});

	// =============================================================================
	// Multiple Inheritance (A & B → C)
	// =============================================================================

	type A = string & Brand<"A">;
	type B = string & Brand<"B">;
	type C = A & B & Brand<"C">;
	const A = (s: string): A => s as A;
	const B = (s: string): B => s as B;
	const C = (s: string): C => s as C;

	it("multiple inheritance works", () => {
		const c = C("abc");

		const a: A = c;
		const b: B = c;

		expectTypeOf(a).toExtend<A>();
		expectTypeOf(b).toExtend<B>();
	});

	it("multiple inheritance: parents not assignable to child", () => {
		const a = A("a");
		const b = B("b");

		// @ts-expect-error - A alone not assignable to C
		const _test1: C = a;

		// @ts-expect-error - B alone not assignable to C
		const _test2: C = b;
	});

	// =============================================================================
	// Deep Hierarchy (Level0 → Level1 → Level2 → Level3)
	// =============================================================================

	type Level0 = string & Brand<"Level0">;
	type Level1 = Level0 & Brand<"Level1">;
	type Level2 = Level1 & Brand<"Level2">;
	type Level3 = Level2 & Brand<"Level3">;
	const Level3 = (s: string): Level3 => s as Level3;

	it("deep hierarchy works", () => {
		const level3 = Level3("deep");

		const l0: Level0 = level3;
		const l1: Level1 = level3;
		const l2: Level2 = level3;

		expectTypeOf(l0).toExtend<Level0>();
		expectTypeOf(l1).toExtend<Level1>();
		expectTypeOf(l2).toExtend<Level2>();
	});

	// =============================================================================
	// Other Primitive Types
	// =============================================================================

	it("works with number", () => {
		type Percentage = number & Brand<"Percentage">;
		type ValidatedPercentage = Percentage & Brand<"Validated">;
		const ValidatedPercentage = (n: number): ValidatedPercentage =>
			n as ValidatedPercentage;

		const validated = ValidatedPercentage(50);

		const pct: Percentage = validated;
		const num: number = validated;

		expectTypeOf(pct).toExtend<Percentage>();
		expectTypeOf(num).toBeNumber();
	});

	it("works with object types", () => {
		type BaseConfig = { host: string } & Brand<"Config">;
		type ValidatedConfig = BaseConfig & Brand<"Validated">;
		const ValidatedConfig = (c: { host: string }): ValidatedConfig =>
			c as ValidatedConfig;

		const validated = ValidatedConfig({ host: "localhost" });

		const base: BaseConfig = validated;
		expectTypeOf(validated.host).toBeString();
		expectTypeOf(base).toExtend<BaseConfig>();
	});
});
