# Removes the LeetCodeDailyAgent scheduled task. Pass -RemoveFiles to also delete the install
# folder (default %USERPROFILE%\LeetCodeDailyAgent: config with your cookies, logs, saved solutions).
param([switch]$RemoveFiles, [string]$Dest = (Join-Path $env:USERPROFILE 'LeetCodeDailyAgent'))

Unregister-ScheduledTask -TaskName 'LeetCodeDailyAgent' -Confirm:$false -ErrorAction SilentlyContinue
foreach ($browser in 'Google\Chrome', 'Microsoft\Edge') {
    Remove-Item "HKCU:\Software\$browser\NativeMessagingHosts\com.leetcode_daily_agent.cookie_sync" -ErrorAction SilentlyContinue
}
Write-Host 'Scheduled task and cookie-sync registration removed.'
if ($RemoveFiles) {
    Remove-Item -Recurse -Force $Dest -ErrorAction SilentlyContinue
    Write-Host 'Files removed.'
}
