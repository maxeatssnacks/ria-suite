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
  'tenant.update_settings': 'tenant_admin',
  // Modules
  'module.activate': 'tenant_admin',
  'module.deactivate': 'tenant_admin',
  'module.request_activation': 'tenant_admin',
  // Audit log — readable by auditors/examiners and above
  'audit.read': 'read_only',
  'audit.export': 'read_only',
  // API keys
  'api_key.create': 'tenant_admin',
  'api_key.revoke': 'tenant_admin',
  // Platform admin — cross-tenant operations; only platform_admin role
  'platform.tenant_create': 'platform_admin',
  'platform.tenant_suspend': 'platform_admin',
  'platform.tenant_activate': 'platform_admin',
  'platform.module_activate': 'platform_admin',
  'platform.module_deactivate': 'platform_admin',
  'platform.view_tenant': 'platform_admin',
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

// ─── Tenant settings schemas ───────────────────────────────────────────────────

// Shape of the `settings` JSON column on the tenants table.
// Use .catch so stale/corrupt JSON always yields safe defaults.
export const TenantSettingsJsonSchema = z
  .object({
    notificationEmail: z.string().email().nullish(),
    notifyOnLogin: z.boolean().default(false),
    notifyOnAdminAction: z.boolean().default(true),
    logoUrl: z.string().url().nullish(),
  })
  .catch({
    notificationEmail: null,
    notifyOnLogin: false,
    notifyOnAdminAction: true,
    logoUrl: null,
  })
export type TenantSettingsJson = z.infer<typeof TenantSettingsJsonSchema>

// Form schema for the settings page update action.
export const TenantSettingsUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  timezone: z.string().min(1, 'Timezone is required'),
  notificationEmail: z
    .string()
    .email('Must be a valid email')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  notifyOnLogin: z.coerce.boolean().optional(),
  notifyOnAdminAction: z.coerce.boolean().optional(),
})
export type TenantSettingsUpdate = z.infer<typeof TenantSettingsUpdateSchema>

// ─── Member management schemas ─────────────────────────────────────────────────

export const MemberRoleChangeSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(TENANT_ROLES),
})
export type MemberRoleChange = z.infer<typeof MemberRoleChangeSchema>

export const MemberDisableSchema = z.object({
  userId: z.string().uuid(),
})
export type MemberDisable = z.infer<typeof MemberDisableSchema>

// ─── Platform admin schemas ────────────────────────────────────────────────────

export const TenantCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  isolationTier: z.enum(['logical', 'dedicated_db', 'dedicated_deploy']).default('logical'),
  reason: z
    .string()
    .min(10, 'Please provide at least 10 characters explaining the reason')
    .max(500),
})
export type TenantCreate = z.infer<typeof TenantCreateSchema>

export const TenantSuspendSchema = z.object({
  reason: z
    .string()
    .min(10, 'Please provide at least 10 characters explaining the reason')
    .max(500),
})

export const PlatformModuleActionSchema = z.object({
  tenantId: z.string().uuid(),
  moduleId: z.string().uuid(),
  action: z.enum(['activate', 'deactivate']),
  reason: z
    .string()
    .min(10, 'Please provide at least 10 characters explaining the reason')
    .max(500),
})
export type PlatformModuleAction = z.infer<typeof PlatformModuleActionSchema>

// US-standard timezones offered in the settings page.
export const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Mountain Time — Arizona (no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
] as const
