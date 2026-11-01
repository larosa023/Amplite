// Amplite integrations that live in the desktop shell:
//  - Windows taskbar: previous / play-pause / next buttons on the thumbnail and a progress bar on the icon
//  - Discord status ("Listening to …") over Discord's local IPC pipe — no extra packages
//  - Last.fm: "now playing" + scrobbles, with an offline queue
// Everything is driven by the now-playing updates the UI already sends, so it costs nothing when idle.
const { app, nativeImage, net, safeStorage, shell } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const file = name => path.join(app.getPath('userData'), name);
const readJSON = (name, d) => { try { return JSON.parse(fs.readFileSync(file(name), 'utf8')); } catch { return d; } };
const writeJSON = (name, v) => { try { fs.writeFileSync(file(name), JSON.stringify(v)); } catch {} };

/* ---------------- shared playback state ---------------- */
// track: { uri, title, artist, album, image, duration (ms) }, paused, startedAt = Date.now() - position
let cur = { track: null, paused: true, startedAt: 0, at: 0 };
const position = () => (!cur.track ? 0 : cur.paused ? cur.at : Date.now() - cur.startedAt);

/* ---------------- taskbar ---------------- */
let win = null, send = () => {}, taskbarOn = true, progressT = null, lastButtons = '';
const icon = n => nativeImage.createFromPath(path.join(__dirname, 'build', 'thumb', n + '.png'));
function setButtons() {
  if (!win || win.isDestroyed() || process.platform !== 'win32') return;
  const key = taskbarOn ? `${!!cur.track}|${cur.paused}` : 'off';
  if (key === lastButtons) return; lastButtons = key;
  if (!taskbarOn) { try { win.setThumbarButtons([]); } catch {} return; }
  try {
    win.setThumbarButtons([
      { tooltip: 'Previous', icon: icon('prev'), click: () => send('prev') },
      { tooltip: cur.paused ? 'Play' : 'Pause', icon: icon(cur.paused ? 'play' : 'pause'), click: () => send('toggle') },
      { tooltip: 'Next', icon: icon('next'), click: () => send('next') },
    ]);
  } catch {}
}
function setProgress() {
  if (!win || win.isDestroyed()) return;
  const d = cur.track?.duration;
  if (!taskbarOn || !d) { win.setProgressBar(-1); return; }
  win.setProgressBar(Math.min(1, position() / d), { mode: cur.paused ? 'paused' : 'normal' });
}
function taskbarTick() {
  clearInterval(progressT); progressT = null;
  setButtons(); setProgress();
  // Only tick while something is actually moving.
  if (taskbarOn && cur.track && !cur.paused) progressT = setInterval(setProgress, 2000);
}

