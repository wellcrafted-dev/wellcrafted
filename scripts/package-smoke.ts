import { cp, mkdtemp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const REPOSITORY_ROOT = resolve(import.meta.dir, "..");
const FIXTURE_ROOT = join(import.meta.dir, "fixtures", "package-consumer");
const RUNTIME_FIXTURE = join(
	import.meta.dir,
	"fixtures",
	"runtime",
	"all-subpaths.mjs",
);
const TSC = join(REPOSITORY_ROOT, "node_modules", "typescript", "bin", "tsc");
const TANSTACK_QUERY_VERSION = "5.82.0";

type CommandResult = {
	exitCode: number;
	stderr: string;
	stdout: string;
};

async function run(
	command: string[],
	{ cwd = REPOSITORY_ROOT }: { cwd?: string } = {},
): Promise<CommandResult> {
	const process = Bun.spawn(command, { cwd, stderr: "pipe", stdout: "pipe" });
	const [exitCode, stderr, stdout] = await Promise.all([
		process.exited,
		new Response(process.stderr).text(),
		new Response(process.stdout).text(),
	]);
	return { exitCode, stderr, stdout };
}

function assertPassed(result: CommandResult, label: string): void {
	if (result.exitCode === 0) return;
	throw new Error(
		`${label} failed with exit code ${result.exitCode}.\n${result.stdout}${result.stderr}`,
	);
}

async function writeTsconfig({
	consumerRoot,
	file,
	moduleResolution,
	name,
}: {
	consumerRoot: string;
	file: string;
	moduleResolution: "Bundler" | "NodeNext";
	name: string;
}): Promise<string> {
	const path = join(consumerRoot, `tsconfig.${name}.json`);
	await writeFile(
		path,
		`${JSON.stringify(
			{
				compilerOptions: {
					lib: ["ESNext", "DOM"],
					module: moduleResolution === "Bundler" ? "ESNext" : "NodeNext",
					moduleResolution,
					noEmit: true,
					skipLibCheck: false,
					strict: true,
					target: "ES2024",
					types: [],
					verbatimModuleSyntax: true,
				},
				files: [file],
			},
			null,
			2,
		)}\n`,
	);
	return path;
}

async function typecheck(
	consumerRoot: string,
	configPath: string,
): Promise<CommandResult> {
	return run(["bun", TSC, "--project", configPath], { cwd: consumerRoot });
}

async function main(): Promise<void> {
	const temporaryRoot = await mkdtemp(
		join(tmpdir(), "wellcrafted-package-smoke-"),
	);
	const consumerRoot = join(temporaryRoot, "consumer");

	try {
		await mkdir(consumerRoot);
		assertPassed(
			await run([
				"bun",
				"pm",
				"pack",
				"--destination",
				temporaryRoot,
				"--ignore-scripts",
			]),
			"bun pm pack",
		);
		const packedFiles = await readdir(temporaryRoot);
		const tarballName = packedFiles.find((file) => file.endsWith(".tgz"));
		if (tarballName === undefined) {
			throw new Error("bun pm pack completed without creating a tarball");
		}
		const tarball = join(temporaryRoot, tarballName);

		await writeFile(
			join(consumerRoot, "package.json"),
			'{"name":"wellcrafted-package-smoke","private":true,"type":"module"}\n',
		);
		await cp(FIXTURE_ROOT, consumerRoot, { recursive: true });
		await cp(RUNTIME_FIXTURE, join(consumerRoot, "runtime.mjs"));

		assertPassed(
			await run(["bun", "add", "--exact", tarball], { cwd: consumerRoot }),
			"installing the packed package",
		);

		for (const moduleResolution of ["Bundler", "NodeNext"] as const) {
			const config = await writeTsconfig({
				consumerRoot,
				file: "non-query-subpaths.ts",
				moduleResolution,
				name: `non-query-${moduleResolution.toLowerCase()}`,
			});
			assertPassed(
				await typecheck(consumerRoot, config),
				`${moduleResolution} non-query consumer typecheck`,
			);
		}

		const missingDependencyConfig = await writeTsconfig({
			consumerRoot,
			file: "query-prerequisite.ts",
			moduleResolution: "NodeNext",
			name: "query-without-tanstack",
		});
		const missingDependency = await typecheck(
			consumerRoot,
			missingDependencyConfig,
		);
		const missingDependencyOutput =
			missingDependency.stdout + missingDependency.stderr;
		if (
			missingDependency.exitCode === 0 ||
			!missingDependencyOutput.includes(
				"Cannot find module '@tanstack/query-core'",
			)
		) {
			throw new Error(
				`wellcrafted/query unexpectedly typechecked without @tanstack/query-core.\n${missingDependencyOutput}`,
			);
		}

		assertPassed(
			await run(
				[
					"bun",
					"add",
					"--dev",
					"--exact",
					`@tanstack/query-core@${TANSTACK_QUERY_VERSION}`,
				],
				{ cwd: consumerRoot },
			),
			"installing the explicit TanStack Query prerequisite",
		);

		for (const moduleResolution of ["Bundler", "NodeNext"] as const) {
			const config = await writeTsconfig({
				consumerRoot,
				file: "query.ts",
				moduleResolution,
				name: `query-${moduleResolution.toLowerCase()}`,
			});
			assertPassed(
				await typecheck(consumerRoot, config),
				`${moduleResolution} query consumer typecheck`,
			);
		}

		assertPassed(
			await run(["bun", "runtime.mjs"], { cwd: consumerRoot }),
			"packed-package runtime smoke",
		);

		console.log(
			"package smoke: tarball, nine subpaths, unsupported root, strict typechecks, and query prerequisite passed",
		);
	} finally {
		await rm(temporaryRoot, { force: true, recursive: true });
	}
}

await main();
