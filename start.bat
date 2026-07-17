@echo off
REM ============================================================================
REM  PicoForge — One-click startup (Windows 11)
REM  Usage:  start.bat
REM  This starts both the Deno backend (port 7317) and Vite frontend (port 5173)
REM ============================================================================

title PicoForge Startup
cd /d "%~dp0picoforge"

echo.
echo  ╭───────────────────────────────────────────────────╮
echo  │        PicoForge — Starting Up                    │
echo  ╰───────────────────────────────────────────────────╯
echo.

REM ─── 1. Check prerequisites ──────────────────────────────────────────────
where deno >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Deno not found. Install from https://deno.land
    pause
    exit /b 1
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

REM ─── 2. Setup .env with OpenCode API Key ───────────────────────────────
echo [INFO] Setting up default API key...
echo ANTHROPIC_API_KEY=sk-JG4ZJgwh8IvyoDElQwSsfPgM7zKd1NS33YJdoQE3qyBCFxLPfqzPLlUMBFZbSXpS> .env
echo ANTHROPIC_BASE_URL=https://api.opencode.so/v1>> .env

REM ─── 3. Install app dependencies if needed ─────────────────────────────
if not exist "app\node_modules\vite" (
    echo [INFO] Installing app dependencies...
    cd app
    call npm install
    cd ..
)

REM ─── 4. Start Deno server (background) ─────────────────────────────────
echo [INFO] Starting Deno server on http://127.0.0.1:7317 ...
start "PicoForge Server" cmd /c "deno run --watch --env-file=.env --allow-net --allow-read --allow-write --allow-run --allow-env server/main.ts"

REM Give server a moment to boot
timeout /t 3 /nobreak >nul

REM ─── 5. Start Vite dev server (background) ─────────────────────────────
echo [INFO] Starting Vite dev server on http://localhost:5173 ...
start "PicoForge App" cmd /c "cd app && npx vite --host"

REM ─── 6. Wait and open browser ──────────────────────────────────────────
timeout /t 4 /nobreak >nul
echo.
echo  ╭───────────────────────────────────────────────────╮
echo  │   PicoForge is running!                           │
echo  │   App:    http://localhost:5173                   │
echo  │   API:    http://127.0.0.1:7317                   │
echo  │                                                   │
echo  │   Close the two terminal windows to stop          │
echo  ╰───────────────────────────────────────────────────╯
echo.

start "" "http://localhost:5173"

echo Press any key to stop all PicoForge processes...
pause >nul

REM Kill background processes
taskkill /fi "WINDOWTITLE eq PicoForge Server" /f >nul 2>&1
taskkill /fi "WINDOWTITLE eq PicoForge App" /f >nul 2>&1
echo [INFO] PicoForge stopped.
