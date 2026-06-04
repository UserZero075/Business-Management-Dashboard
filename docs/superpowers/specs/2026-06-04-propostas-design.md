# Design — Propostas v2: Gerador de propostas por tipo

Data: 2026-06-04
Módulo: Propostas (ponto 2 do refino do ERP Widder)
Status: aprovado para planejamento

## Contexto

O ERP hoje trata uma proposta como um registro interno com um **valor único**
(`Proposal.value: Float`), sem itens, sem documento apresentável e sem
reaproveitamento. A automação de "aceitar → cria projeto + transação" já existe
e funciona (`backend/src/routes/proposals.ts`).

Contexto de uso: 2-3 sócios, ~10 negócios/mês, acompanhados de perto. O foco é
**profundidade e capricho por proposta**, não automação de volume.

## Objetivo

Transformar Propostas em um **gerador configurável por tipo de serviço**
(ERP, Website, Automação, Robôs… cadastráveis pelo usuário, nada hardcoded).
Escolher um tipo traz a proposta semi-pronta; o usuário edita e gera um
documento apresentável (página web → PDF pelo navegador).

### Decisões tomadas no brainstorming

- **Documento:** página web caprichada otimizada para impressão; o usuário
  exporta PDF pelo próprio navegador. Sem dependência pesada no Docker. Essa
  mesma página é a base do futuro link público de aceite.
- **Campos-chave:** tipados (texto, número, sim/não, seleção) e inseríveis nos
  blocos de texto via placeholder `{{chave}}`. Cálculo de preço a partir deles
  fica para o futuro.
- **Itens de escopo:** linhas completas com quantidade, desconto e imposto por
  linha; moeda única por proposta (padrão USD); totais calculados.
- **Snapshot:** ao criar a proposta a partir de um tipo, o conteúdo do tipo é
  **copiado** para dentro da proposta. Editar o tipo depois não altera propostas
  já criadas (histórico fiel).
- **Reaproveitar** a lógica atual de aceite (criar projeto + transação), apenas
  estendê-la.

## Modelo de dados

### Lado "molde" (configurável em Configurações)

```
ProposalType            # ex: "ERP", "Website", "Automação", "Robôs"
  id, name, slug, description, active
  defaultCurrency (default "USD"), paymentTermsDefault (texto)
  createdAt, updatedAt

ProposalTypeField       # definição dos campos-chave do tipo
  id, typeId -> ProposalType (cascade)
  label ("nº de módulos"), key ("nro_modulos")
  fieldType: text | number | boolean | select
  options (JSON, usado quando fieldType = select)
  required (bool), order (int)

ProposalTypeTextBlock   # blocos de texto padrão (intro, prazo, termos, garantia)
  id, typeId -> ProposalType (cascade)
  title, content (pode conter {{chave}}), order

ProposalTypeItem        # itens de escopo padrão (semente)
  id, typeId -> ProposalType (cascade)
  description, qty, unitPrice, discount, tax, order
```

### Lado "proposta real" (snapshot + edição livre)

```
Proposal (estende o model atual)
  + number              # "P-2026-001", único, sequencial
  + typeId?             # de qual tipo nasceu (nulo = proposta em branco)
  + currency            # default "USD"
  + subtotal, discountTotal, taxTotal, total   # calculados dos itens
  + status: DRAFT | SENT | ACCEPTED | REJECTED | EXPIRED  (default DRAFT)
  + sentAt?, acceptedAt?
  + publicToken?        # reservado para o futuro link de aceite (não usado agora)
  (mantém: title, description, validUntil, clientId?, leadId?, clientName?)
  (value continua existindo, mantido em sincronia com total p/ não quebrar
   o código e as telas atuais)

ProposalItem            # linhas reais da proposta
  id, proposalId -> Proposal (cascade)
  description, qty, unitPrice, discount, tax, lineTotal, order
  recurring (bool, default false)   # marca mensalidade; usado na fase Finanças

ProposalFieldValue      # valores preenchidos dos campos-chave (snapshot)
  id, proposalId -> Proposal (cascade)
  fieldKey, label, value (string)

ProposalTextBlock       # blocos de texto da proposta (copiados do tipo, editáveis)
  id, proposalId -> Proposal (cascade)
  title, content, order
```

### Gancho para a fase de Finanças (adicionado agora)

```
FinancialTransaction
  + proposalId?  -> Proposal   # rastreia qual proposta gerou a receita
```

Custo baixo adicionar agora; evita migração futura. O uso pleno (recorrência,
alertas) vem na fase de Finanças.

### `model Contract`

Fora de escopo. Permanece como está (placeholder vazio). Seu destino será
decidido em uma fase futura de contratos.

## Cálculo de totais

Por linha: `lineTotal = qty * unitPrice - discount + tax`.

Na proposta:
- `subtotal = Σ (qty * unitPrice)`
- `discountTotal = Σ discount`
- `taxTotal = Σ tax`
- `total = subtotal - discountTotal + taxTotal`
- `value` é mantido igual a `total` (compatibilidade).

