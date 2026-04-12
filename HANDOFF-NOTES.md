# Mission Control VPS v2 — Handoff Notes

## Build Summary
**Built by:** Claude Opus 4.6
**Date:** 2026-04-13
**Version:** v1 → v2

All v1 milestones (A-H) preserved. Five new milestones (I-M) built plus GPT OAuth integration.

## Milestone Status

| Milestone | Feature | Status |
|---|---|---|
| A-H | v1 Core (tasks, chat, memory, health, backups) | ✅ Complete |
| GPT | OAuth tunnel integration with fallback | ✅ Complete |
| **I** | **Google Workspace Integration** | **✅ Built** |
| **J** | **Ideas Page with Kimi Research** | **✅ Built** |
| **K** | **Automations (Cron Jobs)** | **✅ Built** |
| **L** | **N8N Workflow Integration** | **✅ Built** |
| **M** | **Local LLM Support** | **✅ Built** |
| Bonus | Google Calendar (built, not activated) | ✅ Built |

---

## What Was Built

### Milestone I: Google Workspace Integration
**Service layers:** `src/lib/google/auth.ts`, `drive.ts`, `gmail.ts`, `docs.ts`, `sheets.ts`, `calendar.ts`

- **OAuth flow** — `/api/google/auth` initiates, `/api/google/callback` handles token exchange. Refresh tokens stored in `google_auth` table with auto-refresh.
- **Google Drive** — Upload files, create folders, auto-create `/Mission Control/Tasks/Ideas/Automated/` folder structure. Folder IDs cached in `google_folders` table.
- **Gmail** — Send emails (plain text + HTML), search by query, read full email content.
- **Google Docs** — Create docs with content, read doc content, append text.
- **Google Sheets** — Create spreadsheets, read ranges, write data.
- **Upload button** — `/api/google/upload-code` endpoint uploads code blocks to Drive Tasks folder with auto-journaling.
- **Google Calendar** — `getTodayEvents()` and `getUpcomingEvents(days)` built but not wired to any automation yet.

