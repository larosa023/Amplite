// Amplite — a lightweight Spotify player
// Pure ES modules, no build step. Auth uses PKCE, so only the public Client ID lives here.

// The built-in Spotify app. Anyone can use their own instead (login screen → "Use your own Spotify app"),
// so they don't have to be added to this app's 5-user list.
const DEFAULT_CLIENT_ID = '8d242b5e87d1482ea0ce0978b9d2cf83';
const clientId = () => store.get('clientId') || DEFAULT_CLIENT_ID;
const ownClientId = () => !!store.get('clientId');
const IS_APP = !!window.amplite; // running inside the Amplite desktop app
const HOME_URI = location.origin + location.pathname.replace(/(index\.html|callback)$/, '');
// Desktop app: Spotify's recommended loopback form, e.g. http://127.0.0.1:43821/callback
const REDIRECT_URI = window.amplite ? location.origin + '/callback' : HOME_URI;
const SCOPES = [
  'streaming', 'user-read-email', 'user-read-private',
  'user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing',
  'user-library-read', 'user-library-modify',
  'playlist-read-private', 'playlist-read-collaborative',
  'playlist-modify-public', 'playlist-modify-private',
  'user-top-read', 'user-read-recently-played',
].join(' ');

const THEMES = [
  ['midnight', 'Midnight'], ['spotify', 'Spotify'], ['classic', 'Classic Amp'], ['nord', 'Nord'],
  ['dracula', 'Dracula'], ['sakura', 'Sakura'], ['ocean', 'Ocean'], ['paper', 'Paper'],
  ['amoled', 'AMOLED Black'], ['amoled-red', 'AMOLED Red'], ['amoled-pink', 'AMOLED Pink'], ['catppuccin', 'Catppuccin'], ['tokyo', 'Tokyo Night'],
  ['rosepine', 'Rosé Pine'], ['gruvbox', 'Gruvbox'], ['solarized', 'Solarized'], ['monokai', 'Monokai'],
  ['forest', 'Forest'], ['sunset', 'Sunset'], ['snow', 'Snow (light)'],
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
  scroll: 'normal', time: 'elapsed', opacity: 100, onTop: true, snap: true, corner: 'none', eqOpen: false, lyricLine: false,
};
const EQ_DEFAULTS = { enabled: false, preamp: 0, auto: true, preset: 'flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
const DEFAULTS = { ui: { sideMin: false, lite: false, accent: '', closeToTray: true, startup: 'off', hwAccel: true }, eq: EQ_DEFAULTS, amp: AMP_DEFAULTS, audio: { bitrate: 320, normalise: false, source: 'auto', hideSpotify: true } };
const clone = o => JSON.parse(JSON.stringify(o));
const CFG = (() => {
  const saved = store.get('cfg', {}) || {}, c = clone(DEFAULTS);
  for (const k of Object.keys(c)) Object.assign(c[k], saved[k] || {});
  c.amp.colors = { ...AMP_DEFAULTS.colors, ...(saved.amp?.colors || {}) };
  c.eq.gains = Array.isArray(saved.eq?.gains) && saved.eq.gains.length === 10 ? saved.eq.gains : [...EQ_DEFAULTS.gains];
  return c;
})();
const getK = k => k.split('.').reduce((o, p) => o?.[p], CFG);
function setK(k, v) {
  const parts = k.split('.'), last = parts.pop();
  parts.reduce((o, p) => o[p], CFG)[last] = v;
  store.set('cfg', CFG);
  if (k === 'amp.lyricLine') syncLyricsForTrack();
  if (k === 'amp.corner') setTimeout(() => fitAmp(true), 0);
  if (k.startsWith('eq.')) applyEq();
  else if (k.startsWith('amp.')) applyAmp();
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
  pin: '<path d="M12 17v5M9 3h6l-1 6 4 4H6l4-4z"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>',
  queue: '<path d="M3 6h13M3 12h13M3 18h9M17 15v6l5-3z"/>',
  disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>', listadd: '<path d="M3 6h12M3 12h12M3 18h7M18 13v8M14 17h8"/>',
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
// toast('Saved') or toast('Removed', { label: 'Undo', run: fn }) for a clickable action.
function toast(msg, action) {
  const t = $('#toast'); t.textContent = msg;
  if (action) {
    const b = document.createElement('button'); b.className = 'toast-btn'; b.textContent = action.label;
    b.onclick = e => { e.stopPropagation(); t.classList.remove('show'); action.run(); };
    t.append(b);
  }
  t.classList.toggle('has-action', !!action); t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), action ? 7000 : 3600);
}

/* ---------------- auth (PKCE) ---------------- */
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function login() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(64)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  store.set('verifier', verifier);
  location.href = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
    client_id: clientId(), response_type: 'code', redirect_uri: REDIRECT_URI,
    scope: SCOPES, code_challenge_method: 'S256', code_challenge: challenge,
  });
}

async function tokenRequest(params) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId(), ...params }),
  });
  const t = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(t.error_description || `Spotify login failed (${r.status})`);
  const prev = store.get('token') || {};
  const tok = { access_token: t.access_token, refresh_token: t.refresh_token || prev.refresh_token, expires_at: Date.now() + (t.expires_in - 60) * 1000, scope: t.scope || prev.scope || '' };
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
  try { Object.keys(localStorage).filter(k => k.startsWith('amplite:swr:')).forEach(k => localStorage.removeItem(k)); } catch {}
  try { S.player?.disconnect(); } catch {}
  location.href = HOME_URI;
}

