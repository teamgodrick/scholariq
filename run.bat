@echo off
title ScholarIQ - Privacy-First Academic OS
cd /d "%~dp0"

echo =======================================================
echo          ScholarIQ - Starting Application
echo =======================================================
echo.
echo [1/3] Checking environment...
if not exist "backend\.venv\Scripts\python.exe" (
  echo Setting up backend environment first...
  call 1-setup-backend.bat
)

echo [2/3] Starting backend engine on port 8000...
start /b "" "backend\.venv\Scripts\python.exe" -m uvicorn main:app --app-dir backend --port 8000

echo [3/3] Starting frontend interface and opening browser...
timeout /t 2 /nobreak >nul
start http://localhost:5173

echo.
echo =======================================================
echo  ScholarIQ is LIVE!
echo  Interface: http://localhost:5173
echo  Backend:   http://localhost:8000
echo.
echo  Press Ctrl+C or close this window to exit.
echo =======================================================
echo.
cd frontend
call npm run dev
