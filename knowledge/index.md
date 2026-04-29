# Knowledge Index

Service knowledge lives in each repository's `KNOWLEDGE.md` in the `eliteweblabs/` GitHub org.

## Service Repos

| Repo | URL | Status |
|------|-----|--------|
| `crater` | [KNOWLEDGE.md](https://github.com/eliteweblabs/crater/blob/master/KNOWLEDGE.md) | ✅ Added |
| `contact-api` | [KNOWLEDGE.md](https://github.com/eliteweblabs/contact-api/blob/main/KNOWLEDGE.md) | ✅ Added |
| `calcom-booking-api` | [KNOWLEDGE.md](https://github.com/eliteweblabs/calcom-booking-api/blob/main/KNOWLEDGE.md) | ✅ Added |

## How It Works

1. Each service repo has its own `KNOWLEDGE.md`
2. When cloned/deployed, the agent reads the repo's `KNOWLEDGE.md`
3. Cherry-pick by cloning that repo

## Adding Knowledge

Add `KNOWLEDGE.md` to any service repo in `eliteweblabs/` — it deploys with the repo.

## Local Workspace Knowledge

Local-only stuff still goes in `~/.openclaw/workspace/knowledge/` for things that aren't in GitHub.