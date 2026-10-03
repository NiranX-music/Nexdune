@echo off
setlocal
cd /d "%~dp0"
echo ========================================================
echo   Nexdune OLMoE Interactive Chat
echo   8GB RAM System Profile: 3.8GB RAM Budget + SSD Streaming
echo ========================================================
echo.

:: High-performance SIMD & Caching optimizations: Tailored for 8GB Total System RAM
:: Leaves ~4.2GB free for Windows and background apps
set IDOT=1
set FUSED3=1
set PILOT=1
set WIDE=2
set HOT=8
set CTX=2048
set RAM_GB=4
set OMP_NUM_THREADS=4

call nexdune-release\nexdune.cmd chat --model models\olmoe-nexdune --ram 4
pause

