// HTML job deck for field techs.
//
// Routes:
//   GET /jobs            — full-viewport horizontal swipe deck of today's jobs
//   GET /jobs/:uid       — same deck, auto-scrolled to the requested job
//
// Each card is 100vw x 100vh with scroll-snap, so on iOS you swipe
// left/right to move between jobs. Each card has:
//   - Mapbox static map (fallback: OSM tile) with a pin at the address
//   - Job title, time window, status chip
//   - Customer name + email/phone links
//   - Full address with "Open in Maps" deep link
//   - Check In / Check Out buttons that POST to /geofence
//   - Description/notes if present
//
// Auth: same GEOFENCE_TOKEN as /geofence endpoints. The page reads
// ?token=... from its own URL and forwards it on the check-in/out POST.
// Safe to bookmark on the home screen.

import { fetchTodaysJobs, requireGeofenceToken } from "./geofence.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s) { return escapeHtml(s); }

function mapboxStaticUrl(lat, lng, token, { width = 800, height = 480, zoom = 15 } = {}) {
  if (!token || lat == null || lng == null) return null;
  const marker = `pin-l+10b981(${lng},${lat})`;
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${marker}/${lng},${lat},${zoom},0/${width}x${height}@2x?access_token=${encodeURIComponent(token)}`;
}

function formatTimeRange(job) {
  const tz = job.timezone || "America/New_York";
  const fmt = (iso) => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true,
      }).format(new Date(iso));
    } catch { return ""; }
  };
  const s = fmt(job.startTime);
  const e = fmt(job.endTime);
  if (s && e) return `${s} – ${e}`;
  return s || e || "";
}

function formatDurationMins(startIso, endIso) {
  try {
    const ms = new Date(endIso) - new Date(startIso);
    if (!Number.isFinite(ms) || ms <= 0) return "";
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  } catch { return ""; }
}

function statusChip(status) {
  const s = String(status || "").toLowerCase();
  const color = s === "accepted" ? "#10b981"
              : s === "pending"  ? "#f59e0b"
              : s === "cancelled" ? "#ef4444"
              : "#64748b";
  return `<span class="chip" style="background:${color}">${escapeHtml(s || "unknown")}</span>`;
}

function renderCard(job, idx, total, timezone, mapboxToken) {
  const hasGeo = Number.isFinite(job.lat) && Number.isFinite(job.lng);
  const mapUrl = hasGeo ? mapboxStaticUrl(job.lat, job.lng, mapboxToken) : null;

  const addressEnc = encodeURIComponent(job.address || job.rawAddress || "");
  const appleMaps = job.address
    ? `https://maps.apple.com/?q=${addressEnc}${hasGeo ? `&ll=${job.lat},${job.lng}` : ""}`
    : null;
  const googleMaps = job.address
    ? `https://www.google.com/maps/search/?api=1&query=${addressEnc}`
    : null;

  const timeRange = formatTimeRange({ ...job, timezone });
  const duration = formatDurationMins(job.startTime, job.endTime);

  const phoneMatch = /(\+?\d[\d\s().-]{7,}\d)/.exec(job.description || "");
  const phone = phoneMatch ? phoneMatch[1].replace(/[^\d+]/g, "") : null;

  return `<section class="card" data-uid="${escapeAttr(job.uid)}" id="job-${escapeAttr(job.uid)}">
  <header class="card-head">
    <div class="pager">${idx + 1} / ${total}</div>
    <div class="time">${escapeHtml(timeRange)}${duration ? ` &middot; ${escapeHtml(duration)}` : ""}</div>
    <div class="status">${statusChip(job.status)}</div>
  </header>

  <div class="map-wrap">
    ${mapUrl
      ? `<img class="map" src="${escapeAttr(mapUrl)}" alt="Map of ${escapeAttr(job.address)}" loading="lazy" />`
      : `<div class="map map-fallback">${job.address ? "Map unavailable" : "No address on file"}</div>`}
    ${hasGeo ? `<a class="map-open" href="${escapeAttr(appleMaps)}" target="_blank" rel="noopener">Open in Maps</a>` : ""}
  </div>

  <div class="content">
    <h1 class="title">${escapeHtml(job.title || "Untitled job")}</h1>

    <div class="row address">
      <div class="label">Address</div>
      <div class="value">
        <span>${escapeHtml(job.address || "—")}</span>
        ${job.address ? `<div class="map-links">
          ${appleMaps ? `<a href="${escapeAttr(appleMaps)}" target="_blank" rel="noopener">Apple Maps</a>` : ""}
          ${googleMaps ? `<a href="${escapeAttr(googleMaps)}" target="_blank" rel="noopener">Google Maps</a>` : ""}
        </div>` : ""}
      </div>
    </div>

    <div class="row customer">
      <div class="label">Customer</div>
      <div class="value">
        <span>${escapeHtml(job.customer || "—")}</span>
        ${job.email ? `<a href="mailto:${escapeAttr(job.email)}">${escapeHtml(job.email)}</a>` : ""}
        ${phone ? `<a href="tel:${escapeAttr(phone)}">${escapeHtml(phone)}</a>` : ""}
      </div>
    </div>

    <div class="row schedule">
      <div class="label">Schedule</div>
      <div class="value">
        <span>${escapeHtml(timeRange || "—")}</span>
        <span class="muted">${escapeHtml(timezone)}</span>
      </div>
    </div>

    ${job.description ? `<div class="row notes">
      <div class="label">Notes</div>
      <div class="value"><pre>${escapeHtml(job.description)}</pre></div>
    </div>` : ""}

    <div class="row ids">
      <div class="label">Job ID</div>
      <div class="value"><code>${escapeHtml(job.uid)}</code></div>
    </div>
  </div>

  <footer class="actions">
    <button class="btn btn-in"  data-event="arrive" data-uid="${escapeAttr(job.uid)}">Check In</button>
    <button class="btn btn-out" data-event="leave"  data-uid="${escapeAttr(job.uid)}">Check Out</button>
  </footer>

  <div class="nav">
    <button class="nav-btn nav-prev" aria-label="Previous job">‹</button>
    <button class="nav-btn nav-next" aria-label="Next job">›</button>
  </div>
</section>`;
}

