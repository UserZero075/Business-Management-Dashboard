import { useEffect, useState } from 'react';
import { proposalTypeApi, type ProposalType, type ProposalTypeField, type ProposalTypeTextBlock, type ProposalTypeItem, type ProposalFieldType } from '../../api/client';
import { useToast } from '../../hooks/useToast';

const normalizeKey = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');

const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

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
  const toast = useToast();
  const [types, setTypes] = useState<ProposalType[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const data = await proposalTypeApi.getAll();
    setTypes(data);
  };

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    } catch (err) {
      toast.error(getErrorMessage(err, 'Erro ao salvar tipo de proposta.'));
    } finally { setLoading(false); }
  };

  const remove = async (id: number) => {
    if (!confirm('Remover este tipo? Propostas já criadas não são afetadas.')) return;
    try {
      await proposalTypeApi.delete(id);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Erro ao remover tipo de proposta.'));
    }
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
              <input className="border rounded px-2 py-1" placeholder="chave" value={f.key} onChange={(e) => upd({ fields: draft.fields.map((x, j) => j === i ? { ...x, key: normalizeKey(e.target.value) } : x) })} />
              <select className="border rounded px-2 py-1" value={f.fieldType} onChange={(e) => upd({ fields: draft.fields.map((x, j) => j === i ? { ...x, fieldType: e.target.value as ProposalFieldType } : x) })}>
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
