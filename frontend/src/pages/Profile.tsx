import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Avatar, USER_COLORS } from '../utils/userVisuals';
import { Save } from 'lucide-react';

export default function Profile() {
  const { user, updateProfile } = useAuth();
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
  const [saved, setSaved] = useState(false);

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
    setSaved(false);
    await updateProfile(form);
    setSaving(false);
    setSaved(true);
  };

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Meu Perfil</h1>
        <p className="text-gray-500">Esta informação aparece em Equipe e Chat.</p>
      </div>

      <form onSubmit={submit} className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Avatar user={{ ...user, ...form }} size={72} />
          <div>
            <p className="font-semibold text-gray-800">Prévia</p>
            <p className="text-sm text-gray-500">Cor e foto usadas no chat, na equipe e na barra lateral.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Nome" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
          <Field label="URL da foto de perfil" value={form.avatar} onChange={(value) => setForm({ ...form, avatar: value })} placeholder="https://..." />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Cor do usuário</label>
          <div className="flex flex-wrap gap-2">
            {USER_COLORS.map((color: string) => (
              <button
                key={color}
                type="button"
                onClick={() => setForm({ ...form, color })}
                className={`w-9 h-9 rounded-full border-2 ${form.color === color ? 'border-slate-900 scale-110' : 'border-white'}`}
                style={{ backgroundColor: color }}
                aria-label={color}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quem é / bio</label>
          <textarea value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={4} placeholder="Ex: Cofundador, backend, DevOps, vendas..." />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="GitHub" value={form.githubUrl} onChange={(value) => setForm({ ...form, githubUrl: value })} placeholder="https://github.com/..." />
          <Field label="Facebook" value={form.facebookUrl} onChange={(value) => setForm({ ...form, facebookUrl: value })} placeholder="https://facebook.com/..." />
          <Field label="LinkedIn" value={form.linkedinUrl} onChange={(value) => setForm({ ...form, linkedinUrl: value })} placeholder="https://linkedin.com/in/..." />
          <Field label="Site pessoal" value={form.websiteUrl} onChange={(value) => setForm({ ...form, websiteUrl: value })} placeholder="https://..." />
        </div>

        <div className="flex items-center gap-3">
          <button disabled={saving} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            <Save size={18} />
            {saving ? 'Salvando...' : 'Salvar perfil'}
          </button>
          {saved && <span className="text-sm text-green-600">Perfil atualizado</span>}
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} className="w-full px-3 py-2 border rounded-lg" />
    </div>
  );
}
