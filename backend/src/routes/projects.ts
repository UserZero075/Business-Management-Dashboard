import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logActivity } from '../services/activity.js';
import { parseBrazilDateOnly, todayBrazilDateOnly } from '../utils/dates.js';

const projectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'PAUSED', 'ABANDONED', 'EXPERIMENTAL', 'RENTABLE']).optional(),
  publicUrl: z.preprocess(
    (value) => value === '' ? null : value,
    z.string().url().optional().nullable()
  ),
  responsibleIds: z.array(z.number()).optional().nullable(),
  clientId: z.number().int().positive(),
  startDate: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  endDate: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  contractValue: z.preprocess((val) => (val === '' || val === undefined || val === null ? null : Number(val)), z.number().optional().nullable())
});

const clientInclude = { select: { id: true, name: true, company: true, document: true } };

export default async function projectRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    return fastify.prisma.project.findMany({
      include: {
        client: clientInclude,
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        vpsLinks: { include: { server: true } },
        infraLinks: { include: { item: true } },
        metrics: { orderBy: { date: 'desc' }, take: 1 }
      },
      orderBy: { createdAt: 'desc' }
    });
  });

  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id);
    const project = await fastify.prisma.project.findUnique({
      where: { id },
      include: {
        client: clientInclude,
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        vpsLinks: { include: { server: true } },
        infraLinks: { include: { item: true } },
        transactions: { orderBy: { date: 'desc' }, take: 50 },
        tasks: { orderBy: { createdAt: 'desc' } },
        bugs: { orderBy: { createdAt: 'desc' } },
        metrics: { orderBy: { date: 'desc' }, take: 30 }
      }
    });

    if (!project) {
      return reply.status(404).send({ error: 'Projeto não encontrado' });
    }

    return project;
  });

  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = projectSchema.parse(request.body);

    const client = await fastify.prisma.client.findUnique({
      where: { id: data.clientId },
      select: { id: true }
    });

    if (!client) {
      return reply.status(404).send({ error: 'Cliente não encontrado' });
    }

    const project = await fastify.prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        status: data.status || 'ACTIVE',
        publicUrl: data.publicUrl || null,
        clientId: data.clientId,
        startDate: parseBrazilDateOnly(data.startDate),
        endDate: parseBrazilDateOnly(data.endDate),
        contractValue: data.contractValue !== undefined && data.contractValue !== null ? Number(data.contractValue) : null
      }
    });

    if (data.responsibleIds && data.responsibleIds.length > 0) {
      const memberData = data.responsibleIds.map((userId: number) => ({
        projectId: project.id,
        userId,
        role: 'responsible',
        isResponsible: true
      }));
      await fastify.prisma.projectMember.createMany({
        data: memberData
      });
    }

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'project.create',
      entityType: 'Project',
      entityId: project.id,
      message: `Criou o projeto: ${project.name}`
    });

    return fastify.prisma.project.findUnique({
      where: { id: project.id },
      include: {
        client: clientInclude,
        members: { include: { user: { select: { id: true, name: true, email: true } } } }
      }
    });
  });

  fastify.put('/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id);
    const data = projectSchema.partial().parse(request.body);

    const { responsibleIds, ...updateData } = data as any;

    if (updateData.clientId !== undefined) {
      const client = await fastify.prisma.client.findUnique({
        where: { id: updateData.clientId },
        select: { id: true }
      });

      if (!client) {
        return reply.status(404).send({ error: 'Cliente não encontrado' });
      }
    }

    if (updateData.startDate !== undefined) {
      updateData.startDate = parseBrazilDateOnly(updateData.startDate);
    }
    if (updateData.endDate !== undefined) {
      updateData.endDate = parseBrazilDateOnly(updateData.endDate);
    }

    const project = await fastify.prisma.project.update({
      where: { id },
      data: updateData
    });

    if (responsibleIds !== undefined) {
      await fastify.prisma.projectMember.deleteMany({
        where: { projectId: id, isResponsible: true }
      });

      if (responsibleIds && responsibleIds.length > 0) {
        const memberData = responsibleIds.map((userId: number) => ({
          projectId: id,
          userId,
          role: 'responsible',
          isResponsible: true
        }));
        await fastify.prisma.projectMember.createMany({
          data: memberData
        });
      }
    }

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'project.update',
      entityType: 'Project',
      entityId: project.id,
      message: `Atualizou o projeto: ${project.name}`,
      metadata: updateData
    });

    return fastify.prisma.project.findUnique({
      where: { id },
      include: {
        client: clientInclude,
        members: { include: { user: { select: { id: true, name: true, email: true } } } }
      }
    });
  });

  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id);
    await fastify.prisma.project.delete({ where: { id } });
    return { success: true };
  });

  fastify.post('/:id/members', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const projectId = parseInt(request.params.id);
    const { userId, role } = request.body as { userId: number; role?: string };

    return fastify.prisma.projectMember.create({
      data: {
        projectId,
        userId,
        role: role || 'member'
      }
    });
  });

  fastify.delete('/:id/members/:userId', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string; userId: string } }>) => {
    const projectId = parseInt(request.params.id);
    const userId = parseInt(request.params.userId);

    await fastify.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId } }
    });

    return { success: true };
  });

  fastify.post('/:id/metrics', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const projectId = parseInt(request.params.id);
    const {
      totalUsers,
      activeUsers,
      paidUsers,
      referralUsers,
      freeUsers,
      collaborationUsers,
      date
    } = request.body as {
      totalUsers: number;
      activeUsers: number;
      paidUsers?: number;
      referralUsers?: number;
      freeUsers?: number;
      collaborationUsers?: number;
      date?: string;
    };

    const metricDate = parseBrazilDateOnly(date) || todayBrazilDateOnly();
    const metricData = {
        projectId,
        totalUsers,
        activeUsers,
        paidUsers: paidUsers || 0,
        referralUsers: referralUsers || 0,
        freeUsers: freeUsers || 0,
        collaborationUsers: collaborationUsers || 0,
        date: metricDate
    };

    return fastify.prisma.projectMetric.upsert({
      where: { projectId_date: { projectId, date: metricDate } },
      update: {
        totalUsers,
        activeUsers,
        paidUsers: paidUsers || 0,
        referralUsers: referralUsers || 0,
        freeUsers: freeUsers || 0,
        collaborationUsers: collaborationUsers || 0
      },
      create: metricData
    });
  });

  fastify.get('/:id/summary', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const incomes = await fastify.prisma.financialTransaction.aggregate({
      where: { projectId: id, type: 'INCOME', status: 'SETTLED' },
      _sum: { amountCup: true }
    });

    const expenses = await fastify.prisma.financialTransaction.aggregate({
      where: { projectId: id, type: 'EXPENSE', status: 'SETTLED' },
      _sum: { amountCup: true }
    });

    const monthIncomes = await fastify.prisma.financialTransaction.aggregate({
      where: { projectId: id, type: 'INCOME', date: { gte: monthStart }, status: 'SETTLED' },
      _sum: { amountCup: true }
    });

    const monthExpenses = await fastify.prisma.financialTransaction.aggregate({
      where: { projectId: id, type: 'EXPENSE', date: { gte: monthStart }, status: 'SETTLED' },
      _sum: { amountCup: true }
    });

    const totalTasks = await fastify.prisma.task.count({ where: { projectId: id } });
    const completedTasks = await fastify.prisma.task.count({ where: { projectId: id, status: 'COMPLETED' } });
    const totalBugs = await fastify.prisma.bug.count({ where: { projectId: id } });
    const openBugs = await fastify.prisma.bug.count({ where: { projectId: id, status: { in: ['OPEN', 'IN_PROGRESS'] } } });

    const latestMetrics = await fastify.prisma.projectMetric.findFirst({
      where: { projectId: id },
      orderBy: { date: 'desc' }
    });

    const vpsLinks = await fastify.prisma.projectVpsLink.findMany({
      where: { projectId: id },
      include: { server: true }
    });
    const infraLinks = await fastify.prisma.projectInfraLink.findMany({
      where: { projectId: id },
      include: { item: true }
    });
    const resourceCostMonthly = vpsLinks.reduce((sum, link) => {
      return sum + Number(link.server.cost) * (Number(link.costShare) / 100);
    }, 0) + infraLinks.reduce((sum, link) => {
      return sum + Number(link.item.cost) * (Number(link.costShare) / 100);
    }, 0);

    return {
      income: Number(incomes._sum.amountCup || 0),
      expense: Number(expenses._sum.amountCup || 0),
      profit: Number(incomes._sum.amountCup || 0) - Number(expenses._sum.amountCup || 0),
      monthIncome: Number(monthIncomes._sum.amountCup || 0),
      monthExpense: Number(monthExpenses._sum.amountCup || 0),
      monthProfit: Number(monthIncomes._sum.amountCup || 0) - Number(monthExpenses._sum.amountCup || 0),
      resourceCostMonthly,
      tasks: { total: totalTasks, completed: completedTasks },
      bugs: { total: totalBugs, open: openBugs },
      users: latestMetrics ? {
        total: latestMetrics.totalUsers,
        active: latestMetrics.activeUsers,
        paid: latestMetrics.paidUsers,
        referral: latestMetrics.referralUsers,
        free: latestMetrics.freeUsers,
        collaboration: latestMetrics.collaborationUsers
      } : { total: 0, active: 0, paid: 0, referral: 0, free: 0, collaboration: 0 },
      infrastructure: vpsLinks.length + infraLinks.length
    };
  });
}
