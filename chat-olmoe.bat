@echo off
setlocal
cd /d "%~dp0"
echo ========================================================
echo   Nexdune OLMoE Interactive Chat
echo   High-Performance Mode: RAM Cache + SSD Expert Streaming
echo ========================================================
echo.

:: High-performance SIMD & Caching optimizations
set IDOT=1
set FUSED3=1
set HOT=16
set RAM_GB=12
set OMP_NUM_THREADS=6

call nexdune-release\nexdune.cmd chat --model models\olmoe-nexdune --ram 12
pause
