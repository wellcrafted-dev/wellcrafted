# Documentation refresh deletion audit

**Review date:** 2026-11-14  
**PR:** #138, `codex/docs-greenfield-pass`  
**Current-main baseline:** `15d869c6c009641ed5db53f0b9e7f04e212afd6a` (wellcrafted 0.47.0)  
**Original documentation checkpoint:** `0f18ee68a48f0beb7aab14c363add1e1e9308e1c`  
**Status:** Content-preservation and pre-deletion proof complete; exact remaining deletions recommended. Final post-deletion and PR proof are recorded by the primary review.

This audit compares the proposed documentation removals with current `main`, rather than treating the July audit as continuing proof. Of the original 23 removed documentation owners, `docs/integrations/testing.mdx` and `src/query/README.md` gained substantive content after the original baseline. The other 21 owners have no post-baseline changes. Current `main` also rewrote the TanStack integration and added a Logger guide and Query architecture decision. Those newer materials need explicit preservation.

“Relocate” below describes the required final disposition. It does not claim that a pending migration has passed review. Source text remains recoverable at the baseline commit regardless of whether its original path is removed. Unsupported claims are corrected or dropped; their disappearance must not be counted as loss of a supported API contract.

## Path-by-path disposition

| Original owner | Newer baseline changes? | Required surviving owner and concepts | Intentionally removed or corrected material |
| --- | --- | --- | --- |
| `docs/getting-started/installation.mdx` | No | `docs/start/installation.mdx`: package managers, supported subpaths, compiler/module-resolution requirements, tested runtime matrix; current Query optional peer range. | Unsupported root imports, legacy module resolution, contributor setup mixed into consumer instructions, obsolete undeclared-Query-dependency claim. |
| `docs/getting-started/quick-start.mdx` | No | `docs/start/quick-start.mdx` plus `examples/quick-start.ts`: complete first define/return/handle loop, successful and failed paths. | Undefined helpers, duplicate API tours, unverified standalone examples. |
| `docs/migration/from-try-catch.mdx` | No | `docs/start/migrating-from-try-catch.mdx`: narrow boundaries, staged caller migration, explicit propagation, throwing adapter for legacy callers, Effect escape hatch. | Persona copy, stale combinator history, duplicate tutorials and broken links. |
| `docs/core/result-pattern.mdx` | No | `docs/guides/composing-results.mdx`, `docs/reference/result.mdx`, `docs/decisions/result-shape.mdx`: control flow, all current exports, exact error discrimination, `Ok(null)` and the `Err(null)` collision. | Generic truthy-error checks, ambiguous absence guidance, duplicated reference; `resolve` must disappear from current API guidance because main removed it. |
| `docs/core/error-system.mdx` | No | Vocabulary and serialization guides, Error reference, error-contract decision: constructor functions, tagged variant bodies inside Err wrappers, reserved `name`, `message`, shallow freeze, deliberate cause fields. | Perfect or type-enforced serialization, deep immutability, stale builder shapes, tagged-body/Err-wrapper confusion. |
| `docs/core/brand-types.mdx` | No | Brand reference, validation integration, brand-representation decision: compile-time marking, runtime validation recipes, hierarchy and assignability. | Claims that brands validate data, change runtime values, or add serialized markers. |
| `docs/patterns/optional-keys.mdx` | No | Vocabulary guide: required versus optional variant fields and ownership of formatting at the constructor. | A second factory reference and repeated vocabulary advice. |
| `docs/patterns/real-world.mdx` | No | Service-boundary guide and runnable example: classify infrastructure failure into application-owned data, propagate it to callers, attribute adapted Epicenter patterns. | Generalized framework, production, reliability, and universal-use claims. |
| `docs/patterns/service-layer.mdx` | No | Service-boundary and composition guides: boundary ownership, classification, explicit propagation, caller handling. | Prescriptive folder structure, duplicate APIs, stale architecture conventions. |
| `docs/integrations/testing.mdx` | **Yes** | Testing reference retains `expectOk`/`expectErr`, narrowing and null collision. TanStack integration's “Testing” section owns fresh clients, retries disabled, `runQuery`/`runMutation`, cache fill, service Err, static freshness, and success-only versus global invalidation. New `docs/guides/testing-results.mdx` now covers success, validation-before-I/O/no writes, duplicate/not-found, thrown infrastructure classification, and concurrent uniqueness outcomes. | Custom matchers that misclassify `Ok(null)`, broad fake application scaffolding, repeated API signatures. Shared mutable `beforeEach` examples are replaced by isolated setup functions. The distinct workflows survive; the old duplicate page can be removed after focused verification. |
| `docs/philosophy/err-null-is-ok-null.md` | No | Result-shape decision and composition guide: valid absence, structural collision, meaningful non-null error convention, falsy-error caveat. | Any implication that the current type disallows `Err(null)`. |
| `docs/philosophy/error-api-evolution.mdx` | No | Error-contract decision: durable reasoning from hand-written literals through brittle overloads/fluent modes to constructor functions. | Dates, usage counts, historical tutorials, superseded builders as current advice. |
| `docs/philosophy/rust-inspiration.mdx` | No | Error-contract decision: limited `thiserror` analogy for co-locating variant names, fields, and messages. | Rust language-level enum equivalence and repeated how-to instruction. |
| `docs/philosophy/why-name-and-message.mdx` | No | Error-contract decision: existing JavaScript error vocabulary, stable variant identity, human-facing text separate from structured context. | Repeated factory instruction and overlapping ownership. |
| `docs/philosophy/brand-implementation.mdx` | No | Brand-representation decision: nested private markers, intersection behavior, explicit hierarchies and verified assignability. | Runtime identity, serialization markers, automatic validation and universal composition promises. |
| `docs/philosophy/for-the-pragmatic-fp-developer.mdx` | No | Pragmatic-tradeoffs decision: explicit propagation cost, when raw exceptions fit, when an effect system provides needed capabilities. | Persona targeting and superiority framing. |
| `docs/philosophy/from-effect-to-pragmatic-errors.mdx` | No | Pragmatic-tradeoffs decision: TypeScript control-flow constraints, manual translation cost, honest Effect escape hatch. | Unmeasured competitor size/performance and universal simplicity claims. |
| `docs/philosophy/production-reliability.mdx` | No | Service and serialization guides retain concrete boundary classification and transport lessons with checked examples. | Uptime, production-hours, importer counts, incident-prevention, reliability anecdotes and vanity metrics. None should reappear in public copy. |
| `docs/philosophy/developer-experience.mdx` | No | Composition guide and Testing reference retain ordinary narrowing, explicit branching and actual assertion behavior. | Unmeasured debugging speed, productivity, universal editor behavior and anecdotal claims. |
| `docs/philosophy/design-principles.mdx` | No | README, error-contract and pragmatic-tradeoffs decisions: plain data, normal TypeScript control flow, explicit costs, larger-system escape hatch. | Absolute serialization, portability and never-throws claims. |
| `src/README.md` | No | README plus guides/reference: package mental model, application workflows, exact public API owners. | A duplicate public tutorial tree in source folders. |
| `src/error/README.md` | No | Vocabulary and serialization guides plus Error reference: fields, constructor ownership, signatures, shallow freeze, conditional JSON behavior. | Type-enforced/perfect serialization implications, duplicate and superseded API narration. |
| `src/query/README.md` | **Yes** | TanStack integration, Query reference, task-oriented testing guidance, canonical example, and retained Query ADR now collectively cover the preservation checklist below. | Removed `createQueryFactories`, `defineQuery`, `defineMutation`, `defineKeys`, `.fetch()`, `.ensure()`, callable mutation handles and `.options` survive only as historical migration source. Newer contracts and workflows have named owners; the duplicate source tutorial can be removed after focused verification. |

