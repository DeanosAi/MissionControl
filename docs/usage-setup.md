# Usage & Limits Setup

The Usage page and Home usage panel show live OpenAI/Codex and Anthropic provider status.

## How it works

1. **Local script** runs on your Windows machine (where OpenClaw is installed)
2. Script reads `openclaw models status`
3. Script connects to the VPS via SSH and writes the snapshot to the database
4. Mission Control app reads the latest snapshot and displays it

## One-time setup

### 1. Ensure SSH key authentication works

Test that you can SSH to the VPS without a password:

```powershell
ssh deanadmin@vmi3150122.contaboserver.net "echo 'SSH works'"
```

If this asks for a password, you need to set up SSH key authentication first.

### 2. Test the script manually

On your **local Windows machine**:

```powershell
cd "A:\Desktop\Mission Control VPS\vps-app"
.\scripts\update-usage-snapshot-remote.ps1
```

You should see:
```
Reading OpenClaw status...
OpenAI: 93% left, resets in 4h 59m
Claude: Connected
Executing SQL on VPS...
✓ Usage snapshot updated
```

Then refresh Mission Control - the Home page and `/usage` should show real data.

## Schedule automatic updates (Windows Task Scheduler)

To keep the data fresh, create a scheduled task on your **local Windows machine**:

1. Open Task Scheduler (Win + R, type `taskschd.msc`)
2. Create a new task:
   - **Name**: Mission Control Usage Update
   - **Trigger**: Every 10 minutes
   - **Action**: 
     - Program: `powershell.exe`
     - Arguments: `-NoProfile -ExecutionPolicy Bypass -File "A:\Desktop\Mission Control VPS\vps-app\scripts\update-usage-snapshot-remote.ps1"`
   - **Conditions**: Uncheck "Start only if on AC power"
   - **Settings**: Check "Run task as soon as possible after a scheduled start is missed"

Or use this PowerShell command to create the task:

```powershell
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument '-NoProfile -ExecutionPolicy Bypass -File "A:\Desktop\Mission Control VPS\vps-app\scripts\update-usage-snapshot-remote.ps1"'
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration ([TimeSpan]::MaxValue)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName "Mission Control Usage Update" -Action $action -Trigger $trigger -Settings $settings -User $env:USERNAME
```

## Verify it's working

After running the script, refresh Mission Control - you should see real usage data instead of "Unavailable".
