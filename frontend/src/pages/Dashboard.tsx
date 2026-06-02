import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/client';
import { TrendingUp, TrendingDown, Server, Users, AlertTriangle, CheckCircle, DollarSign, ListTodo, Bug } from 'lucide-react';
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

  const { data: chartData } = useQuery({
    queryKey: ['income-expense-chart'],
    queryFn: () => dashboardApi.getIncomeExpenseChart(6),
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const alertClass = (type: string) => {
    if (type === 'error') return 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300';
    if (type === 'info') return 'bg-brand-500/10 border-brand-500/20 text-brand-700 dark:text-brand-300';
    return 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300';
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white font-display tracking-tight">
            Olá, Matheus
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Aqui está o resumo operacional para a **{companyName}**.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-center px-4 py-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200/50 dark:border-white/5 shadow-sm text-xs font-semibold text-slate-600 dark:text-slate-300">
          <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
          Painel de Controle Ativo
        </div>
      </div>

      {/* Critical Alerts */}
      {alerts && alerts.length > 0 && (
        <div className="glass-card rounded-2xl p-5 border border-slate-200/40 dark:border-white/5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-slate-800 dark:text-white">
            <AlertTriangle className="text-brand-500 animate-bounce" size={18} />
            <span className="font-bold text-sm uppercase tracking-wider font-display">Alertas Operacionais</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alerts.map((alert: any, i: number) => (
              <div key={i} className={`text-xs border rounded-xl p-4 transition-all duration-300 hover:scale-[1.01] ${alertClass(alert.type)}`}>
                <p className="font-bold flex items-center gap-1.5 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  {alert.title}
                </p>
                <p className="opacity-90">{alert.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Financial Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl shadow-sm p-6 border border-slate-200/40 dark:border-white/5 relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Receitas Totais</p>
              <p className="text-2xl font-extrabold text-green-600 dark:text-green-400 mt-2 font-display">
                {formatCurrency(overview?.finances?.totalIncome || 0)}
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-green-500/10 to-emerald-500/10 group-hover:from-green-500/20 group-hover:to-emerald-500/20 rounded-2xl border border-green-500/20 text-green-600 dark:text-green-400 transition-colors">
              <TrendingUp size={22} />
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl shadow-sm p-6 border border-slate-200/40 dark:border-white/5 relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Despesas Totais</p>
              <p className="text-2xl font-extrabold text-red-600 dark:text-red-400 mt-2 font-display">
                {formatCurrency(overview?.finances?.totalExpense || 0)}
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-red-500/10 to-rose-500/10 group-hover:from-red-500/20 group-hover:to-rose-500/20 rounded-2xl border border-red-500/20 text-red-600 dark:text-red-400 transition-colors">
              <TrendingDown size={22} />
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl shadow-sm p-6 border border-slate-200/40 dark:border-white/5 relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Resultado Líquido</p>
              <p className={`text-2xl font-extrabold mt-2 font-display ${(overview?.finances?.profit || 0) >= 0 ? 'text-brand-500 dark:text-brand-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(overview?.finances?.profit || 0)}
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-brand-500/10 to-amber-500/10 group-hover:from-brand-500/20 group-hover:to-amber-500/20 rounded-2xl border border-brand-500/20 text-brand-600 dark:text-brand-400 transition-colors">
              <DollarSign size={22} />
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl shadow-sm p-6 border border-slate-200/40 dark:border-white/5 relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-1 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Projetos Ativos</p>
              <p className="text-2xl font-extrabold text-slate-800 dark:text-white mt-2 font-display">
                {overview?.overview?.activeProjects || 0} <span className="text-xs text-slate-400 font-normal">de {overview?.overview?.totalProjects || 0}</span>
              </p>
            </div>
            <div className="p-3 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 group-hover:from-purple-500/20 group-hover:to-indigo-500/20 rounded-2xl border border-purple-500/20 text-purple-600 dark:text-purple-400 transition-colors">
              <CheckCircle size={22} />
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Block */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-5 border border-slate-200/40 dark:border-white/5 transition-all duration-300 hover:shadow-md hover:scale-[1.01] flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Usuários Totais</p>
            <p className="text-xl font-extrabold text-slate-800 dark:text-white mt-1 font-display">{overview?.users?.total || 0}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium leading-relaxed">
              {overview?.users?.active || 0} ativos · {overview?.users?.paid || 0} pagantes
            </p>
          </div>
          <div className="p-2.5 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200/10 text-slate-500">
            <Users size={18} />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-slate-200/40 dark:border-white/5 transition-all duration-300 hover:shadow-md hover:scale-[1.01] flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">VPS / Servidores</p>
            <p className="text-xl font-extrabold text-slate-800 dark:text-white mt-1 font-display">{overview?.overview?.totalServers || 0}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium leading-relaxed">Infraestrutura em nuvem ativa</p>
          </div>
          <div className="p-2.5 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200/10 text-slate-500">
            <Server size={18} />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-slate-200/40 dark:border-white/5 transition-all duration-300 hover:shadow-md hover:scale-[1.01] flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Resultado Mês Atual</p>
            <p className={`text-xl font-extrabold mt-1 font-display ${(overview?.finances?.monthProfit || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {formatCurrency(overview?.finances?.monthProfit || 0)}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium leading-relaxed">Faturamento corrente</p>
          </div>
          <div className={`p-2.5 rounded-xl border text-slate-500 ${
            (overview?.finances?.monthProfit || 0) >= 0 
              ? 'bg-green-500/10 border-green-500/20 text-green-600' 
              : 'bg-red-500/10 border-red-500/20 text-red-600'
          }`}>
            <DollarSign size={18} />
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-slate-200/40 dark:border-white/5 transition-all duration-300 hover:shadow-md hover:scale-[1.01] flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Bugs em Aberto</p>
            <p className="text-xl font-extrabold text-brand-500 mt-1 font-display">{overview?.work?.openBugs || 0}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium leading-relaxed">Necessitam de atenção técnica</p>
          </div>
          <div className="p-2.5 bg-brand-500/10 rounded-xl border border-brand-500/20 text-brand-500 animate-pulse">
            <Bug size={18} />
          </div>
        </div>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recharts Glassmorphic BarChart */}
        <div className="glass-card rounded-2xl p-6 border border-slate-200/40 dark:border-white/5 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white font-display mb-6">Finanças: Receitas vs Despesas</h3>
          {chartData && chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.95}/>
                    <stop offset="100%" stopColor="#ea580c" stopOpacity={0.3}/>
                  </linearGradient>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#64748b" stopOpacity={0.95}/>
                    <stop offset="100%" stopColor="#334155" stopOpacity={0.3}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(249,115,22,0.04)" vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ 
                    background: 'rgba(15, 23, 42, 0.85)', 
                    backdropFilter: 'blur(10px)', 
                    border: '1px solid rgba(249, 115, 22, 0.15)', 
                    borderRadius: '14px', 
                    color: '#fff',
                    fontSize: '11px',
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)'
                  }} 
                  formatter={(value: any) => [formatCurrency(Number(value) || 0), '']}
                />
                <Bar dataKey="income" fill="url(#incomeGradient)" radius={[6, 6, 0, 0]} name="Receitas" />
                <Bar dataKey="expense" fill="url(#expenseGradient)" radius={[6, 6, 0, 0]} name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <DollarSign size={36} className="opacity-30 mb-2 animate-bounce" />
              <p className="text-xs font-semibold uppercase tracking-wider">Sem dados de movimentações cadastrados</p>
            </div>
          )}
        </div>

        {/* Productivity Grid */}
        <div className="glass-card rounded-2xl p-6 border border-slate-200/40 dark:border-white/5 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white font-display mb-6">Produtividade Integrada</h3>
          <div className="grid grid-cols-2 gap-4 flex-1">
            <div className="flex flex-col justify-center items-center p-4 bg-slate-100/40 dark:bg-white/5 border border-slate-200/10 dark:border-white/5 rounded-2xl hover:scale-[1.03] transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500 mb-2 group-hover:scale-110 transition-transform">
                <ListTodo size={20} />
              </div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500">Tarefas Pendentes</p>
              <p className="text-3xl font-extrabold text-slate-800 dark:text-white mt-1 font-display">{overview?.work?.pendingTasks || 0}</p>
            </div>

            <div className="flex flex-col justify-center items-center p-4 bg-slate-100/40 dark:bg-white/5 border border-slate-200/10 dark:border-white/5 rounded-2xl hover:scale-[1.03] transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 mb-2 group-hover:scale-110 transition-transform">
                <Bug size={20} />
              </div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500">Bugs Reportados</p>
              <p className="text-3xl font-extrabold text-red-500 mt-1 font-display">{overview?.work?.openBugs || 0}</p>
            </div>

            <div className="flex flex-col justify-center items-center p-4 bg-slate-100/40 dark:bg-white/5 border border-slate-200/10 dark:border-white/5 rounded-2xl hover:scale-[1.03] transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500 mb-2 group-hover:scale-110 transition-transform">
                <CheckCircle size={20} />
              </div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500">Projetos Ativos</p>
              <p className="text-3xl font-extrabold text-green-500 mt-1 font-display">{overview?.overview?.activeProjects || 0}</p>
            </div>

            <div className="flex flex-col justify-center items-center p-4 bg-slate-100/40 dark:bg-white/5 border border-slate-200/10 dark:border-white/5 rounded-2xl hover:scale-[1.03] transition-all duration-300 group">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 mb-2 group-hover:scale-110 transition-transform">
                <Users size={20} />
              </div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500">Membros da Equipe</p>
              <p className="text-3xl font-extrabold text-purple-500 mt-1 font-display">{overview?.users?.total || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Overview Table Card */}
      <div className="glass-card rounded-2xl border border-slate-200/40 dark:border-white/5 shadow-sm overflow-hidden p-6">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white font-display mb-6">Resumo e Performance de Projetos</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200/50 dark:border-white/5 text-left text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-4 px-4 font-bold">Projeto</th>
                <th className="py-4 px-4 font-bold">Estado</th>
                <th className="py-4 px-4 font-bold text-right">Receitas</th>
                <th className="py-4 px-4 font-bold text-right">Despesas</th>
                <th className="py-4 px-4 font-bold text-right">Resultado</th>
                <th className="py-4 px-4 font-bold text-right">Usuários Ativos / Totais</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/30 dark:divide-white/5">
              {projectsOverview?.map((project: any) => (
                <tr key={project.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                  <td className="py-4 px-4 font-semibold text-slate-800 dark:text-white group-hover:text-brand-500 dark:group-hover:text-brand-500 transition-colors">
                    {project.name}
                  </td>
                  <td className="py-4 px-4">
                    <span className={`px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider inline-block ${
                      project.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' :
                      project.status === 'RENTABLE' ? 'bg-brand-500/10 text-brand-500 border border-brand-500/20' :
                      project.status === 'PAUSED' ? 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20' :
                      'bg-slate-500/10 text-slate-600 border border-slate-500/20'
                    }`}>
                      {statusLabel(project.status)}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right text-green-600 dark:text-green-400 font-semibold">{formatCurrency(project.income)}</td>
                  <td className="py-4 px-4 text-right text-slate-500 font-semibold">{formatCurrency(project.expense)}</td>
                  <td className={`py-4 px-4 text-right font-bold ${project.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                    {formatCurrency(project.profit)}
                  </td>
                  <td className="py-4 px-4 text-right font-medium text-slate-600 dark:text-slate-400">
                    {project.users?.active || 0} <span className="text-[10px] text-slate-400">/ {project.users?.total || 0}</span>
                  </td>
                </tr>
              ))}
              {(!projectsOverview || projectsOverview.length === 0) && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    <DollarSign size={24} className="mx-auto mb-2 opacity-30 animate-pulse" />
                    Nenhum projeto registrado no sistema.
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
