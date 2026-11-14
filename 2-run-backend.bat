@echo off
cd /d "%~dp0backend"
if not exist ".venv\Scripts\python.exe" (
  echo Backend is not set up yet. Double-click 1-setup-backend.bat first.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" -m uvicorn main:app --reload --port 8000
pause
