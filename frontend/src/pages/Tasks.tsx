import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { taskApi, projectApi, authApi } from '../api/client';
import { AlertTriangle, Bug, CheckCircle, Clock, ListTodo, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Avatar } from '../utils/userVisuals';
import { priorityLabel, severityLabel, statusLabel } from '../utils/labels';
import { useToast } from '../hooks/useToast';
import { formatBrazilDate, toDateInputValue } from '../utils/dates';
import { ViewportPortal } from '../components/ViewportPortal';

type TabType = 'tasks' | 'bugs' | 'overview';

const severityColors: Record<string, string> = {
  critical: 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
};

const priorityColors: Record<string, string> = {
  high: 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

function getStatusIcon(status: string) {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle className="text-emerald-500" size={18} />;
    case 'IN_PROGRESS':
      return <Clock className="text-sky-500" size={18} />;
    default:
      return <ListTodo className="text-slate-400" size={18} />;
  }
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: ReactNode; color: string }) {
  return (
    <div className="erp-stat-card">
      <div className={`absolute inset-y-0 left-0 w-1.5 ${color}`} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <span className="rounded-lg bg-slate-50 p-2 text-slate-600 dark:bg-slate-900 dark:text-slate-300">{icon}</span>
      </div>
      <h3 className="mt-4 font-mono text-2xl font-extrabold text-slate-800 dark:text-white">{value}</h3>
    </div>
  );
}

function EmptyState({ type, onCreate }: { type: 'task' | 'bug'; onCreate: () => void }) {
  const isTask = type === 'task';
  const Icon = isTask ? ListTodo : Bug;
  return (
    <div className="erp-empty-state mx-auto my-4 flex max-w-xl flex-col items-center justify-center space-y-4 py-12">
      <div className={`flex h-16 w-16 items-center justify-center rounded-xl ${isTask ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400'}`}>
        <Icon size={32} />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{isTask ? 'Nenhuma tarefa cadastrada' : 'Nenhum bug reportado'}</h3>
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
          {isTask ? 'Crie tarefas para organizar entregas e atividades da equipe.' : 'Registre bugs para acompanhar correções por projeto.'}
        </p>
      </div>
      <button onClick={onCreate} className={isTask ? 'erp-primary-action' : 'erp-danger-action'}>
        <Plus size={18} />
        {isTask ? 'Adicionar Tarefa' : 'Reportar Bug'}
      </button>
    </div>
  );
}

