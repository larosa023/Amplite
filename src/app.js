// Amplite — a lightweight Spotify player
// Pure ES modules, no build step. Auth uses PKCE, so only the public Client ID lives here.

const CLIENT_ID = '8d242b5e87d1482ea0ce0978b9d2cf83';
const IS_APP = !!window.amplite; // running inside the Amplite desktop app
const HOME_URI = location.origin + location.pathname.replace(/(index\.html|callback)$/, '');
// Desktop app: Spotify's recommended loopback form, e.g. http://127.0.0.1:43821/callback
const REDIRECT_URI = window.amplite ? location.origin + '/callback' : HOME_URI;
const SCOPES = [
  'streaming', 'user-read-email', 'user-read-private',
  'user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing',
  'user-library-read', 'user-library-modify',
  'playlist-read-private', 'playlist-read-collaborative',
  'user-top-read', 'user-read-recently-played',
].join(' ');

const THEMES = [
  ['midnight', 'Midnight'], ['spotify', 'Spotify'], ['classic', 'Classic Amp'], ['nord', 'Nord'],
  ['dracula', 'Dracula'], ['sakura', 'Sakura'], ['ocean', 'Ocean'], ['paper', 'Paper'],
];

/* ---------------- helpers ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stripHtml = s => s ? new DOMParser().parseFromString(s, 'text/html').body.textContent : '';
const fmt = (ms, pad) => {
  const s = Math.max(0, Math.floor((ms || 0) / 1000)), m = Math.floor(s / 60), r = String(s % 60).padStart(2, '0');
  return `${pad ? String(m).padStart(2, '0') : m}:${r}`;
};
const img = (arr, min = 300) => {
  if (!arr?.length) return '';
  const ok = arr.filter(i => !i.width || i.width >= min);
  return (ok[ok.length - 1] || arr[0]).url;
};
const store = {
  get(k, d = null) { try { const v = localStorage.getItem('amplite:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('amplite:' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('amplite:' + k); } catch {} },
};

/* ---------------- settings ---------------- */
const AMP_DEFAULTS = {
  skin: 'theme', colors: { frame: '#2c2c38', frameHi: '#55556a', lcd: '#000000', text: '#00e800', lo: '#00c000', mid: '#e8e800', hi: '#ff2a00', btn: '#d8d8e0', label: '#9a9aa8' },
  scale: 1.1, width: 'normal', corners: 'soft', font: 'mono', glow: true,
  viz: 'bars', bars: 19, fps: 30,
  art: false, title: true, marquee: true, meta: true, vol: true, seek: true, controls: true, toggles: true,
  scroll: 'normal', time: 'elapsed', opacity: 100, onTop: true,
};
const DEFAULTS = { ui: { sideMin: false, lite: false }, amp: AMP_DEFAULTS, audio: { bitrate: 320, normalise: false } };
const clone = o => JSON.parse(JSON.stringify(o));
const CFG = (() => {
  const saved = store.get('cfg', {}) || {}, c = clone(DEFAULTS);
  for (const k of Object.keys(c)) Object.assign(c[k], saved[k] || {});
  c.amp.colors = { ...AMP_DEFAULTS.colors, ...(saved.amp?.colors || {}) };
  return c;
})();
const getK = k => k.split('.').reduce((o, p) => o?.[p], CFG);
function setK(k, v) {
  const parts = k.split('.'), last = parts.pop();
  parts.reduce((o, p) => o[p], CFG)[last] = v;
  store.set('cfg', CFG);
  if (k.startsWith('amp.')) applyAmp();
  else if (k.startsWith('ui.')) applyUI();
  else if (k.startsWith('audio.')) applyAudio();
  syncControls();
}

