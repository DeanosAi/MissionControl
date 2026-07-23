# Live source synchronization - 2026-07-23

This branch restores the application source currently deployed at `app.missioncontroldb.online` to GitHub.

## Source of truth

- VPS application directory: `/home/deanadmin/apps/mission-control-vps`
- Snapshot date: 2026-07-23 (Australia/Sydney)
- Snapshot SHA-256: `d09a290bee3bc9b84a85ea0743907ea27d64ec9dd37efa3ce2330bd2f7e0e205`
- GitHub baseline: `a609cca344f2a73021a7c8fee959192288a65900`

The live directory was read through SSH and copied into a separate local workspace. The production directory and running containers were not modified.

## Exclusions

The snapshot deliberately excluded:

- `.git`
- `.env`, `.env.save`, and `.env.local`
- `node_modules`
- `.next`
- runtime `data`
- TypeScript build caches
- deployment archives

No database contents, credentials, private keys, generated build output, or runtime data are included in this synchronization.

## Reconciliation policy

The deployed `src` tree and its relevant runtime configuration are the source of truth for application behavior. Repository-only history and operational assets that are not part of the deployed source are retained, including database migration `003_v2_features.sql`, work summaries, documentation, and historical deployment bundles.

The Mission Control V3 Sprint 1 work remains in a separate, uncommitted workspace and is not part of this live-source synchronization.

## Verification

- `npx tsc --noEmit` passes.
- `npm run build` passes and includes the live-only AI Builds, Content, and Idea routes.
- A high-risk secret-pattern scan of the synchronized changes found no credentials or private keys.
- ESLint still reports existing production-source debt in the OAuth proxy, Ideas routes, and Ideas client. Those behaviors were not rewritten during this source-of-truth synchronization.
- `npm ci` reports seven existing dependency advisories: one low, two moderate, and four high.
