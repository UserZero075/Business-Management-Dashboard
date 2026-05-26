import { useQuery } from '@tanstack/react-query';
import { dashboardApi, financeApi } from '../api/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { statusLabel } from '../utils/labels';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Reports() {
  const { data: projectPerformance } = useQuery({ queryKey: ['project-performance'], queryFn: dashboardApi.getProjectPerformance });
  const { data: chartData } = useQuery({ queryKey: ['income-expense-chart-12'], queryFn: () => dashboardApi.getIncomeExpenseChart(12) });
  const { data: summary } = useQuery({ queryKey: ['finance-summary'], queryFn: () => financeApi.getSummary() });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'CUP', maximumFractionDigits: 0 }).format(value);
  };

  const pieData = projectPerformance?.slice(0, 5).map((p: any) => ({
    name: p.name,
    value: p.profit,
  })) || [];

  const topProjects = [...(projectPerformance || [])]
    .sort((a: any, b: any) => b.profit - a.profit)
    .slice(0, 5);

  const worstProjects = [...(projectPerformance || [])]
    .sort((a: any, b: any) => a.profit - b.profit)
    .slice(0, 5)
    .filter((p: any) => p.profit < 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Relatórios</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">Receitas e Despesas (12 meses)</h3>
          {chartData && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: any) => formatCurrency(Number(value) || 0)} />
                <Bar dataKey="income" fill="#22c55e" name="Receitas" />
                <Bar dataKey="expense" fill="#ef4444" name="Despesas" />
                <Bar dataKey="profit" fill="#3b82f6" name="Resultado" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-8 text-gray-500">Não há dados disponíveis</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">Distribuição de Resultados por Projeto</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  label={({ name, percent }: any) => `${name || ''} (${((percent || 0) * 100).toFixed(0)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatCurrency(Number(value) || 0)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-8 text-gray-500">Não há dados disponíveis</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4 text-green-700">Top 5 Projetos Rentáveis</h3>
          {topProjects.length > 0 ? (
            <div className="space-y-3">
              {topProjects.map((p: any, i: number) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm">{i + 1}</span>
                    <span className="font-medium">{p.name}</span>
                  </div>
                  <span className="font-bold text-green-700">{formatCurrency(p.profit)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-4 text-gray-500">Não há dados disponíveis</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4 text-red-700">Projetos no Prejuízo</h3>
          {worstProjects.length > 0 ? (
            <div className="space-y-3">
              {worstProjects.map((p: any, i: number) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-sm">{i + 1}</span>
                    <span className="font-medium">{p.name}</span>
                  </div>
                  <span className="font-bold text-red-700">{formatCurrency(p.profit)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">Nenhum projeto no prejuízo</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">Resumo Financeiro Geral</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">Receitas Totais</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(summary?.totalIncome || 0)}</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-gray-600">Despesas Totais</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(summary?.totalExpense || 0)}</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600">Resultado Líquido</p>
            <p className={`text-xl font-bold ${(summary?.profit || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(summary?.profit || 0)}
            </p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-sm text-gray-600">Margem</p>
            <p className="text-xl font-bold text-purple-600">{summary?.margin || 0}%</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">Comparativo de Projetos</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Projeto</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Estado</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Receitas</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Despesas</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Resultado</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Margem</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Usuários</th>
              </tr>
            </thead>
            <tbody>
              {projectPerformance?.map((p: any) => (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{p.name}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      p.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                      p.status === 'RENTABLE' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100'
                    }`}>
                      {statusLabel(p.status)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-green-600">{formatCurrency(p.income)}</td>
                  <td className="py-3 px-4 text-right text-red-600">{formatCurrency(p.expense)}</td>
                  <td className={`py-3 px-4 text-right font-medium ${p.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(p.profit)}
                  </td>
                  <td className="py-3 px-4 text-right">{p.margin}%</td>
                  <td className="py-3 px-4 text-right">{p.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
