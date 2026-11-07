$TaskName = "RP ESG Display Agent"
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "Removed startup task: $TaskName"
