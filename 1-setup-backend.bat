@echo off
title ScholarIQ Backend Setup
cd /d "%~dp0backend"
echo =======================================================
echo          ScholarIQ - Backend Environment Setup
echo =======================================================
echo.
echo [1/3] Checking Python installation...
where py >nul 2>nul
if %errorlevel%==0 (
  set PY_CMD=py
) else (
  set PY_CMD=python
)

if not exist ".venv\Scripts\python.exe" (
  echo [2/3] Creating Python virtual environment in .venv...
  %PY_CMD% -m venv .venv
  if not exist ".venv\Scripts\python.exe" (
    echo.
    echo [ERROR] Python was not found or failed to create .venv.
    echo Please install Python 3.10+ from python.org and tick 'Add python.exe to PATH'.
    pause
    exit /b 1
  )
) else (
  echo [2/3] Virtual environment already exists in .venv.
)

echo [3/3] Installing/updating dependencies (FastAPI, Uvicorn, NumPy, PyPDF, OpenAI)...
".venv\Scripts\python.exe" -m pip install --upgrade pip
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if %errorlevel% neq 0 (
  echo.
  echo [WARNING] Some dependencies had warnings or issues. Attempting direct install...
  ".venv\Scripts\python.exe" -m pip install fastapi uvicorn python-multipart pypdf numpy openai
)

echo.
echo =======================================================
echo  SUCCESS: ScholarIQ Backend environment is ready!
echo  Next step: Double-click '2-run-backend.bat'
echo =======================================================
echo.
pause
