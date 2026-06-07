-- Grant app_user membership to the connecting role so that SET LOCAL ROLE app_user
-- succeeds on hosted Postgres (e.g. Supabase) where the connecting role ("postgres")
-- is NOT a superuser and therefore requires explicit membership to switch roles.
-- Superusers can already SET ROLE to any role without membership — skipped to avoid noise.
-- GRANT is idempotent; safe to re-run.
DO $$
BEGIN
  IF NOT (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user) THEN
    EXECUTE format('GRANT app_user TO %I', current_user);
  END IF;
END
$$;
