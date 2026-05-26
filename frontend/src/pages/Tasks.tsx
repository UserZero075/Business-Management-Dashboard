import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskApi, projectApi, authApi } from '../api/client';
import { Plus, CheckCircle, Clock, AlertTriangle, Bug, ListTodo, Pencil, Trash2 } from 'lucide-react';
import { Avatar } from '../utils/userVisuals';
import { priorityLabel, severityLabel, statusLabel } from '../utils/labels';

type TabType = 'tasks' | 'bugs' | 'overview';

export default function Tasks() {
  const [activeTab, setActiveTab] = useState<TabType>('tasks');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'task' | 'bug'>('task');
  const [formData, setFormData] = useState<any>({});
  const [editingItem, setEditingItem] = useState<any>(null);
  const [filterProject, setFilterProject] = useState<number | ''>('');

  const queryClient = useQueryClient();

  const { data: tasks } = useQuery({ queryKey: ['tasks', filterProject], queryFn: () => taskApi.getTasks(filterProject ? { projectId: filterProject } : {}) });
  const { data: bugs } = useQuery({ queryKey: ['bugs', filterProject], queryFn: () => taskApi.getBugs(filterProject ? { projectId: filterProject } : {}) });
  const { data: overview } = useQuery({ queryKey: ['tasks-overview'], queryFn: taskApi.getOverview });
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: projectApi.getAll });
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: authApi.getUsers });

  const createTaskMutation = useMutation({
    mutationFn: taskApi.createTask,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); queryClient.invalidateQueries({ queryKey: ['tasks-overview'] }); setShowModal(false); setEditingItem(null); },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => taskApi.updateTask(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); queryClient.invalidateQueries({ queryKey: ['tasks-overview'] }); setShowModal(false); setEditingItem(null); },
  });

  const createBugMutation = useMutation({
    mutationFn: taskApi.createBug,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bugs'] }); queryClient.invalidateQueries({ queryKey: ['tasks-overview'] }); setShowModal(false); setEditingItem(null); },
  });

  const updateBugMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => taskApi.updateBug(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bugs'] }); queryClient.invalidateQueries({ queryKey: ['tasks-overview'] }); setShowModal(false); setEditingItem(null); },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: taskApi.deleteTask,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tasks'] }); queryClient.invalidateQueries({ queryKey: ['tasks-overview'] }); },
  });

  const deleteBugMutation = useMutation({
    mutationFn: taskApi.deleteBug,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bugs'] }); queryClient.invalidateQueries({ queryKey: ['tasks-overview'] }); },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modalType === 'task') {
      if (editingItem) updateTaskMutation.mutate({ id: editingItem.id, data: formData });
      else createTaskMutation.mutate(formData);
    } else {
      if (editingItem) updateBugMutation.mutate({ id: editingItem.id, data: formData });
      else createBugMutation.mutate(formData);
    }
  };

  const openModal = (type: 'task' | 'bug') => {
    setModalType(type);
    setEditingItem(null);
    setFormData(type === 'task' ? { projectId: '', title: '', description: '', priority: 'medium', status: 'PENDING' } : { projectId: '', title: '', description: '', severity: 'medium', status: 'OPEN' });
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
      dueDate: item.dueDate ? item.dueDate.split('T')[0] : undefined,
    } : {
      projectId: item.projectId,
      title: item.title,
      description: item.description || '',
      severity: item.severity || 'medium',
      status: item.status,
    });
    setShowModal(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle className="text-green-500" size={16} />;
      case 'IN_PROGRESS': return <Clock className="text-blue-500" size={16} />;
      default: return <ListTodo className="text-gray-400" size={16} />;
    }
  };

  const severityColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-green-100 text-green-700',
  };

  const tabs = [
    { id: 'tasks', label: 'Tarefas', icon: ListTodo },
    { id: 'bugs', label: 'Bugs', icon: Bug },
    { id: 'overview', label: 'Resumo', icon: AlertTriangle },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Tarefas e Bugs</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          <select value={filterProject} onChange={(e) => setFilterProject(e.target.value ? Number(e.target.value) : '')} className="px-3 py-2 border rounded-lg">
            <option value="">Todos os projetos</option>
            {projects?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={() => openModal('task')} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            <Plus size={20} /> Nova Tarefa
          </button>
          <button onClick={() => openModal('bug')} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">
            <Plus size={20} /> Reportar Bug
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Tarefas Totais</p>
          <p className="text-2xl font-bold">{overview?.tasks?.total || 0}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Concluídas</p>
          <p className="text-2xl font-bold text-green-600">{overview?.tasks?.completed || 0}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Bugs Abertos</p>
          <p className="text-2xl font-bold text-red-600">{overview?.bugs?.open || 0}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <p className="text-sm text-gray-500">Bugs Críticos</p>
          <p className="text-2xl font-bold text-red-700">{overview?.bugs?.critical || 0}</p>
        </div>
      </div>

      <div className="flex gap-2 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 -mb-px border-b-2 ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'tasks' && (
        <div className="space-y-3">
          {tasks?.map((task: any) => (
            <div key={task.id} className="bg-white rounded-xl shadow-sm border p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <button onClick={() => updateTaskMutation.mutate({ id: task.id, data: { status: task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' } })}>
                {getStatusIcon(task.status)}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${task.priority === 'high' ? 'bg-red-100 text-red-700' : task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>
                    {priorityLabel(task.priority)}
                  </span>
                  <h3 className={`font-medium ${task.status === 'COMPLETED' ? 'line-through text-gray-400' : ''}`}>{task.title}</h3>
                </div>
                <p className="text-sm text-gray-500 mt-1">{task.project?.name}</p>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-2">
                  {task.creator && (
                    <Link to={`/users/${task.creator.id}`} className="inline-flex items-center gap-2 hover:text-blue-600">
                      <Avatar user={task.creator} size={22} /> Criada por {task.creator.name}
                    </Link>
                  )}
                  {task.assignee ? (
                    <Link to={`/users/${task.assignee.id}`} className="inline-flex items-center gap-2 hover:text-blue-600">
                      <Avatar user={task.assignee} size={22} /> Atribuída a {task.assignee.name}
                    </Link>
                  ) : <span>Sem responsável</span>}
                </div>
                {task.description && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{task.description}</p>}
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
              <button onClick={() => openEditModal('task', task)} className="p-2 text-gray-400 hover:text-blue-600" title="Ver/editar tarefa"><Pencil size={16} /></button>
              <button onClick={() => deleteTaskMutation.mutate(task.id)} className="p-2 text-gray-400 hover:text-red-600" title="Excluir tarefa"><Trash2 size={16} /></button>
              <select
                value={task.status}
                onChange={(e) => updateTaskMutation.mutate({ id: task.id, data: { status: e.target.value } })}
                className="px-2 py-1 border rounded text-sm"
              >
                <option value="PENDING">Pendente</option>
                <option value="IN_PROGRESS">Em progresso</option>
                <option value="COMPLETED">Concluída</option>
                <option value="CANCELLED">Cancelada</option>
              </select>
              </div>
            </div>
          ))}
          {(!tasks || tasks.length === 0) && <p className="text-center py-8 text-gray-500">Não há tarefas</p>}
        </div>
      )}

      {activeTab === 'bugs' && (
        <div className="space-y-3">
          {bugs?.map((bug: any) => (
            <div key={bug.id} className="bg-white rounded-xl shadow-sm border p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <Bug className={bug.severity === 'critical' ? 'text-red-600' : 'text-orange-500'} size={20} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityColors[bug.severity] || severityColors.medium}`}>
                    {severityLabel(bug.severity)}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs ${bug.status === 'OPEN' ? 'bg-red-100 text-red-700' : bug.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                    {statusLabel(bug.status)}
                  </span>
                  <h3 className="font-medium">{bug.title}</h3>
                </div>
                <p className="text-sm text-gray-500 mt-1">{bug.project?.name}</p>
                {bug.reporter && (
                  <Link to={`/users/${bug.reporter.id}`} className="inline-flex items-center gap-2 text-sm text-gray-500 mt-2 hover:text-blue-600">
                    <Avatar user={bug.reporter} size={22} /> Reportado por {bug.reporter.name}
                  </Link>
                )}
                {bug.description && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{bug.description}</p>}
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
              <button onClick={() => openEditModal('bug', bug)} className="p-2 text-gray-400 hover:text-blue-600" title="Ver/editar bug"><Pencil size={16} /></button>
              <button onClick={() => deleteBugMutation.mutate(bug.id)} className="p-2 text-gray-400 hover:text-red-600" title="Excluir bug"><Trash2 size={16} /></button>
              <select
                value={bug.status}
                onChange={(e) => updateBugMutation.mutate({ id: bug.id, data: { status: e.target.value } })}
                className="px-2 py-1 border rounded text-sm"
              >
                <option value="OPEN">Aberto</option>
                <option value="IN_PROGRESS">Em progresso</option>
                <option value="RESOLVED">Resolvido</option>
                <option value="CLOSED">Fechado</option>
              </select>
              </div>
            </div>
          ))}
          {(!bugs || bugs.length === 0) && <p className="text-center py-8 text-gray-500">Não há bugs reportados</p>}
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold mb-4">Tarefas por Projeto</h3>
            {overview?.byProject?.map((item: any) => (
              <div key={item.projectId} className="flex items-center justify-between py-2 border-b">
                <span>{item.projectName}</span>
                <span className="font-medium">{item.tasks}</span>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold mb-4">Bugs por Projeto</h3>
            {overview?.byProject?.map((item: any) => (
              <div key={item.projectId} className="flex items-center justify-between py-2 border-b">
                <span>{item.projectName}</span>
                <span className={`font-medium ${item.bugs > 0 ? 'text-red-600' : ''}`}>{item.bugs}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">{editingItem ? 'Editar' : modalType === 'task' ? 'Nova Tarefa' : 'Reportar Bug'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Projeto</label>
                <select value={formData.projectId || ''} onChange={(e) => setFormData({ ...formData, projectId: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg" required>
                  <option value="">Selecionar projeto</option>
                  {projects?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                <input type="text" value={formData.title || ''} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={3} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{modalType === 'task' ? 'Prioridade' : 'Severidade'}</label>
                  <select value={formData[modalType === 'task' ? 'priority' : 'severity'] || 'medium'} onChange={(e) => setFormData({ ...formData, [modalType === 'task' ? 'priority' : 'severity']: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    {modalType === 'bug' && <option value="critical">Crítica</option>}
                  </select>
                </div>
                {modalType === 'task' && (
                  <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Atribuir a</label>
                    <select value={formData.assigneeId || ''} onChange={(e) => setFormData({ ...formData, assigneeId: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 border rounded-lg">
                      <option value="">Sem responsável</option>
                      {users?.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); setEditingItem(null); }} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
