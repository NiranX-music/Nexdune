@echo off
setlocal
cd /d "%~dp0"
echo ========================================================
echo   Nexdune Diagnostic Health Check (OLMoE)
echo ========================================================
echo.
call nexdune-release\nexdune.cmd doctor --model models\olmoe-nexdune
pause