const ICONS = {
  play: ['M8 5.5v13l11-6.5z'], pause: ['M6.5 5h4v14h-4zM13.5 5h4v14h-4z'],
  next: ['M5 6l9 6-9 6zM16 6h2.5v12H16z'], prev: ['M19 6l-9 6 9 6zM5.5 6H8v12H5.5z'], stop: ['M6 6h12v12H6z'],
  shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  repeat: '<path d="m17 1 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  search: '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.35-4.35"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>',
  volume: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m23 9-6 6M17 9l6 6"/>',
  palette: '<circle cx="13.5" cy="6.5" r="1.2"/><circle cx="17.5" cy="10.5" r="1.2"/><circle cx="8.5" cy="7.5" r="1.2"/><circle cx="6.5" cy="12.5" r="1.2"/><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A5.6 5.6 0 0 0 22 9.8C22 5.5 17.5 2 12 2z"/>',
  amp: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 14v-2M9 14v-4M12 14v-3M15 14v-5"/><circle cx="18.5" cy="12" r="1"/>',
  left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  popout: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  sidebar: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 10l-2 2 2 2"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/>',
};
const svg = n => {
  const v = ICONS[n];
  return Array.isArray(v)
    ? `<svg class="ic fill" viewBox="0 0 24 24" aria-hidden="true"><path d="${v[0]}"/></svg>`
    : `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${v}</svg>`;
};
const setIcon = (el, n) => {
  if (el.dataset.cur === n) return;
  el.dataset.cur = n; el.querySelector('svg')?.remove(); el.insertAdjacentHTML('afterbegin', svg(n));
};
const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="var(--accent)"/><g fill="var(--on-accent)"><rect x="7.5" y="14" width="3.2" height="10" rx="1.6"/><rect x="14.4" y="8" width="3.2" height="16" rx="1.6"/><rect x="21.3" y="11" width="3.2" height="13" rx="1.6"/></g></svg>`;

let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3600);
}

/* ---------------- auth (PKCE) ---------------- */
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function login() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(64)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  store.set('verifier', verifier);
  location.href = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
    client_id: CLIENT_ID, response_type: 'code', redirect_uri: REDIRECT_URI,
    scope: SCOPES, code_challenge_method: 'S256', code_challenge: challenge,
  });
}

async function tokenRequest(params) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...params }),
  });
  const t = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(t.error_description || `Spotify login failed (${r.status})`);
  const prev = store.get('token') || {};
  const tok = { access_token: t.access_token, refresh_token: t.refresh_token || prev.refresh_token, expires_at: Date.now() + (t.expires_in - 60) * 1000 };
  store.set('token', tok);
  return tok;
}

async function handleCallback() {
  const q = new URLSearchParams(location.search);
  if (!q.has('code') && !q.has('error')) return;
  history.replaceState(null, '', HOME_URI);
  if (q.get('error')) throw new Error(q.get('error') === 'access_denied' ? 'Login was cancelled.' : q.get('error'));
  const verifier = store.get('verifier');
  if (!verifier) throw new Error('Login session expired — try again.');
  await tokenRequest({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: REDIRECT_URI, code_verifier: verifier });
  store.del('verifier');
}

let refreshing = null;
async function getToken() {
  const t = store.get('token');
  if (!t) throw new Error('Not logged in');
  if (Date.now() < t.expires_at) return t.access_token;
  refreshing ??= tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh_token }).finally(() => { refreshing = null; });
  return (await refreshing).access_token;
}

function logout() {
  store.del('token');
  try { S.player?.disconnect(); } catch {}
  location.href = HOME_URI;
}

/* ---------------- Web API ---------------- */
const apiCache = new Map(); // url -> { t, data }  (GET responses, 2 min)
const cacheable = (method, url) => method === 'GET' && !/\/me\/player|\/contains/.test(url);
const purgeCache = re => { for (const k of apiCache.keys()) if (re.test(k)) apiCache.delete(k); };
async function api(path, { method = 'GET', body, query } = {}, retry = true) {
  let url = path.startsWith('http') ? path : 'https://api.spotify.com/v1' + path;
  if (query) url += (url.includes('?') ? '&' : '?') + new URLSearchParams(query);
  if (cacheable(method, url)) {
    const hit = apiCache.get(url);
    if (hit && Date.now() - hit.t < 120000) return hit.data;
  }
  const token = await getToken();
  const r = await fetch(url, {
    method,
    headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401 && retry) {
    const t = store.get('token'); if (t) { t.expires_at = 0; store.set('token', t); }
    return api(path, { method, body, query }, false);
  }
  if (r.status === 429 && retry) {
    await sleep((+r.headers.get('Retry-After') || 1) * 1000);
    return api(path, { method, body, query }, false);
  }
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) {
    const e = new Error(data?.error?.message || `Spotify error ${r.status}`);
    e.status = r.status; e.reason = data?.error?.reason; throw e;
  }
  if (cacheable(method, url)) apiCache.set(url, { t: Date.now(), data });
  return data;
}

// Fetch every page of a paged endpoint (a few pages in parallel).
async function pageAll(path, query = {}, max = 1500) {
  const limit = query.limit || 50;
  const first = await api(path, { query: { ...query, limit, offset: 0 } });
  const out = [...(first?.items || [])];
  const total = Math.min(first?.total ?? out.length, max);
  const offsets = [];
  for (let o = limit; o < total; o += limit) offsets.push(o);
  for (let i = 0; i < offsets.length; i += 4) {
    const pages = await Promise.all(offsets.slice(i, i + 4).map(o => api(path, { query: { ...query, limit, offset: o } })));
    pages.forEach(p => out.push(...(p?.items || [])));
  }
  return out;
}

function norm(t) {
  if (!t || !t.uri) return null;
  return {
    uri: t.uri, id: t.id, name: t.name || 'Unknown',
    artists: t.artists || (t.show ? [{ name: t.show.name }] : []),
    album: t.album ? { id: t.album.id, name: t.album.name, image: img(t.album.images, 64) } : { name: t.show?.name || '', image: img(t.images, 64) },
    duration: t.duration_ms || 0,
    playable: t.is_playable !== false && !t.is_local,
  };
}

/* ---------------- state ---------------- */
const S = {
  me: null, playlists: [], player: null, deviceId: null, activated: false,
  now: null, liked: false, likedUri: null,
  volume: store.get('volume', 0.6), lastVol: 0.6,
  cur: null, back: [], fwd: [], lists: [], hero: null,
  seeking: false, ampSeeking: false, ampRemain: false, ampMode: null, ampWin: null,
  vizGrad: null, vizPeak: null,
  engine: null, engineId: null, // bundled 320 kbps librespot engine (desktop app)
};
const useEngine = () => IS_APP && S.engine && S.engine.state !== 'missing';
const pos = () => {
  const n = S.now; if (!n) return 0;
  return n.paused ? n.position : Math.min(n.duration, n.position + (performance.now() - n.ts));
};

/* ---------------- Web Playback SDK ---------------- */
function initSDK() {
  if (S.sdkStarted) return; S.sdkStarted = true;
  window.onSpotifyWebPlaybackSDKReady = () => {
    const p = new Spotify.Player({ name: 'Amplite', getOAuthToken: cb => getToken().then(cb), volume: S.volume });
    S.player = p;
    p.addListener('ready', ({ device_id }) => { S.deviceId = device_id; updatePlayerUI(); });
    p.addListener('not_ready', () => { S.deviceId = null; });
    p.addListener('player_state_changed', st => {
      if (!st) { if (S.now?.source === 'sdk') { S.now = null; updatePlayerUI(); } return; }
      const t = st.track_window.current_track;
      S.now = {
        source: 'sdk', device: 'Amplite', uri: t.uri, id: t.id, name: t.name,
        artists: t.artists.map(a => ({ name: a.name, id: a.uri?.split(':')[2] })),
        album: { name: t.album.name, id: t.album.uri?.split(':')[2], image: img(t.album.images, 300) },
        duration: st.duration, position: st.position, paused: st.paused,
        shuffle: st.shuffle, repeat: st.repeat_mode, ts: performance.now(),
      };
      updatePlayerUI();
    });
    p.addListener('initialization_error', ({ message }) => console.warn('SDK init:', message));
    p.addListener('authentication_error', ({ message }) => toast('Player auth error: ' + message));
    p.addListener('account_error', () => toast('In-browser playback needs Spotify Premium — Amplite will control your other devices instead.'));
    p.addListener('playback_error', ({ message }) => {
      console.warn('Playback:', message);
      if (!S.drmWarned) { S.drmWarned = true; toast('Spotify blocked in-app playback here — open the Spotify app and Amplite will control it.'); }
    });
    p.connect();
  };
  const s = document.createElement('script');
  s.src = 'https://sdk.scdn.co/spotify-player.js';
  document.head.append(s);
}

function activate() {
  if (S.player && !S.activated) { S.activated = true; try { S.player.activateElement(); } catch {} }
}

// Poll /me/player so Amplite also works as a remote for your phone / desktop app.
async function poll() {
  try {
    const d = await api('/me/player');
    if (!d || !d.item) { if (S.now?.source === 'remote') { S.now = null; updatePlayerUI(); } return; }
    if (S.deviceId && d.device?.id === S.deviceId) return; // the SDK keeps us in sync
    const t = d.item;
    S.now = {
      source: 'remote', device: d.device?.name || 'another device', uri: t.uri, id: t.id, name: t.name,
      artists: (t.artists || []).map(a => ({ name: a.name, id: a.id })),
      album: { name: t.album?.name, id: t.album?.id, image: img(t.album?.images || t.images, 300) },
      duration: t.duration_ms, position: d.progress_ms, paused: !d.is_playing,
      shuffle: d.shuffle_state, repeat: { off: 0, context: 1, track: 2 }[d.repeat_state] ?? 0, ts: performance.now(),
    };
    updatePlayerUI();
  } catch {}
}
const pollSoon = (ms = 700) => setTimeout(poll, ms);

/* ---------------- audio engine (desktop app) ---------------- */
async function findEngine(tries = 1) {
  for (let i = 0; i < tries; i++) {
    try {
      const d = await api('/me/player/devices');
      const dev = (d?.devices || []).find(x => x.name === (S.engine?.name || 'Amplite') && x.id !== S.deviceId);
      if (dev) { S.engineId = dev.id; return dev.id; }
    } catch {}
    if (i < tries - 1) await sleep(1000);
  }
  return null;
}
async function engineReady(timeout = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (S.engine?.state === 'ready') return true;
    if (S.engine?.state === 'auth') { toast('Approve Amplite in your browser first (one-time), then press play again.'); return false; }
    if (S.engine?.state === 'error') { toast('Audio engine: ' + (S.engine.detail || 'error')); return false; }
    await sleep(300);
  }
  return S.engine?.state === 'ready';
}
async function target() {
  if (useEngine()) {
    if (!(await engineReady())) return undefined;
    return S.engineId || (await findEngine(6)) || undefined;
  }
  return S.deviceId || undefined;
}
// Engine status now lives in Settings → Audio (kept out of the player bar).
function renderEngine() {
  const el = $('#engineLine'); if (!el) return;
  const e = S.engine;
  const label = !e ? 'Checking…' : e.state === 'missing' ? 'Not included in this build — using Spotify’s web player'
    : e.state === 'ready' ? `Ready · streaming at ${e.bitrate} kbps` : e.state === 'auth' ? 'Waiting for one-time approval in your browser'
    : e.state === 'error' ? 'Error: ' + (e.detail || 'unknown') : /restart/i.test(e.detail || '') ? 'Restarting…' : 'Starting…';
  el.className = 'engine-line ' + (e?.state || '');
  el.innerHTML = `<span class="dot"></span><span>${esc(label)}</span>`;
}
const audioOpts = () => ({ volume: Math.round(S.volume * 100), bitrate: CFG.audio.bitrate, normalise: CFG.audio.normalise });
let audioT;
function applyAudio() {
  if (!IS_APP) return;
  clearTimeout(audioT);
  audioT = setTimeout(() => { window.amplite.engineConfig(audioOpts()); toast('Applying audio settings…'); }, 400);
}
function initEngine() {
  window.amplite.onEngine(st => {
    const was = S.engine?.state;
    S.engine = st;
    if (st.state === 'ready' && was !== 'ready') { S.engineId = null; findEngine(8).then(() => poll()); }
    if (st.state === 'auth' && was !== 'auth') toast('One-time step: approve Amplite in the browser window that just opened.');
    if (st.state === 'error' && was !== 'error') toast('Audio engine problem — see Settings → Audio.');
    if (st.state === 'missing') initSDK();
    renderEngine(); updatePlayerUI();
  });
  window.amplite.engineStatus().then(st => {
    S.engine = st;
    if (st.state === 'missing') { initSDK(); return; }
      window.amplite.engineStart(audioOpts());
  });
}

/* ---------------- playback controls ---------------- */
const isLocal = () => S.player && S.now?.source === 'sdk';
const fail = e => {
  if (e.status === 404) toast(useEngine() ? 'Audio engine isn’t connected yet — give it a second and try again.' : 'No active device. Open Spotify somewhere, or use Chrome/Edge with Premium.');
  else if (e.status === 403) toast('Spotify refused that (Premium is required for playback control).');
  else toast(e.message);
};

async function startPlayback(body) {
  activate();
  const dev = await target();
  if (useEngine() && !dev) return;
  try {
    await api('/me/player/play', { method: 'PUT', query: dev ? { device_id: dev } : undefined, body });
    pollSoon(600); pollSoon(1800);
  } catch (e) {
    if (e.status === 404 && useEngine()) {
      // Engine restarted and got a new device id: look it up again and retry once.
      S.engineId = null;
      const id = await findEngine(4);
      if (id) { try { await api('/me/player/play', { method: 'PUT', query: { device_id: id }, body }); pollSoon(800); return; } catch (e2) { return fail(e2); } }
    }
    fail(e);
  }
}
const playContext = (context_uri, offsetUri) => startPlayback(offsetUri ? { context_uri, offset: { uri: offsetUri } } : { context_uri });
function playUris(uris, idx = 0) {
  const start = Math.max(0, idx - 20);
  return startPlayback({ uris: uris.slice(start, start + 100), offset: { position: idx - start } });
}

async function resume() {
  if (!S.now) return toast('Pick something to play first.');
  if (isLocal()) return S.player.resume();
  try { await api('/me/player/play', { method: 'PUT' }); S.now.position = pos(); S.now.paused = false; S.now.ts = performance.now(); updatePlayerUI(); pollSoon(); } catch (e) { fail(e); }
}
async function pause() {
  if (!S.now) return;
  if (isLocal()) return S.player.pause();
  try { await api('/me/player/pause', { method: 'PUT' }); S.now.position = pos(); S.now.paused = true; updatePlayerUI(); pollSoon(); } catch (e) { fail(e); }
}
const togglePlay = () => { activate(); return !S.now || S.now.paused ? resume() : pause(); };
async function next() {
  if (isLocal()) return S.player.nextTrack();
  try { await api('/me/player/next', { method: 'POST' }); pollSoon(); } catch (e) { fail(e); }
}
async function prev() {
  if (isLocal()) return S.player.previousTrack();
  try { await api('/me/player/previous', { method: 'POST' }); pollSoon(); } catch (e) { fail(e); }
}
async function seek(ms) {
  if (!S.now) return;
  ms = Math.max(0, Math.round(ms));
  S.now.position = ms; S.now.ts = performance.now();
  if (isLocal()) return S.player.seek(ms);
  try { await api('/me/player/seek', { method: 'PUT', query: { position_ms: ms } }); } catch (e) { fail(e); }
}
async function stop() { await pause(); await seek(0); }
async function toggleShuffle() {
  if (!S.now) return;
  const v = !S.now.shuffle;
  try { await api('/me/player/shuffle', { method: 'PUT', query: { state: v } }); S.now.shuffle = v; updatePlayerUI(); } catch (e) { fail(e); }
}
async function cycleRepeat() {
  if (!S.now) return;
  const v = ((S.now.repeat || 0) + 1) % 3;
  try { await api('/me/player/repeat', { method: 'PUT', query: { state: ['off', 'context', 'track'][v] } }); S.now.repeat = v; updatePlayerUI(); } catch (e) { fail(e); }
}
let volT;
function setVolume(v) {
  v = Math.max(0, Math.min(1, v));
  S.volume = v; store.set('volume', v); if (v > 0) S.lastVol = v;
  try { S.player?.setVolume(v)?.catch?.(() => {}); } catch {}
  if (S.now?.source === 'remote') {
    clearTimeout(volT);
    volT = setTimeout(() => api('/me/player/volume', { method: 'PUT', query: { volume_percent: Math.round(v * 100) } }).catch(() => {}), 200);
  }
  syncVolume();
}
async function playHere() {
  activate();
  const dev = await target();
  if (!dev) return;
  try { await api('/me/player', { method: 'PUT', body: { device_ids: [dev], play: !S.now?.paused } }); pollSoon(1000); } catch (e) { fail(e); }
}

/* ---------------- liked songs ---------------- */
async function checkLiked(uri) {
  S.likedUri = uri; S.liked = false; renderLike();
  if (!uri || uri.includes(':local:')) return;
  try {
    let r;
    try { r = await api('/me/library/contains', { query: { uris: uri } }); }
    catch (e) { if (e.status !== 404) throw e; r = await api('/me/tracks/contains', { query: { ids: uri.split(':')[2] } }); }
    if (S.likedUri === uri) { S.liked = !!r?.[0]; renderLike(); }
  } catch {}
}
async function toggleLike() {
  const uri = S.now?.uri; if (!uri) return;
  const was = S.liked, method = was ? 'DELETE' : 'PUT';
  S.liked = !was; renderLike();
  try {
    try { await api('/me/library', { method, query: { uris: uri } }); }
    catch (e) { if (e.status !== 404 && e.status !== 405) throw e; await api('/me/tracks', { method, query: { ids: uri.split(':')[2] } }); }
    purgeCache(/\/me\/tracks/);
    toast(was ? 'Removed from Liked Songs' : 'Added to Liked Songs');
  } catch (e) { S.liked = was; renderLike(); toast(e.message); }
}
const renderLike = () => $('#likeBtn').classList.toggle('liked', S.liked);

/* ---------------- player UI ---------------- */
function setRange(el, frac) {
  frac = Math.max(0, Math.min(1, frac || 0));
  el.value = Math.round(frac * el.max);
  el.style.setProperty('--p', frac * 100 + '%');
}
const artistLinks = arr => (arr || []).map(a => a.id ? `<a data-open="artist:${esc(a.id)}">${esc(a.name)}</a>` : esc(a.name)).join(', ');

function updatePlayerUI() {
  const n = S.now;
  $('#npTitle').textContent = n?.name || 'Nothing playing';
  $('#npArtist').innerHTML = n ? artistLinks(n.artists) : (S.deviceId ? 'Ready — pick something to play' : '');
  const art = $('#npArt');
  if ((n?.album?.image || '') !== art.getAttribute('src')) art.setAttribute('src', n?.album?.image || '');
  art.onclick = n?.album?.id ? () => navigate('album', n.album.id) : null;
  art.style.cursor = n?.album?.id ? 'pointer' : '';
  setIcon($('#playBtn'), n && !n.paused ? 'pause' : 'play');
  $('#shufBtn').classList.toggle('on', !!n?.shuffle);
  $('#repBtn').classList.toggle('on', !!n?.repeat);
  $('#repBtn').classList.toggle('one', n?.repeat === 2);
  A.shuf.classList.toggle('on', !!n?.shuffle);
  A.rep.classList.toggle('on', !!n?.repeat);
  A.rep.textContent = n?.repeat === 2 ? 'REP1' : 'REP';
  A.dev.textContent = n?.device || 'stereo';

  const dev = $('#deviceBtn');
  const onEngine = useEngine() && n?.device === S.engine?.name;
  const canHere = useEngine() ? S.engine?.state === 'ready' : !!S.deviceId;
  if (n?.source === 'remote' && !onEngine) {
    dev.classList.remove('hidden');
    dev.textContent = `On ${n.device}${canHere ? ' · Play here' : ''}`;
    dev.disabled = !canHere;
  } else dev.classList.add('hidden');
  const kb = $('#ampKbps', ampEl); if (kb) kb.textContent = onEngine ? String(S.engine.bitrate) : (n?.source === 'sdk' ? '256' : '---');
  const aa = A.art; if (aa && (n?.album?.image || '') !== aa.getAttribute('src')) aa.setAttribute('src', n?.album?.image || '');

  if ((n?.uri || null) !== S.likedUri) checkLiked(n?.uri || null);
  document.title = n ? `${n.name} · ${n.artists.map(a => a.name).join(', ')}` : 'Amplite';
  if ('mediaSession' in navigator && n && navigator.mediaSession.metadata?.title !== n.name) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: n.name, artist: n.artists.map(a => a.name).join(', '), album: n.album?.name || '', artwork: n.album?.image ? [{ src: n.album.image, sizes: '300x300' }] : [] });
    } catch {}
  }
  markPlaying();
}
function markPlaying() {
  const uri = S.now?.uri;
  $$('.trow.playing').forEach(r => r.classList.remove('playing'));
  if (uri) $$(`.trow[data-uri="${CSS.escape(uri)}"]`).forEach(r => r.classList.add('playing'));
}
function tickBar() {
  if (document.hidden) return;
  const n = S.now, d = n?.duration || 0, p = pos();
  if (!S.seeking) { $('#tCur').textContent = fmt(p); setRange($('#seek'), d ? p / d : 0); }
  $('#tDur').textContent = fmt(d);
}
function syncVolume() {
  setRange($('#vol'), S.volume);
  setRange(A.vol, S.volume);
  setIcon($('#muteBtn'), S.volume === 0 ? 'mute' : 'volume');
}

/* ---------------- views ---------------- */
const VIEWS = { home: viewHome, search: viewSearch, liked: viewLiked, playlist: viewPlaylist, album: viewAlbum, artist: viewArtist };
let navToken = 0;

async function navigate(name, arg = '', push = true) {
  if (!VIEWS[name]) return;
  if (push && S.cur && !(S.cur.name === name && S.cur.arg === arg)) { S.back.push(S.cur); S.fwd = []; }
  S.cur = { name, arg };
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  $$('.pl-item').forEach(b => b.classList.toggle('active', name === 'playlist' && b.dataset.id === arg));
  $('#searchWrap').classList.toggle('hidden', name !== 'search');
  $('#backBtn').disabled = !S.back.length;
  $('#fwdBtn').disabled = !S.fwd.length;
  const el = $('#view'), tok = ++navToken, alive = () => tok === navToken;
  if (push) el.scrollTop = 0;
  S.lists = []; S.hero = null;
  el.innerHTML = '<div class="loading"><span></span><span></span><span></span></div>';
  try { await VIEWS[name](el, arg, alive); }
  catch (e) { if (alive()) el.innerHTML = `<div class="empty"><h2>Couldn't load that</h2><p>${esc(e.message)}</p></div>`; }
  if (alive()) markPlaying();
}
function goBack() { if (!S.back.length) return; S.fwd.push(S.cur); const v = S.back.pop(); navigate(v.name, v.arg, false); }
function goFwd() { if (!S.fwd.length) return; S.back.push(S.cur); const v = S.fwd.pop(); navigate(v.name, v.arg, false); }