export default function Tasks() {
  const [activeTab, setActiveTab] = useState<TabType>('tasks');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'task' | 'bug'>('task');
  const [formData, setFormData] = useState<any>({});
  const [editingItem, setEditingItem] = useState<any>(null);
  const [filterProject, setFilterProject] = useState<number | ''>('');

  const queryClient = useQueryClient();
  const { success: showSuccessToast, error: showErrorToast } = useToast();

  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery<any[]>({
    queryKey: ['tasks', filterProject],
    queryFn: () => taskApi.getTasks(filterProject ? { projectId: filterProject } : {}),
  });

  const { data: bugs = [], isLoading: isLoadingBugs } = useQuery<any[]>({
    queryKey: ['bugs', filterProject],
    queryFn: () => taskApi.getBugs(filterProject ? { projectId: filterProject } : {}),
  });

  const { data: overview } = useQuery<any>({ queryKey: ['tasks-overview'], queryFn: taskApi.getOverview });
  const { data: projects = [] } = useQuery<any[]>({ queryKey: ['projects'], queryFn: projectApi.getAll });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ['users'], queryFn: authApi.getUsers });

  const createTaskMutation = useMutation({
    mutationFn: taskApi.createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-overview'] });
      setShowModal(false);
      setEditingItem(null);
      showSuccessToast('Tarefa criada com sucesso!');
    },
    onError: (err: any) => showErrorToast(err.message || 'Erro ao criar tarefa'),
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => taskApi.updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-overview'] });
      setShowModal(false);
      setEditingItem(null);
      showSuccessToast('Tarefa atualizada com sucesso!');
    },
    onError: (err: any) => showErrorToast(err.message || 'Erro ao atualizar tarefa'),
  });

  const createBugMutation = useMutation({
    mutationFn: taskApi.createBug,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bugs'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-overview'] });
      setShowModal(false);
      setEditingItem(null);
      showSuccessToast('Bug reportado com sucesso!');
    },
    onError: (err: any) => showErrorToast(err.message || 'Erro ao reportar bug'),
  });

  const updateBugMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => taskApi.updateBug(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bugs'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-overview'] });
      setShowModal(false);
      setEditingItem(null);
      showSuccessToast('Bug atualizado com sucesso!');
    },
    onError: (err: any) => showErrorToast(err.message || 'Erro ao atualizar bug'),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: taskApi.deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-overview'] });
      showSuccessToast('Tarefa excluída com sucesso!');
    },
    onError: (err: any) => showErrorToast(err.message || 'Erro ao excluir tarefa'),
  });

  const deleteBugMutation = useMutation({
    mutationFn: taskApi.deleteBug,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bugs'] });
      queryClient.invalidateQueries({ queryKey: ['tasks-overview'] });
      showSuccessToast('Bug excluído com sucesso!');
    },
    onError: (err: any) => showErrorToast(err.message || 'Erro ao excluir bug'),
  });

  const openModal = (type: 'task' | 'bug') => {
    setModalType(type);
    setEditingItem(null);
    setFormData(type === 'task'
      ? { projectId: '', title: '', description: '', priority: 'medium', status: 'PENDING', assigneeId: null, dueDate: '' }
      : { projectId: '', title: '', description: '', severity: 'medium', status: 'OPEN' }
    );
    setShowModal(true);
  };

  const openEditModal = (type: 'task' | 'bug', item: any) => {
    setModalType(type);
    setEditingItem(item);
    setFormData(type === 'task' ? {
      projectId: item.projectId,
      title: item.title,
      description: item.description || '',
      priority: item.priority || 'medium',
      status: item.status,
      assigneeId: item.assigneeId || null,
      dueDate: toDateInputValue(item.dueDate),
    } : {
      projectId: item.projectId,
      title: item.title,
      description: item.description || '',
      severity: item.severity || 'medium',
      status: item.status,
    });
    setShowModal(true);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (modalType === 'task') {
      const payload = { ...formData, dueDate: formData.dueDate || undefined };
      if (editingItem) updateTaskMutation.mutate({ id: editingItem.id, data: payload });
      else createTaskMutation.mutate(payload);
      return;
    }

    if (editingItem) updateBugMutation.mutate({ id: editingItem.id, data: formData });
    else createBugMutation.mutate(formData);
  };

  const isSaving = createTaskMutation.isPending || updateTaskMutation.isPending || createBugMutation.isPending || updateBugMutation.isPending;
  const tabs = [
    { id: 'tasks', label: 'Tarefas', icon: ListTodo, count: tasks.length },
    { id: 'bugs', label: 'Bugs', icon: Bug, count: bugs.length },
    { id: 'overview', label: 'Resumo', icon: AlertTriangle, count: undefined },
  ] as const;

  return (
    <div className="erp-module">
      <div className="erp-module-header">
        <div>
          <h1 className="erp-module-title">
            <CheckCircle className="text-brand-500" size={26} />
            Tarefas e Bugs
          </h1>
          <p className="erp-module-subtitle">Controle operacional de atividades, responsáveis, prioridades e incidentes por projeto.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button onClick={() => openModal('task')} className="erp-primary-action">
            <Plus size={18} />
            Nova Tarefa
          </button>
          <button onClick={() => openModal('bug')} className="erp-danger-action">
            <Plus size={18} />
            Reportar Bug
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Tarefas Totais" value={overview?.tasks?.total || 0} icon={<ListTodo size={20} />} color="bg-sky-500" />
        <StatCard label="Concluídas" value={overview?.tasks?.completed || 0} icon={<CheckCircle size={20} />} color="bg-emerald-500" />
        <StatCard label="Bugs Abertos" value={overview?.bugs?.open || 0} icon={<Bug size={20} />} color="bg-rose-500" />
        <StatCard label="Bugs Críticos" value={overview?.bugs?.critical || 0} icon={<AlertTriangle size={20} />} color="bg-orange-500" />
      </div>

      <div className="erp-filter-bar">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-center">
          <select value={filterProject} onChange={(event) => setFilterProject(event.target.value ? Number(event.target.value) : '')} className="erp-input">
            <option value="">Todos os projetos</option>
            {projects.map((project: any) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <tab.icon size={17} />
                {tab.label}
                {tab.count !== undefined && <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-950/50 dark:text-slate-300">{tab.count}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'tasks' && (
        <div className="space-y-3">
          {isLoadingTasks ? (
            <div className="erp-panel py-10 text-center text-sm text-slate-500">Carregando tarefas...</div>
          ) : tasks.length > 0 ? tasks.map((task: any) => (
            <div key={task.id} className="erp-card flex flex-col gap-4 transition-colors hover:border-slate-300 sm:flex-row sm:items-start dark:hover:border-slate-700">
              <button onClick={() => updateTaskMutation.mutate({ id: task.id, data: { status: task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' } })} className="mt-1 shrink-0 rounded-lg p-1 transition-transform hover:scale-110">
                {getStatusIcon(task.status)}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-bold ${priorityColors[task.priority] || priorityColors.medium}`}>{priorityLabel(task.priority)}</span>
                  <span className="erp-status-pill border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">{statusLabel(task.status)}</span>
                  <h3 className={`font-bold text-slate-800 dark:text-white ${task.status === 'COMPLETED' ? 'line-through opacity-60' : ''}`}>{task.title}</h3>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-500">{task.project?.name || 'Sem projeto'}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                  {task.creator && (
                    <Link to={`/users/${task.creator.id}`} className="inline-flex items-center gap-2 hover:text-brand-600">
                      <Avatar user={task.creator} size={22} /> Criada por {task.creator.name}
                    </Link>
                  )}
                  {task.assignee ? (
                    <Link to={`/users/${task.assignee.id}`} className="inline-flex items-center gap-2 hover:text-brand-600">
                      <Avatar user={task.assignee} size={22} /> Atribuída a {task.assignee.name}
                    </Link>
                  ) : <span>Sem responsável</span>}
                  {task.dueDate && <span>Prazo: {formatBrazilDate(task.dueDate)}</span>}
                </div>
                {task.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{task.description}</p>}
              </div>
              <div className="flex items-center gap-2 self-end sm:self-start">
                <button onClick={() => openEditModal('task', task)} className="erp-icon-button h-9 w-9" title="Editar tarefa"><Pencil size={16} /></button>
                <button onClick={() => { if (window.confirm('Excluir esta tarefa?')) deleteTaskMutation.mutate(task.id); }} className="erp-icon-button h-9 w-9 hover:text-rose-600" title="Excluir tarefa"><Trash2 size={16} /></button>
              </div>
            </div>
          )) : (
            <EmptyState type="task" onCreate={() => openModal('task')} />
          )}
        </div>
      )}

      {activeTab === 'bugs' && (
        <div className="space-y-3">
          {isLoadingBugs ? (
            <div className="erp-panel py-10 text-center text-sm text-slate-500">Carregando bugs...</div>
          ) : bugs.length > 0 ? bugs.map((bug: any) => (
            <div key={bug.id} className="erp-card flex flex-col gap-4 transition-colors hover:border-slate-300 sm:flex-row sm:items-start dark:hover:border-slate-700">
              <Bug className={`mt-1 shrink-0 ${bug.severity === 'critical' ? 'text-rose-600' : 'text-orange-500'}`} size={20} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-bold ${severityColors[bug.severity] || severityColors.medium}`}>{severityLabel(bug.severity)}</span>
                  <span className="erp-status-pill border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">{statusLabel(bug.status)}</span>
                  <h3 className="font-bold text-slate-800 dark:text-white">{bug.title}</h3>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-500">{bug.project?.name || 'Sem projeto'}</p>
                {bug.reporter && (
                  <Link to={`/users/${bug.reporter.id}`} className="mt-3 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-brand-600">
                    <Avatar user={bug.reporter} size={22} /> Reportado por {bug.reporter.name}
                  </Link>
                )}
                {bug.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{bug.description}</p>}
              </div>
              <div className="flex items-center gap-2 self-end sm:self-start">
                <button onClick={() => openEditModal('bug', bug)} className="erp-icon-button h-9 w-9" title="Editar bug"><Pencil size={16} /></button>
                <button onClick={() => { if (window.confirm('Excluir este bug?')) deleteBugMutation.mutate(bug.id); }} className="erp-icon-button h-9 w-9 hover:text-rose-600" title="Excluir bug"><Trash2 size={16} /></button>
              </div>
            </div>
          )) : (
            <EmptyState type="bug" onCreate={() => openModal('bug')} />
          )}
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="erp-panel">
            <h3 className="mb-4 text-lg font-bold text-slate-800 dark:text-white">Tarefas por Projeto</h3>
            <div className="space-y-2">
              {overview?.byProject?.map((item: any) => (
                <div key={item.projectId} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950/40">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{item.projectName}</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white">{item.tasks}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="erp-panel">
            <h3 className="mb-4 text-lg font-bold text-slate-800 dark:text-white">Bugs por Projeto</h3>
            <div className="space-y-2">
              {overview?.byProject?.map((item: any) => (
                <div key={item.projectId} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950/40">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{item.projectName}</span>
                  <span className={`font-mono font-bold ${item.bugs > 0 ? 'text-rose-600' : 'text-slate-800 dark:text-white'}`}>{item.bugs}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <ViewportPortal>
          <div className="erp-modal-overlay animate-fade-in" onClick={() => { setShowModal(false); setEditingItem(null); }}>
            <div className="erp-modal max-w-lg animate-slide-up" onClick={(event) => event.stopPropagation()}>
              <div className="erp-modal-header">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white">{editingItem ? 'Editar' : modalType === 'task' ? 'Nova Tarefa' : 'Reportar Bug'}</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{modalType === 'task' ? 'Defina projeto, responsável, prazo e prioridade.' : 'Registre severidade e status do incidente.'}</p>
                </div>
                <button type="button" onClick={() => { setShowModal(false); setEditingItem(null); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                <div className="erp-modal-body">
                  <div>
                    <label className="erp-label">Projeto *</label>
                    <select value={formData.projectId || ''} onChange={(event) => setFormData({ ...formData, projectId: Number(event.target.value) })} className="erp-input" required>
                      <option value="">Selecionar projeto</option>
                      {projects.map((project: any) => <option key={project.id} value={project.id}>{project.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="erp-label">Título *</label>
                    <input type="text" value={formData.title || ''} onChange={(event) => setFormData({ ...formData, title: event.target.value })} className="erp-input" required />
                  </div>

                  <div>
                    <label className="erp-label">Descrição</label>
                    <textarea value={formData.description || ''} onChange={(event) => setFormData({ ...formData, description: event.target.value })} className="erp-input min-h-[92px]" />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="erp-label">{modalType === 'task' ? 'Prioridade' : 'Severidade'}</label>
                      <select value={formData[modalType === 'task' ? 'priority' : 'severity'] || 'medium'} onChange={(event) => setFormData({ ...formData, [modalType === 'task' ? 'priority' : 'severity']: event.target.value })} className="erp-input">
                        <option value="low">Baixa</option>
                        <option value="medium">Média</option>
                        <option value="high">Alta</option>
                        {modalType === 'bug' && <option value="critical">Crítica</option>}
                      </select>
                    </div>
                    <div>
                      <label className="erp-label">Status</label>
                      <select value={formData.status || (modalType === 'task' ? 'PENDING' : 'OPEN')} onChange={(event) => setFormData({ ...formData, status: event.target.value })} className="erp-input">
                        {modalType === 'task' ? (
                          <>
                            <option value="PENDING">Pendente</option>
                            <option value="IN_PROGRESS">Em progresso</option>
                            <option value="COMPLETED">Concluída</option>
                            <option value="CANCELLED">Cancelada</option>
                          </>
                        ) : (
                          <>
                            <option value="OPEN">Aberto</option>
                            <option value="IN_PROGRESS">Em progresso</option>
                            <option value="RESOLVED">Resolvido</option>
                            <option value="CLOSED">Fechado</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  {modalType === 'task' && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="erp-label">Responsável</label>
                        <select value={formData.assigneeId || ''} onChange={(event) => setFormData({ ...formData, assigneeId: event.target.value ? Number(event.target.value) : null })} className="erp-input">
                          <option value="">Sem responsável</option>
                          {users.map((user: any) => <option key={user.id} value={user.id}>{user.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="erp-label">Prazo</label>
                        <input type="date" value={formData.dueDate || ''} onChange={(event) => setFormData({ ...formData, dueDate: event.target.value })} className="erp-input" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="erp-modal-footer">
                  <button type="button" onClick={() => { setShowModal(false); setEditingItem(null); }} className="erp-secondary-action">Cancelar</button>
                  <button type="submit" disabled={isSaving} className="erp-primary-action">{isSaving ? 'Salvando...' : 'Salvar'}</button>
                </div>
              </form>
            </div>
          </div>
        </ViewportPortal>
      )}
    </div>
  );
}
