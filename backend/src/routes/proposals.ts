import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logActivity } from '../services/activity.js';
import { parseBrazilDateOnly, todayBrazilDateOnly } from '../utils/dates.js';

const proposalSchema = z.object({
  title: z.string().min(1),
  description: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  value: z.preprocess((val) => (typeof val === 'string' ? Number(val) : val), z.number().nonnegative()),
  validUntil: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  clientName: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  status: z.string().optional(),
  clientId: z.number().int().positive().optional().nullable(),
  leadId: z.number().int().positive().optional().nullable()
});

const proposalStatusSchema = z.object({
  status: z.string().min(1),
  projectId: z.number().int().positive().optional().nullable()
});

const isAcceptedStatus = (status: string) => {
  const normalized = status.trim().toUpperCase();
  return normalized === 'ACCEPTED' || normalized === 'ACEITA';
};

const proposalTransactionDescription = (proposal: { id: number; title: string }) =>
  `Receita gerada a partir da aceitação da proposta #${proposal.id}: ${proposal.title}`;

const routeError = (statusCode: number, message: string) => {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
};

export default async function proposalRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    return fastify.prisma.proposal.findMany({
      include: {
        client: { select: { id: true, name: true, company: true } },
        lead: { select: { id: true, name: true, company: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  });

  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id);
    const proposal = await fastify.prisma.proposal.findUnique({
      where: { id },
      include: {
        client: true,
        lead: true
      }
    });

    if (!proposal) {
      return reply.status(404).send({ error: 'Proposta não encontrada' });
    }

    return proposal;
  });

  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = proposalSchema.parse(request.body);

    const proposal = await fastify.prisma.proposal.create({
      data: {
        title: data.title,
        description: data.description,
        value: data.value,
        validUntil: parseBrazilDateOnly(data.validUntil),
        clientName: data.clientName,
        status: data.status || 'PENDING',
        clientId: data.clientId || null,
        leadId: data.leadId || null
      }
    });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'proposal.create',
      entityType: 'Proposal',
      entityId: proposal.id,
      message: `Criou a proposta: ${proposal.title} no valor de ${proposal.value}`
    });

    return proposal;
  });

  fastify.put('/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id);
    const data = proposalSchema.partial().parse(request.body);
    const { validUntil, ...proposalData } = data;
    const updateData = {
      ...proposalData,
      ...(validUntil !== undefined ? { validUntil: parseBrazilDateOnly(validUntil) } : {})
    };

    const proposal = await fastify.prisma.proposal.update({
      where: { id },
      data: updateData
    });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'proposal.update',
      entityType: 'Proposal',
      entityId: proposal.id,
      message: `Atualizou a proposta: ${proposal.title}`,
      metadata: updateData
    });

    return proposal;
  });

  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id);

    await fastify.prisma.proposal.delete({ where: { id } });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'proposal.delete',
      entityType: 'Proposal',
      entityId: id,
      message: `Removeu a proposta com ID: ${id}`
    });

    return { success: true };
  });

  // PUT status transition endpoint
  const statusHandler = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id);
    const body = proposalStatusSchema.parse(request.body);

    const proposal = await fastify.prisma.proposal.findUnique({
      where: { id }
    });

    if (!proposal) {
      return reply.status(404).send({ error: 'Proposta não encontrada' });
    }

    const { status, projectId } = body;

    const result = await fastify.prisma.$transaction(async (tx) => {
      const updatedProposal = await tx.proposal.update({
        where: { id },
        data: { status }
      });

      let transaction: any = null;

      if (isAcceptedStatus(status)) {
        let resolvedProjectId = projectId;
        let resolvedClientId = updatedProposal.clientId || null;

        if (resolvedProjectId) {
          const project = await tx.project.findUnique({
            where: { id: resolvedProjectId },
            select: { id: true, clientId: true }
          });

          if (!project) {
            throw routeError(404, 'Projeto não encontrado');
          }

          if (updatedProposal.clientId && project.clientId !== updatedProposal.clientId) {
            throw routeError(400, 'Projeto não pertence ao cliente da proposta');
          }

          resolvedClientId = project.clientId;
        } else if (updatedProposal.clientId) {
          const latestProject = await tx.project.findFirst({
            where: { clientId: updatedProposal.clientId },
            orderBy: { createdAt: 'desc' },
            select: { id: true, clientId: true }
          });
          if (latestProject) {
            resolvedProjectId = latestProject.id;
            resolvedClientId = latestProject.clientId;
          }
        }

        const description = proposalTransactionDescription(updatedProposal);
        const legacyDescription = `Receita gerada a partir da aceitação da proposta: ${updatedProposal.title}`;

        const existingTransaction = await tx.financialTransaction.findFirst({
          where: {
            type: 'INCOME',
            OR: [
              { description },
              { description: { contains: `proposta #${updatedProposal.id}:` } },
              {
                description: legacyDescription,
                amount: updatedProposal.value,
                clientId: resolvedClientId
              }
            ]
          }
        });

        if (existingTransaction) {
          transaction = existingTransaction;
          return { updatedProposal, transaction };
        }

        transaction = await tx.financialTransaction.create({
          data: {
            projectId: resolvedProjectId || null,
            clientId: resolvedClientId,
            type: 'INCOME',
            amount: updatedProposal.value,
            currency: 'BRL',
            amountCup: updatedProposal.value,
            exchangeRateUsed: 1,
            description,
            status: 'SETTLED',
            date: todayBrazilDateOnly()
          }
        });
      }

      return { updatedProposal, transaction };
    });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'proposal.status_update',
      entityType: 'Proposal',
      entityId: id,
      message: `Atualizou o status da proposta ${proposal.title} para ${status}`,
      metadata: { ...body, hasCreatedTransaction: !!result.transaction }
    });

    return result;
  };

  fastify.put('/:id/status', { preHandler: [fastify.authenticate] }, statusHandler);
  fastify.patch('/:id/status', { preHandler: [fastify.authenticate] }, statusHandler);
}
