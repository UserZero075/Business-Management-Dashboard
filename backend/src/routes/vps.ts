import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logActivity } from '../services/activity.js';

const vpsSchema = z.object({
  name: z.string().min(1),
  ip: z.string().optional(),
  providerId: z.preprocess((value) => value === '' ? undefined : value, z.number().optional()),
  cost: z.number().positive(),
  currency: z.string().default('USD'),
  billingCycle: z.string().default('monthly'),
  renewalDate: z.string().optional(),
  specs: z.string().optional(),
  notes: z.string().optional()
});

const infraSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['DOMAIN', 'DATABASE', 'SSL_CERT', 'CDN', 'EMAIL_SERVICE', 'API_SERVICE', 'OTHER']),
  cost: z.number().positive(),
  currency: z.string().default('USD'),
  billingCycle: z.string().default('monthly'),
  renewalDate: z.string().optional(),
  providerId: z.preprocess((value) => value === '' ? undefined : value, z.number().optional())
});

export default async function vpsRoutes(fastify: FastifyInstance) {
  fastify.get('/providers', { preHandler: [fastify.authenticate] }, async () => {
    return fastify.prisma.provider.findMany({
      include: { vpsServers: true, infraItems: true }
    });
  });

  fastify.post('/providers', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    const { name, website, type } = request.body as { name: string; website?: string; type: string };

    return fastify.prisma.provider.create({
      data: { name, website, type }
    });
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
        renewalDate: data.renewalDate ? new Date(data.renewalDate) : null
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
        renewalDate: data.renewalDate ? new Date(data.renewalDate) : undefined
      }
    });
  });

  fastify.delete('/servers/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const id = parseInt(request.params.id);
    await fastify.prisma.vpsServer.delete({ where: { id } });
    return { success: true };
  });

  fastify.post('/servers/:id/link', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const serverId = parseInt(request.params.id);
    const { projectId, costShare } = request.body as { projectId: number; costShare?: number };

    return fastify.prisma.projectVpsLink.upsert({
      where: { projectId_serverId: { projectId, serverId } },
      update: { costShare: costShare || 100 },
      create: { projectId, serverId, costShare: costShare || 100 }
    });
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
        renewalDate: data.renewalDate ? new Date(data.renewalDate) : null
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
        renewalDate: data.renewalDate ? new Date(data.renewalDate) : undefined
      }
    });
  });

  fastify.delete('/items/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const id = parseInt(request.params.id);
    await fastify.prisma.infrastructureItem.delete({ where: { id } });
    return { success: true };
  });

  fastify.post('/items/:id/link', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const itemId = parseInt(request.params.id);
    const { projectId, costShare } = request.body as { projectId: number; costShare?: number };

    return fastify.prisma.projectInfraLink.upsert({
      where: { projectId_itemId: { projectId, itemId } },
      update: { costShare: costShare || 100 },
      create: { projectId, itemId, costShare: costShare || 100 }
    });
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

    const projectCosts: Record<number, number> = {};
    projects.forEach((project) => {
      const vpsCost = project.vpsLinks.reduce((sum, link) => {
        return sum + Number(link.server.cost) * (Number(link.costShare) / 100);
      }, 0);
      const infraCost = project.infraLinks.reduce((sum, link) => {
        return sum + Number(link.item.cost) * (Number(link.costShare) / 100);
      }, 0);
      projectCosts[project.id] = vpsCost + infraCost;
    });

    const totalMonthly = servers.reduce((sum, server) => sum + Number(server.cost), 0) +
      items.reduce((sum, item) => sum + Number(item.cost), 0);

    return {
      totalMonthly,
      byProject: projectCosts,
      servers: servers.map((server) => ({ id: server.id, name: server.name, cost: server.cost, currency: server.currency })),
      items: items.map((item) => ({ id: item.id, name: item.name, type: item.type, cost: item.cost, currency: item.currency }))
    };
  });
}
