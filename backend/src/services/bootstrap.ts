import { PrismaClient } from '@prisma/client';

export const BASE_ROLES = [
  { name: 'admin', permissions: ['read', 'write', 'delete', 'manage_users', 'manage_roles', 'manage_settings'] },
  { name: 'founder', permissions: ['read', 'write', 'delete', 'manage_users', 'manage_roles', 'manage_settings'] },
  { name: 'fundador', permissions: ['read', 'write', 'delete', 'manage_users', 'manage_roles', 'manage_settings'] },
  { name: 'cofounder', permissions: ['read', 'write', 'manage_users', 'manage_settings'] },
  { name: 'cofundador', permissions: ['read', 'write', 'manage_users', 'manage_settings'] },
  { name: 'marketing', permissions: ['read', 'write', 'manage_marketing'] },
  { name: 'sales', permissions: ['read', 'write', 'manage_sales'] },
  { name: 'operations', permissions: ['read', 'write', 'manage_operations'] },
  { name: 'developer', permissions: ['read', 'write', 'manage_projects'] },
  { name: 'designer', permissions: ['read', 'write', 'manage_design'] },
  { name: 'finance', permissions: ['read', 'write', 'manage_finance'] },
  { name: 'support', permissions: ['read', 'write', 'manage_support'] },
  { name: 'member', permissions: ['read'] },
];

export async function ensureBaseRoles(prisma: PrismaClient) {
  for (const role of BASE_ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { permissions: JSON.stringify(role.permissions) },
      create: { name: role.name, permissions: JSON.stringify(role.permissions) },
    });
  }
}

export async function ensureCompanySettings(prisma: PrismaClient) {
  const defaults = {
    companyName: 'DevFast',
    companyObjective: 'Gestor open-source para operar projetos, infraestrutura, finanças e equipe.',
    companyLogoUrl: '',
  };

  for (const [key, value] of Object.entries(defaults)) {
    await prisma.settings.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }
}

export async function bootstrapApplication(prisma: PrismaClient) {
  await ensureBaseRoles(prisma);
  await ensureCompanySettings(prisma);
}