function card({ kind, id, uri, title, sub, image, round }) {
  return `<div class="card ${round ? 'round' : ''}" data-open="${kind}:${esc(id)}">
    <div class="art">${image ? `<img src="${esc(image)}" alt="" loading="lazy">` : `<div class="ph">${svg('music')}</div>`}
      <button class="card-play" data-play="${esc(uri)}" title="Play">${svg('play')}</button></div>
    <div class="card-title">${esc(title)}</div><div class="card-sub">${esc(sub || '')}</div></div>`;
}

function trackTable(tracks, { context = null, showAlbum = true, showArt = true } = {}) {
  const li = S.lists.push({ tracks, context }) - 1;
  return `<div class="tracks ${showAlbum ? '' : 'no-album'}" data-list="${li}">
    <div class="thead"><span>#</span><span>Title</span>${showAlbum ? '<span>Album</span>' : ''}<span class="tdur">${svg('clock')}</span></div>
    ${tracks.map((t, i) => `<div class="trow ${t.playable ? '' : 'dim'}" data-idx="${i}" data-uri="${esc(t.uri)}">
      <div class="tnum"><span>${i + 1}</span>${svg('play')}</div>
      <div class="tmain">${showArt && t.album?.image ? `<img src="${esc(t.album.image)}" alt="" loading="lazy">` : ''}
        <div class="ttext"><div class="tname">${esc(t.name)}</div><div class="tartist">${artistLinks(t.artists)}</div></div></div>
      ${showAlbum ? `<div class="talbum">${t.album?.id ? `<a data-open="album:${esc(t.album.id)}">${esc(t.album.name)}</a>` : esc(t.album?.name || '')}</div>` : ''}
      <div class="tdur">${fmt(t.duration)}</div></div>`).join('')}
  </div>`;
}

