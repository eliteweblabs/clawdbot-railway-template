# Client Directory

Knowledge about clients is organized for per-deploy isolation. On every Railway
service, only the files relevant to that deployment's `CLIENT_ID` land in the
bot's workspace.

## Layout on disk (repo)

```
clients/
  _shared/              # synced to every deploy
    README.md
    dashboard.md
  <client-id>/          # only synced when CLIENT_ID=<client-id>
    <docs>.md
```

Known client IDs: `gp`, `paulino`, `reave`, `capco`, `mavsafe`, `authentic`, `rothco`.

## What the bot sees (workspace)

After boot sync, everything lands **flat** at `/data/workspace/clients/`:

```
clients/
  README.md            # from _shared/
  dashboard.md         # from _shared/
  <client-docs>.md     # from the client's folder, flattened
```

So prompts that reference `clients/paulino-auto.md` still work — files just
aren't available on deploys that aren't Paulino.

## Invoice tracking (same pattern)

Active invoices live at `invoices/{slug}-active.md`. This folder is **not** yet
CLIENT_ID-gated; treat cross-client leakage as a known issue until that PR lands.

## Common commands

Tibby handles these — just ask:

- "Show me the client dashboard"
- "What's going on with [client]?"
- "Add [service] to [client] invoice"
- "Draft a check-in email for [client]"
