# Permanent Cloudflare Tunnel Setup

**Problem:** Quick tunnels generate a new random URL every restart.

**Solution:** Named tunnels have a FIXED URL that never changes! ✅

---

## Setup (One-Time, 5 Minutes)

### Step 1: Login to Cloudflare

```powershell
cloudflared tunnel login
```

This opens your browser. Click "Authorize" to link cloudflared to your Cloudflare account (free account is fine).

### Step 2: Create Permanent Tunnel

```powershell
cd C:\Users\deano\Projects\mission-control
.\scripts\setup-permanent-cloudflare-tunnel.ps1
```

This will:
- Create a named tunnel called `mission-control-gpt`
- Generate a permanent URL like `https://abc123.cfargotunnel.com`
- Save the URL to `scripts/cloudflare-tunnel-info.txt`

**Copy the URL shown** - you'll need it for the next step!

### Step 3: Update VPS

**SSH to your VPS:**
```bash
ssh deanadmin@app.missioncontroldb.online
cd ~/apps/mission-control-vps
nano .env
```

**Update this line** (use the URL from Step 2):
```env
OPENAI_OAUTH_ENDPOINT=https://YOUR-TUNNEL-ID.cfargotunnel.com/chat
```

**Save and restart:**
```bash
sudo docker compose restart
```

### Step 4: Test the Permanent Tunnel

**On Windows:**
```powershell
.\scripts\start-permanent-tunnel.ps1
```

**Check if it works:**
- Visit https://app.missioncontroldb.online/chat
- Should see green "GPT Online" badge
- GPT-5.4 should work!

**Stop it** (Ctrl+C) if testing is successful.

### Step 5: Set Up Auto-Start

```powershell
.\scripts\setup-autostart-permanent-tunnel.ps1
```

This updates the scheduled task to use the permanent tunnel instead of quick tunnel.

**Restart your PC** to test auto-start!

---

## Benefits

✅ **Fixed URL** - Never changes, even after restarts  
✅ **No manual updates** - Set it once, works forever  
✅ **More reliable** - Named tunnels have better uptime  
✅ **Still free** - Cloudflare Tunnel is free for personal use  
✅ **Auto-starts** - Runs automatically when you log in  

---

## Verification

After setup and reboot:

```powershell
# Check if tunnel is running
Get-Process -Name cloudflared

# Check OAuth proxy
Invoke-RestMethod http://localhost:3001/health

# Check VPS can reach it
# (on VPS)
curl http://localhost:3000/api/gpt-status
```

Should all return success!

---

## Management

### Start Manually

```powershell
.\scripts\start-permanent-tunnel.ps1
```

### Stop

```powershell
Get-Process -Name cloudflared | Stop-Process
Get-Process -Name powershell | Where-Object {$_.MainWindowTitle -eq ""} | Stop-Process
```

### Disable Auto-Start

```powershell
.\scripts\disable-autostart-gpt-oauth.ps1
```

### View Tunnel Info

```powershell
cloudflared tunnel info mission-control-gpt
cloudflared tunnel list
```

### Delete Tunnel (Start Over)

```powershell
cloudflared tunnel delete mission-control-gpt
```

Then run setup again.

---

## Troubleshooting

### "tunnel already exists" error

That's OK! The script will use the existing tunnel. Just continue.

### Can't find tunnel URL

Check:
```powershell
cat scripts\cloudflare-tunnel-info.txt
```

Or:
```powershell
cloudflared tunnel info mission-control-gpt
```

### Tunnel won't start

Check cloudflared is authenticated:
```powershell
dir $env:USERPROFILE\.cloudflared\cert.pem
```

If missing, run `cloudflared tunnel login` again.

### GPT still shows offline

1. Check tunnel is running: `Get-Process -Name cloudflared`
2. Check VPS .env has correct URL
3. Restart Docker: `sudo docker compose restart`
4. Check VPS can reach tunnel:
   ```bash
   curl https://YOUR-TUNNEL-ID.cfargotunnel.com/health
   ```

---

## Files Created

- `~\.cloudflared\config.yml` - Tunnel configuration
- `~\.cloudflared\TUNNEL-ID.json` - Tunnel credentials
- `scripts\cloudflare-tunnel-info.txt` - Your tunnel details

**Keep these files safe!** They're needed for the tunnel to work.

---

## Migrating from Quick Tunnel

If you already set up auto-start with the quick tunnel:

1. Run `.\scripts\setup-permanent-cloudflare-tunnel.ps1` (creates named tunnel)
2. Update VPS `.env` with the permanent URL
3. Run `.\scripts\setup-autostart-permanent-tunnel.ps1` (updates scheduled task)
4. Restart PC to test

The quick tunnel scripts are still there if you need them!

---

**This is the recommended setup for Mission Control!** 🎯
