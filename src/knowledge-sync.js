// Sync per-service knowledge into the OpenClaw workspace before the gateway boots.
//
// Reads KNOWLEDGE_SERVICES (comma-separated entries):
//
//   KNOWLEDGE_SERVICES="crater:eliteweblabs/crater,contact-api:eliteweblabs/contact-api@main"
//
// Each entry: <local-name>:<owner>/<repo>[@<ref>]
//
// For each entry the module:
//   1. shallow-clones the repo (using $GIT_TOKEN if present, otherwise anonymous)
//   2. wipes <workspace>/services/<local-name>/ and rewrites it
//   3. copies all root-level *.md files into that directory
//   4. drops a .sync-meta file with provenance (repo, ref, commit, timestamp)
//
// Failures for a single service are logged and skipped; they never block startup.
// Without KNOWLEDGE_SERVICES set, the function is a no-op.

import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TAG = "[knowledge-sync]";

function log(msg) {
  process.stderr.write(`${TAG} ${msg}\n`);
}

function parseSpec(spec) {
  const out = [];
  for (const raw of spec.split(",")) {
    const entry = raw.trim();
    if (!entry) continue;

    const colonIdx = entry.indexOf(":");
    if (colonIdx <= 0) {
      log(`WARN: ignoring malformed entry "${entry}" (expected name:owner/repo)`);
      continue;
    }
    const name = entry.slice(0, colonIdx).trim();
    const rest = entry.slice(colonIdx + 1).trim();

    let repo = rest;
    let ref = "";
    const atIdx = rest.indexOf("@");
    if (atIdx >= 0) {
      repo = rest.slice(0, atIdx).trim();
      ref = rest.slice(atIdx + 1).trim();
    }

    if (!/^[A-Za-z0-9_.-]+$/.test(name)) {
      log(`WARN: ignoring entry with unsafe name "${name}"`);
      continue;
    }
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
      log(`WARN: ignoring entry with malformed repo "${repo}"`);
      continue;
    }

    out.push({ name, repo, ref });
  }
  return out;
}

function buildCloneUrl(repo, gitToken) {
  if (gitToken) {
    // x-access-token is GitHub's documented username for PAT auth via Basic.
    return `https://x-access-token:${gitToken}@github.com/${repo}.git`;
  }
  return `https://github.com/${repo}.git`;
}

function gitClone({ url, ref, dest }) {
  const args = ["clone", "--depth", "1", "--quiet"];
  if (ref) args.push("--branch", ref);
  args.push("--", url, dest);
  const r = childProcess.spawnSync("git", args, { stdio: ["ignore", "pipe", "pipe"] });
  if (r.status !== 0) {
    const stderr = r.stderr?.toString() ?? "";
    // Strip token from any error output before logging.
    const safe = stderr.replace(/x-access-token:[^@]+@/g, "x-access-token:***@");
    throw new Error(`git clone failed (exit ${r.status}): ${safe.trim()}`);
  }
}

function gitShortSha(repoDir) {
  const r = childProcess.spawnSync("git", ["-C", repoDir, "rev-parse", "--short", "HEAD"], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (r.status !== 0) return "unknown";
  return (r.stdout?.toString() ?? "").trim() || "unknown";
}

function copyRootMarkdown(srcDir, destDir) {
  let count = 0;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.toLowerCase().endsWith(".md")) continue;
    fs.copyFileSync(path.join(srcDir, entry.name), path.join(destDir, entry.name));
    count++;
  }
  return count;
}

function syncOne({ name, repo, ref, gitToken, servicesDir }) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `knowledge-${name}-`));
  const cloneDir = path.join(tmpRoot, "clone");
  const target = path.join(servicesDir, name);

  try {
    gitClone({
      url: buildCloneUrl(repo, gitToken),
      ref,
      dest: cloneDir,
    });

    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(target, { recursive: true });

    const filesCopied = copyRootMarkdown(cloneDir, target);
    const commit = gitShortSha(cloneDir);

    const meta = [
      `repo=${repo}`,
      `ref=${ref || "(default)"}`,
      `commit=${commit}`,
      `synced_at=${new Date().toISOString()}`,
      `files_copied=${filesCopied}`,
      "",
    ].join("\n");
    fs.writeFileSync(path.join(target, ".sync-meta"), meta, { mode: 0o644 });

    log(`${name}: ${filesCopied} markdown file(s) from ${repo}@${commit}`);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

export function syncKnowledgeServices({ workspaceDir, gitToken, spec } = {}) {
  const rawSpec = (spec ?? process.env.KNOWLEDGE_SERVICES ?? "").trim();
  if (!rawSpec) {
    log("KNOWLEDGE_SERVICES not set, skipping");
    return { synced: 0, failed: 0, skipped: true };
  }

  const entries = parseSpec(rawSpec);
  if (entries.length === 0) {
    log("KNOWLEDGE_SERVICES contained no valid entries, skipping");
    return { synced: 0, failed: 0, skipped: true };
  }

  const wsDir = workspaceDir || process.env.OPENCLAW_WORKSPACE_DIR || "/data/workspace";
  const servicesDir = path.join(wsDir, "services");
  fs.mkdirSync(servicesDir, { recursive: true });

  const token = gitToken ?? process.env.GIT_TOKEN ?? "";
  let synced = 0;
  let failed = 0;

  for (const entry of entries) {
    try {
      syncOne({ ...entry, gitToken: token, servicesDir });
      synced++;
    } catch (err) {
      failed++;
      log(`ERROR syncing ${entry.name} (${entry.repo}): ${err?.message ?? err}`);
    }
  }

  log(`done: ${synced} synced, ${failed} failed (target: ${servicesDir})`);
  return { synced, failed, skipped: false };
}
