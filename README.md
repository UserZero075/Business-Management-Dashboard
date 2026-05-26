# DevFast Manager

Sistema de gestão integral para DevFast: controle de projetos, infraestrutura, finanças e equipe.

## Stack Tecnológica

- **Backend**: Node.js + Fastify + TypeScript + Prisma
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Banco de dados**: SQLite configurado, com possibilidade de troca para MySQL/PostgreSQL
- **Gráficos**: Recharts

## Estrutura do Projeto

```text
DevFast Manager/
├── backend/          # API REST
│   ├── src/
│   │   ├── routes/   # Endpoints da API
│   │   ├── services/ # Lógica de negócio
│   │   ├── db.ts     # Conexão com Prisma
│   │   └── index.ts  # Servidor principal
│   ├── prisma/       # Schema do banco de dados
│   └── package.json
├── frontend/         # Aplicação React
│   ├── src/
│   │   ├── api/        # Cliente da API
│   │   ├── components/ # Componentes de UI
│   │   ├── pages/      # Páginas
│   │   ├── hooks/      # Hooks customizados
│   │   └── App.tsx     # App principal
│   └── package.json
├── deploy.sh         # Script de deploy
├── Documentation/    # Documentação legada em espanhol e inglês
│   ├── es/
│   └── en/
└── README.md
```

## Instalação

### Produção rápida com Docker Compose

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edite backend/.env: JWT_SECRET e SMTP_* são obrigatórios em produção.
docker compose up -d --build
```

Acesso padrão:

```text
http://localhost:8080
http://<hostname-tailscale>:8080
```

Veja detalhes em [DEPLOYMENT.md](./DEPLOYMENT.md).

### Desenvolvimento

Backend:

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run dev         # porta 3001 por padrão
```

Frontend:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev         # porta 5173
```

O frontend usa API relativa por padrão em produção. Em desenvolvimento, com servidores separados, defina `VITE_API_URL=http://localhost:3001`.

## Funcionalidades

### Dashboard

- Resumo de receitas, despesas e resultado
- Projetos ativos e métricas
- Alertas de VPS sem projeto, bugs críticos e tarefas vencidas
- Taxas de câmbio USD/USDT/CUP pelo El Toque, com atualização automática a cada 24 horas
- Modo escuro com alertas visuais

### Projetos

- CRUD de projetos
- Estados: ACTIVE, PAUSED, ABANDONED, EXPERIMENTAL, RENTABLE
- Múltiplos membros e responsáveis
- Métricas de usuários totais, ativos, pagantes, indicados, gratuitos e por colaboração
- URLs públicas

### Infraestrutura

- Servidores VPS com provedor, custo e especificações
- Itens de infraestrutura, como domínios, bancos de dados e SSL
- Vínculo com projetos por percentual de custo
- Provedores
- Resumo de custos mensais

### Finanças

- Transações de receitas e despesas
- Moedas: USD, EUR, CUP, USDT e MLC
- Taxas de câmbio configuráveis manualmente
- Busca automática de taxas em `eltoque.com`
- Impacto por variação de moeda
- Resumo por projeto

### Tarefas e Bugs

- Kanban de tarefas por estado e prioridade
- Bugs com severidade: critical, high, medium e low
- Filtros por projeto
- Resumo geral por projeto
- Criador e responsável com avatar e link para o perfil

### Equipe

- Membros da equipe
- Papéis configuráveis: admin, founder, cofounder, marketing, developer e outros
- Projetos atribuídos por membro
- Perfil público com links para redes sociais
- Alteração de papéis pela interface

### Chat Interno

- Canais da empresa, cofundadores e mensagens privadas
- WebSocket com fallback HTTP
- Mensagens persistentes no banco de dados
- Avatar e nome com link para o perfil

### Perfil de Usuário

- Nome, bio e avatar
- Cor personalizada
- Links: GitHub, Facebook, LinkedIn e site pessoal
- Perfil público visível em Equipe, Chat e Tarefas

### Configuração da Empresa

- Nome da empresa personalizável
- Objetivo do gestor
- URL do logo
- Disponível em `/settings`

### Cadastro com OTP

- Solicita código OTP por e-mail antes do cadastro
- SMTP configurável por variáveis de ambiente
- Fallback para console em desenvolvimento
- Código de 6 dígitos com validade de 10 minutos

### Modo Escuro

- Alternância no cabeçalho
- Persistência em `localStorage`
- CSS otimizado para alertas, cores e barras de rolagem
- Layout responsivo para mobile

### Relatórios

- Gráfico de receitas e despesas dos últimos 12 meses
- Distribuição de resultados por projeto
- Top 5 projetos rentáveis
- Projetos no prejuízo
- Comparativo completo

## Configuração

