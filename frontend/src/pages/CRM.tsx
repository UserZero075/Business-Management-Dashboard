import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { leadApi, proposalApi } from '../api/client';
import type { Proposal } from '../api/client';
import { useToast } from '../hooks/useToast';
import { addDaysBrazil, todayBrazilDateInput } from '../utils/dates';
import { ViewportPortal } from '../components/ViewportPortal';
import type { LucideIcon } from 'lucide-react';
import {
  Plus,
  Trash2,
  Sparkles,
  ThumbsUp,
  FileText,
  Trophy,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Mail,
  Phone,
  Briefcase,
  X,
  CheckCircle
} from 'lucide-react';

type LeadStatus = 'NEW' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST';

interface Lead {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: LeadStatus;
  value?: number;
  notes?: string;
  createdAt?: string;
}

interface LeadProposal {
  id: number;
  title: string;
  value: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  leadId?: number;
  lead?: {
    id: number;
  };
  createdAt?: string;
}

const formatDateInput = (daysFromToday = 0) => {
  const today = todayBrazilDateInput();
  return daysFromToday === 0 ? today : addDaysBrazil(today, daysFromToday);
};

const getErrorMessage = (err: unknown, fallback: string) => {
  return err instanceof Error ? err.message : fallback;
};

const COLUMNS: { id: LeadStatus; title: string; color: string; icon: LucideIcon; bgLight: string; borderLight: string }[] = [
  { id: 'NEW', title: 'Novo Lead', color: 'text-sky-500', icon: Sparkles, bgLight: 'bg-sky-50 dark:bg-sky-950/20', borderLight: 'border-sky-200 dark:border-sky-900/30' },
  { id: 'QUALIFIED', title: 'Qualificado', color: 'text-indigo-500', icon: ThumbsUp, bgLight: 'bg-indigo-50 dark:bg-indigo-950/20', borderLight: 'border-indigo-200 dark:border-indigo-900/30' },
  { id: 'PROPOSAL', title: 'Proposta', color: 'text-amber-500', icon: FileText, bgLight: 'bg-amber-50 dark:bg-amber-950/20', borderLight: 'border-amber-200 dark:border-amber-900/30' },
  { id: 'WON', title: 'Ganho', color: 'text-emerald-500', icon: Trophy, bgLight: 'bg-emerald-50 dark:bg-emerald-950/20', borderLight: 'border-emerald-200 dark:border-emerald-900/30' },
  { id: 'LOST', title: 'Perdido', color: 'text-rose-500', icon: XCircle, bgLight: 'bg-rose-50 dark:bg-rose-950/20', borderLight: 'border-rose-200 dark:border-rose-900/30' },
];

