// Amplite for Stream Deck — "Now Playing" on the Stream Deck + touch strip (and on keys).
// Reads what Amplite is playing from its local API (http://127.0.0.1:43821/api/now) and sends
// play/pause, next, volume and seek back to it. Nothing leaves this PC.
import streamDeck, { SingletonAction } from '@elgato/streamdeck';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const API = 'http://127.0.0.1:43821/api';
const UUID = 'com.larosa023.amplite.nowplaying';

/* ---------------- talking to Amplite ---------------- */
let state = null;          // last /api/now answer, or null when Amplite isn't running
let fetchedAt = 0;         // when `state` arrived (for a smooth progress bar between polls)
let pollT = null, inFlight = false;

async function poll() {
  if (inFlight) return;
  inFlight = true;
  try {
    const r = await fetch(API + '/now', { signal: AbortSignal.timeout(1500) });
    state = r.ok ? await r.json() : { ok: false, old: r.status === 404 };
  } catch { state = null; }
  inFlight = false;
  fetchedAt = Date.now();
  if (state?.track?.image) loadArt(state.track.image);
  renderAll();
}
function startPolling() { if (!pollT) { poll(); pollT = setInterval(poll, 1000); } }
function stopPolling() { clearInterval(pollT); pollT = null; }

async function command(cmd) {
  try {
    await fetch(API + '/cmd', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Amplite': '1' }, body: JSON.stringify({ cmd }), signal: AbortSignal.timeout(1500) });
  } catch { /* Amplite closed */ }
  setTimeout(poll, 250);
}

// Start Amplite if it isn't running (default per-user install locations).
function launchAmplite() {
  const local = process.env.LOCALAPPDATA || '';
  const exe = [path.join(local, 'Programs', 'amplite', 'Amplite.exe'), path.join(local, 'Programs', 'Amplite', 'Amplite.exe')].find(existsSync);
  if (!exe) return false;
  try { spawn(exe, [], { detached: true, stdio: 'ignore' }).unref(); return true; } catch { return false; }
}

/* ---------------- album art (fetched once, kept as data URLs) ---------------- */
const art = new Map(); // url -> data URL
const artLoading = new Set();
async function loadArt(url) {
  if (art.has(url) || artLoading.has(url)) return;
  artLoading.add(url);
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const type = r.headers.get('content-type') || 'image/jpeg';
    const b64 = Buffer.from(await r.arrayBuffer()).toString('base64');
    art.set(url, `data:${type};base64,${b64}`);
    while (art.size > 12) art.delete(art.keys().next().value);
    renderAll();
  } catch { /* offline: keep the placeholder */ }
  artLoading.delete(url);
}

