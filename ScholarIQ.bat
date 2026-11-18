@echo off
title ScholarIQ
cd /d "%~dp0"
echo Starting ScholarIQ. Keep this window open while you use the app.
where py >nul 2>nul
if %errorlevel%==0 (py server.py) else (python server.py)
echo.
echo ScholarIQ stopped. If you saw an error above, send a screenshot to your team.
pause
