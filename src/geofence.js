// Geofence webhook endpoints for iPhone Shortcuts / field techs.
//
// Routes (registered on the wrapper Express app BEFORE the catch-all proxy):
//   POST /geofence          { jobId, event: "arrive" | "leave" }
//   GET  /geofence/jobs     returns today's / upcoming bookings (JSON)
//
// Auth:
//   If env var GEOFENCE_TOKEN is set, requests must provide it via the
//   X-Geofence-Token header (or ?token=... query). If it is not set, the
//   endpoints are open — fine for first-day testing, but the operator should
//   set a token in Railway Variables before handing out the URL to techs.
//
// TODO(auth): Replace this shared-secret check with per-employee auth when the
//   field-tech app / SPA ships (daily login, session cookie, etc).
//
// Execution model:
//   Both endpoints shell out to scripts that already live on the Railway
//   persistent volume under $WORKSPACE_DIR/scripts/. On Railway this is
//   /data/workspace/scripts/ (set via OPENCLAW_WORKSPACE_DIR). We use
//   child_process.spawn with an args array — no shell interpolation — and
//   validate jobId with a strict allowlist regex for defense-in-depth.

import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const JOB_ID_RE = /^[A-Za-z0-9_.:-]{1,128}$/;
const SCRIPT_TIMEOUT_MS = 30_000;

function runScript(scriptPath, args, timeoutMs = SCRIPT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let proc;
    try {
      proc = childProcess.spawn(scriptPath, args, {
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      resolve({ code: 127, stdout: "", stderr: `[spawn threw] ${String(err)}` });
      return;
    }

    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => (stdout += d.toString("utf8")));
    proc.stderr?.on("data", (d) => (stderr += d.toString("utf8")));

    let killTimer;
    const timer = setTimeout(() => {
      try { proc.kill("SIGTERM"); } catch {}
      killTimer = setTimeout(() => {
        try { proc.kill("SIGKILL"); } catch {}
      }, 2_000);
      stderr += `\n[timeout] Script exceeded ${timeoutMs}ms and was terminated.\n`;
      resolve({ code: 124, stdout, stderr });
    }, timeoutMs);

    proc.on("error", (err) => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      resolve({ code: 127, stdout, stderr: stderr + `\n[spawn error] ${String(err)}\n` });
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
}

function requireGeofenceToken(req, res, next) {
  const expected = process.env.GEOFENCE_TOKEN?.trim();
  if (!expected) return next();

  const header = req.headers["x-geofence-token"];
  const query = req.query?.token;
  const provided = String(header || query || "").trim();

  if (!provided || provided !== expected) {
    return res.status(401).json({ ok: false, error: "Invalid or missing geofence token" });
  }
  return next();
}

export function registerGeofenceRoutes(app, { workspaceDir }) {
  if (!workspaceDir) {
    throw new Error("registerGeofenceRoutes: workspaceDir is required");
  }

  const scriptsDir = path.join(workspaceDir, "scripts");
  const jobTrackerPath = path.join(scriptsDir, "job-tracker.sh");
  const bookingApiPath = path.join(scriptsDir, "booking-api.sh");

  if (!process.env.GEOFENCE_TOKEN?.trim()) {
    console.warn(
      "[geofence] GEOFENCE_TOKEN is not set — /geofence endpoints are PUBLIC. " +
        "Set GEOFENCE_TOKEN in Railway Variables before sharing the URL with techs."
    );
  }

  app.post("/geofence", requireGeofenceToken, async (req, res) => {
    try {
      const body = req.body || {};
      const jobId = String(body.jobId || "").trim();
      const event = String(body.event || "").trim().toLowerCase();

      if (!jobId) {
        return res.status(400).json({ ok: false, error: "Missing jobId" });
      }
      if (!JOB_ID_RE.test(jobId)) {
        return res.status(400).json({
          ok: false,
          error: "Invalid jobId (allowed: A-Z a-z 0-9 . _ - : up to 128 chars)",
        });
      }
      if (event !== "arrive" && event !== "leave") {
        return res.status(400).json({
          ok: false,
          error: "event must be 'arrive' or 'leave'",
        });
      }

      if (!fs.existsSync(jobTrackerPath)) {
        return res.status(500).json({
          ok: false,
          error: `job-tracker.sh not found at ${jobTrackerPath}. ` +
            "Place the script on the Railway persistent volume at $WORKSPACE_DIR/scripts/.",
        });
      }

      const args =
        event === "arrive"
          ? ["start", jobId, "auto-geofence"]
          : ["complete", jobId];

      const result = await runScript(jobTrackerPath, args);

      return res.status(result.code === 0 ? 200 : 500).json({
        ok: result.code === 0,
        jobId,
        event,
        exitCode: result.code,
        stdout: result.stdout,
        stderr: result.stderr,
      });
    } catch (err) {
      console.error("[/geofence] error:", err);
      return res.status(500).json({ ok: false, error: String(err) });
    }
  });

  app.get("/geofence/jobs", requireGeofenceToken, async (_req, res) => {
    try {
      if (!fs.existsSync(bookingApiPath)) {
        return res.status(500).json({
          ok: false,
          error: `booking-api.sh not found at ${bookingApiPath}. ` +
            "Place the script on the Railway persistent volume at $WORKSPACE_DIR/scripts/.",
        });
      }

      const result = await runScript(bookingApiPath, ["list", "upcoming"]);

      if (result.code !== 0) {
        return res.status(500).json({
          ok: false,
          exitCode: result.code,
          stdout: result.stdout,
          stderr: result.stderr,
        });
      }

      // booking-api.sh returns JSON from Cal.com on stdout. Pass through as
      // parsed JSON if possible so Shortcuts can "Get Dictionary Value" on it.
      const trimmed = (result.stdout || "").trim();
      if (!trimmed) {
        return res.json({ ok: true, bookings: [] });
      }
      try {
        const parsed = JSON.parse(trimmed);
        return res.json(parsed);
      } catch {
        return res.type("application/json").send(trimmed);
      }
    } catch (err) {
      console.error("[/geofence/jobs] error:", err);
      return res.status(500).json({ ok: false, error: String(err) });
    }
  });
}