/* ---------------- Discord ---------------- */
const discord = { on: false, appId: '', sock: null, ready: false, retryT: null, lastSent: '', status: 'off' };
let discordListener = () => {};
function discordStatus(s) { discord.status = s; discordListener(s); }
function discordConnect(i = 0) {
  if (!discord.on || !discord.appId || discord.sock) return;
  const net2 = require('net');
  const pipe = process.platform === 'win32' ? `\\\\?\\pipe\\discord-ipc-${i}`
    : path.join(process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || '/tmp', `discord-ipc-${i}`);
  const sock = net2.createConnection(pipe);
  let buf = Buffer.alloc(0), opened = false;
  sock.on('connect', () => {
    opened = true; discord.sock = sock;
    frame(0, { v: 1, client_id: discord.appId });
  });
  sock.on('data', d => {
    buf = Buffer.concat([buf, d]);
    while (buf.length >= 8) {
      const op = buf.readInt32LE(0), len = buf.readInt32LE(4);
      if (buf.length < 8 + len) break;
      let msg = {}; try { msg = JSON.parse(buf.slice(8, 8 + len).toString()); } catch {}
      buf = buf.slice(8 + len);
      if (op === 1 && msg.evt === 'READY') { discord.ready = true; discord.lastSent = ''; discordStatus('connected'); discordUpdate(); }
      else if (op === 1 && msg.evt === 'ERROR') discordStatus('error: ' + (msg.data?.message || 'Discord refused the status'));
      else if (op === 2) { discordStatus('error: ' + (msg.message || 'Discord closed the connection — check the application ID')); sock.destroy(); }
      else if (op === 3) frame(4, msg); // ping → pong
    }
  });
  const gone = () => {
    if (discord.sock === sock) { discord.sock = null; discord.ready = false; }
    if (!opened && i < 9) return discordConnect(i + 1); // try the next pipe number
    if (!discord.on) return;
    if (!opened) discordStatus('waiting'); // Discord isn't running
    clearTimeout(discord.retryT); discord.retryT = setTimeout(() => discordConnect(0), 20000);
  };
  sock.on('error', () => {});
  sock.on('close', gone);
}
function frame(op, data) {
  const s = discord.sock; if (!s) return;
  const body = Buffer.from(JSON.stringify(data)), head = Buffer.alloc(8);
  head.writeInt32LE(op, 0); head.writeInt32LE(body.length, 4);
  try { s.write(Buffer.concat([head, body])); } catch {}
}
function discordUpdate() {
  if (!discord.ready) return;
  const t = cur.track;
  // Shown only while playing; a paused song clears the status, like Spotify does.
  const activity = t && !cur.paused ? {
    type: 2, // "Listening to"
    details: t.title.slice(0, 128) || 'Unknown',
    state: ('by ' + (t.artist || 'Unknown artist')).slice(0, 128),
    timestamps: t.duration ? { start: cur.startedAt, end: cur.startedAt + t.duration } : { start: cur.startedAt },
    assets: { large_image: t.image || undefined, large_text: (t.album || t.title).slice(0, 128) },
    buttons: t.uri?.startsWith('spotify:track:') ? [{ label: 'Open in Spotify', url: 'https://open.spotify.com/track/' + t.uri.split(':')[2] }] : undefined,
  } : undefined;
  // Don't resend the same thing; a seek (start time moves by >2 s) counts as a change.
  const key = activity ? `${t.uri}|${Math.round(cur.startedAt / 2000)}` : 'none';
  if (key === discord.lastSent) return; discord.lastSent = key;
  frame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity }, nonce: crypto.randomUUID() });
}
function discordConfig({ on, appId }) {
  const changed = on !== discord.on || appId !== discord.appId;
  discord.on = !!on; discord.appId = (appId || '').trim();
  if (!changed) return;
  clearTimeout(discord.retryT);
  if (discord.sock) { try { discord.sock.destroy(); } catch {} discord.sock = null; discord.ready = false; }
  if (!discord.on) return discordStatus('off');
  if (!/^\d{15,22}$/.test(discord.appId)) return discordStatus('needs-id');
  discordStatus('connecting');
  discordConnect(0);
}

