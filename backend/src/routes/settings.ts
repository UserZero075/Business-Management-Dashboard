import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { logActivity } from '../services/activity.js';

const companySchema = z.object({
  companyName: z.string().min(1).max(80),
  companyObjective: z.string().max(500).optional().nullable(),
  companyLogoUrl: z.string().url().optional().nullable().or(z.literal('')),
});

async function readCompanySettings(fastify: FastifyInstance) {
  const rows = await fastify.prisma.settings.findMany({
    where: { key: { in: ['companyName', 'companyObjective', 'companyLogoUrl'] } },
  });
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  return {
    companyName: values.companyName || 'DevFast',
    companyObjective: values.companyObjective || 'Gestor open-source para operar projetos, infraestrutura, finanças e equipe.',
    companyLogoUrl: values.companyLogoUrl || '',
  };
}

export default async function settingsRoutes(fastify: FastifyInstance) {
  fastify.get('/company', async () => readCompanySettings(fastify));

  fastify.put('/company', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    const data = companySchema.parse(request.body);
    const normalized = {
      companyName: data.companyName.trim(),
      companyObjective: data.companyObjective?.trim() || '',
      companyLogoUrl: data.companyLogoUrl || '',
    };

    for (const [key, value] of Object.entries(normalized)) {
      await fastify.prisma.settings.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'settings.company.update',
      entityType: 'Settings',
      message: `Atualizou a configuração da empresa para ${normalized.companyName}`,
      metadata: normalized,
    });

    return normalized;
  });
}
