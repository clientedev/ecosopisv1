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
start "ECOSOPIS Backend" cmd /c "cd /d "%ROOT_DIR%backend" && (if not exist venv python -m venv venv) && venv\Scripts\activate && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000"

REM Start Frontend in a new window
echo Starting Frontend...
start "ECOSOPIS Frontend" cmd /c "cd /d "%ROOT_DIR%frontend" && (if not exist node_modules npm install) && npm run dev"

echo ==========================================
echo Backend should be starting at http://localhost:8000
echo Frontend should be starting at http://localhost:5000
echo ==========================================
pause
