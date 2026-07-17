# ============================================================================
#  PicoForge — One-click startup (PowerShell, Windows 11)
#  Usage:  .\start.ps1    (or right-click → Run with PowerShell)
# ============================================================================

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$PicoDir = Join-Path $Root "picoforge"

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║        PicoForge — Starting Up           ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── 1. Check prerequisites ──────────────────────────────────────────────────
$missing = @()
if (-not (Get-Command deno -ErrorAction SilentlyContinue)) { $missing += "Deno (https://deno.land)" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { $missing += "Node.js (https://nodejs.org)" }
if ($missing.Count -gt 0) {
    Write-Host "  [ERROR] Missing:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red }
    Read-Host "Press Enter to exit"
    exit 1
}

Set-Location $PicoDir

# ── 2. Create .env if missing ───────────────────────────────────────────────
if (-not (Test-Path ".env")) {
    "ANTHROPIC_API_KEY=" | Out-File -Encoding ascii ".env"
    Write-Host "  [INFO] Created .env — set your key in Settings or edit .env" -ForegroundColor Yellow
}

# ── 3. Install app deps if needed ───────────────────────────────────────────
if (-not (Test-Path "app\node_modules\vite")) {
    Write-Host "  [INFO] Installing app dependencies..." -ForegroundColor Yellow
    Push-Location app
    npm install
    Pop-Location
}

# ── 4. Start Deno server ────────────────────────────────────────────────────
Write-Host "  [INFO] Starting Deno server → http://127.0.0.1:7317" -ForegroundColor Green
$server = Start-Process -PassThru -WindowStyle Normal `
    deno -ArgumentList "run --watch --allow-net --allow-read --allow-write --allow-run --allow-env server/main.ts"

Start-Sleep -Seconds 3

# ── 5. Start Vite dev server ────────────────────────────────────────────────
Write-Host "  [INFO] Starting Vite app  → http://localhost:5173" -ForegroundColor Green
$app = Start-Process -PassThru -WindowStyle Normal `
    cmd -ArgumentList "/c cd app && npx vite --host"

Start-Sleep -Seconds 4

# ── 6. Open browser ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║   PicoForge is running!                  ║" -ForegroundColor Green
Write-Host "  ║   App:    http://localhost:5173           ║" -ForegroundColor Green
Write-Host "  ║   API:    http://127.0.0.1:7317          ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Start-Process "http://localhost:5173"

Write-Host "  Press Enter to stop PicoForge..." -ForegroundColor DarkGray
Read-Host

# ── Cleanup ─────────────────────────────────────────────────────────────────
if ($server -and !$server.HasExited) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
if ($app -and !$app.HasExited) { Stop-Process -Id $app.Id -Force -ErrorAction SilentlyContinue }
# Also kill any orphan deno/node processes for this project
Get-Process deno -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -match "PicoForge" } | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "  [INFO] PicoForge stopped." -ForegroundColor Yellow
