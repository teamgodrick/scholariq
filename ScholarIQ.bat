@echo off
title ScholarIQ
cd /d "%~dp0"
set "PYTHON=python"
%PYTHON% -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>nul
if not errorlevel 1 goto python_selected
where py >nul 2>nul
if errorlevel 1 goto python_error
set "PYTHON=py"
%PYTHON% -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>nul
if errorlevel 1 (
  goto python_error
)
:python_selected
for /f "delims=" %%v in ('%PYTHON% -c "import sys; print(str(sys.version_info.major)+'.'+str(sys.version_info.minor))"') do set "PYTHON_VERSION=%%v"
set "VENV=.venv-%PYTHON_VERSION%"
if not exist "%VENV%\Scripts\python.exe" (
  echo Creating ScholarIQ's private Python environment...
  %PYTHON% -m venv "%VENV%"
  if errorlevel 1 (
    echo Could not create ScholarIQ's Python environment.
    pause
    exit /b 1
  )
)
set "APP_PYTHON=%VENV%\Scripts\python.exe"
%APP_PYTHON% -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>nul
if errorlevel 1 (
  echo ScholarIQ's existing %VENV% uses Python older than 3.9.
  echo Remove the %VENV% folder and restart with Python 3.9 or newer.
  pause
  exit /b 1
)
%APP_PYTHON% -c "import sys; exec('import winrt.windows.media.ocr; import winrt.windows.graphics.imaging; import winrt.windows.storage.streams' if sys.version_info >= (3, 15) else 'import onnxruntime; from rapidocr import RapidOCR')" >nul 2>nul
if errorlevel 1 (
  echo Installing ScholarIQ's local OCR dependencies. This one-time setup needs internet access.
  %APP_PYTHON% -m pip install -r requirements.txt
  if errorlevel 1 (
    echo OCR setup failed. ScholarIQ will continue; report OCR may be unavailable.
  )
)
echo Starting ScholarIQ. Keep this window open while you use the app.
%APP_PYTHON% server.py %*
goto finished

:finished
echo.
echo ScholarIQ stopped. If you saw an error above, send a screenshot to your team.
pause
exit /b

:python_error
echo ScholarIQ needs Python 3.9 or newer.
echo Install a newer Python version and try again.
pause
exit /b 1
