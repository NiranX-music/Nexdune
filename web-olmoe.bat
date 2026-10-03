@echo off
setlocal
cd /d "%~dp0"
echo ========================================================
echo   Nexdune OLMoE Web Dashboard
echo   High-Performance Mode: 12GB RAM Cache + SSD Streaming
echo ========================================================
echo.

:: High-performance optimizations: Active SSD Streaming + RAM Cache
set IDOT=1
set FUSED3=1
set PILOT=1
set WIDE=2
set HOT=16
set RAM_GB=4
set OMP_NUM_THREADS=4

call nexdune-release\nexdune.cmd web --model models\olmoe-nexdune --ram 4 --port 8000
pause
