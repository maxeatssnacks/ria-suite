-- ============================================================
-- RIA Platform — Initial Schema
-- Includes: restricted role, tables, RLS policies, grants
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- RESTRICTED APPLICATION ROLE
-- app_user has no BYPASSRLS, no SUPERUSER, no table ownership.
-- Application connects as app_user for all tenant-scoped work.
-- ────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN NOINHERIT;
  END IF;
END
$$;

-- ────────────────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────────────────

CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended', 'trial');
CREATE TYPE "IsolationTier" AS ENUM ('logical', 'dedicated_db', 'dedicated_deploy');
CREATE TYPE "UserStatus" AS ENUM ('active', 'invited', 'disabled');
CREATE TYPE "TenantRole" AS ENUM (
  'platform_admin', 'tenant_admin', 'compliance',
  'supervisor', 'ops', 'advisor', 'read_only'
);
CREATE TYPE "MembershipStatus" AS ENUM ('active', 'invited', 'disabled');
CREATE TYPE "ModuleStatus" AS ENUM ('alpha', 'beta', 'ga', 'deprecated');
CREATE TYPE "TenantModuleStatus" AS ENUM ('active', 'trial', 'suspended');

-- ────────────────────────────────────────────────────────────
-- TABLES
-- All DateTime columns stored as TIMESTAMPTZ; values must be UTC.
-- ────────────────────────────────────────────────────────────

-- tenants — no tenant_id (this IS the tenant)
CREATE TABLE "tenants" (
  "id"             UUID          NOT NULL DEFAULT gen_random_uuid(),
  "name"           TEXT          NOT NULL,
  "slug"           TEXT          NOT NULL,
  "status"         "TenantStatus"  NOT NULL DEFAULT 'active',
  "isolation_tier" "IsolationTier" NOT NULL DEFAULT 'logical',
  "settings"       JSONB         NOT NULL DEFAULT '{}',
  "timezone"       TEXT          NOT NULL DEFAULT 'America/New_York',
  "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "deleted_at"     TIMESTAMPTZ,
  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants" ("slug")
  WHERE "deleted_at" IS NULL;

-- users — no tenant_id; isolated via membership join
CREATE TABLE "users" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
  "workos_user_id" TEXT        NOT NULL,
  "email"          TEXT        NOT NULL,
  "name"           TEXT        NOT NULL,
  "status"         "UserStatus"  NOT NULL DEFAULT 'active',
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at"     TIMESTAMPTZ,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_workos_user_id_key" ON "users" ("workos_user_id");

-- tenant_memberships — tenant-scoped
CREATE TABLE "tenant_memberships" (
  "id"         UUID              NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"  UUID              NOT NULL,
  "user_id"    UUID              NOT NULL,
  "role"       "TenantRole"      NOT NULL,
  "status"     "MembershipStatus" NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  CONSTRAINT "tenant_memberships_pkey"      PRIMARY KEY ("id"),
  CONSTRAINT "tenant_memberships_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id"),
  CONSTRAINT "tenant_memberships_user_fk"   FOREIGN KEY ("user_id")   REFERENCES "users"   ("id")
);

CREATE UNIQUE INDEX "tenant_memberships_tenant_user_key"
  ON "tenant_memberships" ("tenant_id", "user_id");

-- modules — global catalog; no tenant_id
CREATE TABLE "modules" (
  "id"          UUID          NOT NULL DEFAULT gen_random_uuid(),
  "key"         TEXT          NOT NULL,
  "name"        TEXT          NOT NULL,
  "description" TEXT          NOT NULL DEFAULT '',
  "status"      "ModuleStatus"  NOT NULL DEFAULT 'alpha',
  CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "modules_key_key" ON "modules" ("key");

-- tenant_modules — tenant-scoped
CREATE TABLE "tenant_modules" (
  "id"           UUID                NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"    UUID                NOT NULL,
  "module_id"    UUID                NOT NULL,
  "status"       "TenantModuleStatus"  NOT NULL DEFAULT 'trial',
  "activated_at" TIMESTAMPTZ,
  "config"       JSONB               NOT NULL DEFAULT '{}',
  CONSTRAINT "tenant_modules_pkey"      PRIMARY KEY ("id"),
  CONSTRAINT "tenant_modules_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id"),
  CONSTRAINT "tenant_modules_module_fk" FOREIGN KEY ("module_id") REFERENCES "modules"  ("id")
);

CREATE UNIQUE INDEX "tenant_modules_tenant_module_key"
  ON "tenant_modules" ("tenant_id", "module_id");

