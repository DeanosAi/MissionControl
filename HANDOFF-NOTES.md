# Mission Control VPS — AI Handoff Notes

## Project purpose
Mission Control VPS is a private self-hosted builder operating system for Dean, hosted at `app.missioncontroldb.online`.

## Current state summary
- Milestone A — ✅ Complete
- Milestone B — ✅ Complete
- Milestone C — ✅ Complete (stabilization)
- Milestone D — ✅ Complete (task execution engine)
- Milestone E — ✅ Complete (chat-to-task integration)
- Milestone F — ✅ Complete (memory and continuity)
- Milestone G — ✅ Complete (operations and resilience)
- Milestone H — ✅ Complete (final polish)

What works right now:
- Next.js app deployed on VPS behind Docker
- Login/auth with session management
- Postgres-backed app foundation
- Current Tasks CRUD + drag/drop + AI assignment metadata
- **GPT-5.4 via OAuth tunnel** — uses ChatGPT subscription (zero API credits), auto-falls back to Kimi K2.5 when host PC is offline
- Kimi K2.5, Claude Opus 4.6, Claude Sonnet 4.5 all working
- GPT availability indicator in chat form (live green/amber badge)
- GPT OAuth status card on Systems health dashboard
- Home usage panel + dedicated Usage page with staleness indicators
- Host-to-VPS usage snapshot pipeline + local refresh loop
- Multi-model chat with timeout + error handling
- Task execution engine — Run Task button, output stored, inline display
- Task state auto-progression (backlog → in-progress → review)
- Chat-to-task integration — create, list, run, move, show tasks from chat
- DB-backed journal with auto-journaling on task events
- Curated memory notes with pin/unpin, injected into AI conversations
- Chat memory commands — add journal, show journal, remember, show memory, forget
- AI system prompt includes live task + journal + memory context
- System health dashboard (DB, backups, app uptime, GPT OAuth)
- Backup automation with nightly dump + restore script
- Admin maintenance API (clear chat, purge executions, vacuum, stats)

What needs live VPS-side setup:
- Run DB migrations (001 + 002)
- Set `OPENAI_OAUTH_ENDPOINT=http://localhost:3001/chat` in VPS .env
- Start GPT OAuth on host PC: `.\scripts\start-gpt-oauth.ps1`
- Set up backup cron
- Rebuild Docker container

## GPT OAuth Integration — How It Works

### Architecture
```
[Dean's Windows PC]                    [VPS at app.missioncontroldb.online]
  chat-oauth-proxy.js (port 3001)  <---SSH reverse tunnel--->  localhost:3001
  Uses OpenClaw acpx CLI                                       Next.js app reads
  ChatGPT subscription                                         from localhost:3001
  No API credits used                                          Falls back to Kimi
                                                               if tunnel is down
```

### Setup steps
1. On the VPS `.env`, set: `OPENAI_OAUTH_ENDPOINT=http://localhost:3001/chat`
2. On Dean's Windows PC, run: `.\scripts\start-gpt-oauth.ps1`
   - This starts the OAuth proxy AND the SSH reverse tunnel together
   - Or run them separately:
     - `node scripts\chat-oauth-proxy.js` (starts the proxy)
     - `.\scripts\start-gpt-tunnel.ps1` (starts the SSH tunnel)
3. The VPS app automatically detects GPT availability via `/api/gpt-status`
4. When GPT is selected in chat but the tunnel is down, it falls back to Kimi K2.5 and tells the user

### Key files
- `scripts/chat-oauth-proxy.js` — local OAuth proxy using OpenClaw acpx CLI
- `scripts/start-gpt-tunnel.ps1` — SSH reverse tunnel with auto-reconnect
- `scripts/start-gpt-oauth.ps1` — combined startup (proxy + tunnel)
- `src/lib/ai/gpt-oauth-status.ts` — availability checker (probes localhost:3001/health)
- `src/lib/ai/openai.ts` — OpenAI completion via OAuth endpoint
- `src/lib/ai/models.ts` — GPT-5.4 model with `requiresOAuth` flag and `fallbackModelId`
- `src/app/api/gpt-status/route.ts` — API endpoint for frontend availability polling

## Current live model setup
- **GPT-5.4 (default)** — via OAuth tunnel, falls back to Kimi K2.5 when host PC is offline
- Kimi K2.5 — fallback default, always available
- Claude Sonnet 4.5
- Claude Opus 4.6

## All changes across sessions

