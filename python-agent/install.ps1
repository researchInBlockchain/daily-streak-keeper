# Installs the LeetCode Daily Agent for the current Windows user (no admin needed).
#
# - Copies agent.py to %USERPROFILE%\LeetCodeDailyAgent (config.json is created once, never overwritten)
# - Registers a Task Scheduler task "LeetCodeDailyAgent" that runs:
#     * whenever the laptop connects to a network (NetworkProfile event 10000)
#     * at logon
#     * daily shortly after the daily problem resets (00:00 UTC), repeating every 3 h,
#       and "as soon as possible" if the laptop was off or asleep at that time
#   The agent itself skips the run if today's problem is already solved, so extra runs cost nothing.
#
# Usage:  powershell -ExecutionPolicy Bypass -File .\install.ps1

# Default install folder is %USERPROFILE%\LeetCodeDailyAgent. (Not %LOCALAPPDATA%: when the
# installer is launched from a packaged/MSIX app, Windows silently redirects AppData writes
# into that app's private folder, where Task Scheduler cannot find them.)
param([string]$Dest = (Join-Path $env:USERPROFILE 'LeetCodeDailyAgent'))

$ErrorActionPreference = 'Stop'
$TaskName = 'LeetCodeDailyAgent'
$Src  = Split-Path -Parent $MyInvocation.MyCommand.Path

# --- Python -----------------------------------------------------------------
$py = Get-Command pythonw.exe -ErrorAction SilentlyContinue |
      Where-Object { $_.Source -notlike '*WindowsApps*' } | Select-Object -First 1
if (-not $py) { throw 'pythonw.exe not found on PATH. Install Python 3.8+ from python.org first.' }
$Pythonw = $py.Source

# --- Files ------------------------------------------------------------------
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
Copy-Item (Join-Path $Src 'agent.py') $Dest -Force
$Config = Join-Path $Dest 'config.json'
if (-not (Test-Path $Config)) {
    Copy-Item (Join-Path $Src 'config.example.json') $Config
    $created = $true
}

# --- Cookie sync (browser extension -> native messaging host) ----------------
# Lets the "LeetCode Daily Agent - cookie sync" extension in Chrome/Edge write fresh
# login cookies into config.json. Registered per user (HKCU), no admin needed.
$HostName = 'com.leetcode_daily_agent.cookie_sync'
$ExtId    = 'nklpaocmgchdfdnpgbmnadkpfdgkmjic'   # fixed by the "key" in browser-extension\manifest.json
$Python   = Join-Path (Split-Path $Pythonw) 'python.exe'
Copy-Item (Join-Path $Src 'native_host.py') $Dest -Force
New-Item -ItemType Directory -Force -Path (Join-Path $Dest 'browser-extension') | Out-Null
Copy-Item (Join-Path $Src 'browser-extension\*') (Join-Path $Dest 'browser-extension') -Force
Set-Content -Path (Join-Path $Dest 'native_host.bat') -Encoding Ascii -Value "@echo off`r`n`"$Python`" -I `"%~dp0native_host.py`" %*"
$HostManifest = Join-Path $Dest "$HostName.json"
@{
    name            = $HostName
    description     = 'LeetCode Daily Agent cookie sync'
    path            = (Join-Path $Dest 'native_host.bat')
    type            = 'stdio'
    allowed_origins = @("chrome-extension://$ExtId/")
} | ConvertTo-Json | Set-Content -Path $HostManifest -Encoding Ascii
foreach ($browser in 'Google\Chrome', 'Microsoft\Edge') {
    $key = "HKCU:\Software\$browser\NativeMessagingHosts\$HostName"
    New-Item -Path $key -Force | Out-Null
    Set-Item -Path $key -Value $HostManifest
}

# --- Schedule ---------------------------------------------------------------
# Local time of 00:20 UTC today (20 min after the daily problem changes).
$utc   = [DateTime]::SpecifyKind([DateTime]::UtcNow.Date.AddMinutes(20), [DateTimeKind]::Utc)
$start = $utc.ToLocalTime().ToString('yyyy-MM-ddTHH:mm:ss')

function Esc([string]$s) { [Security.SecurityElement]::Escape($s) }
$User = "$env:USERDOMAIN\$env:USERNAME"
$NetQuery = "<QueryList><Query Id=`"0`" Path=`"Microsoft-Windows-NetworkProfile/Operational`"><Select Path=`"Microsoft-Windows-NetworkProfile/Operational`">*[System[Provider[@Name='Microsoft-Windows-NetworkProfile'] and EventID=10000]]</Select></Query></QueryList>"

function Build-Xml([bool]$withLogon) {
    $logon = ''
    if ($withLogon) {
        $logon = "<LogonTrigger><Enabled>true</Enabled><UserId>$(Esc $User)</UserId><Delay>PT1M</Delay></LogonTrigger>"
    }
@"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Solves and submits the LeetCode problem of the day when the laptop is online.</Description>
  </RegistrationInfo>
  <Triggers>
    $logon
    <EventTrigger>
      <Enabled>true</Enabled>
      <Subscription>$(Esc $NetQuery)</Subscription>
      <Delay>PT30S</Delay>
    </EventTrigger>
    <CalendarTrigger>
      <StartBoundary>$start</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>
      <Repetition><Interval>PT3H</Interval><Duration>PT21H</Duration><StopAtDurationEnd>false</StopAtDurationEnd></Repetition>
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>$(Esc $User)</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable>
    <IdleSettings><StopOnIdleEnd>false</StopOnIdleEnd><RestartOnIdle>false</RestartOnIdle></IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT1H</ExecutionTimeLimit>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>$(Esc $Pythonw)</Command>
      <Arguments>$(Esc ('"' + (Join-Path $Dest 'agent.py') + '"'))</Arguments>
      <WorkingDirectory>$(Esc $Dest)</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"@
}

try {
    Register-ScheduledTask -TaskName $TaskName -Xml (Build-Xml $true) -Force | Out-Null
} catch {
    Write-Warning "Could not add the logon trigger ($($_.Exception.Message)); registering without it."
    Register-ScheduledTask -TaskName $TaskName -Xml (Build-Xml $false) -Force | Out-Null
}

Write-Host ""
Write-Host "Installed to   : $Dest"
Write-Host "Scheduled task : $TaskName  (daily from $start local time, on network connect, at logon)"
Write-Host "Python         : $Pythonw"
if ($created) {
    Write-Host ""
    Write-Host "NEXT STEP: put your LeetCode cookies (and optionally a free LLM key) into:" -ForegroundColor Yellow
    Write-Host "  $Config" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Auto cookie refresh: in Chrome/Edge open chrome://extensions (edge://extensions)," -ForegroundColor Cyan
Write-Host "  turn on Developer mode, click 'Load unpacked' and pick:" -ForegroundColor Cyan
Write-Host "  $(Join-Path $Dest 'browser-extension')" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test it now :  Start-ScheduledTask -TaskName $TaskName"
Write-Host "Watch log   :  Get-Content '$Dest\agent.log' -Tail 20 -Wait"
