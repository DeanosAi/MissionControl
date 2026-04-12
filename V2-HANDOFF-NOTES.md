# Mission Control VPS v2 — Handoff Notes

**Date:** 2026-04-13
**Built by:** Claude Opus 4.6
**Version:** v1 → v2

---

## What Was Built

### Milestone I: Google Workspace Integration ✅
- **OAuth flow**: `/api/google/auth` initiates, `/api/google/callback` handles token storage
- **Google Drive**: upload files, create folders, auto-create `/Mission Control/Tasks/Ideas/Automated/` structure
- **Gmail**: send emails, search inbox, read email content
- **Google Docs**: create docs with content, read content, append text
- **Google Sheets**: create spreadsheets, read/write cell ranges
- **Google Calendar**: get today's events, upcoming events (built, not activated per spec)
- **Upload to Drive button**: `/api/google/upload-code` endpoint for task output uploads
- **Token storage**: `google_auth` table with refresh token persistence and auto-refresh

### Milestone J: Ideas Page with Kimi Research ✅
- **Ideas CRUD**: DB-backed with full lifecycle (submitted → researching → researched → building → built → archived)
- **Research flow**: Click "Research This Idea" → Kimi asks clarifying questions in embedded chat → generates structured research report (market, technical, competition, estimates)
- **Embedded conversation**: per-idea chat thread stored in JSONB, isolated per idea
- **MVP generation**: research endpoint generates comprehensive analysis
- **Build buttons**: "Build with Kimi/Opus/Sonnet" creates a task in Current Tasks with the idea as description
- **Export to Codex**: copyable prompt for manual GPT Codex use
- **Search & filter**: search by title/description, filter by status
- **Archive**: soft-delete with status change

### Milestone K: Automations (Cron Jobs) ✅
- **Cron scheduler**: parses cron expressions, calculates next run times, executes due automations
- **Auto-task creation**: each automation run creates a task in Current Tasks marked "[Auto]"
- **Scheduler tick**: `/api/automations/tick` endpoint (call every minute via VPS cron)
- **Templates**: 3 pre-built templates (Weekly Social Trends, Daily Instagram Views, Morning Schedule)
- **Cron presets**: dropdown with common patterns + custom cron input
- **Schedule preview**: shows next 5 run times before creating
- **Management**: pause/resume/delete automations, run history tracking

### Milestone L: N8N Workflow Integration ✅
- **Connection detection**: auto-detects N8N at localhost:5678
- **Workflow browser**: lists all N8N workflows with execute button
- **Execution**: trigger workflows with input parameters, track results
- **Webhook endpoint**: `/api/webhooks/n8n` — N8N can create tasks in Mission Control
- **Run history**: tracks all workflow executions with status and output
- **Setup guide**: shown when N8N is not detected, with Docker instructions

### Milestone M: Local LLM Support ✅
- **Model registration**: add local models manually (name, endpoint, model ID, context window)
- **LM Studio auto-detection**: pings localhost:1234, lists available models with one-click add
- **Connection testing**: test endpoint with latency display
- **Activate/deactivate**: toggle models without deleting
- **Chat/task integration**: local models use OpenAI-compatible API format
- **Graceful errors**: offline models show clear error messages

### Bonus
- **Google Calendar**: built but not activated (per spec)
- **Sidebar navigation**: added Workflows and Local Models pages to nav

---

## New Files Created

### Service Layers
- `src/lib/google/auth.ts` — OAuth2 flow + token management
- `src/lib/google/drive.ts` — Drive upload, folders, structure
- `src/lib/google/gmail.ts` — Send, search, read emails
- `src/lib/google/docs.ts` — Create, read, append docs
- `src/lib/google/sheets.ts` — Create, read, write sheets
- `src/lib/google/calendar.ts` — Calendar events (not activated)
- `src/lib/ideas.ts` — Ideas CRUD + research + conversation
- `src/lib/automations.ts` — Automation CRUD + cron + scheduler
- `src/lib/n8n/client.ts` — N8N connection + workflow execution
- `src/lib/local-llm/client.ts` — Local model CRUD + completion

