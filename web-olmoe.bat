@echo off
setlocal
cd /d "%~dp0"
echo ========================================================
echo   Nexdune OLMoE Web Dashboard
echo   High-Performance Mode: 12GB RAM Cache + SSD Streaming
echo ========================================================
echo.

:: High-performance optimizations
set IDOT=1
set FUSED3=1
set RAM_GB=12
set OMP_NUM_THREADS=6

call nexdune-release\nexdune.cmd web --model models\olmoe-nexdune --ram 12 --port 8000
pause
