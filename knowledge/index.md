# Knowledge Index

Service knowledge lives in each repository's `KNOWLEDGE.md` in the `eliteweblabs/` GitHub org and is **auto-synced into the workspace** by the OpenClaw runtime on every container start.

## Where to Read It

After startup, each service's docs live at `services/<name>/KNOWLEDGE.md` in this workspace. Read those, not the GitHub URLs.

| Service | Workspace path | Source repo |
|---------|----------------|-------------|
| `crater` | `services/crater/KNOWLEDGE.md` | [`eliteweblabs/crater`](https://github.com/eliteweblabs/crater) |
| `contact-api` | `services/contact-api/KNOWLEDGE.md` | [`eliteweblabs/contact-api`](https://github.com/eliteweblabs/contact-api) |
| `credit-check` | `services/credit-check/` | [`eliteweblabs/Credit-Check-API`](https://github.com/eliteweblabs/Credit-Check-API) |

Each service directory also contains a `.sync-meta` file with the source repo, ref, commit SHA, and sync timestamp — useful for "why is the bot saying old info" debugging.

## How It Works

1. The OpenClaw runtime (`clawdbot-railway-template`) reads the `KNOWLEDGE_SERVICES` env var (comma-separated `name:owner/repo[@ref]` entries).
2. On every container start, it shallow-clones each listed repo and copies all root-level `*.md` files into `services/<name>/`.
3. Updates flow automatically — push to a service's `KNOWLEDGE.md`, restart the OpenClaw pod, the new content is live.

## Adding a New Service

1. Add `KNOWLEDGE.md` to the service's repo root (any `.md` files at the root are picked up).
2. Add the service to `KNOWLEDGE_SERVICES` on the OpenClaw Railway service.
3. Restart the pod.

## Local-Only / Per-Installation Knowledge

Anything that's specific to **one** OpenClaw installation (e.g. Reave's client aliases, MEMORY.md, the Reave-specific client list) belongs in this template repo or — eventually — in a per-installation knowledge repo (e.g. `eliteweblabs/reave-knowledge`).

The subdirectories of this `knowledge/` folder (`crater/`, `contact-api/`, `calendly/`, `verizon/`) contain legacy per-service notes that **predate** the auto-sync. Some still have unique content (especially shell-script docs); they will be cleaned up in a follow-up once anything unique has been promoted to the canonical service repos.