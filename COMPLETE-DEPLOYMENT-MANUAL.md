# Mission Control VPS v1 - Complete Deployment (Manual Steps)

**Status:** ✅ Code pushed to GitHub successfully!

Since automated SSH from PowerShell is hanging, follow these manual steps to complete deployment.

---

## Step 1: Connect to VPS

Use **PuTTY**, **Windows Terminal**, or **Command Prompt** (not PowerShell):

```bash
ssh dean@app.missioncontroldb.online
```

If SSH asks for password and you have key authentication, make sure your key is loaded.

---

## Step 2: Pull Latest Code from GitHub

```bash
cd ~/apps/mission-control-vps

# Pull the v1 update
git fetch origin
git reset --hard origin/main

# Verify files updated
ls -la src/ database/ scripts/

# Check the commit
git log --oneline -1
```

You should see: `dcc90f8 Mission Control VPS v1 - Complete (All Milestones A-H + GPT OAuth)`

---

## Step 3: Check/Update .env File

```bash
cd ~/apps/mission-control-vps

# Check if .env exists
ls -la .env

# Edit .env
nano .env
```

**Required variables:**
```env
# Database
DATABASE_URL=postgres://dean:YOUR_DB_PASSWORD@localhost:5432/mission_control

# AI APIs
ANTHROPIC_API_KEY=sk-ant-...
MOONSHOT_API_KEY=sk-...

# GPT OAuth (NEW - add this line)
OPENAI_OAUTH_ENDPOINT=http://localhost:3001/chat

# Auth
JWT_SECRET=your-existing-secret-or-new-random-string

# Backup path (optional)
BACKUP_STATUS_PATH=/home/dean/backups/mission-control/backup-status.json
```

**Save:** Press `Ctrl+X`, then `Y`, then `Enter`

---

## Step 4: Run Database Migrations

```bash
cd ~/apps/mission-control-vps

# Copy migration files to Docker container
docker cp database/migrations/001_task_executions.sql mission-control-db:/tmp/
docker cp database/migrations/002_journal_memory.sql mission-control-db:/tmp/

# Run migration 1: Task Executions
docker exec mission-control-db psql -U dean -d mission_control -f /tmp/001_task_executions.sql

# Run migration 2: Journal & Memory
docker exec mission-control-db psql -U dean -d mission_control -f /tmp/002_journal_memory.sql

# Verify tables were created
docker exec mission-control-db psql -U dean -d mission_control -c "\dt"
```

**Expected tables (should see these):**
- `users`
- `chat_messages`
- `tasks`
- `usage_snapshots`
- **`task_executions`** ← NEW
- **`journal_entries`** ← NEW
- **`memory_notes`** ← NEW

---

## Step 5: Rebuild Docker Containers

```bash
cd ~/apps/mission-control-vps

# Stop containers
docker-compose down

# Rebuild and start
docker-compose up -d --build

# This will take 2-3 minutes
# Watch the build progress
docker-compose logs -f app

# Press Ctrl+C when you see "Ready in X ms"
```

**Look for:**
- ✅ `Ready in X ms`
- ✅ `Local: http://localhost:3000`
- ❌ Any errors (let me know if you see errors)

---

## Step 6: Verify Deployment

### Test in Browser

Open: **https://app.missioncontroldb.online**

**Test these pages:**

1. ✅ **Home** — Should load, show live task count, journal count
2. ✅ **Login** — Should work with your credentials
3. ✅ **Current Tasks** — Should show task board with "Run Task" buttons
4. ✅ **Chat** — Should show model dropdown (GPT will be offline until you start OAuth)
5. ✅ **Memory/Journal** — Should load (might be empty)
6. ✅ **Systems** — Health dashboard with 4 cards:
   - Database (should be green)
   - Backups (might be red - will fix in Step 7)
   - Application (should be green)
   - GPT OAuth (will be red until Step 8)
7. ✅ **Usage** — Should show usage stats (might be stale)

### Test Task Execution

1. Go to **Current Tasks**
2. Create a test task (e.g., "Test v1 deployment")
3. Assign to **Kimi K2.5**
4. Click **Run Task**
5. Wait for output to appear
6. Should see: execution status, model used, output text

**If this works:** ✅ Task execution engine is operational!

### Test Chat Commands

1. Go to **Chat**
2. Select **Kimi K2.5**
3. Type: `list tasks`
4. Should show list of tasks instantly (no API call)
5. Type: `create task: Test from chat`
6. Go to Current Tasks — should see the new task
7. Type: `remember test=success`
8. Type: `show memory`
9. Should see the test memory note

**If these work:** ✅ Chat-to-task and memory integration working!

---

## Step 7: Set Up Automated Backups

