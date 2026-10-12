@echo off
setlocal
cd /d "%~dp0"
title Image Converter

echo ========================================================
echo   Local Image Converter (100%% Offline and Private)
echo ========================================================
echo.
echo Starting application...
echo.

set "PY_CMD="

where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "PY_CMD=python"
) else (
    where py >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        set "PY_CMD=py"
    )
)

if defined PY_CMD (
    %PY_CMD% server.py
    if %ERRORLEVEL% neq 0 (
        echo.
        echo [!] Server returned an error. Opening index.html directly...
        start "" "%~dp0index.html"
    )
) else (
    echo [!] Python was not found in PATH.
    echo [!] Opening index.html directly in your default browser...
    start "" "%~dp0index.html"
)

echo.
pause
