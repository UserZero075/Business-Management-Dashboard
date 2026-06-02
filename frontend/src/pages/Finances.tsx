import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { financeApi, projectApi } from '../api/client';
import { useToast } from '../hooks/useToast';
import { advanceBrazilDateInput, formatBrazilDate, todayBrazilDateInput, toDateInputValue } from '../utils/dates';
import {
  AlertCircle,
  CheckCircle,
  Filter,
  Pencil,
  Plus,
  RepeatIcon,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X,
} from 'lucide-react';

type TransactionType = 'INCOME' | 'EXPENSE';
type TransactionStatus = 'SETTLED' | 'PENDING';

type Transaction = {
  id: number;
  type: TransactionType;
  amount: number;
  currency: string;
  description?: string | null;
  projectId?: number | null;
  project?: { id: number; name: string } | null;
  date: string;
  status: TransactionStatus;
  paymentDate?: string | null;
};

type ProjectOption = {
  id: number;
  name: string;
};

type SettleTarget = {
  id: number;
  type: TransactionType;
  amount: number;
  currency: string;
  description: string | null;
  projectId: number | null;
};

type RecurringState = {
  enabled: boolean;
  period: 'quinzenal' | 'mensal' | 'anual';
  times: number;
  valueType: 'per_period' | 'total';
};

const PERIOD_LABELS: Record<RecurringState['period'], string> = {
  quinzenal: 'Quinzenal (15 dias)',
  mensal: 'Mensal',
  anual: 'Anual',
};

function splitAmount(total: number, n: number): number[] {
  const base = Math.floor((total / n) * 100) / 100;
  const last = Math.round((total - base * (n - 1)) * 100) / 100;
  return [...Array(n - 1).fill(base), last];
}

const today = todayBrazilDateInput();

