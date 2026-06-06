# Implementation Progress

## Part A — Monorepo, Tooling, Dev Environment

**Status:** Complete  
**Date:** 2026-06-06

### What was completed

| Task                                              | Status | Notes                                                                                      |
| ------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| Turborepo + pnpm workspace init                   | ✅     | pnpm 11.5.2, Node 22 LTS pinned via `.nvmrc`                                               |
| `apps/web` — Next.js 15 App Router + TS strict    | ✅     | Turbopack for dev, standard webpack for build                                              |
| Tailwind CSS v4                                   | ✅     | Via `@tailwindcss/postcss`; `@theme inline` for CSS variable → utility mapping             |
| shadcn/ui initialized                             | ✅     | `components.json` configured; no components added yet                                      |
| Shared ESLint v9 flat config in `tooling/eslint`  | ✅     | Must include `files: ['**/*.ts','**/*.tsx']` — ESLint v9 doesn't match TS files without it |
| Shared tsconfig in `tooling/tsconfig`             | ✅     | base / nextjs / react-library variants                                                     |
| Stub packages: db, core, agent-runtime, audit, ui | ✅     | `export {}` placeholders; each has lint + typecheck scripts                                |
| `packages/db/SERVICE_ROLE_USAGE.md`               | ✅     | Empty catalogue, required by CLAUDE.md                                                     |
| GitHub Actions CI                                 | ✅     | lint → typecheck → test → build; pnpm version from `packageManager` field                  |
| Husky pre-commit: lint-staged + typecheck         | ✅     | Prettier on staged files, full `turbo typecheck`                                           |
| README                                            | ✅     | < 15 min onboarding instructions                                                           |
| `.env.example`                                    | ✅     | All future vars with part references                                                       |

### Deviations from spec

None. All items in the Part A spec were implemented as written.

### Decisions made (not ADRs — no architectural choices required at Part A)

- **pnpm v11** (not v9): Corepack resolved to pnpm 11.5.2. No functional difference for Part A;
  if a constraint requires v9 specifically, flag at Part B.
- **ESLint v9 flat config** used throughout. `apps/web` uses `FlatCompat` to bridge
  `eslint-config-next` (which still ships legacy format) into flat config.
- **`@theme inline`** directive required in Tailwind v4 to generate semantic color utilities
  (`bg-background`, `text-muted-foreground`, `border-border`, etc.) from CSS custom properties.
  Without it, `@apply border-border` fails at build time.
- **`pnpm-workspace.yaml` `allowBuilds`**: pnpm 11 requires explicit build approval for
  `sharp` and `unrs-resolver` (Next.js transitive deps). Both approved.

### Open questions for planning (carry into Part B session)

1. **ORM decision** — spec says "Prisma (with RLS-aware client pattern) or Supabase client where
   appropriate — ADR decided at Part B." Please bring a decision to the Part B session.
2. **WorkOS tenant model** — does the `Organization` in WorkOS map 1:1 to a `tenant` row in our
   DB, or do we need an intermediate mapping? Affects schema design in Part B.
3. **Module field in `packages/*` tsconfig** — currently using `"module": "NodeNext"` for
   non-UI packages. If any package needs to be imported by the Next.js app directly (not through
   `transpilePackages`), this may need to change to `"Bundler"`. Revisit if import errors appear
   in Part B.
