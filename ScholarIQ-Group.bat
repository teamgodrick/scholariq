@echo off
title ScholarIQ (study group sharing ON)
cd /d "%~dp0"
echo Sharing the Study Group board on your Wi-Fi. Friends cannot see your notes or data.
where py >nul 2>nul
if %errorlevel%==0 (py server.py --share) else (python server.py --share)
echo.
pause
