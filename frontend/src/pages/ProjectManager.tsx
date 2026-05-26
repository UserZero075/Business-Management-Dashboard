import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, financeApi, projectApi } from '../api/client';
import { ArrowLeft, ExternalLink, Save, Users, Wallet, Server, Bug, CheckSquare } from 'lucide-react';
import { infraTypeLabel, statusLabel } from '../utils/labels';

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
    responsibleIds: [] as number[],
  });
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
    currency: 'USD',
    description: '',
    date: new Date().toISOString().split('T')[0],
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
  const { data: transactions } = useQuery({
    queryKey: ['project-transactions', projectId],
    queryFn: () => financeApi.getTransactions({ projectId }),
    enabled: Number.isFinite(projectId),
  });

  const updateProjectMutation = useMutation({
    mutationFn: () => projectApi.update(projectId, projectForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['projects-overview'] });
    },
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
    mutationFn: () => financeApi.createTransaction({ ...transactionForm, projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-transactions', projectId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['projects-overview'] });
      setTransactionForm({
        type: 'INCOME',
        amount: 0,
        currency: 'USD',
        description: '',
        date: new Date().toISOString().split('T')[0],
      });
    },
  });

  useEffect(() => {
    if (!project) return;

    const latestMetric = project.metrics?.[0];
    setProjectForm({
      name: project.name,
      description: project.description || '',
      status: project.status,
      publicUrl: project.publicUrl || '',
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

  const formatCup = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'CUP', maximumFractionDigits: 0 }).format(value || 0);
  };

  const toggleResponsible = (userId: number, checked: boolean) => {
    setProjectForm((current) => ({
      ...current,
      responsibleIds: checked
        ? [...current.responsibleIds, userId]
        : current.responsibleIds.filter((id) => id !== userId),
    }));
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

  if (isLoading) return <div className="text-center py-8">Carregando gestão do projeto...</div>;
  if (!project) return <div className="text-center py-8 text-gray-500">Projeto não encontrado</div>;

  return (
    <div className="space-y-6">
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
          <p className="text-gray-500">Gestão específica do projeto</p>
        </div>
        {project.publicUrl && (
          <a href={project.publicUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
            <ExternalLink size={18} />
            Abrir público
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Receita do mês" value={formatCup(summary?.monthIncome || 0)} tone="green" icon={<Wallet size={20} />} />
        <SummaryCard title="Despesa do mês" value={formatCup(summary?.monthExpense || 0)} tone="red" icon={<Wallet size={20} />} />
        <SummaryCard title="Resultado do mês" value={formatCup(summary?.monthProfit || 0)} tone={(summary?.monthProfit || 0) >= 0 ? 'blue' : 'red'} icon={<Wallet size={20} />} />
        <SummaryCard title="Recursos/mês" value={`${(summary?.resourceCostMonthly || 0).toFixed(2)} USD`} tone="purple" icon={<Server size={20} />} />
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
          <h2 className="text-lg font-semibold mb-4">Informações e Responsáveis</h2>
          <form onSubmit={(event) => { event.preventDefault(); updateProjectMutation.mutate(); }} className="space-y-4">
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
            <button disabled={updateProjectMutation.isPending} className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
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
          <form onSubmit={(event) => { event.preventDefault(); createTransactionMutation.mutate(); }} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                <option value="USD">USD</option>
                <option value="USDT">USDT</option>
                <option value="EUR">EUR</option>
                <option value="CUP">CUP</option>
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
            <button disabled={createTransactionMutation.isPending} className="md:col-span-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {createTransactionMutation.isPending ? 'Registrando...' : 'Registrar transação'}
            </button>
          </form>
          <TransactionList transactions={transactions || []} formatCup={formatCup} />
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

function TransactionList({ transactions, formatCup }: { transactions: any[]; formatCup: (value: number) => string }) {
  if (!transactions.length) return <p className="text-sm text-gray-500">Ainda não há transações para este projeto.</p>;

  return (
    <div className="space-y-2">
      {transactions.slice(0, 8).map((transaction) => (
        <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <span className={`text-xs px-2 py-1 rounded-full ${transaction.type === 'INCOME' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {transaction.type === 'INCOME' ? 'Receita' : 'Despesa'}
            </span>
            <p className="text-sm text-gray-600 mt-1">{transaction.description || 'Sem descrição'}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold">{transaction.amount} {transaction.currency}</p>
            <p className="text-xs text-gray-500">{formatCup(Number(transaction.amountCup || 0))}</p>
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
