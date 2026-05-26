#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker é obrigatório. Instale Docker/Podman Compose primeiro." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 é obrigatório. Verifique se 'docker compose' funciona na VPS." >&2
  exit 1
fi

[ -f .env ] || cp .env.example .env
[ -f backend/.env ] || cp backend/.env.example backend/.env
[ -f frontend/.env ] || cp frontend/.env.example frontend/.env

if grep -q "change-me-generate-a-long-random-secret" backend/.env; then
  if ! command -v openssl >/dev/null 2>&1; then
    echo "Edite backend/.env e defina JWT_SECRET antes de subir. openssl não está disponível para gerar automaticamente." >&2
    exit 1
  fi
  secret="$(openssl rand -hex 32)"
  sed -i "s/change-me-generate-a-long-random-secret/${secret}/" backend/.env
  echo "JWT_SECRET seguro gerado em backend/.env."
fi

if grep -Eq "your-email@gmail.com|your-gmail-app-password" backend/.env; then
  echo "Aviso: configure SMTP_* em backend/.env para cadastro OTP funcionar em produção."
fi

docker compose config >/dev/null
docker compose up -d --build

web_port="$(grep -E '^WEB_PORT=' .env | tail -n 1 | cut -d= -f2- || true)"
web_port="${web_port:-80}"

echo "DevFast Manager está iniciando."
echo "URL local da VPS: http://localhost:${web_port}"
echo "Healthcheck: curl http://localhost:${web_port}/api/health"
