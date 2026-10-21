---
name: query-layer
description: Apply Wellcrafted's current native TanStack Query integration. Use when implementing or reviewing service option namespaces, explicit Result adapters, cache policy, or imperative query/mutation calls.
---

# Query layer

Read the maintained [TanStack Query skill](../../../skills/tanstack-query/SKILL.md)
for usage and [query README](../../../src/query/README.md) for API details.
Verify exports against `src/query/index.ts` and inference/runtime behavior
against `src/query/{namespaces,utils}.ts`.

The consuming app selects reads and mutations and owns cache policy.
Wellcrafted derives keys and adapts Results into native options; TanStack owns
execution and observation. Application workflows keep their own lifetimes and
resource state. There is no client-bound factory, `.options` hop, or custom
execution method to preserve.