/* ---------------- Last.fm ---------------- */
const LFM = process.env.AMPLITE_LFM_URL || 'https://ws.audioscrobbler.com/2.0/'; // override only used by tests
const lfm = { on: true, key: '', secret: '', session: '', user: '', scrobbled: '', listened: 0, lastTick: 0, nowSent: '', queue: [] };
let lfmListener = () => {};
// The secret and session are kept encrypted with Windows' own per-user protection where available.
const seal = s => { try { return safeStorage.isEncryptionAvailable() ? 'enc:' + safeStorage.encryptString(s).toString('base64') : s; } catch { return s; } };
const unseal = s => { try { return s?.startsWith('enc:') ? safeStorage.decryptString(Buffer.from(s.slice(4), 'base64')) : (s || ''); } catch { return ''; } };
function lfmLoad() {
  const d = readJSON('lastfm.json', {});
  lfm.on = d.on !== false; lfm.key = d.key || ''; lfm.secret = unseal(d.secret); lfm.session = unseal(d.session); lfm.user = d.user || '';
  lfm.queue = Array.isArray(d.queue) ? d.queue.slice(-500) : [];
}
function lfmSave() {
  writeJSON('lastfm.json', { on: lfm.on, key: lfm.key, secret: seal(lfm.secret), session: seal(lfm.session), user: lfm.user, queue: lfm.queue.slice(-500) });
}
const lfmState = () => ({ on: lfm.on, hasKey: !!(lfm.key && lfm.secret), key: lfm.key, user: lfm.user, connected: !!lfm.session, queued: lfm.queue.length });
function sign(params) {
  const base = Object.keys(params).sort().map(k => k + params[k]).join('') + lfm.secret;
  return crypto.createHash('md5').update(base, 'utf8').digest('hex');
}
async function lfmCall(method, params = {}, post = false) {
  const p = { method, api_key: lfm.key, ...params };
  if (lfm.session && method !== 'auth.getToken' && method !== 'auth.getSession') p.sk = lfm.session;
  p.api_sig = sign(p);
  const body = new URLSearchParams({ ...p, format: 'json' });
  const r = await net.fetch(post ? LFM : LFM + '?' + body, post
    ? { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Amplite/' + app.getVersion() }, body: body.toString() }
    : { headers: { 'User-Agent': 'Amplite/' + app.getVersion() } });
  const j = await r.json().catch(() => ({}));
  if (j.error) { const e = new Error(j.message || 'Last.fm error ' + j.error); e.code = j.error; throw e; }
  if (!r.ok) throw new Error('Last.fm error ' + r.status);
  return j;
}
let connectRun = 0;
async function lfmConnect(key, secret) {
  if (key != null) { lfm.key = key.trim(); lfm.secret = (secret || '').trim(); lfm.session = ''; lfm.user = ''; lfmSave(); }
  if (!lfm.key || !lfm.secret) throw new Error('Add your Last.fm API key and shared secret first.');
  const run = ++connectRun;
  const { token } = await lfmCall('auth.getToken');
  shell.openExternal(`https://www.last.fm/api/auth/?api_key=${encodeURIComponent(lfm.key)}&token=${encodeURIComponent(token)}`);
  lfmListener({ ...lfmState(), waiting: true });
  // Wait for "Yes, allow access" in the browser (up to 3 minutes).
  for (let i = 0; i < 60 && run === connectRun; i++) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const { session } = await lfmCall('auth.getSession', { token });
      lfm.session = session.key; lfm.user = session.name; lfmSave();
      lfmListener(lfmState()); lfmFlush(); lfmNowPlaying(true);
      return lfmState();
    } catch (e) { if (e.code !== 14 && e.code !== 15 && e.code !== 4) { lfmListener(lfmState()); throw e; } } // 14 = not yet authorised
  }
  lfmListener(lfmState());
  throw new Error('Timed out waiting for Last.fm. Try Connect again.');
}
function lfmDisconnect() { connectRun++; lfm.session = ''; lfm.user = ''; lfmSave(); lfmListener(lfmState()); }
function lfmSetOn(on) { lfm.on = !!on; lfmSave(); lfmListener(lfmState()); if (lfm.on) lfmNowPlaying(true); }
const lfmReady = () => lfm.on && lfm.session && lfm.key && lfm.secret;

