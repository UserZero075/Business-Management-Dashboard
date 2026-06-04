# Propostas v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar Propostas num gerador configurável por tipo de serviço (ERP, Website, Automação, Robôs…), com itens completos, campos-chave, blocos de texto com placeholders e um documento apresentável exportável em PDF pelo navegador.

**Architecture:** Tipos de proposta são moldes editáveis (Configurações). Ao criar uma proposta a partir de um tipo, o conteúdo é copiado (snapshot) para tabelas próprias da proposta, garantindo histórico fiel. O backend (Fastify + Prisma) é a fonte autoritativa dos totais; o frontend (React) espelha o cálculo para preview ao vivo e renderiza o documento em HTML otimizado para impressão.

**Tech Stack:** Node.js + Fastify + TypeScript + Prisma (SQLite) no backend; React + Vite + TypeScript + Tailwind no frontend; Vitest para o teste unitário de totais; Zod para validação.

**Spec:** `docs/superpowers/specs/2026-06-04-propostas-design.md`

**Convenções do projeto (importantes):**
- Backend é ESM: imports locais terminam em `.js` (ex: `../services/activity.js`).
- Validação com Zod; erros Prisma já tratados globalmente em `backend/src/index.ts`.
- `logActivity(prisma, { userId, action, entityType, entityId, message, metadata })`.
- Datas via `parseBrazilDateOnly` / `todayBrazilDateOnly` de `../utils/dates.js`.
- Transações financeiras hoje usam `currency: 'BRL'`. Moeda padrão das propostas = **BRL**.
- Frontend usa `api.get/post/put/delete<T>(path)` e objetos por domínio em `frontend/src/api/client.ts`.

---

## Phase 0 — Modelo de dados

### Task 1: Estender o schema Prisma

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Adicionar os models de "molde" ao final do schema**

Adicione ao final de `backend/prisma/schema.prisma`:

```prisma
model ProposalType {
  id                  Int                     @id @default(autoincrement())
  name                String
  slug                String                  @unique
  description         String?
  active              Boolean                 @default(true)
  defaultCurrency     String                  @default("BRL")
  paymentTermsDefault String?
  createdAt           DateTime                @default(now())
  updatedAt           DateTime                @updatedAt
  fields              ProposalTypeField[]
  textBlocks          ProposalTypeTextBlock[]
  items               ProposalTypeItem[]
  proposals           Proposal[]
}

model ProposalTypeField {
  id        Int          @id @default(autoincrement())
  typeId    Int
  type      ProposalType @relation(fields: [typeId], references: [id], onDelete: Cascade)
  label     String
  key       String
  fieldType String       @default("text") // text | number | boolean | select
  options   String?      // JSON com as opções quando fieldType = select
  required  Boolean      @default(false)
  order     Int          @default(0)
}

model ProposalTypeTextBlock {
  id      Int          @id @default(autoincrement())
  typeId  Int
  type    ProposalType @relation(fields: [typeId], references: [id], onDelete: Cascade)
  title   String
  content String       @default("")
  order   Int          @default(0)
}

model ProposalTypeItem {
  id          Int          @id @default(autoincrement())
  typeId      Int
  type        ProposalType @relation(fields: [typeId], references: [id], onDelete: Cascade)
  description String
  qty         Float        @default(1)
  unitPrice   Float        @default(0)
  discount    Float        @default(0)
  tax         Float        @default(0)
  order       Int          @default(0)
}
```

- [ ] **Step 2: Adicionar os models de "proposta real"**

Adicione ao final do schema:

```prisma
model ProposalItem {
  id          Int      @id @default(autoincrement())
  proposalId  Int
  proposal    Proposal @relation(fields: [proposalId], references: [id], onDelete: Cascade)
  description String
  qty         Float    @default(1)
  unitPrice   Float    @default(0)
  discount    Float    @default(0)
  tax         Float    @default(0)
  lineTotal   Float    @default(0)
  recurring   Boolean  @default(false)
  order       Int      @default(0)
}

model ProposalFieldValue {
  id         Int      @id @default(autoincrement())
  proposalId Int
  proposal   Proposal @relation(fields: [proposalId], references: [id], onDelete: Cascade)
  fieldKey   String
  label      String
  value      String   @default("")
}

model ProposalTextBlock {
  id         Int      @id @default(autoincrement())
  proposalId Int
  proposal   Proposal @relation(fields: [proposalId], references: [id], onDelete: Cascade)
  title      String
  content    String   @default("")
  order      Int      @default(0)
}
```

- [ ] **Step 3: Estender o model `Proposal` existente**

Substitua o bloco `model Proposal { ... }` por:

```prisma
model Proposal {
  id            Int      @id @default(autoincrement())
  number        String?  @unique
  title         String
  description   String?
  value         Float    @default(0)   // mantido em sincronia com total (compatibilidade)
  subtotal      Float    @default(0)
  discountTotal Float    @default(0)
  taxTotal      Float    @default(0)
  total         Float    @default(0)
  currency      String   @default("BRL")
  validUntil    DateTime?
  clientName    String?
  status        String   @default("DRAFT") // DRAFT | SENT | ACCEPTED | REJECTED | EXPIRED
  sentAt        DateTime?
  acceptedAt    DateTime?
  publicToken   String?  @unique
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  clientId      Int?
  client        Client?  @relation(fields: [clientId], references: [id])
  leadId        Int?
  lead          Lead?    @relation(fields: [leadId], references: [id])
  typeId        Int?
  type          ProposalType? @relation(fields: [typeId], references: [id])
  items         ProposalItem[]
  fieldValues   ProposalFieldValue[]
  textBlocks    ProposalTextBlock[]
}
```

- [ ] **Step 4: Adicionar o gancho de rastreabilidade em `FinancialTransaction`**

No `model FinancialTransaction`, adicione estas duas linhas junto às demais relações (antes do fechamento `}`):

```prisma
  proposalId       Int?
  proposal         Proposal?     @relation(fields: [proposalId], references: [id])
```

E adicione a relação inversa dentro de `model Proposal` (acrescente a linha):

```prisma
  transactions  FinancialTransaction[]
```

- [ ] **Step 5: Aplicar o schema no banco e gerar o client**

Run:
```bash
cd backend && npm run db:push && npm run db:generate
```
Expected: "Your database is now in sync with your Prisma schema." e geração do client sem erros.

