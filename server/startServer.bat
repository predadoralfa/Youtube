@echo off

title Iniciando o Projeto Diário de RPG - Cliente (Vite)

SET PROJECT_PATH=D:\JS-Projects\Youtube\server

cd /d "%PROJECT_PATH%" || (
    echo Erro: Caminho errado
    pause
    exit /b
)

echo Iniciando o Vite (npm run dev) ...

cmd /k npm run dev

pause