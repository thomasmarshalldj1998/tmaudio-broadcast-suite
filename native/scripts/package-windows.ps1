# TMAUDIO v1.0 Standalone — Windows portable packaging (x64, /MT)
# Produces dist\TMAUDIO.exe + presets\ + README.txt, runnable from any folder
# or USB stick with no installer and no VC++ redistributable.
$ErrorActionPreference = "Stop"

$root     = Split-Path -Parent $PSScriptRoot
$build    = Join-Path $root "build\win\Release"
$dist     = Join-Path $root "dist"
$exe      = Join-Path $build "TMAUDIO.exe"

if (-not (Test-Path $exe)) {
  Write-Error "Build first: cmake --build build/win --config Release --parallel"
}

if (Test-Path $dist) { Remove-Item -Recurse -Force $dist }
New-Item -ItemType Directory -Force -Path $dist, (Join-Path $dist "presets") | Out-Null

Copy-Item $exe (Join-Path $dist "TMAUDIO.exe")
Copy-Item (Join-Path $root "presets\*.tm") (Join-Path $dist "presets\") -Recurse

# No external DLLs: the binary must resolve only system DLLs.
$deps = & dumpbin /dependents (Join-Path $dist "TMAUDIO.exe") |
        Select-String -Pattern "\.dll" |
        ForEach-Object { $_.Line.Trim() }
$allowed = @("KERNEL32.dll", "USER32.dll", "GDI32.dll", "ADVAPI32.dll",
             "SHELL32.dll", "ole32.dll", "oleaut32.dll", "WS2_32.dll",
             "WINMM.dll", "IMM32.dll", "COMDLG32.dll", "COMCTL32.dll",
             "SHLWAPI.dll", "VERSION.dll", "ntdll.dll", "MSVCRT.dll")
$bad = $deps | Where-Object { $_ -and ($allowed -notcontains $_) }
if ($bad) {
  Write-Error "External runtime dependency detected: $($bad -join ', ')"
}

@'
TMAUDIO Digital Broadcast Processing Suite - Standalone Edition v1.0

1. Copy this whole folder anywhere (disk, USB, network share).
2. Double-click TMAUDIO.exe - no installer, no admin rights.
3. Presets live in .\presets as plain text - edit them in any editor.
4. Logs are written to .\logs (24 h compliance CSV, 30-day roll).
5. Uninstall = delete this folder.

No telemetry, no background services, no network calls except the
stream destinations you configure.
'@ | Set-Content -Encoding UTF8 (Join-Path $dist "README.txt")

# Optional: sign with your own certificate before distributing.
if ($env:TMAUDIO_PFX) {
  & signtool sign /f $env:TMAUDIO_PFX /p $env:TMAUDIO_PFX_PW /fd SHA256 `
      (Join-Path $dist "TMAUDIO.exe")
}

Write-Host "OK -> $dist\TMAUDIO.exe"