The original approval contained 20 documentation pages and three source-folder READMEs. It did not contain `docs/core/logger.mdx`, the new Query ADR, historical specs, changelog entries, or unused logo assets. This refresh must describe any disposition beyond those 23 paths separately instead of quietly widening the old allowlist.

## New Query guidance that must survive consolidation

Current-main source owners are `src/query/README.md`, `docs/integrations/tanstack-query.mdx`, `skills/tanstack-query/SKILL.md`, `.claude/skills/query-layer/SKILL.md`, and `docs/adr/0001-result-namespaces-produce-native-tanstack-options.md`. Each list item below is grounded in those files, source, or tests. It is not a proposal to change the runtime API.

| Concept in current main | Required final home | Why it cannot be silently collapsed away |
| --- | --- | --- |
| Six functions: `resultQueries`, `resultMutations`, `resultQueryOptions`, `resultMutationOptions`, `runQuery`, `runMutation`; types `ResultQuery`, `ResultMutation` | Query reference, canonical example; integration chooses by task | The original PR documents a different public surface. |
| Functions-only namespace maps; query entry takes service arguments, mutation entry is native options; construction never executes services | Integration and reference | Prevents restoring the rejected mixed-config namespace API. |
| Query key `[...namespace, method, argsTuple]`, method `.key` prefix, mutation key `[...namespace, method]`; typed `DataTag` | Reference with concise integration examples | Nested argument tuple prevents collisions; exact keys and prefixes do different jobs. |
| Global `MutationCache.onSettled` invalidates all reads after every write, successful or failed; active observers refetch now, inactive reads later, static queries stay static | Integration task recipe | The newest main guidance deliberately prioritizes correctness across namespaces over inferred key-based invalidation. Returning the promise keeps the write pending. |
| Optional selective invalidation through `meta.invalidates`, with absent metadata falling back to all queries | Integration task recipe | Replacing the global rule with a hand-maintained precise list changes semantics and can miss new dependent reads. |
| Spread options for one use; `select` changes observer data, not cached/key data; key-prefix defaults merge in registration order, broad before narrow | Integration and reference links | These are the supported composition tools after factory handles were removed. |
| Named mutation variants through native `mutationOptions`; cache update from saved data; optimistic cancellation/snapshot/rollback | Integration | These are concrete ways to extend functions-only entries without reintroducing namespace option bags. |
| Definition lifecycle callbacks run every execution; per-call mutate callbacks may disappear when the observer unmounts | Integration/Query reference | Relevant when choosing a hook callback or awaited workflow. |
| Zero/optional/multiple query arguments; zero or one mutation variables argument; optional mutation input includes void; `runMutation` still takes explicit third argument | Query reference | Subtle arity and inference behavior otherwise vanishes with source README removal. |
| Own enumerable string methods, numeric-key stringification, symbols skipped, no receiver binding; annotate wrappers and bind receiver-dependent methods | Query reference | Namespace helpers do not call methods as service object methods. |
| Stable JSON-serializable query arguments; `get()` and `get(undefined)` differ; generic/overloaded/context-aware operations use explicit adapters | Query reference | Defines safe key identity and the inference boundary. |
| Namespace service reads do not receive query context or abort signal; explicit adapter does | Query reference | Omitting this would imply cancellation support the namespace API does not provide. |
| `runQuery` uses `client.query`, freshness/staleness/deduplication, `staleTime: 'static'` for cache-first behavior, `CancelledError` on cancellation | Reference plus workflow recipe | Requires Query 5.102+, replaces the old fetch/ensure split. |
| `runMutation` uses a `MutationObserver`, preserves callbacks/cache/devtools/scopes, detaches after execution for GC | Query reference | Distinguishes it from calling a raw service or creating cache entries manually. |
| Awaiting mutations in components uses Result-returning `runMutation`; pending state comes from `useIsMutating` and may include other runs of the key | Integration | Typed rejections are not available from `mutateAsync`; outcome/pending ownership differs. |
| Call services directly for one-off work with no cache observers; inject client at execution; one SPA client or one per SSR request/session; transport may be captured per session | Integration | Prevents stale captured clients and cross-request sharing. |
| Group keys live separately when independently reused; leaf keys remain in option factories unless independent access is needed | Integration | Avoids duplicating key identity and preserves typed cache access. |
| 0.44 migration map from factory handles/defineKeys/captured clients to native options and run helpers | Integration migration section | Readers of the old docs need a concrete upgrade route. Retired names are permissible only in clearly marked historical migration context. |
| `@tanstack/query-core` optional peer dependency `^5.102.0`; matching adapter versions | Installation and reference | Main has already fixed the metadata problem the original PR described as deferred. |

