# Mission Control VPS

Mission Control VPS is a separate Next.js app for the VPS-hosted version of Mission Control. It is intentionally separate from the existing local Mission Control project and is designed as a private builder operating system for ideas, projects, AI builds, tools, systems, automations, and memory.

## V1 shape
- Home dashboard shell
- Ideas dashboard
- Suggested Ideas placeholder panel
- Projects overview
- AI Builds with visible model ownership (GPT-5.4 / Sonnet / Opus / Codex / Kimi)
- Tools, Systems, and Automations sections
- Memory / Journal section
- Content section reserved as Coming Soon

## Design direction
- Professional modern SaaS base
- Sleek dark control-room feel
- Subtle cyber edge without becoming visually noisy
- Modular and easy to extend later

## Local development
```powershell
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Production build
```powershell
npm run build
npm run start
```

## Architecture notes
- Uses the Next.js App Router
- Uses simple file-backed seed data in `src/lib/data.ts` for fast v1 delivery
- Structure is intended to be replaceable with Postgres later without redesigning the UI shell
- Auth is intentionally a placeholder concept in v1 so shipping the dashboard is not blocked by full auth plumbing

## Next recommended deployment steps
1. Add real auth for the single admin account.
2. Move seed data into Postgres or another durable store.
3. Add Docker and docker-compose for the VPS runtime.
4. Put the app behind Nginx or Caddy with HTTPS on `app.missioncontroldb.online`.
5. Add a journal write path and backup/export scripts.
6. Add background jobs for Suggested Ideas scanning and automated memory entries.