export default function Finances() {
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TransactionStatus>('ALL');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [formData, setFormData] = useState({
    projectId: null as number | null,
    type: 'INCOME' as TransactionType,
    amount: 0,
    currency: 'BRL',
    description: '',
    date: today,
    status: 'SETTLED' as TransactionStatus,
  });
  const [recurring, setRecurring] = useState<RecurringState>({
    enabled: false,
    period: 'mensal',
    times: 2,
    valueType: 'per_period',
  });
  const [settleTarget, setSettleTarget] = useState<SettleTarget | null>(null);
  const [settleDate, setSettleDate] = useState(today);
  const [settleAmount, setSettleAmount] = useState(0);
  const [settling, setSettling] = useState(false);

  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: transactions = [], isLoading: isLoadingTransactions } = useQuery<Transaction[]>({ queryKey: ['transactions'], queryFn: () => financeApi.getTransactions() });
  const { data: summary } = useQuery<any>({ queryKey: ['finance-summary'], queryFn: () => financeApi.getSummary() });
  const { data: projects = [] } = useQuery<ProjectOption[]>({ queryKey: ['projects'], queryFn: projectApi.getAll });

  const invalidateFinances = () => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
  };

  const deleteMutation = useMutation({
    mutationFn: financeApi.deleteTransaction,
    onSuccess: () => {
      invalidateFinances();
      toast.success('Transação excluída.');
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao excluir transação.'),
  });

  const openSettleModal = (transaction: Transaction) => {
    setSettleTarget({
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      currency: transaction.currency,
      description: transaction.description || null,
      projectId: transaction.projectId ?? null,
    });
    setSettleDate(today);
    setSettleAmount(transaction.amount);
  };

  const openCreateModal = () => {
    setEditingTransaction(null);
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setRecurring({ enabled: false, period: 'mensal', times: 2, valueType: 'per_period' });
    setFormData({
      projectId: transaction.projectId ?? null,
      type: transaction.type,
      amount: Number(transaction.amount || 0),
      currency: transaction.currency || 'BRL',
      description: transaction.description || '',
      date: toDateInputValue(transaction.date) || today,
      status: transaction.status,
    });
    setShowModal(true);
  };

  const getSettleAdjustment = () => {
    if (!settleTarget) return null;
    const diff = Math.round((settleAmount - settleTarget.amount) * 100) / 100;
    if (Math.abs(diff) < 0.01) return null;
    if (diff > 0) {
      return { type: settleTarget.type, amount: diff, label: '(Juros/Multa)', variant: 'danger' as const };
    }
    return {
      type: settleTarget.type === 'INCOME' ? 'EXPENSE' as const : 'INCOME' as const,
      amount: Math.abs(diff),
      label: '(Desconto)',
      variant: 'info' as const,
    };
  };

  const handleSettle = async () => {
    if (!settleTarget) return;
    setSettling(true);
    try {
      await financeApi.settleTransaction(settleTarget.id, { paymentDate: settleDate });
      const adjustment = getSettleAdjustment();
      if (adjustment) {
        await financeApi.createTransaction({
          type: adjustment.type,
          amount: adjustment.amount,
          currency: settleTarget.currency,
          description: `${settleTarget.description || ''} ${adjustment.label}`.trim(),
          date: settleDate,
          projectId: settleTarget.projectId,
          status: 'SETTLED',
          paymentDate: settleDate,
        });
      }
      invalidateFinances();
      setSettleTarget(null);
      toast.success('Baixa confirmada.');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao confirmar baixa.');
    } finally {
      setSettling(false);
    }
  };

  const formatCurrency = (amount: number, currency = 'BRL') => {
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amount || 0);
    } catch {
      return `${currency} ${(amount || 0).toFixed(2)}`;
    }
  };

  const formatDate = (value?: string | null) => {
    return formatBrazilDate(value);
  };

  const resetForm = () => {
    setFormData({ projectId: null, type: 'INCOME', amount: 0, currency: 'BRL', description: '', date: today, status: 'SETTLED' });
    setRecurring({ enabled: false, period: 'mensal', times: 2, valueType: 'per_period' });
  };

  const previewInstallment = () => {
    if (!recurring.enabled || formData.amount <= 0) return null;
    const n = recurring.times;
    if (recurring.valueType === 'per_period') {
      return { each: formData.amount, total: formData.amount * n };
    }
    const amounts = splitAmount(formData.amount, n);
    return { each: amounts[0], last: amounts[n - 1], total: formData.amount };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingTransaction) {
        await financeApi.updateTransaction(editingTransaction.id, { ...formData, status: formData.status });
      } else if (!recurring.enabled) {
        await financeApi.createTransaction({ ...formData, status: formData.status });
      } else {
        const n = recurring.times;
        const amounts = recurring.valueType === 'per_period'
          ? Array(n).fill(formData.amount)
          : splitAmount(formData.amount, n);

        let current = formData.date;
        for (let i = 0; i < n; i++) {
          await financeApi.createTransaction({
            ...formData,
            amount: amounts[i],
            date: current,
            description: formData.description ? `${formData.description} (${i + 1}/${n})` : `Parcela ${i + 1}/${n}`,
            status: 'PENDING',
          });
          current = advanceBrazilDateInput(current, recurring.period);
        }
      }
      invalidateFinances();
      setShowModal(false);
      setEditingTransaction(null);
      resetForm();
      toast.success(editingTransaction ? 'Transação atualizada.' : recurring.enabled ? 'Transações recorrentes criadas.' : 'Transação registrada.');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar transação.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalIncome = summary?.totalIncome || 0;
  const totalExpense = summary?.totalExpense || 0;
  const profit = totalIncome - totalExpense;
  const margin = totalIncome > 0 ? ((profit / totalIncome) * 100).toFixed(1) : '0';
  const preview = previewInstallment();
  const hasActiveFilters = Boolean(search.trim()) || typeFilter !== 'ALL' || statusFilter !== 'ALL' || projectFilter !== 'ALL';

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const matchesSearch =
        !q ||
        (transaction.description || '').toLowerCase().includes(q) ||
        (transaction.project?.name || '').toLowerCase().includes(q) ||
        transaction.currency.toLowerCase().includes(q);
      const matchesType = typeFilter === 'ALL' || transaction.type === typeFilter;
      const matchesStatus = statusFilter === 'ALL' || transaction.status === statusFilter;
      const matchesProject = projectFilter === 'ALL' || String(transaction.projectId || '') === projectFilter;
      return matchesSearch && matchesType && matchesStatus && matchesProject;
    });
  }, [projectFilter, search, statusFilter, transactions, typeFilter]);

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setProjectFilter('ALL');
  };

  const renderTypeBadge = (type: TransactionType) => (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
      type === 'INCOME' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400'
    }`}>
      {type === 'INCOME' ? 'Receita' : 'Despesa'}
    </span>
  );

  const renderStatusBadge = (status: TransactionStatus) => (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
      status === 'SETTLED' ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'
    }`}>
      {status === 'SETTLED' ? 'Quitada' : 'Pendente'}
    </span>
  );

  return (
    <div className="erp-module">
      <div className="erp-module-header">
        <div>
          <h1 className="erp-module-title">
            <WalletCards className="text-brand-500" size={26} />
            Finanças
          </h1>
          <p className="erp-module-subtitle">Receitas, despesas, pendências, baixas e recorrências básicas por projeto.</p>
        </div>
        <button type="button" onClick={openCreateModal} className="erp-primary-action">
          <Plus size={20} />
          Nova Transação
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="erp-stat-card">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-emerald-500" />
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <TrendingUp className="text-emerald-600" size={18} />
            Receitas Totais
          </div>
          <p className="mt-4 font-mono text-2xl font-extrabold text-slate-800 dark:text-white">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="erp-stat-card">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-rose-500" />
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <TrendingDown className="text-rose-600" size={18} />
            Despesas Totais
          </div>
          <p className="mt-4 font-mono text-2xl font-extrabold text-slate-800 dark:text-white">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="erp-stat-card">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-brand-500" />
          <p className="text-sm font-semibold text-slate-500">Resultado Líquido</p>
          <p className="mt-4 font-mono text-2xl font-extrabold text-slate-800 dark:text-white">{formatCurrency(profit)}</p>
        </div>
        <div className="erp-stat-card">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-sky-500" />
          <p className="text-sm font-semibold text-slate-500">Margem</p>
          <p className="mt-4 font-mono text-2xl font-extrabold text-slate-800 dark:text-white">{margin}%</p>
        </div>
      </div>

      {(summary?.pending?.income > 0 || summary?.pending?.expense > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <span className="font-bold text-amber-800 dark:text-amber-300">Pendências</span>
            {summary.pending.income > 0 && <span className="font-medium text-emerald-700 dark:text-emerald-400">A receber: {formatCurrency(summary.pending.income)}</span>}
            {summary.pending.expense > 0 && <span className="font-medium text-rose-700 dark:text-rose-400">A pagar: {formatCurrency(summary.pending.expense)}</span>}
          </div>
        </div>
      )}

      <div className="erp-filter-bar">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_160px_160px_220px_auto]">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="erp-input-with-icon"
              placeholder="Buscar por descrição, projeto ou moeda"
            />
          </div>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)} className="erp-input">
            <option value="ALL">Todos os tipos</option>
            <option value="INCOME">Receitas</option>
            <option value="EXPENSE">Despesas</option>
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="erp-input">
            <option value="ALL">Todos os status</option>
            <option value="SETTLED">Quitadas</option>
            <option value="PENDING">Pendentes</option>
          </select>
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="erp-input">
            <option value="ALL">Todos os projetos</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
          <button type="button" onClick={clearFilters} disabled={!hasActiveFilters} className="erp-secondary-action">
            <Filter size={16} />
            Limpar
          </button>
        </div>
      </div>

      {summary?.byProject && summary.byProject.length > 0 && (
        <div className="erp-panel">
          <h3 className="mb-4 text-lg font-bold text-slate-800 dark:text-white">Resultado por Projeto</h3>
          <div className="space-y-3">
            {summary.byProject.map((item: any) => (
              <div key={item.projectId} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/40 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-200">{item.projectName}</span>
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-medium text-emerald-600">{formatCurrency(item.income)}</span>
                  <span className="font-medium text-rose-600">-{formatCurrency(item.expense)}</span>
                  <span className={`font-bold ${item.profit >= 0 ? 'text-brand-600' : 'text-rose-600'}`}>{formatCurrency(item.profit)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="erp-panel">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">Transações</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{filteredTransactions.length} registro(s)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Data</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Projeto</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Valor</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Descrição</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingTransactions ? (
                <tr><td colSpan={7} className="py-10 text-center text-sm text-slate-500">Carregando transações...</td></tr>
              ) : filteredTransactions.length > 0 ? (
                filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/60">
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      <div>{formatDate(transaction.date)}</div>
                      {transaction.paymentDate && <div className="text-xs text-slate-400">Pago: {formatDate(transaction.paymentDate)}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200">{transaction.project?.name || 'Sem projeto'}</td>
                    <td className="px-4 py-3">{renderTypeBadge(transaction.type)}</td>
                    <td className="px-4 py-3">{renderStatusBadge(transaction.status)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-bold text-slate-800 dark:text-white">{formatCurrency(transaction.amount, transaction.currency)}</td>
                    <td className="max-w-[260px] px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      <span className="line-clamp-2">{transaction.description || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {transaction.status === 'PENDING' && (
                          <button
                            type="button"
                            onClick={() => openSettleModal(transaction)}
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                            title="Dar baixa"
                          >
                            <CheckCircle size={14} />
                            Dar baixa
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditModal(transaction)}
                          className="erp-icon-button h-9 w-9"
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Excluir esta transação? Esta ação não pode ser desfeita.')) deleteMutation.mutate(transaction.id);
                          }}
                          className="erp-icon-button h-9 w-9 hover:text-rose-600"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7} className="py-10 text-center text-sm text-slate-500">Nenhuma transação encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {settleTarget && (() => {
        const adjustment = getSettleAdjustment();
        const originalAmount = formatCurrency(settleTarget.amount, settleTarget.currency);
        const settledAmount = formatCurrency(settleAmount, settleTarget.currency);
        return (
          <div className="erp-modal-overlay" onClick={() => setSettleTarget(null)}>
            <div className="erp-modal max-w-md animate-slide-up" onClick={(event) => event.stopPropagation()}>
              <div className="erp-modal-header">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white">Dar baixa</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Confirme os dados do recebimento ou pagamento.</p>
                </div>
                <button type="button" onClick={() => setSettleTarget(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                  <X size={18} />
                </button>
              </div>

              <div className="erp-modal-body">
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Tipo</span>
                    <span className={`font-semibold ${settleTarget.type === 'INCOME' ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {settleTarget.type === 'INCOME' ? 'Receita' : 'Despesa'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Descrição</span>
                    <span className="max-w-[60%] text-right font-medium text-slate-700 dark:text-slate-200">{settleTarget.description || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Valor original</span>
                    <span className="font-semibold text-slate-800 dark:text-white">{originalAmount}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="erp-label">Data do pagamento</label>
                    <input type="date" value={settleDate} onChange={(event) => setSettleDate(event.target.value)} className="erp-input" />
                  </div>
                  <div>
                    <label className="erp-label">Valor {settleTarget.type === 'INCOME' ? 'recebido' : 'pago'}</label>
                    <input type="number" step="0.01" min="0.01" value={settleAmount || ''} onChange={(event) => setSettleAmount(Number(event.target.value))} className="erp-input" />
                  </div>
                </div>

                {adjustment && (
                  <div className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
                    adjustment.variant === 'danger'
                      ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300'
                      : 'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-900/40 dark:bg-brand-950/20 dark:text-brand-300'
                  }`}>
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold">{adjustment.label === '(Juros/Multa)' ? 'Juros / multa detectados' : 'Desconto detectado'}</p>
                      <p className="mt-0.5 text-xs">
                        Será criado um lançamento de <strong>{adjustment.type === 'INCOME' ? 'Receita' : 'Despesa'}</strong> de <strong>{formatCurrency(adjustment.amount, settleTarget.currency)}</strong>.
                      </p>
                      <p className="mt-1 text-xs opacity-75">Original {originalAmount} → {settleTarget.type === 'INCOME' ? 'Recebido' : 'Pago'} {settledAmount}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="erp-modal-footer">
                <button type="button" onClick={() => setSettleTarget(null)} className="erp-secondary-action">Cancelar</button>
                <button type="button" onClick={handleSettle} disabled={settling || settleAmount <= 0} className="erp-success-action">
                  {settling ? 'Confirmando...' : 'Confirmar baixa'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showModal && (
        <div className="erp-modal-overlay" onClick={() => { setShowModal(false); setEditingTransaction(null); resetForm(); }}>
          <div className="erp-modal max-w-lg animate-slide-up" onClick={(event) => event.stopPropagation()}>
            <div className="erp-modal-header">
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">{editingTransaction ? 'Editar Transação' : 'Nova Transação'}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {editingTransaction ? 'Atualize os dados do lançamento financeiro.' : 'Registre receitas, despesas e recorrências simples.'}
                </p>
              </div>
              <button type="button" onClick={() => { setShowModal(false); setEditingTransaction(null); resetForm(); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="erp-modal-body">
                <div>
                  <label className="erp-label">Projeto</label>
                  <select value={formData.projectId || ''} onChange={(event) => setFormData({ ...formData, projectId: event.target.value ? Number(event.target.value) : null })} className="erp-input">
                    <option value="">Sem projeto</option>
                    {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="erp-label">Tipo</label>
                    <select value={formData.type} onChange={(event) => setFormData({ ...formData, type: event.target.value as TransactionType })} className="erp-input">
                      <option value="INCOME">Receita</option>
                      <option value="EXPENSE">Despesa</option>
                    </select>
                  </div>
                  <div>
                    <label className="erp-label">Moeda</label>
                    <select value={formData.currency} onChange={(event) => setFormData({ ...formData, currency: event.target.value })} className="erp-input">
                      <option value="BRL">BRL (R$)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="erp-label">
                      {recurring.enabled && recurring.valueType === 'total' ? 'Valor total' : recurring.enabled ? 'Valor por período' : 'Valor'}
                    </label>
                    <input type="number" step="0.01" min="0.01" value={formData.amount || ''} onChange={(event) => setFormData({ ...formData, amount: Number(event.target.value) })} className="erp-input" required />
                  </div>
                  <div>
                    <label className="erp-label">Primeira data</label>
                    <input type="date" value={formData.date} onChange={(event) => setFormData({ ...formData, date: event.target.value })} className="erp-input" required />
                  </div>
                </div>

                <div>
                  <label className="erp-label">Descrição</label>
                  <input type="text" value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} className="erp-input" />
                </div>

                {!recurring.enabled && (
                  <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-300">
                    <input type="checkbox" checked={formData.status === 'SETTLED'} onChange={(event) => setFormData({ ...formData, status: event.target.checked ? 'SETTLED' : 'PENDING' })} className="rounded" />
                    Já pago / recebido
                  </label>
                )}

                {!editingTransaction && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={recurring.enabled}
                      onChange={(event) => setRecurring({ ...recurring, enabled: event.target.checked })}
                      className="h-4 w-4 accent-brand-600"
                    />
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      <RepeatIcon size={16} className="text-brand-600" />
                      Transação recorrente
                    </span>
                  </label>

                  {recurring.enabled && (
                    <div className="mt-4 space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="erp-label">Período</label>
                          <select value={recurring.period} onChange={(event) => setRecurring({ ...recurring, period: event.target.value as RecurringState['period'] })} className="erp-input">
                            <option value="quinzenal">Quinzenal (15 dias)</option>
                            <option value="mensal">Mensal</option>
                            <option value="anual">Anual</option>
                          </select>
                        </div>
                        <div>
                          <label className="erp-label">Repetições</label>
                          <input
                            type="number"
                            min="2"
                            max="360"
                            value={recurring.times}
                            onChange={(event) => setRecurring({ ...recurring, times: Math.max(2, Number(event.target.value)) })}
                            className="erp-input"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="erp-label">O valor informado é</label>
                        <div className="space-y-2">
                          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                            <input type="radio" name="valueType" value="per_period" checked={recurring.valueType === 'per_period'} onChange={() => setRecurring({ ...recurring, valueType: 'per_period' })} className="mt-0.5 accent-brand-600" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              <strong>Valor por período</strong>
                              <span className="block text-xs text-slate-500">Cada repetição tem esse valor.</span>
                            </span>
                          </label>
                          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                            <input type="radio" name="valueType" value="total" checked={recurring.valueType === 'total'} onChange={() => setRecurring({ ...recurring, valueType: 'total' })} className="mt-0.5 accent-brand-600" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              <strong>Valor total a dividir</strong>
                              <span className="block text-xs text-slate-500">Divide o valor em {recurring.times} lançamentos.</span>
                            </span>
                          </label>
                        </div>
                      </div>

                      {preview && formData.amount > 0 && (
                        <div className="rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm dark:border-brand-900/40 dark:bg-brand-950/20">
                          <p className="mb-1 font-semibold text-brand-800 dark:text-brand-300">Prévia da recorrência</p>
                          {recurring.valueType === 'per_period' ? (
                            <p className="text-brand-700 dark:text-brand-300">
                              {recurring.times}x de {formatCurrency(preview.each, formData.currency)} ({PERIOD_LABELS[recurring.period].toLowerCase()})
                              <span className="font-bold"> = {formatCurrency(preview.total, formData.currency)} total</span>
                            </p>
                          ) : (
                            <p className="text-brand-700 dark:text-brand-300">
                              {recurring.times - 1}x de {formatCurrency(preview.each, formData.currency)} + 1 última de {formatCurrency((preview as any).last, formData.currency)}
                              <span className="font-bold"> = {formatCurrency(preview.total, formData.currency)} total</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                )}
              </div>

              <div className="erp-modal-footer">
                <button type="button" onClick={() => { setShowModal(false); setEditingTransaction(null); resetForm(); }} className="erp-secondary-action">Cancelar</button>
                <button type="submit" disabled={submitting} className="erp-primary-action">
                  {submitting ? 'Salvando...' : editingTransaction ? 'Salvar alterações' : recurring.enabled ? `Criar ${recurring.times} transações` : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
