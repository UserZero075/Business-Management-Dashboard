import { useQuery } from '@tanstack/react-query';
import { dashboardApi, financeApi } from '../api/client';
import { TrendingUp, TrendingDown, Server, Users, AlertTriangle, CheckCircle, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useCompany } from '../hooks/useCompany';
import { statusLabel } from '../utils/labels';

export default function Dashboard() {
  const { companyName } = useCompany();
  const { data: overview } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: dashboardApi.getOverview,
  });

  const { data: alerts } = useQuery({
    queryKey: ['dashboard-alerts'],
    queryFn: dashboardApi.getAlerts,
  });

  const { data: projectsOverview } = useQuery({
    queryKey: ['projects-overview'],
    queryFn: dashboardApi.getProjectsOverview,
  });

  const { data: rates } = useQuery({
    queryKey: ['latest-rates'],
    queryFn: financeApi.getLatestRates,
  });

  const { data: chartData } = useQuery({
    queryKey: ['income-expense-chart'],
    queryFn: () => dashboardApi.getIncomeExpenseChart(6),
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'CUP' }).format(value);
  };

  const alertClass = (type: string) => {
    if (type === 'error') return 'bg-red-50 border-red-200 text-red-700';
    if (type === 'info') return 'bg-blue-50 border-blue-200 text-blue-700';
    return 'bg-amber-50 border-amber-200 text-amber-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <div className="text-sm text-gray-500">
          Gestão {companyName}
        </div>
      </div>

      {alerts && alerts.length > 0 && (
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3 text-gray-800">
            <AlertTriangle className="text-amber-500" size={20} />
            <span className="font-semibold">Alertas</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {alerts.map((alert: any, i: number) => (
              <div key={i} className={`text-sm border rounded-lg p-3 ${alertClass(alert.type)}`}>
                <p className="font-medium">{alert.title}</p>
                <p>{alert.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Receitas Totais</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(overview?.finances?.totalIncome || 0)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Despesas Totais</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(overview?.finances?.totalExpense || 0)}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingDown className="text-red-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Resultado Líquido</p>
              <p className={`text-2xl font-bold ${(overview?.finances?.profit || 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatCurrency(overview?.finances?.profit || 0)}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <DollarSign className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Projetos Ativos</p>
              <p className="text-2xl font-bold text-gray-800">
                {overview?.overview?.activeProjects || 0} / {overview?.overview?.totalProjects || 0}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <CheckCircle className="text-purple-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Usuários Totais</p>
              <p className="text-2xl font-bold text-gray-800">{overview?.users?.total || 0}</p>
              <p className="text-xs text-gray-500 mt-1">
                {overview?.users?.active || 0} ativos · {overview?.users?.paid || 0} pagantes
              </p>
              <p className="text-xs text-gray-500">
                {overview?.users?.referral || 0} indicados · {overview?.users?.free || 0} gratuitos · {overview?.users?.collaboration || 0} colab.
              </p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-lg">
              <Users className="text-indigo-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Servidores</p>
              <p className="text-2xl font-bold text-gray-800">{overview?.overview?.totalServers || 0}</p>
            </div>
            <div className="p-3 bg-cyan-100 rounded-lg">
              <Server className="text-cyan-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Este Mês</p>
              <p className={`text-2xl font-bold ${(overview?.finances?.monthProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(overview?.finances?.monthProfit || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Bugs Abertos</p>
              <p className="text-2xl font-bold text-orange-600">{overview?.work?.openBugs || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h3 className="text-lg font-semibold mb-4">Receitas vs Despesas</h3>
          {chartData && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: any) => formatCurrency(Number(value) || 0)} />
                <Bar dataKey="income" fill="#22c55e" name="Receitas" />
                <Bar dataKey="expense" fill="#ef4444" name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-8">Não há dados disponíveis</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border">
          <h3 className="text-lg font-semibold mb-4">Taxas de Câmbio (CUP)</h3>
          <div className="space-y-3">
            {rates ? (
              Object.entries(rates).map(([code, data]: [string, any]) => (
                <div key={code} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium">{code}</span>
                    <span className="text-xs text-gray-500 ml-2">({data.source})</span>
                  </div>
                  <span className="font-bold text-lg">{data.rate?.toFixed(2)}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">Carregando taxas...</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border">
        <h3 className="text-lg font-semibold mb-4">Resumo de Projetos</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Projeto</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Estado</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Receitas</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Despesas</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Resultado</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Usuários</th>
              </tr>
            </thead>
            <tbody>
              {projectsOverview?.map((project: any) => (
                <tr key={project.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{project.name}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      project.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                      project.status === 'RENTABLE' ? 'bg-blue-100 text-blue-700' :
                      project.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {statusLabel(project.status)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-green-600">{formatCurrency(project.income)}</td>
                  <td className="py-3 px-4 text-right text-red-600">{formatCurrency(project.expense)}</td>
                  <td className={`py-3 px-4 text-right font-medium ${project.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(project.profit)}
                  </td>
                  <td className="py-3 px-4 text-right">{project.users?.active || 0} / {project.users?.total || 0}</td>
                </tr>
              ))}
              {(!projectsOverview || projectsOverview.length === 0) && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    Não há projetos registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