- [ ] **Step 6: Verificar que o backend ainda compila**

Run: `cd backend && npm run build`
Expected: compila sem erros de tipo.

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(propostas): schema de tipos, itens, campos e blocos de texto"
```

---

## Phase 1 — Cálculo de totais (TDD)

### Task 2: Configurar Vitest no backend

**Files:**
- Modify: `backend/package.json`
- Create: `backend/vitest.config.ts`

- [ ] **Step 1: Instalar Vitest**

Run: `cd backend && npm install -D vitest@^2.0.0`
Expected: instala sem erros.

- [ ] **Step 2: Adicionar o script de teste**

Em `backend/package.json`, dentro de `"scripts"`, adicione:

```json
    "test": "vitest run",
```

- [ ] **Step 3: Criar a config do Vitest**

Create `backend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Verificar que o runner roda (sem testes ainda)**

Run: `cd backend && npm test`
Expected: "No test files found" ou execução vazia, sem crash.

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/vitest.config.ts
git commit -m "chore(backend): adiciona Vitest"
```

### Task 3: Util de cálculo de totais (TDD)

**Files:**
- Test: `backend/src/lib/proposalTotals.test.ts`
- Create: `backend/src/lib/proposalTotals.ts`

- [ ] **Step 1: Escrever o teste que falha**

Create `backend/src/lib/proposalTotals.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeLineTotal, computeProposalTotals } from './proposalTotals.js';

describe('computeLineTotal', () => {
  it('multiplica qtd por valor unitário', () => {
    expect(computeLineTotal({ qty: 3, unitPrice: 100, discount: 0, tax: 0 })).toBe(300);
  });

  it('aplica desconto e imposto na linha', () => {
    expect(computeLineTotal({ qty: 2, unitPrice: 100, discount: 50, tax: 30 })).toBe(180);
  });

  it('arredonda para 2 casas', () => {
    expect(computeLineTotal({ qty: 3, unitPrice: 0.1, discount: 0, tax: 0 })).toBe(0.3);
  });
});

