import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logActivity } from '../services/activity.js';
import { brazilDateRange, parseBrazilDateOnly, todayBrazilDateOnly } from '../utils/dates.js';

const optionalDate = z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable());

const transactionSchema = z.object({
  projectId: z.coerce.number().int().positive().optional().nullable(),
  clientId: z.coerce.number().int().positive().optional().nullable(),
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.coerce.number().positive(),
  currency: z.string().trim().default('BRL'),
  description: z.string().optional().nullable(),
  date: z.string().optional(),
  status: z.enum(['SETTLED', 'PENDING']).default('SETTLED'),
  category: z.string().optional().nullable(),
  dueDate: optionalDate,
  paymentDate: optionalDate,
});

const settleSchema = z.object({
  paymentDate: optionalDate,
});

export default async function financeRoutes(fastify: FastifyInstance) {
  fastify.get('/transactions', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    const { projectId, clientId, type, status, category, startDate, endDate } = request.query as any;

    const where: any = {};
    if (projectId) where.projectId = parseInt(projectId);
    if (clientId) where.clientId = parseInt(clientId);
    if (type) where.type = type;
    if (status) where.status = status;
    if (category) where.category = category;
    const range = brazilDateRange(startDate, endDate);
    if (range) where.date = range;

    return fastify.prisma.financialTransaction.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        client: { select: { id: true, name: true, company: true } }
      },
      orderBy: { date: 'desc' }
    });
  });

  fastify.get('/transactions/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id);
    if (!Number.isInteger(id) || id <= 0) return reply.status(400).send({ error: 'ID inválido' });

    const transaction = await fastify.prisma.financialTransaction.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        client: { select: { id: true, name: true, company: true } }
      }
    });

    if (!transaction) return reply.status(404).send({ error: 'Transação não encontrada' });
    return transaction;
  });

  fastify.post('/transactions', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = transactionSchema.parse(request.body);

    let resolvedClientId = data.clientId || null;
    if (data.projectId) {
      const project = await fastify.prisma.project.findUnique({
        where: { id: data.projectId },
        select: { id: true, clientId: true }
      });

      if (!project) {
        return reply.status(404).send({ error: 'Projeto não encontrado' });
      }

      if (data.clientId && data.clientId !== project.clientId) {
        return reply.status(400).send({
          error: 'Cliente incompatível',
          message: 'O clientId informado não pertence ao projeto selecionado.'
        });
      }

      resolvedClientId = project.clientId;
    }

    const latestRate = await fastify.prisma.exchangeRate.findFirst({
      where: { currency: { code: data.currency } },
      orderBy: { date: 'desc' }
    });

    const rate = latestRate ? Number(latestRate.rate) : 1;
    const amountCup = data.currency === 'CUP' ? data.amount : data.amount * rate;

    const transaction = await fastify.prisma.financialTransaction.create({
      data: {
        projectId: data.projectId,
        clientId: resolvedClientId,
        type: data.type,
        amount: data.amount,
        currency: data.currency,
        amountCup: amountCup,
        exchangeRateUsed: rate,
        description: data.description,
        date: parseBrazilDateOnly(data.date) || todayBrazilDateOnly(),
        status: data.status,
        category: data.category,
        dueDate: parseBrazilDateOnly(data.dueDate),
        paymentDate: parseBrazilDateOnly(data.paymentDate)
      }
    });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'finance.transaction.create',
      entityType: 'FinancialTransaction',
      entityId: transaction.id,
      message: `${data.type === 'INCOME' ? 'Registrou receita' : 'Registrou despesa'} de ${data.amount} ${data.currency}`,
      metadata: { projectId: data.projectId, clientId: resolvedClientId, amountCup }
    });

    return transaction;
  });

  fastify.delete('/transactions/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const id = parseInt(request.params.id);
    await fastify.prisma.financialTransaction.delete({ where: { id } });
    return { success: true };
  });

  fastify.put('/transactions/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id);
    if (!Number.isInteger(id) || id <= 0) return reply.status(400).send({ error: 'ID inválido' });
    const data = transactionSchema.partial().parse(request.body);

    let resolvedClientId = data.clientId === undefined ? undefined : data.clientId || null;
    if (data.projectId) {
      const project = await fastify.prisma.project.findUnique({
        where: { id: data.projectId },
        select: { id: true, clientId: true }
      });

      if (!project) {
        return reply.status(404).send({ error: 'Projeto não encontrado' });
      }

      if (data.clientId && data.clientId !== project.clientId) {
        return reply.status(400).send({
          error: 'Cliente incompatível',
          message: 'O clientId informado não pertence ao projeto selecionado.'
        });
      }

      resolvedClientId = project.clientId;
    }

    let amountCup: number | undefined;
    let exchangeRateUsed: number | undefined;
    if (data.amount !== undefined || data.currency !== undefined) {
      const current = await fastify.prisma.financialTransaction.findUnique({ where: { id } });
      if (!current) return reply.status(404).send({ error: 'Transação não encontrada' });
      const currency = data.currency || current.currency;
      const amount = data.amount ?? Number(current.amount);
      const latestRate = await fastify.prisma.exchangeRate.findFirst({
        where: { currency: { code: currency } },
        orderBy: { date: 'desc' }
      });

      exchangeRateUsed = latestRate ? Number(latestRate.rate) : 1;
      amountCup = currency === 'CUP' ? amount : amount * exchangeRateUsed;
    }

    const transaction = await fastify.prisma.financialTransaction.update({
      where: { id },
      data: {
        projectId: data.projectId === undefined ? undefined : data.projectId,
        clientId: resolvedClientId,
        type: data.type,
        amount: data.amount,
        currency: data.currency,
        amountCup,
        exchangeRateUsed,
        description: data.description,
        date: parseBrazilDateOnly(data.date) ?? undefined,
        status: data.status,
        category: data.category,
        dueDate: data.dueDate === null ? null : (parseBrazilDateOnly(data.dueDate) ?? undefined),
        paymentDate: data.paymentDate === null ? null : (parseBrazilDateOnly(data.paymentDate) ?? undefined)
      }
    });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'finance.transaction.update',
      entityType: 'FinancialTransaction',
      entityId: transaction.id,
      message: `Atualizou transação financeira #${transaction.id}`
    });

    return transaction;
  });

  fastify.patch('/transactions/:id/settle', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const id = parseInt(request.params.id);
    const data = settleSchema.parse(request.body || {});
    const transaction = await fastify.prisma.financialTransaction.update({
      where: { id },
      data: {
        status: 'SETTLED',
        paymentDate: parseBrazilDateOnly(data.paymentDate) || todayBrazilDateOnly()
      }
    });
    return transaction;
  });

  fastify.get('/summary', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    const { startDate, endDate } = request.query as any;

    const where: any = { status: 'SETTLED' };
    const range = brazilDateRange(startDate, endDate);
    if (range) where.date = range;

    const incomes = await fastify.prisma.financialTransaction.aggregate({
      where: { ...where, type: 'INCOME', status: 'SETTLED' },
      _sum: { amountCup: true }
    });

    const expenses = await fastify.prisma.financialTransaction.aggregate({
      where: { ...where, type: 'EXPENSE', status: 'SETTLED' },
      _sum: { amountCup: true }
    });

    const byProject = await fastify.prisma.financialTransaction.groupBy({
      by: ['projectId'],
      where: { ...where, status: 'SETTLED' },
      _sum: { amountCup: true },
      _count: true
    });

    const projects = await fastify.prisma.project.findMany();
    const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]));

    const projectSummary = await Promise.all(
      byProject.filter(b => b.projectId).map(async (b) => {
        const income = await fastify.prisma.financialTransaction.aggregate({
          where: { ...where, projectId: b.projectId, type: 'INCOME', status: 'SETTLED' },
          _sum: { amountCup: true }
        });
        const expense = await fastify.prisma.financialTransaction.aggregate({
          where: { ...where, projectId: b.projectId, type: 'EXPENSE', status: 'SETTLED' },
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

    const pendingWhere: any = { status: 'PENDING' };
    const pendingRange = brazilDateRange(startDate, endDate);
    if (pendingRange) pendingWhere.date = pendingRange;

    const pendingIncomes = await fastify.prisma.financialTransaction.aggregate({
      where: { ...pendingWhere, type: 'INCOME' },
      _sum: { amountCup: true }
    });

    const pendingExpenses = await fastify.prisma.financialTransaction.aggregate({
      where: { ...pendingWhere, type: 'EXPENSE' },
      _sum: { amountCup: true }
    });

    return {
      totalIncome: Number(incomes._sum.amountCup || 0),
      totalExpense: Number(expenses._sum.amountCup || 0),
      profit: Number(incomes._sum.amountCup || 0) - Number(expenses._sum.amountCup || 0),
      margin: incomes._sum.amountCup ?
        ((Number(incomes._sum.amountCup) - Number(expenses._sum.amountCup)) / Number(incomes._sum.amountCup) * 100).toFixed(2) : '0',
      byProject: projectSummary,
      pending: {
        income: Number(pendingIncomes._sum.amountCup || 0),
        expense: Number(pendingExpenses._sum.amountCup || 0),
      }
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