function hero({ image, art, round, kind, title, desc, meta }) {
  return `<header class="hero">
    ${art || (image ? `<img class="hero-art ${round ? 'round' : ''}" src="${esc(image)}" alt="">` : `<div class="hero-art ph">${svg('music')}</div>`)}
    <div class="hero-text"><div class="hero-kind">${esc(kind)}</div><h1>${esc(title)}</h1>
      ${desc ? `<p class="hero-desc">${esc(desc)}</p>` : ''}<div class="hero-meta">${meta || ''}</div></div>
  </header><div class="actions pad"><button class="big-play" data-hero-play title="Play">${svg('play')}</button></div>`;
}

function playRow(row) {
  const list = S.lists[+row.closest('.tracks').dataset.list];
  const t = list?.tracks[+row.dataset.idx];
  if (!t) return;
  if (!t.playable) return toast("This track isn't available.");
  if (list.context) return playContext(list.context, t.uri);
  const ok = list.tracks.filter(x => x.playable);
  playUris(ok.map(x => x.uri), ok.indexOf(t));
}
function playHero() {
  if (S.hero?.context) return playContext(S.hero.context);
  const ok = S.lists[0]?.tracks.filter(x => x.playable) || [];
  if (ok.length) playUris(ok.map(x => x.uri), 0);
}

async function viewHome(el, _, alive) {
  const h = new Date().getHours();
  const greet = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const first = S.me?.display_name?.split(' ')[0];
  const tiles = [`<div class="qtile" data-open="liked:"><div class="liked-mini">${svg('heart')}</div><span class="qname">Liked Songs</span></div>`]
    .concat(S.playlists.slice(0, 7).map(p => `<div class="qtile" data-open="playlist:${esc(p.id)}">
      ${img(p.images, 64) ? `<img src="${esc(img(p.images, 64))}" alt="">` : `<div class="ph">${svg('music')}</div>`}
      <span class="qname">${esc(p.name)}</span><button class="card-play" data-play="${esc(p.uri)}" title="Play">${svg('play')}</button></div>`));
  el.innerHTML = `<div class="home"><div class="pad">
    <h1 class="greet">${greet}${first ? ', ' + esc(first) : ''}</h1>
    <div class="quick">${tiles.join('')}</div>
    <section><h2>Jump back in</h2><div class="grid" id="hRecent">${'<div class="skel"></div>'.repeat(6)}</div></section>
    <section><h2>On repeat lately</h2><div id="hTop"><p class="muted">Loading…</p></div></section>
  </div></div>`;

  api('/me/player/recently-played', { query: { limit: 50 } }).then(d => {
    if (!alive()) return;
    const seen = new Set(), albums = [];
    for (const it of d?.items || []) { const a = it.track?.album; if (a && !seen.has(a.id)) { seen.add(a.id); albums.push(a); } }
    $('#hRecent').innerHTML = albums.slice(0, 12).map(a => card({ kind: 'album', id: a.id, uri: a.uri, title: a.name, sub: (a.artists || []).map(x => x.name).join(', '), image: img(a.images) })).join('')
      || '<p class="muted">Nothing yet — play something!</p>';
  }).catch(() => { if (alive()) $('#hRecent').innerHTML = '<p class="muted">Couldn’t load recent plays.</p>'; });

  api('/me/top/tracks', { query: { limit: 10, time_range: 'short_term' } }).then(d => {
    if (!alive()) return;
    const ts = (d?.items || []).map(norm).filter(Boolean);
    $('#hTop').innerHTML = ts.length ? trackTable(ts) : '<p class="muted">Listen a bit more and your top tracks will show up here.</p>';
    markPlaying();
  }).catch(() => { if (alive()) $('#hTop').innerHTML = '<p class="muted">Couldn’t load top tracks.</p>'; });
}

async function viewSearch(el, _, alive) {
  const input = $('#searchInput');
  setTimeout(() => input.focus());
  const q = input.value.trim();
  if (!q) {
    el.innerHTML = `<div class="empty">${svg('search')}<h2>Find something to play</h2><p>Songs, artists, albums and playlists.</p></div>`;
    return;
  }
  const d = await api('/search', { query: { q, type: 'track,artist,album,playlist', limit: 10 } });
  if (!alive()) return;
  const tracks = (d.tracks?.items || []).filter(Boolean).map(norm).filter(Boolean);
  const artists = (d.artists?.items || []).filter(Boolean);
  const albums = (d.albums?.items || []).filter(Boolean);
  const pls = (d.playlists?.items || []).filter(Boolean);
  if (!tracks.length && !artists.length && !albums.length && !pls.length) {
    el.innerHTML = `<div class="empty"><h2>No results for “${esc(q)}”</h2><p>Check the spelling or try something else.</p></div>`;
    return;
  }
  el.innerHTML = `<div class="pad" style="padding-top:64px">
    ${tracks.length ? `<section><h2>Songs</h2>${trackTable(tracks)}</section>` : ''}
    ${artists.length ? `<section><h2>Artists</h2><div class="grid">${artists.map(a => card({ kind: 'artist', id: a.id, uri: a.uri, title: a.name, sub: 'Artist', image: img(a.images), round: true })).join('')}</div></section>` : ''}
    ${albums.length ? `<section><h2>Albums</h2><div class="grid">${albums.map(a => card({ kind: 'album', id: a.id, uri: a.uri, title: a.name, sub: `${(a.release_date || '').slice(0, 4)} · ${(a.artists || []).map(x => x.name).join(', ')}`, image: img(a.images) })).join('')}</div></section>` : ''}
    ${pls.length ? `<section><h2>Playlists</h2><div class="grid">${pls.map(p => card({ kind: 'playlist', id: p.id, uri: p.uri, title: p.name, sub: 'By ' + (p.owner?.display_name || 'Spotify'), image: img(p.images) })).join('')}</div></section>` : ''}
  </div>`;
}

async function viewLiked(el, _, alive) {
  const items = await pageAll('/me/tracks', { limit: 50 }, 2000);
  if (!alive()) return;
  const tracks = items.map(i => norm(i.track)).filter(Boolean);
  el.innerHTML = hero({
    art: `<div class="hero-art liked-art">${svg('heart')}</div>`, kind: 'Playlist', title: 'Liked Songs',
    meta: `${esc(S.me?.display_name || '')} · ${tracks.length} songs`,
  }) + `<div class="pad">${tracks.length ? trackTable(tracks) : '<p class="muted">Tap the heart on any song to save it here.</p>'}</div>`;
}

async function viewPlaylist(el, id, alive) {
  const pl = await api(`/playlists/${id}`);
  if (!alive()) return;
  let tracks = [], note = '';
  try {
    const items = await pageAll(`/playlists/${id}/items`, { limit: 50 }, 2500);
    tracks = items.map(i => norm(i.item || i.track)).filter(Boolean);
  } catch (e) {
    note = e.status === 403 || e.status === 404
      ? 'Spotify only lets developer-mode apps list tracks for playlists you own or collaborate on. Hit play — it will still play.'
      : esc(e.message);
  }
  if (!alive()) return;
  S.hero = { context: pl.uri };
  const total = pl.items?.total ?? pl.tracks?.total ?? tracks.length;
  el.innerHTML = hero({
    image: img(pl.images), kind: pl.public === false ? 'Private playlist' : 'Playlist', title: pl.name,
    desc: stripHtml(pl.description), meta: `${esc(pl.owner?.display_name || '')} · ${total} songs`,
  }) + `<div class="pad">${tracks.length ? trackTable(tracks, { context: pl.uri }) : ''}${note ? `<p class="note">${note}</p>` : ''}</div>`;
}

async function viewAlbum(el, id, alive) {
  const al = await api(`/albums/${id}`);
  let items = al.tracks?.items || [], nextUrl = al.tracks?.next;
  while (nextUrl && items.length < 500) { const p = await api(nextUrl); items = items.concat(p?.items || []); nextUrl = p?.next; }
  if (!alive()) return;
  S.hero = { context: al.uri };
  const tracks = items.map(t => norm({ ...t, album: { id: al.id, name: al.name, images: al.images } })).filter(Boolean);
  el.innerHTML = hero({
    image: img(al.images), kind: al.album_type === 'single' ? 'Single' : 'Album', title: al.name,
    meta: `${artistLinks(al.artists)} · ${(al.release_date || '').slice(0, 4)} · ${tracks.length} songs`,
  }) + `<div class="pad">${trackTable(tracks, { context: al.uri, showAlbum: false, showArt: false })}</div>`;
}