The ADR remains the rationale owner. The current `skills/tanstack-query` and `.claude/skills/query-layer` remain the agent workflow owners. Do not resurrect the deleted `skills/query-factories` skill.

## New testing guidance that must survive

Deleting `docs/integrations/testing.mdx` is acceptable only after its distinct workflows have a usable owner. `docs/reference/testing.mdx` alone, as of the original PR, covers only two assertion functions and the null collision. It does not replace service- or cache-testing workflows by itself.

The final task guidance must show isolated clients with query/mutation retries disabled, successful query cache fill, service Err handling, fresh-cache reads without executing the service, and mutations that invalidate through the client supplied at execution. Distinguish the local `onSuccess` policy from the global `onSettled` recipe: an error leaves the cache alone under the former, while the latter invalidates after a failed write too. Tests must make their selected policy visible rather than promising one outcome for every client.

The service-side lessons worth keeping are deterministic success/error assertions, validation before I/O, checking that invalid input causes no writes, duplicate/not-found domain outcomes, and classifying thrown infrastructure failures. On final audit, these lessons were not actually covered as testing workflows by the existing service guide or assertion reference. The refresh therefore adds `docs/guides/testing-results.mdx` as a distinct task owner instead of describing their omission as consolidation. The old page's large Vitest database scaffold and custom matcher extension can still be dropped. Concurrent duplicate creation needs an explicit lesson that checking before a write cannot replace the storage unique constraint.

