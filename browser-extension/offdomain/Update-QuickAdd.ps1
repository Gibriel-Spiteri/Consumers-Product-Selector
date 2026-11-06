# Consumers QuickAdd for a PC that is NOT on the domain (Group Policy cannot install it there).
# Puts the newest version in C:\ProgramData\ConsumersQuickAdd\consumers-quickadd, the folder Edge's
# "Load unpacked" points at. Safe to run again any time, by hand or on a daily NinjaOne schedule: it only
# replaces the files when a newer version is out, and Edge uses them after its next restart.
# Run as administrator (or as SYSTEM from NinjaOne). Windows PowerShell 5.1 or later.
param([string]$Base = 'C:\ProgramData\ConsumersQuickAdd')
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$dest = Join-Path $Base 'consumers-quickadd'

$xml  = (Invoke-WebRequest 'https://consumers-product-selector.replit.app/api/quickadd/update.xml' -UseBasicParsing).Content
$ver  = ([regex]::Match($xml, "<updatecheck[^>]*\bversion='([\d.]+)'")).Groups[1].Value
$url  = ([regex]::Match($xml, "codebase='([^']+)'")).Groups[1].Value
$hash = ([regex]::Match($xml, "hash_sha256='([0-9a-f]{64})'")).Groups[1].Value
if (-not $ver -or -not $url) { throw 'The QuickAdd update file did not name a version.' }
$have = if (Test-Path "$dest\manifest.json") { (Get-Content "$dest\manifest.json" -Raw | ConvertFrom-Json).version } else { '' }
if ($have -eq $ver) { "Consumers QuickAdd $ver is already in $dest"; return }

$work = Join-Path $env:TEMP "consumers-quickadd-$ver"
if (Test-Path $work) { Remove-Item $work -Recurse -Force }
New-Item -ItemType Directory -Force $work | Out-Null
$crxFile = Join-Path $work 'package.crx'
Invoke-WebRequest $url -UseBasicParsing -OutFile $crxFile
if ($hash -and (Get-FileHash $crxFile -Algorithm SHA256).Hash.ToLower() -ne $hash) { throw 'The downloaded package does not match the update file.' }

# A .crx is a signed header in front of an ordinary zip: skip the header, unzip the rest.
$crx = [IO.File]::ReadAllBytes($crxFile)
if ([Text.Encoding]::ASCII.GetString($crx, 0, 4) -ne 'Cr24') { throw 'Not a QuickAdd package.' }
$start = 12 + [BitConverter]::ToUInt32($crx, 8)
$zipFile = Join-Path $work 'package.zip'
$fs = [IO.File]::Create($zipFile); $fs.Write($crx, $start, $crx.Length - $start); $fs.Close()
Expand-Archive $zipFile (Join-Path $work 'files') -Force

New-Item -ItemType Directory -Force $Base | Out-Null
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
Copy-Item (Join-Path $work 'files') $dest -Recurse
Remove-Item $work -Recurse -Force
"Consumers QuickAdd $ver is now in $dest (was: $(if ($have) { $have } else { 'not installed' })). Restart Edge to use it."
