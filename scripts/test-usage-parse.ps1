$ErrorActionPreference = 'Stop'

Write-Host "Reading OpenClaw status..." -ForegroundColor Cyan
$statusOutput = & openclaw models status 2>&1 | Out-String

function Get-OpenAiUsage($text) {
  $clean = [regex]::Replace($text, "\x1b\[[0-9;]*m", '')
  $line = ($clean -split "`r?`n") | Where-Object { $_ -match 'openai-codex' -and $_ -match 'usage:' } | Select-Object -First 1
  if (-not $line) {
    Write-Host "Could not find OpenAI usage line" -ForegroundColor Yellow
    return $null
  }

  if ($line -match 'usage:\s*(.+)$') {
    $usageText = $matches[1]
    
    $parts = $usageText -split '\s+Week\s+'
    if ($parts.Count -ne 2) {
      return $null
    }
    
    if ($parts[0] -match '([0-9]+%)\s+left.*?([0-9]+[dhm]+(?:\s+[0-9]+[dhm]+)*)') {
      $windowPercent = $matches[1]
      $windowReset = $matches[2].Trim()
    } else {
      return $null
    }
    
    if ($parts[1] -match '([0-9]+%)\s+left.*?([0-9]+[dhm]+(?:\s+[0-9]+[dhm]+)*)') {
      $weeklyPercent = $matches[1]
      $weeklyReset = $matches[2].Trim()
    } else {
      return $null
    }
    
    return [pscustomobject]@{
      WindowLeft = "$windowPercent left"
      ResetIn = $windowReset
      WeeklyLeft = "$weeklyPercent left"
      WeeklyResetIn = $weeklyReset
    }
  }
  
  return $null
}

$openai = Get-OpenAiUsage $statusOutput

if ($openai) {
  Write-Host "`nParsed successfully:" -ForegroundColor Green
  Write-Host "  Window: $($openai.WindowLeft)" -ForegroundColor Cyan
  Write-Host "  Resets in: $($openai.ResetIn)" -ForegroundColor Cyan
  Write-Host "  Weekly: $($openai.WeeklyLeft)" -ForegroundColor Cyan
  Write-Host "  Weekly resets: $($openai.WeeklyResetIn)" -ForegroundColor Cyan
} else {
  Write-Host "Failed to parse OpenAI data" -ForegroundColor Red
}
