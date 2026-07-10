const SOURCE_START = "// docs:quick-start:start";
const SOURCE_END = "// docs:quick-start:end";
const README_START = "<!-- docs:quick-start:start -->";
const README_END = "<!-- docs:quick-start:end -->";

async function read(path: string): Promise<string> {
	return Bun.file(path).text();
}

function extractBetween({
	content,
	start,
	end,
	path,
}: {
	content: string;
	start: string;
	end: string;
	path: string;
}): string {
	const startIndex = content.indexOf(start);
	const endIndex = content.indexOf(end);
	if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
		throw new Error(`Could not find the quick-start markers in ${path}.`);
	}

	return content.slice(startIndex + start.length, endIndex).trim();
}

function extractCodeFence(content: string, path: string): string {
	const match = content.match(/```typescript(?:[^\n]*)\n([\s\S]*?)\n```/);
	if (!match?.[1]) {
		throw new Error(`Could not find the TypeScript code fence in ${path}.`);
	}

	return match[1].trim();
}

const source = extractBetween({
	content: await read("examples/quick-start.ts"),
	start: SOURCE_START,
	end: SOURCE_END,
	path: "examples/quick-start.ts",
});

const readme = extractCodeFence(
	extractBetween({
		content: await read("README.md"),
		start: README_START,
		end: README_END,
		path: "README.md",
	}),
	"README.md",
);

const snippet = extractCodeFence(
	await read("docs/snippets/quick-start.mdx"),
	"docs/snippets/quick-start.mdx",
);

for (const [path, content] of [
	["README.md", readme],
	["docs/snippets/quick-start.mdx", snippet],
] as const) {
	if (content !== source) {
		throw new Error(`${path} has drifted from examples/quick-start.ts.`);
	}
}

console.log("quick-start docs match the canonical example");
