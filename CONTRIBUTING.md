# Contributing to wellcrafted

wellcrafted uses Bun for installation, scripts, tests, and release tooling. Consumer setup belongs in the [installation guide](docs/start/installation.mdx); this page covers work inside the repository.

## Set up the repository

CI currently uses Bun 1.3.1. Install dependencies from the lockfile:

```bash
bun install --frozen-lockfile
```

Use `bun install` when intentionally changing dependencies, and commit the resulting `bun.lock` update with the package change.

Mint requires Node.js 24 for local documentation commands. The library's tested runtime matrix is separate from this documentation-tool requirement.

## Run checks

Before opening a pull request, run the checks relevant to your change. The full local pass is:

```bash
bun run lint:check
bun run format:check
bun run typecheck
bun run build
bun test
bun run docs:examples
bun run package:smoke
bun run compat:types
bun run compat:runtime
```

`lint:check` and `format:check` do not write files. Use `bun run lint` and `bun run format` when you want Biome to apply fixes.

Run Mint under Node 24 when documentation changes:

```bash
bun run docs:validate
bun run docs:links
```

Preview the site with `bun run docs:dev`. The command runs the pinned Mint binary from `docs/`.

## Work on documentation

Runnable learning code belongs in `examples/`. Documentation can include or extract that code, but a check must catch drift from the canonical file. Keep partial snippets short and label them when surrounding application code is intentionally omitted.

Each public page should own one reader question:

- `docs/start/` gets a reader installed and through the first Result.
- `docs/guides/` owns task-oriented application workflows.
- `docs/reference/` owns exact current exports and signatures.
- `docs/integrations/` owns third-party boundary adaptation.
- `docs/decisions/` owns design rationale and tradeoffs.

Use lowercase `wellcrafted` in prose. Treat JSON serialization as a convention: `defineErrors` does not enforce JSON-compatible fields, and preserving a JSON shape is separate from runtime validation and end-to-end static typing.

## Add a changeset when behavior changes

Documentation-only changes do not need a changeset. Add one when a pull request changes the installed package's public API or runtime behavior:

```bash
bunx changeset
```

Write the summary for a package consumer. While wellcrafted remains on `0.x`, use a minor changeset for a breaking change rather than a major changeset; CI rejects a major bump because npm cannot reuse the unpublished `1.0.0` version.

Do not run the release script as part of a normal contribution. The release workflow consumes changesets after changes land on `main`.

## Open a focused pull request

Keep the pull request to one coherent change. Explain what changed, why it changed, and the tradeoffs a reviewer should check. Add focused tests for behavior changes and update canonical examples or documentation when a public contract changes.

List the validation commands you actually ran and call out anything you could not run. CI must pass before release automation can publish from `main`.
