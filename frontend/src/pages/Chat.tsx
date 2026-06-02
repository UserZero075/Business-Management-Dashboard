import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, chatApi, WS_URL } from '../api/client';
import { Hash, Lock, MessageCircle, Send, UserPlus, Wifi, WifiOff } from 'lucide-react';
import { useCompany } from '../hooks/useCompany';
import { Avatar, getUserColor } from '../utils/userVisuals';

export default function Chat() {
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [privateUserId, setPrivateUserId] = useState('');
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const { companyName } = useCompany();

  const { data: channels = [] } = useQuery<any[]>({ queryKey: ['chat-channels'], queryFn: chatApi.getChannels });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ['users'], queryFn: authApi.getUsers });
  const { data: messages = [] } = useQuery<any[]>({
    queryKey: ['chat-messages', activeChannelId],
    queryFn: () => chatApi.getMessages(activeChannelId!),
    enabled: !!activeChannelId,
  });

  useEffect(() => {
    if (!activeChannelId && channels.length) setActiveChannelId(channels[0].id);
  }, [channels, activeChannelId]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = new WebSocket(`${WS_URL}/api/chat/ws?token=${encodeURIComponent(token)}`);
    socketRef.current = socket;
    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type !== 'new_message') return;

      queryClient.setQueryData(['chat-messages', payload.channelId], (current: any) => {
        const list = Array.isArray(current) ? current : [];
        if (list.some((item: any) => item.id === payload.message.id)) return list;
        return [...list, payload.message];
      });
      queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
    };

    return () => socket.close();
  }, [queryClient]);

  const fallbackSendMutation = useMutation({
    mutationFn: () => chatApi.sendMessage(activeChannelId!, message),
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['chat-messages', activeChannelId] });
      queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
    },
  });

  const privateMutation = useMutation({
    mutationFn: () => chatApi.createPrivate(Number(privateUserId)),
    onSuccess: (channel: any) => {
      setPrivateUserId('');
      queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
      setActiveChannelId(channel.id);
    },
  });

  const sendMessage = () => {
    if (!activeChannelId || !message.trim()) return;
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'message', channelId: activeChannelId, content: message.trim() }));
      setMessage('');
      return;
    }
    fallbackSendMutation.mutate();
  };

  const activeChannel = channels.find((channel: any) => channel.id === activeChannelId);

  return (
    <div className="erp-module">
      <div className="erp-module-header">
        <div>
          <h1 className="erp-module-title">
            <MessageCircle className="text-brand-500" size={26} />
            Chat {companyName}
          </h1>
          <p className="erp-module-subtitle">Canais internos, conversas privadas e comunicação rápida da equipe.</p>
        </div>
        <div className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold ${
          connected
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
            : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
        }`}>
          {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
          {connected ? 'Conectado' : 'Fallback HTTP'}
        </div>
      </div>

      <div className="erp-panel grid h-[calc(100vh-13rem)] min-h-[620px] grid-cols-1 overflow-hidden p-0 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="min-h-0 border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40 lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col gap-5">
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Canais</h2>
              <div className="space-y-2">
                {channels.map((channel: any) => {
                  const Icon = channel.type === 'PRIVATE' ? MessageCircle : channel.type === 'COFOUNDERS' ? Lock : Hash;
                  const last = channel.messages?.[0];
                  const selected = activeChannelId === channel.id;
                  return (
                    <button
                      key={channel.id}
                      onClick={() => setActiveChannelId(channel.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                        selected
                          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/20 dark:text-brand-300'
                          : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-white dark:text-slate-300 dark:hover:border-slate-800 dark:hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={16} />
                        <span className="truncate text-sm font-bold">{channel.name}</span>
                      </div>
                      {last && (
                        <p className={`mt-1 truncate text-xs ${selected ? 'text-brand-600 dark:text-brand-300' : 'text-slate-500'}`}>
                          {last.sender?.name}: {last.content}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Privado</h2>
              <div className="space-y-2">
                <select value={privateUserId} onChange={(event) => setPrivateUserId(event.target.value)} className="erp-input">
                  <option value="">Escolher membro</option>
                  {users.map((user: any) => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
                <button disabled={!privateUserId || privateMutation.isPending} onClick={() => privateMutation.mutate()} className="erp-primary-action w-full">
                  <UserPlus size={16} />
                  Abrir privado
                </button>
              </div>
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          <header className="flex min-h-[76px] items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-slate-800 dark:text-white">{activeChannel?.name || 'Selecione um canal'}</h2>
              <p className="text-xs font-medium text-slate-500">{activeChannel?.participants?.length || 0} participante(s)</p>
            </div>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950/40">
            {messages.map((item: any) => {
              const color = getUserColor(item.sender);
              return (
                <div key={item.id} className="max-w-2xl rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start gap-3">
                    <Link to={`/users/${item.sender?.id}`} className="shrink-0">
                      <Avatar user={item.sender} size={36} />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Link to={`/users/${item.sender?.id}`} className="text-sm font-bold hover:underline" style={{ color }}>{item.sender?.name}</Link>
                        <span className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString('pt-BR')}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{item.content}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && (
              <div className="erp-empty-state py-12 text-sm text-slate-500">Não há mensagens neste canal.</div>
            )}
          </div>

          <form onSubmit={(event) => { event.preventDefault(); sendMessage(); }} className="flex gap-2 border-t border-slate-200 p-4 dark:border-slate-800">
            <input value={message} onChange={(event) => setMessage(event.target.value)} className="erp-input" placeholder="Escreva uma mensagem..." disabled={!activeChannelId} />
            <button disabled={!activeChannelId || !message.trim()} className="erp-primary-action px-4" title="Enviar">
              <Send size={18} />
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