async function viewArtist(el, id, alive) {
  const ar = await api(`/artists/${id}`);
  let albums = [];
  try { albums = (await api(`/artists/${id}/albums`, { query: { include_groups: 'album,single', limit: 10 } }))?.items || []; } catch {}
  if (!alive()) return;
  S.hero = { context: ar.uri };
  el.innerHTML = hero({ image: img(ar.images), round: true, kind: 'Artist', title: ar.name, meta: (ar.genres || []).slice(0, 3).map(esc).join(' · ') })
    + `<div class="pad"><section><h2>Discography</h2>${albums.length
      ? `<div class="grid">${albums.map(a => card({ kind: 'album', id: a.id, uri: a.uri, title: a.name, sub: `${(a.release_date || '').slice(0, 4)} · ${a.album_type === 'single' ? 'Single' : 'Album'}`, image: img(a.images) })).join('')}</div>`
      : '<p class="muted">Spotify didn’t return releases for this artist — hit play to hear them.</p>'}</section></div>`;
}

async function loadPlaylists() {
  try { S.playlists = await pageAll('/me/playlists', { limit: 50 }, 300); } catch { S.playlists = []; }
  $('#playlists').innerHTML = S.playlists.filter(Boolean).map(p => `<button class="pl-item" data-open="playlist:${esc(p.id)}" data-id="${esc(p.id)}" title="${esc(p.name)}">
    ${img(p.images, 64) ? `<img src="${esc(img(p.images, 64))}" alt="" loading="lazy">` : `<div class="ph">${svg('music')}</div>`}
    <div class="pl-meta"><div class="pl-name">${esc(p.name)}</div><div class="pl-sub">Playlist · ${esc(p.owner?.display_name || '')}</div></div></button>`).join('')
    || '<p class="muted" style="padding:0 12px;font-size:13px">No playlists yet.</p>';
}

/* ---------------- themes ---------------- */
function applyTheme(id) {
  if (!THEMES.some(t => t[0] === id)) id = 'midnight';
  document.documentElement.dataset.theme = id;
  if (S.ampWin) S.ampWin.document.documentElement.dataset.theme = id;
  store.set('theme', id);
  S.vizGrad = null;
  $$('.theme-opt').forEach(b => b.classList.toggle('active', b.dataset.theme === id));
  if (IS_APP) {
    const cs = getComputedStyle(document.documentElement);
    window.amplite.setTheme({ bg: cs.getPropertyValue('--bg').trim(), text: cs.getPropertyValue('--text').trim() });
  }
}
function renderThemes() {
  $('#themeList').innerHTML = THEMES.map(([id, name]) =>
    `<button class="theme-opt" data-theme="${id}"><span class="sw"><i></i><i></i><i></i></span>${name}</button>`).join('');
  applyTheme(store.get('theme', 'midnight'));
}

/* ---------------- Mini Amp ---------------- */
const ampEl = $('#amp');
const A = {
  time: $('#ampTime', ampEl), state: $('#ampState', ampEl), marq: $('#ampMarq', ampEl), viz: $('#ampViz', ampEl),
  seek: $('#ampSeek', ampEl), vol: $('#ampVol', ampEl), dev: $('#ampDev', ampEl), art: $('#ampArt', ampEl),
  shuf: $('[data-amp="shuffle"]', ampEl), rep: $('[data-amp="repeat"]', ampEl),
};
const ampOpen = () => !!S.ampWin || S.ampMode === 'inline';

function openInline() {
  S.ampMode = 'inline';
  $('#app').classList.add('hidden');
  $('#ampHost').classList.remove('hidden');
}
function closeInline() {
  if (S.ampMode !== 'inline') return;
  S.ampMode = null;
  $('#ampHost').classList.add('hidden');
  $('#app').classList.remove('hidden');
}
function onAmpWinClosed() {
  if (!S.ampWin) return;
  $('#ampHost').prepend(ampEl);
  S.ampWin = null; S.vizGrad = null;
  if (IS_APP) window.amplite.setMainVisible(true);
  startViz();
}
async function openPip() {
  let w;
  if (IS_APP) {
    // Desktop app: a frameless, always-on-top window (see main.js).
    w = window.open('', 'amp');
    if (!w) throw new Error('Mini amp window was blocked');
  } else {
    w = await window.documentPictureInPicture.requestWindow({ width: 300, height: 140 });
  }
  closeInline();
  for (const ss of document.styleSheets) {
    try {
      const st = w.document.createElement('style');
      st.textContent = [...ss.cssRules].map(r => r.cssText).join('\n');
      w.document.head.append(st);
    } catch {
      if (ss.href) { const l = w.document.createElement('link'); l.rel = 'stylesheet'; l.href = ss.href; w.document.head.append(l); }
    }
  }
  w.document.documentElement.dataset.theme = document.documentElement.dataset.theme;
  w.document.title = 'Amplite';
  w.document.body.classList.add('pip-body');
  w.document.body.append(ampEl);
  w.document.addEventListener('keydown', onKey);
  S.ampWin = w; S.vizGrad = null;
  w.addEventListener('pagehide', onAmpWinClosed);
  if (IS_APP) {
    // Fit the window to the amp, then tuck the main window away.
    await fitAmp();
    window.amplite.setMainVisible(false);
  }
  startViz();
}
// A closed popup doesn't always fire pagehide, so double-check.
setInterval(() => { if (S.ampWin?.closed) onAmpWinClosed(); }, 500);

async function toggleAmp() {
  closeSettings();
  if (S.ampWin) return S.ampWin.close();
  if (S.ampMode === 'inline') return closeInline();
  if (IS_APP || 'documentPictureInPicture' in window) {
    try { return await openPip(); } catch (e) { console.warn('Pop-out failed, using in-page mini player', e); }
  }
  openInline();
}
function ampPopToggle() {
  if (IS_APP) return ampClose(); // in the app, this button returns to the full window
  if (S.ampWin) { S.ampWin.close(); openInline(); return; }
  if (!('documentPictureInPicture' in window)) return toast('Always-on-top pop-out needs Chrome or Edge.');
  openPip().catch(() => toast('Couldn’t open the pop-out window.'));
}
function ampClose() { if (S.ampWin) S.ampWin.close(); closeInline(); }

/* ---- skins + customisation ---- */
const SKINS = {
  theme:   { name: 'Match theme' },
  classic: { name: 'Classic',   frame: '#2c2c38', frameHi: '#55556a', lcd: '#000000', text: '#00e800', lo: '#00c000', mid: '#e8e800', hi: '#ff2a00', btn: '#d8d8e0', label: '#9a9aa8' },
  amber:   { name: 'Amber',     frame: '#2a2118', frameHi: '#4a3a28', lcd: '#0d0802', text: '#ffb000', lo: '#ff8c00', mid: '#ffb000', hi: '#ffe08a', btn: '#f3dcb5', label: '#a8906c' },
  ice:     { name: 'Ice',       frame: '#1b2633', frameHi: '#344a60', lcd: '#03101a', text: '#7fd8ff', lo: '#3aa8ff', mid: '#7fd8ff', hi: '#e0f7ff', btn: '#d8ecff', label: '#7f9bb3' },
  synth:   { name: 'Synthwave', frame: '#1d1030', frameHi: '#3a2160', lcd: '#0b0414', text: '#ff5ec4', lo: '#7b5cff', mid: '#ff5ec4', hi: '#ffd166', btn: '#f1dcff', label: '#a58cc8' },
  matrix:  { name: 'Matrix',    frame: '#0f1a0f', frameHi: '#1f331f', lcd: '#000800', text: '#39ff14', lo: '#0f9d0f', mid: '#39ff14', hi: '#caffbf', btn: '#c8f5c8', label: '#6f9a6f' },
  blood:   { name: 'Crimson',   frame: '#221012', frameHi: '#46202a', lcd: '#0c0203', text: '#ff4d5e', lo: '#a3122a', mid: '#ff4d5e', hi: '#ffc2c8', btn: '#f6d6da', label: '#a8767c' },
  mono:    { name: 'Mono',      frame: '#e6e6e6', frameHi: '#ffffff', lcd: '#1a1a1a', text: '#f2f2f2', lo: '#8a8a8a', mid: '#cfcfcf', hi: '#ffffff', btn: '#1a1a1a', label: '#6a6a6a' },
  custom:  { name: 'Custom' },
};
const AMP_VARS = { frame: '--amp-frame-x', frameHi: '--amp-frame-hi-x', lcd: '--a-lcd', text: '--a-text', lo: '--a-lo', mid: '--a-mid', hi: '--a-hi', btn: '--a-btn', label: '--a-label' };
const WIDTHS = { compact: 260, normal: 300, wide: 360, xl: 430 };
const RADII = { square: '0px', soft: '6px', round: '14px' };
const BAR_W = 5;

