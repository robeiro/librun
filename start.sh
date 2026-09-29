#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"

echo "=================================================="
echo "🏃‍♂️ Iniciando librun - Inteligência de Corrida Strava"
echo "=================================================="

# Function to clean up background processes on exit
cleanup() {
  echo ""
  echo "Encerrando librun..."
  kill $(jobs -p) 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "-> Iniciando backend FastAPI em http://localhost:8000..."
cd "$DIR/backend"
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "-> Aguardando inicialização do backend..."
sleep 2

echo "-> Iniciando frontend Next.js em http://localhost:3000..."
cd "$DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=================================================="
echo "✨ librun pronto!"
echo "👉 Acesse no navegador: http://localhost:3000"
echo "👉 API & Swagger Docs:   http://localhost:8000/docs"
echo "=================================================="
echo "Pressione Ctrl+C para encerrar."

wait
