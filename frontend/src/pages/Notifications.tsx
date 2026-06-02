import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { activityApi } from '../api/client';
import { Bell, Bug, CheckSquare, FileText, LogIn, Pencil, Server, ShieldCheck, Users, WalletCards } from 'lucide-react';

const iconByAction: Record<string, any> = {
  'auth.login': LogIn,
  'task.create': CheckSquare,
  'task.update': Pencil,
  'bug.create': Bug,
  'bug.update': Pencil,
  'vps.create': Server,
  'finance.transaction.create': WalletCards,
  'finance.transaction.update': WalletCards,
  'lead.status_update': Users,
  'proposal.status_update': FileText,
};

function getTone(action: string) {
  if (action.startsWith('bug')) return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300';
  if (action.startsWith('task')) return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300';
  if (action.startsWith('finance')) return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300';
  if (action.startsWith('auth')) return 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300';
  return 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-900/40 dark:bg-brand-950/20 dark:text-brand-300';
}

export default function Notifications() {
  const { data: logs = [], isLoading } = useQuery<any[]>({ queryKey: ['activity'], queryFn: activityApi.getAll });

  const stats = useMemo(() => ({
    total: logs.length,
    finance: logs.filter((log) => String(log.action).startsWith('finance')).length,
    tasks: logs.filter((log) => String(log.action).startsWith('task') || String(log.action).startsWith('bug')).length,
  }), [logs]);

  return (
    <div className="erp-module">
      <div className="erp-module-header">
        <div>
          <h1 className="erp-module-title">
            <Bell className="text-brand-500" size={26} />
            Notificações
          </h1>
          <p className="erp-module-subtitle">Atividade recente do ERP: logins, alterações, tarefas, bugs, finanças e infraestrutura.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="erp-stat-card">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-brand-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Eventos</span>
            <span className="rounded-lg bg-brand-50 p-2 text-brand-600 dark:bg-brand-950/20"><ShieldCheck size={20} /></span>
          </div>
          <h3 className="mt-4 font-mono text-2xl font-extrabold text-slate-800 dark:text-white">{stats.total}</h3>
          <p className="mt-1 text-[11px] text-slate-400">Total carregado no histórico</p>
        </div>
        <div className="erp-stat-card">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-emerald-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Financeiro</span>
            <span className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/20"><WalletCards size={20} /></span>
          </div>
          <h3 className="mt-4 font-mono text-2xl font-extrabold text-slate-800 dark:text-white">{stats.finance}</h3>
          <p className="mt-1 text-[11px] text-slate-400">Eventos de receitas e despesas</p>
        </div>
        <div className="erp-stat-card">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-sky-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Operação</span>
            <span className="rounded-lg bg-sky-50 p-2 text-sky-600 dark:bg-sky-950/20"><CheckSquare size={20} /></span>
          </div>
          <h3 className="mt-4 font-mono text-2xl font-extrabold text-slate-800 dark:text-white">{stats.tasks}</h3>
          <p className="mt-1 text-[11px] text-slate-400">Tarefas e bugs registrados</p>
        </div>
      </div>

      <div className="erp-panel p-0">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">Linha do Tempo</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Últimos eventos registrados no sistema.</p>
        </div>

        {isLoading && <p className="p-6 text-sm text-slate-500">Carregando atividade...</p>}
        {!isLoading && logs.length === 0 && <p className="p-6 text-sm text-slate-500">Ainda não há atividade registrada.</p>}

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {logs.map((log: any) => {
            const Icon = iconByAction[log.action] || Bell;
            return (
              <div key={log.id} className="flex gap-4 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/60">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${getTone(log.action)}`}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{log.message}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {log.user?.name || 'Sistema'} · {new Date(log.createdAt).toLocaleString('pt-BR')}
                  </p>
                  {log.metadata && (
                    <pre className="mt-2 max-h-28 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                      {typeof log.metadata === 'string' ? log.metadata : JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