function applyAmp() {
  const c = CFG.amp, st = ampEl.style;
  const colors = c.skin === 'custom' ? c.colors : SKINS[c.skin] || {};
  for (const [k, v] of Object.entries(AMP_VARS)) {
    if (c.skin !== 'theme' && colors[k]) st.setProperty(v, colors[k]); else st.removeProperty(v);
  }
  st.setProperty('--a-zoom', c.scale);
  st.setProperty('--a-w', (WIDTHS[c.width] || 300) + 'px');
  st.setProperty('--a-radius', RADII[c.corners] || '6px');
  const cls = {
    'show-art': c.art, 'no-title': !c.title, 'no-marquee': !c.marquee, 'no-meta': !c.meta, 'no-vol': !c.vol,
    'no-seek': !c.seek, 'no-controls': !c.controls, 'no-toggles': !c.toggles, 'viz-off': c.viz === 'off',
    'f-sans': c.font === 'sans', 'no-glow': !c.glow,
  };
  for (const [k, v] of Object.entries(cls)) ampEl.classList.toggle(k, !!v);
  // Visualiser canvas sized to the bar count.
  const n = Math.max(6, Math.min(40, c.bars | 0));
  if (V.h.length !== n) { V.h = new Float32Array(n); V.pk = new Float32Array(n); V.tg = new Float32Array(n); }
  A.viz.width = n * BAR_W - 1; A.viz.style.width = A.viz.width + 'px';
  S.ampRemain = c.time === 'remaining';
  S.vizGrad = null; V.text = ''; V.idle = false;
  fitAmp();
}
// Resize the pop-out window to the amp and apply window options.
async function fitAmp() {
  if (!S.ampWin || !IS_APP) return;
  await new Promise(r => S.ampWin.requestAnimationFrame(r));
  const r = ampEl.getBoundingClientRect(), z = CFG.amp.scale || 1;
  // getBoundingClientRect may or may not include CSS zoom depending on the engine; measure both ways.
  const w = Math.ceil(r.width * (r.width < ampEl.offsetWidth * z - 2 ? z : 1));
  const h = Math.ceil(r.height * (r.height < ampEl.offsetHeight * z - 2 ? z : 1));
  try { S.ampWin.resizeTo(w, h); } catch {}
  window.amplite.ampWindow({ opacity: CFG.amp.opacity / 100, onTop: CFG.amp.onTop });
}

// Simulated spectrum (Spotify's DRM audio can't be analysed in the browser).
const V = { h: new Float32Array(19), pk: new Float32Array(19), tg: new Float32Array(19), lastT: 0, lastTxt: 0, lastMarq: 0, lastFrame: 0, off: 0, text: '', idle: false };
let vizId = 0, vizRunning = false;
const vizWanted = () => ampOpen() || S.ampPreview;
function startViz() {
  if (!vizWanted()) return;
  const id = ++vizId; vizRunning = true;
  const win = S.ampWin || window;
  const step = t => {
    if (id !== vizId) return;
    if (!vizWanted()) { vizRunning = false; return; } // stop the loop entirely when nobody's looking
    drawAmp(t);
    win.requestAnimationFrame(step);
  };
  win.requestAnimationFrame(step);
}
const SCROLL_MS = { slow: 380, normal: 220, fast: 110 };
function drawAmp(t) {
  const c = CFG.amp;
  if (t - V.lastFrame < 1000 / (c.fps || 30) - 2) return;
  V.lastFrame = t;
  const n = S.now, playing = n && !n.paused;
  if (t - V.lastTxt > 200) {
    V.lastTxt = t;
    const p = pos(), d = n?.duration || 0;
    A.time.textContent = S.ampRemain && d ? '-' + fmt(d - p, true) : fmt(p, true);
    A.state.textContent = !n ? '■' : n.paused ? '❚❚' : '▶';
    if (!S.ampSeeking) setRange(A.seek, d ? p / d : 0);
  }
  if (c.marquee) {
    const txt = n ? `${n.artists.map(a => a.name).join(', ')} - ${n.name} (${fmt(n.duration)})` : 'AMPLITE  ·  PICK A SONG TO START';
    if (c.scroll === 'static') { if (txt !== V.text) { V.text = txt; A.marq.textContent = txt; } }
    else if (t - V.lastMarq > (SCROLL_MS[c.scroll] || 220)) {
      V.lastMarq = t;
      const full = txt + '   ***   ';
      if (full !== V.text) { V.text = full; V.off = 0; } else V.off = (V.off + 1) % full.length;
      A.marq.textContent = full.slice(V.off) + full.slice(0, V.off);
    }
  }
  if (c.viz === 'off') return;
  const N = V.h.length;
  // Nothing moving and nothing to decay: skip the canvas work.
  if (!playing && V.idle) return;
  const cv = A.viz, x = cv.getContext('2d'), W = cv.width, H = cv.height;
  if (!S.vizGrad) {
    const cs = ampEl.ownerDocument.defaultView.getComputedStyle(ampEl), g = x.createLinearGradient(0, H, 0, 0);
    g.addColorStop(0, cs.getPropertyValue('--a-lo').trim() || '#0c0');
    g.addColorStop(0.6, cs.getPropertyValue('--a-mid').trim() || '#ee0');
    g.addColorStop(1, cs.getPropertyValue('--a-hi').trim() || '#f20');
    S.vizGrad = g; S.vizPeak = cs.getPropertyValue('--a-text').trim() || '#fff';
  }
  if (playing && t - V.lastT > 70) {
    V.lastT = t;
    const s = t / 1000, beat = Math.pow(Math.max(0, Math.sin(s * Math.PI * 4.1)), 6);
    for (let i = 0; i < N; i++) {
      const f = i / N;
      V.tg[i] = Math.min(1, Math.max(0.04, 0.55 - 0.35 * f + (Math.random() - 0.4) * 0.45 * (1 - f * 0.4) + beat * (0.45 - 0.35 * f) + 0.12 * Math.sin(s * 3 + i)));
    }
  }
  let energy = 0;
  for (let i = 0; i < N; i++) {
    V.h[i] += playing ? (V.tg[i] - V.h[i]) * 0.3 : -V.h[i] * 0.12;
    V.pk[i] = V.h[i] > V.pk[i] ? V.h[i] : Math.max(0, V.pk[i] - 0.008);
    energy += V.h[i] + V.pk[i];
  }
  V.idle = !playing && energy < 0.01;
  x.clearRect(0, 0, W, H);
  if (c.viz === 'scope') {
    x.strokeStyle = S.vizGrad; x.lineWidth = 1.5; x.beginPath();
    const ph = t / 180;
    for (let px = 0; px <= W; px += 2) {
      const i = Math.min(N - 1, Math.floor(px / W * N)), a = V.h[i] * H * 0.45;
      const y = H / 2 + Math.sin(px / 4 + ph) * a * Math.cos(px / 17 - ph / 3);
      px ? x.lineTo(px, y) : x.moveTo(px, y);
    }
    x.stroke();
    return;
  }
  for (let i = 0; i < N; i++) {
    const bh = Math.round(V.h[i] * H), px = i * BAR_W;
    if (c.viz !== 'peaks') {
      x.fillStyle = S.vizGrad;
      if (c.viz === 'solid') x.fillRect(px, H - bh, BAR_W - 1, bh);
      else if (c.viz === 'mirror') { const hh = Math.round(bh / 2); for (let y = 0; y < hh; y += 2) { x.fillRect(px, H / 2 - 1 - y, BAR_W - 1, 1); x.fillRect(px, H / 2 + y, BAR_W - 1, 1); } }
      else for (let y = H - 1; y >= H - bh; y -= 2) x.fillRect(px, y, BAR_W - 1, 1);
    }
    if (c.viz !== 'mirror' && V.pk[i] > 0.02) { x.fillStyle = S.vizPeak; x.fillRect(px, H - 1 - Math.round(V.pk[i] * (H - 1)), BAR_W - 1, c.viz === 'peaks' ? 2 : 1); }
  }
}

