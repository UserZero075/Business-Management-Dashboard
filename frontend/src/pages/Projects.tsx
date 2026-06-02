import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, clientApi, getClientDisplayName, getProjectClientId, projectApi } from '../api/client';
import type { Client, Project } from '../api/client';
import { Building2, ExternalLink, Filter, FolderKanban, Pencil, Plus, Search, Trash2, UserCheck, Users, X } from 'lucide-react';
import { statusLabel } from '../utils/labels';
import { useToast } from '../hooks/useToast';

type ProjectForm = {
  name: string;
  description: string;
  status: string;
  publicUrl: string;
  clientId: number | '';
  responsibleIds: number[];
};

const PROJECT_STATUSES = ['ACTIVE', 'PAUSED', 'EXPERIMENTAL', 'RENTABLE', 'ABANDONED'];

const createEmptyProjectForm = (clientId: number | '' = ''): ProjectForm => ({
  name: '',
  description: '',
  status: 'ACTIVE',
  publicUrl: '',
  clientId,
  responsibleIds: [],
});

export default function Projects() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [formData, setFormData] = useState<ProjectForm>(createEmptyProjectForm());

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { success: showSuccessToast, error: showErrorToast } = useToast();

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: projectApi.getAll,
  });

  const { data: clients = [], isLoading: isLoadingClients } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: clientApi.getAll,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: authApi.getUsers,
  });

  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);

  const createMutation = useMutation({
    mutationFn: projectApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setShowModal(false);
      resetForm();
      showSuccessToast('Projeto criado com sucesso!');
    },
    onError: (err: any) => {
      showErrorToast(err.message || 'Erro ao criar projeto');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: projectApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      showSuccessToast('Projeto excluído com sucesso!');
    },
    onError: (err: any) => {
      showErrorToast(err.message || 'Erro ao excluir projeto');
    }
  });

  const resetForm = (clientId: number | '' = '') => {
    setFormData(createEmptyProjectForm(clientId));
  };

  useEffect(() => {
    if (searchParams.get('newProject') !== '1' || isLoadingClients) return;

    const queryClientId = Number(searchParams.get('clientId'));
    const validClientId =
      Number.isFinite(queryClientId) && clients.some((client) => client.id === queryClientId)
        ? queryClientId
        : '';

    resetForm(validClientId);
    if (validClientId) setClientFilter(String(validClientId));
    setShowModal(true);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('newProject');
    setSearchParams(nextParams, { replace: true });
  }, [clients, isLoadingClients, searchParams, setSearchParams]);

  const getProjectClient = (project: Project) => {
    const clientId = getProjectClientId(project);
    if (!clientId) return null;
    return project.client || clientsById.get(clientId) || null;
  };

  const getProjectClientLabel = (project: Project) => {
    const clientId = getProjectClientId(project);
    if (!clientId) return 'Sem cliente';
    const client = getProjectClient(project);
    return client ? getClientDisplayName(client) : `Cliente #${clientId}`;
  };

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();

    return projects.filter((project) => {
      const projectClientId = getProjectClientId(project);
      const clientName = getProjectClientLabel(project).toLowerCase();
      const matchesSearch =
        !q ||
        project.name.toLowerCase().includes(q) ||
        (project.description || '').toLowerCase().includes(q) ||
        clientName.includes(q);
      const matchesClient = clientFilter === 'ALL' || String(projectClientId) === clientFilter;
      const matchesStatus = statusFilter === 'ALL' || project.status === statusFilter;

      return matchesSearch && matchesClient && matchesStatus;
    });
  }, [clientFilter, projects, search, statusFilter, clientsById]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedClientId = Number(formData.clientId);
    if (!selectedClientId || Number.isNaN(selectedClientId)) {
      showErrorToast('Selecione um cliente antes de criar o projeto.');
      return;
    }

    createMutation.mutate({
      ...formData,
      clientId: selectedClientId,
    });
  };

  const handleResponsibleChange = (userId: number, checked: boolean) => {
    if (checked) {
      setFormData({ ...formData, responsibleIds: [...formData.responsibleIds, userId] });
    } else {
      setFormData({ ...formData, responsibleIds: formData.responsibleIds.filter(id => id !== userId) });
    }
  };

  const openCreateModal = (clientId?: number) => {
    const filteredClientId = clientFilter !== 'ALL' ? Number(clientFilter) : undefined;
    resetForm(clientId || filteredClientId || '');
    setShowModal(true);
  };

  const clearFilters = () => {
    setSearch('');
    setClientFilter('ALL');
    setStatusFilter('ALL');
  };

  const getResponsibleNames = (project: Project) => {
    const responsible = project.members?.filter((m: any) => m.isResponsible) || [];
    return responsible.map((m: any) => m.user?.name).filter(Boolean).join(', ');
  };

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400',
    PAUSED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400',
    ABANDONED: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400',
    EXPERIMENTAL: 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400',
    RENTABLE: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
  };

  const hasActiveFilters = Boolean(search.trim()) || clientFilter !== 'ALL' || statusFilter !== 'ALL';
  const selectedFormClient = formData.clientId ? clientsById.get(Number(formData.clientId)) : null;
  const isSubmitBlocked = createMutation.isPending || !formData.clientId;
  const isInitialLoading = isLoading || isLoadingClients;

  return (
    <div className="erp-module">
      <div className="erp-module-header">
        <div>
          <h1 className="erp-module-title">
            <FolderKanban className="text-brand-500" size={26} />
            Projetos
          </h1>
          <p className="erp-module-subtitle">Projetos sempre vinculados a um cliente, com responsáveis e acompanhamento operacional.</p>
        </div>
        <button
          onClick={() => openCreateModal()}
          className="erp-primary-action"
        >
          <Plus size={20} />
          Novo Projeto
        </button>
      </div>

      <div className="erp-filter-bar">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_240px_180px_auto]">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por projeto, descrição ou cliente"
              className="erp-input-with-icon"
            />
          </div>
          <select
            value={clientFilter}
            onChange={(event) => setClientFilter(event.target.value)}
            className="erp-input"
          >
            <option value="ALL">Todos os clientes</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {getClientDisplayName(client)}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="erp-input"
          >
            <option value="ALL">Todos os status</option>
            {PROJECT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="erp-secondary-action"
          >
            <Filter size={16} />
            Limpar
          </button>
        </div>
      </div>

      {isInitialLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="erp-card space-y-4 animate-pulse">
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
                </div>
                <div className="h-8 w-8 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
              </div>
              <div className="h-16 bg-slate-100 dark:bg-slate-800/50 rounded-lg"></div>
              <div className="flex gap-4">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <div key={project.id} className="erp-card">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-gray-800 dark:text-slate-100 truncate">{project.name}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusColors[project.status] || statusColors.ACTIVE}`}>
                      {statusLabel(project.status)}
                    </span>
                    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                      <Building2 size={13} className="shrink-0" />
                      <span className="truncate">{getProjectClientLabel(project)}</span>
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => navigate(`/projects/${project.id}/manager`)} className="erp-icon-button border-0 bg-transparent" title="Abrir gestão do projeto">
                    <Pencil size={18} />
                  </button>
                  <button onClick={() => { if (window.confirm(`Excluir o projeto "${project.name}"? Esta ação não pode ser desfeita.`)) deleteMutation.mutate(project.id); }} className="erp-icon-button border-0 bg-transparent hover:text-red-600 dark:hover:text-red-400" title="Excluir projeto">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {project.description && (
                <p className="text-sm text-gray-600 dark:text-slate-400 mb-4 line-clamp-2">{project.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 dark:text-slate-400 mb-4">
                {project.members && project.members.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Users size={16} />
                    <span>{project.members.length} membros</span>
                  </div>
                )}
                {project.publicUrl && (
                  <a href={project.publicUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400">
                    <ExternalLink size={16} />
                    Ver Site
                  </a>
                )}
              </div>

              {getResponsibleNames(project) && (
                <div className="flex items-center gap-1.5 mb-4 text-sm">
                  <UserCheck size={16} className="text-brand-600 dark:text-brand-400 flex-shrink-0" />
                  <span className="text-gray-600 dark:text-slate-300 truncate">Resp: {getResponsibleNames(project)}</span>
                </div>
              )}

              {project.metrics?.[0] && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-slate-400">Usuários Ativos:</span>
                    <span className="font-medium text-gray-800 dark:text-slate-200">{project.metrics[0].activeUsers} / {project.metrics[0].totalUsers}</span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {filteredProjects.length === 0 && (
            <div className="erp-empty-state col-span-full flex max-w-xl flex-col items-center justify-center space-y-4 mx-auto my-6 sm:p-12">
              <div className="w-16 h-16 rounded-xl bg-brand-50 dark:bg-brand-950/30 flex items-center justify-center text-brand-600 dark:text-brand-400 shadow-inner">
                <FolderKanban size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Nenhum projeto encontrado</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                  {hasActiveFilters
                    ? 'Ajuste os filtros para localizar projetos vinculados aos clientes.'
                    : 'Crie seu primeiro projeto a partir de um cliente para iniciar a gestão integrada.'}
                </p>
              </div>
              <button
                onClick={() => openCreateModal()}
                className="erp-primary-action"
              >
                <Plus size={18} />
                Criar Projeto
              </button>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="erp-modal-overlay">
          <div className="erp-modal max-w-2xl animate-slide-up">
            <div className="erp-modal-header">
              <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Novo Projeto</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Selecione o cliente antes de salvar o projeto.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                title="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="erp-modal-body">
                <div>
                  <label className="erp-label">Cliente *</label>
                  <select
                    value={formData.clientId}
                    onChange={(e) => setFormData({ ...formData, clientId: e.target.value ? Number(e.target.value) : '' })}
                    className="erp-input"
                    disabled={isLoadingClients || clients.length === 0}
                    required
                  >
                    <option value="">{isLoadingClients ? 'Carregando clientes...' : 'Selecione um cliente'}</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {getClientDisplayName(client)}
                      </option>
                    ))}
                  </select>
                  {selectedFormClient && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Projeto será criado para {getClientDisplayName(selectedFormClient)}.
                    </p>
                  )}
                  {!isLoadingClients && clients.length === 0 && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      Cadastre um cliente antes de criar projetos.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="erp-label">Nome *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="erp-input"
                    required
                  />
                </div>

                <div>
                  <label className="erp-label">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="erp-input"
                  >
                    {PROJECT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="erp-label">Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="erp-input"
                  rows={3}
                />
              </div>

              <div>
                <label className="erp-label">URL Pública</label>
                <input
                  type="url"
                  value={formData.publicUrl}
                  onChange={(e) => setFormData({ ...formData, publicUrl: e.target.value })}
                  className="erp-input"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="erp-label">Responsáveis</label>
                <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg p-2 space-y-2 dark:bg-slate-950">
                  {users?.map((user: any) => (
                    <label key={user.id} className="flex items-center gap-2 p-1 hover:bg-gray-50 dark:hover:bg-slate-900 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.responsibleIds.includes(user.id)}
                        onChange={(e) => handleResponsibleChange(user.id, e.target.checked)}
                        className="rounded dark:bg-slate-800 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{user.name}</span>
                    </label>
                  ))}
                  {(!users || users.length === 0) && (
                    <p className="px-1 py-2 text-sm text-slate-500 dark:text-slate-400">Nenhum usuário disponível.</p>
                  )}
                </div>
                {formData.responsibleIds.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    {formData.responsibleIds.length} responsável(is) selecionado(s)
                  </p>
                )}
              </div>
              </div>

              <div className="erp-modal-footer">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="erp-secondary-action sm:min-w-32"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitBlocked}
                  className="erp-primary-action sm:min-w-32"
                >
                  {createMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