## New Logger guidance that must survive

`docs/core/logger.mdx` was added after the original PR baseline. It contains a distinct application task, not just an export list. The refresh decision is to keep this file and its existing URL, expose it under Guides, and link to the exact Logger reference. Its deletion is not implied by the old 23-path allowlist. The former 24-route count is an earlier inventory, not a cap that justifies discarding this newer guide.

Required surviving concepts:

- Source-bound dependency injection, a local logger fallback, and module-scope logger suitability for process-wide modules.
- Logging the factory Err wrapper or narrowed body, native Error compatibility, per-call level choice, reporting once at the handling boundary, and detached logger methods used with `tapErr`.
- Five levels without `fatal`; wall-clock timestamps and intentional event message/data duplication.
- `trace` goes through `console.debug`; console output is human-readable rather than JSON Lines; CLI stderr routing is a custom sink choice.
- `LogSink` receives synchronously and returns `undefined`. Async receivers, numeric expression-body returns, and explicitly `void` functions are not valid sink implementations. Runtime does not inspect returned values.
- A synchronous receiver can enqueue async work but owns its failures, completion, durability and cleanup. Logging return does not prove disk/network delivery.
- Delivery catches sink exceptions and best-effort emergency-console failures, preserving later sinks and Results passing through `tapErr`. Disposal is separate: sequential awaited cleanup stops on a throwing disposer.
- Isolated `memorySink` arrays, exact tagged-body identity, and the lack of built-in reactive subscriptions.
- Application-owned reactive Svelte log history, including `untrack` to prevent caller-effect dependencies; history is for display rather than replaying log calls or toasts.

The new Logger reference must reflect those runtime contracts. The original PR's statements that sink delivery throws escape or skip later sinks are obsolete and must be corrected.

## Retired URL map

These are explicit proposed `docs.json` redirects. They cover every removed site page from the 20-page deletion set; source-folder READMEs do not have Mint page routes. Keeping Git history alone does not preserve bookmarks or links from external sites.

| Old route | Destination |
| --- | --- |
| `/getting-started/installation` | `/start/installation` |
| `/getting-started/quick-start` | `/start/quick-start` |
| `/migration/from-try-catch` | `/start/migrating-from-try-catch` |
| `/core/result-pattern` | `/guides/composing-results` |
| `/core/error-system` | `/guides/defining-error-vocabularies` |
| `/core/brand-types` | `/reference/brand` |
| `/patterns/optional-keys` | `/guides/defining-error-vocabularies` |
| `/patterns/real-world` | `/guides/service-boundaries` |
| `/patterns/service-layer` | `/guides/service-boundaries` |
| `/integrations/testing` | `/guides/testing-results` |
| `/philosophy/err-null-is-ok-null` | `/decisions/result-shape` |
| `/philosophy/error-api-evolution` | `/decisions/error-contract` |
| `/philosophy/rust-inspiration` | `/decisions/error-contract` |
| `/philosophy/why-name-and-message` | `/decisions/error-contract` |
| `/philosophy/brand-implementation` | `/decisions/brand-representation` |
| `/philosophy/for-the-pragmatic-fp-developer` | `/decisions/pragmatic-tradeoffs` |
| `/philosophy/from-effect-to-pragmatic-errors` | `/decisions/pragmatic-tradeoffs` |
| `/philosophy/production-reliability` | `/guides/service-boundaries` |
| `/philosophy/developer-experience` | `/guides/composing-results` |
| `/philosophy/design-principles` | `/decisions/pragmatic-tradeoffs` |

The former `/integrations/hono-serialization` page was a compatibility notice in the original PR. This refresh removes that notice separately from the original 23 owners and configures a permanent redirect to `/integrations/hono`. A live local-preview check found that the existing MDX file shadowed the configured redirect, so retaining both defeated the redirect request. The notice had no unique HTTP guidance; the full canonical Hono guide remains. This makes the proposed removal count 24 owners: the original 23 plus one compatibility notice. The redirect count is 21 site routes, because the three source READMEs have no Mint page route.

`/core/logger` remains a live route and needs no redirect. The navigation has six task guides after retaining Logger and adding the service-testing guide; the old four-guide or 24-route inventory does not limit useful current content. Redirects must resolve directly to existing pages, avoid chains/cycles, and be checked alongside navigation and internal links. Pinned Mint's local preview returns 307 for configured redirects; deployment is configured permanent but has not been deployed by this refresh.

## Inspected final owners

Source inspection on 2026-11-14 confirmed these surviving sections before the temporary Query and Testing owners are removed:

