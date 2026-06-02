import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  BarChart3,
  CalendarDays,
  Coins,
  Database,
  FolderKanban,
  LineChart,
  Receipt,
  Scale,
  Server,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { dashboardApi, financeApi, projectApi, vpsApi } from '../api/client';
import { formatBrazilDate, todayBrazilDateInput } from '../utils/dates';
import { infraTypeLabel, statusLabel } from '../utils/labels';

type PeriodKey = 'month' | 'quarter' | 'semester' | 'year';
type ReportTab = 'summary' | 'costs' | 'projects';

type PeriodRange = {
  key: PeriodKey;
  label: string;
  startDate: string;
  endDate: string;
  months: number;
};

type ProjectReportRow = {
  id: number;
  name: string;
  status?: string;
  income: number;
  expense: number;
  infraMonthly: number;
  infraPeriod: number;
  result: number;
  margin: number | null;
};

const PERIOD_OPTIONS: Array<{ key: PeriodKey; label: string }> = [
  { key: 'month', label: 'Mês' },
  { key: 'quarter', label: 'Trimestre' },
  { key: 'semester', label: 'Semestre' },
  { key: 'year', label: 'Ano' },
];

const TAB_OPTIONS: Array<{ key: ReportTab; label: string }> = [
  { key: 'summary', label: 'Resumo' },
  { key: 'costs', label: 'Custos' },
  { key: 'projects', label: 'Projetos' },
];

function toUtcDate(dateInput: string) {
  const [year, month, day] = dateInput.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function endOfMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0, 12, 0, 0, 0));
}

function getPeriodRange(period: PeriodKey): PeriodRange {
  const today = toUtcDate(todayBrazilDateInput());
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();

  if (period === 'month') {
    return {
      key: period,
      label: 'Mês atual',
      startDate: toDateInput(new Date(Date.UTC(year, month, 1, 12))),
      endDate: toDateInput(endOfMonth(year, month)),
      months: 1,
    };
  }

  if (period === 'quarter') {
    const quarterStart = Math.floor(month / 3) * 3;
    return {
      key: period,
      label: 'Trimestre atual',
      startDate: toDateInput(new Date(Date.UTC(year, quarterStart, 1, 12))),
      endDate: toDateInput(endOfMonth(year, quarterStart + 2)),
      months: 3,
    };
  }

  if (period === 'semester') {
    const semesterStart = month < 6 ? 0 : 6;
    return {
      key: period,
      label: 'Semestre atual',
      startDate: toDateInput(new Date(Date.UTC(year, semesterStart, 1, 12))),
      endDate: toDateInput(endOfMonth(year, semesterStart + 5)),
      months: 6,
    };
  }

  return {
    key: period,
    label: 'Ano atual',
    startDate: toDateInput(new Date(Date.UTC(year, 0, 1, 12))),
    endDate: toDateInput(endOfMonth(year, 11)),
    months: 12,
  };
}

function formatCurrency(value: number, currency = 'BRL') {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value || 0);
  } catch {
    return `${currency} ${(value || 0).toFixed(2)}`;
  }
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function safeNumber(value: unknown) {
  return Number(value || 0);
}

function monthLabel(value: string) {
  const [year, month] = value.split('-');
  return `${month}/${year.slice(2)}`;
}

