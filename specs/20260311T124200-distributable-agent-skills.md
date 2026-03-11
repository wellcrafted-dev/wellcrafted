# Distributable Agent Skills

**Date**: 2026-03-11
**Status**: Approved
**Author**: AI-assisted

## Overview

Ship AI agent skills alongside the wellcrafted npm package so that any project using wellcrafted can teach their coding agents how to use it correctly. Users install with `npx skills add wellcrafted-dev/wellcrafted`.

## Motivation

### Current State

wellcrafted has 20 skills in `.claude/skills/` that teach agents how to use the library. They're excellent — detailed patterns, anti-patterns, real code examples. But they're locked to this repo. They reference Whispering-specific code (`apps/whispering/src/lib/services/...`), internal architecture (`RecorderService`, `DeviceStreamError`), and project-specific patterns (Tauri, platform detection).

A developer who `npm install wellcrafted` gets the library but their AI agent has no idea how to use it. The agent will guess at patterns, produce `as any` casts, miss the `{ data, error }` destructuring idiom, and create class-based errors instead of `defineErrors` variants.

### Desired State

```bash
npm install wellcrafted              # the library
npx skills add wellcrafted-dev/wellcrafted  # teach your agent how to use it
```

After installing skills, an agent writing code in the user's project knows:
- How to define error variants with `defineErrors` (and what NOT to do)
- How to wrap unsafe code with `trySync`/`tryAsync`
- How to use `Ok`, `Err`, and the `{ data, error }` destructuring pattern
- How to compose errors across service boundaries
- How to use `Brand<T>` with brand constructors
- How to set up TanStack Query with wellcrafted's dual interface

## Research Findings

### How `npx skills` Works

The CLI (by Vercel Labs) supports any GitHub repository as a skill source. No registry, no approval process.

| Aspect | How it works |
|---|---|
| Discovery | Scans `skills/`, root, `curated/skills/`, agent-specific dirs for `SKILL.md` files |
| File format | Markdown with YAML frontmatter (`name`, `description`) |
| Installation | Copies/symlinks into `.claude/skills/`, `.cursor/rules/`, etc. |
| Selection | Interactive: user picks which skills and which agents |
| Updates | `npx skills update` pulls latest from the repo |

Publishing is push-to-GitHub: `npx skills add <owner>/<repo>`.

### Existing Skill Content Audit

Reviewed all 20 `.claude/skills/` to classify what's distributable vs project-specific.

**Directly distributable (wellcrafted API patterns):**

| Current skill | What it teaches | Adaptation needed |
|---|---|---|
| `define-errors` | `defineErrors` API, variant patterns, anti-patterns | Strip Whispering examples, use generic domains |
| `error-handling` | `trySync`/`tryAsync`, wrapping patterns | Remove Elysia/handler-specific sections, generalize |
| `services-layer` | Service architecture with Result types | Heavy rewrite — too Whispering-specific |
| `query-layer` | TanStack Query integration | Moderate rewrite — remove Whispering RPC structure |

**Partially distributable (general patterns using wellcrafted):**

| Current skill | Assessment |
|---|---|
| `control-flow` | Good patterns but only tangentially wellcrafted-specific |
| `factory-function-composition` | General TS pattern, not wellcrafted-specific |
| `single-or-array-pattern` | General TS pattern, not wellcrafted-specific |
| `typescript` | Brand types section is relevant; rest is general style |

**Not distributable (project/framework-specific):**

`workflow`, `specification-writing`, `writing-voice`, `honesty`, `git`, `incremental-commits`, `progress-summary`, `testing`, `social-media`, `technical-articles`, `github-issues`, `method-shorthand-jsdoc`, `monorepo`, `spec-execution`, `svelte`, `elysia`, `tauri`, `drizzle-orm`, `arktype`, `typebox`, `yjs`, `workspace-api`, `styling`, `frontend-design`, `web-design-guidelines`, all `better-auth-*`, `create-auth-skill`, `rust-errors`, `sync-construction-async-property-ui-render-gate-pattern`

