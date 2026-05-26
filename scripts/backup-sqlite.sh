#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p backups

container_id="$(docker compose ps -q backend)"
if [ -z "$container_id" ]; then
  echo "Backend não está rodando. Execute docker compose up -d primeiro." >&2
  exit 1
fi

volume_name="$(docker inspect "$container_id" --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}')"
if [ -z "$volume_name" ]; then
  echo "Volume /data não encontrado no container backend." >&2
  exit 1
fi

backup_file="devfast-db-$(date +%Y%m%d-%H%M%S).tar.gz"

docker run --rm \
  -v "${volume_name}:/data:ro" \
  -v "${ROOT_DIR}/backups:/backup" \
  alpine:3.20 \
  sh -c 'test -f /data/devfast.db && tar -czf "/backup/'"${backup_file}"'" -C /data devfast.db'

echo "Backup criado em backups/${backup_file}"
