import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BRAZIL_UTC_OFFSET_HOURS = 3;

type NormalizationTarget = {
  model: string;
  label: string;
  fields: string[];
};

const targets: NormalizationTarget[] = [
  { model: 'financialTransaction', label: 'FinancialTransaction', fields: ['date', 'dueDate', 'paymentDate'] },
  { model: 'project', label: 'Project', fields: ['startDate', 'endDate'] },
  { model: 'proposal', label: 'Proposal', fields: ['validUntil'] },
  { model: 'vpsServer', label: 'VpsServer', fields: ['startDate', 'renewalDate'] },
  { model: 'infrastructureItem', label: 'InfrastructureItem', fields: ['startDate', 'renewalDate'] },
  { model: 'task', label: 'Task', fields: ['dueDate'] },
  { model: 'projectMetric', label: 'ProjectMetric', fields: ['date'] },
];

function normalizeDateOnly(value?: Date | null): Date | null {
  if (!value) return null;

  return new Date(Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
    BRAZIL_UTC_OFFSET_HOURS,
    0,
    0,
    0
  ));
}

function isUniqueConstraintError(error: unknown) {
  return (error as { code?: string })?.code === 'P2002';
}

async function normalizeTarget(target: NormalizationTarget) {
  const delegate = (prisma as any)[target.model];
  const select = Object.fromEntries(['id', ...target.fields].map((field) => [field, true]));
  const rows = await delegate.findMany({ select });

  let recordsUpdated = 0;
  let fieldsUpdated = 0;
  let skippedConflicts = 0;

  for (const row of rows) {
    const data: Record<string, Date> = {};

    for (const field of target.fields) {
      const current = row[field] as Date | null;
      const normalized = normalizeDateOnly(current);
      if (current && normalized && current.getTime() !== normalized.getTime()) {
        data[field] = normalized;
      }
    }

    const changedFields = Object.keys(data);
    if (changedFields.length > 0) {
      try {
        await delegate.update({ where: { id: row.id }, data });
        recordsUpdated += 1;
        fieldsUpdated += changedFields.length;
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        skippedConflicts += 1;
      }
    }
  }

  return {
    model: target.label,
    recordsChecked: rows.length,
    recordsUpdated,
    fieldsUpdated,
    skippedConflicts,
  };
}

async function main() {
  const results: Awaited<ReturnType<typeof normalizeTarget>>[] = [];

  for (const target of targets) {
    results.push(await normalizeTarget(target));
  }

  console.log(JSON.stringify({ timezone: 'America/Sao_Paulo', utcOffset: '-03:00', results }, null, 2));
}

main()
  .catch((error) => {
    console.error('Failed to normalize Brazil date fields.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