### API Routes
- `/api/google/auth` — OAuth initiation
- `/api/google/callback` — OAuth token handling
- `/api/google/upload-code` — Drive upload for code blocks
- `/api/ideas` — Ideas CRUD (GET/POST/PUT/PATCH)
- `/api/ideas/[id]/chat` — Idea embedded chat
- `/api/ideas/[id]/research` — Kimi research generation
- `/api/automations` — Automation CRUD + preview
- `/api/automations/tick` — Scheduler execution endpoint
- `/api/n8n/workflows` — N8N workflow list + execute
- `/api/webhooks/n8n` — Inbound webhook from N8N
- `/api/local-models` — Local model CRUD
- `/api/local-models/test` — Connection testing

### UI Pages
- `src/app/ideas/page.tsx` + `ideas-client.tsx` — Ideas research lab
- `src/app/automations/page.tsx` + `automations-client.tsx` — Scheduled jobs
- `src/app/workflows/page.tsx` + `workflows-client.tsx` — N8N workflows
- `src/app/local-models/page.tsx` + `local-models-client.tsx` — Local model management

### Database
- `database/migrations/003_v2_features.sql` — All 7 new tables

---

## Database Migration Required

Run on VPS Postgres before deploying:
```bash
docker exec -i mission-control-postgres psql -U mission_control -d mission_control < database/migrations/003_v2_features.sql
```

---

## New Environment Variables

Add to VPS `.env`:
```env
# Google Workspace (Milestone I) — set up at console.cloud.google.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://app.missioncontroldb.online/api/google/callback

# N8N (Milestone L) — install N8N first if needed
N8N_API_URL=http://localhost:5678
N8N_API_KEY=
```

Add to `docker-compose.yml` environment section (already done in this build).

---

## Automation Scheduler Setup

Add to VPS crontab to run the automation tick every minute:
```bash
* * * * * curl -s -X POST http://localhost:3000/api/automations/tick > /dev/null 2>&1
```

---

## Deployment Steps

1. Run database migration: `003_v2_features.sql`
2. Add new env vars to `.env` on VPS
3. Install new npm dependency: `npm install googleapis` (for Google integration)
4. Rebuild Docker: `docker-compose up -d --build`
5. Set up automation cron (see above)
6. (Optional) Set up Google OAuth credentials and visit `/api/google/auth` to authorize
7. (Optional) Install N8N and set `N8N_API_URL`
8. (Optional) Start LM Studio for local model auto-detection

---

## Testing Checklist

### Ideas (Milestone J)
- [ ] Submit a new idea via form
- [ ] Click "Research This Idea" → Kimi generates research
- [ ] Chat with Kimi in the embedded conversation
- [ ] Click "Build with Kimi" → task created in Current Tasks
- [ ] Search and filter ideas
- [ ] Archive an idea

### Automations (Milestone K)
- [ ] Create automation with cron schedule
- [ ] Use a template to create automation
- [ ] Verify schedule preview shows next run times
- [ ] Pause and resume automation
- [ ] Trigger tick endpoint manually: `curl -X POST localhost:3000/api/automations/tick`
- [ ] Verify auto-generated task appears in Current Tasks

### Google (Milestone I)
- [ ] Visit `/api/google/auth` → authorize Google account
- [ ] Verify redirect back to Systems page
- [ ] Upload code to Drive (if code block UI button added)
- [ ] Send email via API (test with curl or chat command)

### N8N (Milestone L)
- [ ] Workflows page shows setup guide (if N8N not running)
- [ ] Start N8N, refresh page → workflows listed
- [ ] Trigger a workflow → execution tracked
- [ ] Send webhook from N8N → task created

### Local Models (Milestone M)
- [ ] Add a local model manually
- [ ] Test connection → shows latency
- [ ] Activate/deactivate model
- [ ] Start LM Studio → auto-detection shows models
- [ ] One-click add from LM Studio

### Existing Features (Regression)
- [ ] Current Tasks CRUD and drag-drop
- [ ] Run Task button works
- [ ] Chat commands: list tasks, create task, run task, move task
- [ ] Memory commands: remember, show memory, forget
- [ ] Journal entries and auto-journaling
- [ ] Login/auth works
- [ ] Usage page loads
- [ ] Systems health dashboard loads

---

## Notes

- Google integration requires `googleapis` npm package (add to package.json)
- Google Calendar is built but not activated per spec — ready to wire into morning email automation when Dean enables it
- N8N integration is fully functional but requires N8N to be installed separately
- Local LLM models use the OpenAI-compatible API format (works with LM Studio, Ollama, etc.)
- The automation scheduler needs the VPS cron job to work — it doesn't self-schedule within Next.js
