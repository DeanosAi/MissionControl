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

# Use plink (PuTTY's command-line SSH client) which can use Pageant for key management
# Or use OpenSSH with ControlMaster for connection reuse

# Simple approach: write SQL to temp file locally, scp it, execute it, delete it
$localTempFile = [System.IO.Path]::GetTempFileName()
$remoteTempFile = "/tmp/usage-snapshot-$(Get-Date -Format 'yyyyMMddHHmmss').sql"

try {
    # Write SQL to local temp file
    $sql | Out-File -FilePath $localTempFile -Encoding ASCII -NoNewline
    
    # Copy to VPS using scp (will prompt for passphrase)
    Write-Host "Uploading SQL file (you may be prompted for your SSH key passphrase)..." -ForegroundColor Yellow
    & scp $localTempFile "${VpsUser}@${VpsHost}:${remoteTempFile}"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to copy SQL file to VPS"
    }
    
    # Execute SQL on VPS using a temporary wrapper script to avoid brittle inline quoting
    Write-Host "Executing SQL on VPS..." -ForegroundColor Gray
    $remoteRunnerFile = "/tmp/usage-runner-$(Get-Date -Format 'yyyyMMddHHmmss').sh"
    $remoteRunner = @"
#!/bin/bash
set -euo pipefail
cat "$remoteTempFile" | sudo /home/$VpsUser/apps/mission-control-vps/scripts/vps-insert-usage-snapshot.sh
rm -f "$remoteTempFile"
rm -f "$remoteRunnerFile"
"@

    $localRunnerFile = [System.IO.Path]::GetTempFileName()
    try {
        $remoteRunner | Out-File -FilePath $localRunnerFile -Encoding ASCII -NoNewline
        & scp $localRunnerFile "${VpsUser}@${VpsHost}:${remoteRunnerFile}"
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to copy runner script to VPS"
        }

        & ssh "${VpsUser}@${VpsHost}" "chmod +x $remoteRunnerFile && bash $remoteRunnerFile"
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to execute SQL on VPS"
        }
    } finally {
        if (Test-Path $localRunnerFile) {
            Remove-Item $localRunnerFile -Force
        }
    }
    
    Write-Host "Success: Usage snapshot updated" -ForegroundColor Green
    
} finally {
    # Clean up local temp file
    if (Test-Path $localTempFile) {
        Remove-Item $localTempFile -Force
    }
}
