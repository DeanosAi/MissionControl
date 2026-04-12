Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -like '*usage-update-loop.ps1*' } |
  ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force
    Write-Host "Stopped usage update loop process $($_.ProcessId)"
  }
