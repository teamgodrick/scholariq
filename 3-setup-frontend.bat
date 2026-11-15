@echo off
title ScholarIQ Frontend Setup
cd /d "%~dp0frontend"
echo =======================================================
echo          ScholarIQ - Frontend Environment Setup
echo =======================================================
echo.
echo Installing npm packages...
call npm install
if %errorlevel% neq 0 (
  echo [ERROR] npm install failed. Make sure Node.js is installed.
  pause
  exit /b 1
)
echo.
echo =======================================================
echo  SUCCESS: Frontend setup finished!
echo  Next step: Double-click '4-run-frontend.bat'
echo =======================================================
echo.
pause
