# Mission Control VPS - Next Steps

**Current Status:** ✅ Deployment archive created

**Archive:** `C:\Users\deano\Projects\mission-control\mission-control-deploy.tar.gz` (160 KB)

---

## 🚀 Continue Deployment

PowerShell SSH is hanging, so we'll use an alternative approach.

### **Choose ONE option below:**

---

## Option A: WinSCP Upload (Easiest - Recommended)

### 1. Download WinSCP
- Visit: https://winscp.net/eng/download.php
- Install (takes 2 minutes)

### 2. Connect to VPS
Open WinSCP and enter:
- **File protocol:** SFTP
- **Host name:** `app.missioncontroldb.online`
- **Port number:** `22`
- **User name:** `dean`
- Leave password empty
- Click "Advanced" → SSH → Authentication
- **Private key file:** Browse to `C:\Users\deano\.ssh\id_ed25519`
- Click "OK" then "Login"

### 3. Upload Archive
- **Left panel (local):** Navigate to `C:\Users\deano\Projects\mission-control`
- **Right panel (VPS):** Navigate to `/tmp`
- Drag `mission-control-deploy.tar.gz` from left to right
- Wait for upload to complete

### 4. Extract on VPS
Open PuTTY or Windows Terminal and SSH to VPS:
```bash
ssh dean@app.missioncontroldb.online
```

Then run:
```bash
# Create directory
mkdir -p ~/apps/mission-control-vps

# Backup existing .env if exists
cd ~/apps/mission-control-vps
[ -f .env ] && cp .env ../mission-control-vps.env.backup

# Extract archive
tar -xzf /tmp/mission-control-deploy.tar.gz

# Clean up
rm /tmp/mission-control-deploy.tar.gz

# Verify extraction
ls -la
```

You should see: `src`, `database`, `scripts`, `public`, `package.json`, etc.

### 5. Continue to Phase 3
Jump to **Phase 3** in `DEPLOYMENT-STEPS.md` (Configure .env)

---

## Option B: Direct SSH from Windows Terminal

If PowerShell isn't working, try Windows Terminal:

### 1. Open Windows Terminal
- Press `Win + X`, select "Terminal"
- Or search for "Windows Terminal" in Start menu

### 2. Try SSH Connection
```bash
ssh dean@app.missioncontroldb.online
```

If this works, you can use SCP:
```bash
scp C:\Users\deano\Projects\mission-control\mission-control-deploy.tar.gz dean@app.missioncontroldb.online:/tmp/
```

Then follow Step 4 from Option A above.

---

## Option C: Use FileZilla (Alternative to WinSCP)

### 1. Download FileZilla
- Visit: https://filezilla-project.org/download.php?type=client
- Install FileZilla Client (free)

### 2. Convert SSH Key (if needed)
FileZilla needs PPK format:
- Download PuTTYgen: https://www.puttygen.com/
- Load your key: `C:\Users\deano\.ssh\id_ed25519`
- Save as "dean-vps.ppk"

### 3. Connect to VPS
- **Protocol:** SFTP
- **Host:** app.missioncontroldb.online
- **Port:** 22
- **User:** dean
- **Logon Type:** Key file
- **Key file:** Browse to your PPK file
- Click "Connect"

### 4. Upload Archive
- **Local site:** Navigate to `C:\Users\deano\Projects\mission-control`
- **Remote site:** Navigate to `/tmp`
- Drag `mission-control-deploy.tar.gz` to upload

Then follow Step 4 from Option A.

---

## Option D: Git Push (If you use GitHub/GitLab)

### 1. Create Git Repo (Local)
```powershell
cd C:\Users\deano\Projects\mission-control
git init
echo "node_modules" > .gitignore
echo ".next" >> .gitignore
echo "data" >> .gitignore
echo ".env" >> .gitignore
git add .
git commit -m "Mission Control VPS v1 complete"
```

### 2. Push to GitHub
```powershell
# Create new repo on GitHub first, then:
git remote add origin https://github.com/YOUR_USERNAME/mission-control-vps.git
git branch -M main
git push -u origin main
```

### 3. Clone on VPS
```bash
ssh dean@app.missioncontroldb.online

# Clone the repo
cd ~/apps
git clone https://github.com/YOUR_USERNAME/mission-control-vps.git

# Verify
cd mission-control-vps
ls -la
```

