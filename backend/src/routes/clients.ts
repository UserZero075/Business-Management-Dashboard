import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logActivity } from '../services/activity.js';

const clientSchema = z.object({
  name: z.string().min(1),
  email: z.preprocess((val) => (val === '' ? null : val), z.string().email().optional().nullable()),
  phone: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  company: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  document: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  notes: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
});

export default async function clientRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    const clients = await fastify.prisma.client.findMany({
      include: {
        projects: true,
        transactions: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    return clients.map(client => {
      const totalIncome = client.transactions
        .filter(t => t.type === 'INCOME' && t.status === 'SETTLED')
        .reduce((sum, t) => sum + (t.amountCup || t.amount), 0);

      const totalExpense = client.transactions
        .filter(t => t.type === 'EXPENSE' && t.status === 'SETTLED')
        .reduce((sum, t) => sum + (t.amountCup || t.amount), 0);

      return {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        company: client.company,
        document: client.document,
        notes: client.notes,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
        projects: client.projects,
        totalIncome,
        totalExpense,
        netRevenue: totalIncome - totalExpense
      };
    });
  });

  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id);
    const client = await fastify.prisma.client.findUnique({
      where: { id },
      include: {
        projects: true,
        transactions: {
          orderBy: { date: 'desc' }
        },
        proposals: true,
        leads: true
      }
    });

    if (!client) {
      return reply.status(404).send({ error: 'Cliente não encontrado' });
    }

    const totalIncome = client.transactions
      .filter(t => t.type === 'INCOME' && t.status === 'SETTLED')
      .reduce((sum, t) => sum + (t.amountCup || t.amount), 0);

    const totalExpense = client.transactions
      .filter(t => t.type === 'EXPENSE' && t.status === 'SETTLED')
      .reduce((sum, t) => sum + (t.amountCup || t.amount), 0);

    return {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      company: client.company,
      document: client.document,
      notes: client.notes,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
      projects: client.projects,
      transactions: client.transactions,
      proposals: client.proposals,
      leads: client.leads,
      totalIncome,
      totalExpense,
      netRevenue: totalIncome - totalExpense
    };
  });

  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = clientSchema.parse(request.body);

    const client = await fastify.prisma.client.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        company: data.company,
        document: data.document,
        notes: data.notes
      }
    });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'client.create',
      entityType: 'Client',
      entityId: client.id,
      message: `Criou o cliente: ${client.name}`
    });

    return reply.status(201).send(client);
  });

  fastify.put('/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id);
    const data = clientSchema.partial().parse(request.body);

    const client = await fastify.prisma.client.update({
      where: { id },
      data
    });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'client.update',
      entityType: 'Client',
      entityId: client.id,
      message: `Atualizou o cliente: ${client.name}`,
      metadata: data
    });

    return client;
  });

  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id);

    const [projects, proposals, leads, transactions] = await fastify.prisma.$transaction([
      fastify.prisma.project.count({ where: { clientId: id } }),
      fastify.prisma.proposal.count({ where: { clientId: id } }),
      fastify.prisma.lead.count({ where: { clientId: id } }),
      fastify.prisma.financialTransaction.count({ where: { clientId: id } })
    ]);

    if (projects || proposals || leads || transactions) {
      return reply.status(409).send({
        error: 'Cliente possui vínculos',
        message: 'Não é possível remover um cliente com projetos, propostas, leads ou transações vinculadas.',
        details: { projects, proposals, leads, transactions }
      });
    }

    await fastify.prisma.client.delete({ where: { id } });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'client.delete',
      entityType: 'Client',
      entityId: id,
      message: `Removeu o cliente com ID: ${id}`
    });

    return { success: true };
  });
}
