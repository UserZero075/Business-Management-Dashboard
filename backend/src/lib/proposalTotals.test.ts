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
