# Wellcrafted

Lightweight TypeScript library for type-safe error handling, Result types, branded types, and TanStack Query integration. Zero dependencies, < 2KB.

Structure: `src/result/` (Result types, trySync/tryAsync), `src/error/` (defineErrors), `src/query/` (TanStack Query factories), `src/brand.ts` (branded types), `src/standard-schema/` (Standard Schema integration), `skills/` (distributable agent skills for library users), `specs/` (planning docs), `docs/` (reference materials).

Always use bun: `bun run`, `bun test`, `bun install`. Build with `bun run build` (tsdown). Format with `bun run format` (biome). Lint with `bun run lint` (biome). Typecheck with `bun run typecheck` (tsc).

Skills: Internal skills for contributing to wellcrafted live in `.claude/skills/`. Distributable skills for users of the library live in `skills/` (installed via `npx skills add wellcrafted-dev/wellcrafted`).
