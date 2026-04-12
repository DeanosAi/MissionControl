# Usage telemetry deployment note

Mission Control usage telemetry now uses a host-side snapshot model.

## Why
The Next.js app runs in a container and cannot directly access the host OpenClaw runtime/provider state. Querying `openclaw models status` from inside the app container will fall back.

## Working design
1. Host runtime gathers real usage/provider status.
2. Host writes a snapshot into `mission_control.usage_snapshots`.
3. Mission Control reads the latest snapshot and renders it on Home and `/usage`.

## Data shown
### OpenAI / Codex
- window remaining
- reset timer
- weekly remaining
- weekly reset timer

### Anthropic
- provider/key health status
- explanatory note

Exact Anthropic spend remaining is deliberately not shown unless a verified source exists.

## Next operational step
Wire the host-side snapshot script into a scheduled job so the app always has fresh data.
