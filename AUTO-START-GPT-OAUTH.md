# Auto-Start GPT OAuth Tunnel

## What This Does

Automatically starts the GPT OAuth tunnel (via Cloudflare) when you log in to Windows. This means:

- ✅ GPT-5.4 is always available when your PC is on
- ✅ No need to manually start the tunnel script
- ✅ Tunnel auto-restarts if it crashes
- ✅ Runs hidden in the background

## Setup (One-Time)

```powershell
cd C:\Users\deano\Projects\mission-control
.\scripts\setup-autostart-gpt-oauth.ps1
```

**Then restart your PC** (or log out and back in).

The tunnel will start automatically on every login!

## Verify It's Running

After reboot, check if GPT is online:

1. Visit https://app.missioncontroldb.online/chat
2. Look for green "GPT Online" badge
3. GPT-5.4 should be in the model dropdown

Or check the process:

```powershell
Get-Process -Name powershell | Where-Object {$_.MainWindowTitle -eq ""}
```

## Management

### Disable Auto-Start (Temporary)

```powershell
.\scripts\disable-autostart-gpt-oauth.ps1
```

The tunnel won't start on next login, but the task remains.

### Re-Enable

```powershell
.\scripts\setup-autostart-gpt-oauth.ps1
```

### Remove Completely

```powershell
.\scripts\remove-autostart-gpt-oauth.ps1
```

Deletes the scheduled task entirely.

### Manual Control

**Start manually** (if auto-start is disabled):
```powershell
.\scripts\start-gpt-oauth-cloudflare.ps1
```

**Stop the tunnel:**
- Find the hidden PowerShell process and kill it:
  ```powershell
  Get-Process -Name powershell | Where-Object {$_.MainWindowTitle -eq ""} | Stop-Process
  ```

## How It Works

- **Task Scheduler** creates a task called `MissionControl-GPT-OAuth`
- **Trigger:** Runs when you log in to Windows
- **Action:** Starts `start-gpt-oauth-cloudflare.ps1` hidden
- **Settings:** Auto-restarts if it crashes (3 retries, 1-minute intervals)

## Troubleshooting

### GPT shows offline after reboot

Check if the tunnel is running:
```powershell
Get-Process -Name cloudflared
```

If not running, check Task Scheduler:
- Press `Win+R`, type `taskschd.msc`, press Enter
- Look for `MissionControl-GPT-OAuth` in Task Scheduler Library
- Right-click → Run to test it manually

### Tunnel URL changes on restart

The Cloudflare quick tunnel generates a new random URL each time. You'll need to:

1. Find the new URL (look in Task Scheduler → Task History, or run manually to see it)
2. Update VPS `.env` with the new URL
3. Restart Docker on VPS

**To avoid this**, consider setting up a permanent Cloudflare Tunnel with a fixed domain (requires free Cloudflare account).

### Need to see the tunnel output

Run manually instead of via scheduled task:
```powershell
.\scripts\start-gpt-oauth-cloudflare.ps1
```

## Notes

- The tunnel runs **hidden** - no window appears
- Uses **minimal CPU/memory** when idle
- Only works when your PC is on and logged in
- If you sleep/hibernate the PC, the tunnel stops and auto-restarts on wake
- The Cloudflare URL changes on each restart (see troubleshooting above)

---

**Pro Tip:** For a permanent setup with a fixed URL, consider upgrading to a named Cloudflare Tunnel (free with Cloudflare account).