/* ---------------- events ---------------- */
function onKey(e) {
  const tag = e.target?.tagName;
  if ((tag === 'INPUT' && e.target.type !== 'range') || tag === 'TEXTAREA') return;
  if (e.key === 'Escape' && !$('#settings').classList.contains('hidden')) { closeSettings(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleSidebar(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === ',') { e.preventDefault(); openSettings(); return; }
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') { e.preventDefault(); next(); }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  else if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey) toggleAmp();
  else if (e.key === '/' && !S.ampWin) { e.preventDefault(); navigate('search'); }
}

function bind() {
  $('#loginBtn').onclick = login;
  $('#sideToggle').onclick = toggleSidebar;
  $('#settingsBtn').onclick = e => { e.stopPropagation(); openSettings(); };
  $('#settingsMenuBtn').onclick = e => { e.stopPropagation(); openSettings(); };
  $('#logoutBtn').onclick = logout;
  $('#backBtn').onclick = goBack;
  $('#fwdBtn').onclick = goFwd;
  $('#playBtn').onclick = togglePlay;
  $('#nextBtn').onclick = next;
  $('#prevBtn').onclick = prev;
  $('#shufBtn').onclick = toggleShuffle;
  $('#repBtn').onclick = cycleRepeat;
  $('#likeBtn').onclick = toggleLike;
  $('#ampBtn').onclick = toggleAmp;
  $('#deviceBtn').onclick = playHere;
  $('#muteBtn').onclick = () => setVolume(S.volume > 0 ? 0 : S.lastVol || 0.5);

  const seekBar = $('#seek');
  seekBar.oninput = () => { S.seeking = true; const f = seekBar.value / seekBar.max; seekBar.style.setProperty('--p', f * 100 + '%'); $('#tCur').textContent = fmt(f * (S.now?.duration || 0)); };
  seekBar.onchange = () => { seek(seekBar.value / seekBar.max * (S.now?.duration || 0)); S.seeking = false; };
  $('#vol').oninput = e => setVolume(e.target.value / 100);

  // Theme + user popovers
  $('#themeBtn').onclick = e => { e.stopPropagation(); $('#themePanel').classList.toggle('hidden'); $('#userMenu').classList.add('hidden'); };
  $('#userBtn').onclick = e => { e.stopPropagation(); $('#userMenu').classList.toggle('hidden'); $('#themePanel').classList.add('hidden'); };
  $('#themeList').onclick = e => { const b = e.target.closest('.theme-opt'); if (b) applyTheme(b.dataset.theme); };
  $('#themePanel').addEventListener('click', e => e.stopPropagation());

  // Search
  let st;
  $('#searchInput').addEventListener('input', () => {
    clearTimeout(st);
    st = setTimeout(() => navigate('search', '', S.cur?.name !== 'search'), 300);
  });

  // Delegated clicks for views, cards and links
  document.addEventListener('click', e => {
    $('#themePanel').classList.add('hidden');
    $('#userMenu').classList.add('hidden');
    activate();
    const play = e.target.closest('[data-play]');
    if (play) { e.stopPropagation(); playContext(play.dataset.play); return; }
    if (e.target.closest('[data-hero-play]')) { playHero(); return; }
    const num = e.target.closest('.tnum');
    if (num) { playRow(num.closest('.trow')); return; }
    const open = e.target.closest('[data-open]');
    if (open) { const i = open.dataset.open.indexOf(':'); navigate(open.dataset.open.slice(0, i), open.dataset.open.slice(i + 1)); }
  });
  document.addEventListener('dblclick', e => {
    const row = e.target.closest('.trow');
    if (row && !e.target.closest('a')) { getSelection()?.removeAllRanges(); playRow(row); }
  });
  document.addEventListener('keydown', onKey);

  // Mini Amp controls
  ampEl.addEventListener('click', e => {
    const b = e.target.closest('[data-amp]'); if (!b) return;
    activate();
    ({
      prev, next, stop, shuffle: toggleShuffle, repeat: cycleRepeat,
      play: () => (S.now && !S.now.paused ? seek(0) : resume()),
      pause: () => (S.now?.paused ? resume() : pause()),
      popout: ampPopToggle, close: ampClose,
    })[b.dataset.amp]?.();
  });
  A.time.onclick = () => { S.ampRemain = !S.ampRemain; };
  A.seek.oninput = () => { S.ampSeeking = true; A.seek.style.setProperty('--p', A.seek.value / A.seek.max * 100 + '%'); };
  A.seek.onchange = () => { seek(A.seek.value / A.seek.max * (S.now?.duration || 0)); S.ampSeeking = false; };
  A.vol.oninput = () => setVolume(A.vol.value / 100);
}

/* ---------------- UI prefs (sidebar, lite mode) ---------------- */
function applyUI() {
  $('#app').classList.toggle('side-min', !!CFG.ui.sideMin);
  document.documentElement.classList.toggle('lite', !!CFG.ui.lite);
  const t = $('#sideToggle'); if (t) t.title = (CFG.ui.sideMin ? 'Expand' : 'Collapse') + ' sidebar (Ctrl+B)';
}
const toggleSidebar = () => setK('ui.sideMin', !CFG.ui.sideMin);

/* ---------------- settings panel ---------------- */
// Small declarative builders: every control carries data-k="<config key>" and is kept in sync by syncControls().
const sw = (k, label, hint = '') => `<div class="set-row"><div class="lbl">${label}${hint ? `<small>${hint}</small>` : ''}</div>
  <label class="switch ctl"><input type="checkbox" data-k="${k}" data-type="bool" aria-label="${label}"></label></div>`;
const seg = (k, label, opts, hint = '', num = false) => `<div class="set-row"><div class="lbl">${label}${hint ? `<small>${hint}</small>` : ''}</div>
  <div class="seg ctl" data-k="${k}" data-type="${num ? 'num' : 'str'}">${opts.map(([v, t]) => `<button data-v="${v}">${t}</button>`).join('')}</div></div>`;
const rng = (k, label, min, max, step, unit = '', hint = '') => `<div class="set-row"><div class="lbl">${label}${hint ? `<small>${hint}</small>` : ''}</div>
  <div class="ctl"><input class="set-range" type="range" min="${min}" max="${max}" step="${step}" data-k="${k}" data-type="num"><span class="set-val" data-val="${k}" data-unit="${unit}"></span></div></div>`;
const grp = (title, body) => `<section class="set-group"><h3>${title}</h3>${body}</section>`;

function settingsHTML() {
  const skinBtns = Object.entries(SKINS).map(([id, s]) => {
    const sty = id === 'theme' ? 'background:var(--amp-lcd);color:var(--amp-lcd-text)'
      : id === 'custom' ? `background:${CFG.amp.colors.lcd};color:${CFG.amp.colors.text}`
      : `background:${s.lcd};color:${s.text};box-shadow:inset 0 0 0 3px ${s.frame}`;
    return `<button class="skin" data-skin="${id}"><i style="${sty}">01:23</i>${s.name}</button>`;
  }).join('');
  const colorInputs = [['frame', 'Frame'], ['frameHi', 'Frame shine'], ['lcd', 'Screen'], ['text', 'Text'], ['lo', 'Bars low'], ['mid', 'Bars mid'], ['hi', 'Bars high'], ['btn', 'Buttons'], ['label', 'Labels']]
    .map(([k, t]) => `<label>${t}<input type="color" data-color="${k}"></label>`).join('');
  return {
    general: grp('Layout', sw('ui.sideMin', 'Collapse sidebar', 'Icons only. Shortcut: Ctrl+B'))
      + grp('Performance', sw('ui.lite', 'Lite mode', 'Turns off animations, blur and shadows to save CPU/GPU'))
      + grp('Theme', `<div class="theme-list" id="setThemes"></div>`),
    amp: `<div class="amp-preview" id="ampPreview"><p class="muted" id="ampPreviewNote" style="font-size:12px"></p></div>`
      + grp('Skin', `<div class="skins">${skinBtns}</div><div class="colors" id="ampColors" ${CFG.amp.skin === 'custom' ? '' : 'hidden'}>${colorInputs}</div>`)
      + grp('Size & shape',
        rng('amp.scale', 'Size', 0.8, 2, 0.05, '×')
        + seg('amp.width', 'Width', [['compact', 'Compact'], ['normal', 'Normal'], ['wide', 'Wide'], ['xl', 'Extra wide']])
        + seg('amp.corners', 'Corners', [['square', 'Square'], ['soft', 'Soft'], ['round', 'Round']])
        + seg('amp.font', 'Display font', [['mono', 'Digital'], ['sans', 'Clean']])
        + sw('amp.glow', 'Screen glow'))
      + grp('Visualizer',
        seg('amp.viz', 'Style', [['bars', 'Segments'], ['solid', 'Solid'], ['peaks', 'Peaks'], ['mirror', 'Mirror'], ['scope', 'Wave'], ['off', 'Off']])
        + rng('amp.bars', 'Bars', 6, 40, 1)
        + seg('amp.fps', 'Frame rate', [[15, '15'], [30, '30'], [60, '60']], 'Lower uses less CPU', true))
      + grp('Show',
        sw('amp.art', 'Album art') + sw('amp.title', 'Title bar', 'Hide it for a borderless look (drag the screen to move)')
        + sw('amp.marquee', 'Song title') + sw('amp.meta', 'Bitrate / device line') + sw('amp.vol', 'Volume slider')
        + sw('amp.seek', 'Seek bar') + sw('amp.controls', 'Playback buttons') + sw('amp.toggles', 'Shuffle / repeat'))
      + grp('Text',
        seg('amp.scroll', 'Title scrolling', [['static', 'Off'], ['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']])
        + seg('amp.time', 'Clock shows', [['elapsed', 'Elapsed'], ['remaining', 'Remaining']]))
      + (IS_APP ? grp('Window', rng('amp.opacity', 'Opacity', 40, 100, 5, '%') + sw('amp.onTop', 'Always on top')) : '')
      + grp('Reset', `<div class="set-row"><div class="lbl">Restore the default mini amp</div><button class="btn ctl" id="ampReset">Reset</button></div>`),
    audio: grp('Audio engine', `<div class="engine-line" id="engineLine"></div>`)
      + grp('Quality',
        seg('audio.bitrate', 'Streaming quality', [[320, 'Very high · 320'], [160, 'High · 160'], [96, 'Normal · 96']], 'kbps Ogg Vorbis. Very high needs Premium', true)
        + sw('audio.normalise', 'Normalize volume', 'Keeps loudness consistent between songs'))
      + grp('Troubleshooting', `<div class="set-row"><div class="lbl">Restart audio engine<small>Try this if playback stops responding</small></div><button class="btn ctl" id="engRestart">Restart</button></div>
        <div class="set-row"><div class="lbl">Re-link audio engine<small>Signs the engine in again through your browser</small></div><button class="btn ctl" id="engRelink">Re-link</button></div>`),
    about: `<div class="about-logo"><span class="logo" data-logo></span><div><b>Amplite</b><span class="muted" id="aboutVer"></span></div></div>`
      + (IS_APP ? grp('Updates', `<div class="set-row"><div class="lbl">Check for updates<small>Amplite also checks automatically</small></div><button class="btn ctl" id="aboutUpd">Check now</button></div>`) : '')
      + grp('Keyboard shortcuts', [['Space', 'Play / pause'], ['Ctrl + ← / →', 'Previous / next'], ['M', 'Mini amp'], ['/', 'Search'], ['Ctrl + B', 'Collapse sidebar'], ['Ctrl + ,', 'Settings'], ['Esc', 'Close settings']]
        .map(([k, t]) => `<div class="set-row"><div class="lbl">${t}</div><kbd>${k}</kbd></div>`).join('')),
  };
}

function syncControls() {
  const root = $('#setPanes'); if (!root || !root.childElementCount) return;
  $$('[data-k]', root).forEach(el => {
    const v = getK(el.dataset.k);
    if (el.classList.contains('seg')) $$('button', el).forEach(b => b.classList.toggle('on', String(v) === b.dataset.v));
    else if (el.type === 'checkbox') el.checked = !!v;
    else if (el.type === 'range') el.value = v;
  });
  $$('[data-val]', root).forEach(el => {
    const v = getK(el.dataset.val), u = el.dataset.unit;
    el.textContent = u === '×' ? (+v).toFixed(2) + '×' : v + u;
  });
  $$('.skin', root).forEach(b => b.classList.toggle('on', b.dataset.skin === CFG.amp.skin));
  const cols = $('#ampColors'); if (cols) cols.hidden = CFG.amp.skin !== 'custom';
  $$('[data-color]', root).forEach(i => { i.value = CFG.amp.colors[i.dataset.color]; });
  $$('#setThemes .theme-opt').forEach(b => b.classList.toggle('active', b.dataset.theme === document.documentElement.dataset.theme));
}

function previewAmp(on) {
  const box = $('#ampPreview');
  if (on && box && !ampOpen()) {
    box.prepend(ampEl); S.ampPreview = true; $('#ampPreviewNote').textContent = '';
    startViz();
  } else if (on && box) {
    $('#ampPreviewNote').textContent = 'Your mini amp is open, so changes apply to it live.';
  } else if (S.ampPreview) {
    S.ampPreview = false;
    if (!ampOpen()) $('#ampHost').prepend(ampEl);
  }
}

function showTab(tab) {
  $$('#setTabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.set-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === tab));
  previewAmp(tab === 'amp');
  if (tab === 'audio') renderEngine();
}

function openSettings(tab = 'general') {
  const panes = $('#setPanes');
  if (!panes.childElementCount) {
    const h = settingsHTML();
    panes.innerHTML = Object.entries(h).map(([id, html]) => `<div class="set-pane" data-pane="${id}">${html}</div>`).join('');
    $$('[data-logo]', panes).forEach(el => { el.innerHTML = LOGO; });
    $('#setThemes').innerHTML = $('#themeList').innerHTML;
    bindSettings(panes);
  }
  $('#settings').classList.remove('hidden');
  $('#themePanel').classList.add('hidden'); $('#userMenu').classList.add('hidden');
  if (IS_APP) window.amplite.info().then(i => { $('#aboutVer').textContent = ` v${i.version}`; });
  syncControls();
  showTab(tab);
}
function closeSettings() {
  if ($('#settings').classList.contains('hidden')) return;
  $('#settings').classList.add('hidden');
  previewAmp(false);
}

function bindSettings(root) {
  root.addEventListener('click', e => {
    const segBtn = e.target.closest('.seg button');
    if (segBtn) { const s = segBtn.parentElement; setK(s.dataset.k, s.dataset.type === 'num' ? +segBtn.dataset.v : segBtn.dataset.v); return; }
    const skin = e.target.closest('.skin');
    if (skin) {
      // Picking "Custom" starts from whatever skin was showing, so it's easy to tweak.
      if (skin.dataset.skin === 'custom' && CFG.amp.skin !== 'custom' && SKINS[CFG.amp.skin]?.lcd) {
        const { name, ...cols } = SKINS[CFG.amp.skin]; CFG.amp.colors = { ...CFG.amp.colors, ...cols };
      }
      setK('amp.skin', skin.dataset.skin); return;
    }
    const th = e.target.closest('#setThemes .theme-opt');
    if (th) { applyTheme(th.dataset.theme); syncControls(); applyAmp(); return; }
    if (e.target.closest('#ampReset')) { CFG.amp = clone(AMP_DEFAULTS); store.set('cfg', CFG); applyAmp(); syncControls(); toast('Mini amp reset'); return; }
    if (e.target.closest('#engRestart')) { window.amplite.engineRestart(); toast('Restarting audio engine…'); return; }
    if (e.target.closest('#engRelink')) { window.amplite.engineRestart({ forget: true }); toast('Re-linking — approve Amplite in your browser.'); return; }
    if (e.target.closest('#aboutUpd')) { $('#updBtn').click(); }
  });
  root.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.k && el.type === 'checkbox') setK(el.dataset.k, el.checked);
  });
  root.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.k && el.type === 'range') setK(el.dataset.k, +el.value);
    if (el.dataset.color) { CFG.amp.colors[el.dataset.color] = el.value; setK('amp.skin', 'custom'); }
  });
  $('#setTabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); };
  $('#settings').addEventListener('click', e => { if (e.target.id === 'settings' || e.target.closest('[data-close-settings]')) closeSettings(); });
}

