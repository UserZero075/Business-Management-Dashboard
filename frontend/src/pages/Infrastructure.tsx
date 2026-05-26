import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vpsApi, projectApi } from '../api/client';
import { Plus, Trash2, Server, Database, Globe, Lock, Mail } from 'lucide-react';
import { billingCycleLabel, infraTypeLabel } from '../utils/labels';

type TabType = 'servers' | 'items' | 'providers' | 'costs';

export default function Infrastructure() {
  const [activeTab, setActiveTab] = useState<TabType>('servers');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'server' | 'item' | 'provider'>('server');
  const [formData, setFormData] = useState<any>({});
  const [linkingItem, setLinkingItem] = useState<any>(null);

  const queryClient = useQueryClient();

  const { data: servers } = useQuery({ queryKey: ['servers'], queryFn: vpsApi.getServers });
  const { data: items } = useQuery({ queryKey: ['infra-items'], queryFn: vpsApi.getItems });
  const { data: providers } = useQuery({ queryKey: ['providers'], queryFn: vpsApi.getProviders });
  const { data: costs } = useQuery({ queryKey: ['costs'], queryFn: vpsApi.getCosts });
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: projectApi.getAll });

  const createMutation = {
    server: useMutation({ mutationFn: vpsApi.createServer, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['servers'] }); setShowModal(false); } }),
    item: useMutation({ mutationFn: vpsApi.createItem, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['infra-items'] }); setShowModal(false); } }),
    provider: useMutation({ mutationFn: vpsApi.createProvider, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['providers'] }); setShowModal(false); } }),
  };

  const deleteMutation = {
    server: useMutation({ mutationFn: vpsApi.deleteServer, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['servers'] }) }),
    item: useMutation({ mutationFn: vpsApi.deleteItem, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['infra-items'] }) }),
  };

  const linkMutation = useMutation({
    mutationFn: ({ type, id, projectId, costShare }: { type: string; id: number; projectId: number; costShare?: number }) => {
      if (type === 'VPS') return vpsApi.linkServer(id, projectId, costShare);
      return vpsApi.linkItem(id, projectId, costShare);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['infra-items'] });
      queryClient.invalidateQueries({ queryKey: ['costs'] });
      setLinkingItem(null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modalType === 'server') createMutation.server.mutate(formData);
    else if (modalType === 'item') createMutation.item.mutate(formData);
    else createMutation.provider.mutate(formData);
  };

  const openModal = (type: 'server' | 'item' | 'provider') => {
    setModalType(type);
    const defaultProvider = providers?.find((provider: any) => provider.type === (type === 'server' ? 'VPS' : 'DOMAIN')) || providers?.[0];
    setFormData(type === 'server' ? { name: '', ip: '', providerId: defaultProvider?.id || '', cost: 0, currency: 'USD', billingCycle: 'monthly', specs: '', notes: '' } : 
                type === 'item' ? { name: '', type: 'DOMAIN', providerId: defaultProvider?.id || '', cost: 0, currency: 'USD', billingCycle: 'monthly' } : 
                { name: '', type: 'VPS' });
    setShowModal(true);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amount);
  };

  const getInfraIcon = (type: string) => {
    switch (type) {
      case 'DOMAIN': return Globe;
      case 'DATABASE': return Database;
      case 'SSL_CERT': return Lock;
      case 'EMAIL_SERVICE': return Mail;
      default: return Server;
    }
  };

  const tabs = [
    { id: 'servers', label: 'Servidores VPS' },
    { id: 'items', label: 'Infraestrutura' },
    { id: 'providers', label: 'Provedores' },
    { id: 'costs', label: 'Custos' },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Infraestrutura</h1>
        <button
          onClick={() => openModal(activeTab === 'providers' ? 'provider' : activeTab === 'servers' ? 'server' : 'item')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Novo {activeTab === 'providers' ? 'Provedor' : activeTab === 'servers' ? 'Servidor' : 'Item'}
        </button>
      </div>

      <div className="flex gap-2 border-b overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 -mb-px border-b-2 ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'servers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {servers?.map((server: any) => (
            <div key={server.id} className="bg-white rounded-xl shadow-sm border p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Server className="text-blue-600" size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{server.name}</h3>
                    <p className="text-xs text-gray-500">{server.provider?.name}</p>
                  </div>
                </div>
                <button onClick={() => deleteMutation.server.mutate(server.id)} className="p-2 text-gray-400 hover:text-red-600">
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="space-y-2 text-sm">
                {server.ip && <p className="text-gray-600">IP: {server.ip}</p>}
                <p className="font-medium text-lg">{formatCurrency(server.cost, server.currency)}<span className="text-gray-400 text-sm">/{billingCycleLabel(server.billingCycle)}</span></p>
              </div>

              {server.infrastructure?.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-gray-500 mb-2">Usado por:</p>
                  <div className="flex flex-wrap gap-1">
                    {server.infrastructure.map((link: any) => (
                      <span key={link.id} className="px-2 py-1 bg-gray-100 rounded text-xs">{link.project?.name}</span>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setLinkingItem({ type: 'VPS', id: server.id })}
                className="mt-4 w-full py-2 border rounded-lg text-sm hover:bg-gray-50"
              >
                Vincular a Projeto
              </button>
            </div>
          ))}
          {(!servers || servers.length === 0) && <p className="col-span-full text-center py-8 text-gray-500">Não há servidores registrados</p>}
        </div>
      )}

      {activeTab === 'items' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items?.map((item: any) => {
            const Icon = getInfraIcon(item.type);
            return (
              <div key={item.id} className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Icon className="text-purple-600" size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{item.name}</h3>
                      <p className="text-xs text-gray-500">{infraTypeLabel(item.type)}</p>
                    </div>
                  </div>
                  <button onClick={() => deleteMutation.item.mutate(item.id)} className="p-2 text-gray-400 hover:text-red-600">
                    <Trash2 size={18} />
                  </button>
                </div>

                <p className="font-medium text-lg">{formatCurrency(item.cost, item.currency)}<span className="text-gray-400 text-sm">/{billingCycleLabel(item.billingCycle)}</span></p>

                {item.projects?.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-gray-500 mb-2">Vinculado a:</p>
                    <div className="flex flex-wrap gap-1">
                      {item.projects.map((link: any) => (
                        <span key={link.id} className="px-2 py-1 bg-gray-100 rounded text-xs">{link.project?.name}</span>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setLinkingItem({ type: item.type, id: item.id })}
                  className="mt-4 w-full py-2 border rounded-lg text-sm hover:bg-gray-50"
                >
                  Vincular a Projeto
                </button>
              </div>
            );
          })}
          {(!items || items.length === 0) && <p className="col-span-full text-center py-8 text-gray-500">Não há itens de infraestrutura</p>}
        </div>
      )}

      {activeTab === 'providers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {providers?.map((provider: any) => (
            <div key={provider.id} className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-semibold mb-2">{provider.name}</h3>
              <p className="text-sm text-gray-500">{infraTypeLabel(provider.type)}</p>
              {provider.website && (
                <a href={provider.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                  {provider.website}
                </a>
              )}
            </div>
          ))}
          {(!providers || providers.length === 0) && <p className="col-span-full text-center py-8 text-gray-500">Não há provedores</p>}
        </div>
      )}

      {activeTab === 'costs' && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">Resumo de Custos Mensais</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Custo Total Mensal</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(costs?.totalMonthly || 0, 'USD')}</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">Servidores</p>
              <p className="text-2xl font-bold text-green-600">{costs?.servers?.length || 0}</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600">Itens de Infraestrutura</p>
              <p className="text-2xl font-bold text-purple-600">{costs?.items?.length || 0}</p>
            </div>
          </div>

          {costs?.byProject && Object.keys(costs.byProject).length > 0 && (
            <>
              <h4 className="font-medium mb-3">Custo por Projeto</h4>
              <div className="space-y-2">
                {Object.entries(costs.byProject).map(([projectId, cost]: [string, any]) => {
                  const project = projects?.find((p: any) => p.id === Number(projectId));
                  return (
                    <div key={projectId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span>{project?.name || `Projeto #${projectId}`}</span>
                      <span className="font-medium">{formatCurrency(cost, 'USD')}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">
              Novo {modalType === 'server' ? 'Servidor' : modalType === 'item' ? 'Item' : 'Provedor'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input type="text" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required />
              </div>

              {modalType === 'provider' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select value={formData.type || 'VPS'} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                    <option value="VPS">VPS</option>
                    <option value="DOMAIN">Domínio</option>
                    <option value="EMAIL">E-mail</option>
                    <option value="PAYMENT">Pagamentos</option>
                    <option value="OTHER">Outro</option>
                  </select>
                </div>
              )}

              {modalType !== 'provider' && (
                <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provedor</label>
                  <select value={formData.providerId || ''} onChange={(e) => setFormData({ ...formData, providerId: e.target.value ? Number(e.target.value) : undefined })} className="w-full px-3 py-2 border rounded-lg">
                    <option value="">Sem provedor / automático</option>
                    {providers?.map((provider: any) => (
                      <option key={provider.id} value={provider.id}>{provider.name} ({infraTypeLabel(provider.type)})</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Se não existir, crie um primeiro na aba Provedores.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Custo</label>
                    <input type="number" step="0.01" value={formData.cost || 0} onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Moeda</label>
                    <select value={formData.currency || 'USD'} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="CUP">CUP</option>
                    </select>
                  </div>
                </div>
                {modalType === 'server' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">IP</label>
                      <input value={formData.ip || ''} onChange={(e) => setFormData({ ...formData, ip: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="192.168.1.1" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Especificações / Notas técnicas</label>
                      <textarea value={formData.specs || ''} onChange={(e) => setFormData({ ...formData, specs: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={2} placeholder="2 vCPU, 4GB RAM, Ubuntu..." />
                    </div>
                  </>
                )}
                </div>
              )}

              {modalType === 'item' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Infraestrutura</label>
                  <select value={formData.type || 'DOMAIN'} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                    <option value="DOMAIN">Domínio</option>
                    <option value="DATABASE">Banco de dados</option>
                    <option value="SSL_CERT">Certificado SSL</option>
                    <option value="CDN">CDN</option>
                    <option value="EMAIL_SERVICE">E-mail</option>
                    <option value="API_SERVICE">API</option>
                    <option value="OTHER">Outro</option>
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {linkingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Vincular a Projeto</h2>
            <p className="text-sm text-gray-600 mb-4">Selecione o projeto que usará esta infraestrutura</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {projects?.map((project: any) => (
                <button
                  key={project.id}
                  onClick={() => linkMutation.mutate({ type: linkingItem.type, id: linkingItem.id, projectId: project.id })}
                  className="w-full text-left p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300"
                >
                  {project.name}
                </button>
              ))}
            </div>
            <button onClick={() => setLinkingItem(null)} className="mt-4 w-full px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
