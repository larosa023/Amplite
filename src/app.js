// Amplite — a lightweight Spotify player
// Pure ES modules, no build step. Auth uses PKCE, so only the public Client ID lives here.

const CLIENT_ID = '4a805ba1e7ce4e008949154d92827b38';
const IS_APP = !!window.amplite; // running inside the Amplite desktop app
const REDIRECT_URI = location.origin + location.pathname.replace(/index\.html$/, '');
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
  history.replaceState(null, '', REDIRECT_URI);
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
  location.href = REDIRECT_URI;
}

/* ---------------- Web API ---------------- */
async function api(path, { method = 'GET', body, query } = {}, retry = true) {
  const token = await getToken();
  let url = path.startsWith('http') ? path : 'https://api.spotify.com/v1' + path;
  if (query) url += (url.includes('?') ? '&' : '?') + new URLSearchParams(query);
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
};
const pos = () => {
  const n = S.now; if (!n) return 0;
  return n.paused ? n.position : Math.min(n.duration, n.position + (performance.now() - n.ts));
};

/* ---------------- Web Playback SDK ---------------- */
function initSDK() {
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

/* ---------------- playback controls ---------------- */
const isLocal = () => S.player && S.now?.source === 'sdk';
const fail = e => {
  if (e.status === 404) toast('No active device. Open Spotify somewhere, or use Chrome/Edge with Premium.');
  else if (e.status === 403) toast('Spotify refused that (Premium is required for playback control).');
  else toast(e.message);
};

async function startPlayback(body) {
  activate();
  try {
    await api('/me/player/play', { method: 'PUT', query: S.deviceId ? { device_id: S.deviceId } : undefined, body });
    pollSoon(900);
  } catch (e) { fail(e); }
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
    volT = setTimeout(() => api('/me/player/volume', { method: 'PUT', query: { volume_percent: Math.round(v * 100) } }).catch(() => {}), 250);
  }
  syncVolume();
}
async function playHere() {
  if (!S.deviceId) return;
  activate();
  try { await api('/me/player', { method: 'PUT', body: { device_ids: [S.deviceId], play: !S.now?.paused } }); pollSoon(1200); } catch (e) { fail(e); }
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
  if (n?.source === 'remote') {
    dev.classList.remove('hidden');
    dev.textContent = `On ${n.device}${S.deviceId ? ' · Play here' : ''}`;
    dev.disabled = !S.deviceId;
  } else dev.classList.add('hidden');

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
  seek: $('#ampSeek', ampEl), vol: $('#ampVol', ampEl), dev: $('#ampDev', ampEl),
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
    await new Promise(r => w.requestAnimationFrame(r));
    const r = ampEl.getBoundingClientRect();
    try { w.resizeTo(Math.ceil(r.width), Math.ceil(r.height)); } catch {}
    window.amplite.setMainVisible(false);
  }
  startViz();
}
// A closed popup doesn't always fire pagehide, so double-check.
setInterval(() => { if (S.ampWin?.closed) onAmpWinClosed(); }, 500);

async function toggleAmp() {
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

// Simulated spectrum (Spotify's DRM audio can't be analysed in the browser).
const V = { h: new Float32Array(19), pk: new Float32Array(19), tg: new Float32Array(19), lastT: 0, lastTxt: 0, lastMarq: 0, off: 0, text: '' };
let vizId = 0;
function startViz() {
  const id = ++vizId;
  const step = t => {
    if (id !== vizId) return;
    if (ampOpen()) drawAmp(t);
    (S.ampWin || window).requestAnimationFrame(step);
  };
  (S.ampWin || window).requestAnimationFrame(step);
}
function drawAmp(t) {
  const n = S.now, playing = n && !n.paused;
  if (t - V.lastTxt > 100) {
    V.lastTxt = t;
    const p = pos(), d = n?.duration || 0;
    A.time.textContent = S.ampRemain && d ? '-' + fmt(d - p, true) : fmt(p, true);
    A.state.textContent = !n ? '■' : n.paused ? '❚❚' : '▶';
    if (!S.ampSeeking) setRange(A.seek, d ? p / d : 0);
  }
  if (t - V.lastMarq > 220) {
    V.lastMarq = t;
    const txt = n ? `${n.artists.map(a => a.name).join(', ')} - ${n.name} (${fmt(n.duration)})   ***   ` : 'AMPLITE   ***   PICK A SONG TO START   ***   ';
    if (txt !== V.text) { V.text = txt; V.off = 0; } else V.off = (V.off + 1) % txt.length;
    A.marq.textContent = txt.slice(V.off) + txt.slice(0, V.off);
  }
  const c = A.viz, x = c.getContext('2d'), W = c.width, H = c.height, N = V.h.length;
  if (!S.vizGrad) {
    const cs = ampEl.ownerDocument.defaultView.getComputedStyle(ampEl), g = x.createLinearGradient(0, H, 0, 0);
    g.addColorStop(0, cs.getPropertyValue('--viz-lo').trim() || '#0c0');
    g.addColorStop(0.6, cs.getPropertyValue('--viz-mid').trim() || '#ee0');
    g.addColorStop(1, cs.getPropertyValue('--viz-hi').trim() || '#f20');
    S.vizGrad = g; S.vizPeak = cs.getPropertyValue('--amp-lcd-text').trim() || '#fff';
  }
  if (playing && t - V.lastT > 70) {
    V.lastT = t;
    const s = t / 1000, beat = Math.pow(Math.max(0, Math.sin(s * Math.PI * 4.1)), 6);
    for (let i = 0; i < N; i++) {
      const f = i / N;
      V.tg[i] = Math.min(1, Math.max(0.04, 0.55 - 0.35 * f + (Math.random() - 0.4) * 0.45 * (1 - f * 0.4) + beat * (0.45 - 0.35 * f) + 0.12 * Math.sin(s * 3 + i)));
    }
  }
  x.clearRect(0, 0, W, H);
  for (let i = 0; i < N; i++) {
    V.h[i] += playing ? (V.tg[i] - V.h[i]) * 0.3 : -V.h[i] * 0.08;
    V.pk[i] = V.h[i] > V.pk[i] ? V.h[i] : Math.max(0, V.pk[i] - 0.008);
    const bh = Math.round(V.h[i] * H), px = i * 5;
    x.fillStyle = S.vizGrad;
    for (let y = H - 1; y >= H - bh; y -= 2) x.fillRect(px, y, 4, 1);
    if (V.pk[i] > 0.02) { x.fillStyle = S.vizPeak; x.fillRect(px, H - 1 - Math.round(V.pk[i] * (H - 1)), 4, 1); }
  }
}

/* ---------------- events ---------------- */
function onKey(e) {
  const tag = e.target?.tagName;
  if ((tag === 'INPUT' && e.target.type !== 'range') || tag === 'TEXTAREA') return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') { e.preventDefault(); next(); }
  else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
  else if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey) toggleAmp();
  else if (e.key === '/' && !S.ampWin) { e.preventDefault(); navigate('search'); }
}

function bind() {
  $('#loginBtn').onclick = login;
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
  }
  $$('[data-i]').forEach(el => el.insertAdjacentHTML('afterbegin', svg(el.dataset.i)));
  $$('[data-logo]').forEach(el => { el.innerHTML = LOGO; });
  renderThemes();
  bind();
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
  initSDK();
  poll();
  setInterval(poll, 5000);
  setInterval(tickBar, 250);
  startViz();
}

boot();
