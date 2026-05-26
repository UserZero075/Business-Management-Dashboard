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

  const { data: channels } = useQuery({ queryKey: ['chat-channels'], queryFn: chatApi.getChannels });
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: authApi.getUsers });
  const { data: messages } = useQuery({
    queryKey: ['chat-messages', activeChannelId],
    queryFn: () => chatApi.getMessages(activeChannelId!),
    enabled: !!activeChannelId,
  });

  useEffect(() => {
    if (!activeChannelId && channels?.length) setActiveChannelId(channels[0].id);
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

  const activeChannel = channels?.find((channel: any) => channel.id === activeChannelId);

  return (
    <div className="space-y-6 h-[calc(100vh-9rem)] min-h-[620px]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Chat {companyName}</h1>
          <p className="text-gray-500">Canais internos, cofundadores e mensagens privadas.</p>
        </div>
        <div className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${connected ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
          {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
          {connected ? 'WebSocket conectado' : 'Fallback HTTP'}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border h-full grid grid-cols-1 lg:grid-cols-[300px_1fr] overflow-hidden">
        <aside className="border-r bg-slate-50 p-4 overflow-y-auto">
          <h2 className="font-semibold mb-3">Canais</h2>
          <div className="space-y-2 mb-6">
            {channels?.map((channel: any) => {
              const Icon = channel.type === 'PRIVATE' ? MessageCircle : channel.type === 'COFOUNDERS' ? Lock : Hash;
              const last = channel.messages?.[0];
              return (
                <button
                  key={channel.id}
                  onClick={() => setActiveChannelId(channel.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg ${activeChannelId === channel.id ? 'bg-blue-600 text-white' : 'hover:bg-white text-gray-700'}`}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={16} />
                    <span className="truncate font-medium">{channel.name}</span>
                  </div>
                  {last && <p className={`text-xs truncate mt-1 ${activeChannelId === channel.id ? 'text-blue-100' : 'text-gray-500'}`}>{last.sender?.name}: {last.content}</p>}
                </button>
              );
            })}
          </div>

          <h2 className="font-semibold mb-3">Privado</h2>
          <div className="space-y-2">
            <select value={privateUserId} onChange={(event) => setPrivateUserId(event.target.value)} className="w-full px-3 py-2 border rounded-lg bg-white">
              <option value="">Escolher membro</option>
              {users?.map((user: any) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
            <button disabled={!privateUserId || privateMutation.isPending} onClick={() => privateMutation.mutate()} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-lg disabled:opacity-50">
              <UserPlus size={16} />
              Abrir privado
            </button>
          </div>
        </aside>

        <section className="flex flex-col min-h-0">
          <header className="border-b p-4">
            <h2 className="font-semibold text-gray-800">{activeChannel?.name || 'Selecione um canal'}</h2>
            <p className="text-xs text-gray-500">{activeChannel?.participants?.length || 0} participantes</p>
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages?.map((item: any) => {
              const color = getUserColor(item.sender);
              return (
                <div key={item.id} className="bg-white border rounded-xl p-3 max-w-2xl shadow-sm">
                  <div className="flex items-start gap-3">
                    <Link to={`/users/${item.sender?.id}`} className="shrink-0">
                      <Avatar user={item.sender} size={36} />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
                        <Link to={`/users/${item.sender?.id}`} className="font-semibold text-sm hover:underline" style={{ color }}>{item.sender?.name}</Link>
                        <span className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleString('pt-BR')}</span>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{item.content}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {(!messages || messages.length === 0) && <p className="text-gray-500 text-sm">Não há mensagens neste canal.</p>}
          </div>

          <form onSubmit={(event) => { event.preventDefault(); sendMessage(); }} className="border-t p-4 flex gap-2">
            <input value={message} onChange={(event) => setMessage(event.target.value)} className="flex-1 px-4 py-2 border rounded-lg" placeholder="Escreva uma mensagem..." disabled={!activeChannelId} />
            <button disabled={!activeChannelId || !message.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
              <Send size={18} />
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