### Variáveis de ambiente (`backend/.env`)

```bash
# Banco de dados
DATABASE_URL="file:./devfast.db"

# Autenticação
JWT_SECRET="seu-segredo-muito-seguro"

# Servidor
PORT=3001
HOST=0.0.0.0

# Taxas de câmbio
EL_TOQUE_URL="https://eltoque.com/tasas-de-cambio-de-moneda-en-cuba-hoy"

# SMTP para OTP
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="seu-email@gmail.com"
SMTP_PASS="sua-senha-de-app"
SMTP_FROM="seu-email@gmail.com"

# Ambiente
NODE_ENV=production
```

### Configurar URL do frontend

```bash
VITE_API_URL=http://SEU_IP:3001 npm run dev
```

### Trocar para MySQL/PostgreSQL

1. Altere o `provider` em `backend/prisma/schema.prisma`.
2. Atualize `DATABASE_URL`.
3. Execute `npx prisma db push`.

## Uso

1. Inicie o backend: `cd backend && npm run dev`
2. Inicie o frontend: `cd frontend && npm run dev`
3. Abra `http://localhost:5173`
4. Cadastre-se e use o código OTP recebido por e-mail ou exibido no console
5. Comece a adicionar projetos, VPS, transações e tarefas

## Deploy em VPS

1. Envie `DevFast-Manager.tar.gz` para a VPS.
2. Extraia: `tar -xzvf DevFast-Manager.tar.gz`.
3. Execute: `chmod +x deploy.sh && ./deploy.sh`.

O script detecta o sistema operacional, instala Node.js se necessário, instala dependências, compila e inicia o servidor.

## Endpoints da API

### Autenticação

- `POST /api/auth/request-otp` - Solicitar código OTP
- `POST /api/auth/register` - Cadastro com OTP
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Usuário atual
- `PUT /api/auth/me` - Atualizar perfil
- `GET /api/auth/users` - Listar usuários
- `GET /api/auth/users/:id` - Perfil público do usuário
- `GET /api/auth/roles` - Listar papéis
- `PUT /api/auth/users/:id/role` - Alterar papel

### Projetos

- `GET /api/projects` - Listar projetos
- `POST /api/projects` - Criar projeto
- `PUT /api/projects/:id` - Atualizar projeto
- `DELETE /api/projects/:id` - Excluir projeto
- `GET /api/projects/:id` - Ver projeto
- `POST /api/projects/:id/metrics` - Adicionar métricas

### Infraestrutura

- `GET /api/vps/providers` - Listar provedores
- `GET /api/vps/servers` - Listar servidores
- `POST /api/vps/servers` - Criar servidor
- `GET /api/vps/items` - Listar itens
- `POST /api/vps/items` - Criar item
- `GET /api/vps/costs` - Resumo de custos

### Finanças

- `GET /api/finance/transactions` - Transações
- `POST /api/finance/transactions` - Criar transação
- `GET /api/finance/summary` - Resumo financeiro
- `GET /api/finance/rates/latest` - Taxas atuais

### Tarefas e Bugs

- `GET /api/tasks/tasks` - Listar tarefas
- `POST /api/tasks/tasks` - Criar tarefa
- `GET /api/tasks/bugs` - Listar bugs
- `POST /api/tasks/bugs` - Criar bug
- `GET /api/tasks/overview` - Resumo

### Dashboard

- `GET /api/dashboard` - Visão geral
- `GET /api/dashboard/alerts` - Alertas
- `GET /api/dashboard/charts/income-expense` - Gráfico de receitas e despesas

### Chat

- `GET /api/chat/channels` - Canais do usuário
- `GET /api/chat/channels/:id/messages` - Mensagens
- `POST /api/chat/channels/:id/messages` - Enviar mensagem
- `POST /api/chat/private` - Criar canal privado
- WebSocket: `ws://host/api/chat/ws?token=...`

### Configuração

- `GET /api/settings/company` - Ver configuração da empresa
- `PUT /api/settings/company` - Atualizar empresa

## Estado do Projeto

Concluído:

- Autenticação JWT com bcrypt
- Papéis base e permissões
- CRUD completo de projetos
- Gestão de infraestrutura com VPS e itens
- Finanças com conversão de moedas
- Tarefas e bugs com criadores e responsáveis
- Dashboard com métricas
- Relatórios gráficos
- Chat interno com WebSocket
- Perfis de usuário estendidos
- Perfis públicos vinculados a equipe, chat e tarefas
- Configuração personalizável da empresa
- Cadastro com OTP por e-mail
- Modo escuro global
- Layout responsivo para mobile
- Integração com El Toque para taxas automáticas a cada 24 horas

Pendente:

- Importação CSV
- Notificações push
- Mais integrações de monitoramento
- Testes automatizados
