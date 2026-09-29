#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

echo "=================================================="
echo "🏃‍♂️ Iniciando librun - Inteligência de Corrida Strava"
echo "=================================================="

# Garante que portas antigas estejam liberadas
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true
sleep 1

echo "-> Iniciando backend FastAPI em http://localhost:8000..."
cd "$DIR/backend"
nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 > /tmp/librun_backend.log 2>&1 &
disown

echo "-> Aguardando inicialização do backend..."
sleep 2

echo "-> Iniciando frontend Next.js em http://localhost:3000..."
cd "$DIR/frontend"
nohup npm run dev > /tmp/librun_frontend.log 2>&1 &
disown

echo ""
echo "=================================================="
echo "✨ librun iniciado com sucesso em segundo plano!"
echo "👉 Acesse no navegador: http://localhost:3000"
echo "👉 API & Swagger Docs:   http://localhost:8000/docs"
echo "👉 Logs: /tmp/librun_backend.log e /tmp/librun_frontend.log"
echo "👉 Para parar o sistema: ./stop.sh"
echo "=================================================="

exit 0
