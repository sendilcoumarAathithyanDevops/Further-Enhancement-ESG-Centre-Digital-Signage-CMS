$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms

$screens = [System.Windows.Forms.Screen]::AllScreens
$target = $screens | Where-Object { -not $_.Primary } | Select-Object -First 1
if (-not $target) {
    $target = $screens | Where-Object { $_.Primary } | Select-Object -First 1
}

if (-not $target) {
    throw "Windows did not report any active displays."
}

[pscustomobject]@{
    deviceName = $target.DeviceName
    isPrimary = $target.Primary
    x = $target.Bounds.X
    y = $target.Bounds.Y
} | ConvertTo-Json -Compress
