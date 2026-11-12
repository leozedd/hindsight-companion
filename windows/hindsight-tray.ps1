Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$python = Join-Path $root 'venv\Scripts\python.exe'
$manager = Join-Path $root 'manage-services.py'
$stateFile = Join-Path $root 'tray-services.json'
$logDir = Join-Path $root 'logs'
[IO.Directory]::CreateDirectory($logDir) | Out-Null
$created = $false
$mutex = [Threading.Mutex]::new($true, ('Local\HindsightTray-' + $env:USERNAME), [ref]$created)
if (-not $created) {
    try {
        $existing = Get-Content -Raw -LiteralPath $stateFile -Encoding UTF8 | ConvertFrom-Json
        if ($existing.phase -eq 'running') { Start-Process 'http://127.0.0.1:9999' }
    } catch { }
    $mutex.Dispose()
    exit
}

$script:job = $null
$script:jobAction = ''
$script:exitAfterStop = $false
$script:lastError = ''
$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = [Drawing.SystemIcons]::Application
$tray.Text = 'Hindsight - starting'
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$statusItem = $menu.Items.Add('状态：准备启动')
$statusItem.Enabled = $false
$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null
$openItem = $menu.Items.Add('打开管理页面')
$startItem = $menu.Items.Add('启动前后端')
$stopItem = $menu.Items.Add('停止前后端（释放显存）')
$updateItem = $menu.Items.Add('检查并更新前后端…')
$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null
$logsItem = $menu.Items.Add('打开日志目录')
$configItem = $menu.Items.Add('编辑配置文件')
$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null
$exitItem = $menu.Items.Add('退出并停止服务')
$tray.ContextMenuStrip = $menu
$tray.Visible = $true

function Show-Notice([string]$text) {
    $tray.BalloonTipTitle = 'Hindsight'
    $tray.BalloonTipText = $text
    $tray.ShowBalloonTip(4000)
}

function Start-Action([string]$action) {
    if ($script:job -and -not $script:job.HasExited) { return }
    if ($script:job) { $script:job.Dispose() }
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = $python
    $info.Arguments = '"' + $manager + '" ' + $action
    $info.WorkingDirectory = $root
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $script:job = [Diagnostics.Process]::Start($info)
    $script:jobAction = $action
    $startItem.Enabled = $false
    $stopItem.Enabled = $false
    $updateItem.Enabled = $false
    $exitItem.Enabled = $false
    if ($action -eq 'start') { $statusItem.Text = '状态：正在启动…' }
    elseif ($action -eq 'update') { $statusItem.Text = '状态：检查并更新前后端…' }
    else { $statusItem.Text = '状态：正在停止，请稍候…' }
}

function Open-UI {
    try {
        $state = Get-Content -Raw -LiteralPath $stateFile -Encoding UTF8 | ConvertFrom-Json
        if ($state.phase -eq 'running') { Start-Process 'http://127.0.0.1:9999' }
        else { Show-Notice '前后端尚未就绪。请稍候，或右键托盘图标查看状态。' }
    } catch { Show-Notice '前后端尚未启动。' }
}

