import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import { logActivity } from '../services/activity.js';
import { sendMail } from '../services/email.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  otp: z.string().regex(/^\d{6}$/)
});

const requestOtpSchema = z.object({
  email: z.string().email()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

const profileSchema = z.object({
  name: z.string().min(2).optional(),
  avatar: z.string().url().optional().nullable().or(z.literal('')),
  color: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  githubUrl: z.string().url().optional().nullable().or(z.literal('')),
  facebookUrl: z.string().url().optional().nullable().or(z.literal('')),
  linkedinUrl: z.string().url().optional().nullable().or(z.literal('')),
  websiteUrl: z.string().url().optional().nullable().or(z.literal('')),
});

const USER_COLORS = ['#7C9CBF', '#8BAE92', '#B89B7A', '#9B8BC2', '#C27F8E', '#7FB8B4', '#A7A37A', '#8FA1C7', '#B184A7', '#86A873'];
const OTP_TTL_MINUTES = 10;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function userColor(seed: number) {
  return USER_COLORS[Math.abs(seed) % USER_COLORS.length];
}

function normalizeProfile(data: z.infer<typeof profileSchema>) {
  return {
    ...data,
    avatar: data.avatar || null,
    githubUrl: data.githubUrl || null,
    facebookUrl: data.facebookUrl || null,
    linkedinUrl: data.linkedinUrl || null,
    websiteUrl: data.websiteUrl || null,
    bio: data.bio || null,
    color: data.color || null,
  };
}

function authUserResponse(user: any) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role.name,
    avatar: user.avatar,
    color: user.color,
    bio: user.bio,
    githubUrl: user.githubUrl,
    facebookUrl: user.facebookUrl,
    linkedinUrl: user.linkedinUrl,
    websiteUrl: user.websiteUrl
  };
}

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/request-otp', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = requestOtpSchema.parse(request.body);
    const email = normalizeEmail(parsed.email);

    const existing = await fastify.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(400).send({ error: 'E-mail já cadastrado' });
    }

    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    const hashedCode = await bcrypt.hash(code, 10);

    await fastify.prisma.emailOtp.updateMany({
      where: { email, used: false },
      data: { used: true }
    });

    await fastify.prisma.emailOtp.create({
      data: { email, code: hashedCode, expiresAt }
    });

    try {
      const result = await sendMail({
        to: email,
        subject: 'Código de cadastro',
        text: `Seu código de cadastro é ${code}. Ele expira em ${OTP_TTL_MINUTES} minutos.`
      });

      return {
        success: true,
        expiresAt: expiresAt.toISOString(),
        devCode: result.dev && process.env.NODE_ENV !== 'production' ? code : undefined
      };
    } catch (error: any) {
      fastify.log.error(error, 'Falha ao enviar e-mail OTP');
      return reply.status(502).send({ error: 'Não foi possível enviar o código OTP' });
    }
  });

  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = registerSchema.parse(request.body);
    const data = { ...parsed, email: normalizeEmail(parsed.email) };

    const existing = await fastify.prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existing) {
      return reply.status(400).send({ error: 'E-mail já cadastrado' });
    }

    const otp = await fastify.prisma.emailOtp.findFirst({
      where: { email: data.email, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' }
    });

    if (!otp || !(await bcrypt.compare(data.otp, otp.code))) {
      return reply.status(400).send({ error: 'Código OTP inválido ou expirado' });
    }

    let defaultRole = await fastify.prisma.role.findFirst({
      where: { name: 'member' }
    });

    if (!defaultRole) {
      defaultRole = await fastify.prisma.role.create({
        data: {
          name: 'member',
          permissions: JSON.stringify(['read'])
        }
      });
    }

    // O primeiro usuário recebe o papel de administrador.
    const userCount = await fastify.prisma.user.count();
    let roleId = defaultRole.id;
    
    if (userCount === 0) {
      let adminRole = await fastify.prisma.role.findFirst({
        where: { name: 'admin' }
      });
      
      if (!adminRole) {
        adminRole = await fastify.prisma.role.create({
          data: {
            name: 'admin',
            permissions: JSON.stringify(['read', 'write', 'delete', 'manage_users', 'manage_roles'])
          }
        });
      }
      
      roleId = adminRole.id;
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await fastify.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
        color: userColor(userCount),
        roleId: roleId
      },
      include: { role: true }
    });

    await fastify.prisma.emailOtp.update({
      where: { id: otp.id },
      data: { used: true }
    });

    const token = fastify.jwt.sign({ id: user.id, email: user.email, roleId: user.roleId });
    const company = await fastify.prisma.settings.findUnique({ where: { key: 'companyName' } });

    await logActivity(fastify.prisma, {
      userId: user.id,
      action: 'auth.register',
      entityType: 'User',
      entityId: user.id,
      message: `${user.name} se cadastrou no gestor ${company?.value || 'DevFast'}`
    });

    return {
      user: authUserResponse(user),
      token
    };
  });

  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = loginSchema.parse(request.body);
    const data = { ...parsed, email: normalizeEmail(parsed.email) };

    const user = await fastify.prisma.user.findUnique({
      where: { email: data.email },
      include: { role: true }
    });

    if (!user) {
      return reply.status(401).send({ error: 'Credenciais inválidas' });
    }

    const valid = await bcrypt.compare(data.password, user.password);

    if (!valid) {
      return reply.status(401).send({ error: 'Credenciais inválidas' });
    }

    const token = fastify.jwt.sign({ id: user.id, email: user.email, roleId: user.roleId });

    await logActivity(fastify.prisma, {
      userId: user.id,
      action: 'auth.login',
      entityType: 'User',
      entityId: user.id,
      message: `${user.name} entrou no sistema`
    });

    return {
      user: authUserResponse(user),
      token
    };
  });

  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.id },
      include: { role: true }
    });

    if (!user) {
      return reply.status(404).send({ error: 'Usuário não encontrado' });
    }

    return authUserResponse(user);
  });

  fastify.put('/me', { preHandler: [fastify.authenticate] }, async (request: any) => {
    const data = normalizeProfile(profileSchema.parse(request.body));
    const user = await fastify.prisma.user.update({
      where: { id: request.user.id },
      data,
      include: { role: true }
    });

    await logActivity(fastify.prisma, {
      userId: user.id,
      action: 'user.profile.update',
      entityType: 'User',
      entityId: user.id,
      message: `${user.name} atualizou o perfil`
    });

    return authUserResponse(user);
  });

  fastify.get('/users', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    return fastify.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        color: true,
        bio: true,
        githubUrl: true,
        facebookUrl: true,
        linkedinUrl: true,
        websiteUrl: true,
        roleId: true,
        role: { select: { id: true, name: true } },
        createdAt: true
      },
      orderBy: { name: 'asc' }
    });
  });

  fastify.get('/users/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const userId = parseInt(request.params.id);
    const user = await fastify.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        color: true,
        bio: true,
        githubUrl: true,
        facebookUrl: true,
        linkedinUrl: true,
        websiteUrl: true,
        createdAt: true,
        role: { select: { id: true, name: true } },
        projectMembers: {
          select: {
            role: true,
            isResponsible: true,
            project: { select: { id: true, name: true, status: true, publicUrl: true } }
          }
        }
      }
    });

    if (!user) {
      return reply.status(404).send({ error: 'Usuário não encontrado' });
    }

    return {
      ...user,
      projects: user.projectMembers.map((member) => ({
        ...member.project,
        memberRole: member.role,
        isResponsible: member.isResponsible
      })),
      projectMembers: undefined
    };
  });

  fastify.get('/roles', { preHandler: [fastify.authenticate] }, async () => {
    return fastify.prisma.role.findMany({
      orderBy: { name: 'asc' }
    });
  });

  fastify.post('/roles', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, permissions } = request.body as { name: string; permissions?: string[] };
    
    if (!name) {
      return reply.status(400).send({ error: 'Nome do papel é obrigatório' });
    }

    const role = await fastify.prisma.role.create({
      data: {
        name,
        permissions: JSON.stringify(permissions || ['read'])
      }
    });

    return role;
  });

  fastify.put('/users/:id/role', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const userId = parseInt(request.params.id);
    const { roleId } = request.body as { roleId: number };

    if (!roleId) {
      return reply.status(400).send({ error: 'ID do papel é obrigatório' });
    }

    const user = await fastify.prisma.user.update({
      where: { id: userId },
      data: { roleId },
      include: { role: true }
    });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'user.role.update',
      entityType: 'User',
      entityId: user.id,
      message: `Alterou o papel de ${user.name} para ${user.role.name}`
    });

    return user;
  });
}
