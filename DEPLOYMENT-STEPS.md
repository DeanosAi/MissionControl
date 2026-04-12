# Mission Control VPS - Step-by-Step Deployment

**Follow these steps in order to get Mission Control VPS operational.**

---

## ✅ Phase 1: Local Preparation (DONE)

- ✅ Dependencies installed (`npm install` completed)
- ✅ All files updated from Claude Opus 4.6 build

---

## 📤 Phase 2: Upload to VPS

### Step 1: Connect to Your VPS
```powershell
ssh dean@app.missioncontroldb.online
```

### Step 2: Check Current Mission Control Directory
```bash
cd ~/apps/mission-control-vps
ls -la
```

**What to look for:** Existing app files, `.env` file

### Step 3: Backup Current Installation (if exists)
```bash
# Backup the current directory
cd ~/apps
cp -r mission-control-vps mission-control-vps.backup.$(date +%Y%m%d)

# Or just backup the .env file
cp mission-control-vps/.env mission-control-vps.env.backup
```

### Step 4: Upload New Files from Windows PC

**Option A: Using rsync (recommended)**
```powershell
# From Windows PC (PowerShell)
cd C:\Users\deano\Projects\mission-control

# Upload all files except node_modules, .git, .next
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude '.next' --exclude 'data' ./ dean@app.missioncontroldb.online:~/apps/mission-control-vps/
```

**Option B: Using WinSCP or FileZilla**
- Connect to `app.missioncontroldb.online`
- User: `dean`
- Navigate to `/home/dean/apps/mission-control-vps`
- Upload all files from `C:\Users\deano\Projects\mission-control`
- **Exclude:** `node_modules`, `.git`, `.next`, `data`

**Option C: Using Git (if you set up a repo)**
```bash
# On VPS
cd ~/apps/mission-control-vps
git pull origin main
```

---

## 🔧 Phase 3: VPS Configuration

### Step 5: Restore/Configure Environment Variables

**Back on the VPS:**
```bash
cd ~/apps/mission-control-vps

# If you backed up .env, restore it:
cp ../mission-control-vps.env.backup .env

# OR create new .env from example:
cp .env.example .env
nano .env
```

**Required variables in `.env`:**
```env
# Database (update password if different)
DATABASE_URL=postgres://dean:your_db_password@localhost:5432/mission_control

# API Keys (keep your existing keys)
ANTHROPIC_API_KEY=sk-ant-...
MOONSHOT_API_KEY=sk-...

# GPT OAuth (NEW - add this line)
OPENAI_OAUTH_ENDPOINT=http://localhost:3001/chat

# Auth (keep your existing secret or generate new)
JWT_SECRET=your-existing-secret-here

# Backup path (optional, defaults shown)
BACKUP_STATUS_PATH=/home/dean/backups/mission-control/backup-status.json
```

**Save and exit** (Ctrl+X, then Y, then Enter in nano)

### Step 6: Create Backup Directory
```bash
# Create backup directory structure
sudo mkdir -p /home/dean/backups/mission-control
sudo chown dean:dean /home/dean/backups/mission-control
chmod 755 /home/dean/backups/mission-control
```

---

## 🗄️ Phase 4: Database Migrations

### Step 7: Run Database Migrations

**First, check if migrations already exist:**
```bash
cd ~/apps/mission-control-vps

# Copy migration files into Docker init directory if needed
docker cp database/migrations/001_task_executions.sql mission-control-db:/tmp/
docker cp database/migrations/002_journal_memory.sql mission-control-db:/tmp/
```

**Run the migrations:**
```bash
# Migration 1: Task Executions
docker exec mission-control-db psql -U dean -d mission_control -f /tmp/001_task_executions.sql

# Migration 2: Journal & Memory
docker exec mission-control-db psql -U dean -d mission_control -f /tmp/002_journal_memory.sql
```

**Verify migrations ran successfully:**
```bash
docker exec mission-control-db psql -U dean -d mission_control -c "\dt"
```

**Expected tables:**
- `users`
- `chat_messages`
- `tasks`
- `usage_snapshots`
- `task_executions` ← NEW
- `journal_entries` ← NEW
- `memory_notes` ← NEW

