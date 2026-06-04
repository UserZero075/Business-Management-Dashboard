import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logActivity } from '../services/activity.js';
import { parseBrazilDateOnly, todayBrazilDateOnly } from '../utils/dates.js';
import { computeLineTotal, computeProposalTotals } from '../lib/proposalTotals.js';
import { nextProposalNumber } from '../lib/proposalNumber.js';

const itemInputSchema = z.object({
  description: z.string().min(1),
  qty: z.number().default(1),
  unitPrice: z.number().default(0),
  discount: z.number().default(0),
  tax: z.number().default(0),
  recurring: z.boolean().default(false),
  order: z.number().int().default(0),
});

const fieldValueInputSchema = z.object({
  fieldKey: z.string().min(1),
  label: z.string().min(1),
  value: z.string().default(''),
});

const textBlockInputSchema = z.object({
  title: z.string().min(1),
  content: z.string().default(''),
  order: z.number().int().default(0),
});

const proposalSchema = z.object({
  title: z.string().min(1),
  description: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  validUntil: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  clientName: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  status: z.string().optional(),
  currency: z.string().optional(),
  clientId: z.number().int().positive().optional().nullable(),
  leadId: z.number().int().positive().optional().nullable(),
  typeId: z.number().int().positive().optional().nullable(),
  items: z.array(itemInputSchema).optional(),
  fieldValues: z.array(fieldValueInputSchema).optional(),
  textBlocks: z.array(textBlockInputSchema).optional(),
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
        lead: { select: { id: true, name: true, company: true } },
        type: { select: { id: true, name: true } }
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
        lead: true,
        type: true,
        items: { orderBy: { order: 'asc' } },
        fieldValues: true,
        textBlocks: { orderBy: { order: 'asc' } },
      }
    });

    if (!proposal) {
      return reply.status(404).send({ error: 'Proposta não encontrada' });
    }

    return proposal;
  });

  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    const data = proposalSchema.parse(request.body);

    // Se veio de um tipo e não mandaram conteúdo, copia o molde (snapshot).
    let items = data.items ?? [];
    let fieldValues = data.fieldValues ?? [];
    let textBlocks = data.textBlocks ?? [];
    let currency = data.currency ?? 'BRL';

    if (data.typeId && !data.items && !data.fieldValues && !data.textBlocks) {
      const type = await fastify.prisma.proposalType.findUnique({
        where: { id: data.typeId },
        include: {
          fields: { orderBy: { order: 'asc' } },
          textBlocks: { orderBy: { order: 'asc' } },
          items: { orderBy: { order: 'asc' } },
        },
      });
      if (type) {
        currency = data.currency ?? type.defaultCurrency;
        items = type.items.map((i) => ({
          description: i.description, qty: i.qty, unitPrice: i.unitPrice,
          discount: i.discount, tax: i.tax, recurring: false, order: i.order,
        }));
        fieldValues = type.fields.map((f) => ({ fieldKey: f.key, label: f.label, value: '' }));
        textBlocks = type.textBlocks.map((t) => ({ title: t.title, content: t.content, order: t.order }));
      }
    }

    const totals = computeProposalTotals(items);
    const itemsWithTotals = items.map((i) => ({ ...i, lineTotal: computeLineTotal(i) }));
    const number = await nextProposalNumber(fastify.prisma, todayBrazilDateOnly().getFullYear());

    const proposal = await fastify.prisma.proposal.create({
      data: {
        number,
        title: data.title,
        description: data.description,
        validUntil: parseBrazilDateOnly(data.validUntil),
        clientName: data.clientName,
        status: data.status || 'DRAFT',
        currency,
        clientId: data.clientId || null,
        leadId: data.leadId || null,
        typeId: data.typeId || null,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        value: totals.total,
        items: { create: itemsWithTotals },
        fieldValues: { create: fieldValues },
        textBlocks: { create: textBlocks },
      },
      include: { items: true, fieldValues: true, textBlocks: true, type: true },
    });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'proposal.create',
      entityType: 'Proposal',
      entityId: proposal.id,
      message: `Criou a proposta ${proposal.number}: ${proposal.title} no valor de ${proposal.total}`,
    });

    return proposal;
  });

  fastify.put('/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id);
    const data = proposalSchema.partial().parse(request.body);

    const updated = await fastify.prisma.$transaction(async (tx) => {
      const baseData: any = {};
      if (data.title !== undefined) baseData.title = data.title;
      if (data.description !== undefined) baseData.description = data.description;
      if (data.clientName !== undefined) baseData.clientName = data.clientName;
      if (data.status !== undefined) baseData.status = data.status;
      if (data.currency !== undefined) baseData.currency = data.currency;
      if (data.clientId !== undefined) baseData.clientId = data.clientId || null;
      if (data.leadId !== undefined) baseData.leadId = data.leadId || null;
      if (data.typeId !== undefined) baseData.typeId = data.typeId || null;
      if (data.validUntil !== undefined) baseData.validUntil = parseBrazilDateOnly(data.validUntil);

      if (data.items !== undefined) {
        const totals = computeProposalTotals(data.items);
        baseData.subtotal = totals.subtotal;
        baseData.discountTotal = totals.discountTotal;
        baseData.taxTotal = totals.taxTotal;
        baseData.total = totals.total;
        baseData.value = totals.total;
        await tx.proposalItem.deleteMany({ where: { proposalId: id } });
        await tx.proposalItem.createMany({
          data: data.items.map((i) => ({
            proposalId: id, description: i.description, qty: i.qty, unitPrice: i.unitPrice,
            discount: i.discount, tax: i.tax, recurring: i.recurring, order: i.order,
            lineTotal: computeLineTotal(i),
          })),
        });
      }
      if (data.fieldValues !== undefined) {
        await tx.proposalFieldValue.deleteMany({ where: { proposalId: id } });
        await tx.proposalFieldValue.createMany({
          data: data.fieldValues.map((f) => ({ proposalId: id, fieldKey: f.fieldKey, label: f.label, value: f.value })),
        });
      }
      if (data.textBlocks !== undefined) {
        await tx.proposalTextBlock.deleteMany({ where: { proposalId: id } });
        await tx.proposalTextBlock.createMany({
          data: data.textBlocks.map((t) => ({ proposalId: id, title: t.title, content: t.content, order: t.order })),
        });
      }

      return tx.proposal.update({
        where: { id },
        data: baseData,
        include: { items: { orderBy: { order: 'asc' } }, fieldValues: true, textBlocks: { orderBy: { order: 'asc' } }, type: true },
      });
    });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'proposal.update',
      entityType: 'Proposal',
      entityId: id,
      message: `Atualizou a proposta: ${updated.title}`,
    });

    return updated;
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
