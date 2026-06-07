/**
 * Seed script — 2 demo tenants, users in every role, module records.
 * Run with: pnpm db:seed  (uses tsx, not node)
 *
 * Uses a service-role client (direct connection, no RLS) to bootstrap data.
 * This is a legitimate service-role use case — catalogued in SERVICE_ROLE_USAGE.md.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MODULES = [
  { key: 'compliance-calendar', name: 'Compliance Calendar', status: 'ga' as const },
  { key: 'trade-blotter', name: 'Trade Blotter Review', status: 'ga' as const },
  { key: 'rep-monitoring', name: 'Rep Monitoring', status: 'beta' as const },
  { key: 'ai-drafts', name: 'AI Document Drafts', status: 'alpha' as const },
]

const TENANTS = [
  { name: 'Acme Capital Advisors', slug: 'acme-capital' },
  { name: 'Riverstone Wealth Management', slug: 'riverstone-wealth' },
]

const ROLES = ['tenant_admin', 'compliance', 'supervisor', 'ops', 'advisor', 'read_only'] as const

async function main() {
  console.log('Seeding database...')

  // Modules
  for (const m of MODULES) {
    await prisma.module.upsert({
      where: { key: m.key },
      update: {},
      create: m,
    })
  }
  console.log('  ✓ Modules seeded')

  const modules = await prisma.module.findMany()

  for (const tenantDef of TENANTS) {
    const tenant = await prisma.tenant.upsert({
      where: { slug: tenantDef.slug },
      update: {},
      create: {
        name: tenantDef.name,
        slug: tenantDef.slug,
        status: 'active',
        settings: {},
      },
    })

    // Enable all modules for each demo tenant
    for (const mod of modules) {
      await prisma.tenantModule.upsert({
        where: { tenantId_moduleId: { tenantId: tenant.id, moduleId: mod.id } },
        update: {},
        create: {
          tenantId: tenant.id,
          moduleId: mod.id,
          status: mod.status === 'ga' ? 'active' : 'trial',
          activatedAt: new Date(),
        },
      })
    }

    // Seed one user per role per tenant
    for (const role of ROLES) {
      const slug = tenantDef.slug
      const workosUserId = `workos_seed_${slug}_${role}`
      const email = `${role.replace('_', '-')}@${slug}.example`

      const user = await prisma.user.upsert({
        where: { workosUserId },
        update: {},
        create: {
          workosUserId,
          email,
          name: `Seed ${role.replace('_', ' ')} (${tenantDef.name})`,
          status: 'active',
        },
      })

      await prisma.tenantMembership.upsert({
        where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
        update: {},
        create: {
          tenantId: tenant.id,
          userId: user.id,
          role: role as Parameters<typeof prisma.tenantMembership.create>[0]['data']['role'],
          status: 'active',
        },
      })
    }

    console.log(`  ✓ Tenant seeded: ${tenantDef.name}`)
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
