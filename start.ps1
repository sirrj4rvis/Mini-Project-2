#!/usr/bin/env pwsh
<#
.SYNOPSIS
    PriceLens Full Stack Startup Script
    
    Starts:
     1. Backend  (Express + MongoDB)  -> http://localhost:5000
     2. Frontend (Vite + React)       -> http://localhost:5173
     3. ML       (Flask)              -> http://localhost:8000
     
.USAGE
    From d:\CODING\Mini_Project:
        .\start.ps1
        
    To stop everything:   Ctrl+C in each terminal, or:
        Get-Job | Stop-Job | Remove-Job
#>

$NODE = "C:\Program Files\nodejs\node.exe"
$NPM  = "C:\Program Files\nodejs\npm.cmd"
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "        PriceLens - Starting Up...            " -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# ── Kill anything already on ports 5000 / 5173 / 5174 / 8000 ──
foreach ($port in @(5000, 5173, 5174, 8000)) {
    $pids = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | 
            Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($p in $pids) {
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    }
}
Start-Sleep -Milliseconds 500

# ── Start Backend ──
Write-Host "[~] Starting Backend (Express + MongoDB)..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    param($node, $root)
    $env:PATH = "C:\Program Files\nodejs;" + $env:PATH
    Set-Location "$root\server"
    & $node src/app.js 2>&1
} -ArgumentList $NODE, $ROOT

# Wait for backend to confirm it's up
$timeout = 30; $elapsed = 0
while ($elapsed -lt $timeout) {
    Start-Sleep -Seconds 1; $elapsed++
    $output = Receive-Job $backendJob -Keep
    if ($output -match "Server running") {
        Write-Host "[OK] Backend ready -> http://localhost:5000" -ForegroundColor Green
        break
    }
    if ($output -match "EADDRINUSE") {
        Write-Host "[WARN] Port 5000 in use - backend may already be running" -ForegroundColor Yellow
        break
    }
}

# ── Start ML Service (Flask) ──
Write-Host "[~] Starting ML Service (Flask)..." -ForegroundColor Yellow
$cmd = Get-Command python -ErrorAction SilentlyContinue
$PYTHON = if ($cmd) { $cmd.Source } else { "python" }

$mlJob = Start-Job -ScriptBlock {
    param($python, $root)
    $env:PYTHONUTF8 = "1"
    $env:PYTHONIOENCODING = "utf-8"
    Set-Location "$root\ml-service"
    # Activate venv if it exists
    $activate = "$root\ml-service\venv\Scripts\Activate.ps1"
    if (Test-Path $activate) { & $activate }
    & $python app.py 2>&1
} -ArgumentList $PYTHON, $ROOT

$mlTimeout = 15; $mlElapsed = 0
while ($mlElapsed -lt $mlTimeout) {
    Start-Sleep -Seconds 1; $mlElapsed++
    $mlOutput = Receive-Job $mlJob -Keep
    if ($mlOutput -match "Running on") {
        Write-Host "[OK] ML Service ready -> http://localhost:8000" -ForegroundColor Green
        break
    }
    if ($mlElapsed -ge $mlTimeout) {
        Write-Host "[WARN] ML Service may still be starting (model training takes time)" -ForegroundColor Yellow
    }
}

# ── Start Frontend ──
Write-Host "[~] Starting Frontend (Vite + React)..." -ForegroundColor Yellow
$frontendJob = Start-Job -ScriptBlock {
    param($npm, $root)
    $env:PATH = "C:\Program Files\nodejs;" + $env:PATH
    Set-Location "$root\client"
    & $npm run dev 2>&1
} -ArgumentList $NPM, $ROOT

Start-Sleep -Seconds 6
$fOutput = Receive-Job $frontendJob -Keep
$port = if ($fOutput -match "localhost:(\d+)") { $matches[1] } else { "5173" }
Write-Host "[OK] Frontend ready -> http://localhost:$port" -ForegroundColor Green

# ── Summary ──
Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "   [OK] PriceLens is running!                 " -ForegroundColor Green
Write-Host "" -ForegroundColor Green
Write-Host "   App:     http://localhost:$port" -ForegroundColor Green
Write-Host "   API:     http://localhost:5000/api" -ForegroundColor Green
Write-Host "   ML:      http://localhost:8000/health" -ForegroundColor Green
Write-Host "" -ForegroundColor Green
Write-Host "   User:    test@pricelens.in / PriceLens#User9" -ForegroundColor Green
Write-Host "   Admin:   admin@pricelens.in / PriceLens#Admin9" -ForegroundColor Green
Write-Host "" -ForegroundColor Green
Write-Host "   Press Ctrl+C to stop" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""

# ── Keep alive + stream logs ──
try {
    while ($true) {
        Start-Sleep -Seconds 3
        $bl = Receive-Job $backendJob;  if ($bl) { Write-Host "[Backend]  $bl" -ForegroundColor DarkGray }
        $ml = Receive-Job $mlJob;        if ($ml) { Write-Host "[ML]       $ml" -ForegroundColor DarkGray }
        $fl = Receive-Job $frontendJob;  if ($fl) { Write-Host "[Frontend] $fl" -ForegroundColor DarkGray }
    }
} finally {
    Write-Host "Stopping all services..." -ForegroundColor Yellow
    Stop-Job $backendJob, $mlJob, $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob, $mlJob, $frontendJob -ErrorAction SilentlyContinue
    Write-Host "Stopped." -ForegroundColor Red
}
