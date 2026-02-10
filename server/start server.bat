@echo off
title Iniciando Projeto Imperion - Server (Node.js)

:: Ajustei o titulo para Server, ja que o caminho aponta para \server
SET PROJECT_PATH=D:\JS-Projects\Youtube\server

cd /d "%PROJECT_PATH%" || (
    echo ERRO: Caminho nao encontrado: %PROJECT_PATH%
    pause
    exit /b
)

echo ===========================================
echo   Iniciando Servidor do Imperion RPG
echo   Monitorando: vida_regen e estamina_regen
echo ===========================================
echo.

:: O /k garante que a janela nao feche apos o Ctrl+C
cmd /k npm run dev