param([string]$Destination = (Join-Path $HOME '.hindsight'))
$ErrorActionPreference = 'Stop'
$Destination = [IO.Path]::GetFullPath($Destination)
$python = Join-Path $Destination 'venv\Scripts\python.exe'
$ui = Join-Path $Destination 'control-plane\node_modules\@vectorize-io\hindsight-control-plane\bin\cli.js'
if (-not (Test-Path -LiteralPath $python) -or -not (Test-Path -LiteralPath $ui)) {
    throw 'Install the official native GPU API into <Destination>\venv and Control Plane into <Destination>\control-plane first. See windows/README.md. No files changed.'
}
$stateFile = Join-Path $Destination 'tray-services.json'
if (Test-Path -LiteralPath $stateFile) {
    $state = Get-Content -LiteralPath $stateFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($state.phase -ne 'stopped') { throw 'Stop managed services and exit the tray before replacing manager scripts.' }
}
$trays = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq 'powershell.exe' -and $_.CommandLine -like ('*' + (Join-Path $Destination 'hindsight-tray.ps1') + '*')
}
if ($trays) { throw 'Exit the existing tray before installation.' }
& $python -c 'import torch, httpx, psutil, dotenv, packaging, pg0; assert torch.cuda.is_available(), "CUDA unavailable"'
if ($LASTEXITCODE -ne 0) { throw 'Required Python dependencies / CUDA are unavailable. No files changed.' }
$files = @('manage-services.py','update-server.py','tray-api.py','hindsight-tray.ps1','Hindsight.vbs')
$backup = Join-Path $Destination ('manager-backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
foreach ($name in $files) {
    $target = Join-Path $Destination $name
    if (Test-Path -LiteralPath $target) { Copy-Item -LiteralPath $target -Destination (Join-Path $backup $name) }
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $target
}
$config = Join-Path $Destination '.env'
if (-not (Test-Path -LiteralPath $config)) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot '.env.example') -Destination $config
    & $python -c 'import pathlib,secrets,sys; p=pathlib.Path(sys.argv[1]); s=p.read_text(encoding="utf-8"); p.write_text(s.replace("HINDSIGHT_API_TENANT_API_KEY=", "HINDSIGHT_API_TENANT_API_KEY="+secrets.token_urlsafe(48), 1),encoding="utf-8")' $config
    if ($LASTEXITCODE -ne 0) { throw 'Could not initialize API key. Configure .env locally before starting.' }
}
$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Programs')) 'Hindsight Companion.lnk'))
$link.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
$link.Arguments = '"' + (Join-Path $Destination 'Hindsight.vbs') + '"'
$link.WorkingDirectory = $Destination
$link.Description = 'Hindsight API and Control Plane tray manager'
$link.Save()
Write-Output 'Installed tray scripts; existing configuration preserved. Configure .env locally, then open Hindsight Companion from Start Menu. Services were not started.'
