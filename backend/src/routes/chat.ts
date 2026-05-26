import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

const chatClients = new Map<number, Set<any>>();

function addClient(userId: number, socket: any) {
  if (!chatClients.has(userId)) chatClients.set(userId, new Set());
  chatClients.get(userId)!.add(socket);
  socket.on('close', () => chatClients.get(userId)?.delete(socket));
}

async function broadcastToChannel(fastify: FastifyInstance, channelId: number, payload: unknown) {
  const participants = await fastify.prisma.chatParticipant.findMany({ where: { channelId } });
  const encoded = JSON.stringify(payload);
  for (const participant of participants) {
    const sockets = chatClients.get(participant.userId);
    if (!sockets) continue;
    for (const socket of sockets) {
      if (socket.readyState === 1) socket.send(encoded);
    }
  }
}

async function ensureDefaultChannels(fastify: FastifyInstance, userId: number) {
  const users = await fastify.prisma.user.findMany({ include: { role: true } });
  const company = await fastify.prisma.chatChannel.upsert({
    where: { id: 1 },
    update: {},
    create: { name: 'Empresa', type: 'COMPANY', createdById: userId }
  });

  for (const user of users) {
    await fastify.prisma.chatParticipant.upsert({
      where: { channelId_userId: { channelId: company.id, userId: user.id } },
      update: {},
      create: { channelId: company.id, userId: user.id }
    });
  }

  let cofounders = await fastify.prisma.chatChannel.findFirst({ where: { type: 'COFOUNDERS' } });
  if (!cofounders) {
    cofounders = await fastify.prisma.chatChannel.create({
      data: { name: 'Cofundadores', type: 'COFOUNDERS', createdById: userId }
    });
  }

  const cofounderRoles = ['admin', 'cofounder', 'cofundador', 'owner', 'founder', 'fundador', 'dueno', 'dueño'];
  for (const user of users.filter((item) => cofounderRoles.includes(item.role.name.toLowerCase()))) {
    await fastify.prisma.chatParticipant.upsert({
      where: { channelId_userId: { channelId: cofounders.id, userId: user.id } },
      update: {},
      create: { channelId: cofounders.id, userId: user.id }
    });
  }
}

export default async function chatRoutes(fastify: FastifyInstance) {
  fastify.get('/ws', { websocket: true }, (connection: any, request: FastifyRequest) => {
    const token = (request.query as any)?.token;
    let payload: any;
    try {
      payload = fastify.jwt.verify(token);
    } catch {
      connection.socket.close();
      return;
    }

    const userId = Number(payload.id);
    addClient(userId, connection.socket);
    connection.socket.send(JSON.stringify({ type: 'connected' }));

    connection.socket.on('message', async (raw: Buffer) => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.type !== 'message') return;

        const channelId = Number(message.channelId);
        const content = String(message.content || '').trim();
        if (!channelId || !content) return;

        const participant = await fastify.prisma.chatParticipant.findUnique({ where: { channelId_userId: { channelId, userId } } });
        if (!participant) {
          connection.socket.send(JSON.stringify({ type: 'error', message: 'Você não pertence a esse canal' }));
          return;
        }

        const created = await fastify.prisma.chatMessage.create({
          data: { channelId, senderId: userId, content },
          include: { sender: { select: { id: true, name: true, avatar: true, color: true } } }
        });

        await broadcastToChannel(fastify, channelId, { type: 'new_message', channelId, message: created });
      } catch (error) {
        connection.socket.send(JSON.stringify({ type: 'error', message: 'Mensagem inválida' }));
      }
    });
  });

  fastify.get('/channels', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    const userId = (request.user as any).id;
    await ensureDefaultChannels(fastify, userId);

    return fastify.prisma.chatChannel.findMany({
      where: { participants: { some: { userId } } },
      include: {
        participants: { include: { user: { select: { id: true, name: true, email: true, avatar: true, color: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: { id: true, name: true, avatar: true, color: true } } } }
      },
      orderBy: { createdAt: 'asc' }
    });
  });

  fastify.post('/private', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const currentUserId = (request.user as any).id;
    const { userId } = request.body as { userId: number };
    if (!userId || userId === currentUserId) return reply.status(400).send({ error: 'Usuário privado inválido' });

    const channels = await fastify.prisma.chatChannel.findMany({
      where: { type: 'PRIVATE', participants: { some: { userId: currentUserId } } },
      include: { participants: true }
    });
    const existing = channels.find((channel) => {
      const ids = channel.participants.map((participant) => participant.userId).sort();
      return ids.length === 2 && ids[0] === Math.min(currentUserId, userId) && ids[1] === Math.max(currentUserId, userId);
    });
    if (existing) return existing;

    const target = await fastify.prisma.user.findUnique({ where: { id: userId } });
    const current = await fastify.prisma.user.findUnique({ where: { id: currentUserId } });
    const channel = await fastify.prisma.chatChannel.create({
      data: { name: `${current?.name || 'Usuário'} / ${target?.name || 'Usuário'}`, type: 'PRIVATE', createdById: currentUserId }
    });
    await fastify.prisma.chatParticipant.createMany({
      data: [{ channelId: channel.id, userId: currentUserId }, { channelId: channel.id, userId }]
    });

    return channel;
  });

  fastify.get('/channels/:id/messages', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const channelId = parseInt(request.params.id);
    const userId = (request.user as any).id;
    const participant = await fastify.prisma.chatParticipant.findUnique({ where: { channelId_userId: { channelId, userId } } });
    if (!participant) return reply.status(403).send({ error: 'Você não participa deste canal' });

    return fastify.prisma.chatMessage.findMany({
      where: { channelId },
      include: { sender: { select: { id: true, name: true, avatar: true, color: true } } },
      orderBy: { createdAt: 'asc' },
      take: 200
    });
  });

  fastify.post('/channels/:id/messages', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const channelId = parseInt(request.params.id);
    const senderId = (request.user as any).id;
    const { content } = request.body as { content: string };
    if (!content?.trim()) return reply.status(400).send({ error: 'Mensagem é obrigatória' });

    const participant = await fastify.prisma.chatParticipant.findUnique({ where: { channelId_userId: { channelId, userId: senderId } } });
    if (!participant) return reply.status(403).send({ error: 'Você não participa deste canal' });

    const created = await fastify.prisma.chatMessage.create({
      data: { channelId, senderId, content: content.trim() },
      include: { sender: { select: { id: true, name: true, avatar: true, color: true } } }
    });

    await broadcastToChannel(fastify, channelId, { type: 'new_message', channelId, message: created });
    return created;
  });
}
