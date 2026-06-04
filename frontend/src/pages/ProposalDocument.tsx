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
