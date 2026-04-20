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

// ---------------------------------------------------------------------------
// Timezone helper — "is this ISO timestamp on the same calendar day as now in
// the given IANA zone?". Pure Intl, no deps.
// ---------------------------------------------------------------------------
function dateKeyInZone(date, timeZone) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(date);
}

function isTodayInZone(iso, timeZone) {
  try {
    return dateKeyInZone(new Date(iso), timeZone) ===
           dateKeyInZone(new Date(), timeZone);
  } catch {
    return false;
  }
}

function localTimeLabel(iso, timeZone) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone, hour: "numeric", minute: "2-digit", hour12: true,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Address extraction
// ---------------------------------------------------------------------------
// Cal.com stores physical meeting addresses in Booking.location for the
// "In Person (Attendee Address)" event type. Older / free-form flows put it
// in description. Try location first, fall back to description, skip anything
// that's obviously a video URL.
function pickAddress(b) {
  const candidates = [b.location, b.description].filter(Boolean);
  for (const raw of candidates) {
    const cleaned = String(raw)
      .replace(/^(address|location)\s*[:\-]\s*/i, "")
      .split("\n")[0]
      .trim();
    if (!cleaned) continue;
    if (/^https?:\/\//i.test(cleaned)) continue;
    if (/zoom|meet\.google|teams\.microsoft|daily\.co/i.test(cleaned)) continue;
    if (cleaned.length >= 5) return cleaned;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Geocoder — Mapbox if MAPBOX_TOKEN is set, else Nominatim (free, 1 req/s).
// Process-local cache; Railway restarts are cheap and addresses don't move.
// ---------------------------------------------------------------------------
const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const geocodeCache = new Map(); // normalized address -> { lat, lng, resolved, expiresAt }
let lastNominatimCallAt = 0;

function normalizeAddress(s) {
  return String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
}

async function geocodeMapbox(address, token) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?limit=1&access_token=${token}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`mapbox ${r.status}`);
  const data = await r.json();
  const f = data.features?.[0];
  if (!f) return null;
  return { lat: f.center[1], lng: f.center[0], resolved: f.place_name || address };
}

async function geocodeNominatim(address) {
  // Polite throttle — Nominatim ToS is 1 req/s.
  const wait = lastNominatimCallAt + 1100 - Date.now();
  if (wait > 0) await new Promise(res => setTimeout(res, wait));
  lastNominatimCallAt = Date.now();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  const r = await fetch(url, {
    headers: {
      "User-Agent": "clawdbot-geofence (support@eliteweblabs.com)",
      "Accept": "application/json",
    },
  });
  if (!r.ok) throw new Error(`nominatim ${r.status}`);
  const arr = await r.json();
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return {
    lat: Number(arr[0].lat),
    lng: Number(arr[0].lon),
    resolved: arr[0].display_name || address,
  };
}

async function geocode(address) {
  if (!address || !address.trim()) return null;
  const key = normalizeAddress(address);
  const hit = geocodeCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return { ...hit, cached: true };

  const mapboxToken = process.env.MAPBOX_TOKEN?.trim();
  const result = mapboxToken
    ? await geocodeMapbox(address, mapboxToken)
    : await geocodeNominatim(address);

  if (!result) return null;
  geocodeCache.set(key, { ...result, expiresAt: Date.now() + GEOCODE_CACHE_TTL_MS });
  return { ...result, cached: false };
}

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

      const response = {
        ok: result.code === 0,
        jobId,
        event,
        exitCode: result.code,
        stdout: result.stdout,
        stderr: result.stderr,
      };

      // Auto-invoice: when a job completes and the caller supplied invoice
      // data, create a Crater invoice and surface the public URL in the
      // response so the tech/shortcut can hand it to the customer.
      //
      // Accepts either shorthand { client, service, amount } or the full
      // Crater schema { customer_name, items: [...] }. If CRATER_URL is not
      // configured we skip silently (the geofence side still succeeded).
      if (event === "leave" && result.code === 0) {
        const invoiceInput = body.invoice && typeof body.invoice === "object" ? body.invoice : null;
        const hasShorthand =
          body.client || body.service || body.amount != null || body.customer_name;

        if (invoiceInput || hasShorthand) {
          const payload = invoiceInput || {
            client: body.client,
            service: body.service,
            amount: body.amount,
            email: body.email,
            notes: body.notes,
            customer_name: body.customer_name,
            items: body.items,
          };
          payload.notes = payload.notes || `Job ${jobId} — auto-generated on completion`;

          const invResult = await createCraterInvoice(payload);
          if (invResult.ok) {
            const inv = invResult.invoice || {};
            response.invoice = {
              ok: true,
              invoice_id: inv.invoice_id,
              invoice_number: inv.invoice_number,
              total: inv.total,
              invoice_url: inv.public_url,
              pdf_url: inv.pdf_url,
              payment_url: inv.payment_url,
            };
          } else {
            response.invoice = {
              ok: false,
              error: invResult.error,
              status: invResult.status,
            };
          }
        }
      }

      return res.status(result.code === 0 ? 200 : 500).json(response);
    } catch (err) {
      console.error("[/geofence] error:", err);
      return res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // GET /geofence/jobs
  //
  // Returns today's bookings (filtered to the TIMEZONE env, default
  // America/New_York) as a flat array of jobs with geocoded coordinates.
  // Designed to be consumed directly by an iOS Shortcut ("Get Dictionary
  // Value" over .jobs[*].address / .lat / .lng).
  //
  // Shape:
  //   {
  //     ok: true,
  //     tech: "todd-mcnamara",
  //     timezone: "America/New_York",
  //     date: "2026-04-20",
  //     count: 3,
  //     generatedAt: "2026-04-20T14:25:00.000Z",
  //     jobs: [
  //       { jobId, uid, title, customer, email, startTime, endTime,
  //         localTime, status, address, lat, lng, geocoded },
  //       ...
  //     ]
  //   }
  app.get("/geofence/jobs", requireGeofenceToken, async (req, res) => {
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
          error: "booking-api.sh failed",
          exitCode: result.code,
          stdout: result.stdout,
          stderr: result.stderr,
        });
      }

      const trimmed = (result.stdout || "").trim();
      let payload;
      try {
        payload = trimmed ? JSON.parse(trimmed) : {};
      } catch (e) {
        return res.status(502).json({
          ok: false,
          error: "booking-api returned non-JSON",
          stdout: trimmed.slice(0, 1000),
        });
      }

      const bookings = Array.isArray(payload.bookings) ? payload.bookings : [];
      const timezone = process.env.TIMEZONE?.trim() || "America/New_York";

      // Only today, only real bookings. ?all=1 bypasses the today filter
      // (handy for debugging from a phone).
      const includeAll = req.query?.all === "1" || req.query?.all === "true";
      const todays = bookings.filter(b => {
        if (b.status && b.status !== "ACCEPTED" && b.status !== "PENDING") return false;
        return includeAll || isTodayInZone(b.startTime, timezone);
      });

      // Geocode sequentially — Nominatim has a 1 req/s floor, and cache hits
      // dominate in steady state anyway.
      const jobs = [];
      for (const b of todays) {
        const address = pickAddress(b);
        let geo = null;
        if (address) {
          try { geo = await geocode(address); }
          catch (e) { console.warn("[geofence/jobs] geocode failed:", address, e.message); }
        }
        jobs.push({
          jobId: b.uid,
          uid: b.uid,
          title: b.title || "",
          customer: b.attendee || "",
          email: b.email || "",
          startTime: b.startTime,
          endTime: b.endTime,
          localTime: localTimeLabel(b.startTime, timezone),
          status: b.status,
          address: geo?.resolved || address,
          lat: geo?.lat ?? null,
          lng: geo?.lng ?? null,
          geocoded: !!geo,
        });
      }

      jobs.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

      return res.json({
        ok: true,
        tech: payload.username || process.env.CALCOM_USERNAME || null,
        timezone,
        date: dateKeyInZone(new Date(), timezone),
        count: jobs.length,
        geocoder: process.env.MAPBOX_TOKEN?.trim() ? "mapbox" : "nominatim",
        generatedAt: new Date().toISOString(),
        jobs,
      });
    } catch (err) {
      console.error("[/geofence/jobs] error:", err);
      return res.status(500).json({ ok: false, error: String(err) });
    }
  });
}
