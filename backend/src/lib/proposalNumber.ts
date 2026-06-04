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
