@echo off
rem Windows entry point for Nexdune release archive.
rem
rem The archive ships the engines as .exe files and the launcher as `nexdune`,
rem a Python script with no extension. This file is the thing to click and
rem the thing to type: `nexdune.cmd chat --model models\olmoe-nexdune` works
rem from cmd and PowerShell.
setlocal enabledelayedexpansion
set "COLI_HERE=%~dp0"

rem Find a Python 3. The py launcher ships with python.org installers and is
rem the only one that stays correct when several versions are installed.
set "COLI_PY="
py -3 -c "import sys" >nul 2>&1 && set "COLI_PY=py -3"
if not defined COLI_PY python -c "import sys; sys.exit(0 if sys.version_info[0]==3 else 1)" >nul 2>&1 && set "COLI_PY=python"
if not defined COLI_PY python3 -c "import sys" >nul 2>&1 && set "COLI_PY=python3"

if not defined COLI_PY (
    echo Nexdune: Python 3 was not found on this machine.
    echo.
    echo The engines are pure C and need nothing, but the launcher, the API
    echo gateway and the model tools are Python. Install Python 3 from
    echo    https://www.python.org/downloads/
    echo and tick "Add python.exe to PATH" in the installer, then run this again.
    call :hold
    exit /b 1
)

if "%~1"=="" (
    echo Nexdune -- run frontier models from your own storage.
    echo.
    echo You are one argument away: this launcher needs a model directory.
    echo.
    echo     nexdune.cmd chat   --model models\olmoe-nexdune     interactive chat
    echo     nexdune.cmd serve  --model models\olmoe-nexdune     OpenAI-compatible API
    echo     nexdune.cmd web    --model models\olmoe-nexdune     API plus dashboard
    echo     nexdune.cmd doctor --model models\olmoe-nexdune     check a model is usable
    echo     nexdune.cmd info                                    what this build supports
    echo.
    echo The .exe files next to this script are the ENGINES. They are not meant
    echo to be started directly: without a model they exit at once.
    call :hold
    exit /b 0
)

%COLI_PY% "%COLI_HERE%nexdune" %*
exit /b %ERRORLEVEL%

rem Keep the window readable when this script was double-clicked from Explorer.
:hold
echo %CMDCMDLINE% | find /i "/c" >nul && pause
exit /b 0
