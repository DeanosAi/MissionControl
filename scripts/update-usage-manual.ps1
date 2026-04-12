$ErrorActionPreference = 'Stop'

Write-Host "Reading OpenClaw status..." -ForegroundColor Cyan
$statusOutput = & openclaw models status 2>&1 | Out-String

function Get-OpenAiUsage($text) {
  $clean = [regex]::Replace($text, "\x1b\[[0-9;]*m", '')
  $line = ($clean -split "`r?`n") | Where-Object { $_ -match 'openai-codex' -and $_ -match 'usage:' } | Select-Object -First 1
  if (-not $line) {
    return $null
  }

  if ($line -match 'usage:\s*(.+)$') {
    $usageText = $matches[1]
    $parts = $usageText -split '\s+Week\s+'
    if ($parts.Count -ne 2) { return $null }
    
    if ($parts[0] -match '([0-9]+%)\s+left.*?([0-9]+[dhm]+(?:\s+[0-9]+[dhm]+)*)') {
      $windowPercent = $matches[1]
      $windowReset = $matches[2].Trim()
    } else { return $null }
    
    if ($parts[1] -match '([0-9]+%)\s+left.*?([0-9]+[dhm]+(?:\s+[0-9]+[dhm]+)*)') {
      $weeklyPercent = $matches[1]
      $weeklyReset = $matches[2].Trim()
    } else { return $null }
    
    return [pscustomobject]@{
      WindowLeft = "$windowPercent left"
      ResetIn = $windowReset
      WeeklyLeft = "$weeklyPercent left"
      WeeklyResetIn = $weeklyReset
    }
  }
  return $null
}

function Get-ClaudeStatus($text) {
  $clean = [regex]::Replace($text, "\x1b\[[0-9;]*m", '')
  if ($clean -match 'anthropic:default=') {
    return [pscustomobject]@{
      Status = 'Connected'
      Note = 'Anthropic key is active. Exact remaining spend/credits are not exposed by the current verified host-side status source.'
    }
  }
  return [pscustomobject]@{
    Status = 'Unavailable'
    Note = 'Anthropic provider details unavailable.'
  }
}

$openai = Get-OpenAiUsage $statusOutput
$claude = Get-ClaudeStatus $statusOutput

if (-not $openai) {
  $openai = [pscustomobject]@{
    WindowLeft = 'Unavailable'
    ResetIn = 'Unknown'
    WeeklyLeft = 'Unavailable'
    WeeklyResetIn = 'Unknown'
  }
}

Write-Host "`nParsed data:" -ForegroundColor Green
Write-Host "  OpenAI window: $($openai.WindowLeft), resets in $($openai.ResetIn)" -ForegroundColor Cyan
Write-Host "  OpenAI weekly: $($openai.WeeklyLeft), resets in $($openai.WeeklyResetIn)" -ForegroundColor Cyan
Write-Host "  Claude: $($claude.Status)" -ForegroundColor Cyan

$sql = @"
INSERT INTO mission_control.usage_snapshots (
  source,
  openai_window_left,
  openai_reset_in,
  openai_weekly_left,
  openai_weekly_reset_in,
  claude_status,
  claude_note
)
VALUES (
  'host-openclaw-models-status',
  '$($openai.WindowLeft.Replace("'", "''"))',
  '$($openai.ResetIn.Replace("'", "''"))',
  '$($openai.WeeklyLeft.Replace("'", "''"))',
  '$($openai.WeeklyResetIn.Replace("'", "''"))',
  '$($claude.Status.Replace("'", "''"))',
  '$($claude.Note.Replace("'", "''"))'
);
"@

Write-Host "`n========== SQL TO RUN ON VPS ==========" -ForegroundColor Yellow
Write-Host $sql -ForegroundColor Gray
Write-Host "========================================`n" -ForegroundColor Yellow

Write-Host "To update the VPS, SSH to it and run:" -ForegroundColor Cyan
Write-Host "ssh deanadmin@vmi3150122.contaboserver.net" -ForegroundColor White
Write-Host "cd ~/apps/mission-control-vps" -ForegroundColor White
Write-Host "cat << 'EOF' | sudo docker compose exec -T postgres psql -U mission_control -d mission_control" -ForegroundColor White
Write-Host $sql -ForegroundColor Gray
Write-Host "EOF" -ForegroundColor White