| Preservation obligation | Inspected owner sections |
| --- | --- |
| Current Query exports, typed namespace keys, arity, method receiver/inference/AbortSignal limits | `docs/reference/query.mdx`: “Exports,” “Namespace helpers,” “Direct options adapters,” “Imperative execution” |
| Global and selective invalidation, defaults, native spread variants | `docs/integrations/tanstack-query.mdx`: “Quick start,” “Selective invalidation,” “Defaults and shared variants” |
| Framework snapshots, awaited mutation pending/outcome ownership, callback unmount distinction | TanStack integration: “Using definitions in components,” “Awaiting a mutation” |
| Group versus leaf keys, `DataTag`, optimistic cancellation and rollback | TanStack integration: “Keys and option factories,” “Mutations and invalidation” |
| `client.query` freshness, static reads, cancellation, observer reset/GC, error-type casts | Query reference “Imperative execution” and TanStack integration “Imperative use” |
| Direct service choice, mapping errors while retaining Results, SPA/SSR transport and client ownership | TanStack integration: “Imperative use,” “Result in, Result out,” “Client lifetime” |
| Fresh clients, cache fill, Err, static freshness with a service-call counter, successful/failed global invalidation, explicitly success-only policy | TanStack integration: “Testing”; assertion functions remain in Testing reference |
| Service success, validation prevents writes, duplicate error fields, thrown storage classification, missing-record contract, concurrency and real unique-constraint boundary | `docs/guides/testing-results.mdx`: self-contained Bun service example and following explanation, “Extend the checks to other boundaries” |
| Old factory/handle migration and native-options rationale | TanStack integration: “Migrating from 0.44”; unchanged `docs/adr/0001-result-namespaces-produce-native-tanstack-options.md` |
| Complete Logger task content, synchronous delivery contract, contained failures, async-work ownership, disposal, memory testing and Svelte history | Retained `docs/core/logger.mdx`: “Creating a logger” through “Framework adapters”; exact exports remain in Logger reference |

Focused examples ran successfully during this audit: strict example `tsc`, `bun run docs:snippets`, and all four canonical example files under Bun. The Query example now imports all six current functions. Whole-suite, rendered-preview and redirect results are recorded by the primary review after all content edits settle; this source audit does not substitute for those commands.

The final content check also confirmed the one-component optimistic preview uses `mutation.variables`, the shared-cache recipe retains cancellation/snapshot/rollback, and static freshness explicitly asserts one service call. The Query author independently typechecked and ran the integration's self-contained testing fence: four tests passed, covering cache/static/domain outcomes, global invalidation after success and failure, and the distinct success-only policy. The service-testing guide's content has been independently inspected; its author also executed the exact final fence with five passing tests and nine assertions, then passed a strict TypeScript check. That focused fence check used `skipLibCheck` for third-party declarations; the repository's packed consumer and canonical example checks retain their separate strict-library-checking proof.

The primary's pre-deletion proof passed with both temporary owners still present: frozen install, format, lint (one existing warning), typecheck, build, all 224 repository tests, canonical examples, packed consumer, both type-compatibility modes, runtime smoke, export coverage (82 tuples), claims (45 files), snippets and all 21 redirect mappings. These are dated refresh results, not the former July counts.

Content review therefore recommends removing exactly the temporarily retained `docs/integrations/testing.mdx` and `src/query/README.md` now. All newer concepts identified in the source audit have a surviving task, reference, or rationale owner, and focused example proof plus the primary's pre-deletion matrix passed. Preserve `docs/core/logger.mdx`, the Query ADR, historical specifications and changelog. The compatibility-notice removal is separately justified above; it does not authorize any additional deletion. The primary reruns the matrix after the exact two deletions before committing and updating the draft PR.

## Final evidence checklist

- [x] Compare all 23 removed owners with current-main baseline, rather than July alone.
- [x] Identify the two changed removed owners and the newer Logger/Query materials.
- [x] Separate deliberately dropped claims/scaffolding from contracts and workflows to preserve.
- [x] Verify every required concept above against the final integrated files and record exact owner sections, including the new service-testing guide.
- [ ] Remove the temporarily retained Testing integration/source Query README only after their newer content is migrated and reviewed.
- [x] Preserve the newer Logger guide and its URL.
- [x] Confirm configuration gives all 20 retired site routes plus the Hono compatibility route a direct existing destination; `bun run docs:redirects` passed for all 21 permanent routes. Deployment behavior remains subject to site publication.
- [ ] Run the final claims, exports, snippets, examples, packed consumer, compatibility, runtime, Mint and repository checks.
- [ ] Update PR #138 with this audit, current verification counts and any remaining limitations; leave the PR in draft.
