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