Esta é a parte com maior risco de erro silencioso → terá teste unitário
dedicado.

## O motor de tipos e o fluxo de criação

### Configuração (Configurações → aba "Tipos de Proposta")

CRUD completo de cada tipo:
- Dados do tipo (nome, descrição, moeda padrão, condições de pagamento padrão)
- Campos-chave (label, chave, tipo, obrigatório, ordem)
- Blocos de texto padrão (com botão "inserir campo `{{chave}}`")
- Itens de escopo padrão (descrição, qtd, unitário, desconto, imposto)

Tudo ordenável e editável. Começa vazio; o usuário cria seus próprios tipos.

### Fluxo de criar uma proposta

```
1. Nova proposta → escolhe o tipo (ou "em branco")
2. Sistema COPIA do tipo p/ a proposta (snapshot):
     - campos-chave (vazios, prontos p/ preencher) -> ProposalFieldValue
     - blocos de texto (placeholders ainda crus)    -> ProposalTextBlock
     - itens de escopo (valores sugeridos)           -> ProposalItem
3. Usuário edita: preenche campos-chave, ajusta itens, mexe nos textos,
   adiciona/remove linhas
4. Totais recalculam ao vivo
5. Salva como DRAFT
```

### Placeholders

Blocos de texto aceitam `{{chave}}`. Na renderização do documento, cada
`{{chave}}` é trocado pelo valor do campo-chave correspondente em
`ProposalFieldValue`. Placeholders sem valor ficam em branco (destacados no modo
de edição). Placeholders embutidos disponíveis: `{{cliente}}`, `{{total}}`,
`{{validade}}`.

## Editor, documento e ciclo de vida

### Editor (evolução de `frontend/src/pages/Proposals.tsx`)

- Cabeçalho: número, tipo, cliente/lead, validade, status
- Seção campos-chave (input por tipo: texto, número, toggle, dropdown)
- Seção itens (tabela editável; subtotal/desconto/imposto/total ao vivo)
- Seção blocos de texto (editor por bloco + inserir `{{...}}`)
- Ações: Salvar · Visualizar documento · Marcar como enviada · Aceitar · Recusar

A página atual (~27k) será **quebrada em componentes** (editor, tabela de itens,
blocos de texto, lista) para não inchar mais.

### Documento (página apresentável)

- Rota `/proposals/:id/view`
- Identidade da empresa (logo + nome de `Settings`), blocos de texto com
  placeholders resolvidos, tabela de itens, total, validade e condições
- CSS `@media print` para "Salvar como PDF" limpo (sem sidebar/menu)
- Base do futuro link público (trocar proteção por `publicToken` depois)

### Ciclo de vida

```
DRAFT ──(enviar)──▶ SENT ──┬─(aceitar)─▶ ACCEPTED
                           ├─(recusar)─▶ REJECTED
                           └─(vence validade)─▶ EXPIRED
```

- **EXPIRED**: por ora apenas estado/etiqueta (alerta automático fica na fase
  de Finanças; o gancho é `validUntil`).
- **ACCEPTED**: mantém a lógica atual (cria cliente se preciso → cria projeto →
  cria transação de receita). Ajustes: a transação usa o `total` dos itens e
  grava `proposalId`. Item recorrente entra como transação normal por ora; o
  flag `recurring` já fica salvo para a fase de Finanças.

## Impacto no código

- `backend/prisma/schema.prisma`: novos models (ProposalType + 3 filhos,
  ProposalItem, ProposalFieldValue, ProposalTextBlock), extensão de `Proposal`,
  `proposalId?` em `FinancialTransaction`.
- `backend/src/routes/proposals.ts`: CRUD de tipos, criação por snapshot,
  recálculo de totais, dados do documento; mantém e ajusta o aceite.
- `frontend/src/pages/Proposals.tsx`: quebrado em componentes; nova rota de
  visualização do documento.
- `frontend/src/pages/Settings.tsx`: nova aba "Tipos de Proposta".
- Sem novo item no menu lateral (Propostas já existe). README atualizado ao
  final.

## Fora de escopo (futuro, anotado)

- Link público de aceite pelo cliente (só `publicToken` reservado agora).
- Recorrência "de verdade" e alertas de expiração (fase de Finanças).
- Cálculo de preço a partir dos campos-chave.
- Assinatura eletrônica e envio de e-mail automático da proposta.

## Verificação

Sem test runner configurado. Critério de pronto:
- `cd backend && npm run build`
- `cd frontend && npm run build && npm run lint`
- Roteiro manual: criar tipo "ERP" → gerar proposta a partir dele → preencher
  campos/itens → ver placeholders resolvidos no documento → exportar PDF pelo
  navegador → aceitar → confirmar projeto e transação criados com `proposalId`
  e `total` corretos.
- Teste unitário dedicado ao cálculo de totais (linha e proposta).
