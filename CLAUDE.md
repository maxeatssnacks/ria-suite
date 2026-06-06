Project Constitution — RIA Compliance & Operations Suite
What we're building
A multi-tenant B2B SaaS platform for Registered Investment Advisors (RIAs). The platform is a shell that hosts a growing suite of AI-assisted compliance/operations tools (modules). Customers (RIA firms = tenants) activate modules individually; pricing is per-module.
First two modules (built later, after the shell):

Restricted Securities Screening (ACAT transfers vs. firm restricted lists)
Document Validation / Pre-Submission QC (expected form state vs. returned form state)

The current phase covers ONLY the platform shell: auth, tenancy, RBAC, audit logging, dashboard, admin console, agent runtime abstraction, background jobs, and notifications. Implementation proceeds via spec Parts A–G, provided one per session.
Locked stack — do not substitute without explicit approval
LayerChoiceMonorepoTurborepo + pnpmFrontendNext.js (App Router) + TypeScript + Tailwind + shadcn/uiBackendTypeScript. Next.js API routes / server actions for app logic; separate Fastify service ONLY if/when neededDatabasePostgreSQL via Supabase, with Row-Level Security (RLS) enforcedORMPrisma (with RLS-aware client pattern) or Supabase client where appropriate — ADR decided at Part BVector storepgvector extension in Supabase (deferred until first AI retrieval feature)AuthWorkOS (AuthKit) — email/password + Google OAuth now; SAML/SCIM laterFile storageCloudflare R2 (S3-compatible), tenant-prefixed keysLLMAnthropic API primary, behind a provider-agnostic abstractionBackground jobsInngestEmailResendHostingVercel (Next.js)Error trackingSentryLLM observabilityLangfuseIaCTerraform for anything outside Vercel/Supabase dashboards; keep minimal early
Non-negotiable conventions — apply to ALL work

Tenant isolation is enforced at the database layer (RLS), not just application code. Every tenant-scoped table has tenant_id and an RLS policy. No query path may bypass RLS except explicitly documented service-role operations (migrations, cross-tenant admin), which must be logged. Service-role code paths are catalogued in packages/db/SERVICE_ROLE_USAGE.md.
Every meaningful action is audit-logged. If a feature creates/updates/deletes domain data or calls an LLM, it writes an audit event through the typed audit client (packages/audit). No exceptions.
No client-side secrets. All provider keys live in server-side env vars. Every env var is documented in .env.example.
Soft deletes for domain data (deleted_at); hard deletes only via documented admin flows.
TypeScript strict mode everywhere. No any without an inline justification comment.
Zod schemas at every boundary (API input/output, LLM structured output, webhook payloads).
All timestamps UTC in the database, rendered in tenant-configured timezone in UI.
Currency/locale-aware formatting utilities — US-only market, but never hardcode formats inline.
No PII or prompt content in Sentry/analytics. Scrub before sending.
Conventional commits, one logical change per commit.
LLM calls only via enterprise API endpoints under no-training terms. Consumer endpoints are forbidden. All LLM calls go through packages/agent-runtime once it exists — never direct provider calls from business logic.

Roles (canonical RBAC)
RoleScopeDescriptionplatform_adminCross-tenantThe vendor (us). Support, provisioning. All actions heavily audited with required reason.tenant_adminTenantRIA's admin — manages users, modules, settings, integrationscomplianceTenantCCO/compliance staff — full read, approval rights on flagged itemssupervisorTenantReviews/approves within assigned scopeopsTenantDay-to-day operational useradvisorTenantLimited: own items onlyread_onlyTenantAuditors/examiners — read + export, no writes
Permission checks go through a single can(user, action, resource) helper in packages/core — never inline role string comparisons scattered through code.
Repo structure
/
├── apps/
│   └── web/                 # Next.js app (UI + API routes)
├── packages/
│   ├── db/                  # Prisma schema, migrations, RLS SQL, seed scripts
│   ├── core/                # Shared domain types, Zod schemas, permission helpers
│   ├── agent-runtime/       # LLM abstraction
│   ├── audit/               # Audit log client
│   └── ui/                  # Shared shadcn-based components
├── tooling/
│   ├── eslint/
│   └── tsconfig/
├── turbo.json
├── pnpm-workspace.yaml
└── .env.example
Working agreements with the human

Implement the spec as written. If you believe a spec instruction is wrong, outdated, or there's a better approach: STOP, explain the issue and your recommendation, and wait for a decision. Do not silently deviate.
Do not start a new spec Part until told. Parts have acceptance criteria; the human verifies them between sessions.
Ask before destructive operations (dropping tables, deleting migrations, force-pushing, rewriting history).
When a session involves a decision marked "ADR" or "decide at Part X": present options with tradeoffs, get a decision, then record it in docs/adr/NNNN-title.md (short format: context, decision, consequences).
End every working session by writing/updating docs/PROGRESS.md: which Part, what was completed, what deviated from spec (and why), open questions for planning. The human carries this back to the planning process.
Keep .env.example and README current as you add services and env vars.
Out-of-scope discipline: each spec Part lists out-of-scope items. Do not build them, even if convenient.
