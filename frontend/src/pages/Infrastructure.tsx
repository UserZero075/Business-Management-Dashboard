import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vpsApi, projectApi } from '../api/client';
import { useToast } from '../hooks/useToast';
import { formatBrazilDate, monthsBetweenDateInputs, todayBrazilDateInput, toDateInputValue } from '../utils/dates';
import {
  Building2,
  Database,
  ExternalLink,
  Globe,
  HardDrive,
  Link2,
  Lock,
  Mail,
  Pencil,
  Plus,
  Search,
  Server,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import { infraTypeLabel } from '../utils/labels';

type TabType = 'servers' | 'items' | 'providers' | 'costs';
type ModalType = 'server' | 'item' | 'provider';
type LinkTarget = { type: 'VPS' | 'INFRA'; id: number; name: string };

type ProviderRecord = {
  id: number;
  name: string;
  website?: string | null;
  type: string;
  vpsServers?: unknown[];
  infraItems?: unknown[];
};

type InfraResource = {
  id: number;
  name: string;
  type?: string;
  ip?: string | null;
  provider?: ProviderRecord | null;
  providerId?: number | null;
  cost: number;
  currency: string;
  startDate?: string | null;
  renewalDate?: string | null;
  specs?: string | null;
  infrastructure?: Array<{ id: number; costShare?: number; project?: { id: number; name: string } | null }>;
  projects?: Array<{ id: number; costShare?: number; project?: { id: number; name: string } | null }>;
};

type ProjectOption = {
  id: number;
  name: string;
};

type CostSummary = {
  totalMonthly?: number;
  totalsByCurrency?: Record<string, number>;
  byProject?: Record<string, number>;
  servers?: unknown[];
  items?: unknown[];
};

const today = todayBrazilDateInput();

export default function Infrastructure() {
  const [activeTab, setActiveTab] = useState<TabType>('servers');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<ModalType>('server');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [linkingItem, setLinkingItem] = useState<LinkTarget | null>(null);
  const [linkCostShare, setLinkCostShare] = useState(100);
  const [search, setSearch] = useState('');

  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: servers = [], isLoading: isLoadingServers } = useQuery<InfraResource[]>({ queryKey: ['servers'], queryFn: vpsApi.getServers });
  const { data: items = [], isLoading: isLoadingItems } = useQuery<InfraResource[]>({ queryKey: ['infra-items'], queryFn: vpsApi.getItems });
  const { data: providers = [], isLoading: isLoadingProviders } = useQuery<ProviderRecord[]>({ queryKey: ['providers'], queryFn: vpsApi.getProviders });
  const { data: costs, isLoading: isLoadingCosts } = useQuery<CostSummary>({ queryKey: ['costs'], queryFn: vpsApi.getCosts });
  const { data: projects = [] } = useQuery<ProjectOption[]>({ queryKey: ['projects'], queryFn: projectApi.getAll });

  const invalidateInfrastructure = () => {
    queryClient.invalidateQueries({ queryKey: ['servers'] });
    queryClient.invalidateQueries({ queryKey: ['infra-items'] });
    queryClient.invalidateQueries({ queryKey: ['providers'] });
    queryClient.invalidateQueries({ queryKey: ['costs'] });
  };

  const createMutation = {
    server: useMutation({
      mutationFn: vpsApi.createServer,
      onSuccess: () => {
        invalidateInfrastructure();
        setShowModal(false);
        toast.success('Servidor registrado.');
      },
      onError: (err: any) => toast.error(err.message || 'Erro ao criar servidor.'),
    }),
    item: useMutation({
      mutationFn: vpsApi.createItem,
      onSuccess: () => {
        invalidateInfrastructure();
        setShowModal(false);
        toast.success('Item de infraestrutura registrado.');
      },
      onError: (err: any) => toast.error(err.message || 'Erro ao criar item.'),
    }),
    provider: useMutation({
      mutationFn: vpsApi.createProvider,
      onSuccess: () => {
        invalidateInfrastructure();
        setShowModal(false);
        toast.success('Provedor registrado.');
      },
      onError: (err: any) => toast.error(err.message || 'Erro ao criar provedor.'),
    }),
  };

  const updateMutation = {
    server: useMutation({
      mutationFn: ({ id, data }: { id: number; data: any }) => vpsApi.updateServer(id, data),
      onSuccess: () => {
        invalidateInfrastructure();
        setShowModal(false);
        setEditingId(null);
        toast.success('Servidor atualizado.');
      },
      onError: (err: any) => toast.error(err.message || 'Erro ao atualizar servidor.'),
    }),
    item: useMutation({
      mutationFn: ({ id, data }: { id: number; data: any }) => vpsApi.updateItem(id, data),
      onSuccess: () => {
        invalidateInfrastructure();
        setShowModal(false);
        setEditingId(null);
        toast.success('Item atualizado.');
      },
      onError: (err: any) => toast.error(err.message || 'Erro ao atualizar item.'),
    }),
    provider: useMutation({
      mutationFn: ({ id, data }: { id: number; data: any }) => vpsApi.updateProvider(id, data),
      onSuccess: () => {
        invalidateInfrastructure();
        setShowModal(false);
        setEditingId(null);
        toast.success('Provedor atualizado.');
      },
      onError: (err: any) => toast.error(err.message || 'Erro ao atualizar provedor.'),
    }),
  };

  const deleteMutation = {
    server: useMutation({
      mutationFn: vpsApi.deleteServer,
      onSuccess: () => {
        invalidateInfrastructure();
        toast.success('Servidor removido.');
      },
      onError: (err: any) => toast.error(err.message || 'Erro ao excluir servidor.'),
    }),
    item: useMutation({
      mutationFn: vpsApi.deleteItem,
      onSuccess: () => {
        invalidateInfrastructure();
        toast.success('Item removido.');
      },
      onError: (err: any) => toast.error(err.message || 'Erro ao excluir item.'),
    }),
    provider: useMutation({
      mutationFn: vpsApi.deleteProvider,
      onSuccess: () => {
        invalidateInfrastructure();
        toast.success('Provedor removido.');
      },
      onError: (err: any) => toast.error(err.message || 'Erro ao excluir provedor.'),
    }),
  };

  const unlinkMutation = useMutation({
    mutationFn: ({ type, id, projectId }: { type: 'VPS' | 'INFRA'; id: number; projectId: number }) => (
      type === 'VPS' ? vpsApi.unlinkServer(id, projectId) : vpsApi.unlinkItem(id, projectId)
    ),
    onSuccess: () => {
      invalidateInfrastructure();
      toast.success('Vínculo removido.');
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao remover vínculo.'),
  });

  const linkMutation = useMutation({
    mutationFn: ({ type, id, projectId, costShare }: { type: 'VPS' | 'INFRA'; id: number; projectId: number; costShare: number }) => {
      if (type === 'VPS') return vpsApi.linkServer(id, projectId, costShare);
      return vpsApi.linkItem(id, projectId, costShare);
    },
    onSuccess: () => {
      invalidateInfrastructure();
      setLinkingItem(null);
      setLinkCostShare(100);
      toast.success('Infraestrutura vinculada ao projeto.');
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao vincular infraestrutura.'),
  });

  const openModal = (type: ModalType) => {
    setModalType(type);
    setEditingId(null);
    const defaultProvider = providers.find((provider) => provider.type === (type === 'server' ? 'VPS' : 'DOMAIN')) || providers[0];
    setFormData(
      type === 'server'
        ? { name: '', ip: '', providerId: defaultProvider?.id || '', cost: 0, currency: 'BRL', startDate: today, renewalDate: '', specs: '', notes: '' }
        : type === 'item'
          ? { name: '', type: 'DOMAIN', providerId: defaultProvider?.id || '', cost: 0, currency: 'BRL', startDate: today, renewalDate: '' }
          : { name: '', type: 'VPS', website: '' }
    );
    setShowModal(true);
  };

  const openEditModal = (type: ModalType, record: InfraResource | ProviderRecord) => {
    setModalType(type);
    setEditingId(record.id);
    setFormData(
      type === 'provider'
        ? {
            name: record.name || '',
            type: (record as ProviderRecord).type || 'OTHER',
            website: (record as ProviderRecord).website || '',
          }
        : {
            name: record.name || '',
            type: (record as InfraResource).type || 'DOMAIN',
            ip: (record as InfraResource).ip || '',
            providerId: (record as InfraResource).providerId || (record as InfraResource).provider?.id || '',
            cost: Number((record as InfraResource).cost || 0),
            currency: (record as InfraResource).currency || 'BRL',
            startDate: toDateInputValue((record as InfraResource).startDate),
            renewalDate: toDateInputValue((record as InfraResource).renewalDate),
            specs: (record as InfraResource).specs || '',
          }
    );
    setShowModal(true);
  };

  const openLinkModal = (target: LinkTarget) => {
    setLinkingItem(target);
    setLinkCostShare(100);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      if (modalType === 'server') updateMutation.server.mutate({ id: editingId, data: formData });
      else if (modalType === 'item') updateMutation.item.mutate({ id: editingId, data: formData });
      else updateMutation.provider.mutate({ id: editingId, data: formData });
      return;
    }

    if (modalType === 'server') createMutation.server.mutate(formData);
    else if (modalType === 'item') createMutation.item.mutate(formData);
    else createMutation.provider.mutate(formData);
  };

  const calcMonthlyEquivalent = (cost: number, startDate?: string | null, endDate?: string | null) => {
    if (!startDate || !endDate || !cost) return null;
    const months = monthsBetweenDateInputs(startDate, endDate);
    if (!months) return null;
    return cost / months;
  };

  const formatCurrency = (amount: number, currency = 'BRL') => {
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amount || 0);
    } catch {
      return `${currency} ${(amount || 0).toFixed(2)}`;
    }
  };

  const formatDate = (value?: string | null) => {
    return formatBrazilDate(value, '');
  };

  const getInfraIcon = (type?: string) => {
    switch (type) {
      case 'DOMAIN': return Globe;
      case 'DATABASE': return Database;
      case 'SSL_CERT': return Lock;
      case 'EMAIL_SERVICE': return Mail;
      default: return Server;
    }
  };

  const matchesSearch = (resource: InfraResource | ProviderRecord) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [
      resource.name,
      'provider' in resource ? resource.provider?.name : undefined,
      'website' in resource ? resource.website : undefined,
      'type' in resource ? resource.type : undefined,
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
  };

  const visibleServers = useMemo(() => servers.filter(matchesSearch), [servers, search]);
  const visibleItems = useMemo(() => items.filter(matchesSearch), [items, search]);
  const visibleProviders = useMemo(() => providers.filter(matchesSearch), [providers, search]);
  const isSaving = createMutation.server.isPending || createMutation.item.isPending || createMutation.provider.isPending ||
    updateMutation.server.isPending || updateMutation.item.isPending || updateMutation.provider.isPending;
  const isCurrentTabLoading =
    activeTab === 'servers' ? isLoadingServers :
    activeTab === 'items' ? isLoadingItems :
    activeTab === 'providers' ? isLoadingProviders :
    isLoadingCosts;

  const tabs = [
    { id: 'servers', label: 'Servidores VPS', count: servers.length },
    { id: 'items', label: 'Infraestrutura', count: items.length },
    { id: 'providers', label: 'Provedores', count: providers.length },
    { id: 'costs', label: 'Custos', count: Object.keys(costs?.totalsByCurrency || {}).length || undefined },
  ] as const;

  const renderEmpty = (title: string, description: string, action?: () => void) => (
    <div className="erp-empty-state col-span-full py-12">
      <Server className="mx-auto mb-3 text-slate-300 dark:text-slate-700" size={42} />
      <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {action && (
        <button type="button" onClick={action} className="erp-primary-action mt-4">
          <Plus size={18} />
          Cadastrar
        </button>
      )}
    </div>
  );

  const renderResourceCard = (resource: InfraResource, kind: 'server' | 'item') => {
    const Icon = kind === 'server' ? Server : getInfraIcon(resource.type);
    const links = kind === 'server' ? resource.infrastructure || [] : resource.projects || [];
    const monthly = calcMonthlyEquivalent(resource.cost, resource.startDate, resource.renewalDate);

    return (
      <div key={resource.id} className="erp-card">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/30 dark:text-brand-400">
              <Icon size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-slate-800 dark:text-white">{resource.name}</h3>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {kind === 'server' ? resource.provider?.name || 'Sem provedor' : infraTypeLabel(resource.type || 'OTHER')}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => openEditModal(kind, resource)}
              className="erp-icon-button h-9 w-9"
              title="Editar"
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Excluir "${resource.name}"?`)) {
                  kind === 'server' ? deleteMutation.server.mutate(resource.id) : deleteMutation.item.mutate(resource.id);
                }
              }}
              className="erp-icon-button h-9 w-9 hover:text-rose-600"
              title="Excluir"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          {resource.ip && <p className="font-mono text-xs">IP: {resource.ip}</p>}
          {resource.startDate && resource.renewalDate && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatDate(resource.startDate)} até {formatDate(resource.renewalDate)}
            </p>
          )}
          <p className="text-lg font-bold text-slate-800 dark:text-white">
            {formatCurrency(resource.cost, resource.currency)}
            <span className="ml-1 text-sm font-normal text-slate-400">{monthly ? 'total' : '/mês'}</span>
          </p>
          {monthly && (
            <p className="font-semibold text-brand-600 dark:text-brand-400">
              {formatCurrency(monthly, resource.currency)}
              <span className="text-sm font-normal text-slate-400">/mês</span>
            </p>
          )}
          {resource.specs && <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{resource.specs}</p>}
        </div>

        {links.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Projetos vinculados</p>
            <div className="flex flex-wrap gap-1.5">
              {links.map((link) => (
                <span key={link.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {link.project?.name || 'Projeto'} {link.costShare ? `${link.costShare}%` : ''}
                  {link.project?.id && (
                    <button
                      type="button"
                      onClick={() => unlinkMutation.mutate({ type: kind === 'server' ? 'VPS' : 'INFRA', id: resource.id, projectId: link.project!.id })}
                      className="rounded-full p-0.5 hover:bg-white hover:text-rose-600 dark:hover:bg-slate-950"
                      title="Remover vínculo"
                    >
                      <X size={11} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => openLinkModal({ type: kind === 'server' ? 'VPS' : 'INFRA', id: resource.id, name: resource.name })}
          className="erp-secondary-action mt-4 w-full"
        >
          <Link2 size={16} />
          Vincular a Projeto
        </button>
      </div>
    );
  };

  return (
    <div className="erp-module">
      <div className="erp-module-header">
        <div>
          <h1 className="erp-module-title">
            <Server className="text-brand-500" size={26} />
            Infraestrutura
          </h1>
          <p className="erp-module-subtitle">Servidores, domínios, serviços, provedores e rateio básico de custos por projeto.</p>
        </div>
        {activeTab !== 'costs' && (
          <button
            type="button"
            onClick={() => openModal(activeTab === 'providers' ? 'provider' : activeTab === 'servers' ? 'server' : 'item')}
            className="erp-primary-action"
          >
            <Plus size={20} />
            Novo {activeTab === 'providers' ? 'Provedor' : activeTab === 'servers' ? 'Servidor' : 'Item'}
          </button>
        )}
      </div>

      <div className="erp-panel flex gap-2 overflow-x-auto p-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900'
            }`}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-500 shadow-sm dark:bg-slate-950 dark:text-slate-300">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab !== 'costs' && (
        <div className="erp-filter-bar">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="erp-input-with-icon pr-10"
              placeholder="Buscar por nome, tipo ou provedor"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {isCurrentTabLoading && (
        <div className="erp-panel py-12 text-center text-sm text-slate-500">Carregando infraestrutura...</div>
      )}

      {!isCurrentTabLoading && activeTab === 'servers' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleServers.map((server) => renderResourceCard(server, 'server'))}
          {visibleServers.length === 0 && renderEmpty('Nenhum servidor registrado', 'Cadastre VPSs ou servidores usados pelos projetos.', () => openModal('server'))}
        </div>
      )}

      {!isCurrentTabLoading && activeTab === 'items' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((item) => renderResourceCard(item, 'item'))}
          {visibleItems.length === 0 && renderEmpty('Nenhum item de infraestrutura', 'Cadastre domínios, bancos, certificados, e-mails ou serviços externos.', () => openModal('item'))}
        </div>
      )}

      {!isCurrentTabLoading && activeTab === 'providers' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {visibleProviders.map((provider) => {
            const usageCount = (provider.vpsServers?.length || 0) + (provider.infraItems?.length || 0);
            return (
              <div key={provider.id} className="erp-card">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-bold text-slate-800 dark:text-white">{provider.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{infraTypeLabel(provider.type)}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal('provider', provider)}
                      className="erp-icon-button h-9 w-9"
                      title="Editar provedor"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={usageCount > 0}
                      onClick={() => {
                        if (window.confirm(`Excluir o provedor "${provider.name}"?`)) deleteMutation.provider.mutate(provider.id);
                      }}
                      className="erp-icon-button h-9 w-9 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                      title={usageCount > 0 ? 'Provedor em uso' : 'Excluir provedor'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {provider.website && (
                  <a href={provider.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
                    <ExternalLink size={14} />
                    Site do provedor
                  </a>
                )}
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                  {usageCount > 0 ? `${usageCount} recurso(s) vinculado(s)` : 'Sem recursos vinculados'}
                </div>
              </div>
            );
          })}
          {visibleProviders.length === 0 && renderEmpty('Nenhum provedor registrado', 'Cadastre provedores para organizar custos e vencimentos.', () => openModal('provider'))}
        </div>
      )}

      {!isCurrentTabLoading && activeTab === 'costs' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="erp-stat-card">
              <div className="absolute inset-y-0 left-0 w-1.5 bg-brand-500" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Custo mensal em BRL</span>
                <WalletCards className="text-brand-600" size={20} />
              </div>
              <p className="mt-4 text-2xl font-extrabold text-slate-800 dark:text-white">{formatCurrency(costs?.totalMonthly || 0, 'BRL')}</p>
            </div>
            <div className="erp-stat-card">
              <div className="absolute inset-y-0 left-0 w-1.5 bg-emerald-500" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Servidores</span>
                <HardDrive className="text-emerald-600" size={20} />
              </div>
              <p className="mt-4 text-2xl font-extrabold text-slate-800 dark:text-white">{costs?.servers?.length || 0}</p>
            </div>
            <div className="erp-stat-card">
              <div className="absolute inset-y-0 left-0 w-1.5 bg-sky-500" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Itens</span>
                <Database className="text-sky-600" size={20} />
              </div>
              <p className="mt-4 text-2xl font-extrabold text-slate-800 dark:text-white">{costs?.items?.length || 0}</p>
            </div>
          </div>

          {costs?.totalsByCurrency && Object.keys(costs.totalsByCurrency).length > 0 && (
            <div className="erp-panel">
              <h3 className="mb-3 text-lg font-bold text-slate-800 dark:text-white">Custos por moeda</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(costs.totalsByCurrency).map(([currency, value]) => (
                  <div key={currency} className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{currency}</p>
                    <p className="mt-1 font-mono text-lg font-bold text-slate-800 dark:text-white">{formatCurrency(value, currency)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="erp-panel">
            <h3 className="mb-4 text-lg font-bold text-slate-800 dark:text-white">Custo por projeto</h3>
            {costs?.byProject && Object.keys(costs.byProject).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(costs.byProject).map(([projectId, cost]) => {
                  const project = projects.find((p) => p.id === Number(projectId));
                  return (
                    <div key={projectId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/40">
                      <span className="font-medium text-slate-700 dark:text-slate-200">{project?.name || `Projeto #${projectId}`}</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-white">{formatCurrency(cost, 'BRL')}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum custo vinculado a projeto.</p>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <div className="erp-modal-overlay" onClick={() => { setShowModal(false); setEditingId(null); }}>
          <div className="erp-modal max-w-lg animate-slide-up" onClick={(event) => event.stopPropagation()}>
            <div className="erp-modal-header">
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                  {editingId ? 'Editar' : 'Novo'} {modalType === 'server' ? 'Servidor' : modalType === 'item' ? 'Item' : 'Provedor'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Preencha os dados essenciais para controle operacional.</p>
              </div>
              <button type="button" onClick={() => { setShowModal(false); setEditingId(null); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="erp-modal-body">
                <div>
                  <label className="erp-label">Nome *</label>
                  <input type="text" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="erp-input" required />
                </div>

                {modalType === 'provider' && (
                  <>
                    <div>
                      <label className="erp-label">Tipo *</label>
                      <select value={formData.type || 'VPS'} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="erp-input">
                        <option value="VPS">VPS</option>
                        <option value="DOMAIN">Domínio</option>
                        <option value="EMAIL">E-mail</option>
                        <option value="PAYMENT">Pagamentos</option>
                        <option value="OTHER">Outro</option>
                      </select>
                    </div>
                    <div>
                      <label className="erp-label">Site</label>
                      <input type="url" value={formData.website || ''} onChange={(e) => setFormData({ ...formData, website: e.target.value })} className="erp-input" placeholder="https://..." />
                    </div>
                  </>
                )}

                {modalType !== 'provider' && (
                  <>
                    {modalType === 'item' && (
                      <div>
                        <label className="erp-label">Tipo de infraestrutura</label>
                        <select value={formData.type || 'DOMAIN'} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="erp-input">
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

                    <div>
                      <label className="erp-label">Provedor</label>
                      <select value={formData.providerId || ''} onChange={(e) => setFormData({ ...formData, providerId: e.target.value ? Number(e.target.value) : undefined })} className="erp-input">
                        <option value="">Sem provedor / automático</option>
                        {providers.map((provider) => (
                          <option key={provider.id} value={provider.id}>{provider.name} ({infraTypeLabel(provider.type)})</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="erp-label">Início *</label>
                        <input type="date" value={formData.startDate || ''} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="erp-input" required />
                      </div>
                      <div>
                        <label className="erp-label">Vencimento *</label>
                        <input type="date" value={formData.renewalDate || ''} onChange={(e) => setFormData({ ...formData, renewalDate: e.target.value })} className="erp-input" required />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="erp-label">Custo total *</label>
                        <input type="number" step="0.01" min="0.01" value={formData.cost || ''} onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })} className="erp-input" placeholder="0,00" required />
                      </div>
                      <div>
                        <label className="erp-label">Moeda</label>
                        <select value={formData.currency || 'BRL'} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} className="erp-input">
                          <option value="BRL">BRL (R$)</option>
                          <option value="USD">USD ($)</option>
                          <option value="EUR">EUR</option>
                          <option value="USDT">USDT</option>
                        </select>
                      </div>
                    </div>

                    {(() => {
                      const monthly = calcMonthlyEquivalent(formData.cost, formData.startDate, formData.renewalDate);
                      return monthly ? (
                        <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm text-brand-800 dark:border-brand-900/40 dark:bg-brand-950/20 dark:text-brand-300">
                          Equivale a <span className="font-semibold">{formatCurrency(monthly, formData.currency || 'BRL')}/mês</span>
                        </div>
                      ) : null;
                    })()}

                    {modalType === 'server' && (
                      <>
                        <div>
                          <label className="erp-label">IP</label>
                          <input value={formData.ip || ''} onChange={(e) => setFormData({ ...formData, ip: e.target.value })} className="erp-input" placeholder="192.168.1.1" />
                        </div>
                        <div>
                          <label className="erp-label">Especificações / notas técnicas</label>
                          <textarea value={formData.specs || ''} onChange={(e) => setFormData({ ...formData, specs: e.target.value })} className="erp-input min-h-[80px]" placeholder="2 vCPU, 4GB RAM, Ubuntu..." />
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              <div className="erp-modal-footer">
                <button type="button" onClick={() => { setShowModal(false); setEditingId(null); }} className="erp-secondary-action">Cancelar</button>
                <button type="submit" disabled={isSaving} className="erp-primary-action">{isSaving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {linkingItem && (
        <div className="erp-modal-overlay" onClick={() => setLinkingItem(null)}>
          <div className="erp-modal max-w-md animate-slide-up" onClick={(event) => event.stopPropagation()}>
            <div className="erp-modal-header">
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Vincular a projeto</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{linkingItem.name}</p>
              </div>
              <button type="button" onClick={() => setLinkingItem(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                <X size={18} />
              </button>
            </div>

            <div className="erp-modal-body">
              <div>
                <label className="erp-label">Percentual de rateio</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={linkCostShare}
                  onChange={(event) => setLinkCostShare(Math.min(100, Math.max(0, Number(event.target.value))))}
                  className="erp-input"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Projeto</p>
                {projects.length > 0 ? (
                  projects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => linkMutation.mutate({ type: linkingItem.type, id: linkingItem.id, projectId: project.id, costShare: linkCostShare })}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-left text-sm font-semibold text-slate-700 hover:border-brand-300 hover:bg-brand-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-brand-950/20"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Building2 size={16} className="shrink-0 text-brand-500" />
                        <span className="truncate">{project.name}</span>
                      </span>
                      <span className="text-xs text-slate-400">{linkCostShare}%</span>
                    </button>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-800">
                    Cadastre um projeto antes de vincular infraestrutura.
                  </p>
                )}
              </div>
            </div>

            <div className="erp-modal-footer">
              <button type="button" onClick={() => setLinkingItem(null)} className="erp-secondary-action">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
