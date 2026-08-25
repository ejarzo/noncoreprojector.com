/* Ephemeris — particles.js driven by live data.
 *
 * Points are not random: each one is placed by a real event. The field builds
 * to a randomly chosen density, holds, collapses, and begins again — so the
 * piece breathes rather than sitting at a constant fill.
 *
 * Feeds (both keyless, both CORS-open, so this works from static hosting):
 *   USGS earthquakes  — real lat/lon, a few per hour, the "meaningful" layer
 *   Wikipedia edits   — hundreds/sec, sampled down, the texture layer
 *
 * If both feeds are unreachable the field falls back to random placement, so
 * the page is never dead.
 */

var CFG = {
  capMin: 160,            // each cycle picks a density target in this range
  capMax: 420,
  holdMs: 1600,           // sit at full density before collapsing
  collapsePerFrame: 6,    // particles removed per frame while collapsing
  drainMs: 40,            // how often a queued event becomes a point
  wikiThrottleMs: 50,     // sample rate off the firehose
  drainPerTick: 2,        // points placed per drain tick
  streamRecycleMs: 90000, // reopen the stream this often (see startWikipedia)
  idleGapMs: 120,         // max gap between placements before we synthesise one
  quakePollMs: 60000,
  queueMax: 400,
  labelChance: 0.3,       // fraction of texture points that get a label
  labelHoldMs: 2600,
  maxLabels: 10,
  minLabelGapMs: 260      // don't stack labels faster than this
};

var FIELD = null;
var queue = [];
var state = "filling";
var cap = 0;
var lastEventAt = Date.now();
var lastPlacedAt = 0;
var lastLabelAt = 0;
var seenQuakes = {};

/* ---------- helpers ---------- */

function rnd(min, max) { return min + Math.random() * (max - min); }

// Stable string -> 0..1, so the same article always lands in the same place.
function hash01(str) {
  var h = 2166136261;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return (h >>> 0) / 4294967295;
}

function canvasSize() {
  return { w: FIELD.canvas.w, h: FIELD.canvas.h, r: FIELD.canvas.pxratio || 1 };
}

// Equirectangular: the point lands where the thing actually happened.
function geoToXY(lat, lon) {
  var c = canvasSize();
  return {
    x: ((lon + 180) / 360) * c.w,
    y: ((90 - lat) / 180) * c.h
  };
}

function enqueue(ev) {
  lastEventAt = Date.now();
  queue.push(ev);
  if (queue.length > CFG.queueMax) queue.splice(0, queue.length - CFG.queueMax);
}

/* ---------- placing points ---------- */

function place(ev) {
  lastPlacedAt = Date.now();
  var color = { value: ev.kind === "quake" ? "#ffd9a0" : "#ffffff" };
  var opacity = ev.kind === "quake" ? 0.95 : rnd(0.25, 0.6);
  var p = new FIELD.fn.particle(color, opacity, { x: ev.x, y: ev.y });

  if (ev.radius) p.radius = ev.radius * (FIELD.canvas.pxratio || 1);
  FIELD.particles.array.push(p);

  if (ev.label) label(ev.label, p.x, p.y, ev.kind);
}

function label(text, x, y, kind) {
  var host = document.getElementById("sparks");
  if (!host || host.childElementCount >= CFG.maxLabels) return;
  if (Date.now() - lastLabelAt < CFG.minLabelGapMs) return;
  lastLabelAt = Date.now();

  var r = FIELD.canvas.pxratio || 1;
  var el = document.createElement("div");
  el.className = "spark" + (kind === "quake" ? " quake" : "");
  el.textContent = text.length > 64 ? text.slice(0, 63) + "…" : text;
  el.style.left = (x / r) + "px";
  el.style.top = (y / r) + "px";
  host.appendChild(el);

  requestAnimationFrame(function () { el.classList.add("on"); });
  setTimeout(function () {
    el.classList.remove("on");
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 800);
  }, CFG.labelHoldMs + Math.random() * 900);
}

function clearLabels() {
  var host = document.getElementById("sparks");
  if (!host) return;
  Array.prototype.forEach.call(host.children, function (el) { el.classList.remove("on"); });
}

/* ---------- the cycle: fill -> hold -> collapse -> repeat ---------- */

function newCycle() {
  cap = Math.round(rnd(CFG.capMin, CFG.capMax));
  state = "filling";
  readout();
}

function readout() {
  var el = document.getElementById("readout");
  if (el) el.textContent = state + " · " + FIELD.particles.array.length + "/" + cap;
}

