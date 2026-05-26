import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { companyApi } from '../api/client';

export default function Settings() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['company-settings'], queryFn: companyApi.get });
  const [formData, setFormData] = useState({ companyName: '', companyObjective: '', companyLogoUrl: '' });
  const [saved, setSaved] = useState(false);

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
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Configuração da Empresa</h1>
        <p className="text-gray-500">Personalize o nome, objetivo e logo usados pelo gestor.</p>
      </div>

      <form
        onSubmit={(event) => { event.preventDefault(); mutation.mutate(formData); }}
        className="bg-white rounded-xl shadow-sm border p-6 space-y-5"
      >
        {mutation.error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-3 text-sm">{(mutation.error as Error).message}</div>}
        {saved && <div className="bg-blue-50 text-blue-700 border border-blue-200 rounded-lg p-3 text-sm">Configuração salva.</div>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome da empresa</label>
          <input
            value={formData.companyName}
            onChange={(event) => setFormData({ ...formData, companyName: event.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
            maxLength={80}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Objetivo do gestor</label>
          <textarea
            value={formData.companyObjective}
            onChange={(event) => setFormData({ ...formData, companyObjective: event.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
            rows={4}
            maxLength={500}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
          <input
            type="url"
            value={formData.companyLogoUrl}
            onChange={(event) => setFormData({ ...formData, companyLogoUrl: event.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="https://..."
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2">
          <button disabled={mutation.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {mutation.isPending ? 'Salvando...' : 'Salvar alterações'}
          </button>
          {formData.companyLogoUrl && <img src={formData.companyLogoUrl} alt="Prévia" className="w-12 h-12 object-contain rounded-lg border bg-gray-50" />}
        </div>
      </form>
    </div>
  );
}
