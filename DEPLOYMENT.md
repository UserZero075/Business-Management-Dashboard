# Deploy do DevFast Manager

Este projeto pode rodar em dois modos:

- Desenvolvimento: Vite + Fastify rodando separadamente.
- Produção: Docker Compose com frontend Nginx como proxy reverso e backend Node/Fastify.

## Desenvolvimento

Backend:

```bash
cd backend
cp .env.example .env
# Em desenvolvimento local, deixe NODE_ENV vazio ou use NODE_ENV=development.
npm install
npx prisma db push
npm run dev
```

Frontend:

```bash
cd frontend
cp .env.example .env
# Opcional ao rodar servidores separados:
# VITE_API_URL=http://localhost:3001
npm install
npm run dev
```

Em desenvolvimento, os códigos OTP só aparecem no console quando SMTP não está configurado e `NODE_ENV` não é `production`.

## Produção em VPS Hostinger com Docker

Este é o caminho recomendado para deixar o sistema online mantendo SQLite. O banco fica no volume Docker `devfast-data`, montado em `/data` no container do backend.

1. Envie o projeto para a VPS, por Git ou `scp`, e entre na pasta do projeto:

```bash
cd /opt/devfast-manager
```

2. Copie os modelos de ambiente:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

3. Edite `.env`:

```env
COMPOSE_PROJECT_NAME=devfast-manager
WEB_PORT=80
```

Use `WEB_PORT=8080` apenas se outro Nginx/Caddy/Apache já estiver usando a porta 80 na VPS.

4. Edite `backend/.env`:

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=3002
DATABASE_URL=file:/data/devfast.db
JWT_SECRET=<segredo-longo-aleatorio>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_STARTTLS=true
SMTP_USER=<endereco-gmail>
SMTP_PASS=<senha-de-app-gmail>
SMTP_FROM=<endereco-gmail>
```

O modo de produção exige SMTP. Se SMTP estiver ausente, o endpoint de OTP falha em vez de expor códigos de desenvolvimento.

5. Suba a aplicação:

```bash
chmod +x scripts/deploy-prod.sh scripts/backup-sqlite.sh
./scripts/deploy-prod.sh
```

6. Abra:

```text
http://<ip-da-vps>
http://<seu-dominio>
```

O frontend usa URLs relativas `/api/...` e `/api/chat/ws`, então o mesmo domínio serve a interface, a API e o WebSocket.

## Comandos Operacionais

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose restart
docker compose pull
docker compose up -d --build
```

Healthcheck:

```bash
curl http://localhost:${WEB_PORT:-80}/api/health
```

Backup do SQLite:

```bash
./scripts/backup-sqlite.sh
```

Os arquivos ficam em `backups/`. Copie essa pasta para fora da VPS periodicamente.

## HTTPS e Domínio

Para ficar online com domínio, aponte o DNS para o IP da VPS:

```text
A     @      <ip-da-vps>
A     www    <ip-da-vps>
```

Depois habilite HTTPS usando Cloudflare, Hostinger proxy/SSL, Caddy, Nginx Proxy Manager ou outro proxy reverso. Se o proxy reverso ficar na mesma VPS, deixe este app em `WEB_PORT=8080` e faça o proxy encaminhar para `http://127.0.0.1:8080`.

## Observações sobre Tailscale

Não é necessário abrir portas públicas. Vincule o container web a `WEB_PORT` e acesse pelo tailnet:

```env
WEB_PORT=8080
```

Se algum cliente também usa WireGuard em full-tunnel, confirme que o intervalo CGNAT do Tailscale passa por `tailscale0`, não pelo túnel WireGuard:

```bash
ip route get 100.64.0.1
```

A rota deve usar `tailscale0`. Se usar `wg0`, adicione uma rota mais específica para `100.64.0.0/10` via `tailscale0` na tabela de rotas desse cliente.

## Healthcheck

Backend:

```bash
curl http://localhost:${WEB_PORT:-80}/api/health
```

O Docker Compose também usa `/api/health` para verificar se o backend está pronto antes de expor o frontend.
