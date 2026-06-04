import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  proposalApi,
  proposalTypeApi,
  clientApi,
  leadApi,
  projectApi,
  type Proposal,
  type ProposalItem,
  type ProposalType,
  type ProposalFieldValue,
  type ProposalTextBlockValue,
} from '../api/client';
import ProposalItemsTable from '../components/proposals/ProposalItemsTable';
import { useToast } from '../hooks/useToast';
import {
  FileText,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Search,
  Calendar,
  Building,
  FileCheck,
  TrendingUp,
  Clock,
  X,
} from 'lucide-react';

interface Project {
  id: number;
  name: string;
  clientId?: number | null;
  client?: {
    id: number;
  } | null;
}

interface ClientOption {
  id: number;
  name?: string;
  company?: string | null;
}

interface LeadOption {
  id: number;
  name?: string;
  company?: string | null;
  status?: string;
}

const getErrorMessage = (err: unknown, fallback: string) => {
  return err instanceof Error ? err.message : fallback;
};

const STATUS_OPTIONS = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const;

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  SENT: 'Enviada',
  ACCEPTED: 'Aceita',
  REJECTED: 'Recusada',
  EXPIRED: 'Expirada',
};

export default function Proposals() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptingProposal, setAcceptingProposal] = useState<Proposal | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // Form states for creating/editing a proposal
  const [form, setForm] = useState({
    title: '',
    description: '',
    validUntil: '',
    associationType: 'manual' as 'manual' | 'client' | 'lead',
    associatedId: '' as string,
    typeId: null as number | null,
    currency: 'BRL',
  });
  const [items, setItems] = useState<ProposalItem[]>([]);
  const [fieldValues, setFieldValues] = useState<ProposalFieldValue[]>([]);
  const [textBlocks, setTextBlocks] = useState<ProposalTextBlockValue[]>([]);

  // Queries
  const { data: proposals = [], isLoading } = useQuery<Proposal[]>({
    queryKey: ['proposals'],
    queryFn: () => proposalApi.getAll(),
  });

  const { data: clients = [] } = useQuery<ClientOption[]>({
    queryKey: ['clients'],
    queryFn: () => clientApi.getAll(),
  });

  const { data: leads = [] } = useQuery<LeadOption[]>({
    queryKey: ['leads'],
    queryFn: () => leadApi.getAll(),
  });

  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => projectApi.getAll(),
  });

  const { data: proposalTypes = [] } = useQuery<ProposalType[]>({
    queryKey: ['proposalTypes'],
    queryFn: () => proposalTypeApi.getAll(),
  });

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      validUntil: '',
      associationType: 'manual',
      associatedId: '',
      typeId: null,
      currency: 'BRL',
    });
    setItems([]);
    setFieldValues([]);
    setTextBlocks([]);
    setEditingId(null);
  };

  // Populate the form from a chosen proposal type (creation flow).
  const applyType = async (typeId: number | null) => {
    if (!typeId) {
      setForm((f) => ({ ...f, typeId: null }));
      setItems([]);
      setFieldValues([]);
      setTextBlocks([]);
      return;
    }
    try {
      const type = await proposalTypeApi.get(typeId);
      setForm((f) => ({ ...f, typeId, currency: type.defaultCurrency || 'BRL' }));
      setItems(
        type.items.map((it, i) => ({
          description: it.description,
          qty: it.qty,
          unitPrice: it.unitPrice,
          discount: it.discount,
          tax: it.tax,
          recurring: false,
          order: it.order ?? i,
        }))
      );
      setFieldValues(type.fields.map((f) => ({ fieldKey: f.key, label: f.label, value: '' })));
      setTextBlocks(
        type.textBlocks.map((b, i) => ({ title: b.title, content: b.content, order: b.order ?? i }))
      );
    } catch (err) {
      toast.error(getErrorMessage(err, 'Erro ao carregar tipo de proposta.'));
    }
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const openEditModal = async (proposal: Proposal) => {
    try {
      const full = await proposalApi.get(proposal.id);
      setEditingId(full.id);
      setForm({
        title: full.title || '',
        description: full.description || '',
        validUntil: full.validUntil ? full.validUntil.slice(0, 10) : '',
        associationType: full.clientId ? 'client' : full.leadId ? 'lead' : 'manual',
        associatedId: full.clientId ? String(full.clientId) : full.leadId ? String(full.leadId) : '',
        typeId: full.typeId ?? null,
        currency: full.currency || 'BRL',
      });
      setItems(
        (full.items || []).map((it, i) => ({
          description: it.description,
          qty: it.qty,
          unitPrice: it.unitPrice,
          discount: it.discount,
          tax: it.tax,
          recurring: it.recurring ?? false,
          order: it.order ?? i,
        }))
      );
      setFieldValues((full.fieldValues || []).map((fv) => ({ fieldKey: fv.fieldKey, label: fv.label, value: fv.value })));
      setTextBlocks((full.textBlocks || []).map((b, i) => ({ title: b.title, content: b.content, order: b.order ?? i })));
      setShowCreateModal(true);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Erro ao carregar proposta.'));
    }
  };

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) {
      toast.error('O título é obrigatório.');
      return;
    }

    let clientId: number | undefined = undefined;
    let leadId: number | undefined = undefined;

    if (form.associationType === 'client' && form.associatedId) {
      const selectedClient = clients.find((c) => c.id === Number(form.associatedId));
      if (selectedClient) {
        clientId = selectedClient.id;
      }
    } else if (form.associationType === 'lead' && form.associatedId) {
      const selectedLead = leads.find((l) => l.id === Number(form.associatedId));
      if (selectedLead) {
        leadId = selectedLead.id;
      }
    }

    const payload = {
      title: form.title,
      description: form.description,
      validUntil: form.validUntil || null,
      clientId,
      leadId,
      typeId: form.typeId,
      currency: form.currency,
      items,
      fieldValues,
      textBlocks,
    };

    setIsSubmitting(true);
    try {
      if (editingId) {
        await proposalApi.update(editingId, payload);
        toast.success('Proposta atualizada com sucesso!');
      } else {
        await proposalApi.create({ ...payload, status: 'DRAFT' });
        toast.success('Proposta comercial registrada com sucesso!');
      }

      setShowCreateModal(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Erro ao salvar proposta.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getProposalClientId = (proposal: Proposal) => proposal.clientId ?? proposal.client?.id;

  const getProposalPartyName = (proposal: Proposal) => {
    return (
      proposal.clientName ||
      proposal.client?.company ||
      proposal.client?.name ||
      proposal.lead?.company ||
      proposal.lead?.name ||
      'Sem vínculo'
    );
  };

  const getClientProjects = (proposal: Proposal) => {
    const clientId = getProposalClientId(proposal);
    if (!clientId) return [];

    return projects.filter((project) => (project.clientId ?? project.client?.id) === clientId);
  };

  const acceptProposal = async (proposal: Proposal, projectId?: number) => {
    setIsSubmitting(true);
    try {
      await proposalApi.updateStatus(proposal.id, 'ACCEPTED', projectId);

      toast.success(`Proposta aceita com valor estimado de ${formatBRL(proposal.total)}.`);
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err, 'Erro ao aceitar proposta.'));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptProposal = async (proposal: Proposal) => {
    const proposalClientId = getProposalClientId(proposal);
    if (proposalClientId && isLoadingProjects) {
      toast.error('Aguarde o carregamento dos projetos do cliente.');
      return;
    }

    const clientProjects = getClientProjects(proposal);
    if (proposalClientId && clientProjects.length > 0) {
      setAcceptingProposal(proposal);
      setSelectedProjectId(String(clientProjects[0].id));
      return;
    }

    await acceptProposal(proposal);
  };

  const handleConfirmAcceptProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptingProposal) return;

    const accepted = await acceptProposal(
      acceptingProposal,
      selectedProjectId ? Number(selectedProjectId) : undefined
    );

    if (accepted) {
      setAcceptingProposal(null);
      setSelectedProjectId('');
    }
  };

  const handleRejectProposal = async (proposalId: number) => {
    if (!window.confirm('Tem certeza que deseja marcar esta proposta como Recusada?')) return;
    try {
      await proposalApi.updateStatus(proposalId, 'REJECTED');
      toast.success('Proposta marcada como recusada.');
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Erro ao recusar proposta.'));
    }
  };

  const handleDeleteProposal = async (proposalId: number) => {
    if (!window.confirm('Tem certeza que deseja excluir permanentemente o registro desta proposta?')) return;
    try {
      await proposalApi.delete(proposalId);
      toast.success('Proposta excluída.');
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Erro ao excluir proposta.'));
    }
  };

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // KPIs
  const totalProposed = proposals.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
  const totalAccepted = proposals
    .filter((p) => p.status === 'ACCEPTED')
    .reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
  const totalPending = proposals
    .filter((p) => p.status === 'DRAFT' || p.status === 'SENT')
    .reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);

  const filteredProposals = proposals.filter((p) => {
    const partyName = getProposalPartyName(p);
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      partyName.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' || p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 border border-emerald-200/50">
            <CheckCircle size={12} /> {STATUS_LABELS.ACCEPTED}
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/20 border border-rose-200/50">
            <XCircle size={12} /> {STATUS_LABELS.REJECTED}
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 dark:bg-slate-900/40 border border-slate-200/50">
            <Clock size={12} /> {STATUS_LABELS.EXPIRED}
          </span>
        );
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 dark:bg-blue-950/20 border border-blue-200/50">
            <FileCheck size={12} /> {STATUS_LABELS.SENT}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/20 border border-amber-200/50">
            <Clock size={12} /> {STATUS_LABELS.DRAFT}
          </span>
        );
    }
  };

  return (
    <div className="erp-module">
      
      {/* Header Panel */}
      <div className="erp-module-header">
        <div>
          <h1 className="erp-module-title">
            <FileText className="text-brand-500" size={26} />
            Histórico de Propostas
          </h1>
          <p className="erp-module-subtitle">
            Acompanhe propostas comerciais ativas e valores estimados sem tratar aceite como contrato formal.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="erp-primary-action"
        >
          <Plus size={20} />
          Nova Proposta
        </button>
      </div>

      {/* Proposal KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total proposed */}
        <div className="erp-stat-card">
          <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-slate-400" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Valor Estimado Total</span>
            <span className="p-2 bg-slate-100 text-slate-500 rounded-lg dark:bg-slate-900/30">
              <FileText size={20} />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-extrabold font-mono text-slate-800 dark:text-white">
              {formatBRL(totalProposed)}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Soma dos valores estimados das propostas</p>
          </div>
        </div>

        {/* Accepted / Conversion */}
        <div className="erp-stat-card">
          <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-emerald-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Propostas Aprovadas</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg dark:bg-emerald-950/20">
              <TrendingUp size={20} />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-extrabold font-mono text-slate-800 dark:text-white">
              {formatBRL(totalAccepted)}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Conversão: {totalProposed > 0 ? ((totalAccepted / totalProposed) * 100).toFixed(1) : 0}% de sucesso
            </p>
          </div>
        </div>

        {/* Pending */}
        <div className="erp-stat-card">
          <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-amber-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Propostas Pendentes</span>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-lg dark:bg-amber-950/20">
              <Clock size={18} />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-extrabold font-mono text-slate-800 dark:text-white">
              {formatBRL(totalPending)}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Aguardando decisão comercial</p>
          </div>
        </div>
      </div>

      {/* Search and filter controls */}
      <div className="erp-filter-bar">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Procurar proposta por título ou cliente..."
              className="erp-input-with-icon"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          </div>
          <select
            className="erp-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">Todas as Propostas</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Proposals List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500"></div>
        </div>
      ) : filteredProposals.length === 0 ? (
        <div className="erp-empty-state py-16">
          <FileText className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={48} />
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Nenhuma proposta comercial</h3>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1 max-w-sm mx-auto">
            {search || statusFilter !== 'ALL'
              ? 'Nenhuma proposta corresponde a estes filtros.'
              : 'Registre sua primeira proposta utilizando o botão acima.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredProposals.map((proposal) => {
            const partyName = getProposalPartyName(proposal);

            return (
              <div
                key={proposal.id}
                className="erp-card flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Visual side highlights */}
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-extrabold text-slate-800 dark:text-white font-display text-base">
                      {proposal.title}
                    </h3>
                    {getStatusBadge(proposal.status)}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                      <Building size={14} className="text-slate-400" />
                      {partyName}
                    </span>
                    {proposal.createdAt && (
                      <span className="flex items-center gap-1">
                        <Calendar size={14} className="text-slate-400" />
                        Criada em: {new Date(proposal.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>

                  {proposal.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-2 max-w-2xl">
                      &ldquo;{proposal.description}&rdquo;
                    </p>
                  )}
                </div>

                {/* Right Area: value & interactive action triggers */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-3 md:pt-0">
                  <div className="text-left md:text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {proposal.number ? `Nº ${proposal.number}` : 'Valor Estimado'}
                    </p>
                    <p className="font-extrabold text-xl text-brand-600 dark:text-orange-400 font-mono mt-0.5">
                      {formatBRL(proposal.total)}
                    </p>
                  </div>

                  {/* Actions depending on proposal status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => navigate(`/proposals/${proposal.id}/view`)}
                      className="erp-secondary-action text-xs"
                      title="Visualizar documento"
                    >
                      <FileText size={15} />
                      Visualizar
                    </button>
                    <button
                      onClick={() => openEditModal(proposal)}
                      className="erp-secondary-action text-xs"
                      title="Editar proposta"
                    >
                      <FileCheck size={15} />
                      Editar
                    </button>
                    {proposal.status !== 'ACCEPTED' && proposal.status !== 'REJECTED' ? (
                      <>
                        <button
                          onClick={() => handleAcceptProposal(proposal)}
                          disabled={isSubmitting}
                          className="erp-success-action text-xs"
                          title="Aceitar proposta"
                        >
                          <CheckCircle size={15} />
                          Aceitar
                        </button>
                        <button
                          onClick={() => handleRejectProposal(proposal.id)}
                          className="erp-danger-action text-xs"
                          title="Rejeitar Proposta"
                        >
                          Recusar
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400 italic font-medium">Proposta Processada</span>
                    )}

                    <button
                      onClick={() => handleDeleteProposal(proposal.id)}
                      className="erp-icon-button hover:text-rose-600"
                      title="Excluir Registro"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Creation / Edit Modal */}
      {showCreateModal && (
        <div className="erp-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="erp-modal max-w-3xl animate-slide-up" onClick={(event) => event.stopPropagation()}>

            <div className="erp-modal-header">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <FileCheck className="text-brand-500" size={22} />
                {editingId ? 'Editar Proposta Comercial' : 'Lançar Proposta Comercial'}
              </h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateProposal} className="flex min-h-0 flex-1 flex-col">
              <div className="erp-modal-body">

              {!editingId && (
                <div>
                  <label className="erp-label">Tipo de Proposta</label>
                  <select
                    className="erp-input"
                    value={form.typeId ?? ''}
                    onChange={(e) => applyType(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Em branco</option>
                    {proposalTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="erp-label">Título do Escopo Comercial *</label>
                <input
                  type="text"
                  placeholder="Ex: Proposta de Auditoria de Software"
                  className="erp-input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="erp-label">Válida até</label>
                <input
                  type="date"
                  className="erp-input"
                  value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                />
              </div>

              {/* Associating type */}
              <div>
                <label className="erp-label">Vincular a:</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, associationType: 'manual', associatedId: '' })}
                    className={`min-h-10 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                      form.associationType === 'manual'
                        ? 'bg-brand-50 border-brand-500 text-brand-600 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900'
                    }`}
                  >
                    Sem vínculo
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, associationType: 'client', associatedId: '' })}
                    className={`min-h-10 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                      form.associationType === 'client'
                        ? 'bg-brand-50 border-brand-500 text-brand-600 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900'
                    }`}
                  >
                    Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, associationType: 'lead', associatedId: '' })}
                    className={`min-h-10 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                      form.associationType === 'lead'
                        ? 'bg-brand-50 border-brand-500 text-brand-600 font-bold'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900'
                    }`}
                  >
                    Lead
                  </button>
                </div>
              </div>

              {/* Dynamic Field Based on Association Type */}
              {form.associationType === 'client' && (
                <div>
                  <label className="erp-label">Escolher Cliente Comercial *</label>
                  <select
                    className="erp-input"
                    value={form.associatedId}
                    onChange={(e) => setForm({ ...form, associatedId: e.target.value })}
                    required={form.associationType === 'client'}
                  >
                    <option value="">-- Selecione o Cliente --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company || c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {form.associationType === 'lead' && (
                <div>
                  <label className="erp-label">Escolher Lead de CRM *</label>
                  <select
                    className="erp-input"
                    value={form.associatedId}
                    onChange={(e) => setForm({ ...form, associatedId: e.target.value })}
                    required={form.associationType === 'lead'}
                  >
                    <option value="">-- Selecione o Lead --</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.company || l.name} [{l.status}]
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="erp-label">Detalhamento Técnico & Escopo da Proposta</label>
                <textarea
                  placeholder="Defina o escopo, cronograma resumido, prazos de entrega ou descontos aplicados..."
                  className="erp-input min-h-[90px]"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              {fieldValues.length > 0 && (
                <div className="space-y-3">
                  <label className="erp-label">Campos-chave</label>
                  {fieldValues.map((fv, i) => (
                    <div key={fv.fieldKey || i}>
                      <label className="erp-label text-xs">{fv.label}</label>
                      <input
                        type="text"
                        className="erp-input"
                        value={fv.value}
                        onChange={(e) =>
                          setFieldValues(fieldValues.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="erp-label">Itens</label>
                <ProposalItemsTable items={items} currency={form.currency} onChange={setItems} />
              </div>

              {textBlocks.length > 0 && (
                <div className="space-y-3">
                  <label className="erp-label">Blocos de texto</label>
                  {textBlocks.map((b, i) => (
                    <div key={i}>
                      <label className="erp-label text-xs">{b.title}</label>
                      <textarea
                        className="erp-input min-h-[80px]"
                        value={b.content}
                        onChange={(e) =>
                          setTextBlocks(textBlocks.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)))
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
              </div>

              <div className="erp-modal-footer">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="erp-secondary-action"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="erp-primary-action"
                >
                  {isSubmitting ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Lançar Proposta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project choice before accepting a proposal with a known client */}
      {acceptingProposal && (
        <div className="erp-modal-overlay" onClick={() => setAcceptingProposal(null)}>
          <div className="erp-modal max-w-md animate-slide-up" onClick={(event) => event.stopPropagation()}>
            <div className="erp-modal-header">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <CheckCircle className="text-emerald-600" size={22} />
                Aceitar Proposta
              </h3>
              <button
                type="button"
                onClick={() => setAcceptingProposal(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmAcceptProposal} className="flex min-h-0 flex-1 flex-col">
              <div className="erp-modal-body">
                <div>
                  <label className="erp-label">Projeto associado *</label>
                  <select
                    className="erp-input"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    required
                  >
                    {getClientProjects(acceptingProposal).map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 p-3">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{acceptingProposal.title}</p>
                  <p className="text-sm font-extrabold text-brand-600 dark:text-orange-400 font-mono mt-1">
                    {formatBRL(acceptingProposal.total)}
                  </p>
                </div>
              </div>

              <div className="erp-modal-footer">
                <button
                  type="button"
                  onClick={() => setAcceptingProposal(null)}
                  className="erp-secondary-action"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="erp-success-action"
                >
                  {isSubmitting ? 'Aceitando...' : 'Aceitar Proposta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