describe('computeProposalTotals', () => {
  it('soma subtotal, desconto, imposto e total de várias linhas', () => {
    const totals = computeProposalTotals([
      { qty: 1, unitPrice: 1000, discount: 100, tax: 0 },
      { qty: 2, unitPrice: 500, discount: 0, tax: 90 },
    ]);
    expect(totals.subtotal).toBe(2000);
    expect(totals.discountTotal).toBe(100);
    expect(totals.taxTotal).toBe(90);
    expect(totals.total).toBe(1990);
  });

  it('retorna tudo zero para lista vazia', () => {
    expect(computeProposalTotals([])).toEqual({
      subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0,
    });
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd backend && npm test`
Expected: FAIL — "Cannot find module './proposalTotals.js'".

- [ ] **Step 3: Implementar o util mínimo**

Create `backend/src/lib/proposalTotals.ts`:

```ts
export interface ProposalLineInput {
  qty: number;
  unitPrice: number;
  discount: number;
  tax: number;
}

export interface ProposalTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeLineTotal(line: ProposalLineInput): number {
  return round2(line.qty * line.unitPrice - line.discount + line.tax);
}

export function computeProposalTotals(lines: ProposalLineInput[]): ProposalTotals {
  const subtotal = round2(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0));
  const discountTotal = round2(lines.reduce((s, l) => s + l.discount, 0));
  const taxTotal = round2(lines.reduce((s, l) => s + l.tax, 0));
  const total = round2(subtotal - discountTotal + taxTotal);
  return { subtotal, discountTotal, taxTotal, total };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd backend && npm test`
Expected: PASS — todos os testes verdes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/proposalTotals.ts backend/src/lib/proposalTotals.test.ts
git commit -m "feat(propostas): util de cálculo de totais (TDD)"
```

---

## Phase 2 — Backend: CRUD de tipos de proposta

### Task 4: Rota de tipos de proposta

**Files:**
- Create: `backend/src/routes/proposalTypes.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Criar a rota de tipos**

Create `backend/src/routes/proposalTypes.ts`:

```ts
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
    const baseSlug = slugify(data.name) || 'tipo';
    const existing = await fastify.prisma.proposalType.findMany({
      where: { slug: { startsWith: baseSlug } },
      select: { slug: true },
    });
    const slug = existing.some((e) => e.slug === baseSlug)
      ? `${baseSlug}-${existing.length + 1}`
      : baseSlug;

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
```

- [ ] **Step 2: Registrar a rota em `index.ts`**

Em `backend/src/index.ts`, após a linha de import de `proposalRoutes`, adicione:

```ts
import proposalTypeRoutes from "./routes/proposalTypes.js";
```

E após a linha `await fastify.register(proposalRoutes, { prefix: "/api/proposals" });`, adicione:

```ts
await fastify.register(proposalTypeRoutes, { prefix: "/api/proposal-types" });
```

- [ ] **Step 3: Verificar build**

Run: `cd backend && npm run build`
Expected: compila sem erros.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/proposalTypes.ts backend/src/index.ts
git commit -m "feat(propostas): CRUD de tipos de proposta"
```

---

## Phase 3 — Backend: snapshot, totais e aceite

### Task 5: Criação por snapshot e numeração

**Files:**
- Create: `backend/src/lib/proposalNumber.ts`
- Modify: `backend/src/routes/proposals.ts`

- [ ] **Step 1: Util de numeração sequencial**

Create `backend/src/lib/proposalNumber.ts`:

```ts
import type { PrismaClient } from '@prisma/client';

// Gera "P-AAAA-NNN" sequencial por ano com base no maior número existente.
export async function nextProposalNumber(prisma: PrismaClient, year: number): Promise<string> {
  const prefix = `P-${year}-`;
  const last = await prisma.proposal.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  const lastSeq = last?.number ? parseInt(last.number.slice(prefix.length), 10) : 0;
  const seq = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}
```

- [ ] **Step 2: Reescrever o `POST /` de proposals para suportar snapshot**

Em `backend/src/routes/proposals.ts`, adicione os imports no topo (após os imports existentes):

```ts
import { computeLineTotal, computeProposalTotals } from '../lib/proposalTotals.js';
import { nextProposalNumber } from '../lib/proposalNumber.js';
```

Substitua a constante `proposalSchema` por uma versão que aceita itens, campos e blocos:

```ts
const itemInputSchema = z.object({
  description: z.string().min(1),
  qty: z.number().default(1),
  unitPrice: z.number().default(0),
  discount: z.number().default(0),
  tax: z.number().default(0),
  recurring: z.boolean().default(false),
  order: z.number().int().default(0),
});

const fieldValueInputSchema = z.object({
  fieldKey: z.string().min(1),
  label: z.string().min(1),
  value: z.string().default(''),
});

const textBlockInputSchema = z.object({
  title: z.string().min(1),
  content: z.string().default(''),
  order: z.number().int().default(0),
});

const proposalSchema = z.object({
  title: z.string().min(1),
  description: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  validUntil: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  clientName: z.preprocess((val) => (val === '' ? null : val), z.string().optional().nullable()),
  status: z.string().optional(),
  currency: z.string().optional(),
  clientId: z.number().int().positive().optional().nullable(),
  leadId: z.number().int().positive().optional().nullable(),
  typeId: z.number().int().positive().optional().nullable(),
  items: z.array(itemInputSchema).optional(),
  fieldValues: z.array(fieldValueInputSchema).optional(),
  textBlocks: z.array(textBlockInputSchema).optional(),
});
```

Substitua o handler `fastify.post('/', ...)` inteiro por:

```ts
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest) => {
    const data = proposalSchema.parse(request.body);

    // Se veio de um tipo e não mandaram conteúdo, copia o molde (snapshot).
    let items = data.items ?? [];
    let fieldValues = data.fieldValues ?? [];
    let textBlocks = data.textBlocks ?? [];
    let currency = data.currency ?? 'BRL';

    if (data.typeId && !data.items && !data.fieldValues && !data.textBlocks) {
      const type = await fastify.prisma.proposalType.findUnique({
        where: { id: data.typeId },
        include: {
          fields: { orderBy: { order: 'asc' } },
          textBlocks: { orderBy: { order: 'asc' } },
          items: { orderBy: { order: 'asc' } },
        },
      });
      if (type) {
        currency = data.currency ?? type.defaultCurrency;
        items = type.items.map((i) => ({
          description: i.description, qty: i.qty, unitPrice: i.unitPrice,
          discount: i.discount, tax: i.tax, recurring: false, order: i.order,
        }));
        fieldValues = type.fields.map((f) => ({ fieldKey: f.key, label: f.label, value: '' }));
        textBlocks = type.textBlocks.map((t) => ({ title: t.title, content: t.content, order: t.order }));
      }
    }

    const totals = computeProposalTotals(items);
    const itemsWithTotals = items.map((i) => ({ ...i, lineTotal: computeLineTotal(i) }));
    const number = await nextProposalNumber(fastify.prisma, todayBrazilDateOnly().getFullYear());

    const proposal = await fastify.prisma.proposal.create({
      data: {
        number,
        title: data.title,
        description: data.description,
        validUntil: parseBrazilDateOnly(data.validUntil),
        clientName: data.clientName,
        status: data.status || 'DRAFT',
        currency,
        clientId: data.clientId || null,
        leadId: data.leadId || null,
        typeId: data.typeId || null,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        value: totals.total,
        items: { create: itemsWithTotals },
        fieldValues: { create: fieldValues },
        textBlocks: { create: textBlocks },
      },
      include: { items: true, fieldValues: true, textBlocks: true, type: true },
    });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'proposal.create',
      entityType: 'Proposal',
      entityId: proposal.id,
      message: `Criou a proposta ${proposal.number}: ${proposal.title} no valor de ${proposal.total}`,
    });

    return proposal;
  });
```

- [ ] **Step 3: Incluir relações no `GET /:id` e `GET /`**

No handler `fastify.get('/:id', ...)`, troque o objeto `include` por:

```ts
      include: {
        client: true,
        lead: true,
        type: true,
        items: { orderBy: { order: 'asc' } },
        fieldValues: true,
        textBlocks: { orderBy: { order: 'asc' } },
      }
```

No handler `fastify.get('/', ...)`, troque o objeto `include` por:

```ts
      include: {
        client: { select: { id: true, name: true, company: true } },
        lead: { select: { id: true, name: true, company: true } },
        type: { select: { id: true, name: true } }
      },
```

- [ ] **Step 4: Verificar build**

Run: `cd backend && npm run build`
Expected: compila sem erros.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/proposalNumber.ts backend/src/routes/proposals.ts
git commit -m "feat(propostas): criação por snapshot, numeração e totais"
```

### Task 6: Atualização (replace-all) de itens/campos/blocos + recálculo

**Files:**
- Modify: `backend/src/routes/proposals.ts`

- [ ] **Step 1: Reescrever o `PUT /:id`**

Substitua o handler `fastify.put('/:id', ...)` por (substitui os filhos inteiros quando enviados e recalcula totais):

```ts
  fastify.put('/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const id = parseInt(request.params.id);
    const data = proposalSchema.partial().parse(request.body);

    const updated = await fastify.prisma.$transaction(async (tx) => {
      const baseData: any = {};
      if (data.title !== undefined) baseData.title = data.title;
      if (data.description !== undefined) baseData.description = data.description;
      if (data.clientName !== undefined) baseData.clientName = data.clientName;
      if (data.status !== undefined) baseData.status = data.status;
      if (data.currency !== undefined) baseData.currency = data.currency;
      if (data.clientId !== undefined) baseData.clientId = data.clientId || null;
      if (data.leadId !== undefined) baseData.leadId = data.leadId || null;
      if (data.typeId !== undefined) baseData.typeId = data.typeId || null;
      if (data.validUntil !== undefined) baseData.validUntil = parseBrazilDateOnly(data.validUntil);

      if (data.items !== undefined) {
        const totals = computeProposalTotals(data.items);
        baseData.subtotal = totals.subtotal;
        baseData.discountTotal = totals.discountTotal;
        baseData.taxTotal = totals.taxTotal;
        baseData.total = totals.total;
        baseData.value = totals.total;
        await tx.proposalItem.deleteMany({ where: { proposalId: id } });
        await tx.proposalItem.createMany({
          data: data.items.map((i) => ({
            proposalId: id, description: i.description, qty: i.qty, unitPrice: i.unitPrice,
            discount: i.discount, tax: i.tax, recurring: i.recurring, order: i.order,
            lineTotal: computeLineTotal(i),
          })),
        });
      }
      if (data.fieldValues !== undefined) {
        await tx.proposalFieldValue.deleteMany({ where: { proposalId: id } });
        await tx.proposalFieldValue.createMany({
          data: data.fieldValues.map((f) => ({ proposalId: id, fieldKey: f.fieldKey, label: f.label, value: f.value })),
        });
      }
      if (data.textBlocks !== undefined) {
        await tx.proposalTextBlock.deleteMany({ where: { proposalId: id } });
        await tx.proposalTextBlock.createMany({
          data: data.textBlocks.map((t) => ({ proposalId: id, title: t.title, content: t.content, order: t.order })),
        });
      }

      return tx.proposal.update({
        where: { id },
        data: baseData,
        include: { items: { orderBy: { order: 'asc' } }, fieldValues: true, textBlocks: { orderBy: { order: 'asc' } }, type: true },
      });
    });

    await logActivity(fastify.prisma, {
      userId: (request.user as any).id,
      action: 'proposal.update',
      entityType: 'Proposal',
      entityId: id,
      message: `Atualizou a proposta: ${updated.title}`,
    });

    return updated;
  });
```

- [ ] **Step 2: Verificar build**

Run: `cd backend && npm run build`
Expected: compila sem erros.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/proposals.ts
git commit -m "feat(propostas): edição replace-all de itens/campos/blocos com recálculo"
```

### Task 7: Ajustar o aceite (usar total + gravar proposalId)

**Files:**
- Modify: `backend/src/routes/proposals.ts`

- [ ] **Step 1: Ajustar a dedup e a criação da transação no `statusHandler`**

Dentro de `statusHandler`, no bloco `if (isAcceptedStatus(status)) { ... }`, substitua a busca `existingTransaction` por uma dedup baseada em `proposalId`:

```ts
        const existingTransaction = await tx.financialTransaction.findFirst({
          where: { proposalId: updatedProposal.id, type: 'INCOME' },
        });
```

E substitua o bloco `transaction = await tx.financialTransaction.create({ ... })` por:

```ts
        transaction = await tx.financialTransaction.create({
          data: {
            projectId: resolvedProjectId || null,
            clientId: resolvedClientId,
            proposalId: updatedProposal.id,
            type: 'INCOME',
            amount: updatedProposal.total,
            currency: updatedProposal.currency,
            amountCup: updatedProposal.total,
            exchangeRateUsed: 1,
            description: proposalTransactionDescription(updatedProposal),
            status: 'SETTLED',
            date: todayBrazilDateOnly(),
          },
        });
```

- [ ] **Step 2: Gravar `acceptedAt` ao aceitar**

Logo após `const updatedProposal = await tx.proposal.update({ where: { id }, data: { status } });`, substitua essa linha por:

```ts
      const updatedProposal = await tx.proposal.update({
        where: { id },
        data: { status, ...(isAcceptedStatus(status) ? { acceptedAt: todayBrazilDateOnly() } : {}) },
      });
```

- [ ] **Step 3: Verificar build**

Run: `cd backend && npm run build`
Expected: compila sem erros.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/proposals.ts
git commit -m "feat(propostas): aceite usa total e grava proposalId na transação"
```

---

## Phase 4 — Frontend: tipos e cliente de API

### Task 8: Tipos TS e métodos de API

**Files:**
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Adicionar os tipos**

Em `frontend/src/api/client.ts`, antes da linha `export const api = new ApiClient();`, adicione:

```ts
export type ProposalFieldType = 'text' | 'number' | 'boolean' | 'select';

export type ProposalTypeField = {
  id?: number;
  label: string;
  key: string;
  fieldType: ProposalFieldType;
  options?: string | null;
  required: boolean;
  order: number;
};

export type ProposalTypeTextBlock = { id?: number; title: string; content: string; order: number };
export type ProposalTypeItem = { id?: number; description: string; qty: number; unitPrice: number; discount: number; tax: number; order: number };

export type ProposalType = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  active: boolean;
  defaultCurrency: string;
  paymentTermsDefault?: string | null;
  fields: ProposalTypeField[];
  textBlocks: ProposalTypeTextBlock[];
  items: ProposalTypeItem[];
};

export type ProposalItem = {
  id?: number;
  description: string;
  qty: number;
  unitPrice: number;
  discount: number;
  tax: number;
  lineTotal?: number;
  recurring: boolean;
  order: number;
};

export type ProposalFieldValue = { id?: number; fieldKey: string; label: string; value: string };
export type ProposalTextBlockValue = { id?: number; title: string; content: string; order: number };

export type Proposal = {
  id: number;
  number?: string | null;
  title: string;
  description?: string | null;
  value: number;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  currency: string;
  validUntil?: string | null;
  clientName?: string | null;
  status: string;
  typeId?: number | null;
  type?: { id: number; name: string } | null;
  clientId?: number | null;
  leadId?: number | null;
  items?: ProposalItem[];
  fieldValues?: ProposalFieldValue[];
  textBlocks?: ProposalTextBlockValue[];
};
```

- [ ] **Step 2: Estender `proposalApi` e adicionar `proposalTypeApi`**

Substitua o objeto `proposalApi` por:

```ts
export const proposalApi = {
  getAll: () => api.get<Proposal[]>('/api/proposals'),
  get: (id: number) => api.get<Proposal>(`/api/proposals/${id}`),
  create: (data: any) => api.post<Proposal>('/api/proposals', data),
  update: (id: number, data: any) => api.put<Proposal>(`/api/proposals/${id}`, data),
  updateStatus: (id: number, status: string, projectId?: number) => api.put<any>(`/api/proposals/${id}/status`, { status, projectId }),
  delete: (id: number) => api.delete<any>(`/api/proposals/${id}`),
};

export const proposalTypeApi = {
  getAll: () => api.get<ProposalType[]>('/api/proposal-types'),
  get: (id: number) => api.get<ProposalType>(`/api/proposal-types/${id}`),
  create: (data: any) => api.post<ProposalType>('/api/proposal-types', data),
  update: (id: number, data: any) => api.put<ProposalType>(`/api/proposal-types/${id}`, data),
  delete: (id: number) => api.delete<any>(`/api/proposal-types/${id}`),
};
```

> Nota: se já existir um `export type Proposal` no arquivo, substitua-o pela versão acima em vez de duplicar.

- [ ] **Step 3: Verificar typecheck**

Run: `cd frontend && npm run build`
Expected: compila (pode falhar só se `Proposals.tsx` usar campos antigos — será ajustado na Phase 6; se falhar aqui, siga e corrija na Phase 6).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "feat(propostas): tipos e métodos de API no frontend"
```

---

## Phase 5 — Frontend: util de placeholders e cálculo espelhado

### Task 9: Utils compartilhados do frontend

**Files:**
- Create: `frontend/src/utils/proposalTotals.ts`
- Create: `frontend/src/utils/proposalTemplate.ts`

- [ ] **Step 1: Espelho do cálculo de totais (para preview ao vivo)**

Create `frontend/src/utils/proposalTotals.ts`:

```ts
export interface LineInput { qty: number; unitPrice: number; discount: number; tax: number; }

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const lineTotal = (l: LineInput) => round2(l.qty * l.unitPrice - l.discount + l.tax);

export function proposalTotals(lines: LineInput[]) {
  const subtotal = round2(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0));
  const discountTotal = round2(lines.reduce((s, l) => s + l.discount, 0));
  const taxTotal = round2(lines.reduce((s, l) => s + l.tax, 0));
  const total = round2(subtotal - discountTotal + taxTotal);
  return { subtotal, discountTotal, taxTotal, total };
}
```

- [ ] **Step 2: Resolução de placeholders `{{chave}}`**

Create `frontend/src/utils/proposalTemplate.ts`:

```ts
export type PlaceholderMap = Record<string, string>;

// Substitui {{chave}} pelos valores do mapa. Chaves ausentes viram string vazia.
export function resolvePlaceholders(text: string, values: PlaceholderMap): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => values[key] ?? '');
}

// Monta o mapa a partir dos valores de campos-chave + embutidos.
export function buildPlaceholderMap(
  fieldValues: { fieldKey: string; value: string }[],
  builtins: { cliente?: string; total?: string; validade?: string },
): PlaceholderMap {
  const map: PlaceholderMap = {};
  for (const fv of fieldValues) map[fv.fieldKey] = fv.value;
  if (builtins.cliente !== undefined) map.cliente = builtins.cliente;
  if (builtins.total !== undefined) map.total = builtins.total;
  if (builtins.validade !== undefined) map.validade = builtins.validade;
  return map;
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `cd frontend && npm run build`
Expected: compila (mesma ressalva da Task 8).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/proposalTotals.ts frontend/src/utils/proposalTemplate.ts
git commit -m "feat(propostas): utils de totais e placeholders no frontend"
```

---

## Phase 6 — Frontend: configurador de tipos (Settings)

### Task 10: Aba "Tipos de Proposta" em Configurações

**Files:**
- Create: `frontend/src/components/proposals/ProposalTypeManager.tsx`
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Criar o componente gerenciador de tipos**

Create `frontend/src/components/proposals/ProposalTypeManager.tsx` com um CRUD completo. O componente:
- Lista os tipos (`proposalTypeApi.getAll`).
- Abre um formulário com: nome, descrição, moeda padrão, condições de pagamento, e três listas editáveis (campos-chave, blocos de texto, itens de escopo), cada uma com adicionar/remover/reordenar (mover ↑/↓ trocando `order`).
- Salva via `create`/`update` e remove via `delete`.

```tsx
import { useEffect, useState } from 'react';
import { proposalTypeApi, type ProposalType, type ProposalTypeField, type ProposalTypeTextBlock, type ProposalTypeItem } from '../../api/client';

type Draft = {
  id?: number;
  name: string;
  description: string;
  defaultCurrency: string;
  paymentTermsDefault: string;
  active: boolean;
  fields: ProposalTypeField[];
  textBlocks: ProposalTypeTextBlock[];
  items: ProposalTypeItem[];
};

const emptyDraft = (): Draft => ({
  name: '', description: '', defaultCurrency: 'BRL', paymentTermsDefault: '', active: true,
  fields: [], textBlocks: [], items: [],
});

export default function ProposalTypeManager() {
  const [types, setTypes] = useState<ProposalType[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => setTypes(await proposalTypeApi.getAll());
  useEffect(() => { load(); }, []);

  const startNew = () => setDraft(emptyDraft());
  const startEdit = (t: ProposalType) => setDraft({
    id: t.id, name: t.name, description: t.description ?? '', defaultCurrency: t.defaultCurrency,
    paymentTermsDefault: t.paymentTermsDefault ?? '', active: t.active,
    fields: t.fields.map((f) => ({ ...f })), textBlocks: t.textBlocks.map((b) => ({ ...b })), items: t.items.map((i) => ({ ...i })),
  });

  const save = async () => {
    if (!draft) return;
    setLoading(true);
    try {
      const payload = {
        name: draft.name, description: draft.description, defaultCurrency: draft.defaultCurrency,
        paymentTermsDefault: draft.paymentTermsDefault, active: draft.active,
        fields: draft.fields.map((f, i) => ({ ...f, order: i })),
        textBlocks: draft.textBlocks.map((b, i) => ({ ...b, order: i })),
        items: draft.items.map((it, i) => ({ ...it, order: i })),
      };
      if (draft.id) await proposalTypeApi.update(draft.id, payload);
      else await proposalTypeApi.create(payload);
      setDraft(null);
      await load();
    } finally { setLoading(false); }
  };

  const remove = async (id: number) => {
    if (!confirm('Remover este tipo? Propostas já criadas não são afetadas.')) return;
    await proposalTypeApi.delete(id);
    await load();
  };

  const upd = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  if (draft) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="border rounded px-3 py-2" placeholder="Nome do tipo (ex: ERP)" value={draft.name} onChange={(e) => upd({ name: e.target.value })} />
          <input className="border rounded px-3 py-2" placeholder="Moeda padrão" value={draft.defaultCurrency} onChange={(e) => upd({ defaultCurrency: e.target.value })} />
          <input className="border rounded px-3 py-2 md:col-span-2" placeholder="Descrição" value={draft.description} onChange={(e) => upd({ description: e.target.value })} />
          <textarea className="border rounded px-3 py-2 md:col-span-2" placeholder="Condições de pagamento padrão (ex: 50% entrada)" value={draft.paymentTermsDefault} onChange={(e) => upd({ paymentTermsDefault: e.target.value })} />
        </div>

        <Section title="Campos-chave">
          {draft.fields.map((f, i) => (
            <div key={i} className="flex flex-wrap gap-2 items-center">
              <input className="border rounded px-2 py-1" placeholder="Rótulo" value={f.label} onChange={(e) => upd({ fields: draft.fields.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
              <input className="border rounded px-2 py-1" placeholder="chave" value={f.key} onChange={(e) => upd({ fields: draft.fields.map((x, j) => j === i ? { ...x, key: e.target.value } : x) })} />
              <select className="border rounded px-2 py-1" value={f.fieldType} onChange={(e) => upd({ fields: draft.fields.map((x, j) => j === i ? { ...x, fieldType: e.target.value as any } : x) })}>
                <option value="text">texto</option><option value="number">número</option><option value="boolean">sim/não</option><option value="select">seleção</option>
              </select>
              <button className="text-red-500" onClick={() => upd({ fields: draft.fields.filter((_, j) => j !== i) })}>remover</button>
            </div>
          ))}
          <button className="text-blue-600" onClick={() => upd({ fields: [...draft.fields, { label: '', key: '', fieldType: 'text', required: false, order: draft.fields.length }] })}>+ campo</button>
        </Section>

        <Section title="Blocos de texto">
          {draft.textBlocks.map((b, i) => (
            <div key={i} className="space-y-1">
              <input className="border rounded px-2 py-1 w-full" placeholder="Título do bloco" value={b.title} onChange={(e) => upd({ textBlocks: draft.textBlocks.map((x, j) => j === i ? { ...x, title: e.target.value } : x) })} />
              <textarea className="border rounded px-2 py-1 w-full" placeholder="Conteúdo (use {{chave}} para inserir campos)" value={b.content} onChange={(e) => upd({ textBlocks: draft.textBlocks.map((x, j) => j === i ? { ...x, content: e.target.value } : x) })} />
              <button className="text-red-500" onClick={() => upd({ textBlocks: draft.textBlocks.filter((_, j) => j !== i) })}>remover</button>
            </div>
          ))}
          <button className="text-blue-600" onClick={() => upd({ textBlocks: [...draft.textBlocks, { title: '', content: '', order: draft.textBlocks.length }] })}>+ bloco</button>
        </Section>

        <Section title="Itens de escopo padrão">
          {draft.items.map((it, i) => (
            <div key={i} className="flex flex-wrap gap-2 items-center">
              <input className="border rounded px-2 py-1 flex-1" placeholder="Descrição" value={it.description} onChange={(e) => upd({ items: draft.items.map((x, j) => j === i ? { ...x, description: e.target.value } : x) })} />
              <input type="number" className="border rounded px-2 py-1 w-20" placeholder="qtd" value={it.qty} onChange={(e) => upd({ items: draft.items.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x) })} />
              <input type="number" className="border rounded px-2 py-1 w-28" placeholder="unitário" value={it.unitPrice} onChange={(e) => upd({ items: draft.items.map((x, j) => j === i ? { ...x, unitPrice: Number(e.target.value) } : x) })} />
              <button className="text-red-500" onClick={() => upd({ items: draft.items.filter((_, j) => j !== i) })}>remover</button>
            </div>
          ))}
          <button className="text-blue-600" onClick={() => upd({ items: [...draft.items, { description: '', qty: 1, unitPrice: 0, discount: 0, tax: 0, order: draft.items.length }] })}>+ item</button>
        </Section>

        <div className="flex gap-2">
          <button disabled={loading || !draft.name} className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50" onClick={save}>Salvar tipo</button>
          <button className="border rounded px-4 py-2" onClick={() => setDraft(null)}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Tipos de Proposta</h3>
        <button className="bg-blue-600 text-white rounded px-4 py-2" onClick={startNew}>+ Novo tipo</button>
      </div>
      <div className="grid gap-2">
        {types.map((t) => (
          <div key={t.id} className="border rounded p-3 flex justify-between items-center">
            <div>
              <p className="font-medium">{t.name}</p>
              <p className="text-sm text-slate-500">{t.items.length} itens · {t.fields.length} campos · {t.textBlocks.length} blocos</p>
            </div>
            <div className="flex gap-3">
              <button className="text-blue-600" onClick={() => startEdit(t)}>editar</button>
              <button className="text-red-500" onClick={() => remove(t.id)}>remover</button>
            </div>
          </div>
        ))}
        {types.length === 0 && <p className="text-slate-500">Nenhum tipo ainda. Crie o primeiro (ex: "ERP").</p>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded p-3 space-y-2">
      <p className="font-medium">{title}</p>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Plugar a aba no Settings**

Em `frontend/src/pages/Settings.tsx`: importe o componente no topo —
```tsx
import ProposalTypeManager from '../components/proposals/ProposalTypeManager';
```
Localize onde as abas são definidas (a página já usa abas via querystring `?tab=`). Adicione uma aba `tipos-proposta` à lista de abas (com rótulo "Tipos de Proposta") e renderize `<ProposalTypeManager />` quando essa aba estiver ativa, seguindo exatamente o mesmo padrão das abas existentes (`equipe`, `perfil`). Mantenha o estilo dos botões/condicional idêntico ao que já existe no arquivo.

- [ ] **Step 3: Verificar build + lint**

Run: `cd frontend && npm run build && npm run lint`
Expected: compila e passa no lint.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/proposals/ProposalTypeManager.tsx frontend/src/pages/Settings.tsx
git commit -m "feat(propostas): aba de configuração de tipos em Settings"
```

---

## Phase 7 — Frontend: editor de proposta

### Task 11: Editor com tipo, campos-chave, itens e blocos

**Files:**
- Create: `frontend/src/components/proposals/ProposalItemsTable.tsx`
- Modify: `frontend/src/pages/Proposals.tsx`

- [ ] **Step 1: Criar a tabela de itens com totais ao vivo**

Create `frontend/src/components/proposals/ProposalItemsTable.tsx`:

```tsx
import { type ProposalItem } from '../../api/client';
import { lineTotal, proposalTotals } from '../../utils/proposalTotals';

type Props = { items: ProposalItem[]; currency: string; onChange: (items: ProposalItem[]) => void };

export default function ProposalItemsTable({ items, currency, onChange }: Props) {
  const fmt = (n: number) => `${currency} ${n.toFixed(2)}`;
  const upd = (i: number, patch: Partial<ProposalItem>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const add = () => onChange([...items, { description: '', qty: 1, unitPrice: 0, discount: 0, tax: 0, recurring: false, order: items.length }]);
  const totals = proposalTotals(items);

  return (
    <div className="space-y-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            <th>Descrição</th><th className="w-16">Qtd</th><th className="w-28">Unitário</th>
            <th className="w-24">Desconto</th><th className="w-24">Imposto</th><th className="w-28 text-right">Total</th><th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td><input className="border rounded px-2 py-1 w-full" value={it.description} onChange={(e) => upd(i, { description: e.target.value })} /></td>
              <td><input type="number" className="border rounded px-2 py-1 w-full" value={it.qty} onChange={(e) => upd(i, { qty: Number(e.target.value) })} /></td>
              <td><input type="number" className="border rounded px-2 py-1 w-full" value={it.unitPrice} onChange={(e) => upd(i, { unitPrice: Number(e.target.value) })} /></td>
              <td><input type="number" className="border rounded px-2 py-1 w-full" value={it.discount} onChange={(e) => upd(i, { discount: Number(e.target.value) })} /></td>
              <td><input type="number" className="border rounded px-2 py-1 w-full" value={it.tax} onChange={(e) => upd(i, { tax: Number(e.target.value) })} /></td>
              <td className="text-right">{fmt(lineTotal(it))}</td>
              <td><button className="text-red-500" onClick={() => onChange(items.filter((_, j) => j !== i))}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="text-blue-600" onClick={add}>+ item</button>
      <div className="text-right space-y-1 text-sm">
        <p>Subtotal: {fmt(totals.subtotal)}</p>
        <p>Desconto: {fmt(totals.discountTotal)}</p>
        <p>Imposto: {fmt(totals.taxTotal)}</p>
        <p className="font-semibold text-base">Total: {fmt(totals.total)}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Integrar no formulário de proposta**

Em `frontend/src/pages/Proposals.tsx`:
- Importe `proposalTypeApi`, `ProposalItemsTable` e os tipos `Proposal`, `ProposalItem`, `ProposalType`, `ProposalFieldValue`, `ProposalTextBlockValue`.
- No estado do formulário de criar/editar, adicione: `typeId`, `currency`, `items: ProposalItem[]`, `fieldValues: ProposalFieldValue[]`, `textBlocks: ProposalTextBlockValue[]`.
- Carregue os tipos (`proposalTypeApi.getAll()`) ao montar; mostre um `<select>` de tipo no topo do formulário de NOVA proposta.
- Ao escolher um tipo na criação, faça `proposalTypeApi.get(id)` e popule `items` (a partir de `type.items`, com `recurring:false`), `fieldValues` (de `type.fields` → `{ fieldKey:f.key, label:f.label, value:'' }`), `textBlocks` (de `type.textBlocks`), e `currency = type.defaultCurrency`.
- Renderize: seção de campos-chave (um input por `fieldValue`, tipo conforme o field — para simplicidade inicial use input de texto; número usa `type=number`), `<ProposalItemsTable items={items} currency={currency} onChange={setItems} />`, e uma seção de blocos de texto (um `<textarea>` por bloco).
- No submit de criar: envie `{ title, description, validUntil, clientName, clientId, leadId, typeId, currency, items, fieldValues, textBlocks, status:'DRAFT' }` para `proposalApi.create`.
- No submit de editar: envie os mesmos campos para `proposalApi.update(id, ...)`.
- Substitua qualquer referência antiga a `proposal.value` (campo único) por `proposal.total` na listagem.
- Adicione um botão "Visualizar documento" em cada proposta que navega para `/proposals/${id}/view` (use `useNavigate` ou `<Link>`).
- Ajuste os botões de status para o ciclo novo: `DRAFT`, `SENT`, `ACCEPTED`, `REJECTED`, `EXPIRED` (use `proposalApi.updateStatus`).

> Mantenha o restante da tela (lista, filtros, exclusão) funcionando; só adapte os pontos acima. Se a tela ficar grande, extraia o formulário para `frontend/src/components/proposals/ProposalForm.tsx`.

- [ ] **Step 3: Verificar build + lint**

Run: `cd frontend && npm run build && npm run lint`
Expected: compila e passa no lint.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/proposals/ProposalItemsTable.tsx frontend/src/pages/Proposals.tsx
git commit -m "feat(propostas): editor com tipo, campos-chave, itens e blocos"
```

---

## Phase 8 — Frontend: documento (página de visualização)

### Task 12: Página do documento + rota + print CSS

**Files:**
- Create: `frontend/src/pages/ProposalDocument.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Criar a página do documento**

Create `frontend/src/pages/ProposalDocument.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { proposalApi, companyApi, type Proposal } from '../api/client';
import { resolvePlaceholders, buildPlaceholderMap } from '../utils/proposalTemplate';

export default function ProposalDocument() {
  const { id } = useParams();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [company, setCompany] = useState<{ companyName: string; companyLogoUrl: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    proposalApi.get(Number(id)).then(setProposal);
    companyApi.get().then((c) => setCompany({ companyName: c.companyName, companyLogoUrl: c.companyLogoUrl }));
  }, [id]);

  if (!proposal) return <div className="p-8">Carregando…</div>;

  const fmt = (n: number) => `${proposal.currency} ${n.toFixed(2)}`;
  const placeholders = buildPlaceholderMap(
    (proposal.fieldValues ?? []).map((f) => ({ fieldKey: f.fieldKey, value: f.value })),
    {
      cliente: proposal.clientName ?? proposal.client?.name ?? '',
      total: fmt(proposal.total),
      validade: proposal.validUntil ? new Date(proposal.validUntil).toLocaleDateString('pt-BR') : '',
    },
  );

  return (
    <div className="proposal-doc max-w-3xl mx-auto bg-white text-slate-800 p-10">
      <header className="flex items-center justify-between border-b pb-4 mb-6">
        <div>
          {company?.companyLogoUrl && <img src={company.companyLogoUrl} alt="logo" className="h-12 mb-2" />}
          <h1 className="text-xl font-bold">{company?.companyName ?? 'Proposta'}</h1>
        </div>
        <div className="text-right text-sm">
          <p className="font-semibold">{proposal.number}</p>
          <p>{placeholders.validade && `Válida até ${placeholders.validade}`}</p>
        </div>
      </header>

      <h2 className="text-2xl font-bold mb-1">{proposal.title}</h2>
      <p className="text-slate-500 mb-6">Cliente: {placeholders.cliente}</p>

      {(proposal.textBlocks ?? []).map((b, i) => (
        <section key={i} className="mb-5">
          <h3 className="font-semibold mb-1">{b.title}</h3>
          <p className="whitespace-pre-wrap">{resolvePlaceholders(b.content, placeholders)}</p>
        </section>
      ))}

      <table className="w-full text-sm my-6">
        <thead>
          <tr className="text-left border-b">
            <th className="py-1">Descrição</th><th className="text-right">Qtd</th>
            <th className="text-right">Unitário</th><th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {(proposal.items ?? []).map((it, i) => (
            <tr key={i} className="border-b">
              <td className="py-1">{it.description}</td>
              <td className="text-right">{it.qty}</td>
              <td className="text-right">{fmt(it.unitPrice)}</td>
              <td className="text-right">{fmt(it.lineTotal ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="text-right space-y-1">
        <p>Subtotal: {fmt(proposal.subtotal)}</p>
        <p>Desconto: {fmt(proposal.discountTotal)}</p>
        <p>Imposto: {fmt(proposal.taxTotal)}</p>
        <p className="text-lg font-bold">Total: {fmt(proposal.total)}</p>
      </div>

      <div className="no-print mt-8">
        <button className="bg-blue-600 text-white rounded px-4 py-2" onClick={() => window.print()}>Salvar como PDF</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Adicionar a rota**

Em `frontend/src/App.tsx`: importe `ProposalDocument` e adicione, dentro das rotas protegidas (junto às demais `<Route>`):

```tsx
<Route path="proposals/:id/view" element={<ProposalDocument />} />
```

- [ ] **Step 3: CSS de impressão**

Em `frontend/src/index.css`, adicione ao final:

```css
@media print {
  body { background: #fff; }
  .no-print, nav, aside, header.app-header { display: none !important; }
  .proposal-doc { box-shadow: none; margin: 0; padding: 0; max-width: 100%; }
}
```

> Se a sidebar/menu tiver classes diferentes de `nav`/`aside`, ajuste o seletor para esconder o layout ao imprimir (o objetivo é o PDF mostrar só `.proposal-doc`).

- [ ] **Step 4: Verificar build + lint**

Run: `cd frontend && npm run build && npm run lint`
Expected: compila e passa no lint.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ProposalDocument.tsx frontend/src/App.tsx frontend/src/index.css
git commit -m "feat(propostas): documento da proposta com export PDF pelo navegador"
```

---

## Phase 9 — Finalização e verificação

### Task 13: README e verificação manual end-to-end

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Atualizar o README**

Em `README.md`, na seção "Funcionalidades", adicione uma subseção "Propostas" descrevendo: tipos configuráveis (ERP, Website, etc.), itens com qtd/desconto/imposto, campos-chave com placeholders, documento exportável em PDF, e ciclo DRAFT→SENT→ACCEPTED/REJECTED/EXPIRED. Liste os endpoints novos `/api/proposal-types` e `/api/proposals` (get/:id, create com snapshot).

- [ ] **Step 2: Build completo**

Run:
```bash
cd backend && npm run build && npm test
cd ../frontend && npm run build && npm run lint
```
Expected: backend compila e testes verdes; frontend compila e lint limpo.

- [ ] **Step 3: Roteiro manual (suba backend e frontend)**

Run backend: `cd backend && npm run dev` · Run frontend: `cd frontend && npm run dev`

Verifique, na ordem:
1. Em Configurações → "Tipos de Proposta", crie o tipo "ERP" com: 2 itens de escopo, 1 campo-chave `nro_modulos` (número), 1 bloco de texto contendo `Inclui {{nro_modulos}} módulos.`
2. Em Propostas → nova proposta, escolha o tipo "ERP". Confirme que itens, campo e bloco vieram preenchidos (snapshot).
3. Preencha `nro_modulos = 5`, ajuste um item, observe o Total recalcular ao vivo. Salve.
4. Clique "Visualizar documento": confirme que o bloco mostra "Inclui 5 módulos.", a tabela e o total aparecem, e "Salvar como PDF" abre o diálogo de impressão só com o documento.
5. Volte, edite o tipo "ERP" (mude um item). Reabra a proposta antiga: deve permanecer inalterada (snapshot).
6. Marque a proposta como ACCEPTED. Confirme em Finanças que foi criada uma transação INCOME com o `total` correto e vinculada à proposta (campo `proposalId`).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: documenta Propostas v2"
```

---

## Self-review (preenchido)

- **Cobertura do spec:** modelo de dados (Task 1) · totais + teste (Tasks 2-3) · CRUD de tipos (Task 4) · snapshot/numeração (Task 5) · edição/recálculo (Task 6) · aceite com total+proposalId (Task 7) · API frontend (Task 8) · utils placeholders/totais (Task 9) · configurador em Settings (Task 10) · editor (Task 11) · documento+PDF+print (Task 12) · README+verificação (Task 13). Itens "fora de escopo" do spec (link público, recorrência real, alertas, cálculo por campo) não viram tarefas — apenas `publicToken` e flag `recurring` ficam reservados no schema.
- **Consistência de tipos:** nomes batem entre tasks — `computeLineTotal`/`computeProposalTotals` (backend), `lineTotal`/`proposalTotals` (frontend), `proposalTypeApi`, `proposalApi.get`, campos `total/subtotal/discountTotal/taxTotal`, `fieldValues`, `textBlocks`, `items`.
- **Placeholders:** nenhum "TBD"; as duas tasks de frontend com integração em arquivos grandes (Task 10 step 2, Task 11 step 2) descrevem ações concretas porque exigem adaptação a código existente que varia — o código novo (componentes/utils) está completo.