### How Other Libraries Ship Skills

No major npm library currently ships agent skills alongside code. This would be a first-mover pattern. The closest analogs are:
- `vercel-labs/agent-skills` — standalone skill repos (not library-attached)
- Project-specific `.claude/skills/` — not distributed

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Skill directory | `skills/` at repo root | Standard location for `npx skills` discovery |
| Skill granularity | One skill per package export + one style guide | Maps to `wellcrafted/error`, `wellcrafted/result`, etc. plus a `patterns` skill for architectural taste |
| Naming | `define-errors`, `result-types`, `query-factories`, `branded-types`, `patterns` | Descriptive, matches API concepts. No `wellcrafted-` prefix — repo context provides that (same convention as vercel-labs) |
| Internal skills | Keep `.claude/skills/` as-is | Project-specific patterns still needed for contributing to wellcrafted itself |
| Example domains | HTTP clients, user services, file operations | Universal, no framework dependency |
| Skill voice | Direct, concrete, pattern-focused | Follows writing-voice: lead with the point, show mechanism not marketing |
| Anti-patterns | Include prominently | The "what NOT to do" sections are the most valuable part for agents |
| Style guide skill | Bundle control-flow, factory composition, service layer into one `patterns` skill | Architectural taste that complements the API reference skills |

## Architecture

```
wellcrafted/
├── .claude/skills/          ← Internal: for contributing to wellcrafted
│   ├── define-errors/
│   ├── error-handling/
│   ├── services-layer/
│   └── ... (20 skills)
│
├── skills/                  ← Distributable: for USERS of wellcrafted
│   ├── define-errors/
│   │   └── SKILL.md
│   ├── result-types/
│   │   └── SKILL.md
│   ├── query-factories/
│   │   └── SKILL.md
│   ├── branded-types/
│   │   └── SKILL.md
│   └── patterns/
│       └── SKILL.md
│
├── src/                     ← Library source
│   ├── error/
│   ├── result/
│   ├── query/
│   └── brand.ts
└── README.md                ← Updated with skills install instructions
```

Two tiers, clearly separated:
- **`skills/`** — generic, any-project, teaches the wellcrafted API
- **`.claude/skills/`** — project-specific, teaches wellcrafted's own codebase patterns

## Skill Specifications

### 1. `define-errors` — Defining Error Variants

**Maps to**: `wellcrafted/error`

**Teaches**: `defineErrors`, `extractErrorMessage`, `InferErrors`, `InferError`

**Structure**:
- Import statement
- Core rules (all variants in one call, factory returns `{ message, ...fields }`, `cause: unknown` as a field, `extractErrorMessage` inside factory, each call returns `Err<...>`, shadow const with type, variant names describe failure modes)
- Patterns: zero-arg static message, structured fields with computed message, cause wrapping, multiple variants as discriminated union, single variant type extraction
- Anti-patterns: one `defineErrors` per variant, `extractErrorMessage` at call site, generic variant names (`Service`, `Error`, `Failed`), discriminated union inputs (string literal sub-discriminants), conditional logic in factories, monolithic catch-all variants
- Composing errors across layers (service errors become `cause` in higher-level errors)

**Adaptation from internal skill**:
- Keep: all core rules, all patterns, all anti-patterns (these are already generic)
- Strip: Whispering-specific examples (`RecorderError`, `DeviceStreamError`, `FfmpegError`)
- Replace with: generic domains (`HttpError`, `DbError`, `FileError`, `UserError`, `JsonError`)
- Add: brief "how it connects to Result types" bridge to `result-types` skill

### 2. `result-types` — Working with Results

**Maps to**: `wellcrafted/result`

**Teaches**: `Ok`, `Err`, `trySync`, `tryAsync`, `Result<T, E>`, `isOk`, `isErr`, `unwrap`, `resolve`, `partitionResults`

