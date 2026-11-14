@echo off
echo Checking your tools. Each section should show a version number.
echo.
echo --- Python using py ---
py --version
echo.
echo --- Python using python ---
python --version
echo.
echo --- Node ---
node --version
echo.
echo --- npm ---
call npm --version
echo.
echo Send a screenshot of this window to Claude if anything says not recognized.
pause