/* ---------------- Web API ---------------- */
const apiCache = new Map(); // url -> { t, data }  (GET responses, 2 min)
const cacheable = (method, url) => method === 'GET' && !/\/me\/player(?!\/recently-played)|\/contains/.test(url);
// Stale-while-revalidate across launches for the data the first screen needs, so Amplite opens instantly.
const SWR = /\/v1\/me(\?|$)|\/v1\/me\/playlists|\/v1\/me\/player\/recently-played|\/v1\/me\/top\/tracks/;
const swrGet = url => { const v = store.get('swr:' + url); return v && Date.now() - v.t < 7 * 864e5 ? v.data : null; };
const swrListeners = [];
function swrRefresh(url, path, opts) {
  api(path, { ...opts, fresh: true }).then(data => {
    const old = JSON.stringify(swrGet(url)), now = JSON.stringify(data);
    store.set('swr:' + url, { t: Date.now(), data });
    if (old !== now) swrListeners.forEach(f => f(url, data));
  }).catch(() => {});
}
const purgeCache = re => { for (const k of apiCache.keys()) if (re.test(k)) apiCache.delete(k); };
async function api(path, { method = 'GET', body, query, fresh = false } = {}, retry = true) {
  let url = path.startsWith('http') ? path : 'https://api.spotify.com/v1' + path;
  if (query) url += (url.includes('?') ? '&' : '?') + new URLSearchParams(query);
  if (cacheable(method, url) && !fresh) {
    const hit = apiCache.get(url);
    if (hit && Date.now() - hit.t < 120000) return hit.data;
    if (SWR.test(url)) {
      const stale = swrGet(url);
      if (stale) { apiCache.set(url, { t: Date.now(), data: stale }); swrRefresh(url, path, { method, body, query }); return stale; }
    }
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
  if (cacheable(method, url)) {
    apiCache.set(url, { t: Date.now(), data });
    if (apiCache.size > 250) { // keep memory flat over long sessions: drop expired, then oldest
      const now = Date.now();
      for (const [k, v] of apiCache) if (now - v.t > 120000) apiCache.delete(k);
      while (apiCache.size > 200) apiCache.delete(apiCache.keys().next().value);
    }
    if (SWR.test(url) && !fresh) store.set('swr:' + url, { t: Date.now(), data });
  }
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
// Where audio comes from: the bundled engine, or the official Spotify app (fallback for
// accounts Spotify refuses to give engine decryption keys to).
const refusedKey = () => 'keyRefused:' + (S.me?.id || '');
const engineRefused = () => !!store.get(refusedKey(), false);
// The in-app web player (Spotify's official Web Playback SDK + Widevine) only works once the
// app is castLabs VMP-signed; remember per app version whether Spotify rejected it.
const webKey = () => 'webBlocked:' + (S.appVersion || '?');
const webBlocked = () => !!store.get(webKey(), false);
const playMode = () => {
  if (!IS_APP) return 'web';
  const src = CFG.audio.source;
  if (src === 'app' || src === 'engine' || src === 'web') return src;
  if (!engineRefused()) return 'engine';
  return webBlocked() ? 'app' : 'web';
};
const useEngine = () => IS_APP && playMode() === 'engine' && S.engine && S.engine.state !== 'missing';
const useApp = () => IS_APP && playMode() === 'app';
const useWeb = () => IS_APP && playMode() === 'web';
// Is the main window really on screen? With background throttling off (needed for audio timing),
// Electron reports hidden/minimised windows as visible, so the main process tells us directly.
let winHidden = false;
const mainHidden = () => document.hidden || winHidden;
function onWinVisibility(visible) {
  const was = winHidden; winHidden = !visible;
  if (was && visible) { if (S.markDirty) markPlaying(); updatePlayerUI(); poll(); schedulePoll(); startViz(); }
  else if (!was && !visible) schedulePoll();
}
const pos = () => {
  const n = S.now; if (!n) return 0;
  return n.paused ? n.position : Math.min(n.duration, n.position + (performance.now() - n.ts));
};

/* ---------------- Web Playback SDK ---------------- */
function initSDK() {
  if (S.sdkStarted) return; S.sdkStarted = true;
  window.onSpotifyWebPlaybackSDKReady = () => {
    const p = new Spotify.Player({ name: IS_APP ? `Amplite Web (${S.appHost || 'PC'})` : 'Amplite', getOAuthToken: cb => getToken().then(cb), volume: S.volume });
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
    p.addListener('initialization_error', ({ message }) => { console.warn('SDK init:', message); webFail('init: ' + message); });
    p.addListener('authentication_error', ({ message }) => { console.warn('SDK auth:', message); webFail('auth: ' + message); });
    p.addListener('account_error', ({ message }) => { console.warn('SDK account:', message); webFail('account: ' + message); });
    p.addListener('playback_error', ({ message }) => {
      console.warn('Playback:', message);
      S.webErrors = (S.webErrors || 0) + 1;
      if (S.webErrors >= 2 || /license|drm|eme|widevine|key|decrypt/i.test(message || '')) webFail('playback: ' + message);
      else if (!IS_APP && !S.drmWarned) { S.drmWarned = true; toast('Spotify blocked in-app playback here — open the Spotify app and Amplite will control it.'); }
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
// Every user action bumps this; a status check that started before the action is thrown away,
// and for a moment afterwards what the user just did wins over Spotify's (slightly laggy) report.
function acted(opt = {}) { S.actSeq = (S.actSeq || 0) + 1; S.opt = { ...opt, until: Date.now() + 1500 }; }
async function poll() {
  const seq = S.actSeq || 0, mine = S.pollIssued = (S.pollIssued || 0) + 1;
  try {
    const d = await api('/me/player');
    S.pollFails = 0; S.pollOkAt = Date.now();
    if ((S.actSeq || 0) !== seq) return; // stale: the user did something while this was in flight
    if (mine < (S.pollApplied || 0)) return; // an older check finished after a newer one
    S.pollApplied = mine;
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
    if (S.opt && Date.now() < S.opt.until) {
      for (const k of ['paused', 'shuffle', 'repeat']) if (k in S.opt) S.now[k] = S.opt[k];
      if ('position' in S.opt && S.opt.uri === t.uri) S.now.position = S.opt.position + (performance.now() - S.opt.ts);
    }
    // Volume changed on another device / in the Spotify app.
    const vp = d.device?.volume_percent;
    if (vp != null && Date.now() - (S.volAt || 0) > 2000 && Math.abs(vp / 100 - S.volume) > 0.01) { S.volume = vp / 100; syncVolume(); }
    updatePlayerUI();
  } catch { S.pollFails = (S.pollFails || 0) + 1; }
}
const pollSoon = (ms = 700) => setTimeout(poll, ms);
const pollBurst = () => { pollSoon(350); pollSoon(1100); pollSoon(2200); };

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
// Called when Spotify's web player can't play inside Amplite (usually: app not VMP-signed yet).
function webFail(reason) {
  S.webLastError = reason;
  if (!useWeb() || webBlocked()) return;
  if (CFG.audio.source === 'auto') {
    store.set(webKey(), true);
    toast('The in-app web player isn’t available in this build yet — using the Spotify app for now.');
    renderEngine(); updatePlayerUI();
    // Re-send whatever was just requested to the next playback source.
    if (S.lastPlay && Date.now() - S.lastPlay.t < 60000) startPlayback(S.lastPlay.body);
    else if (S.now && !S.now.paused) playHere();
  } else toast('The in-app web player couldn’t play (' + reason + '). See Settings → Audio.');
}
async function webTarget() {
  if (!S.appHost) { try { S.appHost = (await window.amplite.spotifyApp('check')).host; } catch {} }
  initSDK();
  for (let i = 0; i < 40 && !S.deviceId && useWeb(); i++) await sleep(250);
  if (!S.deviceId) { webFail('the web player didn’t start'); return undefined; } // webFail re-sends the play request to the next source
  return S.deviceId;
}
// Watchdog: if the web player "plays" but the position never moves, DRM was refused silently.
function watchWeb() {
  clearTimeout(S.webWatch);
  const t0 = Date.now();
  S.webWatch = setTimeout(async () => {
    if (!useWeb() || !S.player) return;
    let st = null; try { st = await S.player.getCurrentState(); } catch {}
    // Nothing loaded at all, or "playing" but stuck at the start: the web player isn't allowed to play.
    if (!st || (!st.paused && st.position < 1500)) webFail(st ? 'stuck at 0:00' : 'no player state after 8 s');
  }, 8000);
}

async function findSpotifyApp() {
  try {
    const d = await api('/me/player/devices');
    const host = (S.appHost || '').toLowerCase();
    const pcs = (d?.devices || []).filter(x => x.type === 'Computer' && !/^Amplite/.test(x.name) && !x.is_restricted);
    const dev = pcs.find(x => x.name.toLowerCase() === host) || pcs[0];
    if (dev) { S.appDeviceId = dev.id; S.appDeviceName = dev.name; return dev.id; }
  } catch {}
  return null;
}
async function spotifyAppTarget() {
  let id = await findSpotifyApp();
  if (id) return id;
  const info = await window.amplite.spotifyApp('check');
  S.appHost = info.host;
  if (!info.installed) toast('Starting Spotify… (if nothing happens, install the Spotify desktop app from spotify.com/download)');
  else toast('Starting Spotify in the background…');
  const r = await window.amplite.spotifyApp('launch', { hide: CFG.audio.hideSpotify });
  if (!r.ok) { toast('Couldn’t start Spotify: ' + (r.error || 'unknown')); return undefined; }
  for (let i = 0; i < 30; i++) { await sleep(1000); id = await findSpotifyApp(); if (id) return id; }
  toast('Spotify didn’t show up — open the Spotify app once, then press play again.');
  return undefined;
}

// Spots the two account problems that break playback for new users.
function accountProblem() {
  if (S.me?.product && S.me.product !== 'premium')
    return { kind: 'free', msg: `Your Spotify account (${S.me.display_name || S.me.id}) is on the ${S.me.product} plan. Spotify only allows playback in apps like Amplite on Premium.` };
  const eu = S.engine?.user, me = S.me?.id;
  if (eu && me && eu.toLowerCase() !== me.toLowerCase())
    return { kind: 'mismatch', msg: `The audio engine is signed in as “${eu}”, but Amplite is logged in as “${S.me.display_name || me}”. Click Re-link and approve with your own Spotify account.` };
  return null;
}
async function target() {
  if (useApp()) return spotifyAppTarget();
  if (useWeb()) { const id = await webTarget(); if (id && useWeb()) watchWeb(); return id; }
  if (useEngine()) {
    const prob = accountProblem();
    if (prob) { toast(prob.kind === 'free' ? 'Playback needs Spotify Premium — see Settings → Audio.' : 'The audio engine is signed into a different Spotify account — see Settings → Audio.'); openSettings('audio'); return undefined; }
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
    : e.state === 'ready' ? (e.format ? `Ready · now streaming ${/MP3/.test(e.format) ? 'MP3' : 'Ogg Vorbis'} ${e.streamKbps} kbps${e.streamKbps && e.streamKbps < e.bitrate ? ` (${e.bitrate} isn’t available for this track on your account)` : ''}` : `Ready · ${e.bitrate} kbps`) : e.state === 'auth' ? 'Waiting for one-time approval in your browser'
    : e.state === 'error' ? 'Error: ' + (e.detail || 'unknown') : /restart/i.test(e.detail || '') ? 'Restarting…' : 'Starting…';
  if (useWeb()) {
    el.className = 'engine-line ' + (S.deviceId ? 'ready' : 'starting');
    el.innerHTML = `<span class="dot"></span><span>${S.deviceId ? 'Playing inside Amplite with Spotify’s web player (official DRM, about 256 kbps AAC)' : 'Starting Amplite’s web player…'}${CFG.audio.source === 'auto' ? ' — the built-in engine is refused for this account' : ''}.</span>`;
    return;
  }
  if (useApp()) {
    const why = CFG.audio.source === 'app' ? 'you chose the Spotify app'
      : webBlocked() ? 'Spotify refuses the built-in engine for this account, and the in-app web player needs a signed build (see README)'
      : 'Spotify refuses the built-in engine’s audio keys for this account';
    el.className = 'engine-line ready';
    el.innerHTML = `<span class="dot"></span><span>Playing through the Spotify desktop app${S.appDeviceName ? ` (“${esc(S.appDeviceName)}”)` : ''} — ${why}. Quality follows the Spotify app’s own setting.</span>`;
    return;
  }
  const prob = accountProblem();
  el.className = 'engine-line ' + (prob ? 'error' : e?.state || '');
  el.innerHTML = `<span class="dot"></span><span>${esc(prob ? prob.msg : label)}${e?.user && !prob ? `<small class="muted"> · signed in as ${esc(e.user)}</small>` : ''}${e?.name ? `<small class="muted"> · device “${esc(e.name)}”</small>` : ''}</span>`;
}

async function copyDiagnostics() {
  const lines = [];
  const add = (k, v) => lines.push(`${k}: ${v}`);
  try { const i = await window.amplite?.info(); add('Amplite', i ? 'v' + i.version : 'web'); } catch {}
  add('Platform', navigator.userAgentData?.platform || navigator.platform);
  add('Account', `${S.me?.id} · ${S.me?.product || '?'} · ${S.me?.country || '?'}`);
  add('Engine', JSON.stringify(S.engine || null));
  add('Engine device id', S.engineId || '(not found)');
  add('Problem', accountProblem()?.msg || 'none detected');
  try { const d = await api('/me/player/devices'); add('Devices', (d?.devices || []).map(x => `${x.name} [${x.type}${x.is_active ? ', active' : ''}${x.is_restricted ? ', restricted' : ''}]`).join(' | ') || 'none'); } catch (e) { add('Devices', 'error ' + e.message); }
  try { const p = await api('/me/player'); add('Now', p?.item ? `${p.item.name} on ${p.device?.name} (${p.is_playing ? 'playing' : 'paused'})` : 'nothing'); } catch (e) { add('Now', 'error ' + e.message); }
  add('Settings', JSON.stringify(CFG.audio) + ` · mode=${playMode()} · engineRefused=${engineRefused()} · webBlocked=${webBlocked()} · webError=${S.webLastError || '-'} · webDevice=${S.deviceId ? 'yes' : 'no'} · spotifyApp=${S.appInstalled ? 'installed' : 'not found'}`);
  if (IS_APP) { try { lines.push('--- engine log ---', ...(await window.amplite.engineLogs())); } catch {} }
  const text = lines.join('\n');
  try { await navigator.clipboard.writeText(text); toast('Diagnostics copied — paste them to whoever is helping you.'); }
  catch { console.log(text); toast('Couldn’t copy automatically.'); }
}
const audioOpts = () => ({ volume: Math.round(S.volume * 100), bitrate: CFG.audio.bitrate, normalise: CFG.audio.normalise });
let audioT;
function applyAudio() {
  if (!IS_APP) return;
  if (S.lastMode !== playMode()) {
    S.lastMode = playMode();
    if (playMode() === 'engine') window.amplite.engineStart(audioOpts()); else window.amplite.engineStop();
    if (playMode() === 'web') initSDK();
    renderEngine(); updatePlayerUI();
    if (S.now && !S.now.paused) playHere();
    return;
  }
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
    if (st.user && st.user !== S.lastEngineUser) {
      S.lastEngineUser = st.user;
      const prob = accountProblem();
      if (prob?.kind === 'mismatch') { toast('The audio engine is signed into a different Spotify account.'); openSettings('audio'); }
    }
    if (st.keyRefused && CFG.audio.source === 'auto' && !engineRefused() && S.me?.id && (!st.user || st.user.toLowerCase() === S.me.id.toLowerCase())) {
      store.set(refusedKey(), true); S.lastMode = playMode();
      toast(webBlocked() ? 'Spotify won’t let the built-in engine play for this account — switching to the Spotify app.' : 'Spotify won’t let the built-in engine play for this account — switching to Amplite’s web player.');
      window.amplite.engineStop();
      if (S.now && S.now.device === st.name) playHere();
    }
    if (st.state === 'missing') initSDK();
    renderEngine(); updatePlayerUI();
  });
  S.lastMode = playMode();
  window.amplite.spotifyApp('check').then(i => {
    S.appHost = i.host; S.appInstalled = i.installed;
    if (useApp()) findSpotifyApp().then(() => { renderEngine(); updatePlayerUI(); });
    if (useWeb()) initSDK();
  });
  window.amplite.engineStatus().then(st => {
    S.engine = st;
    if (st.state === 'missing') { initSDK(); return; }
    if (playMode() === 'engine') window.amplite.engineStart(audioOpts());
    applyEq();
    renderEngine();
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
  S.lastPlay = { body, t: Date.now() }; acted();
  const mySeq = S.playSeq = (S.playSeq || 0) + 1;
  const dev = await target();
  if (mySeq !== S.playSeq) return; // a newer click happened while we waited for the device
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
  acted({ paused: false }); S.now.position = pos(); S.now.paused = false; S.now.ts = performance.now(); updatePlayerUI();
  try { await api('/me/player/play', { method: 'PUT' }); pollSoon(900); } catch (e) { S.opt = null; fail(e); pollSoon(200); }
}
async function pause() {
  if (!S.now) return;
  if (isLocal()) return S.player.pause();
  acted({ paused: true }); S.now.position = pos(); S.now.paused = true; updatePlayerUI();
  try { await api('/me/player/pause', { method: 'PUT' }); pollSoon(900); } catch (e) { S.opt = null; fail(e); pollSoon(200); }
}
const togglePlay = () => { activate(); return !S.now || S.now.paused ? resume() : pause(); };
async function next() {
  if (isLocal()) return S.player.nextTrack();
  acted(); try { await api('/me/player/next', { method: 'POST' }); pollBurst(); } catch (e) { fail(e); }
}
async function prev() {
  if (isLocal()) return S.player.previousTrack();
  acted(); try { await api('/me/player/previous', { method: 'POST' }); pollBurst(); } catch (e) { fail(e); }
}
async function seek(ms) {
  if (!S.now) return;
  ms = Math.max(0, Math.round(ms));
  S.now.position = ms; S.now.ts = performance.now();
  if (isLocal()) return S.player.seek(ms);
  acted({ position: ms, uri: S.now.uri, ts: performance.now() });
  try { await api('/me/player/seek', { method: 'PUT', query: { position_ms: ms } }); pollSoon(1200); } catch (e) { fail(e); }
}
async function stop() { await pause(); await seek(0); if (S.now) { S.now.paused = true; S.opt = { ...S.opt, paused: true }; updatePlayerUI(); } }
async function toggleShuffle() {
  if (!S.now) return;
  const v = !S.now.shuffle, was = S.now.shuffle;
  acted({ shuffle: v }); S.now.shuffle = v; updatePlayerUI();
  try { await api('/me/player/shuffle', { method: 'PUT', query: { state: v } }); } catch (e) { S.opt = null; S.now.shuffle = was; updatePlayerUI(); fail(e); }
}
async function cycleRepeat() {
  if (!S.now) return;
  const v = ((S.now.repeat || 0) + 1) % 3, was = S.now.repeat;
  acted({ repeat: v }); S.now.repeat = v; updatePlayerUI();
  try { await api('/me/player/repeat', { method: 'PUT', query: { state: ['off', 'context', 'track'][v] } }); } catch (e) { S.opt = null; S.now.repeat = was; updatePlayerUI(); fail(e); }
}
let volT;
function setVolume(v) {
  v = Math.max(0, Math.min(1, v));
  S.volume = v; store.set('volume', v); if (v > 0) S.lastVol = v; S.volAt = Date.now();
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
const renderLike = () => {
  $('#likeBtn').classList.toggle('liked', S.liked);
  const al = $('[data-amp="like"]', ampEl);
  if (al) { al.classList.toggle('on', S.liked); al.textContent = S.liked ? '♥' : '♡'; al.title = S.liked ? 'Remove from Liked Songs' : 'Save to Liked Songs'; }
};

/* ---------------- player UI ---------------- */
// Only touch the DOM when something visibly changes: each write costs a style/paint pass,
// and these run several times a second.
function setRange(el, frac) {
  frac = Math.max(0, Math.min(1, frac || 0));
  const v = Math.round(frac * el.max);
  if (el._v === v) return;
  el._v = v; el.value = v;
  el.style.setProperty('--p', (v / el.max) * 100 + '%');
}
function setText(el, txt) { if (el && el._t !== txt) { el._t = txt; el.textContent = txt; } }
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
  $('[data-amp="play"]', ampEl)?.classList.toggle('lit', !!n && !n.paused);
  $('[data-amp="pause"]', ampEl)?.classList.toggle('lit', !!n && n.paused && pos() > 500);
  $('[data-amp="stop"]', ampEl)?.classList.toggle('lit', !n || (n.paused && pos() <= 500));
  A.rep.classList.toggle('on', !!n?.repeat);
  A.rep.textContent = n?.repeat === 2 ? 'REP1' : 'REP';
  A.dev.textContent = n?.device || 'stereo';

  const dev = $('#deviceBtn');
  const onEngine = (useEngine() && n?.device === S.engine?.name) || (useApp() && !!n && n.device === S.appDeviceName) || (useWeb() && n?.source === 'sdk');
  const canHere = useApp() || useWeb() ? true : useEngine() ? S.engine?.state === 'ready' : !!S.deviceId;
  if (n?.source === 'remote' && !onEngine) {
    dev.classList.remove('hidden');
    dev.textContent = `On ${n.device}${canHere ? ' · Play here' : ''}`;
    dev.disabled = !canHere;
  } else dev.classList.add('hidden');
  const kb = $('#ampKbps', ampEl); if (kb) kb.textContent = onEngine && useEngine() ? String(S.engine.streamKbps || S.engine.bitrate) : (n?.source === 'sdk' ? '256' : '---');
  const aa = A.art; if (aa && (n?.album?.image || '') !== aa.getAttribute('src')) aa.setAttribute('src', n?.album?.image || '');

  if ((n?.uri || null) !== S.likedUri) {
    checkLiked(n?.uri || null);
    syncLyricsForTrack();
    if (D.tab === 'queue') setTimeout(renderQueue, 400);
  }
  document.title = n ? `${n.name} · ${n.artists.map(a => a.name).join(', ')}` : 'Amplite';
  if (IS_APP) {
    const key = `${n?.uri}|${n?.paused}`;
    if (key !== S.trayKey) { S.trayKey = key; window.amplite.nowPlaying({ title: n?.name, artist: n?.artists?.map(a => a.name).join(', '), paused: !n || n.paused }); }
  }
  if ('mediaSession' in navigator && n && navigator.mediaSession.metadata?.title !== n.name) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: n.name, artist: n.artists.map(a => a.name).join(', '), album: n.album?.name || '', artwork: n.album?.image ? [{ src: n.album.image, sizes: '300x300' }] : [] });
    } catch {}
  }
  markPlaying();
}
function markPlaying() {
  if (mainHidden()) { S.markDirty = true; return; } // done when the window is shown again
  S.markDirty = false;
  const uri = S.now?.uri;
  $$('.trow.playing').forEach(r => r.classList.remove('playing'));
  if (uri) $$(`.trow[data-uri="${CSS.escape(uri)}"]`).forEach(r => r.classList.add('playing'));
}
const TB = {};
function tickBar() {
  if (!TB.cur) { TB.cur = $('#tCur'); TB.dur = $('#tDur'); TB.seek = $('#seek'); }
  if (D.lines.length) tickLyrics();
  if (mainHidden()) return;
  const n = S.now, d = n?.duration || 0, p = pos();
  if (!S.seeking) { setText(TB.cur, fmt(p)); setRange(TB.seek, d ? p / d : 0); }
  setText(TB.dur, fmt(d));
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
  S.lists = []; S.hero = null; S.pl = null; closeAddSongs();
  el.innerHTML = '<div class="loading"><span></span><span></span><span></span></div>';
  try { await VIEWS[name](el, arg, alive); }
  catch (e) { if (alive()) el.innerHTML = `<div class="empty"><h2>Couldn't load that</h2><p>${esc(e.message)}</p></div>`; }
  if (alive()) markPlaying();
}
function goBack() { if (!S.back.length) return; S.fwd.push(S.cur); const v = S.back.pop(); navigate(v.name, v.arg, false); }
function goFwd() { if (!S.fwd.length) return; S.back.push(S.cur); const v = S.fwd.pop(); navigate(v.name, v.arg, false); }

const pinAttr = o => `data-pinfo="${esc(JSON.stringify({ type: o.type, id: o.id, uri: o.uri, name: o.name, image: o.image || '' }))}"`;
function card({ kind, id, uri, title, sub, image, round }) {
  return `<div class="card ${round ? 'round' : ''}" data-open="${kind}:${esc(id)}" ${pinAttr({ type: kind, id, uri, name: title, image })}>
    <div class="art">${image ? `<img src="${esc(image)}" alt="" loading="lazy">` : `<div class="ph">${svg('music')}</div>`}
      <button class="card-play" data-play="${esc(uri)}" title="Play">${svg('play')}</button></div>
    <div class="card-title">${esc(title)}</div><div class="card-sub">${esc(sub || '')}</div></div>`;
}

function trackRows(tracks, { showAlbum, showArt, removable }, offset = 0) {
  const rm = removable ? `<button class="trm" data-rm title="Remove from this playlist">${svg('minus')}</button>` : '';
  return tracks.map((t, j) => { const i = j + offset; return `<div class="trow ${t.playable ? '' : 'dim'}" data-idx="${i}" data-uri="${esc(t.uri)}" data-q="${esc(`${t.name} ${t.artists.map(a => a.name).join(' ')} ${t.album?.name || ''}`.toLowerCase())}">
      <div class="tnum"><span>${i + 1}</span>${svg('play')}</div>
      <div class="tmain">${showArt && t.album?.image ? `<img src="${esc(t.album.image)}" alt="" loading="lazy" decoding="async">` : ''}
        <div class="ttext"><div class="tname">${esc(t.name)}</div><div class="tartist">${artistLinks(t.artists)}</div></div></div>
      ${showAlbum ? `<div class="talbum">${t.album?.id ? `<a data-open="album:${esc(t.album.id)}">${esc(t.album.name)}</a>` : esc(t.album?.name || '')}</div>` : ''}
      <div class="tdur">${rm}${fmt(t.duration)}</div></div>`; }).join('');
}
// Long lists: render the first rows immediately and the rest in small chunks between frames,
// so opening a 2,000-song library never blocks the window.
const FIRST_ROWS = 150, CHUNK_ROWS = 250;
function trackTable(tracks, { context = null, showAlbum = true, showArt = true, removable = false } = {}) {
  const li = S.lists.push({ tracks, orig: tracks, context, showAlbum, showArt, removable }) - 1;
  if (tracks.length > FIRST_ROWS) setTimeout(() => fillRows(li), 0);
  return `<div class="tracks ${showAlbum ? '' : 'no-album'}" data-list="${li}">
    <div class="thead"><span>#</span><span>Title</span>${showAlbum ? '<span>Album</span>' : ''}<span class="tdur">${svg('clock')}</span></div>
    <div class="tbody">${trackRows(tracks.slice(0, FIRST_ROWS), S.lists[li])}</div>
  </div>`;
}
function fillRows(li, from = FIRST_ROWS) {
  const L = S.lists[li], body = $(`.tracks[data-list="${li}"] .tbody`);
  if (!L || !body) return; // navigated away
  const gen = L.gen = (L.gen || 0) + (from === FIRST_ROWS ? 1 : 0);
  const step = start => {
    if (L.gen !== gen || !body.isConnected) return; // list was re-sorted or the page changed
    const part = L.tracks.slice(start, start + CHUNK_ROWS);
    if (!part.length) { applyListFilter(); markPlaying(); return; }
    body.insertAdjacentHTML('beforeend', trackRows(part, L, start));
    requestAnimationFrame(() => step(start + CHUNK_ROWS));
  };
  requestAnimationFrame(() => step(from));
}

/* ---- filter / sort / shuffle for the page's main track list ---- */
const SORTS = {
  default: ['Custom order', null],
  added: ['Recently added', (a, b) => (b.added || '').localeCompare(a.added || '')],
  title: ['Title', (a, b) => a.name.localeCompare(b.name)],
  artist: ['Artist', (a, b) => (a.artists[0]?.name || '').localeCompare(b.artists[0]?.name || '') || a.name.localeCompare(b.name)],
  album: ['Album', (a, b) => (a.album?.name || '').localeCompare(b.album?.name || '')],
  duration: ['Duration', (a, b) => a.duration - b.duration],
};
function listToolsHTML() {
  return `<button class="icon-btn big-shuffle" data-hero-shuffle title="Shuffle play">${svg('shuffle')}</button>
    <div class="list-tools">
      <div class="filter-box">${svg('search')}<input id="listFilter" type="search" placeholder="Filter" autocomplete="off" spellcheck="false"></div>
      <select id="listSort" title="Sort">${Object.entries(SORTS).map(([k, [n]]) => `<option value="${k}">${n}</option>`).join('')}</select>
    </div>`;
}
function applyListFilter() {
  const q = ($('#listFilter')?.value || '').trim().toLowerCase();
  const tbl = $('.tracks[data-list="0"]'); if (!tbl) return;
  let shown = 0;
  for (const r of tbl.querySelectorAll('.trow')) { const ok = !q || r.dataset.q.includes(q); r.hidden = !ok; if (ok) shown++; }
  const meta = $('#listCount'); if (meta) meta.textContent = q ? `${shown} of ${S.lists[0].tracks.length} songs match` : '';
}
function applyListSort(key) {
  const L = S.lists[0], tbl = $('.tracks[data-list="0"] .tbody'); if (!L || !tbl) return;
  const cmp = SORTS[key]?.[1];
  L.tracks = cmp ? [...L.orig].sort(cmp) : L.orig;
  tbl.innerHTML = trackRows(L.tracks.slice(0, FIRST_ROWS), L);
  if (L.tracks.length > FIRST_ROWS) fillRows(0);
  store.set('sort:' + S.cur?.name, key);
  applyListFilter(); markPlaying();
}
async function shufflePlay() {
  const L = S.lists[0]; if (!L) return;
  const ok = L.tracks.filter(t => t.playable); if (!ok.length) return;
  if (L.context) {
    await startPlayback({ context_uri: L.context, offset: { position: Math.floor(Math.random() * L.orig.length) } });
    try { await api('/me/player/shuffle', { method: 'PUT', query: { state: true } }); if (S.now) S.now.shuffle = true; updatePlayerUI(); } catch {}
  } else {
    const sh = [...ok]; for (let i = sh.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [sh[i], sh[j]] = [sh[j], sh[i]]; }
    playUris(sh.map(t => t.uri), 0);
  }
}
function initListTools() {
  const f = $('#listFilter'); if (!f) return;
  let t; f.addEventListener('input', () => { clearTimeout(t); t = setTimeout(applyListFilter, 80); });
  const sel = $('#listSort'), saved = store.get('sort:' + S.cur?.name, 'default');
  sel.value = SORTS[saved] ? saved : 'default';
  if (sel.value !== 'default') applyListSort(sel.value);
  sel.onchange = () => applyListSort(sel.value);
}

function hero({ image, art, round, kind, title, desc, meta, pin, tools, extra }) {
  S.heroPin = pin || null;
  return `<header class="hero">
    ${art || (image ? `<img class="hero-art ${round ? 'round' : ''}" src="${esc(image)}" alt="">` : `<div class="hero-art ph">${svg('music')}</div>`)}
    <div class="hero-text"><div class="hero-kind">${esc(kind)}</div><h1>${esc(title)}</h1>
      ${desc ? `<p class="hero-desc">${esc(desc)}</p>` : ''}<div class="hero-meta">${meta || ''} <span id="listCount" class="muted"></span></div></div>
  </header><div class="actions pad"><button class="big-play" data-hero-play title="Play">${svg('play')}</button>
    ${tools ? listToolsHTML() : ''}${extra || ''}
    ${pin ? `<button class="pin-btn ${isPinned(pin) ? 'on' : ''}" data-pin-toggle title="${isPinned(pin) ? 'Unpin' : 'Pin to sidebar'}">${svg('pin')}<span>${isPinned(pin) ? 'Pinned' : 'Pin'}</span></button>` : ''}</div>`;
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
  const pinsHome = getPins().filter(p => p.type !== 'liked');
  const pinnedIds = new Set(pinsHome.map(p => p.id));
  const tileItems = [...pinsHome.map(p => ({ id: p.id, uri: p.uri, name: p.name, images: p.image ? [{ url: p.image }] : [], type: p.type })),
    ...S.playlists.filter(p => p && !pinnedIds.has(p.id)).map(p => ({ ...p, type: 'playlist' }))].slice(0, 7);
  const tiles = [`<div class="qtile" data-open="liked:" ${pinAttr({ type: 'liked', id: '', uri: '', name: 'Liked Songs' })}><div class="liked-mini">${svg('heart')}</div><span class="qname">Liked Songs</span></div>`]
    .concat(tileItems.map(p => `<div class="qtile" data-open="${p.type}:${esc(p.id)}" ${pinAttr({ type: p.type, id: p.id, uri: p.uri, name: p.name, image: img(p.images, 64) })}>
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
  const tracks = items.map(i => { const t = norm(i.track); if (t) t.added = i.added_at; return t; }).filter(Boolean);
  el.innerHTML = hero({
    art: `<div class="hero-art liked-art">${svg('heart')}</div>`, kind: 'Playlist', title: 'Liked Songs', tools: tracks.length > 0,
    pin: { type: 'liked', id: '', uri: '', name: 'Liked Songs', image: '' },
    meta: `${esc(S.me?.display_name || '')} · ${tracks.length} songs`,
  }) + `<div class="pad">${tracks.length ? trackTable(tracks) : '<p class="muted">Tap the heart on any song to save it here.</p>'}</div>`;
  initListTools();
}

async function viewPlaylist(el, id, alive) {
  const pl = await api(`/playlists/${id}`);
  if (!alive()) return;
  let tracks = [], note = '';
  try {
    const items = await pageAll(`/playlists/${id}/items`, { limit: 50 }, 2500);
    tracks = items.map(i => { const t = norm(i.item || i.track); if (t) t.added = i.added_at; return t; }).filter(Boolean);
  } catch (e) {
    note = e.status === 403 || e.status === 404
      ? 'Spotify only lets developer-mode apps list tracks for playlists you own or collaborate on. Hit play — it will still play.'
      : esc(e.message);
  }
  if (!alive()) return;
  S.hero = { context: pl.uri };
  const editable = canEdit(pl) && !note;
  S.pl = { id: pl.id, uri: pl.uri, name: pl.name, editable };
  const total = pl.items?.total ?? pl.tracks?.total ?? tracks.length;
  el.innerHTML = hero({
    image: img(pl.images), kind: pl.public === false ? 'Private playlist' : 'Playlist', title: pl.name, tools: tracks.length > 0,
    pin: { type: 'playlist', id: pl.id, uri: pl.uri, name: pl.name, image: img(pl.images, 64) },
    desc: stripHtml(pl.description), meta: `${esc(pl.owner?.display_name || '')} · <span id="plCount">${total}</span> songs`,
    extra: editable ? `<button class="pin-btn" data-add-songs title="Add songs to this playlist">${svg('plus')}<span>Add songs</span></button>` : '',
  }) + `<div class="pad">${tracks.length ? trackTable(tracks, { context: pl.uri, removable: editable })
    : editable ? `<div class="empty small"><p>This playlist is empty.</p><button class="pill-btn" data-add-songs>${svg('plus')} Add songs</button></div>` : ''}${note ? `<p class="note">${note}</p>` : ''}</div>`;
  initListTools();
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
    pin: { type: 'album', id: al.id, uri: al.uri, name: al.name, image: img(al.images, 64) },
    meta: `${artistLinks(al.artists)} · ${(al.release_date || '').slice(0, 4)} · ${tracks.length} songs`,
  }) + `<div class="pad">${trackTable(tracks, { context: al.uri, showAlbum: false, showArt: false })}</div>`;
}

async function viewArtist(el, id, alive) {
  const ar = await api(`/artists/${id}`);
  let albums = [];
  try { albums = (await api(`/artists/${id}/albums`, { query: { include_groups: 'album,single', limit: 10 } }))?.items || []; } catch {}
  if (!alive()) return;
  S.hero = { context: ar.uri };
  el.innerHTML = hero({ image: img(ar.images), round: true, kind: 'Artist', title: ar.name, meta: (ar.genres || []).slice(0, 3).map(esc).join(' · '),
    pin: { type: 'artist', id: ar.id, uri: ar.uri, name: ar.name, image: img(ar.images, 64) } })
    + `<div class="pad"><section><h2>Discography</h2>${albums.length
      ? `<div class="grid">${albums.map(a => card({ kind: 'album', id: a.id, uri: a.uri, title: a.name, sub: `${(a.release_date || '').slice(0, 4)} · ${a.album_type === 'single' ? 'Single' : 'Album'}`, image: img(a.images) })).join('')}</div>`
      : '<p class="muted">Spotify didn’t return releases for this artist — hit play to hear them.</p>'}</section></div>`;
}

async function loadPlaylists() {
  try { S.playlists = await pageAll('/me/playlists', { limit: 50 }, 300); } catch { S.playlists = []; }
  $('#playlists').innerHTML = S.playlists.filter(Boolean).map(p => `<button class="pl-item" data-open="playlist:${esc(p.id)}" data-id="${esc(p.id)}" title="${esc(p.name)}" ${pinAttr({ type: 'playlist', id: p.id, uri: p.uri, name: p.name, image: img(p.images, 64) })}>
    ${img(p.images, 64) ? `<img src="${esc(img(p.images, 64))}" alt="" loading="lazy">` : `<div class="ph">${svg('music')}</div>`}
    <div class="pl-meta"><div class="pl-name">${esc(p.name)}</div><div class="pl-sub">Playlist · ${esc(p.owner?.display_name || '')}</div></div></button>`).join('')
    || '<p class="muted" style="padding:0 12px;font-size:13px">No playlists yet.</p>';
}

/* ---------------- pins (quick access) ---------------- */
const PIN_LABEL = { playlist: 'Playlist', album: 'Album', artist: 'Artist', liked: 'Playlist' };
const pinKey = o => o.type + ':' + (o.id || '');
const getPins = () => store.get('pins', []) || [];
const isPinned = o => getPins().some(p => pinKey(p) === pinKey(o));
function savePins(pins) { store.set('pins', pins); renderPins(); }
function togglePin(o) {
  if (!o) return;
  const pins = getPins(), k = pinKey(o);
  if (pins.some(p => pinKey(p) === k)) { savePins(pins.filter(p => pinKey(p) !== k)); toast(`Unpinned ${o.name}`); }
  else { savePins([...pins, o]); toast(`Pinned ${o.name} — it's at the top of the sidebar (Ctrl+${Math.min(pins.length + 1, 9)})`); }
  const b = $('[data-pin-toggle]');
  if (b && S.heroPin) { const on = isPinned(S.heroPin); b.classList.toggle('on', on); b.title = on ? 'Unpin' : 'Pin to sidebar'; b.querySelector('span').textContent = on ? 'Pinned' : 'Pin'; }
}
const openPin = p => p.type === 'liked' ? navigate('liked') : navigate(p.type, p.id);
function renderPins() {
  const pins = getPins(), box = $('#pins');
  $('#pinSection').classList.toggle('hidden', !pins.length);
  box.innerHTML = pins.map((p, i) => `<button class="pl-item pin-item" draggable="true" data-pin-idx="${i}" data-open="${p.type === 'liked' ? 'liked:' : p.type + ':' + esc(p.id)}" data-id="${esc(p.id)}" title="${esc(p.name)}${i < 9 ? ` (Ctrl+${i + 1})` : ''}" ${pinAttr(p)}>
    ${p.type === 'liked' ? `<div class="liked-mini pin-art">${svg('heart')}</div>` : p.image ? `<img src="${esc(p.image)}" alt="" class="${p.type === 'artist' ? 'round' : ''}" loading="lazy">` : `<div class="ph">${svg('music')}</div>`}
    <div class="pl-meta"><div class="pl-name">${esc(p.name)}</div><div class="pl-sub">${svg('pin')}${PIN_LABEL[p.type] || ''}</div></div></button>`).join('');
}
// Drag pinned items to reorder them.
function bindPins() {
  const box = $('#pins'); let from = null;
  box.addEventListener('dragstart', e => { const it = e.target.closest('[data-pin-idx]'); if (!it) return; from = +it.dataset.pinIdx; it.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
  box.addEventListener('dragend', e => { e.target.closest?.('[data-pin-idx]')?.classList.remove('dragging'); $$('.drop-before', box).forEach(x => x.classList.remove('drop-before')); });
  box.addEventListener('dragover', e => { const it = e.target.closest('[data-pin-idx]'); if (from == null || !it) return; e.preventDefault(); $$('.drop-before', box).forEach(x => x.classList.remove('drop-before')); it.classList.add('drop-before'); });
  box.addEventListener('drop', e => {
    const it = e.target.closest('[data-pin-idx]'); if (from == null || !it) return; e.preventDefault();
    const pins = getPins(), to = +it.dataset.pinIdx, [m] = pins.splice(from, 1);
    pins.splice(to > from ? to - 1 : to, 0, m); from = null; savePins(pins);
  });
}

/* ---------------- queue + lyrics drawer ---------------- */
const D = { tab: null, lyrics: new Map(), cur: null, lines: [], active: -1 };
function openDrawer(tab) {
  if (D.tab === tab) return closeDrawer();
  D.tab = tab;
  $('#drawer').classList.remove('hidden');
  $$('.drawer-tabs [data-dtab]').forEach(b => b.classList.toggle('on', b.dataset.dtab === tab));
  $('#queueBtn').classList.toggle('on', tab === 'queue'); $('#lyricsBtn').classList.toggle('on', tab === 'lyrics');
  tab === 'queue' ? renderQueue() : renderLyrics();
}
function closeDrawer() {
  D.tab = null; $('#drawer').classList.add('hidden');
  $('#queueBtn').classList.remove('on'); $('#lyricsBtn').classList.remove('on');
}
const qRow = (t, now) => `<div class="q-row ${now ? 'now' : ''}" ${t.album?.id ? `data-open="album:${esc(t.album.id)}"` : ''}>
  ${img(t.album?.images || t.images, 64) ? `<img src="${esc(img(t.album?.images || t.images, 64))}" alt="" loading="lazy" decoding="async">` : `<div class="ph">${svg('music')}</div>`}
  <div class="q-text"><div class="q-name">${esc(t.name)}</div><div class="q-artist">${esc((t.artists || []).map(a => a.name).join(', ') || t.show?.name || '')}</div></div>
  <span class="q-dur">${fmt(t.duration_ms)}</span></div>`;
async function renderQueue() {
  const body = $('#drawerBody');
  body.innerHTML = '<div class="loading small"><span></span><span></span><span></span></div>';
  try {
    const d = await api('/me/player/queue');
    if (D.tab !== 'queue') return;
    const nowT = d?.currently_playing, next = (d?.queue || []).filter(Boolean);
    body.innerHTML = nowT
      ? `<h4>Now playing</h4>${qRow(nowT, true)}<h4>Next up</h4>${next.length ? next.slice(0, 50).map(t => qRow(t)).join('') : '<p class="muted small-note">Nothing queued.</p>'}
         <p class="muted small-note">Right-click any song → <b>Add to queue</b>. Spotify doesn’t let apps reorder or remove queued songs.</p>`
      : '<p class="muted small-note">Start playing something to see what’s up next.</p>';
  } catch (e) { body.innerHTML = `<p class="muted small-note">Couldn’t load the queue (${esc(e.message)}).</p>`; }
}
async function addToQueue(uri) {
  try {
    await api('/me/player/queue', { method: 'POST', query: { uri } });
    toast('Added to queue');
    if (D.tab === 'queue') setTimeout(renderQueue, 500);
  } catch (e) { toast(e.status === 404 ? 'Start playing something first, then add to the queue.' : e.message); }
}

/* ---------------- editing playlists ---------------- */
// Only playlists you own or collaborate on can be changed.
const canEdit = p => !!p && !!S.me && (p.owner?.id === S.me.id || p.collaborative === true);
const editablePlaylists = () => S.playlists.filter(p => canEdit(p));
// Sessions signed in before playlist editing existed don't have permission yet: one quick re-login fixes it.
function needsEditPermission(e) {
  if (e.status !== 401 && e.status !== 403) return false;
  const scope = store.get('token')?.scope || '';
  if (scope.includes('playlist-modify')) return false; // permission is there; it's a real "not allowed"
  toast('Amplite needs permission to edit your playlists.', { label: 'Allow', run: login });
  return true;
}
function playlistChanged(id) {
  purgeCache(new RegExp(`/playlists/${id}(/|\\?|$)`));
  purgeCache(/\/me\/playlists/);
}
async function addToPlaylist(pid, uris, position) {
  await api(`/playlists/${pid}/items`, { method: 'POST', body: position == null ? { uris } : { uris, position } });
  playlistChanged(pid);
}
async function removeFromPlaylist(pid, uris) {
  try { await api(`/playlists/${pid}/items`, { method: 'DELETE', body: { items: uris.map(uri => ({ uri })) } }); }
  catch (e) {
    if (e.status !== 400) throw e; // older API shape, just in case
    await api(`/playlists/${pid}/tracks`, { method: 'DELETE', body: { tracks: uris.map(uri => ({ uri })) } });
  }
  playlistChanged(pid);
}
const setPlCount = n => { const c = $('#plCount'); if (c) c.textContent = n; };

// Re-number the rows of the page's main list after one is added/removed, without re-rendering it
// (keeps scroll position), and carry on filling rows that haven't been drawn yet.
function renumberList() {
  const L = S.lists[0], body = $('.tracks[data-list="0"] .tbody'); if (!L || !body) return;
  const rows = body.querySelectorAll('.trow');
  rows.forEach((r, i) => { r.dataset.idx = i; const n = r.querySelector('.tnum span'); if (n) n.textContent = i + 1; });
  if (rows.length < L.tracks.length) { L.gen = (L.gen || 0) + 1; fillRows(0, rows.length); }
  applyListFilter(); markPlaying();
}

async function removeRow(row) {
  const L = S.lists[+row.closest('.tracks').dataset.list], pl = S.pl;
  const t = L?.tracks[+row.dataset.idx]; if (!t || !pl?.editable) return;
  // Spotify removes every copy of the song, so do the same on screen.
  const origPos = L.orig.findIndex(x => x.uri === t.uri);
  const copies = L.orig.filter(x => x.uri === t.uri).length;
  const keep = x => x.uri !== t.uri;
  const before = { orig: L.orig, tracks: L.tracks };
  L.orig = L.orig.filter(keep); L.tracks = L.tracks === before.orig ? L.orig : L.tracks.filter(keep);
  row.closest('.tbody').querySelectorAll('.trow').forEach(r => { if (r.dataset.uri === t.uri) r.remove(); });
  renumberList(); setPlCount(L.orig.length);
  try {
    await removeFromPlaylist(pl.id, [t.uri]);
    toast(`Removed “${t.name}”`, copies === 1 && S.pl?.id === pl.id ? { label: 'Undo', run: () => undoRemove(pl, t, origPos) } : null);
  } catch (e) {
    if (S.pl?.id === pl.id) { L.orig = before.orig; L.tracks = before.tracks; navigate('playlist', pl.id, false); }
    if (!needsEditPermission(e)) toast(`Couldn’t remove it: ${e.message}`);
  }
}
async function undoRemove(pl, t, pos) {
  try {
    await addToPlaylist(pl.id, [t.uri], pos);
    if (S.pl?.id === pl.id) navigate('playlist', pl.id, false);
    toast('Restored');
  } catch (e) { toast(`Couldn’t restore it: ${e.message}`); }
}

// After adding from the "Add songs" panel, show the song at the bottom of the open playlist right away.
function appendToOpenList(t) {
  const L = S.lists[0], body = $('.tracks[data-list="0"] .tbody');
  if (!L || !body) return false;
  const sorted = L.tracks !== L.orig;
  L.orig = [...L.orig, t];
  L.tracks = sorted ? [...L.tracks, t] : L.orig;
  if (body.querySelectorAll('.trow').length === L.tracks.length - 1) body.insertAdjacentHTML('beforeend', trackRows([t], L, L.tracks.length - 1));
  renumberList(); setPlCount(L.orig.length);
  return true;
}

// Right-click → Add to playlist: a second menu listing the playlists you can edit.
function pickPlaylist(e, t) {
  const lists = editablePlaylists();
  if (!lists.length) return toast('You don’t have any playlists of your own yet.');
  // Next tick: the click that chose "Add to playlist…" would otherwise close this menu straight away.
  setTimeout(() => showCtx(e, lists.slice(0, 40).map(p => ({
    icon: S.pl?.id === p.id ? 'check' : 'music', label: p.name,
    run: async () => {
      try {
        await addToPlaylist(p.id, [t.uri]);
        toast(`Added to ${p.name}`);
        if (S.pl?.id === p.id && S.pl.editable && !appendToOpenList(t)) navigate('playlist', p.id, false);
      } catch (err) { if (!needsEditPermission(err)) toast(`Couldn’t add it: ${err.message}`); }
    },
  }))), 0);
}

// ---- "Add songs" panel (search + recently played) ----
const AS = { open: false, q: '', offset: 0, results: [], added: new Set(), seq: 0 };
function openAddSongs() {
  const pl = S.pl; if (!pl?.editable) return;
  AS.open = true; AS.q = ''; AS.offset = 0; AS.results = [];
  AS.added = new Set((S.lists[0]?.orig || []).map(t => t.uri));
  $('#addTitle').textContent = `Add songs to ${pl.name}`;
  $('#addSongs').classList.remove('hidden');
  const inp = $('#addQuery'); inp.value = ''; setTimeout(() => inp.focus(), 0);
  addSuggestions();
}
function closeAddSongs() { if (!AS.open) return; AS.open = false; AS.seq++; $('#addSongs')?.classList.add('hidden'); }
const addRow = (t, i) => {
  const has = AS.added.has(t.uri);
  return `<div class="as-row" data-as="${i}">
    ${t.album?.image ? `<img src="${esc(t.album.image)}" alt="" loading="lazy">` : `<div class="as-ph">${svg('music')}</div>`}
    <div class="as-text"><div class="tname">${esc(t.name)}</div><div class="tartist">${esc(t.artists.map(a => a.name).join(', '))}</div></div>
    <span class="as-dur">${fmt(t.duration)}</span>
    <button class="as-add ${has ? 'on' : ''}" data-as-add="${i}" title="${has ? 'Already in this playlist' : 'Add to playlist'}">${svg(has ? 'check' : 'plus')}</button></div>`;
};
function renderAddResults(title, more) {
  const body = $('#addBody');
  body.innerHTML = AS.results.length
    ? `<h4>${esc(title)}</h4>${AS.results.map(addRow).join('')}${more ? '<button class="pill-btn as-more" data-as-more>More results</button>' : ''}`
    : `<p class="muted small-note">${AS.q ? 'No songs found.' : 'Search for songs to add.'}</p>`;
}
async function addSuggestions() {
  const seq = ++AS.seq;
  $('#addBody').innerHTML = '<div class="loading small"><span></span><span></span><span></span></div>';
  try {
    const d = await api('/me/player/recently-played', { query: { limit: 50 } });
    if (seq !== AS.seq) return;
    const seen = new Set();
    AS.results = (d?.items || []).map(i => norm(i.track)).filter(t => t && !seen.has(t.uri) && seen.add(t.uri)).slice(0, 30);
  } catch { if (seq !== AS.seq) return; AS.results = []; }
  renderAddResults('Recently played', false);
}
async function addSearch(more = false) {
  const q = AS.q; if (!q) return addSuggestions();
  const seq = ++AS.seq;
  if (!more) { AS.offset = 0; AS.results = []; $('#addBody').innerHTML = '<div class="loading small"><span></span><span></span><span></span></div>'; }
  try {
    const d = await api('/search', { query: { q, type: 'track', limit: 10, offset: AS.offset } });
    if (seq !== AS.seq) return;
    const items = (d.tracks?.items || []).map(norm).filter(Boolean);
    AS.results = [...AS.results, ...items]; AS.offset += 10;
    renderAddResults('Songs', items.length === 10 && AS.offset < 100);
  } catch (e) { if (seq === AS.seq) $('#addBody').innerHTML = `<p class="muted small-note">${esc(e.message)}</p>`; }
}
async function addFromPanel(btn) {
  const t = AS.results[+btn.dataset.asAdd], pl = S.pl; if (!t || !pl?.editable || btn.disabled) return;
  if (AS.added.has(t.uri)) return toast('Already in this playlist');
  btn.disabled = true;
  try {
    await addToPlaylist(pl.id, [t.uri]);
    AS.added.add(t.uri);
    btn.classList.add('on'); btn.innerHTML = svg('check'); btn.title = 'Added';
    if (!appendToOpenList(t)) { closeAddSongs(); navigate('playlist', pl.id, false); }
  } catch (e) { if (!needsEditPermission(e)) toast(`Couldn’t add it: ${e.message}`); }
  btn.disabled = false;
}
function bindAddSongs() {
  const m = $('#addSongs'); if (!m) return;
  let t;
  $('#addQuery').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { AS.q = e.target.value.trim(); addSearch(); }, 250); });
  m.addEventListener('click', e => {
    if (e.target === m || e.target.closest('[data-close-add]')) return closeAddSongs();
    const b = e.target.closest('[data-as-add]'); if (b) return addFromPanel(b);
    if (e.target.closest('[data-as-more]')) return addSearch(true);
  });
  m.addEventListener('dblclick', e => { const r = e.target.closest('[data-as]'); if (r && !e.target.closest('button')) { const t = AS.results[+r.dataset.as]; if (t) playUris([t.uri]); } });
}

// ---- lyrics (LRCLIB) ----
function parseLrc(text) {
  const out = [];
  for (const line of (text || '').split(/\r?\n/)) {
    const tags = [...line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    const words = line.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of tags) out.push({ t: (+m[1] * 60 + +m[2]) * 1000, text: words });
  }
  return out.sort((a, b) => a.t - b.t);
}
const lyricsWanted = () => D.tab === 'lyrics' || (CFG.amp.lyricLine && ampOpen());
async function loadLyrics(n) {
  if (!n?.id) return null;
  if (D.lyrics.has(n.id)) return D.lyrics.get(n.id);
  const p = (async () => {
    if (!IS_APP) return { none: true };
    const r = await window.amplite.lyrics({ track: n.name, artist: n.artists[0]?.name || '', album: n.album?.name || '', duration: Math.round(n.duration / 1000) });
    if (!r || r.error) return { none: true, error: r?.error };
    if (r.instrumental) return { instrumental: true };
    return { synced: parseLrc(r.syncedLyrics), plain: r.plainLyrics || '' };
  })().catch(() => ({ none: true }));
  D.lyrics.set(n.id, p);
  if (D.lyrics.size > 60) D.lyrics.delete(D.lyrics.keys().next().value);
  p.then(r => { if (r?.error) D.lyrics.delete(n.id); }); // don't remember network errors as "no lyrics"
  return p;
}
async function renderLyrics() {
  const body = $('#drawerBody'), n = S.now;
  if (!n) { body.innerHTML = '<p class="muted small-note">Play a song to see its lyrics.</p>'; return; }
  body.innerHTML = '<div class="loading small"><span></span><span></span><span></span></div>';
  const L = await loadLyrics(n);
  if (D.tab !== 'lyrics' || S.now?.id !== n.id) return;
  D.cur = n.id; D.active = -1;
  D.lines = L?.synced?.length ? L.synced : [];
  if (D.lines.length) {
    body.innerHTML = `<div class="lyrics synced">${D.lines.map((l, i) => `<p data-li="${i}" data-t="${l.t}">${esc(l.text) || '♪'}</p>`).join('')}</div><p class="muted small-note">Lyrics from LRCLIB · click a line to jump there</p>`;
    tickLyrics(true);
  } else if (L?.plain) body.innerHTML = `<div class="lyrics">${L.plain.split('\n').map(l => `<p>${esc(l) || '&nbsp;'}</p>`).join('')}</div><p class="muted small-note">Lyrics from LRCLIB (not synced)</p>`;
  else if (L?.instrumental) body.innerHTML = '<p class="muted small-note">♪ Instrumental</p>';
  else body.innerHTML = '<p class="muted small-note">No lyrics found for this song.</p>';
}
// Highlights the current line (drawer) and feeds the mini amp's lyric display.
function tickLyrics(force) {
  if (!D.lines.length || S.now?.id !== D.cur) { S.lyricLine = ''; return; }
  const p = pos() + 150;
  let i = D.lines.length - 1; while (i >= 0 && D.lines[i].t > p) i--;
  S.lyricLine = i >= 0 ? D.lines[i].text : '';
  if (i === D.active && !force) return;
  D.active = i;
  if (D.tab !== 'lyrics') return;
  $$('#drawerBody .lyrics p.on').forEach(x => x.classList.remove('on'));
  const el = $(`#drawerBody [data-li="${i}"]`);
  if (el) { el.classList.add('on'); el.scrollIntoView({ block: 'center', behavior: CFG.ui.lite ? 'auto' : 'smooth' }); }
}
// Keeps lyrics in step with the song for whichever view wants them.
async function syncLyricsForTrack() {
  if (!lyricsWanted() || !S.now) return;
  if (D.tab === 'lyrics') { if (D.cur !== S.now.id) renderLyrics(); return; }
  const L = await loadLyrics(S.now);
  if (L?.synced?.length && S.now) { D.lines = L.synced; D.cur = S.now.id; D.active = -1; }
}
function bindDrawer() {
  $('#queueBtn').onclick = () => openDrawer('queue');
  $('#lyricsBtn').onclick = () => openDrawer('lyrics');
  $('#drawer').addEventListener('click', e => {
    if (e.target.closest('[data-dclose]')) return closeDrawer();
    const tb = e.target.closest('[data-dtab]'); if (tb) { D.tab = null; return openDrawer(tb.dataset.dtab); }
    const ln = e.target.closest('[data-t]'); if (ln) seek(+ln.dataset.t);
  });
}

/* ---------------- right-click menu ---------------- */
function showCtx(e, items) {
  const m = $('#ctxMenu');
  m.innerHTML = items.map((it, i) => it === '-' ? '<div class="ctx-sep"></div>' : `<button class="menu-item" data-ctx="${i}">${svg(it.icon)}<span>${esc(it.label)}</span></button>`).join('');
  m._items = items;
  m.classList.remove('hidden');
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(e.clientX, innerWidth - r.width - 8) + 'px';
  m.style.top = Math.min(e.clientY, innerHeight - r.height - 8) + 'px';
}
function bindCtx() {
  const m = $('#ctxMenu');
  m.addEventListener('click', e => { const b = e.target.closest('[data-ctx]'); if (!b) return; m.classList.add('hidden'); m._items[+b.dataset.ctx].run(); });
  document.addEventListener('contextmenu', e => {
    const row = e.target.closest('.trow');
    if (row) {
      e.preventDefault();
      const L = S.lists[+row.closest('.tracks').dataset.list], t = L?.tracks[+row.dataset.idx]; if (!t) return;
      const items = [
        { icon: 'play', label: 'Play', run: () => playRow(row) },
        { icon: 'queue', label: 'Add to queue', run: () => addToQueue(t.uri) },
        { icon: 'listadd', label: 'Add to playlist…', run: () => pickPlaylist(e, t) },
      ];
      if (L.removable && S.pl?.editable) items.push({ icon: 'minus', label: 'Remove from this playlist', run: () => removeRow(row) });
      items.push('-');
      if (t.album?.id) items.push({ icon: 'disc', label: 'Go to album', run: () => navigate('album', t.album.id) });
      if (t.artists?.[0]?.id) items.push({ icon: 'user', label: `Go to ${t.artists[0].name}`, run: () => navigate('artist', t.artists[0].id) });
      return showCtx(e, items);
    }
    const el = e.target.closest('[data-pinfo]');
    if (!el) return;
    e.preventDefault();
    let o; try { o = JSON.parse(el.dataset.pinfo); } catch { return; }
    const pinned = isPinned(o);
    showCtx(e, [
      { icon: 'play', label: 'Play', run: () => o.type === 'liked' ? navigate('liked').then(playHero) : playContext(o.uri) },
      { icon: 'right', label: 'Open', run: () => openPin(o) },
      '-',
      { icon: 'pin', label: pinned ? 'Unpin from sidebar' : 'Pin to sidebar', run: () => togglePin(o) },
    ]);
  });
  ['click', 'blur', 'resize'].forEach(ev => window.addEventListener(ev, () => m.classList.add('hidden')));
  $('#view').addEventListener('scroll', () => m.classList.add('hidden'), { passive: true });
}

/* ---------------- themes ---------------- */
function applyTheme(id) {
  if (!THEMES.some(t => t[0] === id)) id = 'midnight';
  document.documentElement.dataset.theme = id;
  if (S.ampWin) S.ampWin.document.documentElement.dataset.theme = id;
  store.set('theme', id);
  S.vizGrad = null;
  $$('.theme-opt').forEach(b => b.classList.toggle('active', b.dataset.theme === id));
  applyAccent();
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
  seek: $('#ampSeek', ampEl), dur: $('#ampDur', ampEl), vol: $('#ampVol', ampEl), dev: $('#ampDev', ampEl), art: $('#ampArt', ampEl),
  shuf: $('[data-amp="shuffle"]', ampEl), rep: $('[data-amp="repeat"]', ampEl), eqBtn: $('[data-amp="eq"]', ampEl), eq: $('#ampEq', ampEl),
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
  if (IS_APP) w.document.documentElement.classList.add('is-app');
  S.ampWin = w; applyAccent(); S.ampWin = null;
  w.document.title = 'Amplite';
  w.document.body.classList.add('pip-body');
  w.document.body.append(ampEl);
  w.document.addEventListener('keydown', onKey);
  S.ampWin = w; S.vizGrad = null;
  w.addEventListener('pagehide', onAmpWinClosed);
  if (IS_APP) {
    // Fit the window to the amp, then tuck the main window away.
    await fitAmp(true);
    window.amplite.setMainVisible(false);
  }
  startViz();
}
// A closed popup doesn't always fire pagehide, so double-check.
setInterval(() => { if (S.ampWin?.closed) onAmpWinClosed(); }, 500);

async function toggleAmp() {
  closeSettings();
  setTimeout(syncLyricsForTrack, 800);
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
  A.eq.classList.toggle('hidden', !c.eqOpen || !IS_APP);
  syncEq();
  S.vizGrad = null; V.text = ''; V.idle = false;
  fitAmp();
}
// Resize the pop-out window to the amp and apply window options.
async function fitAmp(useCorner = false) {
  if (!S.ampWin || !IS_APP) return;
  await new Promise(r => S.ampWin.requestAnimationFrame(r));
  const r = ampEl.getBoundingClientRect(), z = CFG.amp.scale || 1;
  // getBoundingClientRect may or may not include CSS zoom depending on the engine; measure both ways.
  const w = Math.ceil(r.width * (r.width < ampEl.offsetWidth * z - 2 ? z : 1));
  const h = Math.ceil(r.height * (r.height < ampEl.offsetHeight * z - 2 ? z : 1));
  try { S.ampWin.resizeTo(w, h); } catch {}
  // Corner placement only when the amp opens or the corner setting changes; after other changes
  // (e.g. the EQ panel making it taller) just keep it fully on screen where the user put it.
  window.amplite.ampWindow({ opacity: CFG.amp.opacity / 100, onTop: CFG.amp.onTop, snap: CFG.amp.snap, corner: useCorner && CFG.amp.corner !== 'none' ? CFG.amp.corner : null, clamp: true });
}

// Simulated spectrum (Spotify's DRM audio can't be analysed in the browser).
const V = { h: new Float32Array(19), pk: new Float32Array(19), tg: new Float32Array(19), lastT: 0, lastTxt: 0, lastMarq: 0, lastFrame: 0, off: 0, text: '', idle: false };
let vizId = 0, vizRunning = false;
const vizWanted = () => ampOpen() || (S.ampPreview && !mainHidden());
function startViz() {
  if (!vizWanted()) return;
  const id = ++vizId; vizRunning = true;
  const win = S.ampWin || window;
  let lastFrame = performance.now();
  V.lastFrame = V.lastTxt = V.lastMarq = V.lastT = 0; // fresh timers for the new loop
  const step = () => {
    if (id !== vizId) return;
    if (!vizWanted()) { vizRunning = false; return; } // stop the loop entirely when nobody's looking
    lastFrame = performance.now();
    drawAmp();
    // Paused with the bars settled: nothing moves but the scrolling title, so tick 4x/s instead of 60.
    if (V.idle && !(S.now && !S.now.paused)) setTimeout(() => win.requestAnimationFrame(step), 250);
    else win.requestAnimationFrame(step);
  };
  win.requestAnimationFrame(step);
  // Safety net: if the window stops getting animation frames (Windows sometimes thinks it's covered),
  // keep the clock, title and visualizer moving with a plain timer.
  const guard = setInterval(() => {
    if (id !== vizId || !vizWanted()) { clearInterval(guard); return; }
    if (performance.now() - lastFrame > 400) drawAmp();
  }, 100);
}
const SCROLL_MS = { slow: 380, normal: 220, fast: 110 };
function drawAmp() {
  // One clock for everything. The amp window has its own clock that starts when it opens, so mixing
  // its frame timestamps with the main window's time froze the display (it looked "in the past").
  const t = performance.now();
  const c = CFG.amp;
  if (t - V.lastFrame < 1000 / (c.fps || 30) - 2) return;
  V.lastFrame = t;
  const n = S.now, playing = n && !n.paused;
  if (t - V.lastTxt > 200) {
    V.lastTxt = t;
    const p = pos(), d = n?.duration || 0;
    setText(A.time, S.ampRemain && d ? '-' + fmt(d - p, true) : fmt(p, true));
    setText(A.state, !n ? '■' : n.paused ? '❚❚' : '▶');
    if (!S.ampSeeking) setRange(A.seek, d ? p / d : 0);
    setText(A.dur, fmt(d));
  }
  if (c.marquee) {
    const txt = c.lyricLine && S.lyricLine ? '♪ ' + S.lyricLine : n ? `${n.artists.map(a => a.name).join(', ')} - ${n.name}` : 'AMPLITE  ·  PICK A SONG TO START';
    if (c.scroll === 'static') { if (txt !== V.text) { V.text = txt; setText(A.marq, txt); } }
    else if (t - V.lastMarq > (SCROLL_MS[c.scroll] || 220)) {
      V.lastMarq = t;
      const full = txt + '        ';
      if (full !== V.text) { V.text = full; V.off = 0; } else V.off = (V.off + 1) % full.length;
      setText(A.marq, full.slice(V.off) + full.slice(0, V.off));
    }
  }
  if (c.viz === 'off') { V.idle = !playing; return; }
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
  if (e.key === 'Escape' && AS.open) { closeAddSongs(); return; }
  if ((tag === 'INPUT' && e.target.type !== 'range') || tag === 'TEXTAREA') return;
  if (e.key === 'Escape' && !$('#settings').classList.contains('hidden')) { closeSettings(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleSidebar(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === ',') { e.preventDefault(); openSettings(); return; }
  if ((e.ctrlKey || e.metaKey) && /^[1-9]$/.test(e.key) && !S.ampWin) { const p = getPins()[+e.key - 1]; if (p) { e.preventDefault(); openPin(p); } return; }
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') { e.preventDefault(); next(); }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  else if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey) toggleAmp();
  else if (e.key.toLowerCase() === 'q' && !e.ctrlKey && !e.metaKey && !e.altKey && !S.ampWin) openDrawer('queue');
  else if (e.key.toLowerCase() === 'l' && !e.ctrlKey && !e.metaKey && !e.altKey && !S.ampWin) openDrawer('lyrics');
  else if (e.key === '/' && !S.ampWin) { e.preventDefault(); navigate('search'); }
}

function bind() {
  $('#loginBtn').onclick = login;
  bindLoginSetup();
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
  seekBar.onchange = () => { seek(seekBar.value / seekBar.max * (S.now?.duration || 0)); S.seeking = false; seekBar._v = null; };
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
    if (e.target.closest('[data-pin-toggle]')) { togglePin(S.heroPin); return; }
    if (e.target.closest('[data-hero-shuffle]')) { shufflePlay(); return; }
    if (e.target.closest('[data-add-songs]')) { openAddSongs(); return; }
    const rm = e.target.closest('[data-rm]');
    if (rm) { e.stopPropagation(); removeRow(rm.closest('.trow')); return; }
    const num = e.target.closest('.tnum');
    if (num) { playRow(num.closest('.trow')); return; }
    const open = e.target.closest('[data-open]');
    if (open) { const i = open.dataset.open.indexOf(':'); navigate(open.dataset.open.slice(0, i), open.dataset.open.slice(i + 1)); }
  });
  document.addEventListener('dblclick', e => {
    const row = e.target.closest('.trow');
    if (row && !e.target.closest('a, button')) { getSelection()?.removeAllRanges(); playRow(row); }
  });
  document.addEventListener('keydown', onKey);

  // Mini Amp controls
  ampEl.addEventListener('click', e => {
    const b = e.target.closest('[data-amp]'); if (!b) return;
    activate();
    ({
      prev, next, stop, shuffle: toggleShuffle, repeat: cycleRepeat, like: toggleLike,
      play: () => (S.now && !S.now.paused ? seek(0) : resume()),
      pause: () => (S.now?.paused ? resume() : pause()),
      popout: ampPopToggle, close: ampClose, eq: toggleAmpEq,
    })[b.dataset.amp]?.();
  });
  A.time.onclick = () => { S.ampRemain = !S.ampRemain; };
  A.seek.oninput = () => { S.ampSeeking = true; A.seek.style.setProperty('--p', A.seek.value / A.seek.max * 100 + '%'); };
  A.seek.onchange = () => { seek(A.seek.value / A.seek.max * (S.now?.duration || 0)); S.ampSeeking = false; A.seek._v = null; };
  A.vol.oninput = () => setVolume(A.vol.value / 100);
}

/* ---------------- equalizer (built-in engine only) ---------------- */
const EQ_BANDS = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
const EQ_PRESETS = {
  flat: ['Flat', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
  bass: ['Bass boost', [6, 5, 4, 2, 0, 0, 0, 0, 0, 0]],
  treble: ['Treble boost', [0, 0, 0, 0, 0, 1, 2, 4, 5, 6]],
  vocal: ['Vocal', [-2, -2, -1, 1, 3, 4, 3, 1, 0, -1]],
  rock: ['Rock', [4, 3, 2, 0, -1, -1, 1, 3, 4, 4]],
  pop: ['Pop', [-1, 1, 3, 4, 3, 0, -1, -1, 1, 2]],
  electronic: ['Electronic', [5, 4, 1, 0, -2, 1, 0, 2, 4, 5]],
  hiphop: ['Hip-hop', [5, 4, 2, 3, -1, -1, 1, -1, 2, 3]],
  acoustic: ['Acoustic', [3, 2, 1, 1, 2, 2, 3, 3, 2, 1]],
  loudness: ['Loudness', [5, 3, 0, 0, -2, 0, -1, 0, 3, 4]],
};
const eqAvailable = () => IS_APP && useEngine();
let eqT;
function applyEq() {
  const e = CFG.eq;
  if (IS_APP) {
    clearTimeout(eqT);
    const boost = Math.max(0, ...e.gains);
    eqT = setTimeout(() => window.amplite.setEq({ enabled: e.enabled, preamp: e.preamp - (e.auto ? boost : 0), gains: e.gains }), 60);
  }
  syncEq();
}
function eqHTML() {
  return `<div class="eq-top">
      <label class="eq-power"><input type="checkbox" data-eqk="enabled"><span>EQ ON</span></label>
      <label class="eq-power" title="Lowers the preamp automatically so boosts never clip"><input type="checkbox" data-eqk="auto"><span>AUTO</span></label>
      <select data-eqk="preset" class="eq-preset">${Object.entries(EQ_PRESETS).map(([k, [n]]) => `<option value="${k}">${n}</option>`).join('')}<option value="custom">Custom</option></select>
    </div>
    <div class="eq-bands">
      <div class="eq-band pre"><input type="range" min="-12" max="12" step="0.5" data-eqk="preamp" aria-label="Preamp"><span>PRE</span></div>
      ${EQ_BANDS.map((b, i) => `<div class="eq-band"><input type="range" min="-12" max="12" step="0.5" data-eqi="${i}" aria-label="${b} Hz"><span>${b}</span></div>`).join('')}
    </div>
    <p class="eq-note"></p>`;
}
function syncEq() {
  const e = CFG.eq, docs = [ampEl, $('#setPanes')].filter(Boolean);
  for (const root of docs) {
    $$('[data-eqk="enabled"]', root).forEach(i => { i.checked = e.enabled; });
    $$('[data-eqk="auto"]', root).forEach(i => { i.checked = e.auto; });
    $$('[data-eqk="preset"]', root).forEach(i => { i.value = e.preset; });
    $$('[data-eqk="preamp"]', root).forEach(i => { i.value = e.preamp; i.title = `Preamp ${e.preamp} dB`; });
    $$('[data-eqi]', root).forEach(i => { i.value = e.gains[+i.dataset.eqi]; i.title = `${EQ_BANDS[+i.dataset.eqi]} Hz: ${e.gains[+i.dataset.eqi]} dB`; });
    $$('.eq-note', root).forEach(n => { n.textContent = eqAvailable() ? '' : 'The equalizer works with the built-in engine. It’s off while Amplite plays through the web player or the Spotify app.'; });
    $$('.amp-eq, .eq-wrap', root).forEach(w => w.classList.toggle('eq-disabled', !eqAvailable() || !e.enabled));
  }
  A.eqBtn?.classList.toggle('on', CFG.amp.eqOpen);
}
function bindEq(root) {
  root.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.eqi != null) { const g = [...CFG.eq.gains]; g[+t.dataset.eqi] = +t.value; CFG.eq.preset = 'custom'; setK('eq.gains', g); }
    else if (t.dataset.eqk === 'preamp') setK('eq.preamp', +t.value);
  });
  root.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.eqk === 'enabled') setK('eq.enabled', t.checked);
    else if (t.dataset.eqk === 'auto') setK('eq.auto', t.checked);
    else if (t.dataset.eqk === 'preset' && EQ_PRESETS[t.value]) { CFG.eq.gains = [...EQ_PRESETS[t.value][1]]; CFG.eq.enabled = true; setK('eq.preset', t.value); }
  });
  root.addEventListener('dblclick', e => { const t = e.target.closest('[data-eqi]'); if (t) { const g = [...CFG.eq.gains]; g[+t.dataset.eqi] = 0; CFG.eq.preset = 'custom'; setK('eq.gains', g); } });
}
function toggleAmpEq() {
  setK('amp.eqOpen', !CFG.amp.eqOpen);
}

