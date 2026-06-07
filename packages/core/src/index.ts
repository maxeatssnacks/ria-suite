import { z } from 'zod'

// ─── Canonical RBAC roles ──────────────────────────────────────────────────────
// Must stay in sync with the TenantRole enum in packages/db/prisma/schema.prisma.
// These are defined here so non-DB packages can import them without pulling in Prisma.

export const TENANT_ROLES = [
  'platform_admin',
  'tenant_admin',
  'compliance',
  'supervisor',
  'ops',
  'advisor',
  'read_only',
] as const

export type TenantRole = (typeof TENANT_ROLES)[number]

// Role hierarchy: higher number = more authority.
// Used by can() to support "minimum role" permission checks.
const ROLE_RANK: Record<TenantRole, number> = {
  platform_admin: 100,
  tenant_admin: 80,
  compliance: 60,
  supervisor: 50,
  ops: 40,
  advisor: 30,
  read_only: 20,
}

// ─── Action → minimum required role ───────────────────────────────────────────
// All permission checks in application code MUST use can() rather than
// comparing role strings inline. Add actions here as features are built.

const ACTION_MIN_ROLE: Record<string, TenantRole> = {
  // Invitations
  'invitation.send': 'tenant_admin',
  // Memberships
  'membership.change_role': 'tenant_admin',
  'membership.disable': 'tenant_admin',
  // Tenant
  'tenant.switch': 'read_only', // any authenticated tenant member
  // Modules
  'module.activate': 'tenant_admin',
  'module.deactivate': 'tenant_admin',
  // Audit log
  'audit.read': 'compliance',
  // API keys
  'api_key.create': 'tenant_admin',
  'api_key.revoke': 'tenant_admin',
}

export type Action = keyof typeof ACTION_MIN_ROLE

export type AuthUser = {
  role: TenantRole | undefined
}

/**
 * Central permission gate. Never compare role strings directly in application code —
 * always go through can(). The role hierarchy means tenant_admin can do everything
 * compliance can do, etc.
 */
export function can(user: AuthUser, action: string): boolean {
  if (!user.role) return false
  const minRole = ACTION_MIN_ROLE[action]
  if (!minRole) return false
  return ROLE_RANK[user.role] >= ROLE_RANK[minRole]
}

// ─── Session schema ────────────────────────────────────────────────────────────

export const TenantSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  role: z.enum(TENANT_ROLES),
})
export type TenantSummary = z.infer<typeof TenantSummarySchema>

// The session stored in the encrypted HttpOnly cookie.
// tenantId/role are undefined when the user has no active tenant context
// (new user awaiting invitation, or multi-tenant user who hasn't selected one yet).
// workosSessionId is the `sid` claim from the WorkOS access token JWT, used to
// terminate the WorkOS IdP session on logout via getLogoutUrl().
export const SessionDataSchema = z.object({
  userId: z.string().uuid(),
  workosUserId: z.string(),
  workosSessionId: z.string().optional(),
  email: z.string().email(),
  name: z.string(),
  tenantId: z.string().uuid().optional(),
  role: z.enum(TENANT_ROLES).optional(),
  tenants: z.array(TenantSummarySchema),
})
export type SessionData = z.infer<typeof SessionDataSchema>

// ─── Invitation schemas ────────────────────────────────────────────────────────

export const InvitationCreateSchema = z.object({
  email: z.string().email({ message: 'Valid email required' }),
  role: z.enum(TENANT_ROLES, { message: 'Valid role required' }),
})
export type InvitationCreate = z.infer<typeof InvitationCreateSchema>

// ─── Tenant-switch schema ──────────────────────────────────────────────────────

export const SwitchTenantSchema = z.object({
  tenantId: z.string().uuid(),
})
