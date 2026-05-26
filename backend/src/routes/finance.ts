import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logActivity } from '../services/activity.js';

const transactionSchema = z.object({
  projectId: z.number().optional().nullable(),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  description: z.string().optional(),
  date: z.string().optional()
});

export default async function financeRoutes(fastify: FastifyInstance) {
  fastify.get('/transactions', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    const { projectId, type, startDate, endDate } = request.query as any;

    const where: any = {};
    if (projectId) where.projectId = parseInt(projectId);
    if (type) where.type = type;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    return fastify.prisma.financialTransaction.findMany({
      where,
      include: { project: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' }
    });
  });

  fastify.post('/transactions', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    const data = transactionSchema.parse(request.body);

    const latestRate = await fastify.prisma.exchangeRate.findFirst({
      where: { currency: { code: data.currency } },
      orderBy: { date: 'desc' }
    });

    const rate = latestRate ? Number(latestRate.rate) : 1;
    const amountCup = data.currency === 'CUP' ? data.amount : data.amount * rate;

    const transaction = await fastify.prisma.financialTransaction.create({
      data: {
        projectId: data.projectId,
        type: data.type,
        amount: data.amount,
        currency: data.currency,
        amountCup: amountCup,
        exchangeRateUsed: rate,
        description: data.description,
        date: data.date ? new Date(data.date) : new Date()
      }
    });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'finance.transaction.create',
      entityType: 'FinancialTransaction',
      entityId: transaction.id,
      message: `${data.type === 'INCOME' ? 'Registrou receita' : 'Registrou despesa'} de ${data.amount} ${data.currency}`,
      metadata: { projectId: data.projectId, amountCup }
    });

    return transaction;
  });

  fastify.delete('/transactions/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const id = parseInt(request.params.id);
    await fastify.prisma.financialTransaction.delete({ where: { id } });
    return { success: true };
  });

  fastify.get('/summary', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    const { startDate, endDate } = request.query as any;

    const where: any = {};
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const incomes = await fastify.prisma.financialTransaction.aggregate({
      where: { ...where, type: 'INCOME' },
      _sum: { amountCup: true }
    });

    const expenses = await fastify.prisma.financialTransaction.aggregate({
      where: { ...where, type: 'EXPENSE' },
      _sum: { amountCup: true }
    });

    const byProject = await fastify.prisma.financialTransaction.groupBy({
      by: ['projectId'],
      where,
      _sum: { amountCup: true },
      _count: true
    });

    const projects = await fastify.prisma.project.findMany();
    const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]));

    const projectSummary = await Promise.all(
      byProject.filter(b => b.projectId).map(async (b) => {
        const income = await fastify.prisma.financialTransaction.aggregate({
          where: { ...where, projectId: b.projectId, type: 'INCOME' },
          _sum: { amountCup: true }
        });
        const expense = await fastify.prisma.financialTransaction.aggregate({
          where: { ...where, projectId: b.projectId, type: 'EXPENSE' },
          _sum: { amountCup: true }
        });
        return {
          projectId: b.projectId,
          projectName: projectMap[b.projectId!] || 'Desconhecido',
          income: Number(income._sum.amountCup || 0),
          expense: Number(expense._sum.amountCup || 0),
          profit: Number(income._sum.amountCup || 0) - Number(expense._sum.amountCup || 0)
        };
      })
    );

    return {
      totalIncome: Number(incomes._sum.amountCup || 0),
      totalExpense: Number(expenses._sum.amountCup || 0),
      profit: Number(incomes._sum.amountCup || 0) - Number(expenses._sum.amountCup || 0),
      margin: incomes._sum.amountCup ? 
        ((Number(incomes._sum.amountCup) - Number(expenses._sum.amountCup)) / Number(incomes._sum.amountCup) * 100).toFixed(2) : '0',
      byProject: projectSummary
    };
  });

  fastify.get('/rates', { preHandler: [fastify.authenticate] }, async () => {
    const currencies = await fastify.prisma.currency.findMany({
      include: { exchangeRates: { orderBy: { date: 'desc' }, take: 30 } }
    });

    return currencies.map(c => ({
      code: c.code,
      name: c.name,
      symbol: c.symbol,
      latestRate: c.exchangeRates[0] ? {
        rate: Number(c.exchangeRates[0].rate),
        date: c.exchangeRates[0].date,
        source: c.exchangeRates[0].source
      } : null,
      history: c.exchangeRates.slice(0, 7).map(r => ({
        rate: Number(r.rate),
        date: r.date,
        source: r.source
      }))
    }));
  });

  fastify.post('/rates', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    const { code, rate, source } = request.body as { code: string; rate: number; source?: string };

    let currency = await fastify.prisma.currency.findUnique({ where: { code } });
    if (!currency) {
      currency = await fastify.prisma.currency.create({
        data: { code, name: code, symbol: code }
      });
    }

    return fastify.prisma.exchangeRate.create({
      data: {
        currencyId: currency.id,
        rate,
        source: source || 'manual'
      }
    });
  });

  fastify.get('/rates/latest', { preHandler: [fastify.authenticate] }, async () => {
    const currencies = ['USD', 'EUR', 'USDT', 'CUP', 'MLC'];
    const rates: Record<string, { rate: number; date: string; source: string }> = {};

    for (const code of currencies) {
      let currency = await fastify.prisma.currency.findUnique({ where: { code } });
      if (!currency) {
        currency = await fastify.prisma.currency.create({
          data: { code, name: code, symbol: code }
        });
      }

      const latest = await fastify.prisma.exchangeRate.findFirst({
        where: { currencyId: currency.id },
        orderBy: { date: 'desc' }
      });

      if (latest) {
        rates[code] = {
          rate: Number(latest.rate),
          date: latest.date.toISOString(),
          source: latest.source
        };
      }
    }

    return rates;
  });

  fastify.get('/impact', { preHandler: [fastify.authenticate] }, async () => {
    const currencies = await fastify.prisma.currency.findMany();

    const impact: any[] = [];

    for (const currency of currencies) {
      const latest = await fastify.prisma.exchangeRate.findFirst({
        where: { currencyId: currency.id },
        orderBy: { date: 'desc' }
      });

      const lastWeek = await fastify.prisma.exchangeRate.findFirst({
        where: { currencyId: currency.id },
        orderBy: { date: 'asc' },
        take: 1
      });

      if (latest && lastWeek) {
        const diff = Number(latest.rate) - Number(lastWeek.rate);
        const pct = Number(lastWeek.rate) ? (diff / Number(lastWeek.rate) * 100) : 0;

        const transactions = await fastify.prisma.financialTransaction.findMany({
          where: { currency: currency.code, date: { gte: lastWeek.date } }
        });

        let totalImpact = 0;
        for (const t of transactions) {
          const diffCup = (Number(latest.rate) - Number(t.exchangeRateUsed || 1)) * Number(t.amount);
          totalImpact += diffCup;
        }

        impact.push({
          currency: currency.code,
          currentRate: Number(latest.rate),
          weekAgoRate: Number(lastWeek.rate),
          change: diff,
          changePercent: pct.toFixed(2),
          transactionCount: transactions.length,
          cupImpact: totalImpact.toFixed(2)
        });
      }
    }

    return impact;
  });
}
