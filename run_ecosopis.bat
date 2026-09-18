@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo       ECOSOPIS Local Startup Script
echo ==========================================

REM Detect root directory
set ROOT_DIR=%~dp0
cd /d "%ROOT_DIR%"

REM Start Backend in a new window
echo Starting Backend...
start "ECOSOPIS Backend" cmd /k "cd /d "%ROOT_DIR%backend" && (if exist venv\Scripts\uvicorn.exe (call venv\Scripts\activate && uvicorn app.main:app --reload --port 8000) else (python -m uvicorn app.main:app --reload --port 8000))"

REM Start Frontend in a new window
echo Starting Frontend...
start "ECOSOPIS Frontend" cmd /k "cd /d "%ROOT_DIR%frontend" && (if not exist node_modules npm install) && npm run dev"

echo ==========================================
echo Backend starting at http://localhost:8000
echo Frontend starting at http://localhost:5000
echo ==========================================
pause
