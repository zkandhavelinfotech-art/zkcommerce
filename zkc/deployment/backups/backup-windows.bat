@echo off
REM ZKCommerce v4.1 -- Windows Backup Script
REM Run from project root: deployment\backups\backup-windows.bat [environment]

set ENV=%1
if "%ENV%"=="" set ENV=development

for /f "tokens=1-6 delims=/ " %%a in ('date /t') do set DATESTAMP=%%a%%b%%c
for /f "tokens=1-3 delims=:. " %%a in ('time /t') do set TIMESTAMP=%%a%%b%%c

set OUTFILE=deployment\backups\zkcommerce-%ENV%-%DATESTAMP%-%TIMESTAMP%.sql
set PSQL="C:\Program Files\PostgreSQL\15\bin\pg_dump.exe"
if not exist %PSQL% set PSQL="C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"

echo [%DATE% %TIME%] Starting backup for %ENV%...
%PSQL% "%DATABASE_URL%" --format=plain --clean --no-owner -f %OUTFILE%

if %errorlevel% equ 0 (
  echo [%DATE% %TIME%] Backup saved: %OUTFILE%
) else (
  echo [%DATE% %TIME%] ERROR: Backup failed
  exit /b 1
)
pause
