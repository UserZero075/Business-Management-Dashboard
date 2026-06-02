import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logActivity } from '../services/activity.js';
import { parseBrazilDateOnly } from '../utils/dates.js';

const optionalId = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.coerce.number().int().positive().optional()
);

const optionalDate = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.string().optional()
);

const providerSchema = z.object({
  name: z.string().trim().min(1),
  website: z.preprocess((value) => (value === '' ? undefined : value), z.string().trim().optional()),
  type: z.enum(['VPS', 'DOMAIN', 'EMAIL', 'PAYMENT', 'OTHER']),
});

const vpsSchema = z.object({
  name: z.string().trim().min(1),
  ip: z.string().trim().optional(),
  providerId: optionalId,
  cost: z.coerce.number().positive(),
  currency: z.string().trim().default('BRL'),
  billingCycle: z.string().default('monthly'),
  startDate: optionalDate,
  renewalDate: optionalDate,
  specs: z.string().optional(),
  notes: z.string().optional()
});

const infraSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(['DOMAIN', 'DATABASE', 'SSL_CERT', 'CDN', 'EMAIL_SERVICE', 'API_SERVICE', 'OTHER']),
  cost: z.coerce.number().positive(),
  currency: z.string().trim().default('BRL'),
  billingCycle: z.string().default('monthly'),
  startDate: optionalDate,
  renewalDate: optionalDate,
  providerId: optionalId
});

const linkSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  costShare: z.coerce.number().min(0).max(100).default(100),
});

function monthlyEquivalent(cost: number, startDate: Date | null, endDate: Date | null): number {
  if (!startDate || !endDate) return cost;
  const averageMonthMs = 1000 * 60 * 60 * 24 * 30.4375;
  const months = Math.round(Math.abs(endDate.getTime() - startDate.getTime()) / averageMonthMs);
  return cost / Math.max(1, months);
}