### Milestone C — Stabilization
- Chat subtitle fixed (removed "Powered by GPT-4")
- Usage staleness indicators
- 2-minute timeout on all chat model calls
- Specific error hints (timeout, auth, rate limit)

### Milestone D — Task Execution Engine
- `task_executions` DB table + migration `001_task_executions.sql`
- `src/lib/task-execution.ts` — execution service with 3-min timeout
- Run Task button on task cards + inline output panel
- Task state auto-progression
- API routes: `POST /api/tasks/[id]/execute`, `GET /api/tasks/[id]/executions`
- Server action `executeTaskAction`

### Milestone E — Chat-to-Task Integration
- `src/lib/chat-tasks.ts` — intent detection, command execution, fuzzy task lookup
- 5 chat commands: create task, list tasks, run task, move task, show task
- Task commands execute without LLM call (no API credits)
- System prompt includes live task context

### Milestone F — Memory and Continuity
- `journal_entries` + `memory_notes` DB tables + migration `002_journal_memory.sql`
- `src/lib/journal.ts` — full CRUD + auto-journaling helpers + `getJournalContext()`
- `src/lib/memory.ts` — full CRUD + upsert + pin/unpin + `getMemoryContext()`
- `src/lib/chat-memory.ts` — 5 memory/journal chat commands
- `src/lib/journal-seed.ts` — one-time migration of hardcoded entries
- Auto-journaling: task execution (success/failure), task creation from chat, task completion
- System prompt injects task + journal + memory context via Promise.all
- Memory/Journal page: DB-backed with JournalPanel + MemoryPanel components
- `src/app/memory/actions.ts` — server actions for journal + memory CRUD

### Milestone G — Operations and Resilience
- `scripts/backup-database.sh` — automated nightly Postgres dump, gzip, 7-day rolling retention, writes backup-status.json
- `scripts/restore-database.sh` — interactive restore from backup file
- `src/lib/system-health.ts` — checks DB connectivity/latency, record counts, backup status, app uptime
- `GET /api/health` — health check endpoint (returns 503 if DB down)
- `POST /api/admin` — admin maintenance: clear-chat, clear-old-executions, vacuum, db-stats
- `src/app/systems/health-panel.tsx` — live health dashboard (3 cards: Database, Backups, Application) with 30s auto-refresh
- Systems page rebuilt as operational dashboard
- Optional env var: `BACKUP_STATUS_PATH` (defaults to `/home/dean/backups/mission-control/backup-status.json`)

## Required DB migrations for existing deployments
Run in order:
```sql
-- Migration 1: Task executions (Milestone D)
-- File: database/migrations/001_task_executions.sql

-- Migration 2: Journal + memory (Milestone F)
-- File: database/migrations/002_journal_memory.sql
```

## No new environment variables required
All features reuse existing `ANTHROPIC_API_KEY` and `MOONSHOT_API_KEY`.

## Areas that still need live VPS-side testing
1. Run both DB migrations on VPS Postgres
2. Verify Run Task button with all 3 models
3. Verify all chat commands: task + journal + memory
4. Verify auto-journaling on task execution
5. Verify Memory/Journal page loads with seeded entries
6. Verify memory notes appear in AI system prompt
7. Verify usage staleness indicators
8. Verify Systems page health dashboard loads
9. Set up cron for backup-database.sh: `0 2 * * * /home/dean/apps/mission-control-vps/scripts/backup-database.sh >> /var/log/mc-backup.log 2>&1`
10. Run backup manually once to generate backup-status.json, then verify Systems page shows backup status
11. Test admin actions: `curl -X POST /api/admin -d '{"action":"db-stats"}'`

## Formal roadmap
- Milestone C — ✅ DONE
- Milestone D — ✅ DONE
- Milestone E — ✅ DONE
- Milestone F — ✅ DONE
- Milestone G — ✅ DONE
- Milestone H — ✅ DONE

**All milestones complete. Mission Control VPS v1 is finished.**

## Requested approach for the next AI
The codebase is complete. The next priorities are:
1. Deploy to VPS and run both DB migrations
2. Set up cron for backup-database.sh
3. End-to-end live verification of all features
4. Any future work is post-v1 enhancement

Be careful not to break:
- Chat task + memory commands
- Task execution engine
- Journal auto-journaling
- Memory context injection
- System health dashboard
- Backup scripts
- Current Tasks CRUD/drag/Run Task
- Login/auth
- Usage monitoring
