@echo off
title ScholarIQ Frontend Server (Port 5173)
cd /d "%~dp0frontend"
echo =======================================================
echo          ScholarIQ - Starting Web Interface
echo  App URL: http://localhost:5173
echo  Press Ctrl+C to stop the Vite server.
echo =======================================================
echo.
call npm run dev
pause