```bash
cd ~/apps/mission-control-vps

# Make scripts executable
chmod +x scripts/backup-database.sh
chmod +x scripts/restore-database.sh

# Create backup directory
sudo mkdir -p /home/dean/backups/mission-control
sudo chown dean:dean /home/dean/backups/mission-control

# Test manual backup
./scripts/backup-database.sh

# Verify backup created
ls -lh /home/dean/backups/mission-control/
```

You should see:
- `backup-status.json`
- `mission-control-YYYYMMDD-HHMMSS.sql.gz`

### Set Up Cron Job

```bash
# Edit crontab
crontab -e

# Add this line (runs at 2:00 AM daily):
0 2 * * * /home/dean/apps/mission-control-vps/scripts/backup-database.sh >> /var/log/mc-backup.log 2>&1

# Save and exit (in nano: Ctrl+X, Y, Enter)

# Verify cron job added
crontab -l
```

### Verify in UI

Refresh: **https://app.missioncontroldb.online/systems**

Backups card should now show:
- ✅ Last backup time
- ✅ File count
- ✅ Total size

---

## Step 8: Set Up GPT OAuth (Optional)

**This runs on your Windows PC, not the VPS!**

### On Windows PC:

```powershell
cd C:\Users\deano\Projects\mission-control

# Start GPT OAuth proxy + SSH tunnel
.\scripts\start-gpt-oauth.ps1

# Leave this running in the background!
```

**What this does:**
1. Starts OAuth proxy on port 3001
2. Opens SSH reverse tunnel to VPS
3. Makes GPT-5.4 available via your ChatGPT subscription
4. Auto-reconnects if tunnel drops

### Verify GPT is Online

Refresh: **https://app.missioncontroldb.online/chat**

You should see:
- ✅ Green "GPT Online" badge
- ✅ GPT-5.4 in model dropdown

**Test it:**
1. Select **GPT-5.4**
2. Ask: "What is 2+2?"
3. Should get response from GPT (using your ChatGPT sub, zero API cost)

**On Systems page:**
- ✅ GPT OAuth card should show "Online" (green)

---

## Step 9: Set Up Usage Monitoring (Optional)

**Also runs on Windows PC:**

```powershell
cd C:\Users\deano\Projects\mission-control

# Set up scheduled task (one-time)
.\scripts\setup-usage-update-loop.ps1

# Or run manually
.\scripts\usage-update-loop.ps1
```

This sends OpenClaw usage data to VPS every 10 minutes.

**Verify:** Visit https://app.missioncontroldb.online/usage after 10-15 minutes

---

## 🎉 Deployment Complete!

### What You Have Now:

**On VPS:**
- ✅ Mission Control app with all v1 features
- ✅ Task execution engine (multi-model support)
- ✅ Chat-to-task integration
- ✅ Memory & journal system
- ✅ Automated nightly backups
- ✅ Health monitoring dashboard
- ✅ Database with all tables

**On Windows PC (optional):**
- ✅ GPT OAuth proxy (for GPT-5.4)
- ✅ SSH tunnel (connects to VPS)
- ✅ Usage monitoring loop

---

## 🆘 Troubleshooting

### If Docker build fails:
```bash
# Check logs
docker-compose logs app --tail=100

# Rebuild from scratch
docker-compose down
docker-compose up -d --build --no-cache
```

### If migrations fail:
```bash
# Check if tables already exist
docker exec mission-control-db psql -U dean -d mission_control -c "\dt"

# If missing tables, try running migrations again
docker exec mission-control-db psql -U dean -d mission_control -f /tmp/001_task_executions.sql
```

### If app won't start:
```bash
# Check .env file has all required variables
cat .env

# Check Docker logs
docker-compose logs app --tail=50

# Check if DB is running
docker ps
```

### If GPT OAuth doesn't work:
```bash
# On VPS, check if tunnel is reachable
curl -s http://localhost:3001/health

# Should return: {"status":"ok"}

# If not, restart on Windows:
.\scripts\start-gpt-oauth.ps1
```

---

## ✅ Final Verification Checklist

Test each feature:

| Feature | Test | Status |
|---------|------|--------|
| Home | Shows live counts | ⬜ |
| Login | Works with credentials | ⬜ |
| Current Tasks | Create, edit, drag, delete | ⬜ |
| Run Task | Executes and shows output | ⬜ |
| Chat | All models respond | ⬜ |
| Chat Commands | `list tasks`, `create task` | ⬜ |
| Memory | `remember`, `show memory` | ⬜ |
| Journal | Auto-creates on task run | ⬜ |
| Systems | All 4 cards green/working | ⬜ |
| Backups | Shows last backup | ⬜ |
| Usage | Shows current stats | ⬜ |
| GPT OAuth | Green badge, GPT-5.4 works | ⬜ (optional) |

---

## 📞 After Deployment

**You're done!** Mission Control VPS v1 is fully operational.

**Start using it:**
- Create tasks and run them
- Chat with different AI models
- Build your projects
- Let the system learn your preferences

---

**Need help with any step? Let me know where you are and I'll guide you through it!** 🚀