/* ---------------- UI prefs (sidebar, lite mode) ---------------- */
// Custom accent: overrides the theme's highlight colour; text on it is black or white, whichever reads better.
const ACCENTS = ['#1ed760', '#7c9cff', '#ff5c8a', '#ffb000', '#2ec4b6', '#bd93f9', '#ff6b35', '#ffffff'];
function onAccent(hex) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
  const L = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * L(r) + 0.7152 * L(g) + 0.0722 * L(b) > 0.4 ? '#000000' : '#ffffff';
}
function applyAccent() {
  const a = CFG.ui.accent, docs = [document, S.ampWin?.document].filter(Boolean);
  for (const d of docs) {
    const st = d.documentElement.style;
    if (/^#[0-9a-f]{6}$/i.test(a || '')) { st.setProperty('--accent', a); st.setProperty('--on-accent', onAccent(a)); }
    else { st.removeProperty('--accent'); st.removeProperty('--on-accent'); }
  }
}
function applyUI() {
  applyAccent();
  if (IS_APP) window.amplite.setPrefs({ closeToTray: CFG.ui.closeToTray, startup: CFG.ui.startup, hwAccel: CFG.ui.hwAccel });
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
      + grp('Accent color', `<div class="set-row"><div class="lbl">Highlight color<small>Works with any theme</small></div>
          <div class="ctl accents">${ACCENTS.map(c => `<button class="acc" data-accent="${c}" style="background:${c}" title="${c}"></button>`).join('')}
          <input type="color" id="accentPick" title="Pick any color"><button class="btn" data-accent="">Theme default</button></div></div>`)
      + (IS_APP ? grp('Windows', seg('ui.startup', 'Start with Windows', [['off', 'Off'], ['normal', 'Open window'], ['tray', 'In tray'], ['amp', 'Mini amp']], 'Launch Amplite when you sign in to Windows')
        + sw('ui.closeToTray', 'Close to tray', 'Closing the window keeps Amplite playing in the system tray')) : '')
      + grp('Performance', sw('ui.lite', 'Lite mode', 'Turns off animations, blur and shadows to save CPU/GPU')
        + (IS_APP ? sw('ui.hwAccel', 'Hardware acceleration', 'Turning it off can lower memory use on PCs with weak graphics; uses a bit more CPU (takes effect after restart)') : ''))
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
        + seg('amp.time', 'Clock shows', [['elapsed', 'Elapsed'], ['remaining', 'Remaining']])
        + (IS_APP ? sw('amp.lyricLine', 'Show lyrics on the display', 'The song title line shows the current lyric when synced lyrics are available') : ''))
      + (IS_APP ? grp('Window', rng('amp.opacity', 'Opacity', 40, 100, 5, '%') + sw('amp.onTop', 'Always on top')
        + sw('amp.snap', 'Snap to screen edges', 'Drop the amp near an edge or corner and it sticks there')
        + seg('amp.corner', 'Open in corner', [['none', 'Last spot'], ['tl', '↖'], ['tr', '↗'], ['bl', '↙'], ['br', '↘']])) : '')
      + grp('Reset', `<div class="set-row"><div class="lbl">Restore the default mini amp</div><button class="btn ctl" id="ampReset">Reset</button></div>`),
    audio: grp('Audio engine', `<div class="engine-line" id="engineLine"></div>`)
      + grp('Playback source',
        seg('audio.source', 'Play audio with', [['auto', 'Automatic'], ['engine', 'Amplite engine'], ['web', 'Amplite web player'], ['app', 'Spotify app']],
          'Automatic: built-in engine (320 kbps) → Amplite web player (official DRM) → hidden Spotify app, using the first one Spotify allows for your account')
        + sw('audio.hideSpotify', 'Hide the Spotify window', 'When Amplite has to use the Spotify app, keep it invisible and close it when Amplite quits')
        + `<div class="set-row"><div class="lbl">Retry automatic detection<small>Forgets what was refused before and tries the built-in engine, then the web player, again</small></div><button class="btn ctl" id="engRetry">Retry</button></div>`)
      + grp('Equalizer', `<div class="eq-wrap">${eqHTML()}</div>`)
      + grp('Quality (built-in engine)',
        seg('audio.bitrate', 'Streaming quality', [[320, 'Very high · 320'], [160, 'High · 160'], [96, 'Normal · 96']], 'Higher sounds better and uses more data. Very high needs Premium.', true)
        + sw('audio.normalise', 'Normalize volume', 'Keeps loudness consistent between songs'))
      + grp('Troubleshooting', `<div class="set-row"><div class="lbl">Restart audio engine<small>Try this if playback stops responding</small></div><button class="btn ctl" id="engRestart">Restart</button></div>
        <div class="set-row"><div class="lbl">Re-link audio engine<small>Signs the engine in again through your browser. Make sure the browser is logged into your own Spotify account.</small></div><button class="btn ctl" id="engRelink">Re-link</button></div>
        <div class="set-row"><div class="lbl">Copy diagnostics<small>Version, account type, devices and recent engine log (no passwords or tokens)</small></div><button class="btn ctl" id="engDiag">Copy</button></div>`),
    about: `<div class="about-logo"><span class="logo" data-logo></span><div><b>Amplite</b><span class="muted" id="aboutVer"></span></div></div>`
      + grp('Spotify app', `<div class="set-row"><div class="lbl">${ownClientId() ? `Your own app (…${esc(clientId().slice(-6))})` : 'Built-in app'}<small>The Spotify developer app Amplite signs in through. Use your own so you don’t need to be on anyone else’s user list.</small></div><button class="btn ctl" id="cidChange">Change</button></div>`)
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
  $$('.acc', root).forEach(b => b.classList.toggle('on', b.dataset.accent.toLowerCase() === (CFG.ui.accent || '').toLowerCase()));
  const pick = $('#accentPick'); if (pick) pick.value = CFG.ui.accent || '#7c9cff';
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
    const ac = e.target.closest('[data-accent]');
    if (ac) { setK('ui.accent', ac.dataset.accent); applyAmp(); return; }
    const th = e.target.closest('#setThemes .theme-opt');
    if (th) { applyTheme(th.dataset.theme); syncControls(); applyAmp(); return; }
    if (e.target.closest('#ampReset')) { CFG.amp = clone(AMP_DEFAULTS); store.set('cfg', CFG); applyAmp(); syncControls(); toast('Mini amp reset'); return; }
    if (e.target.closest('#engRestart')) { window.amplite.engineRestart(); toast('Restarting audio engine…'); return; }
    if (e.target.closest('#engRelink')) { window.amplite.engineRestart({ forget: true }); toast('Re-linking — approve Amplite in your browser.'); return; }
    if (e.target.closest('#aboutUpd')) { $('#updBtn').click(); return; }
    if (e.target.closest('#cidChange')) { store.set('openSetup', true); logout(); return; }
    if (e.target.closest('#engDiag')) { copyDiagnostics(); return; }
    if (e.target.closest('#engRetry')) { store.del(refusedKey()); store.del(webKey()); S.lastMode = playMode(); window.amplite.engineRestart(); renderEngine(); updatePlayerUI(); toast('Trying the built-in engine again…'); }
  });
  root.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.k && el.type === 'checkbox') setK(el.dataset.k, el.checked);
  });
  root.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.k && el.type === 'range') setK(el.dataset.k, +el.value);
    if (el.dataset.color) { CFG.amp.colors[el.dataset.color] = el.value; setK('amp.skin', 'custom'); }
    if (el.id === 'accentPick') { setK('ui.accent', el.value); S.vizGrad = null; }
  });
  bindEq(root);
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

