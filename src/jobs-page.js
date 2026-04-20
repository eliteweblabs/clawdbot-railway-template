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
  // Brand leaf-green pin.
  const marker = `pin-l+22c55e(${lng},${lat})`;
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
  <header class="brand">
    <img class="brand-logo" src="https://cdn.hibuwebsites.com/90acb87a8af043869bc67e07bbc4d3a7/dms3rep/multi/green-planet-pest-control-logo.png" alt="Green Planet Pest Control" />
    <div class="brand-meta">
      <div class="pager">${idx + 1} / ${total}</div>
      ${statusChip(job.status)}
    </div>
  </header>

  <div class="card-head">
    <div class="time">${escapeHtml(timeRange)}${duration ? ` &middot; ${escapeHtml(duration)}` : ""}</div>
  </div>

  ${hasGeo ? `<div class="drivetime" data-lat="${escapeAttr(String(job.lat))}" data-lng="${escapeAttr(String(job.lng))}" data-state="idle" role="button" tabindex="0">
    <span class="drivetime-icon" aria-hidden="true"></span>
    <span class="drivetime-value">&mdash;</span>
    <span class="drivetime-label">drive time</span>
  </div>` : `<div class="drivetime drivetime-disabled" data-state="none">
    <span class="drivetime-icon" aria-hidden="true"></span>
    <span class="drivetime-label">no coordinates</span>
  </div>`}

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
    <a class="dispatch" href="tel:+16175351943" aria-label="Call dispatch">
      <span class="dispatch-label">Dispatch</span>
      <span class="dispatch-phone">(617) 535-1943</span>
    </a>
  </footer>

  <div class="nav">
    <button class="nav-btn nav-prev" aria-label="Previous job">&#8249;</button>
    <button class="nav-btn nav-next" aria-label="Next job">&#8250;</button>
  </div>
