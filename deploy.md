# Mission Control VPS Deployment Notes

## Current deployment target
- VPS: Contabo Ubuntu 24.04
- Domain: app.missioncontroldb.online
- App runtime: Next.js app in Docker

## Recommended first deployment path
1. Install Docker and Docker Compose plugin on the VPS.
2. Clone this repository onto the VPS.
3. Build and run with `docker compose up -d --build`.
4. Put the app behind Caddy or Nginx for HTTPS.
5. Point `app.missioncontroldb.online` to the VPS and verify propagation.

## Backup direction
- Create nightly compressed backups on the VPS first.
- Keep rolling local retention on the VPS.
- Add a second-stage sync to the local PC that is allowed to fail without impacting runtime.

## Immediate next technical tasks
- Add real admin authentication.
- Add durable data storage beyond seed data.
- Add reverse proxy config with TLS.
- Add backup scripts and retention policy.