/* ---------------- speed: prefetch on hover, adaptive polling ---------------- */
const PREFETCH = {
  playlist: id => [api(`/playlists/${id}`), api(`/playlists/${id}/items`, { query: { limit: 50, offset: 0 } })],
  album: id => [api(`/albums/${id}`)],
  artist: id => [api(`/artists/${id}`), api(`/artists/${id}/albums`, { query: { include_groups: 'album,single', limit: 10 } })],
  liked: () => [api('/me/tracks', { query: { limit: 50, offset: 0 } })],
};
function bindPrefetch() {
  let t, last = '';
  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-open]'); if (!el) return;
    const v = el.dataset.open; if (v === last) return;
    clearTimeout(t);
    t = setTimeout(() => {
      last = v;
      const i = v.indexOf(':'), kind = v.slice(0, i), id = v.slice(i + 1);
      try { PREFETCH[kind]?.(id)?.forEach(p => p.catch(() => {})); } catch {}
    }, 90);
  }, { passive: true });
}
// Poll fast while music is playing and someone can see it, slowly otherwise.
function schedulePoll() {
  const visible = !mainHidden() || ampOpen();
  const playing = S.now && !S.now.paused;
  let ms = !visible ? 15000 : playing ? 3000 : 4000;
  // Check right when the current song should end, so the next one shows up immediately
  // (only while Spotify is answering; otherwise this would spin every 400 ms).
  if (playing && visible && S.now.duration && Date.now() - (S.pollOkAt || 0) < 10000) ms = Math.min(ms, Math.max(1000, S.now.duration - pos() + 400));
  // Offline / signed out: back off up to a minute.
  if (S.pollFails) ms = Math.min(60000, 3000 * 2 ** Math.min(S.pollFails, 5));
  clearTimeout(S.pollT);
  S.pollT = setTimeout(async () => { await poll(); schedulePoll(); }, ms);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (S.markDirty) markPlaying(); poll(); schedulePoll(); startViz(); } });

