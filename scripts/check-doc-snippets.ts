type TextFile = {
	path: string;
	content: string;
};

type Region = {
	id: string;
	path: string;
	startLine: number;
	content: string;
};

type Marker = {
	id: string;
	kind: "start" | "end";
};

export type SnippetManifestEntry = {
	id: string;
	sourcePath: string;
	targetPaths: readonly string[];
	ownerPath: string;
	ownerImport: string;
	ownerComponent: string;
};

export const DOC_SNIPPET_MANIFEST: readonly SnippetManifestEntry[] = [
	{
		id: "quick-start",
		sourcePath: "examples/quick-start.ts",
		targetPaths: ["README.md", "docs/snippets/quick-start.mdx"],
		ownerPath: "docs/start/quick-start.mdx",
		ownerImport: 'import QuickStartExample from "/snippets/quick-start.mdx";',
		ownerComponent: "<QuickStartExample />",
	},
	{
		id: "service-boundary",
		sourcePath: "examples/service-boundary.ts",
		targetPaths: ["docs/snippets/service-boundary.mdx"],
		ownerPath: "docs/guides/service-boundaries.mdx",
		ownerImport:
			'import ServiceBoundaryExample from "/snippets/service-boundary.mdx";',
		ownerComponent: "<ServiceBoundaryExample />",
	},
	{
		id: "serialization-boundary",
		sourcePath: "examples/serialization-boundary.ts",
		targetPaths: ["docs/snippets/serialization-boundary.mdx"],
		ownerPath: "docs/guides/serialization-boundaries.mdx",
		ownerImport:
			'import SerializationBoundaryExample from "/snippets/serialization-boundary.mdx";',
		ownerComponent: "<SerializationBoundaryExample />",
	},
	{
		id: "tanstack-query",
		sourcePath: "examples/tanstack-query.ts",
		targetPaths: ["docs/snippets/tanstack-query.mdx"],
		ownerPath: "docs/integrations/tanstack-query.mdx",
		ownerImport:
			'import TanStackQueryExample from "/snippets/tanstack-query.mdx";',
		ownerComponent: "<TanStackQueryExample />",
	},
];

const SOURCE_MARKER = /^\s*\/\/\s*docs:snippet\s+([a-z0-9-]+):(start|end)\s*$/;
const HTML_TARGET_MARKER =
	/^\s*<!--\s*docs:snippet\s+([a-z0-9-]+):(start|end)\s*-->\s*$/;
const MDX_TARGET_MARKER =
	/^\s*\{\/\*\s*docs:snippet\s+([a-z0-9-]+):(start|end)\s*\*\/\}\s*$/;

function normalize(content: string): string {
	const lines = content
		.replaceAll("\r\n", "\n")
		.replaceAll("\r", "\n")
		.split("\n")
		.map((line) => line.trimEnd());

	while (lines[0] === "") lines.shift();
	while (lines.at(-1) === "") lines.pop();
	return lines.join("\n");
}

function parseMarker({
	line,
	path,
	lineNumber,
	type,
}: {
	line: string;
	path: string;
	lineNumber: number;
	type: "source" | "target";
}): Marker | null {
	const patterns =
		type === "source"
			? [SOURCE_MARKER]
			: [HTML_TARGET_MARKER, MDX_TARGET_MARKER];
	for (const pattern of patterns) {
		const match = line.match(pattern);
		if (match?.[1] && match[2] !== undefined) {
			return { id: match[1], kind: match[2] as Marker["kind"] };
		}
	}

	if (line.includes("docs:snippet")) {
		throw new Error(`Malformed ${type} marker at ${path}:${lineNumber}.`);
	}
	return null;
}

function extractRegions(file: TextFile, type: "source" | "target"): Region[] {
	const lines = file.content
		.replaceAll("\r\n", "\n")
		.replaceAll("\r", "\n")
		.split("\n");
	const regions: Region[] = [];
	let open: { id: string; startLine: number; contentStart: number } | null =
		null;

	for (const [index, line] of lines.entries()) {
		const lineNumber = index + 1;
		const marker = parseMarker({ line, path: file.path, lineNumber, type });
		if (!marker) continue;

		if (marker.kind === "start") {
			if (open) {
				throw new Error(
					`Nested snippet "${marker.id}" at ${file.path}:${lineNumber}; "${open.id}" opened at line ${open.startLine}.`,
				);
			}
			open = { id: marker.id, startLine: lineNumber, contentStart: index + 1 };
			continue;
		}

		if (!open) {
			throw new Error(
				`Snippet "${marker.id}" ends without a start at ${file.path}:${lineNumber}.`,
			);
		}
		if (open.id !== marker.id) {
			throw new Error(
				`Snippet "${marker.id}" ends at ${file.path}:${lineNumber}, but "${open.id}" opened at line ${open.startLine}.`,
			);
		}

		regions.push({
			id: open.id,
			path: file.path,
			startLine: open.startLine,
			content: lines.slice(open.contentStart, index).join("\n"),
		});
		open = null;
	}

	if (open) {
		throw new Error(
			`Snippet "${open.id}" starts at ${file.path}:${open.startLine} but never ends.`,
		);
	}

	const ids = new Set<string>();
	for (const region of regions) {
		if (ids.has(region.id)) {
			throw new Error(
				`Snippet "${region.id}" is declared more than once in ${file.path}.`,
			);
		}
		ids.add(region.id);
	}

	return regions;
}