---

## 🐳 Phase 5: Rebuild and Restart Docker

### Step 8: Rebuild the App Container
```bash
cd ~/apps/mission-control-vps

# Stop current containers
docker-compose down

# Rebuild with new code
docker-compose up -d --build
```

**This will:**
- Stop the old app container
- Build new container with updated code
- Start both database and app containers
- May take 2-3 minutes

### Step 9: Verify Containers Are Running
```bash
docker-compose ps
```

**Expected output:**
```
NAME                  STATUS              PORTS
mission-control-app   Up X seconds        0.0.0.0:3000->3000/tcp
mission-control-db    Up X seconds        5432/tcp
```

### Step 10: Check App Logs
```bash
# Watch logs for errors
docker-compose logs -f app

# Press Ctrl+C to exit when you see "Ready in X ms"
```

**Look for:**
- ✅ "Ready in X ms"
- ✅ "Local: http://localhost:3000"
- ❌ Any error messages (if you see errors, let me know)

---

## 🌐 Phase 6: Test the Deployment

### Step 11: Test the Website

**Open in browser:** https://app.missioncontroldb.online

**Test these pages:**
1. ✅ **Home** — Should show live task count and journal count
2. ✅ **Login** — Should work with your credentials
3. ✅ **Current Tasks** — Should show task board with Run Task buttons
4. ✅ **Chat** — Should show model dropdown (GPT will be offline for now)
5. ✅ **Memory/Journal** — Should load (might be empty initially)
6. ✅ **Systems** — Should show health dashboard with 4 cards:
   - Database (should be green)
   - Backups (might be red until first backup runs)
   - Application (should be green)
   - GPT OAuth (will be red until you set up tunnel)

### Step 12: Test Task Execution

**In Current Tasks:**
1. Create a test task (e.g., "Test task execution")
2. Assign it to "Kimi K2.5" (most reliable for testing)
3. Click "Run Task"
4. Wait for execution to complete
5. Should see output displayed inline

**If this works:** ✅ Task execution engine is working!

### Step 13: Test Chat Commands

**In Chat:**
1. Select "Kimi K2.5" as the model
2. Try: `list tasks`
3. Should show list of tasks without making an API call
4. Try: `create task: Test from chat`
5. Go to Current Tasks — should see the new task

**If this works:** ✅ Chat-to-task integration is working!

---

## 💾 Phase 7: Set Up Automated Backups

### Step 14: Make Backup Script Executable
```bash
cd ~/apps/mission-control-vps
chmod +x scripts/backup-database.sh
chmod +x scripts/restore-database.sh
```

### Step 15: Test Manual Backup
```bash
# Run backup manually to test
./scripts/backup-database.sh

# Check if backup was created
ls -lh /home/dean/backups/mission-control/

# Should see:
# - backup-status.json
# - mission-control-YYYYMMDD-HHMMSS.sql.gz
```

### Step 16: Set Up Nightly Cron Job
```bash
# Open crontab editor
crontab -e

# Add this line (runs at 2:00 AM daily):
0 2 * * * /home/dean/apps/mission-control-vps/scripts/backup-database.sh >> /var/log/mc-backup.log 2>&1

# Save and exit (Ctrl+X, Y, Enter if using nano)
```

### Step 17: Verify Backup Status in UI

**Refresh:** https://app.missioncontroldb.online/systems

**Systems page should now show:**
- ✅ Database: Connected (green)
- ✅ Backups: Last backup time, file count, total size (green)
- ✅ Application: Uptime (green)
- ⚠️ GPT OAuth: Offline (amber - expected until next phase)

---

## 🤖 Phase 8: Set Up GPT OAuth (Optional but Recommended)

### Step 18: Start GPT OAuth on Windows PC

**From PowerShell on Windows:**
```powershell
cd C:\Users\deano\Projects\mission-control

# This starts both the OAuth proxy AND the SSH tunnel
.\scripts\start-gpt-oauth.ps1
```

**What this does:**
1. Starts `chat-oauth-proxy.js` on port 3001
2. Opens SSH reverse tunnel to VPS
3. Makes GPT-5.4 available at `localhost:3001` on the VPS
4. Auto-reconnects if tunnel drops