/* ---------------- boot ---------------- */
function showLogin(err, openSetup) {
  $('#app').classList.add('hidden');
  $('#login').classList.remove('hidden');
  $('#redirectUri').textContent = REDIRECT_URI;
  const own = ownClientId(), id = clientId();
  $('#loginUsing').textContent = own ? `Using your Spotify app (…${id.slice(-6)})` : '';
  $('#cidInput').value = own ? id : '';
  $('#cidReset').classList.toggle('hidden', !own);
  if (openSetup || store.get('openSetup')) { store.del('openSetup'); $('#ownApp').open = true; }
  if (err) { $('#loginErr').textContent = err; $('#loginErr').classList.remove('hidden'); }
}
function bindLoginSetup() {
  $('#copyRedirect').onclick = async () => {
    try { await navigator.clipboard.writeText(REDIRECT_URI); $('#copyRedirect').textContent = 'Copied'; setTimeout(() => { $('#copyRedirect').textContent = 'Copy'; }, 1500); } catch {}
  };
  $('#cidForm').onsubmit = e => {
    e.preventDefault();
    const raw = $('#cidInput').value.trim(), err = $('#cidErr');
    // Client IDs are 32 hex characters. Catch the usual mix-up: pasting the Client *secret* looks the same, so say so.
    if (!/^[0-9a-f]{32}$/i.test(raw)) { err.textContent = 'That doesn’t look like a Client ID. It’s 32 letters and numbers, shown at the top of your app’s page on the dashboard.'; err.classList.remove('hidden'); return; }
    err.classList.add('hidden');
    switchClientId(raw.toLowerCase());
    login();
  };
  $('#cidReset').onclick = () => { switchClientId(null); showLogin(); };
}
// A login belongs to one Spotify app, so switching apps signs out first.
function switchClientId(id) {
  if ((id || null) === (store.get('clientId') || null)) return;
  store.del('token');
  try { Object.keys(localStorage).filter(k => k.startsWith('amplite:swr:')).forEach(k => localStorage.removeItem(k)); } catch {}
  apiCache.clear();
  if (id) store.set('clientId', id); else store.del('clientId');
}

