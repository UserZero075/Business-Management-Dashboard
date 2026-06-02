import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logActivity } from '../services/activity.js';
import { parseBrazilDateOnly } from '../utils/dates.js';

const leadSchema = z.object({
  name: z.string().min(1),
  email: z.preprocess((val) => (val === '' ? null : val), z.string().email().optional().nullable()),
  phone: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  company: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  notes: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  value: z.preprocess((val) => (val === '' || val === undefined || val === null ? null : Number(val)), z.number().nonnegative().optional().nullable()),
  status: z.string().optional(),
  clientId: z.number().int().positive().optional().nullable()
});

const leadStatusSchema = z.object({
  status: z.string().min(1),
  createProject: z.boolean().optional(),
  projectName: z.string().optional(),
  startDate: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  endDate: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  contractValue: z.preprocess((val) => (val === '' || val === undefined || val === null ? null : Number(val)), z.number().optional().nullable())
});

export default async function leadRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    return fastify.prisma.lead.findMany({
      include: {
        client: { select: { id: true, name: true, company: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  });

  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id);
    const lead = await fastify.prisma.lead.findUnique({
      where: { id },
      include: {
        client: true,
        proposals: true
      }
    });

    if (!lead) {
      return reply.status(404).send({ error: 'Lead não encontrado' });
    }

    return lead;
  });

  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = leadSchema.parse(request.body);

    const lead = await fastify.prisma.lead.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        company: data.company,
        notes: data.notes,
        value: data.value,
        status: data.status || 'NEW',
        clientId: data.clientId || null
      }
    });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'lead.create',
      entityType: 'Lead',
      entityId: lead.id,
      message: `Criou o lead: ${lead.name}`
    });

    return lead;
  });

  fastify.put('/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id);
    const data = leadSchema.partial().parse(request.body);

    const lead = await fastify.prisma.lead.update({
      where: { id },
      data
    });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'lead.update',
      entityType: 'Lead',
      entityId: lead.id,
      message: `Atualizou o lead: ${lead.name}`,
      metadata: data
    });

    return lead;
  });

  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id);

    await fastify.prisma.lead.delete({ where: { id } });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'lead.delete',
      entityType: 'Lead',
      entityId: id,
      message: `Removeu o lead com ID: ${id}`
    });

    return { success: true };
  });

  // PUT status transition endpoint
  const statusHandler = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id);
    const body = leadStatusSchema.parse(request.body);

    const lead = await fastify.prisma.lead.findUnique({
      where: { id }
    });

    if (!lead) {
      return reply.status(404).send({ error: 'Lead não encontrado' });
    }

    const { status, createProject, projectName, startDate, endDate, contractValue } = body;

    const result = await fastify.prisma.$transaction(async (tx) => {
      // 1. Update lead status
      const updatedLead = await tx.lead.update({
        where: { id },
        data: { status }
      });

      let client: any = null;
      let project: any = null;

      if ((status.toUpperCase() === 'WON' || status === 'Ganho') && createProject) {
        if (updatedLead.clientId) {
          client = await tx.client.findUnique({ where: { id: updatedLead.clientId } });
        }

        if (!client && updatedLead.email) {
          client = await tx.client.findFirst({ where: { email: updatedLead.email } });
          if (client) {
            await tx.lead.update({
              where: { id },
              data: { clientId: client.id }
            });
          }
        }

        if (!client) {
          client = await tx.client.create({
            data: {
              name: updatedLead.name,
              email: updatedLead.email,
              phone: updatedLead.phone,
              company: updatedLead.company,
              notes: updatedLead.notes ? `Criado a partir do Lead: ${updatedLead.notes}` : 'Criado automaticamente de Lead Ganho.'
            }
          });

          await tx.lead.update({
            where: { id },
            data: { clientId: client.id }
          });
        }

        project = await tx.project.create({
          data: {
            name: projectName || `Projeto - ${client.name}`,
            clientId: client.id,
            startDate: parseBrazilDateOnly(startDate),
            endDate: parseBrazilDateOnly(endDate),
            contractValue: contractValue !== null && contractValue !== undefined ? Number(contractValue) : updatedLead.value,
            status: 'ACTIVE'
          }
        });
      }

      return { updatedLead, client, project };
    });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'lead.status_update',
      entityType: 'Lead',
      entityId: id,
      message: `Atualizou o status do lead ${lead.name} para ${status}`,
      metadata: { ...body, hasCreatedProject: !!result.project }
    });

    return result;
  };

  fastify.put('/:id/status', { preHandler: [fastify.authenticate] }, statusHandler);
  fastify.patch('/:id/status', { preHandler: [fastify.authenticate] }, statusHandler);
}
