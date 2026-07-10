# Greenfield Documentation Pass

**Date**: 2026-07-10
**Status**: In Progress
**Author**: Maintainer-approved specification
**Branch**: `codex/docs-greenfield-pass`

## Overview

Rebuild wellcrafted's documentation around one accurate product story, one runnable learning path, and one authoritative reference page for every published subpath. This pass changes documentation, examples, contributor guidance, validation, and distributable agent skills. It does not change public APIs, publish packages, deploy the site, push the branch, or open a pull request.

Wave 0 is approved and recorded in [Wave 0 Decisions](#wave-0-decisions). Deferred API and compatibility questions do not block the first content wave. Any change that would enforce JSON-safe error fields remains a separate API proposal and is not part of this documentation pass.

## Uncompromised Product Direction

### Product sentence

Approved product sentence:

> wellcrafted defines expected errors as plain, boundary-friendly data that can move through JSON, HTTP, workers, IPC, logs, and UI when every field is JSON-compatible. Its familiar `{ data, error }` Result shape makes that data ergonomic to return and handle in ordinary TypeScript.

The optional shorter front-door form remains:

> Typed failures without a new programming model.

The mechanism should follow immediately: named plain-object error variants, the `{ data, error }` Result shape, `async/await`, early returns, exact guards, and `switch`.

The serialization limitation belongs beside the lead, not in a footnote. `defineErrors` does not type-enforce JSON-compatible fields, and arbitrary fields do not serialize perfectly. The promise applies when the complete error value contains JSON-compatible data. Runtime validation and end-to-end static typing are separate boundary concerns.

### Product category

The approved category is an error-handling library with a small supporting toolkit. It is not a general TypeScript utility collection whose modules happen to include errors.

The evidence is asymmetric. At Epicenter commit `4d438c0`, 244 tracked TypeScript, JavaScript, and Svelte files import wellcrafted. Of those, 176 import `wellcrafted/result`, `wellcrafted/error`, or both. The other entry points reinforce the same application contract through logging, tests, framework adapters, JSON parsing, branded domain values, and lifecycle helpers. These counts are internal research evidence only; they must not appear in public documentation.

Approved narrative roles are below. These describe documentation prominence, not compatibility stability:

| Narrative role | Subpaths | Documentation treatment |
| --- | --- | --- |
| Product-defining | `result`, `error` | README, start path, guides, and complete reference |
| Established extensions of the contract | `logger`, `query`, `testing`, `json` | Integration or guide coverage plus complete reference |
| Supporting utilities | `brand`, `function` | Concise guide where justified plus complete reference |
| Published integration, not product-defining | `standard-schema` | Complete reference and a focused integration recipe |

Every published subpath gets a reference page even when it is not product-defining.

### Audience and jobs to be done

Primary audience: TypeScript application authors. The start path should assume TypeScript familiarity while teaching wellcrafted's Result and error vocabulary from first principles.

Secondary audiences are library authors exposing typed service contracts and framework users adapting those contracts to TanStack Query, Hono, validators, tests, or UI reporting.

The documentation must help a reader:

1. Name the expected ways an operation can fail.
2. Convert a throwing I/O boundary into a typed value without wrapping unrelated code.
3. Propagate, recover from, or branch on a failure with ordinary control flow.
4. Carry the same error vocabulary into HTTP responses, logs, tests, and UI.
5. Adapt a Result where a framework requires a thrown error.
6. Represent legitimate absence as `Ok(null)` and understand that the shape is unambiguous only under a non-null-error convention.
7. Decide when manual Result propagation is too small a tool and an effect system is warranted.

Effect is an honest boundary and escape hatch, not the lead competitor. Boundary-friendly error data is the lead promise, qualified immediately: serialization remains a convention and depends on every field being JSON-compatible.

## Motivation

### Current state

PR #133 was valuable corrective subtraction. It merged 22 commits, added 515 lines, deleted 4,541 lines, removed two redundant root guides and eight site pages, rewrote the README around real usage, and corrected several API and exhaustiveness claims.

It did not establish a durable ownership model. Current guidance is still spread across:

| Surface | Current scale | Current role |
| --- | ---: | --- |
| `README.md` | 282 lines | Best narrative, install, examples, tradeoffs, comparison, partial API glance, skills |
| `docs/` | 8,985 lines, 24 pages | Tutorials, reference fragments, recipes, decisions, marketing, and history |
| `src/*README.md` | 1,285 lines | Duplicate public tutorials and one current query guide |
| `skills/` | 1,259 lines | Agent guidance with duplicated claims and incomplete newer APIs |
| `specs/` | 5,438 lines | Active-looking historical plans, launch copy, and superseded designs |
| `CHANGELOG.md` | 1,222 lines | Release history, its correct role |
| `CONTRIBUTING.md` | absent | No contributor front door |
| `examples/` | absent | No runnable learning path |

The repository contains roughly 402 TypeScript or JavaScript-like documentation fences. None are compiled as documentation examples.

### Problems

1. **A newcomer cannot run the first example.** The README and quick start depend on undefined values or application helpers. There is no canonical executable example.
2. **Public reference coverage is incomplete.** Six subpaths lack dedicated reference pages, and the pages that resemble reference also mix tutorial and rationale.
3. **Individual corrections drift because facts have multiple owners.** The serializability convention was fixed in one philosophy page while source READMEs, core docs, integrations, and skills kept absolute claims.
4. **Installation and contributor guidance are false.** The site describes an unsupported root import, conflicts on TypeScript versions, recommends legacy module resolution, uses npm for a Bun-only repository, and calls a nonexistent `dev` script.
5. **Current APIs are missing from public guidance.** The v0.44 query adapters and `defineKeys` are absent from the site. Official test helpers are absent from the testing guide.
6. **Claims outrun evidence.** Bundle size, competitor size, production reliability, performance, and serialization claims have no committed method that can reproduce them.
7. **Documentation checks do not protect the repository.** Existing Mintlify scripts run from the wrong directory, docs checks are absent from CI, examples are not compiled, and export coverage is not enforced.

### Desired state

A first-time reader can answer all of these without consulting source, changelog, or historical specs:

- What is wellcrafted?
- Why would I use it instead of `try/catch` alone?
- What does it cost in control flow and capability?
- How do I install it and run one working example?
- How do `defineErrors`, `Result`, `trySync`, and `tryAsync` compose?
- What happens at serialization and framework boundaries?
- Where is the complete current API for each published subpath?

## Evidence Read

### Release and public surface

- `HEAD`, `origin/main`, npm `latest`, and tag `v0.44.0` resolve to the 0.44.0 release. The branch starts from commit `ea58b21`.
- `package.json`, `tsdown.config.ts`, source entry points, emitted declarations, tests, changelog, npm metadata, and the published tarball agree on nine ESM subpaths.
- The npm package has no root `"."` export. Root imports are unsupported. Node ESM reports `ERR_PACKAGE_PATH_NOT_EXPORTED`; Bun 1.3.1 reports `ERR_MODULE_NOT_FOUND`.
- The published surface has 33 runtime export slots and 27 type export slots. Coverage is keyed by `(subpath, export kind, symbol)`: collapsing type/value pairs within each subpath yields 57 subpath-scoped identifiers, while collapsing repeated spellings across all subpaths yields 53 global names.
- The published tarball has 51 files, 67.3 kB packed, and 245.7 kB unpacked. These numbers describe the package archive, not application bundle cost.
- The package declares no runtime dependencies, peer dependencies, engines, or compatibility matrix.

Authoritative entry points:

- `src/result/index.ts`
- `src/error/index.ts`
- `src/logger/index.ts`
- `src/json.ts`
- `src/brand.ts`
- `src/function.ts`
- `src/query/index.ts`
- `src/standard-schema/index.ts`
- `src/testing.ts`

### Real consumers

Epicenter usage was inspected at commit `4d438c0`, including these representative files:

- `packages/client/src/transcribe.ts`: narrow throwing boundaries, named service errors, manual propagation.
- `packages/workspace/src/shared/actions.ts`: Results as a boundary protocol and the bare-tagged-error footgun.
- `packages/workspace/src/document/table.ts`: `Ok(null)`, classified domain errors, partial success, and exhaustive branching.
- `packages/workspace/src/document/sqlite-writer.ts`: named recoverable failures sent to the logger instead of propagated.
- `packages/server/src/routes/blob-errors.ts`: Result envelopes and typed error fields at an HTTP boundary.
- `packages/ui/src/sonner/toast-on-error.ts`: tagged errors flowing into UI copy without losing the original value.
- `apps/whispering/src/lib/report/index.ts`: one error vocabulary feeding logs, toast, OS notification, and details UI.
- `packages/app-shell/src/account-popover/account-popover.svelte`: current `resultQueryOptions` and `resultMutationOptions` usage.
- `docs/articles/ok-null-is-fine-err-null-is-a-lie.md`: the Result shape's central invariant and limit.
- `docs/articles/wrap-only-what-throws.md`: the clearest explanation of surgical failure boundaries.

Import evidence:

| Subpath | Epicenter files |
| --- | ---: |
| `result` | 135 |
| `error` | 109 |
| `logger` | 33 |
| `brand` | 24 |
| `testing` | 17 |
| `query` | 16 |
| `json` | 13 |
| `function` | 6 |
| `standard-schema` | 0 |

The root Epicenter catalog and lock resolve wellcrafted 0.44.0. Its physical `node_modules` was still cached at 0.43.0 during research, so Epicenter verification must run `bun install` before its typecheck can be treated as evidence for the renamed query adapters.

### Documentation history and current site

- PR #133's strongest retained decisions are the README's `try/catch` opening, real service shape, manual propagation cost, explicit `never` guard, and Effect escape hatch.
- PR #133 correctly deleted large duplicate guides and several orphaned pages. This pass must preserve that subtraction instead of recreating a second encyclopedia.
- Two current site pages are not in navigation: `for-the-pragmatic-fp-developer` and `from-effect-to-pragmatic-errors`. They overlap each other and the README tradeoff.
- The site has no missing configured navigation targets, but valid links do not imply correct examples or complete API coverage.

### Baseline verification

Observed on 2026-07-10 at the 0.44.0 baseline:

- `bun test`: 158 tests passed, 0 failed.
- `bun run typecheck`: passed.
- `bun run build`: passed.
- Unpinned `bunx mint` resolved Mint 4.2.684. `bun run docs:validate` under Node 26.3.1 failed because Mint rejects Node 25 and newer.
- The same unpinned root script under bundled Node 24.14.0 reported that it must run where `docs.json` exists. The package script runs from the wrong directory.
- `mint validate` from `docs/` under Node 24.14.0 reached the site and failed on the unsupported `@mintlify/components` import in `docs/index.mdx`.
- `mint broken-links` from `docs/` under Node 24.14.0 passed.
- `https://bundlephobia.com/api/size?package=wellcrafted@0.44.0` returned an HTTP 500 build error. The current badge and comparison table do not provide a working proof path.

These Mint and Bundlephobia results are dated observations from mutable external tools, not permanent repository proofs. The implementation must pin local tooling before treating them as a baseline.

## Public Surface Map

The reference must cover these current exports without inventing a stability promise.

| Subpath | Runtime exports | Type exports |
| --- | --- | --- |
| `result` | `Ok`, `Err`, `isResult`, `isOk`, `isErr`, `trySync`, `tryAsync`, `unwrap`, `resolve`, `tapErr`, `partitionResults` | `Ok`, `Err`, `Result`, `UnwrapOk`, `UnwrapErr` |
| `error` | `defineErrors`, `extractErrorMessage` | `AnyTaggedError`, `ErrorBody`, `ErrorsConfig`, `ValidatedConfig`, `DefineErrorsReturn`, `InferError`, `InferErrors` |
| `logger` | `consoleSink`, `createLogger`, `memorySink`, `composeSinks`, `tapErr` | `LogEvent`, `LogLevel`, `LogSink`, `Logger`, `LoggableError` |
| `json` | `JsonParseError`, `parseJson` | `JsonValue`, `JsonObject`, `JsonParseError` |
| `brand` | none | `Brand` |
| `function` | `once` | none |
| `query` | `createQueryFactories`, `defineKeys`, `resultMutationOptions`, `resultQueryOptions` | no named aliases |
| `standard-schema` | `ErrSchema`, `FAILURES`, `OkSchema`, `ResultSchema`, `hasJsonSchema`, `hasValidate` | `Err`, `Ok`, `Result`, `StandardJSONSchemaV1`, `StandardSchemaV1`, `StandardTypedV1` |
| `testing` | `expectErr`, `expectOk` | none |

`defineQuery` and `defineMutation` are returned by `createQueryFactories`; they are not importable top-level exports. Query definitions have these exact shapes:

- Query: `{ options, fetch(), ensure() }`; it is not callable.
- Mutation: callable with variables and has `.options`; there is no `.execute()`.
- `resultQueryOptions` and `resultMutationOptions`: client-agnostic adapters for hook-local or reactive options.
- `defineKeys`: static entries preserve literal readonly tuples. Factory entries without `as const` preserve tuple shape but widen literal positions; add `as const` when the literal positions matter.

Some published types look like implementation machinery, notably `ErrorBody`, `ErrorsConfig`, `ValidatedConfig`, `DefineErrorsReturn`, and `FAILURES`. This documentation pass must document what is exported today and separately report whether those names should be removed in a future API change. It must not silently change exports.

## Documentation Ownership

### Current concept ownership inventory

| Concept | Current competing homes | Drift already observed |
| --- | --- | --- |
| Product promise and audience | `README.md`, `docs/index.mdx`, `design-principles`, two Effect essays, package description | Error library versus general toolkit; lowercase versus title-case brand; unsupported claims |
| Installation and compatibility | README install, `getting-started/installation`, package metadata | Unsupported root import, TypeScript 5.0 versus 4.5, legacy module resolution, no tested runtime matrix |
| First working Result | README examples, quick start, Result core page, source README, result skill | No complete runnable example; generic truthiness checks hide falsy errors |
| Error definition | README, error core page, optional-keys, source error README, define-errors skill, evolution essays | Tagged body confused with `Err` wrapper; variant rules repeated |
| Serialization boundary | README, site index, error core, Hono, three philosophy pages, source error README, patterns skill | Convention described elsewhere as type-enforced or perfect |
| Service composition | README, quick start, real-world, service-layer, migration, patterns skill | Same manual propagation pattern copied with different error shapes |
| Query integration | README bullet, public integration, source query README, query skill, changelog | Public site and skill omit v0.44 adapters and `defineKeys` |
| Testing | README bullet, testing integration, source JSDoc/tests | Official helpers omitted; custom matcher rejects `Ok(null)` |
| Brand model | brand core, validation integration, brand decision, source JSDoc, brand skill | Tutorial, reference, validator recipe, and representation rationale mixed |
| Public export inventory | `package.json`, source barrels, emitted declarations, README glance, changelog | No complete reader-facing map and no automated coverage |
| Contributor workflow | installation page, `AGENTS.md`, `CHANGESET_GUIDE.md` | npm and nonexistent commands conflict with Bun policy |

### Source of fact versus reader-facing projection

Repository artifacts and public documentation have different roles; they are not two independent owners:

| Fact or content | Factual source | Reader-facing projection and drift rule |
| --- | --- | --- |
| Importable subpaths | `package.json#exports` and packed-package smoke tests | Reference index is mechanically checked against the manifest |
| Exact symbols and signatures | Source entry points, JSDoc, emitted declarations, and focused tests | Each reference page is checked by `(subpath, export kind, symbol)` coverage |
| Runtime edge cases | Implementation and focused tests | Reference explains them; a claim without a test is labeled convention or removed |
| Product sentence and audience | Maintainer decision recorded in this spec | README owns the full front-door wording; site index reuses only the sentence and links |
| First example code | `examples/quick-start.ts` | README and quick start include, extract, or mechanically compare with that file |
| Tradeoff | `docs/decisions/pragmatic-tradeoffs.mdx` | README carries a short summary and link, not a second rationale |
| Runnable code | `examples/` | Guides consume checked code and do not keep independent long copies |
| Task-oriented workflow | One page in `docs/guides/` | Reference and decisions link to it without retelling the workflow |
| Complete current API | One page per subpath in `docs/reference/` | Other pages link to the reference instead of copying full signatures |
| Third-party adaptation | One page in `docs/integrations/` | It states external prerequisites and boundary conversions only |
| Contributor workflow | `CONTRIBUTING.md` | Consumer installation links to it and contains no source setup |
| Agent instructions | `skills/` | Checked against the same exports and canonical examples |
| Release history | `CHANGELOG.md` | Current docs use only current names; historical names remain in changelog |
| In-flight implementation plan | `specs/` with `Draft` or `In Progress` | A separate approved cleanup handles spent historical specs |

### Target information architecture

```text
README.md
CONTRIBUTING.md
examples/
|-- quick-start.ts
|-- service-boundary.ts
|-- serialization-boundary.ts
`-- tanstack-query.ts

docs/
|-- index.mdx
|-- start/
|   |-- installation.mdx
|   |-- quick-start.mdx
|   `-- migrating-from-try-catch.mdx
|-- guides/
|   |-- defining-error-vocabularies.mdx
|   |-- composing-results.mdx
|   |-- service-boundaries.mdx
|   `-- serialization-boundaries.mdx
|-- reference/
|   |-- result.mdx
|   |-- error.mdx
|   |-- logger.mdx
|   |-- json.mdx
|   |-- brand.mdx
|   |-- function.mdx
|   |-- query.mdx
|   |-- standard-schema.mdx
|   `-- testing.mdx
|-- integrations/
|   |-- tanstack-query.mdx
|   |-- validation-libraries.mdx
|   `-- hono.mdx
`-- decisions/
    |-- result-shape.mdx
    |-- error-contract.mdx
    |-- brand-representation.mdx
    `-- pragmatic-tradeoffs.mdx
```

The final page count is not a target. Concept ownership is the target. A page that cannot name a distinct reader job should be merged or deleted.

### Page contracts

| Target page or artifact | Reader question it alone answers | Required unique content | Content forbidden here |
| --- | --- | --- | --- |
| `README.md` | What is this, can I run it, and what does it cost? | Approved sentence, install command, included quick start, short tradeoff, map to docs | Full API inventory, competitor size table, long design rationale |
| `CONTRIBUTING.md` | How do I work on this repository? | Bun setup, non-mutating checks, docs workflow, changesets, PR expectations | Consumer framework setup or current API tutorial |
| `examples/quick-start.ts` | Does the first example compile and run? | One offline success and failure | Undefined helpers, network, framework code |
| Other `examples/*` | Does this complete pattern work against the package? | One complete service, serialization, or query scenario per file | Marketing prose or duplicate API reference |
| `docs/index.mdx` | Where should I go next? | One-sentence orientation and navigation by reader job | Second product essay, size claims, deep examples |
| `docs/start/installation.mdx` | What must a consumer install and configure? | Supported package managers, subpaths, tested compiler/runtime matrix | Contributor setup, broad framework recipes, untested compatibility |
| `docs/start/quick-start.mdx` | Can I understand and run the core loop? | Walkthrough of the canonical quick-start file | Brand, query, or service architecture survey |
| `docs/start/migrating-from-try-catch.mdx` | How do I adopt this incrementally? | Narrow-boundary migration sequence and rollback advice | Complete Result or error reference |
| `docs/guides/defining-error-vocabularies.mdx` | How do I choose and define variants? | Variant naming, fields, optional keys, cause ownership | Exhaustive export list or error API history |
| `docs/guides/composing-results.mdx` | How do I propagate, recover, and discriminate safely? | Non-null and truthy error conventions, falsy errors, manual propagation, `Ok(null)` | Service folder architecture or framework adapters |
| `docs/guides/service-boundaries.mdx` | How do Results move through application layers? | One approved service-to-caller flow and error transformation ownership | Unproved production metrics or full integration APIs |
| `docs/guides/serialization-boundaries.mdx` | What survives JSON and what does not? | Recursive JSON-data model, exact versus semantic preservation, positive and negative fixtures, validation boundary | “Perfect,” “intact,” or type-enforced claims |
| Nine `docs/reference/*.mdx` pages | What is importable from this one subpath now? | Every current value/type export, signature, behavior, edge case, links outward | Product positioning, multi-page tutorials, historical names |
| `docs/integrations/tanstack-query.mdx` | How do Results adapt to TanStack's throwing contract? | Two-family choice, reactive snapshot rule, prerequisites, cache boundary | Full query symbol reference or general service architecture |
| `docs/integrations/validation-libraries.mdx` | How does `Brand` work with runtime validators? | ArkType, Zod, and Valibot boundary recipe | Brand representation internals or Standard Schema API reference |
| `docs/integrations/hono.mdx` | How do I preserve and validate a Result-shaped HTTP payload? | A careful HTTP boundary guide that distinguishes JSON shape preservation, runtime validation, and end-to-end static typing, with an explicit client contract | Claim that preserving a JSON shape validates it or gives `response.json()` exact types by itself |
| `docs/decisions/result-shape.mdx` | Why `{ data, error }`, and what is its limit? | `Ok(null)` collision, non-null and truthy error conventions, rejected alternatives | General Result tutorial |
| `docs/decisions/error-contract.mdx` | Why named object variants and `defineErrors`? | `name`/`message`, Rust influence, builder deletion, serializability convention | Factory how-to or complete signatures |
| `docs/decisions/brand-representation.mdx` | Why nested marker brands? | Representation tradeoff and assignability rationale | Validator tutorial |
| `docs/decisions/pragmatic-tradeoffs.mdx` | When is manual Result flow too small? | No `?`, DI, concurrency, resources; Effect escape hatch | Competitor size or unsupported superiority claims |

## Keep, Rewrite, Move, and Delete Map

This is the approved file-level disposition. A “Delete” row becomes executable only after its replacement has passed pre-deletion verification.

| Current path | Proposed action | Replacement owner or unique content to migrate | Approval status |
| --- | --- | --- | --- |
| `README.md` | Rewrite in place | Lead with boundary-friendly error data, then the familiar Result shape; keep the manual propagation cost and Effect escape hatch | Approved |
| `docs/index.mdx` | Rewrite in place | Target site map | Included |
| `docs/getting-started/installation.mdx` | Build replacement, then retire old path | `docs/start/installation.mdx` | Approved after proof |
| `docs/getting-started/quick-start.mdx` | Build replacement, then retire old path | `docs/start/quick-start.mdx` from canonical example | Approved after proof |
| `docs/migration/from-try-catch.mdx` | Build replacement, then retire old path | `docs/start/migrating-from-try-catch.mdx`; keep surgical adoption flow | Approved after proof |
| `docs/core/result-pattern.mdx` | Split, then delete | Result guide, `reference/result`, `decisions/result-shape` | Approved after proof |
| `docs/core/error-system.mdx` | Split, then delete | Error guide, `reference/error`, `decisions/error-contract` | Approved after proof |
| `docs/core/brand-types.mdx` | Split, then delete | `reference/brand`, validation integration, brand decision | Approved after proof |
| `docs/patterns/optional-keys.mdx` | Merge, then delete | `guides/defining-error-vocabularies` | Approved after proof |
| `docs/patterns/real-world.mdx` | Merge, then delete | Approved examples in `guides/service-boundaries` | Approved after proof |
| `docs/patterns/service-layer.mdx` | Merge, then delete | `guides/service-boundaries` | Approved after proof |
| `docs/integrations/tanstack-query.mdx` | Rewrite in place | Current TanStack page contract | Included |
| `docs/integrations/testing.mdx` | Replace, then delete | `reference/testing`; no second testing integration page | Approved after proof |
| `docs/integrations/validation-libraries.mdx` | Rewrite in place | Brand validator recipe only | Included |
| `docs/integrations/hono-serialization.mdx` | Rewrite and rename | `docs/integrations/hono.mdx` with the approved shape-versus-validation-versus-static-typing contract | Approved |
| `docs/philosophy/err-null-is-ok-null.md` | Build replacement, then retire old path | `decisions/result-shape` | Approved after proof |
| `docs/philosophy/error-api-evolution.mdx` | Merge, then delete | Unique builder-history evidence into `decisions/error-contract` | Approved after proof |
| `docs/philosophy/rust-inspiration.mdx` | Merge, then delete | Unique Rust mapping into `decisions/error-contract` | Approved after proof |
| `docs/philosophy/why-name-and-message.mdx` | Merge, then delete | `name`/`message` rationale into `decisions/error-contract` | Approved after proof |
| `docs/philosophy/brand-implementation.mdx` | Build replacement, then retire old path | `decisions/brand-representation` | Approved after proof |
| `docs/philosophy/for-the-pragmatic-fp-developer.mdx` | Merge, then delete | Distinct tradeoffs into `decisions/pragmatic-tradeoffs` | Approved after proof |
| `docs/philosophy/from-effect-to-pragmatic-errors.mdx` | Merge, then delete | Distinct TypeScript constraints into `decisions/pragmatic-tradeoffs` | Approved after proof |
| `docs/philosophy/production-reliability.mdx` | Delete | No unsupported metric migrates; grounded boundary examples move to guides | Approved after proof |
| `docs/philosophy/developer-experience.mdx` | Delete after unique audit | Any grounded editor/testing behavior moves to guide or reference | Approved after proof |
| `docs/philosophy/design-principles.mdx` | Delete after unique audit | Approved concise principles move to README or tradeoff decision | Approved after proof |
| `src/README.md` | Delete after migration | No public tutorial remains in source root | Approved after proof |
| `src/error/README.md` | Delete after migration | Unique rules move to error guide/reference | Approved after proof |
| `src/query/README.md` | Delete after migration | Current two-family guidance moves to query integration/reference | Approved after proof |
| `skills/*/SKILL.md` | Rewrite in place | Agent-specific condensation of current examples and reference facts | Included |
| Historical `specs/*` and `specs/launch/*` | No deletion in this pass yet | Produce a separate path-by-path cleanup proposal after docs cutover | Deferred |

Deletion happens only from the maintainer-approved allowlist, after the replacement path is linked, compiled, and verified while the old files still exist on disk.

## Factual Corrections That Land Regardless of Messaging

1. State that root imports are unsupported, not merely bad for tree shaking.
2. Document exactly nine current subpaths and current 0.44.0 names.
3. Replace old `queryOptions` and `mutationOptions` guidance with `resultQueryOptions` and `resultMutationOptions`, except in explicitly historical changelog text.
4. Document `defineKeys`, including its factory-return literal-widening caveat, and the difference between client-agnostic options adapters and `QueryClient`-bound factories.
5. State that a `defineErrors` variant returns an `Err` wrapper; the tagged body is under `.error`.
6. State that JSON serializability is a convention. Define exact preservation recursively over JSON data: `null`, booleans, strings, finite numbers other than negative zero when numeric identity matters, dense array elements with no extra properties, and own enumerable string-keyed fields on plain objects with the standard Object prototype. `NaN`, infinities, negative zero, sparse holes, extra array properties, symbol or non-enumerable fields, `undefined`, functions, `Date`, native `Error`, `bigint`, class instances, null-prototype objects, and cyclic graphs do not satisfy an exact round-trip promise. The exported `JsonValue` type is broader because TypeScript cannot exclude values such as `NaN`. JSON semantic normalization can be described separately from exact JavaScript preservation.
7. Remove claims that `Date`, functions, native `Error`, or other fields are rejected by `defineErrors` types. Only `message: string` and the reserved `name` behavior are enforced.
8. State that error objects are shallow-frozen, not deeply immutable.
9. No generic discriminator can distinguish `Ok(null)` from permitted `Err(null)` because they are structurally identical. Under the documented non-null-error convention, use `error !== null` or `isErr(result)`. `if (error)` requires the stronger truthy-error convention and fails for `null`, `undefined`, `false`, `0`, `""`, and `NaN`, all permitted by the current `Err<E>` types. Preserve `Ok(null)` as valid and reject the null-unsafe custom matcher.
10. Teach `expectOk` and `expectErr` as the official test helpers.
11. Stop saying the whole package or Result surface never throws. `unwrap`, `resolve`, test assertions, and query adapters intentionally cross into throwing contracts.
12. Replace the unsound generic `parseJson<T>` tutorial with `wellcrafted/json` returning `JsonValue`, followed by validation or narrowing.
13. Separate JSON shape preservation from static end-to-end HTTP typing and runtime validation.
14. Use Bun for contributor commands and remove the nonexistent `dev` command.
15. Establish one supported TypeScript, module-resolution, standard-library, and runtime matrix from consumer tests. Do not preserve the current 5.0 versus 4.5 conflict.
16. Document any TanStack type prerequisite for `wellcrafted/query`; do not hide the current undeclared type dependency.
17. Fix Mintlify scripts to run in `docs/`, use a supported Node runtime, and remove the invalid component import.
18. `package.json#files` includes `LICENSE`, but the repository file is missing and the published tarball omits it. Adding the file or changing package metadata is a separate packaging decision. Documentation must not claim the tarball contains a license file today.

Items 16 and 18 may reveal package metadata work. They must be reported and approved separately before changing non-documentation behavior.

## Claims to Prove or Remove

| Current claim | Decision | Proof required to retain it |
| --- | --- | --- |
| Full library is under 2 kB | Remove | Pinned consumer bundle scenarios, package version, bundler, minifier, target, compression command, and CI budget |
| Competitor size table | Remove | Same reproducible method for pinned versions and equivalent entry points, plus maintenance owner |
| Zero dependencies | Qualify as zero declared runtime dependencies | npm metadata check; query type prerequisite explained separately |
| Tree-shakeable, pay only for what you use | Remove or state only as subpath architecture | Reproducible consumer builds for representative imports |
| Zero unhandled exceptions, thousands of hours, production tested | Remove unless explicitly approved | Named source, pinned revision or measurement window, collection method, and permission to publish |
| Debugging time reduced from hours to minutes | Remove | Approved case study with evidence |
| 22,824 production lines or 244 importer files | Do not publish | Internal research may retain the pinned methodology, but public documentation carries no usage or vanity metric |
| All errors or Results serialize perfectly or intact | Remove | Impossible under the current `unknown` payload contract; replace with conditional wording |
| Works with any framework or runtime | Remove | Declared runtime matrix and automated consumer tests |
| Direct query execution is much faster | Remove | A benchmark that defines workload and measures the claimed difference |

Preferred rule: if a claim needs a paragraph of methodology, link to a committed benchmark or do not put the number in the front door.

## Allowed Change Boundary

This is a documentation and documentation-infrastructure branch.

Allowed paths and change types:

- `README.md`, `CONTRIBUTING.md`, `docs/**`, `examples/**`, `skills/**`, and this spec.
- JSDoc or comments in `src/**` when a public statement is wrong. Runtime logic and signatures remain unchanged.
- Documentation validation scripts, non-mutating check scripts, and focused verification fixtures under `scripts/**`.
- `package.json` scripts, a pinned documentation-tool dev dependency, and resulting `bun.lock` changes.
- `.github/workflows/**` changes needed to run approved checks under pinned runtimes.

Forbidden without a new approval:

- Runtime behavior, public exports, types, signatures, or package entry points.
- Peer or runtime dependency metadata, `engines`, package file inclusion, versions, or release configuration.
- Publishing, deployment, pushing, pull-request creation, or edits in Epicenter.
- Historical spec deletion outside an explicit path-by-path cleanup approval.

## Executable Example Strategy

Examples are consumer-shaped code with package subpath imports. They must compile against the built package, not internal source paths.

1. `examples/quick-start.ts` runs without network access and demonstrates both success and failure.
2. `examples/service-boundary.ts` defines a closed error vocabulary, wraps only a throwing operation, and manually propagates one error.
3. `examples/serialization-boundary.ts` demonstrates the valid JSON-compatible case and the `cause` caveat without claiming type enforcement.
4. `examples/tanstack-query.ts` typechecks both direct adapters and factory-returned handles against the current API.

The root package self-reference may power the learning files after `bun run build`, but it is not package-consumer proof: root dev dependencies and `skipLibCheck` can hide published-package defects. A dedicated examples tsconfig uses `skipLibCheck: false`. At least the quick start and service example run under Bun.

Package proof uses a separate isolated temporary consumer:

1. Pack the built package with `bun pm pack`.
2. Create a temporary project outside the repository package boundary.
3. Install the tarball plus only the explicit dependency required by that fixture.
4. Typecheck with `skipLibCheck: false` under each approved TypeScript and module-resolution configuration.
5. Import all nine subpaths, assert that the root is unsupported, and invoke runtime-sensitive APIs such as `partitionResults` and `composeSinks`.
6. Test `wellcrafted/query` once without `@tanstack/query-core` to document the current failure and once with the pinned compatible version to prove the supported path.

Runtime smoke jobs execute affected APIs under each runtime version the installation page promises. A typecheck alone does not establish runtime compatibility.

Documentation code has two classes:

- **Canonical checked examples**: included from, extracted from, or mechanically compared with `examples/` files. These compile and, where practical, run in CI.
- **Illustrative snippets**: explicitly marked as partial. They remain short and contain no fake imports or API names. They do not become a CI promise until a prototype proves a reliable extraction mechanism.

The implementation may choose checked inclusion or extraction after testing Mintlify's supported syntax. It must not keep manually duplicated long examples with no drift check.

## Verification and CI Strategy

### Repository scripts

First add or repair baseline-green scripts:

- `lint:check`: run Biome lint without writes.
- `format:check`: run Biome formatting checks without writes.
- `docs:dev`: run the pinned local Mint binary from `docs/` with a documented Node 24 requirement.
- `docs:validate`: run the pinned local Mint validator from `docs/`.
- `docs:links`: run the pinned local Mint link checker from `docs/`.
- `docs:examples`: build the package, typecheck canonical examples, and run executable examples.
- `package:smoke`: verify the packed tarball and all nine subpaths from an isolated consumer.
- `compat:types`: run the approved TypeScript, module-resolution, standard-library, and TanStack fixtures with `skipLibCheck: false`.
- `compat:runtime`: invoke runtime-sensitive APIs under each runtime version promised in installation.

Pin the Mintlify CLI version rather than letting `bunx` silently change validation behavior.

Strict content gates are designed and enabled only after the canonical content exists:

- `docs:exports`: derive `(subpath, export kind, symbol)` tuples from the manifest and emitted declarations, then compare them with machine-readable markers on exactly one reference page. Searching prose does not count as coverage.
- `docs:claims`: scan `README.md`, `CONTRIBUTING.md`, `docs/`, `examples/`, and `skills/`; exclude `CHANGELOG.md`, historical specs, and explicitly marked historical quotations. Reject a documented list of retired names, unsupported root imports, conflicting requirements, npm contributor commands, serialization absolutes, unsupported metrics, and stale links.
- `docs:snippets`: enable only after an include, extraction, or comparison prototype passes against the intended Markdown and MDX corpus. Canonical example drift is the first required case.

Retained legacy files may have explicit temporary exclusions through the pre-deletion proof. The deletion wave removes each exclusion atomically with its approved legacy file, then reruns the strict gates.

### CI gates

The main workflow should run:

```text
bun install --frozen-lockfile
bun run lint:check
bun run format:check
bun run typecheck
bun run build
bun test
bun run docs:examples
bun run package:smoke
bun run compat:types
bun run compat:runtime
bun run docs:exports      after its canonical contract is green
bun run docs:claims       after its canonical contract is green
bun run docs:snippets     after its extraction prototype is green
bun run docs:validate     in a Node 24 job with the pinned local Mint binary
bun run docs:links        in a Node 24 job with the pinned local Mint binary
```

The workflow must explicitly install Node 24 before invoking Mint. Runtime smoke jobs install the runtime they claim to cover and invoke the relevant APIs, not just import them.

### Manual acceptance

1. Render the Mintlify site under a supported local runtime.
2. Inspect desktop and narrow-width navigation, code blocks, tables, cards, and overflow.
3. Follow the README to installation, runnable quick start, tradeoff, guides, and all nine reference pages.
4. Run a first-reader review with no prior conversation context.
5. Run a skeptical API review against exports, emitted declarations, tests, and the npm tarball.
6. Run a claim review that tries to disprove every numeric, compatibility, production, serialization, and competitor statement.
7. Finish with `git diff --check`, status review, link validation, and post-implementation review.

No validation is reported as passed unless the command actually ran. Environment blockers name the exact runtime and error.

## Incremental Documentation Waves

Commits are created only after explicit approval. If approved, each wave is one atomic conventional commit and leaves the branch reviewable.

### Wave 0: Resolve positioning and exact scope

- [x] Resolve the Wave 0 decisions below.
- [x] Approve allowed file paths, optional source-comment changes, tooling changes, and the exact documentation deletion allowlist.
- [x] Record decisions in this spec.

### Wave 1: Make baseline verification green

- [x] Repair and pin Mintlify validation.
- [x] Run Mint commands from `docs/` under an explicit Node 24 job.
- [x] Add non-mutating lint and format checks.
- [x] Fix the current site validation warning.
- [x] Commit only when the existing content passes these baseline checks.

Verification on 2026-07-10:

- `PUPPETEER_SKIP_DOWNLOAD=true bun install --frozen-lockfile` passed with the exact `mint@4.2.684` dependency.
- `bun run docs:validate` and `bun run docs:links` passed from `docs/` with Node 24.17.0. The CI workflow now runs both commands in an explicit Node 24 job.
- `bun run lint:check` exited successfully without writes. It still reports 12 pre-existing warnings: one unused suppression and 11 non-null assertions in tests.
- `bun run format:check`, `bun run typecheck`, `bun run build`, and `bun test` passed. The test run completed 158 tests with no failures.
- The unsupported `@mintlify/components` import was removed. Mintlify provides `Card` and `CardGroup` as built-in components.
- The primary orchestrator independently reran the baseline checks before committing this wave.

### Wave 2: Add examples and isolated package proof

- [x] Add the four canonical learning examples.
- [x] Add strict example typechecking and runnable offline examples.
- [x] Add isolated packed-consumer, compatibility-type, and runtime fixtures.
- [x] Wire only checks that already pass into CI.

Verification on 2026-07-10:

- `bun run docs:examples` built the package, typechecked all four examples with TypeScript 5.8.3, `strict: true`, and `skipLibCheck: false`, then ran the quick-start, service-boundary, and serialization-boundary examples offline. The TanStack Query example is typechecked but intentionally not executed as part of the learning path.
- `bun run compat:types` passed against all nine subpaths under both Bundler and NodeNext resolution. The fixture uses the ES2024 target with the ESNext and DOM libraries and keeps library checking enabled. This is compatibility evidence for the later installation decision, not yet a broader public support promise.
- `bun run package:smoke` packed the built package with `bun pm pack`, installed it in a temporary consumer outside the repository package boundary, and passed strict Bundler and NodeNext consumer typechecks. It confirmed that `wellcrafted/query` fails typechecking without `@tanstack/query-core`, then passed with the explicit pinned `@tanstack/query-core@5.82.0` prerequisite. Its runtime fixture imported all nine subpaths, invoked `partitionResults` and `composeSinks`, and confirmed that the unsupported root import rejects.
- The runtime fixture passed under Bun 1.3.1, Node 22.17.0, and Node 24.4.1. CI now reruns the Bun fixture in the main job and the same fixture in Node 22 and Node 24 matrix jobs; those maintained-major jobs do not expand the package's undeclared metadata by themselves.
- The main CI job now runs `docs:examples`, `package:smoke`, `compat:types`, and `compat:runtime` after the existing build and test gates. The Bun runtime used there is pinned to 1.3.1.
- The final local pass also completed the frozen install, formatting check, typecheck, build, 158-test suite, Mint validation, Mint link check, and `git diff --check`. Lint exited successfully with the same 12 pre-existing warnings recorded in Wave 1 and no new warning from Wave 2 files.

### Wave 3: Replace the front door and start path

- [x] Rewrite README around the approved product sentence and runnable example.
- [x] Rewrite site index as navigation, not duplicate positioning.
- [x] Create new installation, quick start, and migration paths while leaving their old files on disk and out of the new navigation until cutover.
- [x] Add `CONTRIBUTING.md` with Bun, checks, docs workflow, changesets, and PR expectations.

Verification on 2026-07-10:

- The README and site index now use the exact approved serialization-first sentence with the JSON-compatibility limitation immediately beside it. Unsupported size, competitor, reliability, broad runtime, and serialization claims were removed from the front door; agent skills remain a short secondary note.
- `docs/start/installation.mdx` states only the Wave 2-proven TypeScript 5.8.3, Bundler and NodeNext, ES2024 with ESNext and DOM libraries, Bun 1.3.1, and Node 22.17.0 and 24.4.1 configurations. It identifies all nine subpaths, the unsupported root import, ESM-only output, and the explicit tested `@tanstack/query-core@5.82.0` prerequisite without changing package dependency metadata.
- `docs/start/quick-start.mdx` imports the supported Mint reusable snippet at `docs/snippets/quick-start.mdx`. `scripts/check-quick-start-docs.ts`, run by `docs:examples`, proved that both the snippet and README code fence match the documented region of `examples/quick-start.ts`.
- `docs/start/migrating-from-try-catch.mdx` teaches a narrow throwing boundary, staged caller migration, a rollback-compatible throwing adapter, and the Effect escape hatch. It keeps JSON shape preservation separate from runtime validation and static typing and links the attributed Epicenter service pattern.
- The legacy getting-started and migration files remain on disk, and their sidebar routes remain unchanged for the Wave 9 cutover. Only the site name in `docs/docs.json` changed to lowercase `wellcrafted`.
- `CONTRIBUTING.md` records Bun setup, non-mutating checks, Node 24 Mint usage, canonical-example ownership, the documentation-only changeset rule, the pre-1.0 minor-breaking convention, and focused pull-request expectations. `package.json` now uses a factual description and concrete discovery keywords; no changeset was added because this wave does not change installed runtime behavior or public APIs.
- `bun run docs:examples` passed, including strict example typechecking, the focused snippet comparison, and all three offline examples. `bun run package:smoke`, `bun run compat:types`, and `bun run compat:runtime` also passed.
- `bun run lint:check`, `bun run format:check`, `bun run typecheck`, `bun run build`, and `bun test` passed. The test run completed 158 tests with no failures; lint reported only the same 12 pre-existing warnings recorded in Waves 1 and 2.
- Under Node 24.17.0, `bun run docs:validate` and `bun run docs:links` passed. The public-content claim sweep and `git diff --check` also passed.

### Wave 4: Build the guide path

- [x] Add error-vocabulary, Result-composition, service-boundary, and serialization-boundary guides.
- [x] Ground examples in approved Epicenter patterns.
- [x] Keep exact signatures out of guides unless needed for the task.

Verification on 2026-07-10:

- Added exactly four task-focused guides under `docs/guides/`: defining error vocabularies, composing Results, service boundaries, and serialization boundaries. No navigation or legacy documentation changed in this wave.
- The Result guide adapts and attributes Epicenter's table lookup pattern for `Ok(null)`, reachable read and not-found errors, manual propagation, and recovery to an honest `Ok` fallback. It documents `error !== null` and `isErr` as the exact guards, the falsy-error truthiness limitation, and the structural `Err(null)`/`Ok(null)` collision.
- The service guide adapts and attributes Epicenter's transcription flow through a short task excerpt synchronized with the canonical example's cause-as-string behavior. It wraps one reachable throwing operation, propagates the narrowed Result, and keeps domain classification separate from the I/O boundary.
- The error guide distinguishes required and optional fields, keeps formatting and cause normalization owned by constructors, and shows `InferError` for one variant. The error and serialization guides lead with plain boundary-friendly data only when every field is JSON-compatible and state that `defineErrors` does not type-enforce that condition.
- The serialization guide covers positive and negative cases, states that unsupported array entries become `null`, demonstrates a native `Error` cause becoming `{}`, and separates JSON shape preservation, runtime validation, and end-to-end static typing.
- Public guide text contains no importer counts, reliability claims, production metrics, or other vanity metrics. Exact API signatures appear only where the task requires a compilable usage pattern.
- `bun run format` passed without changing existing files. `bun run docs:examples` passed its strict typecheck, canonical snippet comparison, and three offline runtime examples.
- With Node 24.17.0, `bun run docs:validate` and `bun run docs:links` passed.

### Wave 5: Establish complete reference ownership

- [x] Add exactly one reference page for each of nine subpaths.
- [x] Cover every current runtime and type export.
- [x] Align JSDoc edge cases and examples with the same facts.
- [x] Report public-looking implementation exports as deferred API questions.

Verification on 2026-07-10:

- Added exactly nine reference owners under `docs/reference/`, one for each published subpath: result, error, logger, json, brand, function, query, standard-schema, and testing. Navigation and legacy pages remain unchanged for the later cutover wave.
- Audited each page against the authoritative v0.44.0 inventory. The pages cover every runtime and type export, the dual-space `Ok`, `Err`, and `JsonParseError` names, all three Standard Schema namespace surfaces, and the fact that query definitions are factory returns rather than top-level exports.
- Recorded the required edge contracts: shallow Result and Standard Schema guards, `Ok(null)`/`Err(null)`, contained-value throwing adapters, callback and sink exceptions, wrapper-preserving partitioning, shallow freezing and conditional serialization, wall-clock logger timestamps, JSON numeric limits, `once` first-throw behavior, query cache and casting boundaries, and testing's null-error collision.
- Corrected only factual public JSDoc and comments in the identified source files. No runtime logic, type signature, export, or package metadata changed.
- Kept `ErrorBody`, `ErrorsConfig`, `ValidatedConfig`, `DefineErrorsReturn`, and `FAILURES` documented as current exports while recording their long-term public role as a separate API-cleanup question.
- `bun run format:check`, `bun run typecheck`, `bun run build`, and `bun test` passed; the test run completed 158 tests with no failures. `bun run docs:examples` passed its build, strict example typecheck, canonical snippet comparison, and three offline examples.
- Under Node 24.17.0, `bun run docs:validate` and `bun run docs:links` passed. The focused current-reference claims sweep found no retired APIs, unsupported root imports, serialization absolutes, vanity metrics, reliability claims, or uppercase brand uses.

### Wave 6: Rebuild integrations and agent skills

- [x] Rewrite TanStack Query around the current two-family model and `defineKeys`.
- [x] Put official testing usage in `reference/testing`; do not create a duplicate testing integration page.
- [x] Rewrite Hono as the approved HTTP boundary guide with distinct shape, runtime-validation, and static-typing contracts; keep validation focused on brand validators.
- [x] Reconcile all five distributable skills against current exports and canonical examples.

Verification on 2026-07-10:

- Rewrote `docs/integrations/tanstack-query.mdx` around direct options adapters versus `QueryClient`-bound factories, the reactive snapshot rule, current query and mutation handle shapes, `defineKeys`, direct cache ownership, and the explicit tested `@tanstack/query-core@5.82.0` prerequisite. The reactive example is adapted from and attributed to Epicenter's account popover at commit `4d438c0`; no performance or architecture superiority claim remains.
- Rewrote `docs/integrations/validation-libraries.mdx` as focused runtime-boundary recipes for ArkType, Zod, and Valibot. It keeps `Brand` type-only, puts validation before the single branding assertion, and makes clear that branding changes neither runtime validation nor serialization behavior by itself.
- Added `docs/integrations/hono.mdx`, adapted from and attributed to Epicenter's blob errors at commit `4d438c0`. It treats conditional JSON shape preservation, full-envelope runtime validation, and Hono `AppType`/`hc` static typing as three independent guarantees and states that none implies the others. HTTP status mapping remains separate from the Result envelope.
- Audited `docs/reference/testing.mdx` as the sole new testing owner; it already covers both helpers, opposite-branch throws, narrowing, and the `Err(null)` collision, so no duplicate testing integration content was added. The legacy Hono and testing pages remain on disk, and navigation remains unchanged for the cutover and deletion waves.
- Reconciled all five distributable skills. Result guidance uses exact null guards and current propagation/throwing boundaries; error guidance covers Err wrappers, honest fields, constructor ownership, shallow freeze, and conditional serialization; query guidance covers both families and current handle shapes; brand guidance stays type-only and boundary-focused; patterns is a compact service, propagation, serialization, validation, and UI checklist pointing to canonical examples and public owners. It reuses domain vocabularies when their complete values are JSON-compatible and introduces normalized fields or wire variants only when existing payloads are not boundary-friendly.
- `bun run format` passed without changing existing files. `bun run typecheck` and `bun test` passed with 158 tests and no failures. `bun run docs:examples` passed its build, strict example typecheck, canonical snippet comparison, and three offline examples.
- Under Node 24.17.0, `bun run docs:validate` and `bun run docs:links` passed. The focused current Wave 6 claims sweep found no retired APIs, unsupported root imports, unsafe generic error truthiness, serialization absolutes, vanity metrics, reliability claims, performance claims, or uppercase brand uses. `git diff --check` passed.

### Wave 7: Consolidate decisions

- [x] Preserve only durable rationale and honest tradeoffs.
- [x] Create consolidated Result, error-contract, tradeoff, and brand decisions while leaving their old source pages on disk until deletion.
- [x] Remove unsupported production or marketing claims.

Verification on 2026-07-10:

- Added exactly four rationale owners under `docs/decisions/`: Result shape, error contract, pragmatic tradeoffs, and brand representation. They link to task guides and exact references instead of duplicating API tutorials. Navigation and all legacy decision sources remain unchanged for the later cutover and deletion waves.
- The Result decision records the exact two shapes, error-side discriminator, direct access and destructuring, `switch` exhaustiveness, `Ok(null)`/`Err(null)` collision, non-null and truthy-error conventions, shallow `isResult`, and error-governed malformed envelopes. It records why an explicit tag, data discrimination, and the reverted `NonNullable` constraint are not current contracts and makes no never-throws claim.
- The error decision preserves `name` as variant identity, `message` as human text using JavaScript's existing vocabulary, enumerable own structured fields, conditional JSON behavior, exact factory/freeze behavior, the limited Rust enum analogy, and the durable simplification from manual literals through brittle overloads and fluent modes to plain constructor functions. It contains no historical counts, dates, or usage metrics.
- The tradeoff decision states the cost of explicit propagation and translation and gives a factual choice table for wellcrafted, Effect, and raw exceptions. Effect is an escape hatch when dependency graphs, cancellation/concurrency, resource scopes, scheduling, retries, or automatic propagation are the actual problem; no persona, anecdote, metric, or superiority claim remains.
- The brand decision records the private unique-symbol nested marker, why flat literal slots collapse under intersection, explicit hierarchy construction, verified assignability across sibling, child, deep, multiple, number, and object cases, the modest role of `true`, and the lack of runtime validation, identity, or serialized marker data.
- `bun run format` passed without changing existing files. `bun run typecheck` and `bun test` passed with 158 tests and no failures. `bun run docs:examples` passed its build, strict example typecheck, canonical snippet comparison, and three offline examples.
- Under Node 24.17.0, `bun run docs:validate` and `bun run docs:links` passed. The focused public decision claim sweep found no importer counts, production or reliability claims, performance claims, unsupported serialization promises, historical call-site counts, or uppercase brand uses. `git diff --check` passed.

### Wave 8: Prove and enable strict content gates

- [ ] Prototype machine-readable export markers, exact claims roots/exclusions, and canonical snippet comparison.
- [ ] Make each strict gate pass against canonical content.
- [ ] Add explicit temporary exclusions only for retained legacy files.
- [ ] Enable the passing gates in CI.

### Wave 9: Cut over while the old path remains

- [ ] Rewire navigation and every inbound link to the new owners.
- [ ] Confirm old pages and source READMEs have no remaining unique content.
- [ ] Remove current-path dependence on old files while leaving them on disk.
- [ ] Commit the cutover separately.

### Wave 10: Record the pre-deletion proof checkpoint

- [ ] Run full type, test, build, packed-package, compatibility, runtime, docs, examples, exports, claims, snippets, and visual checks while old files remain.
- [ ] Record exact commands, versions, and results in this spec.
- [ ] Commit the proof checkpoint before deleting anything.

### Wave 11: Delete only approved obsolete owners

- [ ] Delete only paths in the Wave 0 allowlist.
- [ ] Remove every temporary legacy exclusion.
- [ ] Sweep for stale names, imports, claims, and links.
- [ ] Rerun the full suite before committing the deletion, so the deletion commit is independently green.

### Wave 12: Independent final review

- [ ] Run fresh-context first-reader review.
- [ ] Run skeptical API and claims review.
- [ ] Incorporate grounded findings or record why they were rejected.
- [ ] Add the review summary and final proof results to this spec.
- [ ] Stop on a local PR-ready branch. Do not push, publish, deploy, or open a PR without permission.

## Edge Cases and Deferred API Questions

### Public exports that look internal

The documentation must not erase names that are currently importable. `ErrorBody`, `ErrorsConfig`, `ValidatedConfig`, `DefineErrorsReturn`, and `FAILURES` are documented in their current reference owners. A separate API proposal should decide whether they remain public before 1.0; this pass does not remove or hide them.

### Documented runtime/type mismatches

`once` marks the first call as used before invoking the wrapped function. If that invocation throws, later calls return `undefined` without retrying despite the `TReturn` signature. `extractErrorMessage` can throw for cyclic or bigint-containing arrays and can return `undefined` when a custom `toJSON()` does so despite its `string` signature. The reference records current behavior; changing either contract requires separate API work.

### Query type dependency

Published query declarations import `@tanstack/query-core`, but package metadata lists it only as a dev dependency. Documentation can state the current prerequisite. Adding a peer dependency is package behavior and requires separate approval.

### Runtime compatibility

`Object.groupBy`, `AsyncDisposable`, and `Symbol.asyncDispose` make broad runtime and TypeScript promises unsafe. The pass must establish a tested matrix or narrow the docs. Polyfills and public implementation changes are out of scope.

### Serialization boundaries

The container shape can be plain while a payload is not JSON-compatible. Guides must distinguish container, tagged body, payload fields, raw cause, wire validation, and static typing.

### Historical changelog names

Old query and error API names remain valid in release history. Claims sweeps must ignore explicitly historical changelog sections while rejecting those names in current guidance.

### Documentation-only changesets

Whether documentation-only waves need changesets is a contributor policy decision. `CONTRIBUTING.md` must state one rule rather than copying stale guidance.

## Wave 0 Decisions

Wave 0 was approved on 2026-07-10 with one change to the proposed positioning. These decisions now govern implementation.

1. **Positioning, reader, and brand voice**
   - Lead with errors as plain, boundary-friendly data that can move through JSON, HTTP, workers, IPC, logs, and UI when every field is JSON-compatible.
   - Present `{ data, error }` as the familiar, ergonomic Result shape for returning and handling that data with ordinary TypeScript.
   - Write for TypeScript application authors. Use lowercase `wellcrafted` everywhere except historical quotations or case-sensitive identifiers.
   - Keep “Typed failures without a new programming model” available as secondary copy. Effect remains a closing tradeoff, not the lead comparison.
   - Keep the limitation explicit: serializability is a convention, not a type constraint, and arbitrary fields do not serialize perfectly. Do not imply that `defineErrors` enforces JSON-safe fields.
   - If JSON-safe error fields would require a public API or type change, stop and raise a separate proposal. Do not expand this documentation pass.

2. **Product prominence and public production evidence**
   - Use the approved narrative roles: `result` and `error` define the product story; the other seven subpaths support or integrate with that contract as specified above.
   - Use adapted, attributed Epicenter examples in public documentation. The approved source patterns include `transcribe` for service flow, `table` for `Ok(null)` and domain variants, `blob-errors` for Hono, and the account popover for current query adapters.
   - Do not publish importer counts, production-line counts, reliability claims, or other vanity metrics. Internal research numbers may remain in this spec as evidence, but they are not public copy.
   - Keep agent skills as a secondary convenience, not a headline differentiator.

3. **Information architecture and exact deletion allowlist**
   - The target information architecture and page contracts are approved.
   - Keep `docs/integrations/hono.mdx` as a careful HTTP boundary guide. It must distinguish preserving a JSON shape from runtime validation and end-to-end static typing; none implies either of the others.
   - All rows marked “Approved after proof” in the disposition table are the exact deletion allowlist. Delete them only after replacement, cutover, and the recorded pre-deletion verification pass.
   - Keep historical spec deletion deferred to a separate path-by-path cleanup.

### Implementation note: 2026-07-10

Wave 0 is complete and the spec is now in progress. Implementation begins with Wave 1's baseline verification work. This approval does not authorize runtime or public API changes, including JSON-safe field enforcement, and it does not bypass the verify-before-delete sequence.

## Deferred Decisions

These decisions do not block the first documentation waves.

1. **Compatibility language before 1.0**
   - First run the isolated consumer and runtime matrix. Then choose the exact tested promise.
   - Recommendation after evidence: document the tested current matrix and say pre-1.0 minor releases may contain breaking changes described by changesets and changelog.

2. **Low-level exported types**
   - Document every current export in this pass.
   - Consider a separate API cleanup for `ErrorBody`, `ErrorsConfig`, `ValidatedConfig`, `DefineErrorsReturn`, and `FAILURES`.

3. **Package metadata issues**
   - Keep `@tanstack/query-core` peer metadata, `engines`, and the missing repository `LICENSE` file out of this branch unless scope is explicitly expanded.

4. **Documentation-only changesets**
   - Resolve before finalizing `CONTRIBUTING.md`; do not let it block positioning or examples.

5. **Historical spec cleanup**
   - Produce a separate exact allowlist after the public documentation cutover. Do not delete broad categories from this branch.

## Success Criteria

- [ ] A reader in the approved primary audience can install wellcrafted and run a complete example.
- [ ] The README states what wellcrafted is, who it is for, what it costs, and when to use something larger.
- [ ] Every published subpath has exactly one reference page.
- [ ] Every current `(subpath, export kind, symbol)` tuple appears in exactly one reference page's machine-readable coverage.
- [ ] Guides, references, integrations, decisions, JSDoc, examples, and skills each have one distinct ownership role.
- [ ] Serialization language matches the actual convention, defined preservation model, and positive/negative fixtures.
- [ ] Query and testing docs match v0.44.0 behavior and names.
- [ ] Consumer setup and contributor setup are separate and correct.
- [ ] Importer counts, reliability claims, and other vanity metrics are absent from public docs; any remaining numeric, competitor, production, performance, or compatibility claim is reproducible or removed.
- [ ] Canonical examples compile, isolated packed consumers pass strict typechecks, and runtime-sensitive fixtures execute under every promised runtime.
- [ ] Docs validation, links, examples, package smoke, compatibility, export coverage, claims, and proven snippet checks run in CI.
- [ ] Desktop and narrow-width site review has no blocking navigation, layout, or code issues.
- [ ] First-reader, API, and claims findings are resolved or explicitly recorded with evidence for rejection.
- [ ] `bun test`, `bun run typecheck`, `bun run build`, non-mutating lint and format checks, docs checks, and `git diff --check` pass.
- [ ] The final local branch is PR-ready with no unrelated or unapproved changes.

## References

- `AGENTS.md`: repository policy and Bun commands.
- `package.json`: published exports, scripts, package metadata, and version.
- `tsdown.config.ts`: build entry points and target.
- `README.md`: strongest current product narrative.
- `docs/docs.json`: current site navigation.
- `src/error/types.ts`: serializability is a convention, not a type constraint.
- `src/result/result.ts`: Result shape, discriminants, `Ok(null)`, throwing adapters.
- `src/query/utils.ts`: current two-family query behavior.
- `src/testing.ts`: official test helpers.
- `CHANGELOG.md`: release and rename history.
- `skills/`: distributable agent guidance.
- PR #133: `https://github.com/wellcrafted-dev/wellcrafted/pull/133`.
- Epicenter representative files listed under [Real consumers](#real-consumers).

## Review

Three independent draft reviews challenged the first version from first-reader, API/claims, and execution-order perspectives. Material findings were incorporated:

- Replaced overlapping ownership with factual-source versus reader-facing-projection rules and machine checks.
- Added concept-level current ownership, exact page contracts, and a path-by-path deletion allowlist.
- Recast the product sentence, audience, and narrative roles as explicit maintainer choices rather than conclusions proved by import counts.
- Split true Wave 0 gates from compatibility, low-level export, metadata, changeset, and historical-spec decisions that can wait for evidence.
- Made baseline verification green before strict content gates and separated cutover, pre-deletion proof, deletion, and post-deletion proof.
- Replaced root self-reference as package proof with an isolated packed consumer, strict type fixtures, and runtime-sensitive smoke jobs.
- Defined non-mutating lint and format gates, explicit Node 24 Mint jobs, and machine-readable export/claims/snippet contracts that must be prototyped before CI enforcement.
- Corrected Result discrimination for `Err(null)` and all falsy errors, recursive JSON preservation limits, `defineKeys` factory inference, runtime compatibility, root-import error wording, export coverage keys, dated external-tool observations, and the missing repository license file.

The final draft spot checks returned “clear for maintainer decision.” Wave 0 is now recorded; content implementation has not started. No files are staged or committed.