**Structure**:
- The `{ data, error }` shape and why (Supabase, SvelteKit familiarity)
- `Ok()` and `Err()` constructors
- `trySync` for synchronous operations, `tryAsync` for async
- Key rules: choose right function, always await tryAsync, match return types, `Ok(undefined)` for void, `Err` for propagation
- Recovery pattern: `catch` returns `Ok(fallback)` instead of `Err` — narrows to `Ok<T>`
- Wrapping guidelines: minimal wrap (only the risky operation), immediate return pattern, when to extend the try block
- The destructured-error gotcha: `{ data, error }` gives raw error, must wrap with `Err()` before returning
- Utility functions: `isOk`/`isErr` type guards, `unwrap`, `resolve`, `partitionResults`

**Adaptation from internal skill**:
- Keep: wrapping principles, immediate return pattern, key rules, destructured-error gotcha
- Strip: Elysia/HTTP handler sections (too framework-specific), Whispering code examples
- Replace with: generic examples (JSON parsing, file operations, API calls, database queries)
- Add: `Ok`/`Err` constructor docs, utility function docs, recovery pattern

### 3. `query-factories` — TanStack Query Integration

**Maps to**: `wellcrafted/query`

**Teaches**: `createQueryFactories`, `defineQuery`, `defineMutation`, dual interface (`.options` vs callable)

**Structure**:
- Setup: `createQueryFactories(queryClient)`
- `defineQuery` with `queryKey` and `queryFn` returning `Result<T, E>`
- `defineMutation` with `mutationFn` returning `Result<T, E>`
- Dual interface: `.options` for reactive frameworks (React/Svelte), `.fetch()`/`.execute()` for imperative use
- Error transformation at query boundary (service errors → user-facing errors)
- Query key organization patterns
- Cache management with optimistic updates

**Adaptation from internal skill**:
- Keep: dual interface pattern, error transformation, cache management
- Strip: Whispering-specific RPC namespace, service selection pattern, Svelte-specific syntax
- Replace with: framework-agnostic examples (show both React and Svelte patterns briefly)
- Significantly shorter than internal version — focus on the wellcrafted-specific API

### 4. `branded-types` — Type-Safe Distinct Primitives

**Maps to**: `wellcrafted/brand`

**Teaches**: `Brand<T>`, brand constructor pattern

**Structure**:
- What branded types solve (mixing up `UserId` and `OrderId`)
- The `Brand<T>` type
- Brand constructor pattern (PascalCase function matching type name)
- Why brand constructors over scattered `as` casts
- When to add runtime validation

**Adaptation from internal skill**:
- Extracted from `typescript` skill's "Branded Types Pattern" section
- Keep: brand constructor pattern, naming convention, rationale
- Strip: arktype-specific brand pipe pattern, workspace table references
- Add: standalone motivation example, import statement

### 5. `patterns` — Architectural Style Guide

**Maps to**: no single export — cross-cutting patterns for code that uses wellcrafted

**Teaches**: How to structure code that uses wellcrafted idiomatically. Not API reference — architectural taste.

**Structure**:
- Human-readable control flow: guard clauses with `trySync`/`tryAsync`, early returns, linearizing nested conditionals, natural-language boolean variables
- Factory function composition: `createX(deps, options?) → { methods }`, the universal signature, separating client/service/method options, zone ordering (immutable state → mutable state → private helpers → public API)
- Service layer patterns: factory functions returning `Result<T, E>`, `defineErrors` per service domain, export factory + Live instance, namespace re-exports
- Error composition across layers: service errors as `cause` in higher-level errors, transforming errors at layer boundaries
- The single-or-array pattern: `T | T[]` input, normalize with `Array.isArray`, one code path

