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
              <td><button type="button" className="text-red-500" onClick={() => onChange(items.filter((_, j) => j !== i))}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="text-blue-600" onClick={add}>+ item</button>
      <div className="text-right space-y-1 text-sm">
        <p>Subtotal: {fmt(totals.subtotal)}</p>
        <p>Desconto: {fmt(totals.discountTotal)}</p>
        <p>Imposto: {fmt(totals.taxTotal)}</p>
        <p className="font-semibold text-base">Total: {fmt(totals.total)}</p>
      </div>
    </div>
  );
}
