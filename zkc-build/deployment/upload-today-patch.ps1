<#
.SYNOPSIS
  GoDaddy FTP Incremental Patch Deployer - Smeram Naturals v1.0.15
  Uploads ONLY the files changed in today's release (16 files, ~138 KB total).
#>
param(
    [string]$FtpHost = $env:GODADDY_FTP_HOST,
    [string]$FtpUser = $env:GODADDY_FTP_USER,
    [string]$FtpPass = $env:GODADDY_FTP_PASS,
    [string]$RemoteDir = $env:GODADDY_FTP_DIR
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($RemoteDir)) {
    $RemoteDir = '/httpdocs'
}
if ([string]::IsNullOrWhiteSpace($FtpHost)) {
    $FtpHost = 'ftp.smeram-naturals.in'
}

Clear-Host
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "   SMERAM NATURALS - GODADDY LIVE SERVER PATCH DEPLOYMENT (TODAY)       " -ForegroundColor Yellow
Write-Host "   Version: v1.0.15 | Release: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') " -ForegroundColor Yellow
Write-Host "   Customer Care WhatsApp: +91 75399 72026                              " -ForegroundColor Green
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Target Server : $FtpHost" -ForegroundColor White
Write-Host "Target Root   : $RemoteDir" -ForegroundColor White
Write-Host "Deployment    : INCREMENTAL PATCH ONLY (16 changed files, no large media)" -ForegroundColor Magenta
Write-Host ""

# Prompt for credentials if not supplied
if ([string]::IsNullOrWhiteSpace($FtpUser)) {
    $FtpUser = Read-Host "Enter GoDaddy FTP Username"
}
if ([string]::IsNullOrWhiteSpace($FtpPass)) {
    $FtpPass = Read-Host "Enter GoDaddy FTP Password" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($FtpPass)
    $FtpPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

if ([string]::IsNullOrWhiteSpace($FtpUser) -or [string]::IsNullOrWhiteSpace($FtpPass)) {
    Write-Host "FTP credentials required. Deployment cancelled." -ForegroundColor Red
    exit 1
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PatchDir = Join-Path $ScriptDir "smeram-patch-today-v1.0.15"

if (-not (Test-Path $PatchDir)) {
    Write-Host "Error: Patch directory not found at: $PatchDir" -ForegroundColor Red
    exit 1
}

$files = Get-ChildItem -Path $PatchDir -Recurse -File
$totalFiles = $files.Count
$totalBytes = ($files | Measure-Object -Property Length -Sum).Sum

Write-Host ("Auto Deployment Files List ({0} files, {1:N1} KB total):" -f $totalFiles, ($totalBytes / 1KB)) -ForegroundColor Yellow
Write-Host "------------------------------------------------------------------------"
$idx = 1
foreach ($f in $files) {
    $rel = $f.FullName.Substring($PatchDir.Length).TrimStart('\').Replace('\', '/')
    Write-Host (" {0,2}. {1,-35} ({2,6:N1} KB)" -f $idx, $rel, ($f.Length / 1KB)) -ForegroundColor Gray
    $idx++
}
Write-Host "------------------------------------------------------------------------"
Write-Host ""
Write-Host "Connecting to GoDaddy FTP and uploading changed files..." -ForegroundColor Cyan
Write-Host ""

function Ensure-RemoteDir($remoteSubdir) {
    if ([string]::IsNullOrWhiteSpace($remoteSubdir)) { return }
    $cleanDir = $remoteSubdir.Trim('/')
    $parts = $cleanDir.Split('/')
    $current = $RemoteDir.TrimEnd('/')
    foreach ($part in $parts) {
        $current = "$current/$part"
        $uri = "ftp://$FtpHost$current"
        try {
            $req = [System.Net.FtpWebRequest]::Create($uri)
            $req.Credentials = New-Object System.Net.NetworkCredential($FtpUser, $FtpPass)
            $req.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
            $req.UseBinary = $true
            $req.KeepAlive = $false
            $res = $req.GetResponse()
            $res.Close()
        } catch {
            # Directory already exists or cannot create; continue
        }
    }
}

function Upload-SingleFile($localFile, $relSubpath) {
    $remoteUri = "ftp://$FtpHost" + $RemoteDir.TrimEnd('/') + "/" + $relSubpath
    $req = [System.Net.FtpWebRequest]::Create($remoteUri)
    $req.Credentials = New-Object System.Net.NetworkCredential($FtpUser, $FtpPass)
    $req.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
    $req.UseBinary = $true
    $req.KeepAlive = $false
    $req.Timeout = 30000

    $content = [System.IO.File]::ReadAllBytes($localFile)
    $req.ContentLength = $content.Length
    $stream = $req.GetRequestStream()
    $stream.Write($content, 0, $content.Length)
    $stream.Close()
    $res = $req.GetResponse()
    $statusDesc = $res.StatusDescription.Trim()
    $res.Close()
    return $statusDesc
}

$uploadedLog = @()
$counter = 1

foreach ($f in $files) {
    $rel = $f.FullName.Substring($PatchDir.Length).TrimStart('\').Replace('\', '/')
    $parentDir = [System.IO.Path]::GetDirectoryName($rel).Replace('\', '/')
    if (-not [string]::IsNullOrWhiteSpace($parentDir)) {
        Ensure-RemoteDir $parentDir
    }

    Write-Host ("[{0,2}/{1}] Uploading {2} ({3:N1} KB)..." -f $counter, $totalFiles, $rel, ($f.Length / 1KB)) -NoNewline
    try {
        $status = Upload-SingleFile $f.FullName $rel
        Write-Host " [OK - UPLOADED]" -ForegroundColor Green
        $uploadedLog += [PSCustomObject]@{
            File = $rel
            Size = ("{0:N1} KB" -f ($f.Length / 1KB))
            Status = "UPLOADED"
            Target = "$RemoteDir/$rel"
        }
    } catch {
        Write-Host (" [ERROR: {0}]" -f $_.Exception.Message) -ForegroundColor Red
        $uploadedLog += [PSCustomObject]@{
            File = $rel
            Size = ("{0:N1} KB" -f ($f.Length / 1KB))
            Status = "FAILED"
            Target = "$RemoteDir/$rel"
        }
    }
    $counter++
}

Write-Host ""
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "                 FTP UPLOAD VERIFICATION & STATUS                       " -ForegroundColor Green
Write-Host "========================================================================" -ForegroundColor Cyan
$uploadedLog | Format-Table -AutoSize | Out-String | Write-Host -ForegroundColor White

$successCount = ($uploadedLog | Where-Object { $_.Status -eq "UPLOADED" }).Count
Write-Host ("Summary: {0}/{1} files uploaded successfully!" -f $successCount, $totalFiles) -ForegroundColor Green
if ($successCount -eq $totalFiles) {
    Write-Host "All recent changes are now LIVE on https://smeram-naturals.in" -ForegroundColor Yellow
}

