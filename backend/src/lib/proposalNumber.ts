import type { PrismaClient } from '@prisma/client';

// Gera "P-AAAA-NNN" sequencial por ano com base no maior número existente.
// Usa o máximo NUMÉRICO (não ordenação lexicográfica) para continuar correto
// mesmo quando a sequência passa de 3 dígitos.
export async function nextProposalNumber(prisma: PrismaClient, year: number): Promise<string> {
  const prefix = `P-${year}-`;
  const existing = await prisma.proposal.findMany({
    where: { number: { startsWith: prefix } },
    select: { number: true },
  });
  const maxSeq = existing.reduce((max, p) => {
    const seq = p.number ? parseInt(p.number.slice(prefix.length), 10) : 0;
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}
