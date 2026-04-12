# Push to GitHub - Instructions

✅ **Git commit created successfully!**
- Commit: `dcc90f8`
- Message: "Mission Control VPS v1 - Complete (All Milestones A-H + GPT OAuth)"
- Files: 139 files, 17,915 lines

---

## Next Steps

### Option 1: If You Already Have a GitHub Repo

If you already have a repo for mission-control:

```powershell
cd C:\Users\deano\Projects\mission-control

# Add remote (replace YOUR_USERNAME and YOUR_REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push to main branch
git branch -M main
git push -u origin main
```

### Option 2: Create a New GitHub Repo

1. **Go to GitHub:** https://github.com/new

2. **Create repo with these settings:**
   - **Repository name:** `mission-control-vps`
   - **Description:** Mission Control VPS - Personal AI builder operating system
   - **Visibility:** Private (recommended - contains your project structure)
   - **DO NOT initialize** with README, .gitignore, or license (we already have these)

3. **After creating, GitHub will show you commands. Use these:**

```powershell
cd C:\Users\deano\Projects\mission-control

# Add the remote (GitHub will give you the exact URL)
git remote add origin https://github.com/YOUR_USERNAME/mission-control-vps.git

# Rename branch to main
git branch -M main

# Push
git push -u origin main
```

---

## After Pushing to GitHub

### Pull on VPS

Once pushed to GitHub, SSH to your VPS and pull the changes:

```bash
# SSH to VPS
ssh dean@app.missioncontroldb.online

# Navigate to app directory
cd ~/apps/mission-control-vps

# If this is the first time, clone the repo:
git clone https://github.com/YOUR_USERNAME/mission-control-vps.git .

# Or if directory exists with old files, pull the update:
git fetch origin
git reset --hard origin/main

# Verify files updated
ls -la src/ database/ scripts/

# Check what changed
git log --oneline -5
```

You should see the commit: `dcc90f8 Mission Control VPS v1 - Complete (All Milestones A-H + GPT OAuth)`

---

## Continue Deployment After Git Pull

Once files are on the VPS via git pull, continue with:

### Phase 3: Configure .env

```bash
cd ~/apps/mission-control-vps

# Backup existing .env if it exists
[ -f .env ] && cp .env .env.backup

# Edit .env (or create from .env.example)
nano .env

# Required variables:
# DATABASE_URL=postgres://dean:PASSWORD@localhost:5432/mission_control
# ANTHROPIC_API_KEY=sk-ant-...
# MOONSHOT_API_KEY=sk-...
# OPENAI_OAUTH_ENDPOINT=http://localhost:3001/chat
# JWT_SECRET=your-secret-here
```

### Phase 4: Run Migrations

```bash
# Copy migration files into Docker
docker cp database/migrations/001_task_executions.sql mission-control-db:/tmp/
docker cp database/migrations/002_journal_memory.sql mission-control-db:/tmp/

# Run migrations
docker exec mission-control-db psql -U dean -d mission_control -f /tmp/001_task_executions.sql
docker exec mission-control-db psql -U dean -d mission_control -f /tmp/002_journal_memory.sql

# Verify tables
docker exec mission-control-db psql -U dean -d mission_control -c "\dt"
```

Expected output should include:
- task_executions
- journal_entries  
- memory_notes

### Phase 5: Rebuild Docker

```bash
cd ~/apps/mission-control-vps

# Stop and rebuild
docker-compose down
docker-compose up -d --build

# Watch logs
docker-compose logs -f app

# Should see "Ready" after build completes
```

### Phase 6: Test

Open: **https://app.missioncontroldb.online**

Test:
- ✅ Login
- ✅ Home page
- ✅ Current Tasks (Run Task button)
- ✅ Chat (try Kimi K2.5)
- ✅ Systems health dashboard

---

## Summary

1. ✅ **Local:** Commit created with all v1 files
2. 📤 **Next:** Push to GitHub (Option 1 or 2 above)
3. 📥 **Then:** Pull on VPS (`git pull` or `git clone`)
4. ⚙️ **Then:** Follow Phases 3-6 above
5. 🎉 **Done:** Mission Control VPS operational!

---

**Let me know once you've pushed to GitHub, and I'll help with the VPS deployment!**