Then jump to **Phase 3** in `DEPLOYMENT-STEPS.md`.

---

## After Upload - Complete Deployment

Once files are on the VPS, continue with these phases from `DEPLOYMENT-STEPS.md`:

### ✅ Phase 3: Configure .env
```bash
cd ~/apps/mission-control-vps

# Copy example or restore backup
cp .env.example .env

# Edit with nano
nano .env

# Add these variables:
# DATABASE_URL=postgres://dean:PASSWORD@localhost:5432/mission_control
# ANTHROPIC_API_KEY=sk-ant-...
# MOONSHOT_API_KEY=sk-...
# OPENAI_OAUTH_ENDPOINT=http://localhost:3001/chat
# JWT_SECRET=your-secret-here
```

### ✅ Phase 4: Run Database Migrations
```bash
# Copy migrations to Docker
docker cp database/migrations/001_task_executions.sql mission-control-db:/tmp/
docker cp database/migrations/002_journal_memory.sql mission-control-db:/tmp/

# Run migrations
docker exec mission-control-db psql -U dean -d mission_control -f /tmp/001_task_executions.sql
docker exec mission-control-db psql -U dean -d mission_control -f /tmp/002_journal_memory.sql

# Verify tables created
docker exec mission-control-db psql -U dean -d mission_control -c "\dt"
```

Expected tables:
- users
- chat_messages
- tasks
- usage_snapshots
- **task_executions** ← NEW
- **journal_entries** ← NEW
- **memory_notes** ← NEW

### ✅ Phase 5: Rebuild Docker
```bash
cd ~/apps/mission-control-vps

# Stop containers
docker-compose down

# Rebuild app container
docker-compose up -d --build

# Watch logs
docker-compose logs -f app

# Press Ctrl+C when you see "Ready"
```

### ✅ Phase 6: Test the Deployment
Open browser: **https://app.missioncontroldb.online**

Test:
1. ✅ Login works
2. ✅ Home page shows data
3. ✅ Current Tasks loads
4. ✅ Chat works (try Kimi K2.5)
5. ✅ Run a task
6. ✅ Systems health page shows status

### ✅ Phase 7: Set Up Backups
```bash
cd ~/apps/mission-control-vps

# Make scripts executable
chmod +x scripts/backup-database.sh
chmod +x scripts/restore-database.sh

# Create backup directory
sudo mkdir -p /home/dean/backups/mission-control
sudo chown dean:dean /home/dean/backups/mission-control

# Test backup
./scripts/backup-database.sh

# Verify backup created
ls -lh /home/dean/backups/mission-control/

# Set up cron
crontab -e
# Add this line:
# 0 2 * * * /home/dean/apps/mission-control-vps/scripts/backup-database.sh >> /var/log/mc-backup.log 2>&1
```

### ✅ Phase 8: GPT OAuth (Optional)
**On your Windows PC:**
```powershell
cd C:\Users\deano\Projects\mission-control
.\scripts\start-gpt-oauth.ps1
```

This enables GPT-5.4 in the chat! Leave it running in the background.

### ✅ Phase 9: Usage Monitoring (Optional)
**On your Windows PC:**
```powershell
cd C:\Users\deano\Projects\mission-control
.\scripts\setup-usage-update-loop.ps1
```

This sends OpenClaw usage data to the VPS every 10 minutes.

---

## 🎉 You're Done!

Once all phases complete, you'll have:
- ✅ Fully operational Mission Control VPS
- ✅ Task execution with multiple AI models
- ✅ Chat-to-task integration
- ✅ Memory & journal system
- ✅ Automated backups
- ✅ Health monitoring
- ✅ GPT-5.4 via OAuth (optional)
- ✅ Usage tracking (optional)

---

## 🆘 Need Help?

**If WinSCP/FileZilla don't work:**
- Let me know and I'll try another approach
- We can set up a shared drive or use another file transfer method

**If SSH isn't working at all:**
- Check if VPS is running
- Verify DNS: `nslookup app.missioncontroldb.online`
- Try direct IP: `ssh dean@46.250.242.183`

**If migrations fail:**
- Check Docker is running: `docker ps`
- Check database is accessible: `docker exec mission-control-db psql -U dean -d mission_control -c "SELECT 1"`

---

**Pick your upload method and let me know when files are on the VPS! I'll help you continue from there.** 🚀
