# Brand JSDoc Update + Validation Libraries Guide

## Summary

Update Brand documentation to highlight two key selling points:
1. **Composition** — hierarchical brands, multiple inheritance, deep chains
2. **Framework-agnostic** — unlike Zod/ArkType/Valibot built-in brands, wellcrafted's `Brand<T>` works with ANY runtime validator

Also create a new integration guide for using Brand with validation libraries, and fix README typos.

## Tasks

### Task 1: Update JSDoc in `src/brand.ts`
- [ ] Expand existing JSDoc to add:
  - Framework-agnostic section with comparison to built-in brands
  - Dual-declaration pattern (same name for type + const) inspired by [same-name-for-type-and-value article](file:///Users/braden/Code/epicenter/docs/articles/same-name-for-type-and-value.md)
  - New `@example` blocks showing Brand with ArkType (`.pipe`), Zod (`.transform`), Valibot (`v.pipe(v.transform())`)
  - `@see` link to new docs page
- Keep existing composition examples (they're already good)

### Task 2: Create `docs/integrations/validation-libraries.mdx`
- [ ] New Mintlify doc covering:
  - The lock-in problem: each library has proprietary brand types (`z.$brand`, ArkType's `Brand<t, id>`, Valibot's brand action)
  - The solution: define types with `Brand<T>`, plug into any validator
  - Dual-declaration pattern with "naming tax" contrast (Zod `userSchema` + `User` vs unified `FileId`)
  - Library-specific examples: ArkType, Zod v4, Valibot v1
  - Composition advantage: hierarchical brands that built-in brands can't do
  - Real validation example (not just passthrough casting)

### Task 3: Update `docs/docs.json`
- [ ] Add `"integrations/validation-libraries"` to the `🔌 Integrations` nav group

### Task 4: Fix `README.md` Brand typos
- [ ] Line 49: `Brand<string, "UserId">` → `string & Brand<"UserId">`
- [ ] Line 50: `Brand<string, "OrderId">` → `string & Brand<"OrderId">`

### Task 5: Fix `README_MD.md` Brand typos
- [ ] Lines 184-185, 753-755, 912-913: same fix (`Brand<string, X>` → `string & Brand<X>`)

## Dependencies

- Tasks 1, 2, 4, 5 are independent (can run in parallel)
- Task 3 depends on Task 2 existing

## Delegation Plan

| Task | Category | Skills | Notes |
|------|----------|--------|-------|
| 1 | `quick` | — | JSDoc update, single file |
| 2 | `writing` | — | New docs page, Mintlify format |
| 3 | `quick` | — | Single line in JSON |
| 4-5 | `quick` | — | Find-replace typos |

## Review

All 5 tasks completed. 80 tests pass, typecheck clean.

### Changes made

| File | Change |
|------|--------|
| `src/brand.ts` | Expanded JSDoc from 40 → 97 lines. Added "Why wellcrafted Brand?" section covering composable, framework-agnostic, dual-declaration benefits. Added 2 new `@example` blocks (dual-declaration + framework-agnostic with ArkType/Zod/Valibot). Added `@see` link to new docs page. |
| `docs/integrations/validation-libraries.mdx` | New 170-line guide. Covers: lock-in problem with proprietary brand types, the pattern (decouple type from validator), same-name dual-declaration with naming-tax contrast, hierarchical composition advantage, real validation examples. Uses Mintlify `<Tabs>` for multi-library code samples. |
| `docs/docs.json` | Added `"integrations/validation-libraries"` as first item in Integrations nav group. |
| `README.md` | Fixed 2 occurrences of `Brand<string, "X">` → `string & Brand<"X">` to match actual API. |
| `README_MD.md` | Fixed 7 occurrences of same typo across 3 code blocks. |

### Verification
- `bun test`: 80 pass, 0 fail
- `tsc --noEmit`: clean
- `lsp_diagnostics` on `src/brand.ts`: no diagnostics
- All `Brand<string, ...>` typos eliminated from markdown files
