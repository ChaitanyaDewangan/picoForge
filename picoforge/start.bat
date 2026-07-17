@echo off
echo =======================================================
echo Starting PicoForge...
echo The OpenCode/Anthropic API key is read from the .env file
echo =======================================================
cd %~dp0

:: Check if deno is installed
where deno >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Deno is not installed or not in PATH.
    echo Please install Deno to run PicoForge.
    pause
    exit /b 1
)

:: Run deno dev task
call deno task dev

pause
