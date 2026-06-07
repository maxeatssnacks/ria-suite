# RIA Compliance & Operations Suite

A multi-tenant B2B SaaS platform for Registered Investment Advisors (RIAs), providing
AI-assisted compliance and operations tools.

## Prerequisites

| Tool                           | Version | Install           |
| ------------------------------ | ------- | ----------------- |
| [Node.js](https://nodejs.org/) | v22 LTS | `nvm install 22`  |
| [pnpm](https://pnpm.io/)       | v11+    | `corepack enable` |
| [Git](https://git-scm.com/)    | any     | —                 |

> **Using nvm?** Run `nvm use` in the repo root — `.nvmrc` pins Node 22.

## Setup (< 15 minutes on a new machine)

```bash
# 1. Clone
git clone <repo-url>
cd ria

# 2. Switch to the correct Node version
nvm use            # or: nvm install $(cat .nvmrc)

# 3. Activate pnpm via Corepack (built into Node 22)
corepack enable

# 4. Install all workspace dependencies
pnpm install

# 5. Copy environment template
cp .env.example .env.local
# Open .env.local and fill in credentials — see .env.example for descriptions.
# For the initial shell (Part A), no env vars are required to run the app.

# 6. Start the dev server
pnpm dev
```

The app is now running at **http://localhost:3000**.

## Development Commands

| Command          | Description                               |
| ---------------- | ----------------------------------------- |
| `pnpm dev`       | Start all packages in watch/dev mode      |
| `pnpm build`     | Production build (all packages)           |
| `pnpm lint`      | ESLint across the monorepo                |
| `pnpm typecheck` | TypeScript type-check across the monorepo |
| `pnpm test`      | Run all tests                             |
| `pnpm format`    | Format all files with Prettier            |

## Monorepo Structure

```
apps/
  web/              Next.js 15 app — App Router, UI + API routes
packages/
  db/               Prisma schema, migrations, RLS SQL (Part B)
  core/             Domain types, Zod schemas, can() permission helper (Part C)
  agent-runtime/    Provider-agnostic LLM abstraction (Part G)
  audit/            Typed audit log client (Part E)
  ui/               Shared shadcn/ui component library
tooling/
  eslint/           Shared ESLint flat config (@ria/eslint-config)
  tsconfig/         Shared TypeScript configs (@ria/tsconfig)
```

## Database (Part B)

### Local development

Tests spin up an embedded PostgreSQL 18.4 instance automatically — no Docker or external DB needed.

```bash
pnpm test                # starts embedded PG, runs migration SQL, runs 31 tests, stops PG
```

### Hosted deployment (Supabase or any PostgreSQL)

Set two connection strings in your `.env` (see `.env.example` for descriptions):

| Variable       | What it points to                                                                   |
| -------------- | ----------------------------------------------------------------------------------- |
| `DATABASE_URL` | Pooled connection (pgBouncer / Supabase transaction pooler, port 6543)              |
| `DIRECT_URL`   | Direct / session-mode connection (bypasses pooler, port 5432) — used for migrations |

Then from the repo root:

```bash
# 1. Apply all pending migrations to the hosted DB
pnpm --filter @ria/db db:deploy

# 2. Seed demo data (2 tenants × 6 roles, 4 modules) — dev/staging only
pnpm --filter @ria/db db:seed

# 3. (Optional) Verify RLS is enabled on every tenant-scoped table
pnpm --filter @ria/db db:check-rls
```

> **Re-running migrations**: `prisma migrate deploy` is idempotent — already-applied migrations are skipped. Safe to run on every deploy.

> **`app_user` runtime pattern**: The app does **not** connect as `app_user` directly. Instead,
> `DATABASE_URL` points to the pooler using the superuser/pooler role (e.g. Supabase's `postgres`).
> The `forTenant()` helper in `packages/db` issues `SET LOCAL ROLE app_user` inside every
> transaction, switching to the restricted role for the duration of that transaction only.
> Migration `20260607000001` grants `app_user` membership to the connecting role automatically
> on hosted Postgres (where `postgres` is not a superuser). `app_user` remains `NOLOGIN`.

### Regenerate Prisma client after schema changes

```bash
pnpm --filter @ria/db db:generate
```

## Architecture & Conventions

See [CLAUDE.md](./CLAUDE.md) for the full project constitution: locked stack, non-negotiable
conventions, canonical RBAC roles, and working agreements.

## Contributing

- Follow [Conventional Commits](https://www.conventionalcommits.org/) — one logical change per commit
- A pre-commit hook runs Prettier (lint-staged) and full typecheck automatically
- CI runs lint → typecheck → test → build on every PR
