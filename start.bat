@echo off
chcp 65001 > nul
echo ==================================================
echo 🏃 librun - Inteligência de Corrida Strava
echo ==================================================
echo.

:: Verifica se o Docker está instalado
docker compose version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Docker detectado! Subindo containers com 1 clique...
    docker compose up -d
    echo.
    echo -> Aguardando inicialização...
    timeout /t 5 >nul
    start http://localhost:3000
    echo ==================================================
    echo ✨ librun rodando com sucesso no Docker!
    echo 👉 Abrindo no navegador: http://localhost:3000
    echo 👉 Para parar o sistema: docker compose down
    echo ==================================================
    pause
    exit /b
)

:: Caso não use Docker, roda via Python e Node locais
echo -> Iniciando backend FastAPI na porta 8000...
start "librun Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --port 8000"

timeout /t 2 >nul

echo -> Iniciando frontend Next.js na porta 3000...
start "librun Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 4 >nul
start http://localhost:3000

echo ==================================================
echo ✨ librun iniciado com sucesso!
echo 👉 Abrindo no seu navegador: http://localhost:3000
echo ==================================================
pause