-- audit_events — tenant-scoped; full design in Part E
CREATE TABLE "audit_events" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"   UUID,
  "actor_id"    UUID,
  "actor_role"  "TenantRole",
  "action"      TEXT        NOT NULL,
  "resource"    TEXT        NOT NULL,
  "resource_id" TEXT,
  "metadata"    JSONB       NOT NULL DEFAULT '{}',
  "ip_address"  TEXT,
  "user_agent"  TEXT,
  "reason"      TEXT,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "audit_events_pkey"      PRIMARY KEY ("id"),
  CONSTRAINT "audit_events_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id")
);

CREATE INDEX "audit_events_tenant_id_idx"  ON "audit_events" ("tenant_id");
CREATE INDEX "audit_events_created_at_idx" ON "audit_events" ("created_at");

-- invitations — tenant-scoped
CREATE TABLE "invitations" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"   UUID        NOT NULL,
  "email"       TEXT        NOT NULL,
  "role"        "TenantRole"  NOT NULL,
  "token_hash"  TEXT        NOT NULL,
  "expires_at"  TIMESTAMPTZ NOT NULL,
  "accepted_at" TIMESTAMPTZ,
  "created_by"  UUID        NOT NULL,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "invitations_pkey"      PRIMARY KEY ("id"),
  CONSTRAINT "invitations_tenant_fk" FOREIGN KEY ("tenant_id")  REFERENCES "tenants" ("id"),
  CONSTRAINT "invitations_user_fk"   FOREIGN KEY ("created_by") REFERENCES "users"   ("id")
);

CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations" ("token_hash");
CREATE INDEX "invitations_tenant_id_idx" ON "invitations" ("tenant_id");

-- api_keys — tenant-scoped (placeholder; full implementation in Part F)
CREATE TABLE "api_keys" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"    UUID        NOT NULL,
  "name"         TEXT        NOT NULL,
  "key_hash"     TEXT        NOT NULL,
  "last_used_at" TIMESTAMPTZ,
  "created_by"   UUID        NOT NULL,
  "revoked_at"   TIMESTAMPTZ,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "api_keys_pkey"      PRIMARY KEY ("id"),
  CONSTRAINT "api_keys_tenant_fk" FOREIGN KEY ("tenant_id")  REFERENCES "tenants" ("id"),
  CONSTRAINT "api_keys_user_fk"   FOREIGN KEY ("created_by") REFERENCES "users"   ("id")
);

CREATE UNIQUE INDEX "api_keys_key_hash_key"   ON "api_keys" ("key_hash");
CREATE INDEX "api_keys_tenant_id_idx" ON "api_keys" ("tenant_id");

-- ────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS
-- ────────────────────────────────────────────────────────────

-- Returns the current tenant UUID from the transaction-local config.
-- Returns NULL if not set — all RLS USING clauses fail to NULL (deny).
CREATE OR REPLACE FUNCTION get_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY INVOKER PARALLEL SAFE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$;

-- Returns the current user UUID from the transaction-local config.
CREATE OR REPLACE FUNCTION get_user_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY INVOKER PARALLEL SAFE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$;

-- Returns the calling user's role in the current tenant.
-- SECURITY DEFINER (runs as owner = postgres) to avoid RLS recursion
-- when write policies on tenant_memberships call this function.
-- SET search_path prevents search_path injection.
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS "TenantRole"
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public PARALLEL SAFE
AS $$
  SELECT role
  FROM   tenant_memberships
  WHERE  tenant_id = get_tenant_id()
    AND  user_id   = get_user_id()
    AND  status    = 'active'
  LIMIT  1;
$$;

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- FORCE ensures even the table owner is subject to RLS.
-- Superusers (service_role) always bypass — see SERVICE_ROLE_USAGE.md.
-- ────────────────────────────────────────────────────────────

-- tenants ────────────────────────────────────────────────────
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;

-- A tenant can see only its own row when context is set.
-- Lookups by slug (pre-auth) must use service_role — see SERVICE_ROLE_USAGE.md.
CREATE POLICY "tenants_select" ON "tenants"
  FOR SELECT USING (id = get_tenant_id());

-- users ──────────────────────────────────────────────────────
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;

-- A user is visible to callers sharing a tenant membership with them.
CREATE POLICY "users_select" ON "users"
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM   "tenant_memberships" m
      WHERE  m.user_id   = "users"."id"
        AND  m.tenant_id = get_tenant_id()
    )
  );

