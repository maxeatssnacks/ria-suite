-- Widen write policies on tenant-scoped tables so platform_admin is permitted
-- in addition to tenant_admin. The current_user_role() function returns the
-- acting user's role from tenant_memberships; the original policies only
-- accepted 'tenant_admin', which blocked platform_admin (role = 'platform_admin'
-- in tenant_memberships) from performing tenant-scoped writes via forTenant.
--
-- Affected tables: tenant_memberships, tenant_modules, invitations, api_keys.
-- audit_events has no UPDATE/DELETE policy (immutable) — no change needed.
-- tenants has no write policy for app_user (service role only) — no change.
--
-- Scope: platform_admin and tenant_admin only. Lower roles unchanged.

-- ── tenant_memberships ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_memberships_insert" ON "tenant_memberships";
CREATE POLICY "tenant_memberships_insert" ON "tenant_memberships"
  FOR INSERT WITH CHECK (
    tenant_id = get_tenant_id()
    AND current_user_role() IN ('tenant_admin', 'platform_admin')
  );

DROP POLICY IF EXISTS "tenant_memberships_update" ON "tenant_memberships";
CREATE POLICY "tenant_memberships_update" ON "tenant_memberships"
  FOR UPDATE USING (tenant_id = get_tenant_id())
  WITH CHECK (
    tenant_id = get_tenant_id()
    AND current_user_role() IN ('tenant_admin', 'platform_admin')
  );

DROP POLICY IF EXISTS "tenant_memberships_delete" ON "tenant_memberships";
CREATE POLICY "tenant_memberships_delete" ON "tenant_memberships"
  FOR DELETE USING (
    tenant_id = get_tenant_id()
    AND current_user_role() IN ('tenant_admin', 'platform_admin')
  );

-- ── tenant_modules ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_modules_insert" ON "tenant_modules";
CREATE POLICY "tenant_modules_insert" ON "tenant_modules"
  FOR INSERT WITH CHECK (
    tenant_id = get_tenant_id()
    AND current_user_role() IN ('tenant_admin', 'platform_admin')
  );

DROP POLICY IF EXISTS "tenant_modules_update" ON "tenant_modules";
CREATE POLICY "tenant_modules_update" ON "tenant_modules"
  FOR UPDATE USING (tenant_id = get_tenant_id())
  WITH CHECK (
    tenant_id = get_tenant_id()
    AND current_user_role() IN ('tenant_admin', 'platform_admin')
  );

DROP POLICY IF EXISTS "tenant_modules_delete" ON "tenant_modules";
CREATE POLICY "tenant_modules_delete" ON "tenant_modules"
  FOR DELETE USING (
    tenant_id = get_tenant_id()
    AND current_user_role() IN ('tenant_admin', 'platform_admin')
  );

-- ── invitations ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "invitations_insert" ON "invitations";
CREATE POLICY "invitations_insert" ON "invitations"
  FOR INSERT WITH CHECK (
    tenant_id = get_tenant_id()
    AND current_user_role() IN ('tenant_admin', 'platform_admin')
  );

DROP POLICY IF EXISTS "invitations_update" ON "invitations";
CREATE POLICY "invitations_update" ON "invitations"
  FOR UPDATE USING (tenant_id = get_tenant_id())
  WITH CHECK (
    tenant_id = get_tenant_id()
    AND current_user_role() IN ('tenant_admin', 'platform_admin')
  );

-- ── api_keys ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "api_keys_insert" ON "api_keys";
CREATE POLICY "api_keys_insert" ON "api_keys"
  FOR INSERT WITH CHECK (
    tenant_id = get_tenant_id()
    AND current_user_role() IN ('tenant_admin', 'platform_admin')
  );

DROP POLICY IF EXISTS "api_keys_update" ON "api_keys";
CREATE POLICY "api_keys_update" ON "api_keys"
  FOR UPDATE USING (tenant_id = get_tenant_id())
  WITH CHECK (
    tenant_id = get_tenant_id()
    AND current_user_role() IN ('tenant_admin', 'platform_admin')
  );

DROP POLICY IF EXISTS "api_keys_delete" ON "api_keys";
CREATE POLICY "api_keys_delete" ON "api_keys"
  FOR DELETE USING (
    tenant_id = get_tenant_id()
    AND current_user_role() IN ('tenant_admin', 'platform_admin')
  );
