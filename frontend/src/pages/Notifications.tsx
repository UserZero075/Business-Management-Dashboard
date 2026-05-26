import { useQuery } from '@tanstack/react-query';
import { activityApi } from '../api/client';
import { Bell, LogIn, Pencil, Server, Bug, CheckSquare } from 'lucide-react';

const iconByAction: Record<string, any> = {
  'auth.login': LogIn,
  'task.create': CheckSquare,
  'task.update': Pencil,
  'bug.create': Bug,
  'bug.update': Pencil,
  'vps.create': Server,
};

export default function Notifications() {
  const { data: logs, isLoading } = useQuery({ queryKey: ['activity'], queryFn: activityApi.getAll });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Notificações</h1>
        <p className="text-gray-500">Atividade recente: logins, alterações, tarefas, bugs e infraestrutura.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border divide-y">
        {isLoading && <p className="p-6 text-gray-500">Carregando atividade...</p>}
        {logs?.map((log: any) => {
          const Icon = iconByAction[log.action] || Bell;
          return (
            <div key={log.id} className="p-4 flex gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800">{log.message}</p>
                <p className="text-sm text-gray-500">
                  {log.user?.name || 'Sistema'} · {new Date(log.createdAt).toLocaleString('pt-BR')}
                </p>
                {log.metadata && <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">{log.metadata}</pre>}
              </div>
            </div>
          );
        })}
        {(!logs || logs.length === 0) && !isLoading && <p className="p-6 text-gray-500">Ainda não há atividade registrada.</p>}
      </div>
    </div>
  );
}