-- tenant_memberships ─────────────────────────────────────────
ALTER TABLE "tenant_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_memberships" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_memberships_select" ON "tenant_memberships"
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE POLICY "tenant_memberships_insert" ON "tenant_memberships"
  FOR INSERT WITH CHECK (
    tenant_id = get_tenant_id()
    AND current_user_role() = 'tenant_admin'
  );

CREATE POLICY "tenant_memberships_update" ON "tenant_memberships"
  FOR UPDATE USING (tenant_id = get_tenant_id())
  WITH CHECK (
    tenant_id = get_tenant_id()
    AND current_user_role() = 'tenant_admin'
  );

CREATE POLICY "tenant_memberships_delete" ON "tenant_memberships"
  FOR DELETE USING (
    tenant_id = get_tenant_id()
    AND current_user_role() = 'tenant_admin'
  );

-- tenant_modules ─────────────────────────────────────────────
ALTER TABLE "tenant_modules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_modules" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_modules_select" ON "tenant_modules"
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE POLICY "tenant_modules_insert" ON "tenant_modules"
  FOR INSERT WITH CHECK (
    tenant_id = get_tenant_id()
    AND current_user_role() = 'tenant_admin'
  );

CREATE POLICY "tenant_modules_update" ON "tenant_modules"
  FOR UPDATE USING (tenant_id = get_tenant_id())
  WITH CHECK (
    tenant_id = get_tenant_id()
    AND current_user_role() = 'tenant_admin'
  );

CREATE POLICY "tenant_modules_delete" ON "tenant_modules"
  FOR DELETE USING (
    tenant_id = get_tenant_id()
    AND current_user_role() = 'tenant_admin'
  );

-- audit_events ───────────────────────────────────────────────
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;

CREATE POLICY "audit_events_select" ON "audit_events"
  FOR SELECT USING (tenant_id = get_tenant_id());

-- app_user may insert events for the current tenant or platform-wide (null tenant).
-- No UPDATE or DELETE — audit events are immutable for app_user.
CREATE POLICY "audit_events_insert" ON "audit_events"
  FOR INSERT WITH CHECK (
    tenant_id IS NULL OR tenant_id = get_tenant_id()
  );

-- invitations ────────────────────────────────────────────────
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invitations" FORCE ROW LEVEL SECURITY;

CREATE POLICY "invitations_select" ON "invitations"
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE POLICY "invitations_insert" ON "invitations"
  FOR INSERT WITH CHECK (
    tenant_id = get_tenant_id()
    AND current_user_role() = 'tenant_admin'
  );

CREATE POLICY "invitations_update" ON "invitations"
  FOR UPDATE USING (tenant_id = get_tenant_id())
  WITH CHECK (
    tenant_id = get_tenant_id()
    AND current_user_role() = 'tenant_admin'
  );

-- api_keys ───────────────────────────────────────────────────
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_keys" FORCE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_select" ON "api_keys"
  FOR SELECT USING (tenant_id = get_tenant_id());

CREATE POLICY "api_keys_insert" ON "api_keys"
  FOR INSERT WITH CHECK (
    tenant_id = get_tenant_id()
    AND current_user_role() = 'tenant_admin'
  );

CREATE POLICY "api_keys_update" ON "api_keys"
  FOR UPDATE USING (tenant_id = get_tenant_id())
  WITH CHECK (
    tenant_id = get_tenant_id()
    AND current_user_role() = 'tenant_admin'
  );

CREATE POLICY "api_keys_delete" ON "api_keys"
  FOR DELETE USING (
    tenant_id = get_tenant_id()
    AND current_user_role() = 'tenant_admin'
  );

-- ────────────────────────────────────────────────────────────
-- GRANTS TO app_user
-- ────────────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA public TO app_user;

-- Global read-only tables (no tenant-isolation write needed)
GRANT SELECT ON "modules"  TO app_user;
GRANT SELECT ON "tenants"  TO app_user;
GRANT SELECT ON "users"    TO app_user;

-- Tenant-scoped tables
GRANT SELECT, INSERT, UPDATE, DELETE ON "tenant_memberships" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "tenant_modules"     TO app_user;
GRANT SELECT, INSERT                 ON "audit_events"       TO app_user;
GRANT SELECT, INSERT, UPDATE         ON "invitations"        TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "api_keys"           TO app_user;

-- Helper functions
GRANT EXECUTE ON FUNCTION get_tenant_id()    TO app_user;
GRANT EXECUTE ON FUNCTION get_user_id()      TO app_user;
GRANT EXECUTE ON FUNCTION current_user_role() TO app_user;