**Leave this running in the background!**

### Step 19: Verify GPT OAuth in UI

**Refresh:** https://app.missioncontroldb.online/chat

**You should see:**
- ✅ Green "GPT Online" badge next to the chat form
- ✅ GPT-5.4 appears first in model dropdown

**Test it:**
1. Select "GPT-5.4"
2. Ask: "What's 2+2?"
3. Should get response from GPT (uses your ChatGPT subscription, zero API cost!)

**On Systems page:**
- ✅ GPT OAuth: Online (green) with endpoint info

---

## 🎯 Phase 9: Set Up Usage Monitoring (Optional)

### Step 20: Set Up Usage Update Loop on Windows

**This monitors your OpenClaw usage and sends it to the VPS every 10 minutes.**

**From PowerShell on Windows:**
```powershell
cd C:\Users\deano\Projects\mission-control

# One-time setup: create scheduled task
.\scripts\setup-usage-update-loop.ps1

# Or run manually in background:
.\scripts\usage-update-loop.ps1
```

### Step 21: Verify Usage Data

**After 10-15 minutes:**

Visit: https://app.missioncontroldb.online/usage

**Should show:**
- Session counts (Kimi, Claude, GPT, etc.)
- Cost estimates
- Staleness indicator (Fresh = green, Aging = amber, Stale = red)
- Last updated timestamp

---

## ✅ Phase 10: Final Verification

### Step 22: Complete Feature Test

**Test each feature:**

| Feature | Test | Expected Result |
|---------|------|----------------|
| **Home** | Visit / | Shows live task & journal count |
| **Current Tasks** | Create, edit, drag, run task | All work smoothly |
| **Chat** | Test all 4 models | All respond correctly |
| **Chat Commands** | `list tasks`, `create task`, `run task` | Execute without API calls |
| **Memory Commands** | `remember test=value`, `show memory` | Store and retrieve |
| **Journal** | Auto-creates on task execution | New entries appear |
| **Systems Health** | Visit /systems | All 4 cards show green |
| **Backups** | Check backup status | Shows last backup |
| **Usage** | Visit /usage | Shows current stats |

### Step 23: Check Logs for Errors
```bash
# On VPS
docker-compose logs app --tail=100

# Look for any errors or warnings
```

---

## 🎉 You're Done!

**Mission Control VPS v1 is now fully operational at:**
https://app.missioncontroldb.online

### What You Have Running:

**On the VPS:**
- ✅ Mission Control app with all features
- ✅ Postgres database with all tables
- ✅ Nightly automated backups
- ✅ Health monitoring
- ✅ Task execution engine
- ✅ Chat with multiple AI models
- ✅ Memory & journal system

**On Your Windows PC (optional):**
- ✅ GPT OAuth proxy (for GPT-5.4 access)
- ✅ SSH tunnel (connects VPS to GPT proxy)
- ✅ Usage monitoring loop (sends usage data to VPS)

---

## 🆘 Troubleshooting

### If Docker build fails:
```bash
# Check logs
docker-compose logs app

# Rebuild from scratch
docker-compose down -v
docker-compose up -d --build
```

### If migrations fail:
```bash
# Check if tables exist
docker exec mission-control-db psql -U dean -d mission_control -c "\dt"

# Try running migrations again
docker exec mission-control-db psql -U dean -d mission_control -f /tmp/001_task_executions.sql
```

### If GPT OAuth doesn't work:
```bash
# On Windows, check if tunnel is running:
ssh dean@app.missioncontroldb.online "curl -s http://localhost:3001/health"

# Should return: {"status":"ok"}
```

### If backups don't work:
```bash
# Check permissions
ls -la /home/dean/backups/mission-control

# Run backup manually to see errors
./scripts/backup-database.sh
```

---

## 📞 Next Steps After Deployment

1. **Add some tasks** in Current Tasks
2. **Try the chat** with different models
3. **Create memory notes** for things to remember
4. **Check Systems page** regularly to monitor health
5. **Start building!** 🚀

---

**Need help?** Let me know which step you're on and I'll guide you through it!