export default function CRM() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<LeadStatus>('NEW'); // Mobile view tab
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isWonModalOpen, setIsWonModalOpen] = useState(false);
  const [draggedLeadId, setDraggedLeadId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for new Lead
  const [leadForm, setLeadForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    value: 0,
    notes: '',
  });

  // Won Modal auto project fields
  const [wonForm, setWonForm] = useState({
    createProject: true,
    projectName: '',
    contractValue: 0,
    startDate: formatDateInput(),
    endDate: formatDateInput(90),
  });

  // Proposal Creation Modal inside lead edit panel
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [proposalForm, setProposalForm] = useState({
    title: '',
    value: 0,
    description: '',
  });

  // Fetch Leads
  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ['leads'],
    queryFn: () => leadApi.getAll(),
  });

  // Fetch Proposals to list linked ones
  const { data: proposals = [] } = useQuery<Proposal[]>({
    queryKey: ['proposals'],
    queryFn: () => proposalApi.getAll(),
  });

  // Filter proposals linked to selected lead
  const leadProposals = proposals.filter(
    (p) => p.leadId === selectedLead?.id || p.lead?.id === selectedLead?.id
  );

  const resetLeadForm = () => {
    setLeadForm({
      name: '',
      company: '',
      email: '',
      phone: '',
      value: 0,
      notes: '',
    });
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.name || !leadForm.company) {
      toast.error('Nome e Empresa são campos obrigatórios.');
      return;
    }
    setIsSubmitting(true);
    try {
      await leadApi.create({
        name: leadForm.name,
        company: leadForm.company,
        email: leadForm.email,
        phone: leadForm.phone,
        value: leadForm.value,
        notes: leadForm.notes,
        status: 'NEW',
      });
      toast.success('Lead criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setIsCreateModalOpen(false);
      resetLeadForm();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Falha ao criar o lead.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateLeadDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    setIsSubmitting(true);
    try {
      await leadApi.update(selectedLead.id, {
        name: selectedLead.name,
        company: selectedLead.company,
        email: selectedLead.email,
        phone: selectedLead.phone,
        value: selectedLead.value,
        notes: selectedLead.notes,
      });
      toast.success('Detalhes do lead atualizados!');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Erro ao atualizar lead.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoveLead = async (leadId: number, targetStatus: LeadStatus) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    if (targetStatus === 'WON') {
      // Open WON conversion dialog
      setSelectedLead(lead);
      setWonForm({
        createProject: true,
        projectName: `Projeto - ${lead.company || lead.name}`,
        contractValue: lead.value || 0,
        startDate: formatDateInput(),
        endDate: formatDateInput(90),
      });
      setIsWonModalOpen(true);
      return;
    }

    try {
      await leadApi.updateStatus(leadId, targetStatus);
      toast.success(`Lead movido para ${COLUMNS.find((c) => c.id === targetStatus)?.title}!`);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead({ ...selectedLead, status: targetStatus });
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Erro ao mover lead.'));
    }
  };

  const handleConfirmWon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    setIsSubmitting(true);
    try {
      const details = wonForm.createProject
        ? {
            projectName: wonForm.projectName,
            startDate: wonForm.startDate,
            endDate: wonForm.endDate,
            contractValue: wonForm.contractValue,
          }
        : undefined;

      await leadApi.updateStatus(
        selectedLead.id,
        'WON',
        wonForm.createProject,
        details
      );

      toast.success(wonForm.createProject ? 'Lead convertido em cliente e projeto com sucesso!' : 'Lead marcado como ganho.');
      setIsWonModalOpen(false);
      setSelectedLead(null);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Erro na conversão do lead.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLead = async (leadId: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este lead?')) return;
    try {
      await leadApi.delete(leadId);
      toast.success('Lead excluído.');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      if (selectedLead?.id === leadId) {
        setSelectedLead(null);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Erro ao excluir.'));
    }
  };

  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    if (!proposalForm.title || proposalForm.value <= 0) {
      toast.error('Título e valor são obrigatórios.');
      return;
    }
    setIsSubmitting(true);
    try {
      await proposalApi.create({
        title: proposalForm.title,
        value: proposalForm.value,
        description: proposalForm.description,
        leadId: selectedLead.id,
        status: 'PENDING',
      });
      toast.success('Proposta criada e associada ao lead!');
      setIsProposalModalOpen(false);
      setProposalForm({
        title: '',
        value: 0,
        description: '',
      });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Falha ao criar proposta.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const getStepIndex = (status: LeadStatus) => {
    return COLUMNS.findIndex((c) => c.id === status);
  };

  return (
    <div className="erp-module">
      {/* Header Panel */}
      <div className="erp-module-header">
        <div>
          <h1 className="erp-module-title">
            <Sparkles className="text-brand-500" size={26} />
            CRM & Funil de Vendas
          </h1>
          <p className="erp-module-subtitle">
            Gerencie novos leads comerciais, propostas integradas e converta-os em projetos em um clique.
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="erp-primary-action"
        >
          <Plus size={20} />
          Adicionar Lead
        </button>
      </div>

      {/* Tabs navigation for Mobile/Tablet Screens */}
      <div className="erp-panel lg:hidden flex items-center overflow-x-auto gap-2 p-2">
        {COLUMNS.map((col) => {
          const count = leads.filter((l) => l.status === col.id).length;
          const Icon = col.icon;
          return (
            <button
              key={col.id}
              onClick={() => setActiveTab(col.id)}
              className={`flex min-h-10 items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors flex-1 justify-center ${
                activeTab === col.id
                  ? `${col.bgLight} ${col.color} border border-orange-500/10 shadow-sm font-bold`
                  : 'text-slate-500 hover:bg-white hover:text-slate-800 dark:hover:bg-slate-900'
              }`}
            >
              <Icon size={16} />
              <span>{col.title}</span>
              <span className="px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Mobile Active Column View */}
      <div className="lg:hidden space-y-4">
        {leads.filter((l) => l.status === activeTab).length === 0 ? (
          <div className="erp-empty-state py-12">
            <Briefcase className="mx-auto text-slate-300 dark:text-slate-600 mb-3" size={40} />
            <p className="text-slate-400 dark:text-slate-500 text-sm font-medium">Nenhum lead nesta etapa.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {leads
              .filter((l) => l.status === activeTab)
              .map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onSelect={() => setSelectedLead(lead)}
                  onMoveLeft={() => {
                    const idx = getStepIndex(lead.status);
                    if (idx > 0) handleMoveLead(lead.id, COLUMNS[idx - 1].id);
                  }}
                  onMoveRight={() => {
                    const idx = getStepIndex(lead.status);
                    if (idx < COLUMNS.length - 1) handleMoveLead(lead.id, COLUMNS[idx + 1].id);
                  }}
                  formatBRL={formatBRL}
                  isFirst={getStepIndex(lead.status) === 0}
                  isLast={getStepIndex(lead.status) === COLUMNS.length - 1}
                />
              ))}
          </div>
        )}
      </div>

      {/* Desktop Kanban Board View */}
      <div className="hidden lg:grid grid-cols-5 gap-4 items-start">
        {COLUMNS.map((col) => {
          const colLeads = leads.filter((l) => l.status === col.id);
          const totalColValue = colLeads.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
          const ColIcon = col.icon;

          return (
            <div
              key={col.id}
              className={`flex flex-col rounded-xl border min-h-[560px] transition-colors bg-slate-50/70 dark:bg-slate-900/30 ${
                draggedLeadId !== null ? 'border-dashed border-brand-500/30 bg-orange-500/5' : 'border-slate-200/60 dark:border-white/5'
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const idStr = e.dataTransfer.getData('text/plain');
                if (idStr) {
                  handleMoveLead(parseInt(idStr, 10), col.id);
                }
              }}
            >
              {/* Column Header */}
              <div className={`p-4 rounded-t-xl border-b border-slate-200/50 dark:border-white/5 ${col.bgLight} flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <ColIcon className={`${col.color}`} size={18} />
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">{col.title}</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-[11px] font-bold shadow-sm border text-slate-600 dark:text-slate-300">
                  {colLeads.length}
                </span>
              </div>

              {/* Column Meta Value */}
              {totalColValue > 0 && (
                <div className="px-4 py-1.5 bg-slate-100/50 dark:bg-slate-950/20 text-[11px] font-semibold text-slate-500 text-right">
                  Total: {formatBRL(totalColValue)}
                </div>
              )}

              {/* Lead Cards List */}
              <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[500px]">
                {colLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', lead.id.toString());
                      setDraggedLeadId(lead.id);
                    }}
                    onDragEnd={() => setDraggedLeadId(null)}
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <LeadCard
                      lead={lead}
                      onSelect={() => setSelectedLead(lead)}
                      onMoveLeft={() => {
                        const idx = getStepIndex(lead.status);
                        if (idx > 0) handleMoveLead(lead.id, COLUMNS[idx - 1].id);
                      }}
                      onMoveRight={() => {
                        const idx = getStepIndex(lead.status);
                        if (idx < COLUMNS.length - 1) handleMoveLead(lead.id, COLUMNS[idx + 1].id);
                      }}
                      formatBRL={formatBRL}
                      isFirst={getStepIndex(lead.status) === 0}
                      isLast={getStepIndex(lead.status) === COLUMNS.length - 1}
                    />
                  </div>
                ))}

                {colLeads.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-48 border border-dashed border-slate-200/60 dark:border-white/5 rounded-xl bg-white/70 dark:bg-slate-900/30">
                    <span className="text-xs text-slate-400">Solte leads aqui</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Panel Drawer (Glassmorphic Slide-in Side Panel) */}
      {selectedLead && !isWonModalOpen && (
        <ViewportPortal>
          <div className="fixed inset-0 z-40 flex justify-end">
            <div
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-fade-in"
              onClick={() => setSelectedLead(null)}
            />
            <div className="relative w-full max-w-xl bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-white/10 h-full shadow-2xl flex flex-col z-50 animate-slide-up overflow-hidden">
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-slate-900/40">
              <div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  COLUMNS.find((c) => c.id === selectedLead.status)?.bgLight
                } ${COLUMNS.find((c) => c.id === selectedLead.status)?.color}`}>
                  {COLUMNS.find((c) => c.id === selectedLead.status)?.title}
                </span>
                <h2 className="text-xl font-bold text-slate-800 dark:text-white mt-2">
                  {selectedLead.name}
                </h2>
                <p className="text-slate-500 text-xs">{selectedLead.company}</p>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="erp-icon-button border-0 bg-transparent"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Body Scroll */}
            <div className="flex-1 p-5 space-y-6 overflow-y-auto">
              
              {/* Form details */}
              <form onSubmit={handleUpdateLeadDetails} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="erp-label">Nome do Contato</label>
                    <input
                      type="text"
                      className="erp-input"
                      value={selectedLead.name}
                      onChange={(e) => setSelectedLead({ ...selectedLead, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="erp-label">Empresa</label>
                    <input
                      type="text"
                      className="erp-input"
                      value={selectedLead.company}
                      onChange={(e) => setSelectedLead({ ...selectedLead, company: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="erp-label">E-mail</label>
                    <input
                      type="email"
                      className="erp-input"
                      value={selectedLead.email}
                      onChange={(e) => setSelectedLead({ ...selectedLead, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="erp-label">Telefone</label>
                    <input
                      type="text"
                      className="erp-input"
                      value={selectedLead.phone}
                      onChange={(e) => setSelectedLead({ ...selectedLead, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="erp-label">Valor Estimado (BRL)</label>
                  <input
                    type="number"
                    className="erp-input font-mono"
                    value={selectedLead.value || ''}
                    onChange={(e) => setSelectedLead({ ...selectedLead, value: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <label className="erp-label">Histórico & Notas Comerciais</label>
                  <textarea
                    className="erp-input min-h-[100px]"
                    placeholder="Adicione feedbacks de ligações, reuniões ou notas gerais..."
                    value={selectedLead.notes || ''}
                    onChange={(e) => setSelectedLead({ ...selectedLead, notes: e.target.value })}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="erp-primary-action flex-1"
                  >
                    {isSubmitting ? 'Atualizando...' : 'Salvar Alterações'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteLead(selectedLead.id)}
                    className="erp-danger-action px-3"
                    title="Excluir Lead"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </form>

              <hr className="border-slate-200 dark:border-white/5" />

              {/* Integrated Proposals Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                    <FileText className="text-amber-500" size={18} />
                    Propostas Relacionadas ({leadProposals.length})
                  </h3>
                  <button
                    onClick={() => setIsProposalModalOpen(true)}
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-brand-500 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/20"
                  >
                    <Plus size={14} />
                    Nova Proposta
                  </button>
                </div>

                {leadProposals.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nenhuma proposta vinculada a este lead comercial.</p>
                ) : (
                  <div className="space-y-2">
                    {leadProposals.map((prop) => (
                      <div key={prop.id} className="p-3 bg-slate-50 dark:bg-slate-900/40 border rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-700 dark:text-slate-200">{prop.title}</p>
                          <p className="text-[10px] text-slate-400">
                            {prop.createdAt ? `Criada em: ${new Date(prop.createdAt).toLocaleDateString('pt-BR')}` : 'Sem data de criação'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-800 dark:text-white font-mono">{formatBRL(prop.value)}</p>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            prop.status === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-600' :
                            prop.status === 'REJECTED' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {prop.status === 'ACCEPTED' ? 'Aceita' :
                             prop.status === 'REJECTED' ? 'Recusada' : 'Pendente'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status workflow buttons */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Mover para Estágio</h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {COLUMNS.map((col) => (
                    <button
                      key={col.id}
                      onClick={() => handleMoveLead(selectedLead.id, col.id)}
                      className={`min-h-10 px-2 py-2 text-[11px] font-semibold rounded-lg border text-center whitespace-nowrap transition-colors ${
                        selectedLead.status === col.id
                          ? `${col.bgLight} ${col.color} border-current font-bold`
                          : 'border-slate-200/60 dark:border-white/5 hover:bg-slate-50 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {col.title}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
        </ViewportPortal>
      )}

      {/* WON Conversion Dialog (Automatic project & client creation in 1-click!) */}
      {isWonModalOpen && selectedLead && (
        <div className="erp-modal-overlay" onClick={() => setIsWonModalOpen(false)}>
          <div className="erp-modal max-w-lg animate-slide-up" onClick={(event) => event.stopPropagation()}>
            <div className="erp-modal-header">
              <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-500">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/20">
                  <Trophy className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white">Marcar lead como ganho</h3>
                  <p className="text-xs text-slate-500">Automatize a criação de registros comerciais integrados.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWonModalOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmWon} className="flex min-h-0 flex-1 flex-col">
              <div className="erp-modal-body">
                <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-xl">
                  <input
                    type="checkbox"
                    id="createProjectCheck"
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    checked={wonForm.createProject}
                    onChange={(e) => setWonForm({ ...wonForm, createProject: e.target.checked })}
                  />
                  <label htmlFor="createProjectCheck" className="text-xs font-bold text-emerald-800 dark:text-emerald-300 cursor-pointer">
                    Criar automaticamente cliente e projeto associado
                  </label>
                </div>

                {wonForm.createProject && (
                  <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div>
                      <label className="erp-label">Nome do Projeto</label>
                      <input
                        type="text"
                        className="erp-input"
                        value={wonForm.projectName}
                        onChange={(e) => setWonForm({ ...wonForm, projectName: e.target.value })}
                        required={wonForm.createProject}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="erp-label">Valor Estimado (R$)</label>
                        <input
                          type="number"
                          className="erp-input font-mono"
                          value={wonForm.contractValue}
                          onChange={(e) => setWonForm({ ...wonForm, contractValue: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <label className="erp-label">Data Início</label>
                        <input
                          type="date"
                          className="erp-input"
                          value={wonForm.startDate}
                          onChange={(e) => setWonForm({ ...wonForm, startDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="erp-label">Data Conclusão</label>
                        <input
                          type="date"
                          className="erp-input"
                          value={wonForm.endDate}
                          onChange={(e) => setWonForm({ ...wonForm, endDate: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="erp-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsWonModalOpen(false)}
                  className="erp-secondary-action"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="erp-success-action"
                >
                  <CheckCircle size={15} />
                  {isSubmitting ? 'Convertendo...' : 'Confirmar Fechamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Integrated Create Lead Modal */}
      {isCreateModalOpen && (
        <div className="erp-modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div className="erp-modal max-w-md animate-slide-up" onClick={(event) => event.stopPropagation()}>
            <div className="erp-modal-header">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Sparkles className="text-brand-500" size={20} />
                Cadastrar Novo Lead Comercial
              </h3>
              <button type="button" onClick={() => setIsCreateModalOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="flex min-h-0 flex-1 flex-col">
              <div className="erp-modal-body">
              <div>
                <label className="erp-label">Nome do Lead *</label>
                <input
                  type="text"
                  placeholder="Ex: João Silva"
                  className="erp-input"
                  value={leadForm.name}
                  onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="erp-label">Empresa / Negócio *</label>
                <input
                  type="text"
                  placeholder="Ex: Acme Corp"
                  className="erp-input"
                  value={leadForm.company}
                  onChange={(e) => setLeadForm({ ...leadForm, company: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="erp-label">E-mail</label>
                  <input
                    type="email"
                    placeholder="joao@empresa.com"
                    className="erp-input"
                    value={leadForm.email}
                    onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="erp-label">Telefone</label>
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    className="erp-input"
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="erp-label">Valor Estimado (BRL)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  className="erp-input font-mono"
                  value={leadForm.value || ''}
                  onChange={(e) => setLeadForm({ ...leadForm, value: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="erp-label">Notas Iniciais</label>
                <textarea
                  placeholder="Detalhes adicionais..."
                  className="erp-input min-h-[80px]"
                  value={leadForm.notes}
                  onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                />
              </div>
              </div>

              <div className="erp-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="erp-secondary-action"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="erp-primary-action"
                >
                  {isSubmitting ? 'Criando...' : 'Cadastrar Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Integrated Add Proposal Modal inside lead panel */}
      {isProposalModalOpen && selectedLead && (
        <div className="erp-modal-overlay" onClick={() => setIsProposalModalOpen(false)}>
          <div className="erp-modal max-w-md animate-slide-up" onClick={(event) => event.stopPropagation()}>
            <div className="erp-modal-header">
              <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <FileText className="text-amber-500" size={18} />
                Lançar Proposta para {selectedLead.company}
              </h3>
              <button type="button" onClick={() => setIsProposalModalOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateProposal} className="flex min-h-0 flex-1 flex-col">
              <div className="erp-modal-body">
              <div>
                <label className="erp-label">Título da Proposta *</label>
                <input
                  type="text"
                  placeholder="Ex: Proposta de Desenvolvimento Web"
                  className="erp-input"
                  value={proposalForm.title}
                  onChange={(e) => setProposalForm({ ...proposalForm, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="erp-label">Valor Estimado (R$) *</label>
                <input
                  type="number"
                  placeholder="0.00"
                  className="erp-input font-mono"
                  value={proposalForm.value || ''}
                  onChange={(e) => setProposalForm({ ...proposalForm, value: Number(e.target.value) })}
                  required
                />
              </div>

              <div>
                <label className="erp-label">Escopo & Descrição</label>
                <textarea
                  placeholder="Descreva o escopo e termos da proposta..."
                  className="erp-input min-h-[90px]"
                  value={proposalForm.description}
                  onChange={(e) => setProposalForm({ ...proposalForm, description: e.target.value })}
                />
              </div>
              </div>

              <div className="erp-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsProposalModalOpen(false)}
                  className="erp-secondary-action"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Criando...' : 'Lançar Proposta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// Sub-Component for Lead Cards with Micro-interactions and Arrow Controls
function LeadCard({
  lead,
  onSelect,
  onMoveLeft,
  onMoveRight,
  formatBRL,
  isFirst,
  isLast,
}: {
  lead: Lead;
  onSelect: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  formatBRL: (v: number) => string;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="erp-card relative group overflow-hidden p-4">
      
      {/* Visual top bar based on status */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${
        lead.status === 'NEW' ? 'bg-sky-500' :
        lead.status === 'QUALIFIED' ? 'bg-indigo-500' :
        lead.status === 'PROPOSAL' ? 'bg-amber-500' :
        lead.status === 'WON' ? 'bg-emerald-500' : 'bg-rose-500'
      }`} />

      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-start justify-between gap-2">
          <button
            onClick={onSelect}
            className="text-left font-bold text-slate-800 dark:text-white hover:text-brand-500 text-sm transition-colors line-clamp-1 flex-1 font-display"
          >
            {lead.name}
          </button>
          <span className="text-[10px] text-slate-400 font-medium">#{lead.id}</span>
        </div>

        <div className="flex flex-col gap-1 text-[11px] text-slate-500">
          <span className="font-semibold text-slate-700 dark:text-slate-300 line-clamp-1">{lead.company}</span>
          {lead.email && (
            <span className="flex items-center gap-1">
              <Mail size={12} className="opacity-70" />
              {lead.email}
            </span>
          )}
          {lead.phone && (
            <span className="flex items-center gap-1">
              <Phone size={12} className="opacity-70" />
              {lead.phone}
            </span>
          )}
        </div>

        <hr className="border-slate-100 dark:border-white/5 my-1" />

        <div className="flex items-center justify-between mt-1">
          <div className="font-bold text-xs text-brand-600 dark:text-orange-400 font-mono">
            {lead.value ? formatBRL(lead.value) : 'R$ 0,00'}
          </div>

          {/* Quick-Shift Columns Buttons and actions */}
          <div className="flex items-center gap-1.5">
            {!isFirst && (
              <button
                onClick={(e) => { e.stopPropagation(); onMoveLeft(); }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-brand-100 hover:text-brand-600 dark:bg-slate-800 dark:hover:bg-brand-950/20"
                title="Voltar Etapa"
              >
                <ChevronLeft size={13} />
              </button>
            )}
            
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(); }}
              className="inline-flex min-h-7 items-center rounded-lg bg-brand-50 px-2 text-[10px] font-bold uppercase tracking-wider text-brand-600 transition-colors hover:bg-brand-500 hover:text-white dark:bg-brand-950/30 dark:text-brand-400"
            >
              Editar
            </button>

            {!isLast && (
              <button
                onClick={(e) => { e.stopPropagation(); onMoveRight(); }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-brand-100 hover:text-brand-600 dark:bg-slate-800 dark:hover:bg-brand-950/20"
                title="Avançar Etapa"
              >
                <ChevronRight size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
