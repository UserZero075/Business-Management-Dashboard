import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeApi, projectApi, dashboardApi } from '../api/client';
import { Plus, Trash2, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

export default function Finances() {
  const [showModal, setShowModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [formData, setFormData] = useState({
    projectId: null as number | null,
    type: 'INCOME',
    amount: 0,
    currency: 'USD',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [rateForm, setRateForm] = useState({ code: 'USD', rate: 0 });

  const queryClient = useQueryClient();

  const { data: transactions } = useQuery({ queryKey: ['transactions'], queryFn: () => financeApi.getTransactions() });
  const { data: summary } = useQuery({ queryKey: ['finance-summary'], queryFn: () => financeApi.getSummary() });
  const { data: rates } = useQuery({ queryKey: ['rates'], queryFn: financeApi.getRates });
  const { data: impact } = useQuery({ queryKey: ['impact'], queryFn: financeApi.getImpact });
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: projectApi.getAll });

  const createMutation = useMutation({
    mutationFn: financeApi.createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
      setShowModal(false);
      setFormData({ projectId: null, type: 'INCOME', amount: 0, currency: 'USD', description: '', date: new Date().toISOString().split('T')[0] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: financeApi.deleteTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] });
    },
  });

  const createRateMutation = useMutation({
    mutationFn: financeApi.createRate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rates'] });
      setShowRateModal(false);
      setRateForm({ code: 'USD', rate: 0 });
    },
  });

  const fetchRatesMutation = useMutation({
    mutationFn: dashboardApi.fetchExchangeRates,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rates'] }),
  });

  const formatCurrency = (amount: number, currency: string = 'CUP') => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(amount);
  };

  const totalIncome = summary?.totalIncome || 0;
  const totalExpense = summary?.totalExpense || 0;
  const profit = totalIncome - totalExpense;
  const margin = totalIncome > 0 ? ((profit / totalIncome) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Finanças</h1>
        <div className="flex gap-2">
          <button onClick={() => fetchRatesMutation.mutate()} disabled={fetchRatesMutation.isPending} className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
            <RefreshCw size={18} className={fetchRatesMutation.isPending ? 'animate-spin' : ''} />
            Atualizar Taxas
          </button>
          <button onClick={() => setShowRateModal(true)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            Adicionar Taxa
          </button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
            <Plus size={20} />
            Nova Transação
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <TrendingUp className="text-green-600" size={18} />
            Receitas Totais
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <TrendingDown className="text-red-600" size={18} />
            Despesas Totais
          </div>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpense)}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">Resultado Líquido</div>
          <p className={`text-2xl font-bold ${profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(profit)}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">Margem</div>
          <p className={`text-2xl font-bold ${Number(margin) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{margin}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">Taxas de Câmbio (CUP)</h3>
          <div className="space-y-3">
            {rates?.map((rate: any) => (
              <div key={rate.code} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-medium">{rate.code}</span>
                  <span className="text-xs text-gray-500 ml-2">({rate.name})</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-lg">{rate.latestRate?.rate?.toFixed(2) || '—'}</span>
                  <p className="text-xs text-gray-500">{rate.latestRate?.source}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">Impacto por Moeda (Esta Semana)</h3>
          <div className="space-y-3">
            {impact?.map((curr: any) => (
              <div key={curr.currency} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-medium">{curr.currency}</span>
                  <p className="text-xs text-gray-500">{curr.currentRate} vs {curr.weekAgoRate}</p>
                </div>
                <div className={`text-right ${Number(curr.changePercent) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <span className="font-bold">{curr.changePercent}%</span>
                  <p className="text-xs">{formatCurrency(curr.cupImpact)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">Transações</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Data</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Projeto</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Tipo</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Valor</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">CUP</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Descrição</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {transactions?.map((t: any) => (
                <tr key={t.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm">{new Date(t.date).toLocaleDateString('pt-BR')}</td>
                  <td className="py-3 px-4 text-sm">{t.project?.name || '—'}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.type === 'INCOME' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {t.type === 'INCOME' ? 'Receita' : 'Despesa'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-medium">{t.amount} {t.currency}</td>
                  <td className="py-3 px-4 text-right">{t.amountCup?.toFixed(2) || '—'}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{t.description || '—'}</td>
                  <td className="py-3 px-4">
                    <button onClick={() => deleteMutation.mutate(t.id)} className="p-1 text-gray-400 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {(!transactions || transactions.length === 0) && (
                <tr><td colSpan={7} className="py-8 text-center text-gray-500">Não há transações</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Nova Transação</h2>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Projeto</label>
                <select value={formData.projectId || ''} onChange={(e) => setFormData({ ...formData, projectId: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">Sem projeto</option>
                  {projects?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                    <option value="INCOME">Receita</option>
                    <option value="EXPENSE">Despesa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Moeda</label>
                  <select value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="CUP">CUP</option>
                    <option value="USDT">USDT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
                  <input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                  <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-3 py-2 border rounded-lg" required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={createMutation.isPending} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {createMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6">
            <h2 className="text-xl font-bold mb-4">Adicionar Taxa de Câmbio</h2>
            <form onSubmit={(e) => { e.preventDefault(); createRateMutation.mutate(rateForm); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Moeda</label>
                <select value={rateForm.code} onChange={(e) => setRateForm({ ...rateForm, code: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="USDT">USDT</option>
                  <option value="MLC">MLC</option>
                  <option value="CUP">CUP</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Taxa (para CUP)</label>
                <input type="number" step="0.01" value={rateForm.rate} onChange={(e) => setRateForm({ ...rateForm, rate: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-lg" required />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowRateModal(false)} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
