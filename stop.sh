#!/bin/bash

echo "🛑 Encerrando o librun (backend e frontend)..."

# Libera portas 8000 (FastAPI) e 3000 (Next.js)
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true

# Garante encerramento dos processos caso o fuser não baste
pkill -f "uvicorn main:app" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true

echo "✅ librun parado com sucesso!"
