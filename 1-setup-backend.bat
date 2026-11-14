@echo off
cd /d "%~dp0backend"
echo Creating the private Python space...
where py >nul 2>nul
if %errorlevel%==0 (py -m venv .venv) else (python -m venv .venv)
if not exist ".venv\Scripts\python.exe" (
  echo.
  echo PROBLEM: Python was not found on this laptop.
  echo Install Python from python.org and tick Add python.exe to PATH, restart, then run this again.
  pause
  exit /b 1
)
echo Installing the Python tools. This takes a few minutes...
".venv\Scripts\python.exe" -m pip install --upgrade pip
".venv\Scripts\python.exe" -m pip install -r requirements.txt
echo.
echo Backend setup finished. You can close this window.
pause
