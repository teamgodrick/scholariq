@echo off
cd /d "%~dp0backend"
python -m venv .venv
call .venv\Scripts\activate.bat
pip install -r requirements.txt
echo.
echo Backend setup finished. You can close this window.
pause