async function boot() {
  if (IS_APP) {
    try { S.appVersion = (await window.amplite.info()).version; } catch {}
    document.documentElement.classList.add('is-app');
    window.amplite.onMedia(cmd => ({ toggle: togglePlay, next, prev, stop, amp: toggleAmp })[cmd]?.());
    window.amplite.onWindowVisible?.(onWinVisibility);
    $('[data-amp="popout"]').remove();
    $('[data-amp="close"]').title = 'Back to full player';
    $('.amp-hint').textContent = '';
    initUpdates();
  }
  $$('[data-i]').forEach(el => el.insertAdjacentHTML('afterbegin', svg(el.dataset.i)));
  $$('[data-logo]').forEach(el => { el.innerHTML = LOGO; });
  A.eq.innerHTML = eqHTML(); bindEq(A.eq);
  renderThemes();
  bind();
  applyUI();
  applyAmp();
  syncVolume();

  try { await handleCallback(); } catch (e) { return showLogin(e.message); }
  if (!store.get('token')) return showLogin();

  try { S.me = await api('/me'); }
  catch (e) {
    if (e.status === 403) {
      store.del('token');
      return showLogin(ownClientId()
        ? 'Spotify blocked this account. Check that your email is added under User Management in your app on the developer dashboard, and that you have Premium.'
        : 'This Spotify account isn’t on the built-in app’s user list. Set up your own Spotify app below (free, about 5 minutes) and you’re in.', true);
    }
    store.del('token');
    return showLogin(e.message === 'Not logged in' ? '' : e.message);
  }

  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  const name = S.me.display_name || S.me.id;
  $('#userBtn').innerHTML = (img(S.me.images, 32) ? `<img src="${esc(img(S.me.images, 32))}" alt="">` : `<span class="av">${esc(name[0]?.toUpperCase() || '?')}</span>`) + `<span>${esc(name)}</span>`;

  updatePlayerUI();
  if (S.me.product && S.me.product !== 'premium') toast('Heads up: Spotify only allows playback in Amplite on Premium accounts. You can still browse.');
  renderPins(); bindPins(); bindCtx(); bindDrawer(); bindAddSongs();
  await loadPlaylists();
  navigate('home');
  if (IS_APP) initEngine(); else initSDK();
  if (IS_APP && (await window.amplite.startupMode()) === 'amp') setTimeout(() => toggleAmp(), 600);
  poll();
  schedulePoll();
  bindPrefetch();
  // Background refreshes: update the sidebar / home if Spotify returned something new.
  swrListeners.push(url => {
    if (url.includes('/me/playlists')) loadPlaylists();
    else if (/recently-played|top\/tracks/.test(url) && S.cur?.name === 'home') navigate('home', '', false);
  });
  setInterval(tickBar, 250);
  startViz();
}

boot();
