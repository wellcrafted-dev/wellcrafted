import { readdir, stat } from "node:fs/promises";
import { extname, posix, resolve, sep } from "node:path";

type ClaimRuleName =
	| "conflicting-setup"
	| "npm-contributor-command"
	| "reliability-claim"
	| "retired-api"
	| "serialization-absolute"
	| "serialization-type-enforcement"
	| "unsafe-result-check"
	| "unsupported-metric"
	| "unsupported-root-import"
	| "uppercase-brand";

type ClaimRule = {
	message: string;
	name: ClaimRuleName;
	patterns: readonly RegExp[];
	shouldReport?: (context: {
		line: string;
		match: RegExpExecArray;
		path: string;
	}) => boolean;
};

type Allowance = {
	endLine: number;
	reason: string;
	rule: ClaimRuleName;
	startLine: number;
	uses: number;
};

export type Finding = {
	line: number;
	message: string;
	path: string;
	rule: ClaimRuleName | "gate-config";
};

const REPOSITORY_ROOT = resolve(import.meta.dir, "..");

const PUBLIC_CLAIM_ROOTS = [
	"README.md",
	"CONTRIBUTING.md",
	"docs",
	"examples",
	"skills",
] as const;

const CLAIM_ALLOWANCE_PATTERN =
	/<!-- docs:claims:allow-(start|end) rule="([^"]+)"(?: reason="([^"]+)")? -->/g;
const DECISION_ALLOWABLE_CLAIM_RULES = new Set<ClaimRuleName>(["retired-api"]);

const DOC_EXTENSIONS = new Set([".json", ".md", ".mdx"]);
const EXAMPLE_EXTENSIONS = new Set([
	".cjs",
	".js",
	".jsx",
	".md",
	".mdx",
	".mjs",
	".ts",
	".tsx",
]);
const SKILL_EXTENSIONS = new Set([".md", ".mdx"]);

const SERIALIZATION_NEGATION_PATTERN =
	/\b(?:are not|aren't|cannot|can't|do not|does not|doesn't|is not|isn't|must not|never|no|not|should not|without|won't|will not)\b/i;
const UNSAFE_CHECK_QUALIFICATION_PATTERN =
	/\b(?:avoid|do not use|don't use|misclassif|not a universal|not the general|safe only|unsafe|works only|works for object)\b/i;

const RESULT_ERROR_EXPRESSION = String.raw`(?:[A-Za-z_$][\w$]*\.)*error`;
const UNSAFE_RESULT_PATTERNS = [
	new RegExp(
		String.raw`\b(?:if|while)\s*\(\s*(?:!\s*)?${RESULT_ERROR_EXPRESSION}\s*\)`,
		"g",
	),
	new RegExp(String.raw`\bBoolean\s*\(\s*${RESULT_ERROR_EXPRESSION}\s*\)`, "g"),
	new RegExp(String.raw`!!\s*${RESULT_ERROR_EXPRESSION}\b`, "g"),
	new RegExp(
		String.raw`${RESULT_ERROR_EXPRESSION}\s*(?:\?(?!\.)|&&|\|\|)`,
		"g",
	),
] as const;

function hasSerializationNegation(
	line: string,
	matchIndex: number,
	matchLength: number,
): boolean {
	const prefix = line.slice(0, matchIndex);
	const punctuationIndex = Math.max(
		prefix.lastIndexOf("."),
		prefix.lastIndexOf(";"),
		prefix.lastIndexOf(":"),
		prefix.lastIndexOf("!"),
		prefix.lastIndexOf("?"),
	);
	return SERIALIZATION_NEGATION_PATTERN.test(
		line.slice(
			Math.max(punctuationIndex + 1, matchIndex - 120),
			Math.min(line.length, matchIndex + matchLength),
		),
	);
}

const CLAIM_RULES: readonly ClaimRule[] = [
	{
		name: "retired-api",
		message: "Current guidance uses a retired API name.",
		patterns: [
			/\b(?:createTaggedError(?:Group|s)?|mutationOptions|queryOptions)\s*\(/,
			/import\s*\{[^}]*\b(?:createTaggedError(?:Group|s)?|mutationOptions|queryOptions)\b/,
			/`(?:createTaggedError(?:Group|s)?|mutationOptions|queryOptions)`/,
			/\.execute\s*\(/,
		],
		shouldReport: ({ line, match }) =>
			!match[0].startsWith(".execute") ||
			!hasSerializationNegation(line, match.index, match[0].length),
	},
	{
		name: "unsupported-root-import",
		message: 'The package has no supported root import from "wellcrafted".',
		patterns: [
			/\bfrom\s+["']wellcrafted["']/,
			/\bimport\s*\(\s*["']wellcrafted["']\s*\)/,
			/\brequire\s*\(\s*["']wellcrafted["']\s*\)/,
		],
	},
	{
		name: "conflicting-setup",
		message: "Current guidance contains an unsupported or conflicting setup.",
		patterns: [
			/\bTypeScript\s+4(?:\.\d+){0,2}\b/i,
			/\bbun\s+run\s+dev\b/i,
			/\bmoduleResolution\b[^\n]*(?:["']node["']|\bnode\b)/i,
		],
		shouldReport: ({ line, match }) => {
			if (/moduleResolution/i.test(match[0]) && /NodeNext/i.test(line)) {
				return false;
			}
			return true;
		},
	},
	{
		name: "npm-contributor-command",
		message: "Repository contributor commands must use Bun.",
		patterns: [/\bnpm\s+(?:ci|install|run|test)\b/i, /\bnpx\s+changeset\b/i],
		shouldReport: ({ path }) => path === "CONTRIBUTING.md",
	},
	{
		name: "serialization-absolute",
		message: "Serialization claims must be conditional on the complete value.",
		patterns: [
			/\b(?:serialize|serializes|serialized)\s+(?:cleanly|exactly|intact|perfectly)\b/i,
			/\b(?:lossless|perfect)\s+(?:JSON\s+)?(?:round[- ]trip|serialization)\b/i,
			/\bround[- ]trips?\s+(?:exactly|intact|losslessly|perfectly)\b/i,
			/\bsurvives?\s+(?:all|any|every)\s+serialization\b/i,
			/\balways\s+survives?\s+(?:JSON\s+)?serialization\b/i,
			/\bpreserves?\s+(?:the\s+)?full\s+(?:error\s+)?chain\b/i,
		],
		shouldReport: ({ line, match }) =>
			!hasSerializationNegation(line, match.index, match[0].length),
	},
	{
		name: "serialization-type-enforcement",
		message: "The current types do not enforce JSON-compatible error fields.",
		patterns: [
			/\bdefineErrors\b.{0,100}\b(?:enforces?|guarantees?|requires?|rejects?|type-enforces?)\b.{0,80}\bJSON/i,
			/\b(?:error\s+)?fields?\s+must\s+be\s+JSON[- ]serializable\b/i,
			/\bJSON[- ](?:safe|serializable)\s+fields?\s+(?:are|is)\s+(?:enforced|required)\b/i,
		],
		shouldReport: ({ line, match }) =>
			!hasSerializationNegation(line, match.index, match[0].length),
	},
	{
		name: "unsupported-metric",
		message:
			"Public documentation must not publish unsupported vanity metrics.",
		patterns: [
			/\b\d[\d,]*(?:\.\d+)?\s+(?:tracked\s+)?(?:call sites?|importers?|importing files?|lines? of (?:production )?code)\b/i,
			/\b\d[\d,]*(?:\.\d+)?\s+(?:active\s+|tracked\s+)?consumers?\b/i,
			/\b\d[\d,]*\s+(?:files?\s+)?import(?:s|ed|ing)?\s+wellcrafted\b/i,
			/\b\d[\d,]*\s+(?:production\s+)?(?:TypeScript\s+)?lines?\b/i,
			/\b(?:bundle|library|package)\b.{0,60}(?:<|under|only)?\s*\d+(?:\.\d+)?\s*kB\b/i,
			/\b\d+(?:\.\d+)?\s*kB\b.{0,60}\b(?:bundle|library|package)\b/i,
			/\b\d+(?:\.\d+)?%\b.{0,60}\b(?:faster|reduction|smaller|sharing)\b/i,
			/\b(?:hours?\s+to\s+minutes?|thousands? of hours?)\b/i,
		],
	},
	{
		name: "reliability-claim",
		message:
			"Public documentation must not make unsupported reliability claims.",
		patterns: [
			/\b(?:battle[- ]tested|production[- ]tested|proven in production)\b/i,
			/\bzero\s+(?:runtime\s+)?(?:crashes|unhandled exceptions)\b/i,
			/\bnever\s+crashes?\b/i,
			/\bno\s+(?:hidden failures|surprise exceptions)\b/i,
			/\b\d{1,3}(?:\.\d+)?%\s+(?:uptime|availability)\b/i,
		],
	},
	{
		name: "uppercase-brand",
		message: "Use lowercase wellcrafted in current public prose.",
		patterns: [/\bWellCrafted\b/],
	},
	{
		name: "unsafe-result-check",
		message:
			"Use an exact Result check unless truthy object errors are explicit.",
		patterns: [],
	},
] as const;

const KNOWN_CLAIM_RULES = new Set<ClaimRuleName>(
	CLAIM_RULES.map((rule) => rule.name),
);

function toRepositoryPath(path: string): string {
	return path.split(sep).join(posix.sep);
}

function includePublicFile(root: string, path: string): boolean {
	const extension = extname(path);
	switch (root) {
		case "docs":
			return DOC_EXTENSIONS.has(extension);
		case "examples":
			return EXAMPLE_EXTENSIONS.has(extension);
		case "skills":
			return SKILL_EXTENSIONS.has(extension);
		default:
			return path === root;
	}
}

async function collectFiles(root: string): Promise<string[]> {
	const absoluteRoot = resolve(REPOSITORY_ROOT, root);
	const rootStats = await stat(absoluteRoot);
	if (rootStats.isFile()) return [root];

	const files: string[] = [];
	const entries = await readdir(absoluteRoot, { withFileTypes: true });
	for (const entry of entries) {
		const child = posix.join(root, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await collectFiles(child)));
			continue;
		}
		if (entry.isFile()) files.push(child);
	}
	return files;
}

function parseAllowances(
	path: string,
	lines: readonly string[],
	findings: Finding[],
): Allowance[] {
	const allowances: Allowance[] = [];
	let active:
		| { reason: string; rule: ClaimRuleName; startLine: number }
		| undefined;

	for (const [index, line] of lines.entries()) {
		const lineNumber = index + 1;
		const matches = [
			...line.matchAll(new RegExp(CLAIM_ALLOWANCE_PATTERN.source, "g")),
		];
		if (matches.length === 0) {
			if (line.includes("docs:claims:allow-")) {
				findings.push({
					line: lineNumber,
					message: "Malformed claims allowance marker.",
					path,
					rule: "gate-config",
				});
			}
			continue;
		}
		if (matches.length !== 1 || line.trim() !== matches[0]?.[0]) {
			findings.push({
				line: lineNumber,
				message: "A claims allowance marker must occupy its own line.",
				path,
				rule: "gate-config",
			});
			continue;
		}

		const [, direction, rawRule, rawReason] = matches[0];
		if (!KNOWN_CLAIM_RULES.has(rawRule as ClaimRuleName)) {
			findings.push({
				line: lineNumber,
				message: `Unknown claims allowance rule: ${rawRule}`,
				path,
				rule: "gate-config",
			});
			continue;
		}
		const rule = rawRule as ClaimRuleName;

		if (!/^docs\/decisions\/[^/]+\.mdx$/.test(path)) {
			findings.push({
				line: lineNumber,
				message: "Claims allowances are permitted only in decision pages.",
				path,
				rule: "gate-config",
			});
			continue;
		}
		if (!DECISION_ALLOWABLE_CLAIM_RULES.has(rule)) {
			findings.push({
				line: lineNumber,
				message: `Rule ${rule} cannot be allowed; only decision-scoped retired API history is eligible.`,
				path,
				rule: "gate-config",
			});
			continue;
		}

		if (direction === "start") {
			const reason = rawReason?.trim() ?? "";
			if (reason.length === 0) {
				findings.push({
					line: lineNumber,
					message: "A claims allowance start marker requires a reason.",
					path,
					rule: "gate-config",
				});
				continue;
			}
			if (active !== undefined) {
				findings.push({
					line: lineNumber,
					message: "Claims allowances cannot be nested.",
					path,
					rule: "gate-config",
				});
				continue;
			}
			active = { reason, rule, startLine: lineNumber };
			continue;
		}

		if (rawReason !== undefined) {
			findings.push({
				line: lineNumber,
				message: "A claims allowance end marker cannot include a reason.",
				path,
				rule: "gate-config",
			});
		}
		if (active === undefined) {
			findings.push({
				line: lineNumber,
				message: "Claims allowance end marker has no matching start.",
				path,
				rule: "gate-config",
			});
			continue;
		}
		if (active.rule !== rule) {
			findings.push({
				line: lineNumber,
				message: `Claims allowance closes ${rule}, but ${active.rule} is active.`,
				path,
				rule: "gate-config",
			});
			continue;
		}

		allowances.push({
			endLine: lineNumber,
			reason: active.reason,
			rule,
			startLine: active.startLine,
			uses: 0,
		});
		active = undefined;
	}

	if (active !== undefined) {
		findings.push({
			line: active.startLine,
			message: `Claims allowance for ${active.rule} is not closed.`,
			path,
			rule: "gate-config",
		});
	}

	return allowances;
}

function findAllowance(
	allowances: readonly Allowance[],
	rule: ClaimRuleName,
	line: number,
): Allowance | undefined {
	return allowances.find(
		(allowance) =>
			allowance.rule === rule &&
			line > allowance.startLine &&
			line < allowance.endLine,
	);
}

function lineAtOffset(content: string, offset: number): number {
	return content.slice(0, offset).split(/\r?\n/).length;
}

function localClaimContext(
	content: string,
	matchIndex: number,
	matchLength: number,
): string {
	const lineStart = content.lastIndexOf("\n", matchIndex - 1) + 1;
	const lineEnd = content.indexOf("\n", matchIndex + matchLength);
	return content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);
}

function collectRetiredApiMatches(
	content: string,
): Array<{ index: number; text: string }> {
	const matches: Array<{ index: number; text: string }> = [];
	const localNames = new Set<string>();
	const importPattern = /\bimport\s*\{([\s\S]*?)\}\s*from\s*["'][^"']+["']/g;
	const directCallPattern =
		/\b(?:createTaggedError(?:Group|s)?|mutationOptions|queryOptions)\s*\(/g;

	for (const callMatch of content.matchAll(directCallPattern)) {
		matches.push({ index: callMatch.index, text: callMatch[0] });
	}

	for (const importMatch of content.matchAll(importPattern)) {
		const specifiers = importMatch[1] ?? "";
		for (const specifier of specifiers.split(",")) {
			const retiredMatch = specifier
				.trim()
				.match(
					/^(createTaggedError(?:Group|s)?|mutationOptions|queryOptions)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/,
				);
			if (retiredMatch === null) continue;

			localNames.add(retiredMatch[2] ?? retiredMatch[1]);
			matches.push({
				index: importMatch.index,
				text: importMatch[0],
			});
		}
	}

	for (const localName of localNames) {
		const callPattern = new RegExp(
			String.raw`\b${localName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\s*\(`,
			"g",
		);
		for (const callMatch of content.matchAll(callPattern)) {
			matches.push({ index: callMatch.index, text: callMatch[0] });
		}
	}

	return matches;
}

function scanMultilineClaims(
	path: string,
	content: string,
	allowances: readonly Allowance[],
	findings: Finding[],
): void {
	const matchesByRule = [
		{
			matches: collectRetiredApiMatches(content),
			message: "Current guidance uses a retired API name.",
			rule: "retired-api" as const,
		},
		{
			matches: UNSAFE_RESULT_PATTERNS.flatMap((pattern) =>
				[...content.matchAll(pattern)].map((match) => ({
					index: match.index,
					text: match[0],
				})),
			),
			message:
				"Use an exact Result check unless truthy object errors are explicit.",
			rule: "unsafe-result-check" as const,
		},
	] as const;

	for (const entry of matchesByRule) {
		for (const match of entry.matches) {
			const line = lineAtOffset(content, match.index);
			if (
				entry.rule === "unsafe-result-check" &&
				UNSAFE_CHECK_QUALIFICATION_PATTERN.test(
					localClaimContext(content, match.index, match.text.length),
				)
			) {
				continue;
			}
			if (
				findings.some(
					(finding) =>
						finding.path === path &&
						finding.line === line &&
						finding.rule === entry.rule,
				)
			) {
				continue;
			}

			const allowance = findAllowance(allowances, entry.rule, line);
			if (allowance !== undefined) {
				allowance.uses += 1;
				continue;
			}
			findings.push({ line, message: entry.message, path, rule: entry.rule });
		}
	}
}

export function findClaimFindings(path: string, content: string): Finding[] {
	const findings: Finding[] = [];
	const lines = content.split(/\r?\n/);
	const allowances = parseAllowances(path, lines, findings);
	scanClaimLines(path, lines, allowances, findings);
	scanMultilineClaims(path, content, allowances, findings);
	validateAllowanceUses(path, allowances, findings);
	return findings;
}

function scanClaimLines(
	path: string,
	lines: readonly string[],
	allowances: readonly Allowance[],
	findings: Finding[],
): void {
	for (const [index, line] of lines.entries()) {
		const lineNumber = index + 1;
		if (line.includes("<!-- docs:claims:allow-")) continue;

		for (const rule of CLAIM_RULES) {
			for (const pattern of rule.patterns) {
				const match = pattern.exec(line);
				if (match === null) continue;
				if (
					rule.shouldReport !== undefined &&
					!rule.shouldReport({ line, match, path })
				) {
					continue;
				}

				const allowance = findAllowance(allowances, rule.name, lineNumber);
				if (allowance !== undefined) {
					allowance.uses += 1;
					continue;
				}

				findings.push({
					line: lineNumber,
					message: rule.message,
					path,
					rule: rule.name,
				});
				break;
			}
		}
	}
}

function validateAllowanceUses(
	path: string,
	allowances: readonly Allowance[],
	findings: Finding[],
): void {
	for (const allowance of allowances) {
		if (allowance.uses !== 0) continue;
		findings.push({
			line: allowance.startLine,
			message: `Claims allowance for ${allowance.rule} is unused (${allowance.reason}).`,
			path,
			rule: "gate-config",
		});
	}
}

async function scanFile(path: string, findings: Finding[]): Promise<void> {
	const content = await Bun.file(resolve(REPOSITORY_ROOT, path)).text();
	findings.push(...findClaimFindings(path, content));
}

async function main(): Promise<void> {
	const findings: Finding[] = [];
	const publicFiles = (
		await Promise.all(
			PUBLIC_CLAIM_ROOTS.map(async (root) => {
				const files = await collectFiles(root);
				return files.filter((path) => includePublicFile(root, path));
			}),
		)
	)
		.flat()
		.map(toRepositoryPath)
		.sort();

	for (const path of publicFiles) {
		await scanFile(path, findings);
	}

	if (findings.length > 0) {
		for (const finding of findings) {
			console.error(
				`${finding.path}:${finding.line} [${finding.rule}] ${finding.message}`,
			);
		}
		throw new Error(
			`Documentation claims gate found ${findings.length} issue(s).`,
		);
	}

	console.log(`documentation claims: ${publicFiles.length} files checked`);
}

if (import.meta.main) await main();
