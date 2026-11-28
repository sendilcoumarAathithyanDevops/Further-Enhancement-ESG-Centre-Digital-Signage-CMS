$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;

public static class PowerManagement {
    [DllImport("powrprof.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetSuspendState(bool hibernate, bool forceCritical, bool disableWakeEvent);
}
"@

Write-Output "Requesting Windows sleep."
Start-Sleep -Seconds 2

if (-not [PowerManagement]::SetSuspendState($false, $false, $false)) {
    $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    throw "Windows sleep request failed (Win32 error $errorCode)."
}

Write-Output "Windows resumed from sleep."
