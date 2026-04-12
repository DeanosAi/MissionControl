param(
  [string]$VpsHost = "vmi3150122.contaboserver.net",
  [string]$VpsUser = "deanadmin",
  [string]$VpsPath = "~/apps/mission-control-vps"
)

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

  Write-Host "OpenAI line: $line" -ForegroundColor Gray

  # Format: - openai-codex usage: 5h 1% left ⏱1h 39m · Week 23% left ⏱5d 20h
  # Extract the part after "usage:"
  if ($line -match 'usage:\s*(.+)$') {
    $usageText = $matches[1]
    Write-Host "Usage text: $usageText" -ForegroundColor Gray
    
    # Split by "Week" to get window and weekly parts (use any character before Week)
    $parts = $usageText -split '\s+Week\s+'
    if ($parts.Count -ne 2) {
      Write-Host "Could not split into window/week parts (got $($parts.Count) parts)" -ForegroundColor Yellow
      Write-Host "Parts: $($parts -join ' | ')" -ForegroundColor Gray
      return $null
    }
    
    # Parse window part: "5h 1% left ⏱1h 36m ·"
    # Match percentage and then everything that looks like time (numbers followed by d/h/m)
    if ($parts[0] -match '([0-9]+%)\s+left.*?([0-9]+[dhm]+(?:\s+[0-9]+[dhm]+)*)') {
      $windowPercent = $matches[1]
      $windowReset = $matches[2].Trim()
    } else {
      Write-Host "Could not parse window part: $($parts[0])" -ForegroundColor Yellow
      return $null
    }
    
    # Parse weekly part: "23% left ⏱5d 20h"
    if ($parts[1] -match '([0-9]+%)\s+left.*?([0-9]+[dhm]+(?:\s+[0-9]+[dhm]+)*)') {
      $weeklyPercent = $matches[1]
      $weeklyReset = $matches[2].Trim()
    } else {
      Write-Host "Could not parse weekly part: $($parts[1])" -ForegroundColor Yellow
      return $null
    }
    
    return [pscustomobject]@{
      WindowLeft = "$windowPercent left"
      ResetIn = $windowReset.Trim()
      WeeklyLeft = "$weeklyPercent left"
      WeeklyResetIn = $weeklyReset.Trim()
    }
  }
  
  Write-Host "Could not parse OpenAI usage. Line was: $line" -ForegroundColor Yellow
  return $null
}

function Get-ClaudeStatus($text) {
  $clean = [regex]::Replace($text, "\x1b\[[0-9;]*m", '')
  $hasAnthropic = $clean -match 'anthropic:default='
  if ($hasAnthropic) {
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
  Write-Host "Using fallback OpenAI data" -ForegroundColor Yellow
  $openai = [pscustomobject]@{
    WindowLeft = 'Unavailable'
    ResetIn = 'Unknown'
    WeeklyLeft = 'Unavailable'
    WeeklyResetIn = 'Unknown'
  }
}

Write-Host "OpenAI: $($openai.WindowLeft), resets in $($openai.ResetIn)" -ForegroundColor Green
Write-Host "Claude: $($claude.Status)" -ForegroundColor Green

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

Write-Host "`nUpdating VPS database..." -ForegroundColor Cyan

# Write SQL to a temporary file on the VPS
$tempFile = "/tmp/usage-snapshot-$([guid]::NewGuid().ToString()).sql"
$sql | ssh "$VpsUser@$VpsHost" "cat > $tempFile"

# Execute the SQL file
$execCommand = "cd $VpsPath && cat $tempFile | sudo docker compose exec -T postgres psql -U mission_control -d mission_control && rm $tempFile"
ssh "$VpsUser@$VpsHost" $execCommand

Write-Host "Success: Usage snapshot updated" -ForegroundColor Green
