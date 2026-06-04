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