**Env vars needed:**
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://app.missioncontroldb.online/api/google/callback
```

**Setup:** Visit `/api/google/auth` to authorize Dean's Google account.

### Milestone J: Ideas Page with Kimi Research
**Service:** `src/lib/ideas.ts` | **UI:** `src/app/ideas/`

- **Ideas submission** — Title + description form, saved to `ideas` table
- **Research flow** — "Research This Idea" triggers Kimi to ask clarifying questions in an embedded chat per idea. After conversation, Kimi generates a full research report with Market, Technical, Competition, and Estimate sections stored as JSONB.
- **MVP generation** — After research, generates MVP code or Codex prompt
- **Build buttons** — "Build with Kimi/Opus/Sonnet" creates a task in Current Tasks assigned to that model
- **Export to Codex** — Shows copyable prompt in a collapsible panel
- **Search & filter** — Search by title/description, filter by status
- **Archive** — Soft-delete ideas

### Milestone K: Automations (Cron Jobs)
**Service:** `src/lib/automations.ts` | **UI:** `src/app/automations/`

- **Cron scheduler** — Built-in cron parser and matcher (minute/hour/dom/month/dow)
- **Create automations** — Title, description/prompt, cron schedule, model selection
- **Cron presets** — Daily 6am/9am/9pm, Weekly Monday, Monthly 1st, Custom
- **Schedule preview** — Shows next 5 run times before creating
- **Templates** — 3 pre-built templates: Weekly Social Trends, Daily Instagram Views, Morning Schedule
- **Scheduler tick** — `/api/automations/tick` finds due automations, creates auto-generated tasks, executes them, records runs, updates next_run
- **Management** — Pause/resume/delete automations, view run history
- **Auto-generated tasks** — Appear in Current Tasks with `[Auto]` prefix and notes linking back

**Cron setup:** Call `/api/automations/tick` via VPS cron every minute:
```
* * * * * curl -s -X POST http://localhost:3000/api/automations/tick > /dev/null
```

### Milestone L: N8N Workflow Integration
**Service:** `src/lib/n8n/client.ts` | **UI:** `src/app/workflows/`

- **Connection detection** — Tests N8N at configured URL, shows setup guide if not found
- **Workflow browser** — Lists all N8N workflows with active/inactive status
- **Execute workflows** — Run button with input parameter modal, shows results
- **Run history** — All workflow executions tracked in `n8n_workflow_runs` table
- **Webhook endpoint** — `/api/webhooks/n8n` accepts `create_task` action from N8N, creates tasks in Mission Control with auto-journaling
- **Setup guide** — Docker command and configuration steps if N8N not detected

**Env vars needed:**
```
N8N_API_URL=http://localhost:5678
N8N_API_KEY=  (optional)
```

### Milestone M: Local LLM Support
**Service:** `src/lib/local-llm/client.ts` | **UI:** `src/app/local-models/`

- **Add models manually** — Name, endpoint URL, model ID, context window
- **Test connection** — Pings model endpoint, shows latency or error
- **Activate/deactivate** — Toggle models on/off without deleting
- **LM Studio auto-detection** — On page load, pings `localhost:1234/v1/models` and offers one-click "Add All"
- **Chat integration** — Local models appear in separate dropdown section in chat (via `listActiveLocalModels()`)
- **Task execution** — Local models can be assigned to tasks, uses OpenAI-compatible API format
- **Graceful offline handling** — If local model endpoint is down, shows clear error without crashing

---

## Database Migration Required

Run `database/migrations/003_v2_features.sql` on the VPS Postgres. This creates 7 new tables:

- `google_auth` — OAuth refresh/access tokens
- `google_folders` — Cached Drive folder IDs
- `ideas` — Ideas with research data and conversation history
- `automations` — Scheduled recurring tasks
- `automation_runs` — Automation execution history
- `n8n_workflow_runs` — N8N workflow execution history
- `local_models` — Manually added local LLM models

**No existing tables are modified.**

---

## New Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | For Milestone I | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | For Milestone I | — | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | For Milestone I | — | OAuth callback URL |
| `N8N_API_URL` | For Milestone L | `http://localhost:5678` | N8N API endpoint |
| `N8N_API_KEY` | Optional | — | N8N API authentication key |

---

## New Files Added (v2)

### Service Layers (10 files)
```
src/lib/google/auth.ts        — OAuth flow + token management
src/lib/google/drive.ts       — Upload, folders, structure
src/lib/google/gmail.ts       — Send, search, read emails
src/lib/google/docs.ts        — Create, read, append docs
src/lib/google/sheets.ts      — Create, read, write sheets
src/lib/google/calendar.ts    — Today/upcoming events (bonus)
src/lib/ideas.ts              — Full CRUD, research, conversation
src/lib/automations.ts        — CRUD, cron parser, scheduler tick
src/lib/n8n/client.ts         — Connection test, workflow execute
src/lib/local-llm/client.ts   — Model CRUD, test, completion
```

### API Routes (10 files)
```
src/app/api/google/auth/route.ts         — OAuth initiation
src/app/api/google/callback/route.ts     — OAuth callback
src/app/api/google/upload-code/route.ts  — Upload code to Drive
src/app/api/ideas/route.ts               — Ideas CRUD
src/app/api/ideas/[id]/chat/route.ts     — Idea embedded chat
src/app/api/ideas/[id]/research/route.ts — Trigger Kimi research
src/app/api/automations/route.ts         — Automation CRUD
src/app/api/automations/tick/route.ts    — Scheduler tick
src/app/api/n8n/workflows/route.ts       — N8N workflow management
src/app/api/webhooks/n8n/route.ts        — N8N webhook endpoint
src/app/api/local-models/route.ts        — Local model CRUD
src/app/api/local-models/test/route.ts   — Test local model connection
```

