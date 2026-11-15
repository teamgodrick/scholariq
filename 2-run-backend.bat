@echo off
title ScholarIQ Backend Engine (Port 8000)
cd /d "%~dp0backend"
if not exist ".venv\Scripts\python.exe" (
  echo.
  echo =======================================================
  echo  [ERROR] Backend is not set up yet!
  echo  Please run 1-setup-backend.bat first.
  echo =======================================================
  echo.
  pause
  exit /b 1
)

echo =======================================================
echo          ScholarIQ - Starting Local Backend
echo  API URL: http://localhost:8000
echo  Docs:    http://localhost:8000/docs
echo  Press Ctrl+C to stop the server at any time.
echo =======================================================
echo.
".venv\Scripts\python.exe" -m uvicorn main:app --reload --port 8000
if %errorlevel% neq 0 (
  echo.
  echo Backend server stopped or failed to launch.
  pause
)
