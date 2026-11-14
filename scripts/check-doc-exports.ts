import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";

type ExportKind = "value" | "type" | "namespace";

type ExportTuple = {
	subpath: string;
	kind: ExportKind;
	symbol: string;
};

type PackageManifest = {
	name: string;
	exports: Record<string, { types: string }>;
};

const EXACT_MARKER_PATTERN =
	/^\{\/\* docs:export subpath="([^"]+)" kind="(value|type|namespace)" symbol="([^"]+)" \*\/\}$/;
const TYPE_FLAGS = ts.SymbolFlags.Type;
const VALUE_FLAGS = ts.SymbolFlags.Value;

function tupleKey({ subpath, kind, symbol }: ExportTuple): string {
	return `${subpath}\0${kind}\0${symbol}`;
}

function sortTuples(tuples: Iterable<ExportTuple>): ExportTuple[] {
	return [...tuples].sort((left, right) =>
		tupleKey(left).localeCompare(tupleKey(right)),
	);
}

function resolveAlias(checker: ts.TypeChecker, symbol: ts.Symbol): ts.Symbol {
	return symbol.flags & ts.SymbolFlags.Alias
		? checker.getAliasedSymbol(symbol)
		: symbol;
}

function getModuleSymbol(
	checker: ts.TypeChecker,
	sourceFile: ts.SourceFile,
): ts.Symbol {
	const symbol = checker.getSymbolAtLocation(sourceFile);
	if (!symbol) {
		throw new Error(
			`Could not resolve module symbol for ${sourceFile.fileName}.`,
		);
	}
	return symbol;
}

function deriveExpectedTuples(manifest: PackageManifest): ExportTuple[] {
	const entries = Object.entries(manifest.exports);
	const declarationPaths = entries.map(([, target]) => resolve(target.types));
	const program = ts.createProgram({
		rootNames: declarationPaths,
		options: {
			module: ts.ModuleKind.NodeNext,
			moduleResolution: ts.ModuleResolutionKind.NodeNext,
			target: ts.ScriptTarget.ESNext,
			skipLibCheck: true,
			strict: true,
			types: [],
		},
	});
	const diagnostics = declarationPaths.flatMap((declarationPath) => {
		const sourceFile = program.getSourceFile(declarationPath);
		return sourceFile ? program.getSyntacticDiagnostics(sourceFile) : [];
	});
	if (diagnostics.length > 0) {
		throw new Error(
			ts.formatDiagnosticsWithColorAndContext(diagnostics, {
				getCanonicalFileName: (fileName) => fileName,
				getCurrentDirectory: () => process.cwd(),
				getNewLine: () => "\n",
			}),
		);
	}

	const checker = program.getTypeChecker();
	const tuples = new Map<string, ExportTuple>();

	for (const [exportPath, target] of entries) {
		const shortSubpath = exportPath.replace(/^\.\//, "");
		const subpath = `${manifest.name}/${shortSubpath}`;
		const declarationPath = resolve(target.types);
		const sourceFile = program.getSourceFile(declarationPath);
		if (!sourceFile) {
			throw new Error(`Build did not emit ${target.types}.`);
		}

		const moduleExports = checker.getExportsOfModule(
			getModuleSymbol(checker, sourceFile),
		);

		for (const exportedSymbol of moduleExports) {
			const symbol = resolveAlias(checker, exportedSymbol);
			if (symbol.flags & VALUE_FLAGS) {
				const tuple = {
					subpath,
					kind: "value",
					symbol: exportedSymbol.name,
				} as const;
				tuples.set(tupleKey(tuple), tuple);
			}

			if (symbol.flags & TYPE_FLAGS) {
				const tuple = {
					subpath,
					kind: "type",
					symbol: exportedSymbol.name,
				} as const;
				tuples.set(tupleKey(tuple), tuple);
			}

			const namespaceMembers = checker.getExportsOfModule(symbol);
			for (const member of namespaceMembers) {
				const tuple = {
					subpath,
					kind: "namespace",
					symbol: `${exportedSymbol.name}.${member.name}`,
				} as const;
				tuples.set(tupleKey(tuple), tuple);
			}
		}
	}

	return sortTuples(tuples.values());
}

async function readDocumentedTuples(
	manifest: PackageManifest,
): Promise<{ tuples: ExportTuple[]; owners: Map<string, string> }> {
	const expectedOwners = new Map(
		Object.keys(manifest.exports).map((exportPath) => {
			const shortSubpath = exportPath.replace(/^\.\//, "");
			return [
				`${manifest.name}/${shortSubpath}`,
				`docs/reference/${shortSubpath}.mdx`,
			] as const;
		}),
	);
	const referenceFiles = (await readdir("docs/reference"))
		.filter((fileName) => fileName.endsWith(".mdx"))
		.map((fileName) => `docs/reference/${fileName}`)
		.sort();
	const expectedFiles = [...expectedOwners.values()].sort();
	if (referenceFiles.join("\n") !== expectedFiles.join("\n")) {
		throw new Error(
			`Reference owners do not match package exports.\nExpected:\n${expectedFiles.join("\n")}\nActual:\n${referenceFiles.join("\n")}`,
		);
	}

	const docsGlob = new Bun.Glob("docs/**/*.{md,mdx}");
	const tuples: ExportTuple[] = [];
	const owners = new Map<string, string>();

	for await (const path of docsGlob.scan({ onlyFiles: true })) {
		const content = await Bun.file(path).text();
		for (const line of content.split(/\r?\n/)) {
			if (!line.includes("docs:export")) continue;
			const marker = line.trim();
			const match = marker.match(EXACT_MARKER_PATTERN);
			if (!match) {
				throw new Error(`Malformed docs:export marker in ${path}: ${marker}`);
			}

			const [, subpath, kind, symbol] = match;
			if (!subpath || !kind || !symbol) {
				throw new Error(`Incomplete docs:export marker in ${path}: ${marker}`);
			}
			const expectedOwner = expectedOwners.get(subpath);
			if (!expectedOwner) {
				throw new Error(`Unknown export subpath ${subpath} in ${path}.`);
			}
			if (path !== expectedOwner) {
				throw new Error(
					`${subpath} export marker belongs in ${expectedOwner}, not ${path}.`,
				);
			}

			const tuple = { subpath, kind: kind as ExportKind, symbol };
			const key = tupleKey(tuple);
			const previousOwner = owners.get(key);
			if (previousOwner) {
				throw new Error(
					`Duplicate export marker for ${subpath} ${kind} ${symbol} in ${previousOwner} and ${path}.`,
				);
			}
			owners.set(key, path);
			tuples.push(tuple);
		}
	}

	return { tuples: sortTuples(tuples), owners };
}

function compareTuples(
	expected: ExportTuple[],
	documented: ExportTuple[],
): void {
	const expectedKeys = new Set(expected.map(tupleKey));
	const documentedKeys = new Set(documented.map(tupleKey));
	const missing = expected.filter(
		(tuple) => !documentedKeys.has(tupleKey(tuple)),
	);
	const unexpected = documented.filter(
		(tuple) => !expectedKeys.has(tupleKey(tuple)),
	);

	if (missing.length === 0 && unexpected.length === 0) return;

	const format = (tuple: ExportTuple) =>
		`${tuple.subpath} ${tuple.kind} ${tuple.symbol}`;
	throw new Error(
		[
			missing.length > 0
				? `Missing export markers:\n${missing.map(format).join("\n")}`
				: "",
			unexpected.length > 0
				? `Unexpected export markers:\n${unexpected.map(format).join("\n")}`
				: "",
		]
			.filter(Boolean)
			.join("\n\n"),
	);
}

const manifest = (await Bun.file("package.json").json()) as PackageManifest;
const expected = deriveExpectedTuples(manifest);
const documented = await readDocumentedTuples(manifest);
compareTuples(expected, documented.tuples);

const ownerCount = new Set(documented.owners.values()).size;
console.log(
	`docs export coverage passed: ${expected.length} tuples across ${ownerCount} reference owners`,
);