$openItem.Add_Click({ Open-UI })
$tray.Add_DoubleClick({ Open-UI })
$startItem.Add_Click({ Start-Action 'start' })
$stopItem.Add_Click({ Start-Action 'stop' })
$updateItem.Add_Click({
    $answer = [Windows.Forms.MessageBox]::Show('检查并更新 Hindsight 前后端。发现新版后会备份数据库和配置，并短暂停止服务；不会更新 Pi 插件。是否继续？', 'Hindsight 更新', [Windows.Forms.MessageBoxButtons]::YesNo, [Windows.Forms.MessageBoxIcon]::Question)
    if ($answer -eq [Windows.Forms.DialogResult]::Yes) { Start-Action 'update' }
})
$logsItem.Add_Click({ Start-Process explorer.exe -ArgumentList ('"' + $logDir + '"') })
$configItem.Add_Click({ Start-Process notepad.exe -ArgumentList ('"' + (Join-Path $root '.env') + '"') })
$exitItem.Add_Click({ $script:exitAfterStop = $true; Start-Action 'stop' })
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 1500
$timer.Add_Tick({
    try {
        $busy = $script:job -and -not $script:job.HasExited
        $state = Get-Content -Raw -LiteralPath $stateFile -Encoding UTF8 | ConvertFrom-Json
        $phase = $state.phase
        if ($phase -eq 'running' -and -not $busy) {
            foreach ($service in $state.services.PSObject.Properties) {
                $process = Get-Process -Id $service.Value.pid -ErrorAction SilentlyContinue
                if (-not $process) { $phase = 'unexpected_exit'; break }
            }
        }
        switch ($phase) {
            'running' { $statusItem.Text = '状态：前后端运行中'; $tray.Text = 'Hindsight - running' }
            'starting' { $statusItem.Text = '状态：正在启动…'; $tray.Text = 'Hindsight - starting' }
            'stopping' { $statusItem.Text = '状态：正在停止，请稍候…'; $tray.Text = 'Hindsight - stopping' }
            'stopped' { $statusItem.Text = '状态：已停止，显存已释放'; $tray.Text = 'Hindsight - stopped' }
            'unexpected_exit' { $statusItem.Text = '状态：服务意外退出，请查看日志'; $tray.Text = 'Hindsight - service exited' }
            'error' {
                $statusItem.Text = '状态：操作失败，请查看日志'
                $tray.Text = 'Hindsight - error'
                if ($state.error -ne $script:lastError) {
                    $script:lastError = $state.error
                    Show-Notice ('操作失败：' + $state.error)
                }
            }
        }
        if ($busy -and $script:jobAction -eq 'update') {
            $statusItem.Text = '状态：检查并更新前后端，请稍候…'
            $tray.Text = 'Hindsight - updating'
        }
        $updateItem.Enabled = -not $busy -and $phase -notin @('starting','stopping')
        $startItem.Enabled = -not $busy -and $phase -notin @('running','starting','stopping')
        $stopItem.Enabled = -not $busy -and $phase -notin @('stopped','starting','stopping')
        $exitItem.Enabled = -not $busy
        if ($script:job -and $script:job.HasExited) {
            if ($script:jobAction -eq 'update') {
                try {
                    $result = Get-Content -Raw -LiteralPath (Join-Path $root 'server-update-result.json') -Encoding UTF8 | ConvertFrom-Json
                    switch ($result.status) {
                        'updated' { Show-Notice ('前后端已更新：API ' + $result.target.api + '，前端 ' + $result.target.ui) }
                        'up_to_date' { Show-Notice '前后端已是最新稳定版。' }
                        'rolled_back' { Show-Notice '更新验证失败，已恢复旧版本和数据库。详情见日志。' }
                        default { Show-Notice '更新未完成。旧版本备份及原因见 server-update-result.json 和日志。' }
                    }
                } catch { Show-Notice '无法读取更新结果，请查看日志。' }
            }
            if ($script:job.ExitCode -ne 0 -and $phase -ne 'error') {
                Show-Notice '启动或停止操作失败，请检查 logs\manager.log。'
            }
            if ($script:exitAfterStop) {
                if ($phase -eq 'stopped') { [Windows.Forms.Application]::Exit() }
                else { $script:exitAfterStop = $false }
            }
            $script:job.Dispose()
            $script:job = $null
        }
    } catch {
        Add-Content -LiteralPath (Join-Path $logDir 'tray.log') -Encoding UTF8 -Value $_.Exception.Message
    }
})

try {
    Start-Action 'start'
    $timer.Start()
    [Windows.Forms.Application]::Run()
} finally {
    $timer.Stop()
    $timer.Dispose()
    $tray.Visible = $false
    $tray.Dispose()
    $menu.Dispose()
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