/* ---------------- drawing ---------------- */
const fmt = ms => { const s = Math.max(0, Math.floor((ms || 0) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const livePosition = () => {
  if (!state?.track) return 0;
  const p = state.position + (state.paused ? 0 : Date.now() - fetchedAt);
  return Math.min(p, state.track.duration || p);
};
const plainTitle = value => ({ value, font: { size: 16, weight: 600 }, 'text-overflow': 'ellipsis' });
const PLACEHOLDER = 'imgs/layout/placeholder.png';
const flash = new Map(); // context -> { text, value, until } (volume shown briefly while turning)

function feedbackFor(ctx, settings) {
  const fill = settings.barColor === 'accent' && state?.accent ? state.accent : '#ffffff';
  if (!state?.ok || !state.track) marq.delete(ctx);
  if (!state) return { art: PLACEHOLDER, paused: { enabled: false }, title: plainTitle('Amplite'), artist: 'Not running · press to open', bar: { value: 0, bar_fill_c: fill }, elapsed: '', total: '' };
  if (!state.ok) return { art: PLACEHOLDER, paused: { enabled: false }, title: plainTitle('Update Amplite'), artist: 'Needs Amplite 1.11 or newer', bar: { value: 0, bar_fill_c: fill }, elapsed: '', total: '' };
  const t = state.track;
  if (!t) return { art: PLACEHOLDER, paused: { enabled: false }, title: plainTitle('Nothing playing'), artist: 'Press to play', bar: { value: 0, bar_fill_c: fill }, elapsed: '', total: '' };
  const p = livePosition(), d = t.duration || 0;
  const f = flash.get(ctx);
  const showFlash = f && Date.now() < f.until;
  return {
    art: art.get(t.image) || PLACEHOLDER,
    paused: { enabled: !!state.paused },
    title: titleItem(ctx, t.title || 'Unknown', settings.scroll !== false),
    artist: showFlash ? f.text : (t.artist || ''),
    bar: { value: showFlash ? f.value : d ? Math.round((p / d) * 1000) : 0, bar_fill_c: fill },
    elapsed: fmt(p),
    total: d ? fmt(d) : '',
  };
}

// Long song names: slightly smaller text first; past that, scroll slowly (pausing at the start).
const marq = new Map(); // context -> { text, off, hold }
let marqT = null;
function titleItem(ctx, title, scroll) {
  const n = title.length;
  if (n <= 15 || !scroll) {
    marq.delete(ctx);
    return { value: title, font: { size: n <= 12 ? 16 : n <= 14 ? 14 : 13, weight: 600 }, 'text-overflow': 'ellipsis' };
  }
  let m = marq.get(ctx);
  if (!m || m.text !== title) { m = { text: title, off: 0, hold: Date.now() + 2500 }; marq.set(ctx, m); }
  if (!marqT) marqT = setInterval(stepMarquee, 300);
  const loop = title + '     ·     ';
  return { value: (loop + loop).slice(m.off, m.off + 18), font: { size: 13, weight: 600 }, 'text-overflow': 'clip' };
}
function stepMarquee() {
  if (!marq.size) { clearInterval(marqT); marqT = null; return; }
  const now = Date.now();
  for (const m of marq.values()) {
    if (now < m.hold) continue;
    m.off = (m.off + 1) % (m.text.length + 11);
    if (m.off === 0) m.hold = now + 2500; // back at the start: pause again
  }
  renderAll();
}

// Only send what changed: the touch strip is redrawn per item.
const last = new Map(); // context -> { key: json }
function sendFeedback(action, fb) {
  const prev = last.get(action.id) || {}, out = {};
  for (const [k, v] of Object.entries(fb)) { const j = JSON.stringify(v); if (prev[k] !== j) { out[k] = v; prev[k] = j; } }
  last.set(action.id, prev);
  if (Object.keys(out).length) action.setFeedback(out).catch(() => {});
}
const lastKeyImage = new Map();
function renderAll() {
  for (const a of nowPlaying.actions) {
    const settings = nowPlaying.settings.get(a.id) || {};
    if (a.isDial()) sendFeedback(a, feedbackFor(a.id, settings));
    else if (a.isKey()) {
      // Keys: the album cover (Amplite's logo when there's none).
      const img = (state?.track && art.get(state.track.image)) || undefined; // undefined = the plugin's default key image
      if (lastKeyImage.get(a.id) !== img) { lastKeyImage.set(a.id, img); a.setImage(img).catch(() => {}); }
    }
  }
}

/* ---------------- the action ---------------- */
class NowPlaying extends SingletonAction {
  manifestId = UUID;
  settings = new Map();
  holdT = new Map();
  turn = new Map(); // context -> { ticks, t } (skip mode: one song per notch, not per tick burst)

  onWillAppear(ev) {
    this.settings.set(ev.action.id, ev.payload.settings || {});
    last.delete(ev.action.id); lastKeyImage.delete(ev.action.id);
    startPolling(); renderAll();
  }
  onWillDisappear(ev) {
    this.settings.delete(ev.action.id); last.delete(ev.action.id); lastKeyImage.delete(ev.action.id); marq.delete(ev.action.id);
    // Wait a tick: the action is still counted while it's leaving.
    setTimeout(() => { if (![...this.actions].length) stopPolling(); }, 0);
  }
  onDidReceiveSettings(ev) { this.settings.set(ev.action.id, ev.payload.settings || {}); last.delete(ev.action.id); renderAll(); }

  // Press = play/pause; hold for half a second = next song. Opens Amplite if it isn't running.
  press(id) {
    if (!state) { launchAmplite(); return; }
    this.holdT.set(id, setTimeout(() => { this.holdT.delete(id); command('next'); }, 500));
  }
  release(id) {
    if (!state) return;
    const t = this.holdT.get(id);
    if (t) { clearTimeout(t); this.holdT.delete(id); command('toggle'); }
  }
  onKeyDown(ev) { this.press(ev.action.id); }
  onKeyUp(ev) { this.release(ev.action.id); }
  onDialDown(ev) { this.press(ev.action.id); }
  onDialUp(ev) { this.release(ev.action.id); }
  // Touch strip: tap = play/pause, long touch = next song.
  onTouchTap(ev) {
    if (!state) { launchAmplite(); return; }
    command(ev.payload.hold ? 'next' : 'toggle');
  }

  onDialRotate(ev) {
    if (!state?.ok) return;
    const s = this.settings.get(ev.action.id) || {}, ticks = ev.payload.ticks, mode = s.dial || 'volume';
    if (mode === 'seek') {
      command(`seek:${ticks > 0 ? '+' : '-'}${Math.abs(ticks) * 5000}`);
    } else if (mode === 'skip') {
      const now = Date.now(), tr = this.turn.get(ev.action.id) || { ticks: 0, t: 0 };
      if (now - tr.t > 600) tr.ticks = 0; // a new turn
      tr.ticks += ticks; tr.t = now; this.turn.set(ev.action.id, tr);
      if (Math.abs(tr.ticks) >= 2) { command(tr.ticks > 0 ? 'next' : 'prev'); tr.ticks = 0; }
    } else {
      const step = Math.max(1, Math.min(10, Number(s.volStep) || 2)), delta = ticks * step;
      const v = Math.max(0, Math.min(100, (state.volume ?? 50) + delta));
      state.volume = v; // show it straight away
      flash.set(ev.action.id, { text: `Volume ${v}%`, value: v * 10, until: Date.now() + 1200 });
      renderAll();
      command(`vol:${delta > 0 ? '+' : '-'}${Math.abs(delta)}`);
      setTimeout(renderAll, 1250);
    }
  }
}

const nowPlaying = new NowPlaying();
streamDeck.actions.registerAction(nowPlaying);
streamDeck.connect();