function StatCard({
  title,
  value,
  icon,
  tone,
  detail,
}: {
  title: string;
  value: string;
  icon: ReactNode;
  tone: 'green' | 'red' | 'blue' | 'slate';
  detail?: string;
}) {
  const toneMap = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/30',
    red: 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-900/30',
    blue: 'bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-950/20 dark:text-sky-300 dark:border-sky-900/30',
    slate: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-200 dark:border-slate-800',
  };

  return (
    <div className="erp-stat-card min-h-[138px]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{title}</span>
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg border ${toneMap[tone]}`}>
          {icon}
        </span>
      </div>
      <p className="mt-4 font-mono text-2xl font-extrabold text-slate-800 dark:text-white">{value}</p>
      {detail && <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{detail}</p>}
    </div>
  );
}

export default function Reports() {
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [activeTab, setActiveTab] = useState<ReportTab>('summary');
  const selectedPeriod = useMemo(() => getPeriodRange(period), [period]);

  const reportParams = useMemo(() => ({
    startDate: selectedPeriod.startDate,
    endDate: selectedPeriod.endDate,
  }), [selectedPeriod.endDate, selectedPeriod.startDate]);

  const { data: transactions = [], isLoading: isLoadingTransactions } = useQuery<any[]>({
    queryKey: ['report-transactions', reportParams],
    queryFn: () => financeApi.getTransactions(reportParams),
  });
  const { data: summary } = useQuery<any>({
    queryKey: ['report-finance-summary', reportParams],
    queryFn: () => financeApi.getSummary(reportParams),
  });
  const { data: costs } = useQuery<any>({
    queryKey: ['report-infra-costs'],
    queryFn: vpsApi.getCosts,
  });
  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ['report-projects'],
    queryFn: projectApi.getAll,
  });
  const { data: chartData = [] } = useQuery<any[]>({
    queryKey: ['report-income-expense-chart-12'],
    queryFn: () => dashboardApi.getIncomeExpenseChart(12),
  });

  const infraResources = useMemo(() => {
    const servers = (costs?.servers || []).map((item: any) => ({
      id: `server-${item.id}`,
      name: item.name,
      kind: 'VPS',
      currency: item.currency || 'BRL',
      cost: safeNumber(item.cost),
      monthlyEquivalent: safeNumber(item.monthlyEquivalent),
      renewalDate: item.renewalDate,
    }));

    const items = (costs?.items || []).map((item: any) => ({
      id: `item-${item.id}`,
      name: item.name,
      kind: infraTypeLabel(item.type || 'OTHER'),
      currency: item.currency || 'BRL',
      cost: safeNumber(item.cost),
      monthlyEquivalent: safeNumber(item.monthlyEquivalent),
      renewalDate: item.renewalDate,
    }));

    return [...servers, ...items];
  }, [costs]);

  const monthlyInfraBRL = safeNumber(costs?.totalsByCurrency?.BRL ?? costs?.totalMonthly);
  const infraForPeriod = monthlyInfraBRL * selectedPeriod.months;
  const committedInfraBRL = infraResources
    .filter((resource) => resource.currency === 'BRL')
    .reduce((sum, resource) => sum + resource.cost, 0);

  const settledIncome = safeNumber(summary?.totalIncome);
  const settledExpense = safeNumber(summary?.totalExpense);
  const pendingIncome = safeNumber(summary?.pending?.income);
  const pendingExpense = safeNumber(summary?.pending?.expense);
  const accountingResult = settledIncome - settledExpense;
  const operationalResult = settledIncome - settledExpense - infraForPeriod;
  const operationalMargin = settledIncome > 0 ? (operationalResult / settledIncome) * 100 : 0;

  const projectRows = useMemo<ProjectReportRow[]>(() => {
    const rows = new Map<number, ProjectReportRow>();

    projects.forEach((project: any) => {
      rows.set(project.id, {
        id: project.id,
        name: project.name,
        status: project.status,
        income: 0,
        expense: 0,
        infraMonthly: safeNumber(costs?.byProject?.[project.id]),
        infraPeriod: safeNumber(costs?.byProject?.[project.id]) * selectedPeriod.months,
        result: 0,
        margin: null,
      });
    });

    transactions
      .filter((transaction: any) => transaction.status === 'SETTLED' && transaction.projectId)
      .forEach((transaction: any) => {
        const existing = rows.get(transaction.projectId) || {
          id: transaction.projectId,
          name: transaction.project?.name || `Projeto #${transaction.projectId}`,
          status: transaction.project?.status,
          income: 0,
          expense: 0,
          infraMonthly: safeNumber(costs?.byProject?.[transaction.projectId]),
          infraPeriod: safeNumber(costs?.byProject?.[transaction.projectId]) * selectedPeriod.months,
          result: 0,
          margin: null,
        };

        if (transaction.type === 'INCOME') existing.income += safeNumber(transaction.amountCup);
        if (transaction.type === 'EXPENSE') existing.expense += safeNumber(transaction.amountCup);
        rows.set(transaction.projectId, existing);
      });

    return Array.from(rows.values())
      .map((row) => {
        const result = row.income - row.expense - row.infraPeriod;
        return {
          ...row,
          result,
          margin: row.income > 0 ? (result / row.income) * 100 : null,
        };
      })
      .filter((row) => row.income > 0 || row.expense > 0 || row.infraMonthly > 0)
      .sort((a, b) => b.result - a.result);
  }, [costs?.byProject, projects, selectedPeriod.months, transactions]);

  const allocatedInfraMonthly = projectRows.reduce((sum, row) => sum + row.infraMonthly, 0);
  const unallocatedInfraMonthly = Math.max(0, monthlyInfraBRL - allocatedInfraMonthly);

  const monthlyTrend = useMemo(() => (
    chartData.map((item: any) => {
      const income = safeNumber(item.income);
      const expense = safeNumber(item.expense);
      return {
        month: monthLabel(item.month),
        income,
        expense,
        infra: monthlyInfraBRL,
        result: income - expense - monthlyInfraBRL,
      };
    })
  ), [chartData, monthlyInfraBRL]);

  const resourceRows = infraResources
    .slice()
    .sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent);

  return (
    <div className="erp-module">
      <div className="erp-module-header">
        <div>
          <h1 className="erp-module-title">
            <BarChart3 className="text-brand-500" size={26} />
            Relatórios
          </h1>
          <p className="erp-module-subtitle">Análise por competência com receitas, despesas, infraestrutura mensalizada e rentabilidade por projeto.</p>
        </div>
      </div>

      <div className="erp-filter-bar">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setPeriod(option.key)}
                className={`min-h-10 rounded-lg border px-4 py-2 text-sm font-bold transition-colors ${
                  period === option.key
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/20 dark:text-brand-300'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
            <CalendarDays size={16} />
            {selectedPeriod.label}: {formatBrazilDate(selectedPeriod.startDate)} até {formatBrazilDate(selectedPeriod.endDate)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Receitas do Período"
          value={formatCurrency(settledIncome)}
          icon={<TrendingUp size={19} />}
          tone="green"
          detail={`Pendente: ${formatCurrency(pendingIncome)}`}
        />
        <StatCard
          title="Despesas Avulsas"
          value={formatCurrency(settledExpense)}
          icon={<TrendingDown size={19} />}
          tone="red"
          detail={`Pendente: ${formatCurrency(pendingExpense)}`}
        />
        <StatCard
          title="Custo Fixo de Infra"
          value={formatCurrency(infraForPeriod)}
          icon={<Server size={19} />}
          tone="blue"
          detail={`${formatCurrency(monthlyInfraBRL)}/mês em competência`}
        />
        <StatCard
          title="Resultado Operacional"
          value={formatCurrency(operationalResult)}
          icon={<Scale size={19} />}
          tone={operationalResult >= 0 ? 'green' : 'red'}
          detail={`Margem operacional: ${operationalMargin.toFixed(1)}%`}
        />
      </div>

      <div className="erp-panel">
        <div className="flex flex-wrap gap-2">
          {TAB_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setActiveTab(option.key)}
              className={`min-h-10 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                activeTab === option.key
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.6fr)]">
          <div className="erp-panel">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Tendência de Competência</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Últimos 12 meses com infraestrutura mensal atual aplicada.</p>
              </div>
              <LineChart className="text-brand-500" size={22} />
            </div>
            {monthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={330}>
                <BarChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => formatCompactCurrency(Number(value))} width={88} />
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value) || 0)} />
                  <Legend />
                  <Bar dataKey="income" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="infra" name="Infra" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="result" name="Resultado" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="erp-empty-state py-12 text-sm text-slate-500">Sem dados financeiros para montar a tendência.</div>
            )}
          </div>

          <div className="erp-panel">
            <div className="mb-4 flex items-center gap-2">
              <Receipt className="text-brand-500" size={20} />
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">DRE Simples</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Receitas quitadas</span>
                <span className="font-mono font-bold text-emerald-600">{formatCurrency(settledIncome)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Despesas quitadas</span>
                <span className="font-mono font-bold text-rose-600">-{formatCurrency(settledExpense)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Resultado financeiro</span>
                <span className={`font-mono font-bold ${accountingResult >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(accountingResult)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Infraestrutura fixa</span>
                <span className="font-mono font-bold text-sky-600">-{formatCurrency(infraForPeriod)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 dark:bg-slate-900/50">
                <span className="font-extrabold text-slate-800 dark:text-white">Resultado operacional</span>
                <span className={`font-mono text-lg font-extrabold ${operationalResult >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(operationalResult)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'costs' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard
              title="Infra Contratada"
              value={formatCurrency(committedInfraBRL)}
              icon={<Coins size={19} />}
              tone="slate"
              detail="Soma dos custos cadastrados em BRL"
            />
            <StatCard
              title="Equivalente Mensal"
              value={formatCurrency(monthlyInfraBRL)}
              icon={<WalletCards size={19} />}
              tone="blue"
              detail={`${selectedPeriod.months} mês(es): ${formatCurrency(infraForPeriod)}`}
            />
            <StatCard
              title="Sem Projeto"
              value={formatCurrency(unallocatedInfraMonthly)}
              icon={<Database size={19} />}
              tone={unallocatedInfraMonthly > 0 ? 'red' : 'green'}
              detail="Custo mensal ainda sem rateio"
            />
          </div>

          <div className="erp-panel">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Infraestrutura Mensalizada</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{resourceRows.length} recurso(s)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[860px] w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Recurso</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Tipo</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Custo cadastrado</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Mensal</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">No período</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Vencimento</th>
                  </tr>
                </thead>
                <tbody>
                  {resourceRows.length > 0 ? resourceRows.map((resource) => (
                    <tr key={resource.id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/60">
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{resource.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{resource.kind}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm">{formatCurrency(resource.cost, resource.currency)}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-bold text-sky-600">{formatCurrency(resource.monthlyEquivalent, resource.currency)}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-bold">{formatCurrency(resource.monthlyEquivalent * selectedPeriod.months, resource.currency)}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{resource.renewalDate ? formatBrazilDate(resource.renewalDate) : 'Sem data'}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="py-10 text-center text-sm text-slate-500">Nenhum custo de infraestrutura cadastrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="erp-panel">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <FolderKanban className="text-brand-500" size={20} />
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Rentabilidade por Projeto</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{projectRows.length} projeto(s) com movimento ou custo</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Projeto</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Receitas</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Despesas</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Infra</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Resultado</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Margem</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingTransactions ? (
                  <tr><td colSpan={7} className="py-10 text-center text-sm text-slate-500">Carregando relatório...</td></tr>
                ) : projectRows.length > 0 ? projectRows.map((project) => (
                  <tr key={project.id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/60">
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{project.name}</td>
                    <td className="px-4 py-3">
                      <span className="erp-status-pill border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                        {statusLabel(project.status || 'ACTIVE')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-emerald-600">{formatCurrency(project.income)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-rose-600">-{formatCurrency(project.expense)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-sky-600">-{formatCurrency(project.infraPeriod)}</td>
                    <td className={`px-4 py-3 text-right font-mono text-sm font-bold ${project.result >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatCurrency(project.result)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {project.margin === null ? '—' : `${project.margin.toFixed(1)}%`}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="py-10 text-center text-sm text-slate-500">Nenhum projeto com movimento no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
