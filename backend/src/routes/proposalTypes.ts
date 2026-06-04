import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { logActivity } from '../services/activity.js';

const fieldSchema = z.object({
  label: z.string().min(1),
  key: z.string().min(1),
  fieldType: z.enum(['text', 'number', 'boolean', 'select']).default('text'),
  options: z.preprocess((v) => (v === '' ? null : v), z.string().nullable().optional()),
  required: z.boolean().default(false),
  order: z.number().int().default(0),
});

const textBlockSchema = z.object({
  title: z.string().min(1),
  content: z.string().default(''),
  order: z.number().int().default(0),
});

const itemSchema = z.object({
  description: z.string().min(1),
  qty: z.number().default(1),
  unitPrice: z.number().default(0),
  discount: z.number().default(0),
  tax: z.number().default(0),
  order: z.number().int().default(0),
});

const typeSchema = z.object({
  name: z.string().min(1),
  description: z.preprocess((v) => (v === '' ? null : v), z.string().nullable().optional()),
  active: z.boolean().default(true),
  defaultCurrency: z.string().default('BRL'),
  paymentTermsDefault: z.preprocess((v) => (v === '' ? null : v), z.string().nullable().optional()),
  fields: z.array(fieldSchema).default([]),
  textBlocks: z.array(textBlockSchema).default([]),
  items: z.array(itemSchema).default([]),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function uniqueSlug(prisma: FastifyInstance['prisma'], name: string): Promise<string> {
  const base = slugify(name) || 'tipo';
  let candidate = base;
  let n = 1;
  // Loop until we find a slug not already taken.
  while (await prisma.proposalType.findUnique({ where: { slug: candidate } })) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

export default async function proposalTypeRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, async () => {
    return fastify.prisma.proposalType.findMany({
      include: {
        fields: { orderBy: { order: 'asc' } },
        textBlocks: { orderBy: { order: 'asc' } },
        items: { orderBy: { order: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });
  });

  fastify.get('/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id);
    const type = await fastify.prisma.proposalType.findUnique({
      where: { id },
      include: {
        fields: { orderBy: { order: 'asc' } },
        textBlocks: { orderBy: { order: 'asc' } },
        items: { orderBy: { order: 'asc' } },
      },
    });
    if (!type) return reply.status(404).send({ error: 'Tipo não encontrado' });
    return type;
  });

  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    const data = typeSchema.parse(request.body);
    const slug = await uniqueSlug(fastify.prisma, data.name);

    const type = await fastify.prisma.proposalType.create({
      data: {
        name: data.name,
        slug,
        description: data.description ?? null,
        active: data.active,
        defaultCurrency: data.defaultCurrency,
        paymentTermsDefault: data.paymentTermsDefault ?? null,
        fields: { create: data.fields },
        textBlocks: { create: data.textBlocks },
        items: { create: data.items },
      },
      include: { fields: true, textBlocks: true, items: true },
    });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'proposalType.create',
      entityType: 'ProposalType',
      entityId: type.id,
      message: `Criou o tipo de proposta: ${type.name}`,
    });

    return type;
  });

  fastify.put('/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const id = parseInt(request.params.id);
    const data = typeSchema.parse(request.body);

    const type = await fastify.prisma.$transaction(async (tx) => {
      await tx.proposalTypeField.deleteMany({ where: { typeId: id } });
      await tx.proposalTypeTextBlock.deleteMany({ where: { typeId: id } });
      await tx.proposalTypeItem.deleteMany({ where: { typeId: id } });
      return tx.proposalType.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description ?? null,
          active: data.active,
          defaultCurrency: data.defaultCurrency,
          paymentTermsDefault: data.paymentTermsDefault ?? null,
          fields: { create: data.fields },
          textBlocks: { create: data.textBlocks },
          items: { create: data.items },
        },
        include: { fields: true, textBlocks: true, items: true },
      });
    });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'proposalType.update',
      entityType: 'ProposalType',
      entityId: id,
      message: `Atualizou o tipo de proposta: ${type.name}`,
    });

    return type;
  });

  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const id = parseInt(request.params.id);
    await fastify.prisma.proposalType.delete({ where: { id } });
    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'proposalType.delete',
      entityType: 'ProposalType',
      entityId: id,
      message: `Removeu o tipo de proposta com ID: ${id}`,
    });
    return { success: true };
  });
}
