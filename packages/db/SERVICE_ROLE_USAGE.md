# Service-Role Usage Catalogue

This file documents every code path that uses the Supabase service-role key, bypassing
Row-Level Security (RLS). Entries are mandatory per the project constitution (CLAUDE.md).

## Format

Each entry must include:

- **Path**: file + function/route
- **Reason**: why RLS bypass is required
- **Audit**: whether an audit log event is written (must be YES)
- **Added**: date added

## Entries

_None yet. This catalogue grows as service-role paths are added (starting Part B)._

## Guidelines

- Service-role clients MUST only be instantiated in server-side code (API routes, server actions, Inngest handlers, migration scripts)
- Each use MUST be accompanied by a write to the audit log via `@ria/audit`
- No service-role client may be instantiated or referenced in client components or `NEXT_PUBLIC_*` code paths
- This file is reviewed during every security review
