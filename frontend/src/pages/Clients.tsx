import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { clientApi, financeApi, getClientDisplayName, getProjectClientId, projectApi } from '../api/client';
import type { Client, Project } from '../api/client';
import { useToast } from '../hooks/useToast';
import { statusLabel } from '../utils/labels';
import {
  Plus,
  Trash2,
  Edit2,
  TrendingUp,
  TrendingDown,
  Percent,
  Search,
  Briefcase,
  User,
  Building,
  X,
  PlusCircle,
  FolderOpen
} from 'lucide-react';

export default function Clients() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    document: '',
    notes: '',
  });

  // Queries
  const { data: clients = [], isLoading: isLoadingClients } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => clientApi.getAll(),
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => projectApi.getAll(),
  });

  const { data: transactions = [] } = useQuery<any[]>({
    queryKey: ['transactions'],
    queryFn: () => financeApi.getTransactions(),
  });

  // Reset form helper
  const resetForm = () => {
    setForm({
      name: '',
      company: '',
      email: '',
      phone: '',
      document: '',
      notes: '',
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.company) {
      toast.error('Nome e Empresa são campos obrigatórios.');
      return;
    }
    setIsSubmitting(true);
    try {
      await clientApi.create(form);
      toast.success('Cliente registrado com sucesso!');
      setShowCreateModal(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    } catch (err: any) {
      toast.error(err.message || 'Falha ao cadastrar cliente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditInit = (client: Client) => {
    setEditingClient(client);
    setForm({
      name: client.name || '',
      company: client.company || '',
      email: client.email || '',
      phone: client.phone || '',
      document: client.document || '',
      notes: client.notes || '',
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    setIsSubmitting(true);
    try {
      await clientApi.update(editingClient.id, form);
      toast.success('Informações do cliente atualizadas!');
      setEditingClient(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    } catch (err: any) {
      toast.error(err.message || 'Falha ao atualizar cliente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja remover este cliente? Todos os vínculos históricos serão mantidos, mas o registro do cliente será excluído.')) return;
    try {
      await clientApi.delete(id);
      toast.success('Cliente removido.');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    } catch (err: any) {
      toast.error(err.message || 'Falha ao excluir cliente.');
    }
  };

  const handleNewProject = (client: Client) => {
    navigate(`/projects?clientId=${client.id}&newProject=1`);
  };

  // Finance calculator helper per client and globally
  const getClientFinance = (clientId: number) => {
    // Find projects belonging to client
    const clientProjects = projects.filter((p) => getProjectClientId(p) === clientId || p.client?.id === clientId);
    const projectIds = clientProjects.map((p) => p.id);

    // Filter settled transactions linked to these projects
    const clientTransactions = transactions.filter(
      (t) => t.projectId && projectIds.includes(t.projectId)
    );

    const totalIncome = clientTransactions
      .filter((t) => t.type === 'INCOME')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    const totalExpense = clientTransactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    const netMargin = totalIncome - totalExpense;

    return {
      activeProjectsCount: clientProjects.filter((project) => project.status === 'ACTIVE').length,
      totalProjectsCount: clientProjects.length,
      clientProjects,
      totalIncome,
      totalExpense,
      netMargin,
    };
  };

  // Overall Global Client Revenue Indicators
  const globalIndicators = clients.reduce(
    (acc, client) => {
      const stats = getClientFinance(client.id);
      return {
        totalIncome: acc.totalIncome + stats.totalIncome,
        totalExpense: acc.totalExpense + stats.totalExpense,
        netMargin: acc.netMargin + stats.netMargin,
      };
    },
    { totalIncome: 0, totalExpense: 0, netMargin: 0 }
  );

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const filteredClients = clients.filter((client) => {
    const q = search.toLowerCase();
    return (
      (client.name || '').toLowerCase().includes(q) ||
      (client.company || '').toLowerCase().includes(q) ||
      (client.document || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="erp-module">
      
      {/* Header Panel */}
      <div className="erp-module-header">
        <div>
          <h1 className="erp-module-title">
            <Building className="text-brand-500" size={26} />
            Clientes
          </h1>
          <p className="erp-module-subtitle">
            Histórico comercial consolidado, faturamento acumulado e projetos vinculados.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="erp-primary-action"
        >
          <Plus size={20} />
          Novo Cliente
        </button>
      </div>

      {/* Global Revenue Indicators Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Income Indicator */}
        <div className="erp-stat-card">
          <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-emerald-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Receita Acumulada</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg dark:bg-emerald-950/20">
              <TrendingUp size={20} />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-extrabold font-mono text-slate-800 dark:text-white">
              {formatBRL(globalIndicators.totalIncome)}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Total bruto faturado através de projetos</p>
          </div>
        </div>

        {/* Total Expenses Indicator */}
        <div className="erp-stat-card">
          <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-rose-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Despesas em Projetos</span>
            <span className="p-2 bg-rose-50 text-rose-600 rounded-lg dark:bg-rose-950/20">
              <TrendingDown size={20} />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-extrabold font-mono text-slate-800 dark:text-white">
              {formatBRL(globalIndicators.totalExpense)}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Total de custos diretos investidos</p>
          </div>
        </div>

        {/* Net Margin Indicator */}
        <div className="erp-stat-card">
          <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-brand-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Margem Líquida</span>
            <span className="p-2 bg-brand-50 text-brand-600 rounded-lg dark:bg-brand-950/20">
              <Percent size={18} />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-extrabold font-mono text-slate-800 dark:text-white">
              {formatBRL(globalIndicators.netMargin)}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Lucro líquido comercial gerado</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="erp-filter-bar">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Filtrar por nome do contato, empresa ou CNPJ/CPF..."
            className="erp-input-with-icon pr-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
            <X size={16} />
          </button>
        )}
        </div>
      </div>

      {/* Grid List View of Clients */}
      {isLoadingClients ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500"></div>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="erp-empty-state py-16">
          <Building className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={48} />
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Nenhum cliente cadastrado</h3>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1 max-w-md mx-auto">
            {search ? 'Nenhum resultado corresponde à sua pesquisa.' : 'Comece a prospectar leads ou cadastre clientes diretamente acima.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => {
            const stats = getClientFinance(client.id);

            return (
              <div
                key={client.id}
                className="erp-card relative group overflow-hidden"
              >
                {/* Header card details */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-slate-800 dark:text-white truncate font-display text-base">
                      {getClientDisplayName(client)}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                      <User size={13} className="opacity-70" />
                      {client.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEditInit(client)}
                      className="erp-icon-button h-9 w-9"
                      title="Editar"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(client.id)}
                      className="erp-icon-button h-9 w-9 hover:text-rose-600"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Sub info */}
                <div className="mt-4 space-y-2 text-xs text-slate-500 border-t border-slate-100 dark:border-white/5 pt-3">
                  {client.document && (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[10px] uppercase text-slate-400 tracking-wider w-12">Doc:</span>
                      <span className="text-slate-700 dark:text-slate-300 font-mono">{client.document}</span>
                    </div>
                  )}
                  {client.email && (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[10px] uppercase text-slate-400 tracking-wider w-12">E-mail:</span>
                      <a href={`mailto:${client.email}`} className="text-brand-500 hover:underline truncate">
                        {client.email}
                      </a>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[10px] uppercase text-slate-400 tracking-wider w-12">Tel:</span>
                      <span className="text-slate-700 dark:text-slate-300">{client.phone}</span>
                    </div>
                  )}
                </div>

                {/* Connected active projects list count */}
                <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-950/20 rounded-xl border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="text-brand-500" size={16} />
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Projetos Ativos</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 font-bold text-xs">
                    {stats.activeProjectsCount} / {stats.totalProjectsCount}
                  </span>
                </div>

                <div className="mt-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-950/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                      <Briefcase size={14} />
                      Projetos
                    </div>
                    <button
                      type="button"
                      onClick={() => handleNewProject(client)}
                      className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
                    >
                      <PlusCircle size={14} />
                      Novo Projeto
                    </button>
                  </div>

                  {stats.clientProjects.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {stats.clientProjects.slice(0, 3).map((project) => (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => navigate(`/projects/${project.id}/manager`)}
                          className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-100 dark:border-white/10 bg-slate-50 px-3 py-2 text-left text-xs hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-900"
                        >
                          <span className="truncate font-semibold text-slate-700 dark:text-slate-200">{project.name}</span>
                          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 font-medium text-slate-500 dark:bg-slate-950 dark:text-slate-300">
                            {statusLabel(project.status)}
                          </span>
                        </button>
                      ))}
                      {stats.clientProjects.length > 3 && (
                        <p className="text-xs text-slate-400">+{stats.clientProjects.length - 3} projeto(s) vinculado(s)</p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-400">Sem projetos vinculados.</p>
                  )}
                </div>

                {/* Specific Client Revenue Metrics */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 grid grid-cols-2 gap-2 text-center">
                  <div className="p-2 bg-emerald-50/40 dark:bg-emerald-950/5 rounded-lg border border-emerald-100/50">
                    <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Faturado</p>
                    <p className="font-bold text-xs text-slate-800 dark:text-white font-mono mt-0.5">{formatBRL(stats.totalIncome)}</p>
                  </div>
                  <div className="p-2 bg-brand-50/40 dark:bg-brand-950/5 rounded-lg border border-brand-100/50">
                    <p className="text-[10px] font-bold text-brand-700 dark:text-brand-400 uppercase tracking-wider">Margem</p>
                    <p className={`font-bold text-xs font-mono mt-0.5 ${stats.netMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatBRL(stats.netMargin)}
                    </p>
                  </div>
                </div>

                {/* Custom internal short notes visual */}
                {client.notes && (
                  <div className="mt-3 text-[11px] text-slate-400 italic line-clamp-2 bg-slate-50 dark:bg-slate-950/10 p-2 rounded border border-dashed">
                    &ldquo;{client.notes}&rdquo;
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* Creation and Edit Modal */}
      {(showCreateModal || editingClient !== null) && (
        <div
          className="erp-modal-overlay"
          onClick={() => {
            setShowCreateModal(false);
            setEditingClient(null);
          }}
        >
          <div className="erp-modal max-w-lg animate-slide-up" onClick={(event) => event.stopPropagation()}>
            
            <div className="erp-modal-header">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Building className="text-brand-500" size={22} />
                {editingClient ? 'Atualizar Cliente' : 'Cadastrar Novo Cliente'}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingClient(null);
                }}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={editingClient ? handleUpdate : handleCreate} className="flex min-h-0 flex-1 flex-col">
              <div className="erp-modal-body">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="erp-label">
                    Nome da Empresa *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Razão Social ou Fantasia"
                    className="erp-input"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="erp-label">
                    Nome do Contato Principal *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Diretor ou Representante"
                    className="erp-input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="erp-label">
                    CNPJ / CPF
                  </label>
                  <input
                    type="text"
                    placeholder="00.000.000/0001-00"
                    className="erp-input font-mono"
                    value={form.document}
                    onChange={(e) => setForm({ ...form, document: e.target.value })}
                  />
                </div>
                <div>
                  <label className="erp-label">
                    Telefone
                  </label>
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    className="erp-input"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="erp-label">
                  E-mail do Cliente
                </label>
                <input
                  type="email"
                  placeholder="comercial@empresa.com"
                  className="erp-input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div>
                <label className="erp-label">
                  Observações de Contrato / Faturamento
                </label>
                <textarea
                  placeholder="Escopo do faturamento, regras tributárias particulares ou acordos especiais..."
                  className="erp-input min-h-[90px]"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              </div>

              <div className="erp-modal-footer">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingClient(null);
                  }}
                  className="erp-secondary-action"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="erp-primary-action"
                >
                  {isSubmitting
                    ? 'Salvando...'
                    : editingClient
                    ? 'Salvar Informações'
                    : 'Cadastrar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