function lfmNowPlaying(force) {
  const t = cur.track;
  if (!lfmReady() || !t || cur.paused) return;
  if (!force && lfm.nowSent === t.uri) return;
  lfm.nowSent = t.uri;
  const p = { track: t.title, artist: t.artist };
  if (t.album) p.album = t.album;
  if (t.duration) p.duration = String(Math.round(t.duration / 1000));
  lfmCall('track.updateNowPlaying', p, true).catch(() => {});
}
async function lfmFlush() {
  if (!lfmReady() || !lfm.queue.length || lfm.flushing) return;
  lfm.flushing = true;
  try {
    while (lfm.queue.length) {
      const batch = lfm.queue.slice(0, 50), p = {};
      batch.forEach((s, i) => {
        p[`artist[${i}]`] = s.artist; p[`track[${i}]`] = s.track; p[`timestamp[${i}]`] = String(s.ts);
        if (s.album) p[`album[${i}]`] = s.album;
        if (s.duration) p[`duration[${i}]`] = String(s.duration);
      });
      try { await lfmCall('track.scrobble', p, true); }
      catch (e) {
        // 9 = bad session (access revoked): stop and ask to reconnect. Anything else: try again later.
        if (e.code === 9) { lfm.session = ''; lfm.user = ''; lfmSave(); lfmListener(lfmState()); }
        break;
      }
      lfm.queue.splice(0, batch.length); lfmSave();
    }
  } finally { lfm.flushing = false; }
}
// Last.fm's rule: a song counts once it's longer than 30 s and has played for half its length or 4 minutes.
function lfmTick() {
  const now = Date.now(), t = cur.track;
  if (t && !cur.paused && lfm.lastTick) lfm.listened += Math.min(now - lfm.lastTick, 15000);
  lfm.lastTick = now;
  if (!lfmReady() || !t || lfm.scrobbled === t.key) return;
  const need = Math.min(240000, (t.duration || 0) / 2);
  if ((t.duration || 0) > 30000 && lfm.listened >= need) {
    lfm.scrobbled = t.key;
    lfm.queue.push({ artist: t.artist, track: t.title, album: t.album || '', duration: Math.round((t.duration || 0) / 1000), ts: Math.floor(t.firstAt / 1000) });
    lfmSave(); lfmFlush();
  }
}
setInterval(lfmTick, 5000).unref?.();
setInterval(() => lfmFlush(), 5 * 60000).unref?.();

/* ---------------- updates from the UI ---------------- */
function update(n = {}) {
  lfmTick(); // count time up to now under the previous state
  const key = n.uri ? `${n.uri}` : '';
  const sameTrack = cur.track && cur.track.uri === n.uri;
  // A replay of the same song after it finished (position jumps back near 0) counts as a new play.
  const replay = sameTrack && (n.position || 0) < 5000 && position() > Math.max(30000, (cur.track.duration || 0) - 15000);
  if (!n.uri) cur = { track: null, paused: true, startedAt: 0, at: 0 };
  else {
    const track = sameTrack && !replay ? cur.track : {
      uri: n.uri, key: key + '|' + Date.now(), title: n.title || '', artist: n.artist || '', album: n.album || '',
      image: n.image || '', duration: n.duration || 0, firstAt: Date.now() - (n.position || 0),
    };
    if (!sameTrack || replay) { lfm.listened = 0; lfm.lastTick = Date.now(); lfm.nowSent = ''; }
    cur = { track, paused: n.paused !== false, at: n.position || 0, startedAt: Date.now() - (n.position || 0) };
  }
  taskbarTick();
  discordUpdate();
  lfmNowPlaying(false);
}

function init(mainWindow, sendMedia, prefs = {}) {
  win = mainWindow; send = sendMedia;
  lfmLoad();
  configure(prefs);
  win.on('show', () => { lastButtons = ''; setButtons(); setProgress(); }); // Windows forgets the buttons when a window is re-shown
}
function configure(p = {}) {
  if ('taskbar' in p) { taskbarOn = p.taskbar !== false; lastButtons = ''; taskbarTick(); }
  if ('discord' in p || 'discordAppId' in p) discordConfig({ on: p.discord ?? discord.on, appId: p.discordAppId ?? discord.appId });
}

// For the Stream Deck plugin (and anything else local): the current song, with a live position.
let extra = { volume: null, accent: '' };
function setExtra(e = {}) { extra = { ...extra, ...e }; }
function nowState() {
  const t = cur.track;
  return {
    ok: true, playing: !!t && !cur.paused, paused: !t || cur.paused, ...extra,
    track: t ? { uri: t.uri, title: t.title, artist: t.artist, album: t.album, image: t.image, duration: t.duration } : null,
    position: Math.round(position()), at: Date.now(),
  };
}

module.exports = {
  init, configure, update, setExtra, nowState,
  discordStatus: () => discord.status, onDiscord: f => { discordListener = f; },
  lastfm: { state: lfmState, connect: lfmConnect, disconnect: lfmDisconnect, setOn: lfmSetOn, onChange: f => { lfmListener = f; } },
  shutdown() { try { if (discord.sock) { frame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid }, nonce: crypto.randomUUID() }); discord.sock.end(); } } catch {} },
};