</section>`;
}

function renderPage({ data, token, focusUid }) {
  const mapboxToken = process.env.MAPBOX_TOKEN?.trim() || "";
  const jobs = data.jobs || [];
  const cards = jobs.map((j, i) => renderCard(j, i, jobs.length, data.timezone, mapboxToken)).join("\n");

  const empty = jobs.length === 0 ? `
    <section class="card empty">
      <header class="brand">
        <img class="brand-logo" src="https://cdn.hibuwebsites.com/90acb87a8af043869bc67e07bbc4d3a7/dms3rep/multi/green-planet-pest-control-logo.png" alt="Green Planet Pest Control" />
        <div class="brand-meta"><div class="pager">0 / 0</div></div>
      </header>
      <div class="empty-wrap">
        <h1>No jobs today</h1>
        <p class="muted">${escapeHtml(data.date)} &middot; ${escapeHtml(data.timezone)}</p>
        <p class="muted">Enjoy the day off, or add <code>?all=1</code> to see upcoming bookings.</p>
        <a class="dispatch" href="tel:+16175351943" style="margin-top:24px">
          <span class="dispatch-label">Dispatch</span>
          <span class="dispatch-phone">(617) 535-1943</span>
        </a>
      </div>
    </section>` : "";

  // Token is embedded so the fetch() calls below can attach it as a header.
  // The browser already has it (it came via the page URL) so there is no new
  // disclosure risk beyond the initial page load.
  const tokenJson = JSON.stringify(token || "");
  const focusJson = JSON.stringify(focusUid || "");
  // Mapbox public (pk.*) token — already exposed in the static map image URLs,
  // so adding it as a JS constant is not a new disclosure. Required client-side
  // so we can call the Directions Matrix API with the user's geolocation.
  const mapboxTokenJson = JSON.stringify(
    /^pk\./.test(mapboxToken) ? mapboxToken : ""
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="theme-color" content="#0a2730" />
<link rel="icon" type="image/png" href="https://cdn.hibuwebsites.com/90acb87a8af043869bc67e07bbc4d3a7/dms3rep/multi/green-planet-pest-control-logo.png" />
<link rel="apple-touch-icon" href="https://cdn.hibuwebsites.com/90acb87a8af043869bc67e07bbc4d3a7/dms3rep/multi/green-planet-pest-control-logo.png" />
<title>Green Planet Pest &middot; Jobs &middot; ${escapeHtml(data.date)}</title>
<style>
  /* Green Planet Pest brand palette — pulled from greenplanetpest.com */
  :root {
    --bg:        #0a2730;  /* darker than brand deep teal, for contrast */
    --card:      #11414b;  /* brand deep teal (from site CSS) */
    --card-2:    #17586a;  /* one step lighter */
    --text:      #f8fafc;
    --muted:     #9fc5ce;  /* muted teal-grey, readable on dark */
    --accent:    #22c55e;  /* leaf green — "Green Planet" + check-in */
    --accent-2:  #68ccd1;  /* brand light teal (from site CSS) */
    --danger:    #ef4444;
    --border:    #1c4b55;
    --safe-top:  env(safe-area-inset-top);
    --safe-bot:  env(safe-area-inset-bottom);
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
    grid-template-rows: auto auto auto auto 1fr auto;
    padding: calc(var(--safe-top) + 10px) 16px calc(var(--safe-bot) + 12px);
    gap: 10px;
    position: relative;
    overflow: hidden;
  }

  /* Brand strip — persistent header on every card. */
  .brand {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    background: linear-gradient(180deg, rgba(17, 65, 75, 0.6), rgba(17, 65, 75, 0.2));
    border: 1px solid var(--border);
    border-radius: 12px;
  }
  .brand-logo {
    height: 32px;
    width: auto;
    max-width: 60vw;
    object-fit: contain;
    display: block;
  }
  .brand-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--muted);
    grid-column: 3;
  }
  .brand-meta .pager {
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.5px;
  }

  .card-head {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 8px;
    font-size: 13px;
    color: var(--muted);
    padding: 0 4px;
  }
  .card-head .time { color: var(--text); font-weight: 600; font-size: 14px; }

  /* Drive-time chip — Mapbox Matrix API from navigator.geolocation. */
  .drivetime {
    display: inline-flex;
    align-items: center;
    justify-self: start;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 999px;
    background: rgba(34, 197, 94, 0.12);
    border: 1px solid rgba(34, 197, 94, 0.35);
    color: var(--text);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.2px;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s ease, transform 0.1s ease;
  }
  .drivetime:active { transform: scale(0.97); }
  .drivetime-icon {
    width: 16px; height: 16px;
    background: var(--accent);
    -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M5 11l1.5-4.5A2 2 0 018.4 5h7.2a2 2 0 011.9 1.5L19 11m-14 0h14m-14 0v5a1 1 0 001 1h1a1 1 0 001-1v-1h8v1a1 1 0 001 1h1a1 1 0 001-1v-5M7 14h.01M17 14h.01'  fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/></svg>") no-repeat center / contain;
            mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M5 11l1.5-4.5A2 2 0 018.4 5h7.2a2 2 0 011.9 1.5L19 11m-14 0h14m-14 0v5a1 1 0 001 1h1a1 1 0 001-1v-1h8v1a1 1 0 001 1h1a1 1 0 001-1v-5M7 14h.01M17 14h.01' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/></svg>") no-repeat center / contain;
    flex: 0 0 auto;
  }
  .drivetime-value {
    color: var(--accent);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .drivetime-label {
    color: var(--muted);
    font-weight: 500;
    font-size: 13px;
  }
  .drivetime[data-state="loading"] .drivetime-value { color: var(--muted); }
  .drivetime[data-state="denied"] {
    background: rgba(104, 204, 209, 0.08);
    border-color: var(--border);
  }
  .drivetime[data-state="denied"] .drivetime-value { color: var(--accent-2); }
  .drivetime[data-state="error"] {
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.3);
  }
  .drivetime-disabled {
    opacity: 0.5;
    cursor: default;
    background: rgba(148, 188, 197, 0.06);
    border-color: var(--border);
  }
  .drivetime-disabled:active { transform: none; }
  .drivetime-disabled .drivetime-icon { background: var(--muted); }
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
    color: var(--accent-2);
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
    grid-template-rows: auto auto;
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
  .btn-in  { background: var(--accent); color: #052e16; }
  .btn-out { background: var(--danger); }
  .btn.ok   { background: var(--accent-2); color: #052e16; }
  .btn.err  { background: #9a3412; }

  .dispatch {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 16px 12px;
    border: 0;
    border-radius: 14px;
    background: var(--accent-2);
    color: #052e16;
    text-decoration: none;
    font-size: 17px;
    font-weight: 700;
    cursor: pointer;
    touch-action: manipulation;
    transition: transform 0.1s ease, opacity 0.2s ease;
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.1) inset;
  }
  .dispatch:active { transform: scale(0.97); }
  .dispatch::before {
    content: "";
    width: 18px; height: 18px;
    background: currentColor;
    -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'><path d='M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.4 11.4 0 00.57 3.6 1 1 0 01-.25 1l-2.2 2.2z'/></svg>") no-repeat center / contain;
            mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor'><path d='M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.4 11.4 0 00.57 3.6 1 1 0 01-.25 1l-2.2 2.2z'/></svg>") no-repeat center / contain;
  }
  .dispatch-label {
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-size: 12px;
    font-weight: 800;
    opacity: 0.75;
  }
  .dispatch-phone {
    font-weight: 800;
    letter-spacing: 0.3px;
    font-variant-numeric: tabular-nums;
  }

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
  const MAPBOX_TOKEN = ${mapboxTokenJson};
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

  // ---- Drive times via Mapbox Directions Matrix API --------------------
  //
  // One request computes driving duration from the device's geolocation to
  // every job on the page. Chips start as "Drive time — tap to enable",
  // then switch to "12 min · drive from you" (or an error state).
  // ----------------------------------------------------------------------
  function setChip(chip, state, value, label) {
    chip.dataset.state = state;
    const v = chip.querySelector(".drivetime-value");
    const l = chip.querySelector(".drivetime-label");
    if (v) v.textContent = value;
    if (l) l.textContent = label;
  }

  async function loadDriveTimes({ fromClick = false } = {}) {
    if (!MAPBOX_TOKEN) return;
    const chips = [...document.querySelectorAll(".drivetime[data-lat][data-lng]")];
    if (chips.length === 0) return;

    if (!("geolocation" in navigator)) {
      chips.forEach((c) => setChip(c, "error", "—", "no geolocation"));
      return;
    }

    chips.forEach((c) => setChip(c, "loading", "…", "locating"));

    let origin;
    try {
      origin = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
          (err) => reject(err),
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60_000 }
        );
      });
    } catch (err) {
      const denied = err && err.code === 1;
      chips.forEach((c) =>
        setChip(c, "denied", "GPS", denied ? "tap to enable" : "tap to retry")
      );
      if (fromClick) {
        showToast(denied ? "Location permission denied" : "Couldn't get location", "err");
      }
      return;
    }

    // Matrix API supports up to 25 coordinates on the free plan. We have
    // at most a handful of jobs per day, but split into chunks just in case.
    async function queryChunk(destChips) {
      const coords = [
        origin.map((n) => n.toFixed(6)).join(","),
        ...destChips.map((c) => \`\${Number(c.dataset.lng).toFixed(6)},\${Number(c.dataset.lat).toFixed(6)}\`),
      ].join(";");
      const url =
        "https://api.mapbox.com/directions-matrix/v1/mapbox/driving/" +
        coords +
        "?sources=0&annotations=duration&access_token=" +
        encodeURIComponent(MAPBOX_TOKEN);
      const r = await fetch(url);
      if (!r.ok) throw new Error("matrix " + r.status);
      const data = await r.json();
      return data.durations && data.durations[0] ? data.durations[0] : [];
    }

    try {
      const CHUNK = 24; // 1 origin + 24 destinations = 25 coords
      for (let i = 0; i < chips.length; i += CHUNK) {
        const slice = chips.slice(i, i + CHUNK);
        const durations = await queryChunk(slice);
        slice.forEach((chip, idx) => {
          const sec = durations[idx + 1];
          if (sec == null || !Number.isFinite(sec)) {
            setChip(chip, "error", "—", "no route");
          } else {
            const mins = Math.max(1, Math.round(sec / 60));
            const label = mins < 60
              ? mins + " min"
              : Math.floor(mins / 60) + "h " + (mins % 60) + "m";
            setChip(chip, "ok", label, "drive from you");
          }
        });
      }
    } catch (err) {
      chips.forEach((c) => setChip(c, "error", "—", "route failed"));
    }
  }

  // Allow a tap on a denied/error chip to retry.
  deck.addEventListener("click", (e) => {
    const chip = e.target.closest(".drivetime[data-lat][data-lng]");
    if (!chip) return;
    const state = chip.dataset.state;
    if (state === "denied" || state === "error" || state === "idle") {
      loadDriveTimes({ fromClick: true });
    }
  });

  // Kick off once on load; browsers will prompt for permission.
  loadDriveTimes();
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
