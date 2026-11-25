/**
 * Documentation Snippet Gate Tests
 *
 * Verifies generic snippet marker and drift checks plus the required public
 * source, target, and owner manifest contract.
 *
 * Key behaviors:
 * - Exact fenced targets stay synchronized with one canonical source
 * - Invalid, nested, duplicate, orphaned, and drifted regions fail
 * - Required source-target pairs and public owner imports cannot disappear
 */
import { expect, test } from "bun:test";
import {
	checkDocSnippets,
	type SnippetManifestEntry,
} from "./check-doc-snippets";

const manifest: readonly SnippetManifestEntry[] = [
	{
		id: "example",
		sourcePath: "examples/example.ts",
		targetPaths: ["docs/snippets/example.mdx"],
		ownerPath: "docs/start/example.mdx",
		ownerImport: 'import Example from "/snippets/example.mdx";',
		ownerComponent: "<Example />",
	},
];

function createManifestFiles() {
	return {
		sourceFiles: [
			{
				path: "examples/example.ts",
				content:
					"// docs:snippet example:start\nconst value = 1;\n// docs:snippet example:end",
			},
		],
		targetFiles: [
			{
				path: "docs/snippets/example.mdx",
				content:
					"{/* docs:snippet example:start */}\n```ts\nconst value = 1;\n```\n{/* docs:snippet example:end */}",
			},
			{
				path: "docs/start/example.mdx",
				content: 'import Example from "/snippets/example.mdx";\n\n<Example />',
			},
		],
	};
}

test("accepts one source with multiple exact fenced targets", () => {
	expect(() =>
		checkDocSnippets({
			sourceFiles: [
				{
					path: "examples/example.ts",
					content: [
						"// docs:snippet example:start",
						"const value = 1;",
						"// docs:snippet example:end",
					].join("\n"),
				},
			],
			targetFiles: ["README.md", "docs/snippets/example.mdx"].map((path) => ({
				path,
				content: [
					"<!-- docs:snippet example:start -->",
					"```typescript",
					"const value = 1;",
					"```",
					"<!-- docs:snippet example:end -->",
				].join("\n"),
			})),
		}),
	).not.toThrow();
});

test("accepts every required manifest pair and public owner", () => {
	const { sourceFiles, targetFiles } = createManifestFiles();

	expect(() =>
		checkDocSnippets({ sourceFiles, targetFiles, manifest }),
	).not.toThrow();
});

test("rejects a missing required source-target pair", () => {
	const { sourceFiles, targetFiles } = createManifestFiles();

	expect(() =>
		checkDocSnippets({
			sourceFiles,
			targetFiles: targetFiles.filter(
				(file) => file.path !== "docs/snippets/example.mdx",
			),
			manifest,
		}),
	).toThrow(
		'Required target snippet "example" is missing from docs/snippets/example.mdx',
	);
});

test("rejects a missing public owner import", () => {
	const { sourceFiles, targetFiles } = createManifestFiles();
	const owner = targetFiles.find(
		(file) => file.path === "docs/start/example.mdx",
	);
	if (!owner) throw new Error("Expected the owner fixture.");
	owner.content = "<Example />";

	expect(() =>
		checkDocSnippets({ sourceFiles, targetFiles, manifest }),
	).toThrow("is missing the required import");
});

test("rejects duplicate sources", () => {
	expect(() =>
		checkDocSnippets({
			sourceFiles: ["one.ts", "two.ts"].map((path) => ({
				path,
				content:
					"// docs:snippet example:start\nconst value = 1;\n// docs:snippet example:end",
			})),
			targetFiles: [],
		}),
	).toThrow("multiple sources");
});

test("rejects nested markers", () => {
	expect(() =>
		checkDocSnippets({
			sourceFiles: [
				{
					path: "example.ts",
					content: [
						"// docs:snippet outer:start",
						"// docs:snippet inner:start",
						"// docs:snippet inner:end",
						"// docs:snippet outer:end",
					].join("\n"),
				},
			],
			targetFiles: [],
		}),
	).toThrow("Nested snippet");
});

test("rejects orphan and unused regions", () => {
	expect(() =>
		checkDocSnippets({
			sourceFiles: [],
			targetFiles: [
				{
					path: "README.md",
					content:
						"<!-- docs:snippet example:start -->\n```ts\nvalue\n```\n<!-- docs:snippet example:end -->",
				},
			],
		}),
	).toThrow("has no source");

	expect(() =>
		checkDocSnippets({
			sourceFiles: [
				{
					path: "example.ts",
					content:
						"// docs:snippet example:start\nvalue\n// docs:snippet example:end",
				},
			],
			targetFiles: [],
		}),
	).toThrow("has no target");
});

test("rejects target prose and drift", () => {
	const sourceFiles = [
		{
			path: "example.ts",
			content:
				"// docs:snippet example:start\nconst value = 1;\n// docs:snippet example:end",
		},
	];

	expect(() =>
		checkDocSnippets({
			sourceFiles,
			targetFiles: [
				{
					path: "README.md",
					content:
						"<!-- docs:snippet example:start -->\nProse\n```ts\nconst value = 1;\n```\n<!-- docs:snippet example:end -->",
				},
			],
		}),
	).toThrow("exactly one fenced code block and no prose");

	expect(() =>
		checkDocSnippets({
			sourceFiles,
			targetFiles: [
				{
					path: "README.md",
					content:
						"<!-- docs:snippet example:start -->\n```ts\nconst value = 2;\n```\n<!-- docs:snippet example:end -->",
				},
			],
		}),
	).toThrow("has drifted");
});
