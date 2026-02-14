# Wellcrafted

Lightweight TypeScript library for type-safe error handling, Result types, branded types, and TanStack Query integration. Zero dependencies, < 2KB.

Structure: `src/result/` (Result types, trySync/tryAsync), `src/error/` (createTaggedError), `src/query/` (TanStack Query factories), `src/brand.ts` (branded types), `src/standard-schema/` (Standard Schema integration), `specs/` (planning docs), `docs/` (reference materials).

Always use bun: `bun run`, `bun test`, `bun install`. Build with `bun run build` (tsdown). Format with `bun run format` (biome). Lint with `bun run lint` (biome). Typecheck with `bun run typecheck` (tsc).

Skills: Task-specific instructions live in `.claude/skills/`. They are symlinked from the Epicenter repo (see README.md for setup). Load on-demand based on the task.