/* ---------------- updates (desktop app) ---------------- */
const U = { state: 'idle', version: '', manual: false };
function renderUpdate() {
  const b = $('#updBtn'); if (!b) return;
  b.className = 'upd-pill';
  const v = 'v' + U.version;
  switch (U.state) {
    case 'checking': b.textContent = 'Checking for updates…'; b.classList.add('busy'); break;
    case 'downloading': b.textContent = `Downloading update${U.percent != null ? ` ${U.percent}%` : '…'}`; b.classList.add('busy'); break;
    case 'ready': b.textContent = `Update ${U.next} ready — restart`; b.classList.add('ready'); b.title = 'Restart to install'; break;
    case 'error': b.textContent = `${v} · update failed`; b.classList.add('err'); b.title = U.message || ''; break;
    default: b.textContent = v; b.title = 'Check for updates';
  }
}
function initUpdates() {
  window.amplite.info().then(i => { U.version = i.version; $('#verLine').textContent = `Amplite v${i.version}`; renderUpdate(); });
  window.amplite.onUpdate(s => {
    if (s.state === 'downloading' && s.version) U.next = 'v' + s.version;
    if (s.state === 'ready') U.next = 'v' + s.version;
    U.percent = s.percent ?? (s.state === 'downloading' ? U.percent : null);
    U.message = s.message;
    U.state = s.state === 'latest' ? 'idle' : s.state;
    if (U.manual && s.state === 'latest') toast(`You're on the latest version (v${U.version}).`);
    if (U.manual && s.state === 'error') toast('Update check failed: ' + (s.message || 'unknown error'));
    if (s.state === 'ready') toast(`Amplite ${U.next} is ready — click the update button in the title bar to restart.`);
    if (s.state !== 'checking') U.manual = false;
    renderUpdate();
  });
  const check = () => {
    if (U.state === 'ready') return window.amplite.installUpdate();
    if (U.state === 'checking' || U.state === 'downloading') return;
    U.manual = true; window.amplite.checkUpdate();
  };
  $('#updBtn').onclick = check;
  $('#updMenuBtn').onclick = check;
}

/* ---------------- boot ---------------- */
function showLogin(err) {
  $('#app').classList.add('hidden');
  $('#login').classList.remove('hidden');
  $('#redirectUri').textContent = REDIRECT_URI;
  if (err) { $('#loginErr').textContent = err; $('#loginErr').classList.remove('hidden'); }
}

async function boot() {
  if (IS_APP) {
    document.documentElement.classList.add('is-app');
    window.amplite.onMedia(cmd => ({ toggle: togglePlay, next, prev, stop })[cmd]?.());
    $('[data-amp="popout"]').remove();
    $('[data-amp="close"]').title = 'Back to full player';
    $('.amp-hint').textContent = '';
    initUpdates();
  }
  $$('[data-i]').forEach(el => el.insertAdjacentHTML('afterbegin', svg(el.dataset.i)));
  $$('[data-logo]').forEach(el => { el.innerHTML = LOGO; });
  renderThemes();
  bind();
  applyUI();
  applyAmp();
  syncVolume();

  try { await handleCallback(); } catch (e) { return showLogin(e.message); }
  if (!store.get('token')) return showLogin();

  try { S.me = await api('/me'); }
  catch (e) {
    if (e.status === 403) return showLogin('Spotify blocked this account. In Development Mode the app owner needs Premium, and every user must be added under User Management in the dashboard.');
    store.del('token');
    return showLogin(e.message === 'Not logged in' ? '' : e.message);
  }

  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  const name = S.me.display_name || S.me.id;
  $('#userBtn').innerHTML = (img(S.me.images, 32) ? `<img src="${esc(img(S.me.images, 32))}" alt="">` : `<span class="av">${esc(name[0]?.toUpperCase() || '?')}</span>`) + `<span>${esc(name)}</span>`;

  updatePlayerUI();
  await loadPlaylists();
  navigate('home');
  if (IS_APP) initEngine(); else initSDK();
  poll();
  setInterval(poll, 3000);
  setInterval(tickBar, 250);
  startViz();
}

boot();
