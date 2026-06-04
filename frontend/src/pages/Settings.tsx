import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, companyApi, projectApi } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { Avatar, USER_COLORS } from '../utils/userVisuals';
import { roleLabel } from '../utils/labels';
import { Building2, ExternalLink, FileText, Save, Search, Settings as SettingsIcon, UserCircle, Users } from 'lucide-react';
import ProposalTypeManager from '../components/proposals/ProposalTypeManager';

type SettingsTab = 'empresa' | 'perfil' | 'equipe' | 'tipos-proposta';

const tabs: Array<{ id: SettingsTab; label: string; icon: typeof Building2 }> = [
  { id: 'empresa', label: 'Empresa', icon: Building2 },
  { id: 'perfil', label: 'Meu Perfil', icon: UserCircle },
  { id: 'equipe', label: 'Equipe', icon: Users },
  { id: 'tipos-proposta', label: 'Tipos de Proposta', icon: FileText },
];

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryTab = searchParams.get('tab') as SettingsTab | null;
  const activeTab: SettingsTab = tabs.some((tab) => tab.id === queryTab) ? queryTab! : 'empresa';

  const setActiveTab = (tab: SettingsTab) => {
    setSearchParams({ tab }, { replace: true });
  };

  return (
    <div className="erp-module">
      <div className="erp-module-header">
        <div>
          <h1 className="erp-module-title">
            <SettingsIcon className="text-brand-500" size={26} />
            Configurações
          </h1>
          <p className="erp-module-subtitle">Dados da empresa, perfil do usuário e equipe em uma única área para economizar espaço na navegação.</p>
        </div>
      </div>

      <div className="erp-panel flex gap-2 overflow-x-auto p-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
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
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'empresa' && <CompanySettings />}
      {activeTab === 'perfil' && <ProfileSettings />}
      {activeTab === 'equipe' && <TeamSettings />}
      {activeTab === 'tipos-proposta' && <div className="erp-panel"><ProposalTypeManager /></div>}
    </div>
  );
}

function CompanySettings() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { data } = useQuery({ queryKey: ['company-settings'], queryFn: companyApi.get });
  const [formData, setFormData] = useState({ companyName: '', companyObjective: '', companyLogoUrl: '' });

  useEffect(() => {
    if (!data) return;
    setFormData({
      companyName: data.companyName || '',
      companyObjective: data.companyObjective || '',
      companyLogoUrl: data.companyLogoUrl || '',
    });
  }, [data]);

  const mutation = useMutation({
    mutationFn: companyApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
      toast.success('Configuração da empresa salva.');
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao salvar configuração.'),
  });

  return (
    <form
      onSubmit={(event) => { event.preventDefault(); mutation.mutate(formData); }}
      className="erp-panel max-w-3xl space-y-5"
    >
      <div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-white">Empresa</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Nome, objetivo e logo usados no sistema.</p>
      </div>

      <div>
        <label className="erp-label">Nome da empresa *</label>
        <input
          value={formData.companyName}
          onChange={(event) => setFormData({ ...formData, companyName: event.target.value })}
          className="erp-input"
          maxLength={80}
          required
        />
      </div>

      <div>
        <label className="erp-label">Objetivo do gestor</label>
        <textarea
          value={formData.companyObjective}
          onChange={(event) => setFormData({ ...formData, companyObjective: event.target.value })}
          className="erp-input min-h-[110px]"
          maxLength={500}
        />
      </div>

      <div>
        <label className="erp-label">Logo URL</label>
        <input
          type="url"
          value={formData.companyLogoUrl}
          onChange={(event) => setFormData({ ...formData, companyLogoUrl: event.target.value })}
          className="erp-input"
          placeholder="https://..."
        />
      </div>

      <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center">
        <button disabled={mutation.isPending} className="erp-primary-action">
          <Save size={18} />
          {mutation.isPending ? 'Salvando...' : 'Salvar alterações'}
        </button>
        {formData.companyLogoUrl && <img src={formData.companyLogoUrl} alt="Prévia" className="h-12 w-12 rounded-lg border border-slate-200 bg-slate-50 object-contain p-1 dark:border-slate-800 dark:bg-slate-950" />}
      </div>
    </form>
  );
}