function tick() {
  if (!FIELD) return;
  var arr = FIELD.particles.array;

  if (state === "filling") {
    if (queue.length) {
      for (var d = 0; d < CFG.drainPerTick && queue.length; d++) place(queue.shift());
    } else if (Date.now() - lastPlacedAt > CFG.idleGapMs) {
      // Queue dry — the feed is slow, blocked, or offline. Fall back to the
      // original random fill so density never depends on feed health.
      var c = canvasSize();
      place({ x: Math.random() * c.w, y: Math.random() * c.h, kind: "idle" });
    }
    if (arr.length >= cap) {
      state = "holding";
      setTimeout(function () { if (state === "holding") { state = "collapsing"; clearLabels(); } }, CFG.holdMs);
    }
  } else if (state === "collapsing") {
    arr.splice(0, CFG.collapsePerFrame);   // splice(0,n) removes oldest first
    if (arr.length === 0) newCycle();
  }
  readout();
}

/* ---------- feeds ---------- */

function startQuakes() {
  var URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson";

  function poll(first) {
    fetch(URL)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        (data.features || []).forEach(function (f) {
          if (seenQuakes[f.id]) return;
          seenQuakes[f.id] = 1;
          var c = f.geometry && f.geometry.coordinates;
          if (!c) return;
          var mag = (f.properties && f.properties.mag) || 1;
          var pos = geoToXY(c[1], c[0]);
          enqueue({
            x: pos.x,
            y: pos.y,
            kind: "quake",
            radius: Math.max(2, Math.min(9, mag * 1.6)),
            label: f.properties && f.properties.place
          });
        });
      })
      .catch(function () { /* offline or blocked — fallback handles it */ });
  }

  poll(true);
  setInterval(poll, CFG.quakePollMs);
}

function startWikipedia() {
  var URL = "https://stream.wikimedia.org/v2/stream/recentchange";
  var es = null;
  var last = 0;
  var rawSinceCheck = 0;
  var opens = 0;

  function handler(msg) {
    rawSinceCheck++;                                  // count BEFORE throttling

    var now = Date.now();
    if (now - last < CFG.wikiThrottleMs) return;

    var d;
    try { d = JSON.parse(msg.data); } catch (e) { return; }
    if (!d || d.bot || !d.title) return;

    last = now;   // only consume a throttle slot on a usable event

    var c = canvasSize();
    enqueue({
      // Two independently-seeded hashes of the title. Stable per article (repeat
      // edits still land in the same spot) but spread over the whole plane.
      // NOT server_name for y: the firehose is overwhelmingly wikidata/commons,
      // so that hash is near-constant and collapsed the field into one line.
      x: hash01("x:" + d.title) * c.w,
      y: hash01("y:" + d.title) * c.h,
      kind: "edit",
      label: Math.random() < CFG.labelChance ? d.title : null
    });
  }

  function open() {
    if (es) { try { es.close(); } catch (e) {} }
    try { es = new EventSource(URL); opens++; } catch (e) { return; }
    es.onmessage = handler;
    es.onerror = function () { /* browser retries; the health check recycles if it can't */ };
  }

  open();

  /* dev diagnostics — inspect from the console with __cxDebug() */
  window.__cxDebug = function () {
    return { readyState: es ? es.readyState : -1, rawSinceCheck: rawSinceCheck,
             opens: opens, throttleMs: CFG.wikiThrottleMs, queue: queue.length };
  };

  /* Wikimedia's long-lived SSE connections lose throughput badly: a fresh one
     measured 17-30 events/sec while one a couple of minutes old delivered ~2.4/sec,
     same page, same moment. Nothing errors — the rate just decays, and readyState
     flaps to CONNECTING. So just reopen periodically rather than trying to detect
     it; a reconnect is cheap and the stream is stateless for our purposes. */
  setInterval(function () { open(); rawSinceCheck = 0; }, CFG.streamRecycleMs);
}

/* ---------- boot ---------- */

function boot() {
  particlesJS("particles-js", {
    particles: {
      // start empty and build; we manage the count ourselves
      number: { value: 0, density: { enable: false } },
      color: { value: "#ffffff" },
      shape: { type: "circle", stroke: { width: 0, color: "#000000" } },
      opacity: { value: 0.5, random: true, anim: { enable: false } },
      size: { value: 3, random: true, anim: { enable: false } },
      line_linked: { enable: true, distance: 150, color: "#ffffff", opacity: 0.4, width: 1 },
      // slow drift keeps points near where the data put them
      move: { enable: true, speed: 0.6, direction: "none", random: false,
              straight: false, out_mode: "out", bounce: false,
              attract: { enable: false } }
    },
    interactivity: {
      detect_on: "canvas",
      events: { onhover: { enable: false }, onclick: { enable: false }, resize: true }
    },
    retina_detect: true
  });

  FIELD = window.pJSDom[0].pJS;
  newCycle();
  setInterval(tick, CFG.drainMs);
  startQuakes();
  startWikipedia();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
