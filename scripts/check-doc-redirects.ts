import { resolve } from "node:path";

const DOCS_ROOT = resolve(import.meta.dir, "../docs");
const RETIRED_ROUTES = [
	"/getting-started/installation",
	"/getting-started/quick-start",
	"/migration/from-try-catch",
	"/core/result-pattern",
	"/core/error-system",
	"/core/brand-types",
	"/patterns/optional-keys",
	"/patterns/real-world",
	"/patterns/service-layer",
	"/integrations/testing",
	"/integrations/hono-serialization",
	"/philosophy/err-null-is-ok-null",
	"/philosophy/error-api-evolution",
	"/philosophy/rust-inspiration",
	"/philosophy/why-name-and-message",
	"/philosophy/brand-implementation",
	"/philosophy/for-the-pragmatic-fp-developer",
	"/philosophy/from-effect-to-pragmatic-errors",
	"/philosophy/production-reliability",
	"/philosophy/developer-experience",
	"/philosophy/design-principles",
] as const;

type Redirect = {
	source: string;
	destination: string;
	permanent: boolean;
};

function isRedirect(value: unknown): value is Redirect {
	return (
		typeof value === "object" &&
		value !== null &&
		"source" in value &&
		typeof value.source === "string" &&
		"destination" in value &&
		typeof value.destination === "string" &&
		"permanent" in value &&
		typeof value.permanent === "boolean"
	);
}

async function main(): Promise<void> {
	const config: unknown = await Bun.file(
		resolve(DOCS_ROOT, "docs.json"),
	).json();
	if (
		typeof config !== "object" ||
		config === null ||
		!("redirects" in config) ||
		!Array.isArray(config.redirects) ||
		!config.redirects.every(isRedirect)
	) {
		throw new Error(
			"docs.json must define explicit permanent redirect objects",
		);
	}

	const redirects = new Map<string, string>();
	for (const { source, destination, permanent } of config.redirects) {
		if (
			!/^\/[\w/-]+$/.test(source) ||
			!/^\/[\w/-]+$/.test(destination) ||
			!permanent
		) {
			throw new Error(
				`Redirect must use local page routes and be permanent: ${source}`,
			);
		}
		if (redirects.has(source)) {
			throw new Error(`Duplicate redirect source: ${source}`);
		}
		if (source === destination) {
			throw new Error(`Self-redirect: ${source}`);
		}
		redirects.set(source, destination);
	}

	for (const source of RETIRED_ROUTES) {
		if (!redirects.has(source)) {
			throw new Error(
				`Retired documentation route lacks a redirect: ${source}`,
			);
		}
	}

	for (const [source, destination] of redirects) {
		const visited = new Set([source]);
		let current = destination;
		while (redirects.has(current)) {
			if (visited.has(current)) {
				throw new Error(`Redirect cycle starting at ${source}`);
			}
			visited.add(current);
			current = redirects.get(current) ?? current;
		}
		const path = resolve(DOCS_ROOT, current.slice(1));
		if (
			!(await Bun.file(`${path}.mdx`).exists()) &&
			!(await Bun.file(`${path}.md`).exists())
		) {
			throw new Error(
				`Redirect destination is missing: ${source} -> ${current}`,
			);
		}
		if (current !== destination) {
			throw new Error(
				`Redirect should point directly to its final owner: ${source}`,
			);
		}
	}

	console.log(
		`documentation redirects: ${redirects.size} permanent routes checked; all ${RETIRED_ROUTES.length} retired routes covered`,
	);
}

await main();
