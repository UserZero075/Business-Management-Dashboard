import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi, authApi } from '../api/client';
import { Plus, Pencil, Trash2, Users, ExternalLink, UserCheck } from 'lucide-react';
import { statusLabel } from '../utils/labels';

export default function Projects() {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'ACTIVE',
    publicUrl: '',
    responsibleIds: [] as number[],
  });

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectApi.getAll,
  });

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: authApi.getUsers,
  });

  const createMutation = useMutation({
    mutationFn: projectApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowModal(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: projectApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const resetForm = () => {
    setFormData({ name: '', description: '', status: 'ACTIVE', publicUrl: '', responsibleIds: [] });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleResponsibleChange = (userId: number, checked: boolean) => {
    if (checked) {
      setFormData({ ...formData, responsibleIds: [...formData.responsibleIds, userId] });
    } else {
      setFormData({ ...formData, responsibleIds: formData.responsibleIds.filter(id => id !== userId) });
    }
  };

  const getResponsibleNames = (project: any) => {
    const responsible = project.members?.filter((m: any) => m.isResponsible) || [];
    return responsible.map((m: any) => m.user?.name).filter(Boolean).join(', ');
  };

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700',
    PAUSED: 'bg-yellow-100 text-yellow-700',
    ABANDONED: 'bg-red-100 text-red-700',
    EXPERIMENTAL: 'bg-purple-100 text-purple-700',
    RENTABLE: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Projetos</h1>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Novo Projeto
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects?.map((project: any) => (
            <div key={project.id} className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{project.name}</h3>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusColors[project.status]}`}>
                    {statusLabel(project.status)}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => navigate(`/projects/${project.id}/manager`)} className="p-2 text-gray-400 hover:text-blue-600" title="Abrir gestão do projeto">
                    <Pencil size={18} />
                  </button>
                  <button onClick={() => deleteMutation.mutate(project.id)} className="p-2 text-gray-400 hover:text-red-600">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {project.description && (
                <p className="text-sm text-gray-600 mb-4">{project.description}</p>
              )}

              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                {project.members?.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Users size={16} />
                    <span>{project.members.length} membros</span>
                  </div>
                )}
                {project.publicUrl && (
                  <a href={project.publicUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                    <ExternalLink size={16} />
                    Ver
                  </a>
                )}
              </div>

              {getResponsibleNames(project) && (
                <div className="flex items-center gap-1 mb-4 text-sm">
                  <UserCheck size={16} className="text-blue-600" />
                  <span className="text-gray-600">Responsáveis: {getResponsibleNames(project)}</span>
                </div>
              )}

              {project.metrics?.[0] && (
                <div className="pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Usuários:</span>
                    <span className="font-medium">{project.metrics[0].activeUsers} / {project.metrics[0].totalUsers}</span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {(!projects || projects.length === 0) && (
            <div className="col-span-full text-center py-12 text-gray-500">
              Não há projetos registrados. Crie o primeiro.
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Novo Projeto</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="ACTIVE">Ativo</option>
                  <option value="PAUSED">Pausado</option>
                  <option value="EXPERIMENTAL">Experimental</option>
                  <option value="RENTABLE">Rentável</option>
                  <option value="ABANDONED">Abandonado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL Pública</label>
                <input
                  type="url"
                  value={formData.publicUrl}
                  onChange={(e) => setFormData({ ...formData, publicUrl: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Responsáveis</label>
                <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-2">
                  {users?.map((user: any) => (
                    <label key={user.id} className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.responsibleIds.includes(user.id)}
                        onChange={(e) => handleResponsibleChange(user.id, e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm">{user.name}</span>
                    </label>
                  ))}
                </div>
                {formData.responsibleIds.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.responsibleIds.length} responsável(is) selecionado(s)
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