function renderPage({ data, token, focusUid }) {
  const mapboxToken = process.env.MAPBOX_TOKEN?.trim() || "";
  const jobs = data.jobs || [];
  const cards = jobs.map((j, i) => renderCard(j, i, jobs.length, data.timezone, mapboxToken)).join("\n");

  const empty = jobs.length === 0 ? `
    <section class="card empty">
      <div class="empty-wrap">
        <h1>No jobs today</h1>
        <p class="muted">${escapeHtml(data.date)} &middot; ${escapeHtml(data.timezone)}</p>
        <p>Enjoy the day off, or add <code>?all=1</code> to see upcoming bookings.</p>
      </div>
    </section>` : "";

  // Token is embedded so the fetch() calls below can attach it as a header.
  // The browser already has it (it came via the page URL) so there is no new
  // disclosure risk beyond the initial page load.
  const tokenJson = JSON.stringify(token || "");
  const focusJson = JSON.stringify(focusUid || "");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="theme-color" content="#0f172a" />
<title>Jobs &middot; ${escapeHtml(data.date)}</title>
<style>
  :root {
    --bg: #0b1020;
    --card: #111827;
    --card-2: #1f2937;
    --text: #f8fafc;
    --muted: #94a3b8;
    --accent: #10b981;
    --danger: #ef4444;
    --border: #1e293b;
    --safe-top: env(safe-area-inset-top);
    --safe-bot: env(safe-area-inset-bottom);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; background: var(--bg); color: var(--text);
    font: 16px/1.4 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    -webkit-text-size-adjust: 100%;
  }
  body { overflow: hidden; }
  .deck {
    display: flex;
    flex-direction: row;
    height: 100dvh;
    width: 100vw;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
    -webkit-overflow-scrolling: touch;
  }
  .deck::-webkit-scrollbar { display: none; }
  .card {
    flex: 0 0 100vw;
    width: 100vw;
    height: 100dvh;
    scroll-snap-align: center;
    scroll-snap-stop: always;
    display: grid;
    grid-template-rows: auto auto 1fr auto;
    padding: calc(var(--safe-top) + 12px) 16px calc(var(--safe-bot) + 12px);
    gap: 12px;
    position: relative;
    overflow: hidden;
  }
  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 13px;
    color: var(--muted);
  }
  .card-head .pager { font-variant-numeric: tabular-nums; letter-spacing: 0.5px; }
  .card-head .time { color: var(--text); font-weight: 600; }
  .chip {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: #0b1020;
    letter-spacing: 0.5px;
  }
  .map-wrap {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    background: var(--card-2);
    aspect-ratio: 16 / 10;
    max-height: 38vh;
  }
  .map { width: 100%; height: 100%; object-fit: cover; display: block; }
  .map-fallback {
    display: flex; align-items: center; justify-content: center;
    width: 100%; height: 100%;
    color: var(--muted); font-size: 14px;
  }
  .map-open {
    position: absolute;
    right: 10px; bottom: 10px;
    background: rgba(15, 23, 42, 0.9);
    color: #fff;
    padding: 8px 14px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    backdrop-filter: blur(6px);
  }
  .content {
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .content::-webkit-scrollbar { width: 0; }
  .title {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    line-height: 1.25;
  }
  .row {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 10px 12px;
    display: grid;
    grid-template-columns: 88px 1fr;
    gap: 10px;
    align-items: start;
  }
  .row .label {
    color: var(--muted);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    padding-top: 2px;
  }
  .row .value { display: flex; flex-direction: column; gap: 4px; word-break: break-word; }
  .row .value a {
    color: var(--accent);
    text-decoration: none;
    font-weight: 600;
    font-size: 14px;
  }
  .row .value pre {
    margin: 0;
    white-space: pre-wrap;
    font: inherit;
    color: var(--text);
  }
  .row .value code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
    font-size: 12px;
    color: var(--muted);
  }
  .muted { color: var(--muted); font-size: 13px; }
  .map-links { display: flex; gap: 12px; margin-top: 2px; }
  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .btn {
    appearance: none;
    border: 0;
    border-radius: 14px;
    padding: 16px 12px;
    font-size: 17px;
    font-weight: 700;
    color: #fff;
    cursor: pointer;
    touch-action: manipulation;
    transition: transform 0.1s ease, opacity 0.2s ease;
  }
  .btn:active { transform: scale(0.97); }
  .btn[disabled] { opacity: 0.5; }
  .btn-in  { background: var(--accent); }
  .btn-out { background: var(--danger); }
  .btn.ok   { background: #0ea5e9; }
  .btn.err  { background: #9a3412; }

  .nav {
    position: absolute;
    inset: 0;
    pointer-events: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 4px;
  }
  .nav-btn {
    pointer-events: auto;
    width: 36px; height: 60px;
    background: rgba(15, 23, 42, 0.4);
    color: #fff;
    border: 0;
    border-radius: 10px;
    font-size: 24px;
    opacity: 0;
    transition: opacity 0.2s ease;
    cursor: pointer;
  }
  @media (hover: hover) and (pointer: fine) {
    .card:hover .nav-btn { opacity: 1; }
  }

  .empty .empty-wrap {
    grid-row: 1 / -1;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center;
    padding: 40px;
  }

  /* Toast */
  .toast {
    position: fixed;
    left: 50%;
    bottom: calc(var(--safe-bot) + 24px);
    transform: translate(-50%, 24px);
    background: var(--card-2);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 12px 16px;
    font-size: 14px;
    opacity: 0;
    pointer-events: none;
    transition: transform 0.25s ease, opacity 0.25s ease;
    z-index: 20;
    max-width: 80vw;
  }
  .toast.show {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  .toast.ok  { border-color: var(--accent); }
  .toast.err { border-color: var(--danger); }
</style>
</head>
<body>
  <main class="deck" id="deck">
    ${cards || empty}
  </main>

  <div class="toast" id="toast" role="status" aria-live="polite"></div>

<script>
(() => {
  const TOKEN = ${tokenJson};
  const FOCUS_UID = ${focusJson};
  const deck = document.getElementById("deck");
  const toast = document.getElementById("toast");
  let toastTimer = null;

  function showToast(msg, kind = "") {
    toast.textContent = msg;
    toast.className = "toast show " + (kind || "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.className = "toast"; }, 3200);
  }

  // Deep-link: scroll the requested job into view on load.
  if (FOCUS_UID) {
    const target = document.getElementById("job-" + CSS.escape(FOCUS_UID));
    if (target) {
      // Use instant scroll on initial load so we don't animate from card 0.
      const prev = deck.style.scrollBehavior;
      deck.style.scrollBehavior = "auto";
      target.scrollIntoView({ inline: "start", block: "nearest" });
      requestAnimationFrame(() => { deck.style.scrollBehavior = prev || "smooth"; });
    }
  }

  // Prev/next buttons.
  deck.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const card = target.closest(".card");
    if (!card) return;
    if (target.classList.contains("nav-prev")) {
      const prev = card.previousElementSibling;
      if (prev) prev.scrollIntoView({ inline: "start", block: "nearest" });
    } else if (target.classList.contains("nav-next")) {
      const next = card.nextElementSibling;
      if (next) next.scrollIntoView({ inline: "start", block: "nearest" });
    }
  });

  // Keyboard navigation (for desktop testing).
  document.addEventListener("keydown", (e) => {
    const current = [...deck.children].find((c) => {
      const r = c.getBoundingClientRect();
      return r.left >= -5 && r.left < window.innerWidth / 2;
    }) || deck.firstElementChild;
    if (!current) return;
    if (e.key === "ArrowRight") current.nextElementSibling?.scrollIntoView({ inline: "start" });
    if (e.key === "ArrowLeft")  current.previousElementSibling?.scrollIntoView({ inline: "start" });
  });

  // Check In / Check Out.
  async function postEvent(uid, event, btn) {
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = event === "arrive" ? "Checking in…" : "Checking out…";

    try {
      const r = await fetch("/geofence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(TOKEN ? { "X-Geofence-Token": TOKEN } : {}),
        },
        body: JSON.stringify({ jobId: uid, event }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.ok) {
        btn.classList.add("ok");
        showToast(event === "arrive" ? "Checked in ✓" : "Checked out ✓", "ok");
      } else {
        btn.classList.add("err");
        const msg = data.error || data.stderr || ("HTTP " + r.status);
        showToast("Failed: " + msg, "err");
      }
    } catch (err) {
      btn.classList.add("err");
      showToast("Network error: " + err.message, "err");
    } finally {
      btn.disabled = false;
      btn.textContent = label;
      setTimeout(() => btn.classList.remove("ok", "err"), 2500);
    }
  }

  deck.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn");
    if (!btn) return;
    const uid = btn.dataset.uid;
    const event = btn.dataset.event;
    if (!uid || !event) return;
    postEvent(uid, event, btn);
  });
})();
</script>
</body>
</html>`;
}

export function registerJobsPageRoutes(app, { workspaceDir }) {
  if (!workspaceDir) {
    throw new Error("registerJobsPageRoutes: workspaceDir is required");
  }

  async function handler(req, res) {
    try {
      const includeAll = req.query?.all === "1" || req.query?.all === "true";
      const data = await fetchTodaysJobs({ workspaceDir, includeAll });
      const focusUid = req.params?.uid || "";
      const token = String(req.query?.token || "").trim();
      const html = renderPage({ data, token, focusUid });
      res.type("html").send(html);
    } catch (err) {
      console.error("[/jobs] error:", err);
      const msg = err?.code === "BOOKING_API_MISSING"
        ? "Booking API script not found on the Railway volume."
        : String(err?.message || err);
      res.status(500).type("html").send(`<!doctype html>
<html><body style="font:16px system-ui;margin:40px;background:#0b1020;color:#f8fafc">
  <h1>Jobs unavailable</h1>
  <p>${escapeHtml(msg)}</p>
</body></html>`);
    }
  }

  // Both list and single-job deep link share the same renderer.
  app.get("/jobs", requireGeofenceToken, handler);
  app.get("/jobs/:uid", requireGeofenceToken, handler);
}
