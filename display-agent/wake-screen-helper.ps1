param(
    [string]$DisplayUrl = ""
)

# Local helper used after Wake-on-LAN. It only sends Enter keys to wake the
# Windows display/session and does not type passwords or PINs.
$ErrorActionPreference = "Stop"

Start-Sleep -Milliseconds 1500

$shell = New-Object -ComObject WScript.Shell
for ($i = 1; $i -le 3; $i++) {
    $shell.SendKeys("{ENTER}")
    Write-Host "Sent ENTER key press $i of 3."
    Start-Sleep -Milliseconds 800
}

if ($DisplayUrl) {
    Write-Host "Display URL is ready for kiosk relaunch: $DisplayUrl"
}