**Adaptation from internal skills**:
- Merged from: `control-flow`, `factory-function-composition`, `services-layer`, `single-or-array-pattern`
- Keep: all patterns and anti-patterns (already mostly generic)
- Strip: all Whispering-specific examples, file paths, Tauri platform detection
- Replace with: generic service examples (UserService, HttpClient, FileService)
- Tone: this is a style guide, not API docs — "here's how we think code should look when using wellcrafted"
## Writing Guidelines for Skills

Each skill follows these principles (from writing-voice):

1. **Lead with the point** — import statement and core rules first, not motivation
2. **Show mechanism, not marketing** — code patterns, not "defineErrors provides a clean..." prose
3. **Concrete over abstract** — every rule has a code example
4. **Anti-patterns are first-class** — agents learn more from "don't do this" than "do this"
5. **No project-specific references** — every example should work in any TypeScript project
6. **Cross-reference between skills** — brief "See also: `result-types` skill" bridges
7. **Minimal prose between code blocks** — the code IS the documentation
8. **No emojis, no bold-everything, no bullet-list-everything** — natural, direct voice

## Implementation Plan

### Phase 1: Create skill directory and define-errors skill

- [x] **1.1** Create `skills/` directory at repo root
- [x] **1.2** Write `skills/define-errors/SKILL.md` — adapted from internal skill with generic examples
- [x] **1.3** Verify `npx skills add . --list` discovers the skill locally

### Phase 2: Create remaining skills

- [x] **2.1** Write `skills/result-types/SKILL.md` — adapted from error-handling skill + new content
- [x] **2.2** Write `skills/query-factories/SKILL.md` — adapted from query-layer skill
- [x] **2.3** Write `skills/branded-types/SKILL.md` — extracted from typescript skill
- [x] **2.4** Write `skills/patterns/SKILL.md` — merged from control-flow, factory-function-composition, services-layer, single-or-array-pattern

### Phase 3: Documentation and testing

- [ ] **3.1** Update README.md with skills installation section
- [ ] **3.2** Test installation: `npx skills add . --list` shows all 5 skills
- [ ] **3.3** Test installation: `npx skills add . --skill define-errors -a claude-code -y` works

## Open Questions

1. **Should the skills reference the README or be self-contained?**
   - Self-contained is better for agents (no need to fetch external docs)
   - But there's duplication risk with the README
   - Recommendation: skills are self-contained with all patterns; README provides the high-level story. Skills go deeper on patterns and anti-patterns than the README does.

2. **Versioning strategy for skills vs library?**
   - Skills content should match the current API
   - `npx skills update` pulls latest from main branch
   - Recommendation: no separate versioning — skills live in the same repo and stay in sync naturally

## Success Criteria

- [ ] `npx skills add wellcrafted-dev/wellcrafted --list` shows 5 skills
- [ ] Each skill has YAML frontmatter with `name` and `description`
- [ ] No project-specific references (no "Whispering", no "apps/", no "Tauri")
- [ ] Every rule has a code example
- [ ] Every anti-pattern has a "wrong" and "right" code block
- [ ] Import paths use `wellcrafted/error`, `wellcrafted/result`, etc.
- [ ] README documents the skills installation
- [ ] Skills are discoverable by agents via description matching

## References

- `.claude/skills/define-errors/SKILL.md` — primary source for define-errors skill
- `.claude/skills/error-handling/SKILL.md` — primary source for result-types skill
- `.claude/skills/query-layer/SKILL.md` — primary source for query-factories skill
- `.claude/skills/typescript/SKILL.md` — branded types section for branded-types skill
- `.claude/skills/services-layer/SKILL.md` — primary source for patterns skill (service layer section)
- `.claude/skills/control-flow/SKILL.md` — primary source for patterns skill (control flow section)
- `.claude/skills/factory-function-composition/SKILL.md` — primary source for patterns skill (factory section)
- `.claude/skills/single-or-array-pattern/SKILL.md` — primary source for patterns skill (single-or-array section)
- `README.md` — current API documentation and examples
- `npx skills --help` — CLI documentation
