#!/bin/bash
# Rode este script UMA VEZ antes do primeiro deploy
set -e

source .env

echo "🔒 Configurando SSL com Certbot..."
apt update && apt install -y certbot

docker compose down 2>/dev/null || true

certbot certonly --standalone \
  -d $DOMAIN \
  --agree-tos \
  --no-eff-email \
  -m admin@redencao.pa.gov.br

echo "✅ Certificado gerado!"
echo "Agora rode: bash deploy.sh"
