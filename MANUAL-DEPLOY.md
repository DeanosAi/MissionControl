# Manual Deployment Guide

SSH connections from PowerShell are hanging. Here's how to deploy manually:

---

## Option 1: Using WinSCP (Recommended - Easiest)

### Step 1: Download WinSCP
- Download from: https://winscp.net/eng/download.php
- Or use FileZilla if you prefer

### Step 2: Connect to VPS
- **Protocol:** SFTP
- **Host:** app.missioncontroldb.online
- **Port:** 22
- **Username:** dean
- **Password:** (leave empty - will use SSH key)
- **Private key:** Browse to `C:\Users\deano\.ssh\id_ed25519` or similar

### Step 3: Navigate on VPS
- Navigate to: `/home/dean/apps/mission-control-vps`
- Create directory if it doesn't exist

### Step 4: Backup .env (if exists)
- If you see `.env` file, download it as backup
- Save as `.env.backup` locally

### Step 5: Upload Files
- Select all files in `C:\Users\deano\Projects\mission-control`
- **EXCLUDE these folders:**
  - `node_modules`
  - `.git`
  - `.next`
  - `data`
- Drag and drop to VPS directory
- Let upload complete (may take 5-10 minutes)

### Step 6: Restore .env
- Upload your `.env.backup` back as `.env`
- Or edit `.env.example` on the VPS and save as `.env`

---

## Option 2: Using Git (If you have a repo)

### Step 1: Initialize Git Repo (if not done)
```powershell
cd C:\Users\deano\Projects\mission-control
git init
git add .
git commit -m "Mission Control VPS v1 complete"
```

### Step 2: Push to GitHub/GitLab
```powershell
# Create repo on GitHub first, then:
git remote add origin https://github.com/yourusername/mission-control-vps.git
git push -u origin main
```

### Step 3: Clone on VPS
```bash
# SSH into VPS manually using PuTTY or Windows Terminal
ssh dean@app.missioncontroldb.online

# Clone the repo
cd ~/apps
git clone https://github.com/yourusername/mission-control-vps.git
```

---

## Option 3: Create Archive and Upload

### Step 1: Create Deployment Archive (Local Windows)
```powershell
cd C:\Users\deano\Projects\mission-control

# Create tar archive
tar -czf mission-control-deploy.tar.gz `
    --exclude=node_modules `
    --exclude=.git `
    --exclude=.next `
    --exclude=data `
    --exclude=*.log `
    *
```

### Step 2: Upload Archive
- Use WinSCP to upload `mission-control-deploy.tar.gz` to `/tmp/` on VPS

### Step 3: Extract on VPS
```bash
# SSH into VPS
ssh dean@app.missioncontroldb.online

# Create directory
mkdir -p ~/apps/mission-control-vps

# Backup existing .env if it exists
cd ~/apps/mission-control-vps
[ -f .env ] && cp .env .env.backup

# Extract archive
cd ~/apps/mission-control-vps
tar -xzf /tmp/mission-control-deploy.tar.gz

# Restore .env
[ -f .env.backup ] && cp .env.backup .env

# Clean up
rm /tmp/mission-control-deploy.tar.gz
```

---

## After Upload (All Options)

Once files are on the VPS, continue with **Phase 3** in `DEPLOYMENT-STEPS.md`:

1. Configure `.env` file
2. Run database migrations
3. Rebuild Docker containers
4. Test the deployment

---

## Troubleshooting SSH

If you can't SSH from PowerShell:

### Try Windows Terminal Instead
```bash
# Open Windows Terminal
# New Tab > Command Prompt or PowerShell
ssh dean@app.missioncontroldb.online
```

### Try PuTTY
- Download PuTTY: https://www.putty.org/
- Host: `app.missioncontroldb.online`
- Port: `22`
- Connection > SSH > Auth: Browse to your private key
- Click "Open"

### Check SSH Config
```powershell
# View SSH config
cat ~\.ssh\config

# Should have entry for your VPS:
# Host app.missioncontroldb.online
#   User dean
#   IdentityFile ~/.ssh/id_ed25519
```

---

**Choose whichever option works best for you, then continue with Phase 3!**