function parsePositiveId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export default async function vpsRoutes(fastify: FastifyInstance) {
  fastify.get('/providers', { preHandler: [fastify.authenticate] }, async () => {
    return fastify.prisma.provider.findMany({
      include: { vpsServers: true, infraItems: true }
    });
  });

  fastify.get('/providers/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parsePositiveId(request.params.id);
    if (!id) return reply.status(400).send({ error: 'ID inválido' });

    const provider = await fastify.prisma.provider.findUnique({
      where: { id },
      include: { vpsServers: true, infraItems: true }
    });

    if (!provider) return reply.status(404).send({ error: 'Provedor não encontrado' });
    return provider;
  });

  fastify.post('/providers', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    const data = providerSchema.parse(request.body);

    return fastify.prisma.provider.create({
      data
    });
  });

  fastify.put('/providers/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parsePositiveId(request.params.id);
    if (!id) return reply.status(400).send({ error: 'ID inválido' });

    const data = providerSchema.partial().parse(request.body);
    return fastify.prisma.provider.update({
      where: { id },
      data
    });
  });

  fastify.delete('/providers/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parsePositiveId(request.params.id);
    if (!id) return reply.status(400).send({ error: 'ID inválido' });

    const provider = await fastify.prisma.provider.findUnique({
      where: { id },
      include: { vpsServers: { select: { id: true } }, infraItems: { select: { id: true } } }
    });

    if (!provider) return reply.status(404).send({ error: 'Provedor não encontrado' });
    if (provider.vpsServers.length > 0 || provider.infraItems.length > 0) {
      return reply.status(409).send({ error: 'Provedor em uso', message: 'Remova ou altere os recursos vinculados antes de excluir o provedor.' });
    }

    await fastify.prisma.provider.delete({ where: { id } });
    return { success: true };
  });

  fastify.get('/servers', { preHandler: [fastify.authenticate] }, async () => {
    const servers = await fastify.prisma.vpsServer.findMany({
      include: {
        provider: true,
        projectLinks: { include: { project: { select: { id: true, name: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return servers.map(({ projectLinks, ...server }) => ({
      ...server,
      infrastructure: projectLinks
    }));
  });

  fastify.get('/servers/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id);
    const server = await fastify.prisma.vpsServer.findUnique({
      where: { id },
      include: {
        provider: true,
        projectLinks: { include: { project: true } }
      }
    });

    if (!server) return reply.status(404).send({ error: 'Servidor não encontrado' });

    const { projectLinks, ...serverData } = server;
    return { ...serverData, infrastructure: projectLinks };
  });

  fastify.post('/servers', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    const data = vpsSchema.parse(request.body);
    let providerId = data.providerId;
    if (!providerId) {
      let provider = await fastify.prisma.provider.findFirst({ where: { name: 'Sem provedor', type: 'VPS' } });
      if (!provider) {
        provider = await fastify.prisma.provider.create({ data: { name: 'Sem provedor', type: 'VPS' } });
      }
      providerId = provider.id;
    }

    const server = await fastify.prisma.vpsServer.create({
      data: {
        ...data,
        providerId,
        startDate: parseBrazilDateOnly(data.startDate),
        renewalDate: parseBrazilDateOnly(data.renewalDate)
      }
    });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'vps.create',
      entityType: 'VpsServer',
      entityId: server.id,
      message: `Adicionou o VPS: ${server.name}`
    });

    return server;
  });

  fastify.put('/servers/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const id = parseInt(request.params.id);
    const data = vpsSchema.partial().parse(request.body);

    return fastify.prisma.vpsServer.update({
      where: { id },
      data: {
        ...data,
        startDate: parseBrazilDateOnly(data.startDate) ?? undefined,
        renewalDate: parseBrazilDateOnly(data.renewalDate) ?? undefined
      }
    });
  });

  fastify.delete('/servers/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const id = parseInt(request.params.id);
    await fastify.prisma.vpsServer.delete({ where: { id } });
    return { success: true };
  });

  fastify.post('/servers/:id/link', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const serverId = parsePositiveId(request.params.id);
    if (!serverId) return reply.status(400).send({ error: 'ID inválido' });
    const { projectId, costShare } = linkSchema.parse(request.body);

    const project = await fastify.prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) return reply.status(404).send({ error: 'Projeto não encontrado' });

    return fastify.prisma.projectVpsLink.upsert({
      where: { projectId_serverId: { projectId, serverId } },
      update: { costShare },
      create: { projectId, serverId, costShare }
    });
  });

  fastify.delete('/servers/:id/link/:projectId', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string; projectId: string } }>, reply: FastifyReply) => {
    const serverId = parsePositiveId(request.params.id);
    const projectId = parsePositiveId(request.params.projectId);
    if (!serverId || !projectId) return reply.status(400).send({ error: 'ID inválido' });

    await fastify.prisma.projectVpsLink.delete({
      where: { projectId_serverId: { projectId, serverId } }
    });

    return { success: true };
  });

  fastify.get('/items', { preHandler: [fastify.authenticate] }, async () => {
    const items = await fastify.prisma.infrastructureItem.findMany({
      include: {
        provider: true,
        projectLinks: { include: { project: { select: { id: true, name: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return items.map(({ projectLinks, ...item }) => ({
      ...item,
      projects: projectLinks
    }));
  });

  fastify.post('/items', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    const data = infraSchema.parse(request.body);

    return fastify.prisma.infrastructureItem.create({
      data: {
        ...data,
        startDate: parseBrazilDateOnly(data.startDate),
        renewalDate: parseBrazilDateOnly(data.renewalDate)
      }
    });
  });

  fastify.put('/items/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const id = parseInt(request.params.id);
    const data = infraSchema.partial().parse(request.body);

    return fastify.prisma.infrastructureItem.update({
      where: { id },
      data: {
        ...data,
        startDate: parseBrazilDateOnly(data.startDate) ?? undefined,
        renewalDate: parseBrazilDateOnly(data.renewalDate) ?? undefined
      }
    });
  });

  fastify.delete('/items/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const id = parseInt(request.params.id);
    await fastify.prisma.infrastructureItem.delete({ where: { id } });
    return { success: true };
  });

  fastify.post('/items/:id/link', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const itemId = parsePositiveId(request.params.id);
    if (!itemId) return reply.status(400).send({ error: 'ID inválido' });
    const { projectId, costShare } = linkSchema.parse(request.body);

    const project = await fastify.prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) return reply.status(404).send({ error: 'Projeto não encontrado' });

    return fastify.prisma.projectInfraLink.upsert({
      where: { projectId_itemId: { projectId, itemId } },
      update: { costShare },
      create: { projectId, itemId, costShare }
    });
  });

  fastify.delete('/items/:id/link/:projectId', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string; projectId: string } }>, reply: FastifyReply) => {
    const itemId = parsePositiveId(request.params.id);
    const projectId = parsePositiveId(request.params.projectId);
    if (!itemId || !projectId) return reply.status(400).send({ error: 'ID inválido' });

    await fastify.prisma.projectInfraLink.delete({
      where: { projectId_itemId: { projectId, itemId } }
    });

    return { success: true };
  });

  fastify.get('/costs', { preHandler: [fastify.authenticate] }, async () => {
    const servers = await fastify.prisma.vpsServer.findMany();
    const items = await fastify.prisma.infrastructureItem.findMany();
    const projects = await fastify.prisma.project.findMany({
      include: {
        vpsLinks: { include: { server: true } },
        infraLinks: { include: { item: true } }
      }
    });

    const serverMonthly = (s: typeof servers[0]) => monthlyEquivalent(Number(s.cost), s.startDate, s.renewalDate);
    const itemMonthly = (i: typeof items[0]) => monthlyEquivalent(Number(i.cost), i.startDate, i.renewalDate);

    const projectCosts: Record<number, number> = {};
    projects.forEach((project) => {
      const vpsCost = project.vpsLinks.reduce((sum, link) => {
        return sum + monthlyEquivalent(Number(link.server.cost), link.server.startDate, link.server.renewalDate) * (Number(link.costShare) / 100);
      }, 0);
      const infraCost = project.infraLinks.reduce((sum, link) => {
        return sum + monthlyEquivalent(Number(link.item.cost), link.item.startDate, link.item.renewalDate) * (Number(link.costShare) / 100);
      }, 0);
      projectCosts[project.id] = vpsCost + infraCost;
    });

    const totalsByCurrency: Record<string, number> = {};
    for (const server of servers) {
      const currency = server.currency || 'BRL';
      totalsByCurrency[currency] = (totalsByCurrency[currency] || 0) + serverMonthly(server);
    }
    for (const item of items) {
      const currency = item.currency || 'BRL';
      totalsByCurrency[currency] = (totalsByCurrency[currency] || 0) + itemMonthly(item);
    }

    return {
      totalMonthly: totalsByCurrency.BRL || 0,
      totalsByCurrency,
      byProject: projectCosts,
      servers: servers.map((s) => ({ id: s.id, name: s.name, cost: s.cost, currency: s.currency, startDate: s.startDate, renewalDate: s.renewalDate, monthlyEquivalent: serverMonthly(s) })),
      items: items.map((i) => ({ id: i.id, name: i.name, type: i.type, cost: i.cost, currency: i.currency, startDate: i.startDate, renewalDate: i.renewalDate, monthlyEquivalent: itemMonthly(i) }))
    };
  });
}
