import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, clientApi, financeApi, getClientDisplayName, getProjectClientId, projectApi } from '../api/client';
import type { Client } from '../api/client';
import { ArrowLeft, ExternalLink, Save, Users, Wallet, Server, Bug, CheckSquare, RefreshCw, CheckCircle, AlertCircle, Building2 } from 'lucide-react';
import { advanceBrazilDateInput, formatBrazilDate, todayBrazilDateInput } from '../utils/dates';
import { infraTypeLabel, statusLabel } from '../utils/labels';
import { ViewportPortal } from '../components/ViewportPortal';

type SettleTarget = {
  id: number;
  type: string;
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

const PERIOD_LABELS: Record<string, string> = { quinzenal: 'Quinzenal', mensal: 'Mensal', anual: 'Anual' };
const today = todayBrazilDateInput();

function splitAmount(total: number, n: number): number[] {
  const base = Math.floor((total / n) * 100) / 100;
  const last = Math.round((total - base * (n - 1)) * 100) / 100;
  return [...Array(n - 1).fill(base), last];
}

export default function ProjectManager() {
  const { id } = useParams();
  const projectId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    status: 'ACTIVE',
    publicUrl: '',
    clientId: '' as number | '',
    responsibleIds: [] as number[],
  });
  const [projectFormError, setProjectFormError] = useState('');
  const [metricForm, setMetricForm] = useState({
    totalUsers: 0,
    activeUsers: 0,
    paidUsers: 0,
    referralUsers: 0,
    freeUsers: 0,
    collaborationUsers: 0,
  });
  const [transactionForm, setTransactionForm] = useState({
    type: 'INCOME',
    amount: 0,
    currency: 'BRL',
    description: '',
    date: today,
    status: 'SETTLED',
  });
  const [recurring, setRecurring] = useState<RecurringState>({
    enabled: false,
    period: 'mensal',
    times: 2,
    valueType: 'per_period',
  });

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectApi.getOne(projectId),
    enabled: Number.isFinite(projectId),
  });
  const { data: summary } = useQuery({
    queryKey: ['project-summary', projectId],
    queryFn: () => projectApi.getSummary(projectId),
    enabled: Number.isFinite(projectId),
  });
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: authApi.getUsers });
  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ['clients'], queryFn: clientApi.getAll });
  const { data: transactions } = useQuery({
    queryKey: ['project-transactions', projectId],
    queryFn: () => financeApi.getTransactions({ projectId }),
    enabled: Number.isFinite(projectId),
  });

  const updateProjectMutation = useMutation({
    mutationFn: () => projectApi.update(projectId, { ...projectForm, clientId: Number(projectForm.clientId) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['projects-overview'] });
      setProjectFormError('');
    },
    onError: (err: any) => setProjectFormError(err.message || 'Erro ao salvar informações do projeto'),
  });

  const saveMetricsMutation = useMutation({
    mutationFn: () => projectApi.addMetrics(projectId, metricForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['projects-overview'] });
    },
  });

  const createTransactionMutation = useMutation({
    mutationFn: (payload: typeof transactionForm & { projectId: number }) => financeApi.createTransaction(payload),
  });

  const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false);

  const handleTransactionSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmittingTransaction(true);
    try {
      if (!recurring.enabled) {
        await createTransactionMutation.mutateAsync({ ...transactionForm, projectId, status: transactionForm.status });
      } else {
        const totalAmount = recurring.valueType === 'total' ? transactionForm.amount : transactionForm.amount * recurring.times;
        const amounts = splitAmount(totalAmount, recurring.times);
        let currentDate = transactionForm.date;
        for (let i = 0; i < recurring.times; i++) {
          await createTransactionMutation.mutateAsync({
            ...transactionForm,
            amount: amounts[i],
            date: currentDate,
            description: `${transactionForm.description} (${i + 1}/${recurring.times})`,
            projectId,
            status: 'PENDING',
          });
          currentDate = advanceBrazilDateInput(currentDate, recurring.period);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-transactions', projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['projects-overview'] });
      setTransactionForm({ type: 'INCOME', amount: 0, currency: 'BRL', description: '', date: today, status: 'SETTLED' });
      setRecurring({ enabled: false, period: 'mensal', times: 2, valueType: 'per_period' });
    } finally {
      setIsSubmittingTransaction(false);
    }
  };

  const [settleTarget, setSettleTarget] = useState<SettleTarget | null>(null);
  const [settleDate, setSettleDate] = useState(today);
  const [settleAmount, setSettleAmount] = useState(0);
  const [settling, setSettling] = useState(false);

  const openSettleModal = (t: any) => {
    setSettleTarget({ id: t.id, type: t.type, amount: t.amount, currency: t.currency, description: t.description, projectId: t.projectId ?? projectId });
    setSettleDate(today);
    setSettleAmount(t.amount);
  };

  const getSettleAdjustment = () => {
    if (!settleTarget) return null;
    const diff = Math.round((settleAmount - settleTarget.amount) * 100) / 100;
    if (Math.abs(diff) < 0.01) return null;
    if (diff > 0) return { type: settleTarget.type, amount: diff, label: '(Juros/Multa)' };
    return { type: settleTarget.type === 'INCOME' ? 'EXPENSE' : 'INCOME', amount: Math.abs(diff), label: '(Desconto)' };
  };

  const handleSettle = async () => {
    if (!settleTarget) return;
    setSettling(true);
    try {
      await financeApi.settleTransaction(settleTarget.id, { paymentDate: settleDate });
      const adj = getSettleAdjustment();
      if (adj) {
        await financeApi.createTransaction({
          type: adj.type, amount: adj.amount, currency: settleTarget.currency,
          description: `${settleTarget.description || ''} ${adj.label}`.trim(),
          date: settleDate, projectId: settleTarget.projectId, status: 'SETTLED', paymentDate: settleDate,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['project-transactions', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      setSettleTarget(null);
    } finally {
      setSettling(false);
    }
  };

  const formatCurrency2 = (v: number, c: string) => {
    try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: c }).format(v); }
    catch { return `${c} ${v.toFixed(2)}`; }
  };

  useEffect(() => {
    if (!project) return;

    const latestMetric = project.metrics?.[0];
    setProjectForm({
      name: project.name,
      description: project.description || '',
      status: project.status,
      publicUrl: project.publicUrl || '',
      clientId: getProjectClientId(project) || '',
      responsibleIds: project.members?.filter((member: any) => member.isResponsible).map((member: any) => member.userId) || [],
    });
    setMetricForm({
      totalUsers: latestMetric?.totalUsers || 0,
      activeUsers: latestMetric?.activeUsers || 0,
      paidUsers: latestMetric?.paidUsers || 0,
      referralUsers: latestMetric?.referralUsers || 0,
      freeUsers: latestMetric?.freeUsers || 0,
      collaborationUsers: latestMetric?.collaborationUsers || 0,
    });
  }, [project]);

  const formatBRL = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value || 0);
  };

  const toggleResponsible = (userId: number, checked: boolean) => {
    setProjectForm((current) => ({
      ...current,
      responsibleIds: checked
        ? [...current.responsibleIds, userId]
        : current.responsibleIds.filter((id) => id !== userId),
    }));
  };

  const handleProjectSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!projectForm.clientId) {
      setProjectFormError('Selecione um cliente antes de salvar o projeto.');
      return;
    }
    setProjectFormError('');
    updateProjectMutation.mutate();
  };

  const resourceLinks = [
    ...(project?.vpsLinks || []).map((link: any) => ({
      id: `vps-${link.id}`,
      name: link.server?.name,
      type: 'VPS',
      cost: link.server?.cost || 0,
      currency: link.server?.currency || 'USD',
      costShare: link.costShare,
    })),
    ...(project?.infraLinks || []).map((link: any) => ({
      id: `infra-${link.id}`,
      name: link.item?.name,
      type: infraTypeLabel(link.item?.type) || 'Infraestrutura',
      cost: link.item?.cost || 0,
      currency: link.item?.currency || 'USD',
      costShare: link.costShare,
    })),
  ];

  const selectedClientId = projectForm.clientId ? Number(projectForm.clientId) : getProjectClientId(project);
  const selectedClient = selectedClientId ? clients.find((client) => client.id === selectedClientId) || project?.client : null;
  const selectedClientLabel = selectedClient
    ? getClientDisplayName(selectedClient)
    : selectedClientId
      ? `Cliente #${selectedClientId}`
      : 'Sem cliente vinculado';

  if (isLoading) return <div className="text-center py-8">Carregando gestão do projeto...</div>;
  if (!project) return <div className="text-center py-8 text-gray-500">Projeto não encontrado</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <button onClick={() => navigate('/projects')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-2">
            <ArrowLeft size={16} />
            Voltar para projetos
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">{project.name}</h1>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{statusLabel(project.status)}</span>
          </div>
          <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            <Building2 size={16} />
            {selectedClientLabel}
          </p>
        </div>
        {project.publicUrl && (
          <a href={project.publicUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
            <ExternalLink size={18} />
            Abrir público
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Receita do mês" value={formatBRL(summary?.monthIncome || 0)} tone="green" icon={<Wallet size={20} />} />
        <SummaryCard title="Despesa do mês" value={formatBRL(summary?.monthExpense || 0)} tone="red" icon={<Wallet size={20} />} />
        <SummaryCard title="Resultado do mês" value={formatBRL(summary?.monthProfit || 0)} tone={(summary?.monthProfit || 0) >= 0 ? 'blue' : 'red'} icon={<Wallet size={20} />} />
        <SummaryCard title="Recursos/mês" value={`USD ${(summary?.resourceCostMonthly || 0).toFixed(2)}`} tone="purple" icon={<Server size={20} />} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard title="Usuários" value={metricForm.totalUsers} />
        <MetricCard title="Ativos" value={metricForm.activeUsers} />
        <MetricCard title="Pagantes" value={metricForm.paidUsers} />
        <MetricCard title="Indicados" value={metricForm.referralUsers} />
        <MetricCard title="Gratuitos" value={metricForm.freeUsers} />
        <MetricCard title="Colaborações" value={metricForm.collaborationUsers} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Cliente, Informações e Responsáveis</h2>
          <form onSubmit={handleProjectSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente *</label>
              <select
                value={projectForm.clientId}
                onChange={(event) => {
                  setProjectForm({ ...projectForm, clientId: event.target.value ? Number(event.target.value) : '' });
                  setProjectFormError('');
                }}
                className="w-full px-3 py-2 border rounded-lg"
                required
              >
                <option value="">Selecione um cliente</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {getClientDisplayName(client)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} className="w-full px-3 py-2 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <textarea value={projectForm.description} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={3} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select value={projectForm.status} onChange={(event) => setProjectForm({ ...projectForm, status: event.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="ACTIVE">Ativo</option>
                  <option value="PAUSED">Pausado</option>
                  <option value="EXPERIMENTAL">Experimental</option>
                  <option value="RENTABLE">Rentável</option>
                  <option value="ABANDONED">Abandonado</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL Pública</label>
                <input type="url" value={projectForm.publicUrl} onChange={(event) => setProjectForm({ ...projectForm, publicUrl: event.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="https://..." />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Responsáveis</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto border rounded-lg p-3">
                {users?.map((user: any) => (
                  <label key={user.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={projectForm.responsibleIds.includes(user.id)} onChange={(event) => toggleResponsible(user.id, event.target.checked)} />
                    {user.name}
                  </label>
                ))}
              </div>
            </div>
            {projectFormError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {projectFormError}
              </p>
            )}
            <button disabled={updateProjectMutation.isPending || !projectForm.clientId} className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Save size={18} />
              {updateProjectMutation.isPending ? 'Salvando...' : 'Salvar informações'}
            </button>
          </form>
        </section>

        <section className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Métricas de Usuários</h2>
          <form onSubmit={(event) => { event.preventDefault(); saveMetricsMutation.mutate(); }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <NumberInput label="Usuários totais" value={metricForm.totalUsers} onChange={(value) => setMetricForm({ ...metricForm, totalUsers: value })} />
            <NumberInput label="Usuários ativos" value={metricForm.activeUsers} onChange={(value) => setMetricForm({ ...metricForm, activeUsers: value })} />
            <NumberInput label="Usuários pagantes" value={metricForm.paidUsers} onChange={(value) => setMetricForm({ ...metricForm, paidUsers: value })} />
            <NumberInput label="Usuários por indicação" value={metricForm.referralUsers} onChange={(value) => setMetricForm({ ...metricForm, referralUsers: value })} />
            <NumberInput label="Usuários gratuitos" value={metricForm.freeUsers} onChange={(value) => setMetricForm({ ...metricForm, freeUsers: value })} />
            <NumberInput label="Usuários por colaboração" value={metricForm.collaborationUsers} onChange={(value) => setMetricForm({ ...metricForm, collaborationUsers: value })} />
            <button disabled={saveMetricsMutation.isPending} className="md:col-span-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saveMetricsMutation.isPending ? 'Salvando...' : 'Salvar métricas'}
            </button>
          </form>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Registrar Dinheiro do Projeto</h2>
          <form onSubmit={handleTransactionSubmit} className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select value={transactionForm.type} onChange={(event) => setTransactionForm({ ...transactionForm, type: event.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="INCOME">Receita</option>
                  <option value="EXPENSE">Despesa</option>
                </select>
              </div>
              <NumberInput label="Valor" value={transactionForm.amount} onChange={(value) => setTransactionForm({ ...transactionForm, amount: value })} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Moeda</label>
                <select value={transactionForm.currency} onChange={(event) => setTransactionForm({ ...transactionForm, currency: event.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="BRL">BRL (R$)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                <input type="date" value={transactionForm.date} onChange={(event) => setTransactionForm({ ...transactionForm, date: event.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input value={transactionForm.description} onChange={(event) => setTransactionForm({ ...transactionForm, description: event.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="Ex: pagamento de cliente, hospedagem, domínio..." />
              </div>
              {!recurring.enabled && (
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={transactionForm.status === 'SETTLED'} onChange={(e) => setTransactionForm({ ...transactionForm, status: e.target.checked ? 'SETTLED' : 'PENDING' })} className="rounded" />
                    <span className="text-sm text-gray-700">Já pago / recebido</span>
                  </label>
                </div>
              )}
            </div>

            <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={recurring.enabled} onChange={(e) => setRecurring({ ...recurring, enabled: e.target.checked })} className="rounded" />
                <RefreshCw size={16} className="text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Recorrência</span>
              </label>

              {recurring.enabled && (
                <div className="space-y-3 animate-fade-in">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Período</label>
                      <select value={recurring.period} onChange={(e) => setRecurring({ ...recurring, period: e.target.value as RecurringState['period'] })} className="w-full px-3 py-2 border rounded-lg text-sm">
                        <option value="quinzenal">Quinzenal (15 dias)</option>
                        <option value="mensal">Mensal</option>
                        <option value="anual">Anual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Nº de repetições</label>
                      <input type="number" min={2} max={60} value={recurring.times} onChange={(e) => setRecurring({ ...recurring, times: Math.max(2, Number(e.target.value)) })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">O valor informado é:</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="pm-valueType" value="per_period" checked={recurring.valueType === 'per_period'} onChange={() => setRecurring({ ...recurring, valueType: 'per_period' })} />
                        Por período
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="pm-valueType" value="total" checked={recurring.valueType === 'total'} onChange={() => setRecurring({ ...recurring, valueType: 'total' })} />
                        Total (dividido)
                      </label>
                    </div>
                  </div>

                  {transactionForm.amount > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
                      {(() => {
                        const total = recurring.valueType === 'total' ? transactionForm.amount : transactionForm.amount * recurring.times;
                        const perPeriod = recurring.valueType === 'per_period' ? transactionForm.amount : Math.round((transactionForm.amount / recurring.times) * 100) / 100;
                        return (
                          <>
                            <span className="font-medium">{recurring.times}x</span> de{' '}
                            <span className="font-medium">{perPeriod.toLocaleString('pt-BR', { style: 'currency', currency: transactionForm.currency === 'BRL' ? 'BRL' : 'USD', minimumFractionDigits: 2 })}</span>{' '}
                            ({PERIOD_LABELS[recurring.period]}) ={' '}
                            <span className="font-semibold">{total.toLocaleString('pt-BR', { style: 'currency', currency: transactionForm.currency === 'BRL' ? 'BRL' : 'USD', minimumFractionDigits: 2 })} total</span>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button disabled={isSubmittingTransaction} className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {isSubmittingTransaction
                ? 'Registrando...'
                : recurring.enabled
                  ? `Criar ${recurring.times} transações`
                  : 'Registrar transação'}
            </button>
          </form>
          <TransactionList transactions={transactions || []} onSettle={openSettleModal} />
        </section>

        <section className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Recursos e Infraestrutura</h2>
          {resourceLinks.length > 0 ? (
            <div className="space-y-3">
              {resourceLinks.map((resource) => (
                <div key={resource.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{resource.name}</p>
                    <p className="text-xs text-gray-500">{resource.type} · {resource.costShare}% do custo atribuído</p>
                  </div>
                  <span className="font-semibold">{Number(resource.cost).toFixed(2)} {resource.currency}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Este projeto ainda não tem VPS nem infraestrutura vinculada.</p>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatusBox icon={<CheckSquare size={20} />} title="Tarefas" value={`${summary?.tasks?.completed || 0}/${summary?.tasks?.total || 0}`} description="Concluídas / totais" />
        <StatusBox icon={<Bug size={20} />} title="Bugs" value={`${summary?.bugs?.open || 0}`} description="Abertos ou em progresso" />
      </div>

      {settleTarget && (() => {
        const adj = getSettleAdjustment();
        return (
          <ViewportPortal>
            <div className="erp-modal-overlay" onClick={() => setSettleTarget(null)}>
            <div className="erp-modal max-w-md animate-slide-up" onClick={(event) => event.stopPropagation()}>
              <div className="erp-modal-header">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white">Dar Baixa</h2>
                  <p className="text-sm text-gray-500">Confirme os dados do recebimento/pagamento</p>
                </div>
              </div>

              <div className="erp-modal-body">
              <div className="bg-gray-50 rounded-lg p-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Tipo</span>
                  <span className={`font-medium ${settleTarget.type === 'INCOME' ? 'text-green-700' : 'text-red-700'}`}>
                    {settleTarget.type === 'INCOME' ? 'Receita' : 'Despesa'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Descrição</span>
                  <span className="font-medium text-gray-700 text-right max-w-[60%]">{settleTarget.description || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Valor original</span>
                  <span className="font-semibold">{formatCurrency2(settleTarget.amount, settleTarget.currency)}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data do pagamento</label>
                    <input type="date" value={settleDate} onChange={(e) => setSettleDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor {settleTarget.type === 'INCOME' ? 'recebido' : 'pago'}</label>
                    <input type="number" step="0.01" min="0.01" value={settleAmount || ''} onChange={(e) => setSettleAmount(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg" />
                  </div>
                </div>

                {adj && (
                  <div className={`flex items-start gap-3 rounded-lg p-3 text-sm border ${adj.label === '(Juros/Multa)' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">{adj.label === '(Juros/Multa)' ? 'Juros / Multa detectados' : 'Desconto detectado'}</p>
                      <p className="text-xs mt-0.5">
                        Lançamento de <strong>{adj.type === 'INCOME' ? 'Receita' : 'Despesa'}</strong> de <strong>{formatCurrency2(adj.amount, settleTarget.currency)}</strong> {adj.label} em {formatBrazilDate(settleDate)}.
                      </p>
                      <p className="text-xs mt-1 opacity-75">
                        Original {formatCurrency2(settleTarget.amount, settleTarget.currency)} → {settleTarget.type === 'INCOME' ? 'Recebido' : 'Pago'} {formatCurrency2(settleAmount, settleTarget.currency)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              </div>

              <div className="erp-modal-footer">
                <button type="button" onClick={() => setSettleTarget(null)} className="erp-secondary-action">Cancelar</button>
                <button type="button" onClick={handleSettle} disabled={settling || settleAmount <= 0} className="erp-success-action">
                  {settling ? 'Confirmando...' : 'Confirmar baixa'}
                </button>
              </div>
            </div>
          </div>
          </ViewportPortal>
        );
      })()}
    </div>
  );
}

function SummaryCard({ title, value, tone, icon }: { title: string; value: string; tone: string; icon: ReactNode }) {
  const tones: Record<string, string> = {
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-5">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${tones[tone] || tones.blue}`}>{icon}</div>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-4">
      <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
        <Users size={16} />
        {title}
      </div>
      <p className="text-2xl font-bold text-gray-800">{value || 0}</p>
    </div>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type="number" min="0" step="1" value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full px-3 py-2 border rounded-lg" />
    </div>
  );
}

function TransactionList({ transactions, onSettle }: { transactions: any[]; onSettle?: (t: any) => void }) {
  if (!transactions.length) return <p className="text-sm text-gray-500">Ainda não há transações para este projeto.</p>;

  return (
    <div className="space-y-2">
      {transactions.slice(0, 8).map((transaction) => (
        <div key={transaction.id} className={`flex items-center justify-between p-3 border rounded-lg transition-colors duration-150 ${transaction.status === 'PENDING' ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-gray-50'}`}>
          <div>
            <span className={`text-xs px-2 py-1 rounded-full ${transaction.type === 'INCOME' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {transaction.type === 'INCOME' ? 'Receita' : 'Despesa'}
            </span>
            {transaction.status === 'PENDING' && (
              <span className="ml-1 text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">Pendente</span>
            )}
            <p className="text-sm text-gray-600 mt-1">{transaction.description || 'Sem descrição'}</p>
          </div>
          <div className="text-right flex items-center gap-2">
            <p className="font-semibold">{transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} {transaction.currency}</p>
            {transaction.status === 'PENDING' && onSettle && (
              <button
                onClick={() => onSettle(transaction)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 text-xs font-medium"
                title="Dar baixa"
              >
                <CheckCircle size={14} />
                Dar baixa
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBox({ icon, title, value, description }: { icon: ReactNode; title: string; value: string; description: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </div>
  );
}