function extractTargetCode(region: Region): string {
	const content = normalize(region.content);
	const lines = content.split("\n");
	const fenceLines = lines
		.map((line, index) => ({ line, index }))
		.filter(({ line }) => line.trimStart().startsWith("```"));

	if (
		fenceLines.length !== 2 ||
		fenceLines[0]?.index !== 0 ||
		fenceLines[1]?.index !== lines.length - 1 ||
		!/^```[a-z0-9_-]+(?:\s+[^\s].*)?$/i.test(lines[0] ?? "") ||
		(lines.at(-1) ?? "").trim() !== "```"
	) {
		throw new Error(
			`Target snippet "${region.id}" at ${region.path}:${region.startLine} must contain exactly one fenced code block and no prose.`,
		);
	}

	return normalize(lines.slice(1, -1).join("\n"));
}

export function checkDocSnippets({
	sourceFiles,
	targetFiles,
	manifest = [],
}: {
	sourceFiles: TextFile[];
	targetFiles: TextFile[];
	manifest?: readonly SnippetManifestEntry[];
}): void {
	const sources = sourceFiles.flatMap((file) => extractRegions(file, "source"));
	const targets = targetFiles.flatMap((file) => extractRegions(file, "target"));
	const sourceById = new Map<string, Region>();

	for (const source of sources) {
		const previous = sourceById.get(source.id);
		if (previous) {
			throw new Error(
				`Snippet "${source.id}" has multiple sources: ${previous.path}:${previous.startLine} and ${source.path}:${source.startLine}.`,
			);
		}
		sourceById.set(source.id, source);
	}

	if (manifest.length > 0) {
		const manifestById = new Map(manifest.map((entry) => [entry.id, entry]));
		const targetFilesByPath = new Map(
			targetFiles.map((file) => [file.path, file]),
		);

		for (const source of sources) {
			if (!manifestById.has(source.id)) {
				throw new Error(
					`Source snippet "${source.id}" at ${source.path}:${source.startLine} is not declared in the documentation snippet manifest.`,
				);
			}
		}

		for (const target of targets) {
			if (!manifestById.has(target.id)) {
				throw new Error(
					`Target snippet "${target.id}" at ${target.path}:${target.startLine} is not declared in the documentation snippet manifest.`,
				);
			}
		}

		for (const entry of manifest) {
			const source = sourceById.get(entry.id);
			if (!source) {
				throw new Error(
					`Required source snippet "${entry.id}" is missing from ${entry.sourcePath}.`,
				);
			}
			if (source.path !== entry.sourcePath) {
				throw new Error(
					`Required source snippet "${entry.id}" moved from ${entry.sourcePath} to ${source.path}.`,
				);
			}

			const actualTargetPaths = targets
				.filter((target) => target.id === entry.id)
				.map((target) => target.path);
			for (const requiredPath of entry.targetPaths) {
				if (!actualTargetPaths.includes(requiredPath)) {
					throw new Error(
						`Required target snippet "${entry.id}" is missing from ${requiredPath}.`,
					);
				}
			}
			for (const actualPath of actualTargetPaths) {
				if (!entry.targetPaths.includes(actualPath)) {
					throw new Error(
						`Target snippet "${entry.id}" is declared at unexpected path ${actualPath}.`,
					);
				}
			}

			const owner = targetFilesByPath.get(entry.ownerPath);
			if (!owner) {
				throw new Error(
					`Required public owner for snippet "${entry.id}" is missing: ${entry.ownerPath}.`,
				);
			}
			if (!owner.content.includes(entry.ownerImport)) {
				throw new Error(
					`Public owner ${entry.ownerPath} is missing the required import for snippet "${entry.id}": ${entry.ownerImport}`,
				);
			}
			if (!owner.content.includes(entry.ownerComponent)) {
				throw new Error(
					`Public owner ${entry.ownerPath} is missing the required component for snippet "${entry.id}": ${entry.ownerComponent}`,
				);
			}
		}
	}

	const targetIds = new Set<string>();
	for (const target of targets) {
		const source = sourceById.get(target.id);
		if (!source) {
			throw new Error(
				`Target snippet "${target.id}" at ${target.path}:${target.startLine} has no source.`,
			);
		}
		targetIds.add(target.id);

		if (extractTargetCode(target) !== normalize(source.content)) {
			throw new Error(
				`Target snippet "${target.id}" at ${target.path}:${target.startLine} has drifted from ${source.path}:${source.startLine}.`,
			);
		}
	}

	for (const source of sources) {
		if (!targetIds.has(source.id)) {
			throw new Error(
				`Source snippet "${source.id}" at ${source.path}:${source.startLine} has no target.`,
			);
		}
	}
}

async function readFiles(paths: string[]): Promise<TextFile[]> {
	return Promise.all(
		paths.toSorted().map(async (path) => ({
			path,
			content: await Bun.file(path).text(),
		})),
	);
}

async function scan(glob: string): Promise<string[]> {
	const paths: string[] = [];
	for await (const path of new Bun.Glob(glob).scan({ onlyFiles: true })) {
		paths.push(path);
	}
	return paths;
}

if (import.meta.main) {
	const sourcePaths = await scan("examples/**/*.ts");
	const targetPaths = [
		"README.md",
		...(await scan("docs/**/*.md")),
		...(await scan("docs/**/*.mdx")),
	];

	checkDocSnippets({
		sourceFiles: await readFiles(sourcePaths),
		targetFiles: await readFiles(targetPaths),
		manifest: DOC_SNIPPET_MANIFEST,
	});
	console.log("documentation snippets match their canonical examples");
}