### UI Pages (8 files)
```
src/app/ideas/page.tsx                   — Ideas server component
src/app/ideas/ideas-client.tsx           — Ideas client (258 lines)
src/app/automations/page.tsx             — Automations server component
src/app/automations/automations-client.tsx — Automations client (209 lines)
src/app/workflows/page.tsx               — Workflows server component
src/app/workflows/workflows-client.tsx   — Workflows client (117 lines)
src/app/local-models/page.tsx            — Local Models server component
src/app/local-models/local-models-client.tsx — Local Models client (224 lines)
```

### Database
```
database/migrations/003_v2_features.sql  — All 7 new tables
```

---

## Deployment Steps

1. **Run DB migration:**
   ```bash
   docker exec -i mission-control-postgres psql -U mission_control -d mission_control < database/migrations/003_v2_features.sql
   ```

2. **Update `.env`** on VPS with Google and N8N vars (if using those features)

3. **Update `docker-compose.yml`** — already includes all new env vars

4. **Rebuild and deploy:**
   ```bash
   docker-compose up -d --build
   ```

5. **Set up automation cron** (for Milestone K):
   ```bash
   # Add to crontab:
   * * * * * curl -s -X POST http://localhost:3000/api/automations/tick > /dev/null
   ```

6. **Authorize Google** (for Milestone I):
   Visit `https://app.missioncontroldb.online/api/google/auth`

7. **Install N8N** (for Milestone L, optional):
   ```bash
   docker run -d -p 5678:5678 n8nio/n8n
   ```

---

## Testing Checklist

### Existing Features (must still work)
- [ ] Login/auth
- [ ] Current Tasks CRUD + drag/drop
- [ ] Task execution (Run Task button)
- [ ] Chat with all models (GPT/Kimi/Claude)
- [ ] Chat task commands (list, create, run, move, show)
- [ ] Memory/Journal CRUD and chat commands
- [ ] Systems health dashboard
- [ ] Usage monitoring

### Milestone I (Google)
- [ ] `/api/google/auth` redirects to Google consent screen
- [ ] After authorization, tokens saved in DB
- [ ] Drive upload works via `/api/google/upload-code`
- [ ] Gmail send/search works
- [ ] Docs create works
- [ ] Sheets create/read works

### Milestone J (Ideas)
- [ ] Ideas page loads at `/ideas`
- [ ] Can submit new idea
- [ ] "Research This Idea" triggers Kimi conversation
- [ ] Can chat back and forth with Kimi per idea
- [ ] Research report generates with all sections
- [ ] Build buttons create tasks in Current Tasks
- [ ] Search and filter work

### Milestone K (Automations)
- [ ] Automations page loads at `/automations`
- [ ] Can create automation with cron schedule
- [ ] Preview shows next 5 run times
- [ ] Templates can be added with one click
- [ ] Pause/resume/delete work
- [ ] `/api/automations/tick` creates and executes auto-tasks

### Milestone L (N8N)
- [ ] Workflows page loads at `/workflows`
- [ ] Shows setup guide if N8N not connected
- [ ] Lists workflows if N8N connected
- [ ] Webhook creates tasks via POST to `/api/webhooks/n8n`

### Milestone M (Local LLMs)
- [ ] Local Models page loads at `/local-models`
- [ ] Can add model manually
- [ ] Test connection shows latency or error
- [ ] Activate/deactivate toggle works
- [ ] LM Studio detection works (if LM Studio running)

---

## What Remains for Live Verification

These features are fully coded but need live VPS testing with real credentials:
- Google OAuth flow (needs real Google Cloud project credentials)
- Gmail send/search (needs authorized Google account)
- N8N workflows (needs N8N instance running)
- Local LLM chat (needs LM Studio or similar running)
- Automation scheduler (needs cron job on VPS)

All service layers handle errors gracefully — if a service is not configured, the app shows clear error messages without crashing.