function ProfileSettings() {
  const { user, updateProfile } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    name: '',
    bio: '',
    avatar: '',
    color: USER_COLORS[0],
    githubUrl: '',
    facebookUrl: '',
    linkedinUrl: '',
    websiteUrl: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || '',
      bio: user.bio || '',
      avatar: user.avatar || '',
      color: user.color || USER_COLORS[Number(user.id) % USER_COLORS.length],
      githubUrl: user.githubUrl || '',
      facebookUrl: user.facebookUrl || '',
      linkedinUrl: user.linkedinUrl || '',
      websiteUrl: user.websiteUrl || '',
    });
  }, [user]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await updateProfile(form);
      toast.success('Perfil atualizado.');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar perfil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="erp-panel max-w-4xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-white">Meu Perfil</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Informações exibidas na equipe, chat e barra lateral.</p>
      </div>

      <div className="flex items-center gap-4">
        <Avatar user={{ ...user, ...form }} size={72} />
        <div>
          <p className="font-semibold text-slate-800 dark:text-white">Prévia</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Cor e foto usadas nas áreas colaborativas.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Nome" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
        <Field label="URL da foto de perfil" value={form.avatar} onChange={(value) => setForm({ ...form, avatar: value })} placeholder="https://..." />
      </div>

      <div>
        <label className="erp-label">Cor do usuário</label>
        <div className="flex flex-wrap gap-2">
          {USER_COLORS.map((color: string) => (
            <button
              key={color}
              type="button"
              onClick={() => setForm({ ...form, color })}
              className={`h-10 w-10 rounded-full border-2 transition-transform ${form.color === color ? 'border-slate-900 scale-105 dark:border-white' : 'border-white dark:border-slate-900'}`}
              style={{ backgroundColor: color }}
              aria-label={color}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="erp-label">Bio</label>
        <textarea
          value={form.bio}
          onChange={(event) => setForm({ ...form, bio: event.target.value })}
          className="erp-input min-h-[110px]"
          placeholder="Ex: Cofundador, backend, DevOps, vendas..."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="GitHub" value={form.githubUrl} onChange={(value) => setForm({ ...form, githubUrl: value })} placeholder="https://github.com/..." />
        <Field label="Facebook" value={form.facebookUrl} onChange={(value) => setForm({ ...form, facebookUrl: value })} placeholder="https://facebook.com/..." />
        <Field label="LinkedIn" value={form.linkedinUrl} onChange={(value) => setForm({ ...form, linkedinUrl: value })} placeholder="https://linkedin.com/in/..." />
        <Field label="Site pessoal" value={form.websiteUrl} onChange={(value) => setForm({ ...form, websiteUrl: value })} placeholder="https://..." />
      </div>

      <button disabled={saving} className="erp-primary-action">
        <Save size={18} />
        {saving ? 'Salvando...' : 'Salvar perfil'}
      </button>
    </form>
  );
}

function TeamSettings() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({ queryKey: ['users'], queryFn: authApi.getUsers });
  const { data: roles = [] } = useQuery({ queryKey: ['roles'], queryFn: authApi.getRoles });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectApi.getAll });

  const roleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: number; roleId: number }) => authApi.updateUserRole(userId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Papel do usuário atualizado.');
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao atualizar papel.'),
  });

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user: any) => (
      user.name?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      roleLabel(user.role?.name).toLowerCase().includes(q)
    ));
  }, [search, users]);

  const getUserProjects = (userId: number) => {
    return projects?.filter((project: any) => project.members?.some((member: any) => member.userId === userId)) || [];
  };

  return (
    <div className="space-y-5">
      <div className="erp-filter-bar">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="erp-input-with-icon"
            placeholder="Buscar membro por nome, e-mail ou papel"
          />
        </div>
      </div>

      {isLoadingUsers ? (
        <div className="erp-panel py-12 text-center text-sm text-slate-500">Carregando equipe...</div>
      ) : filteredUsers.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredUsers.map((member: any) => {
            const userProjects = getUserProjects(member.id);
            const links = [
              ['GitHub', member.githubUrl],
              ['Facebook', member.facebookUrl],
              ['LinkedIn', member.linkedinUrl],
              ['Site', member.websiteUrl],
            ].filter(([, url]) => url);

            return (
              <div key={member.id} className="erp-card">
                <div className="mb-4 flex items-start gap-4">
                  <Link to={`/users/${member.id}`} className="shrink-0">
                    <Avatar user={member} size={52} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/users/${member.id}`} className="block truncate font-semibold text-slate-800 hover:underline dark:text-white">{member.name}</Link>
                    <p className="truncate text-sm text-slate-500 dark:text-slate-400">{member.email}</p>
                    {member.bio && <p className="mt-2 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">{member.bio}</p>}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="erp-label">Papel</label>
                  <select
                    value={member.roleId || member.role?.id || ''}
                    onChange={(event) => roleMutation.mutate({ userId: member.id, roleId: Number(event.target.value) })}
                    className="erp-input"
                  >
                    {roles.map((role: any) => <option key={role.id} value={role.id}>{roleLabel(role.name)}</option>)}
                  </select>
                </div>

                {links.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {links.map(([label, url]) => (
                      <a key={label} href={url as string} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300">
                        {label}<ExternalLink size={12} />
                      </a>
                    ))}
                  </div>
                )}

                {userProjects.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Projetos</p>
                    <div className="flex flex-wrap gap-1">
                      {userProjects.map((project: any) => (
                        <span key={project.id} className="rounded-full bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
                          {project.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Sem projetos atribuídos</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="erp-empty-state py-12">
          <Users className="mx-auto mb-3 text-slate-300 dark:text-slate-700" size={42} />
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Nenhum membro encontrado</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Ajuste a busca para localizar usuários da equipe.</p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="erp-label">{label}</label>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} className="erp-input" />
    </div>
  );
}
