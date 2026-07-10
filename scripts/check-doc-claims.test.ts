/**
 * Documentation Claims Gate Tests
 *
 * Verifies that public-claim scanning catches prohibited API guidance and
 * unsupported claims while preserving explicit limitations and valid examples.
 *
 * Key behaviors:
 * - Retired imports and unsafe Result truthiness checks are detected across formatting
 * - Unsupported serialization, reliability, and vanity claims are rejected
 * - Negated limitations and current API guidance remain valid
 */

import { describe, expect, test } from "bun:test";
import { findClaimFindings } from "./check-doc-claims";

type ClaimCase = {
	content: string;
	name: string;
	rule: string;
};

const REJECTED_CLAIMS: readonly ClaimCase[] = [
	{
		name: "multiline aliased queryOptions import and use",
		rule: "retired-api",
		content: `
import {
	queryOptions as createQuery,
} from "wellcrafted/query";

const options = createQuery({ queryKey: ["users"] });
`,
	},
	{
		name: "multiline aliased mutationOptions import and use",
		rule: "retired-api",
		content: `
import {
	mutationOptions as createMutation,
} from "wellcrafted/query";

const options = createMutation({ mutationFn: saveUser });
`,
	},
	{
		name: "multiline queryOptions call",
		rule: "retired-api",
		content: `
const options = queryOptions
({ queryKey: ["users"] });
`,
	},
	{
		name: "multiline mutationOptions call",
		rule: "retired-api",
		content: `
const options = mutationOptions
({ mutationFn: saveUser });
`,
	},
	{
		name: "direct Result error truthiness",
		rule: "unsafe-result-check",
		content: "if (result.error) return result;",
	},
	{
		name: "negated direct Result error truthiness",
		rule: "unsafe-result-check",
		content: "if (!result.error) return result.data;",
	},
	{
		name: "Boolean Result error coercion",
		rule: "unsafe-result-check",
		content: "const failed = Boolean(result.error);",
	},
	{
		name: "double-negated Result error coercion",
		rule: "unsafe-result-check",
		content: "const failed = !!result.error;",
	},
	{
		name: "Result error ternary discrimination",
		rule: "unsafe-result-check",
		content: "return result.error ? result : Ok(result.data);",
	},
	{
		name: "consumer vanity metric",
		rule: "unsupported-metric",
		content: "Trusted by 1,234 consumers.",
	},
	{
		name: "uptime reliability claim",
		rule: "reliability-claim",
		content: "Delivers 99.99% uptime.",
	},
	{
		name: "JSON field enforcement claim",
		rule: "serialization-type-enforcement",
		content: "defineErrors guarantees JSON-compatible fields.",
	},
	{
		name: "absolute JSON survival claim",
		rule: "serialization-absolute",
		content: "Errors always survive JSON serialization.",
	},
];

const ALLOWED_CLAIMS: readonly Omit<ClaimCase, "rule">[] = [
	{
		name: "explicit JSON field limitation",
		content: "defineErrors does not guarantee JSON-compatible fields.",
	},
	{
		name: "explicit serialization limitation",
		content: "Errors do not always survive JSON serialization.",
	},
	{
		name: "qualified unsafe Result example",
		content:
			"Do not use `Boolean(result.error)` as a general Result check because falsy errors are permitted.",
	},
	{
		name: "exact Result discrimination",
		content: "if (result.error !== null) return result;",
	},
	{
		name: "Result predicate discrimination",
		content: "if (isErr(result)) return result;",
	},
	{
		name: "optional error access",
		content: "return result.error?.message;",
	},
	{
		name: "current query adapter",
		content: `
import { resultQueryOptions } from "wellcrafted/query";

const options = resultQueryOptions({ queryKey: ["users"] });
`,
	},
];

describe("rejected public claims", () => {
	for (const claimCase of REJECTED_CLAIMS) {
		test(`${claimCase.name} reports ${claimCase.rule}`, () => {
			const findings = findClaimFindings("docs/test.mdx", claimCase.content);

			expect(findings.some((finding) => finding.rule === claimCase.rule)).toBe(
				true,
			);
		});
	}
});

describe("allowed public claims", () => {
	for (const claimCase of ALLOWED_CLAIMS) {
		test(`${claimCase.name} reports no findings`, () => {
			expect(findClaimFindings("docs/test.mdx", claimCase.content)).toEqual([]);
		});
	}
});

describe("claim allowances", () => {
	test("decision pages can allow an attributed retired API reference", () => {
		const content = `
<!-- docs:claims:allow-start rule="retired-api" reason="Historical API context" -->
The former API was \`queryOptions\`.
<!-- docs:claims:allow-end rule="retired-api" -->
`;

		expect(
			findClaimFindings("docs/decisions/query-history.mdx", content),
		).toEqual([]);
	});

	test("decision pages cannot allow unsafe Result checks", () => {
		const content = `
<!-- docs:claims:allow-start rule="unsafe-result-check" reason="Example" -->
if (result.error) return result;
<!-- docs:claims:allow-end rule="unsafe-result-check" -->
`;
		const findings = findClaimFindings(
			"docs/decisions/result-history.mdx",
			content,
		);

		expect(findings.some((finding) => finding.rule === "gate-config")).toBe(
			true,
		);
		expect(
			findings.some((finding) => finding.rule === "unsafe-result-check"),
		).toBe(true);
	});
});
