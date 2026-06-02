import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { fetchElToqueRates } from '../services/exchangeRates.js';

export default async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, async () => {
    const projects = await fastify.prisma.project.count();
    const activeProjects = await fastify.prisma.project.count({ where: { status: { in: ['ACTIVE', 'RENTABLE'] } } });

    const projectMetrics = await fastify.prisma.project.findMany({
      include: { metrics: { orderBy: { date: 'desc' }, take: 1 } }
    });
    const usersSummary = projectMetrics.reduce((summary, project) => {
      const latest = project.metrics[0];
      if (!latest) return summary;

      summary.total += latest.totalUsers;
      summary.active += latest.activeUsers;
      summary.paid += latest.paidUsers;
      summary.referral += latest.referralUsers;
      summary.free += latest.freeUsers;
      summary.collaboration += latest.collaborationUsers;
      return summary;
    }, { total: 0, active: 0, paid: 0, referral: 0, free: 0, collaboration: 0 });

    const totalTasks = await fastify.prisma.task.count();
    const openBugs = await fastify.prisma.bug.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } });

    const incomes = await fastify.prisma.financialTransaction.aggregate({
      where: { type: 'INCOME', status: 'SETTLED' },
      _sum: { amountCup: true }
    });
    const expenses = await fastify.prisma.financialTransaction.aggregate({
      where: { type: 'EXPENSE', status: 'SETTLED' },
      _sum: { amountCup: true }
    });

    const servers = await fastify.prisma.vpsServer.count();
    const infraItems = await fastify.prisma.infrastructureItem.count();

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthIncomes = await fastify.prisma.financialTransaction.aggregate({
      where: { type: 'INCOME', status: 'SETTLED', date: { gte: monthStart } },
      _sum: { amountCup: true }
    });
    const monthExpenses = await fastify.prisma.financialTransaction.aggregate({
      where: { type: 'EXPENSE', status: 'SETTLED', date: { gte: monthStart } },
      _sum: { amountCup: true }
    });

    return {
      overview: {
        totalProjects: projects,
        activeProjects,
        totalServers: servers + infraItems
      },
      users: {
        total: usersSummary.total,
        active: usersSummary.active,
        paid: usersSummary.paid,
        referral: usersSummary.referral,
        free: usersSummary.free,
        collaboration: usersSummary.collaboration
      },
      work: {
        pendingTasks: totalTasks,
        openBugs
      },
      finances: {
        totalIncome: Number(incomes._sum.amountCup || 0),
        totalExpense: Number(expenses._sum.amountCup || 0),
        profit: Number(incomes._sum.amountCup || 0) - Number(expenses._sum.amountCup || 0),
        monthIncome: Number(monthIncomes._sum.amountCup || 0),
        monthExpense: Number(monthExpenses._sum.amountCup || 0),
        monthProfit: Number(monthIncomes._sum.amountCup || 0) - Number(monthExpenses._sum.amountCup || 0)
      }
    };
  });

  fastify.get('/projects/overview', { preHandler: [fastify.authenticate] }, async () => {
    const projects = await fastify.prisma.project.findMany({
      include: {
        transactions: true,
        metrics: { orderBy: { date: 'desc' }, take: 1 },
        tasks: true,
        bugs: { where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }
      }
    });

    return projects.map(p => {
      const income = p.transactions.filter(t => t.type === 'INCOME' && t.status === 'SETTLED').reduce((sum, t) => sum + Number(t.amountCup || 0), 0);
      const expense = p.transactions.filter(t => t.type === 'EXPENSE' && t.status === 'SETTLED').reduce((sum, t) => sum + Number(t.amountCup || 0), 0);
      const latestMetric = p.metrics[0];

      return {
        id: p.id,
        name: p.name,
        status: p.status,
        income,
        expense,
        profit: income - expense,
        users: latestMetric ? {
          total: latestMetric.totalUsers,
          active: latestMetric.activeUsers,
          paid: latestMetric.paidUsers,
          referral: latestMetric.referralUsers,
          free: latestMetric.freeUsers,
          collaboration: latestMetric.collaborationUsers
        } : { total: 0, active: 0, paid: 0, referral: 0, free: 0, collaboration: 0 },
        pendingTasks: p.tasks.filter(t => t.status !== 'COMPLETED').length,
        openBugs: p.bugs.length
      };
    });
  });

  fastify.get('/alerts', { preHandler: [fastify.authenticate] }, async () => {
    const alerts: any[] = [];

    const orphanedVps = await fastify.prisma.vpsServer.findMany({
      where: { projectLinks: { none: {} } }
    });
    if (orphanedVps.length > 0) {
      alerts.push({
        type: 'warning',
        title: 'VPS sem projeto atribuído',
        message: `${orphanedVps.length} VPS não estão vinculados a nenhum projeto`,
        count: orphanedVps.length
      });
    }

    const orphanedInfra = await fastify.prisma.infrastructureItem.findMany({
      where: { projectLinks: { none: {} } }
    });
    if (orphanedInfra.length > 0) {
      alerts.push({
        type: 'warning',
        title: 'Infraestrutura sem projeto',
        message: `${orphanedInfra.length} itens de infraestrutura não estão vinculados a nenhum projeto`,
        count: orphanedInfra.length
      });
    }

    const projectsNoIncome = await fastify.prisma.project.findMany({
      include: { transactions: { where: { type: 'INCOME' } } }
    });
    const noIncome = projectsNoIncome.filter(p => p.transactions.length === 0 && p.status === 'ACTIVE');
    if (noIncome.length > 0) {
      alerts.push({
        type: 'info',
        title: 'Projetos sem receitas',
        message: `${noIncome.length} projetos ativos não têm registros de receitas`,
        count: noIncome.length
      });
    }

    const criticalBugs = await fastify.prisma.bug.count({
      where: { severity: 'critical', status: { in: ['OPEN', 'IN_PROGRESS'] } }
    });
    if (criticalBugs > 0) {
      alerts.push({
        type: 'error',
        title: 'Bugs críticos abertos',
        message: `${criticalBugs} bugs com severidade crítica exigem atenção imediata`,
        count: criticalBugs
      });
    }

    const overdueTasks = await fastify.prisma.task.count({
      where: {
        status: { not: 'COMPLETED' },
        dueDate: { lt: new Date() }
      }
    });
    if (overdueTasks > 0) {
      alerts.push({
        type: 'warning',
        title: 'Tarefas vencidas',
        message: `${overdueTasks} tarefas estão com prazo vencido`,
        count: overdueTasks
      });
    }

    return alerts;
  });

  fastify.get('/exchange-rate/fetch', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await fetchElToqueRates(fastify.prisma);
      return { success: true, ...result };
    } catch (error: any) {
      console.error('Erro ao buscar taxas de câmbio:', error);
      return reply.status(500).send({ error: 'Falha ao processar taxas de câmbio', details: error.message });
    }
  });

  fastify.get('/charts/income-expense', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    const { months = '6' } = request.query as any;
    const monthsAgo = new Date();
    monthsAgo.setMonth(monthsAgo.getMonth() - parseInt(months));

    const transactions = await fastify.prisma.financialTransaction.findMany({
      where: { date: { gte: monthsAgo }, status: 'SETTLED' },
      orderBy: { date: 'asc' }
    });

    const monthlyData: Record<string, { income: number; expense: number }> = {};

    transactions.forEach(t => {
      const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[key]) {
        monthlyData[key] = { income: 0, expense: 0 };
      }
      if (t.type === 'INCOME') {
        monthlyData[key].income += Number(t.amountCup || 0);
      } else {
        monthlyData[key].expense += Number(t.amountCup || 0);
      }
    });

    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      ...data,
      profit: data.income - data.expense
    }));
  });

  fastify.get('/charts/project-performance', { preHandler: [fastify.authenticate] }, async () => {
    const projects = await fastify.prisma.project.findMany({
      include: {
        transactions: true,
        metrics: { orderBy: { date: 'desc' }, take: 30 }
      }
    });

    return projects.map(p => {
      const income = p.transactions.filter(t => t.type === 'INCOME' && t.status === 'SETTLED').reduce((sum, t) => sum + Number(t.amountCup || 0), 0);
      const expense = p.transactions.filter(t => t.type === 'EXPENSE' && t.status === 'SETTLED').reduce((sum, t) => sum + Number(t.amountCup || 0), 0);
      const latestMetric = p.metrics[0];

      return {
        id: p.id,
        name: p.name,
        status: p.status,
        income,
        expense,
        profit: income - expense,
        margin: income > 0 ? ((income - expense) / income * 100).toFixed(1) : '0',
        users: latestMetric?.totalUsers || 0,
        activeUsers: latestMetric?.activeUsers || 0
      };
    }).sort((a, b) => b.profit - a.profit);
  });
}
