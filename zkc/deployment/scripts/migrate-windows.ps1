# ZKCommerce v4.1 — Windows PowerShell Migration Script
# Run from project root:
#   PowerShell -ExecutionPolicy Bypass -File deployment\scripts\migrate-windows.ps1
#
# Or pass URL directly:
#   PowerShell -ExecutionPolicy Bypass -File deployment\scripts\migrate-windows.ps1 -DbUrl "postgresql://..."

param(
    [string]$DbUrl = "",
    [string]$Env = "development"
)

Write-Host ""
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "  ZKCommerce v4.1 - Windows Migration" -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta
Write-Host ""

# Check Node.js
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "[ERROR] Node.js not found. Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Node.js: $nodeVersion" -ForegroundColor Green

# Check npm packages
if (-not (Test-Path "node_modules")) {
    Write-Host "[INFO] Installing npm packages..." -ForegroundColor Yellow
    npm install
}
Write-Host "[OK] npm packages ready" -ForegroundColor Green

# Load .env if no URL provided
if ($DbUrl -eq "") {
    if (Test-Path ".env") {
        $envContent = Get-Content ".env"
        foreach ($line in $envContent) {
            if ($line -match "^DATABASE_URL=(.+)$") {
                $DbUrl = $matches[1]
                Write-Host "[INFO] Using DATABASE_URL from .env" -ForegroundColor Cyan
                break
            }
            if ($line -match "^DATABASE_DevURL=(.+)$" -and $DbUrl -eq "") {
                $DbUrl = $matches[1]
                Write-Host "[INFO] Using DATABASE_DevURL from .env" -ForegroundColor Cyan
            }
        }
    }
}

if ($DbUrl -eq "") {
    Write-Host ""
    Write-Host "[ERROR] No database URL found." -ForegroundColor Red
    Write-Host "Either:" -ForegroundColor Yellow
    Write-Host "  1. Add DATABASE_URL to your .env file" -ForegroundColor Yellow
    Write-Host "  2. Pass it directly:" -ForegroundColor Yellow
    Write-Host '     .\deployment\scripts\migrate-windows.ps1 -DbUrl "postgresql://..."' -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "[INFO] Running migration..." -ForegroundColor Cyan
Write-Host ""

# Run the Node.js migration script (no psql needed)
$env:DATABASE_URL = $DbUrl
node deployment/scripts/neon-migrate.js $DbUrl

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Green
    Write-Host "  Migration completed successfully!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Run: npm run dev" -ForegroundColor White
    Write-Host "  2. Open: http://localhost:3000/health" -ForegroundColor White
    Write-Host "  3. Open: auth/login.html" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "[ERROR] Migration failed. Check errors above." -ForegroundColor Red
}
