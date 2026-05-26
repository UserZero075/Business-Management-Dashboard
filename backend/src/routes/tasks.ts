import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logActivity } from '../services/activity.js';

const taskSchema = z.object({
  projectId: z.number(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.string().optional(),
  assigneeId: z.number().optional(),
  dueDate: z.string().optional()
});

const bugSchema = z.object({
  projectId: z.number(),
  title: z.string().min(1),
  description: z.string().optional(),
  severity: z.string().optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional()
});

export default async function taskRoutes(fastify: FastifyInstance) {
  fastify.get('/tasks', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    const { projectId, status, assigneeId } = request.query as any;

    const where: any = {};
    if (projectId) where.projectId = parseInt(projectId);
    if (status) where.status = status;
    if (assigneeId) where.assigneeId = parseInt(assigneeId);

    return fastify.prisma.task.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, avatar: true, color: true } },
        creator: { select: { id: true, name: true, avatar: true, color: true } }
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }]
    });
  });

  fastify.post('/tasks', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<any>) => {
    const data = taskSchema.parse(request.body);

    const task = await fastify.prisma.task.create({
      data: {
        ...data,
        assigneeId: data.assigneeId || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        creatorId: (request.user as any).id
      }
    });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'task.create',
      entityType: 'Task',
      entityId: task.id,
      message: `Criou a tarefa: ${task.title}`
    });

    return task;
  });

  fastify.put('/tasks/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const id = parseInt(request.params.id);
    const data = taskSchema.partial().parse(request.body);

    const updateData: any = { ...data };
    if (data.dueDate) updateData.dueDate = new Date(data.dueDate);
    if (data.status === 'COMPLETED') updateData.completedAt = new Date();

    const task = await fastify.prisma.task.update({
      where: { id },
      data: updateData
    });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'task.update',
      entityType: 'Task',
      entityId: task.id,
      message: `Atualizou a tarefa: ${task.title}`,
      metadata: updateData
    });

    return task;
  });

  fastify.delete('/tasks/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const id = parseInt(request.params.id);
    await fastify.prisma.task.delete({ where: { id } });
    return { success: true };
  });

  fastify.get('/bugs', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    const { projectId, status, severity } = request.query as any;

    const where: any = {};
    if (projectId) where.projectId = parseInt(projectId);
    if (status) where.status = status;
    if (severity) where.severity = severity;

    return fastify.prisma.bug.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        reporter: { select: { id: true, name: true, avatar: true, color: true } }
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }]
    });
  });

  fastify.post('/bugs', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<any>) => {
    const data = bugSchema.parse(request.body);

    const bug = await fastify.prisma.bug.create({
      data: {
        ...data,
        reporterId: (request.user as any).id
      }
    });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'bug.create',
      entityType: 'Bug',
      entityId: bug.id,
      message: `Reportou o bug: ${bug.title}`
    });

    return bug;
  });

  fastify.put('/bugs/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const id = parseInt(request.params.id);
    const data = bugSchema.partial().parse(request.body);

    const updateData: any = { ...data };
    if (data.status === 'RESOLVED' || data.status === 'CLOSED') {
      updateData.resolvedAt = new Date();
    }

    const bug = await fastify.prisma.bug.update({
      where: { id },
      data: updateData
    });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'bug.update',
      entityType: 'Bug',
      entityId: bug.id,
      message: `Atualizou o bug: ${bug.title}`,
      metadata: updateData
    });

    return bug;
  });

  fastify.delete('/bugs/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const id = parseInt(request.params.id);
    await fastify.prisma.bug.delete({ where: { id } });
    return { success: true };
  });

  fastify.get('/overview', { preHandler: [fastify.authenticate] }, async () => {
    const totalTasks = await fastify.prisma.task.count();
    const completedTasks = await fastify.prisma.task.count({ where: { status: 'COMPLETED' } });
    const pendingTasks = await fastify.prisma.task.count({ where: { status: 'PENDING' } });
    const inProgressTasks = await fastify.prisma.task.count({ where: { status: 'IN_PROGRESS' } });

    const totalBugs = await fastify.prisma.bug.count();
    const openBugs = await fastify.prisma.bug.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } });
    const criticalBugs = await fastify.prisma.bug.count({ where: { severity: 'critical', status: { in: ['OPEN', 'IN_PROGRESS'] } } });

    const tasksByProject = await fastify.prisma.task.groupBy({
      by: ['projectId'],
      _count: true
    });

    const bugsByProject = await fastify.prisma.bug.groupBy({
      by: ['projectId'],
      _count: true
    });

    const projects = await fastify.prisma.project.findMany({ select: { id: true, name: true } });
    const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]));

    return {
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        pending: pendingTasks,
        inProgress: inProgressTasks,
        completionRate: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0
      },
      bugs: {
        total: totalBugs,
        open: openBugs,
        critical: criticalBugs,
        resolvedRate: totalBugs ? Math.round(((totalBugs - openBugs) / totalBugs) * 100) : 0
      },
      byProject: tasksByProject.map(t => ({
        projectId: t.projectId,
        projectName: projectMap[t.projectId] || 'Desconhecido',
        tasks: t._count,
        bugs: bugsByProject.find(b => b.projectId === t.projectId)?._count || 0
      }))
    };
  });
}
