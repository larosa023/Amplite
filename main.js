// Amplite — desktop shell (Electron). Audio comes from the bundled librespot engine (engine.js);
// the castLabs build keeps Widevine available as a fallback player.
const { app, BrowserWindow, components, ipcMain, globalShortcut, shell, Menu, Tray, nativeImage } = require('electron');
const http = require('http');
const integrations = require('./integrations');
const fs = require('fs');
const path = require('path');

// Spotify only accepts loopback redirect URIs for desktop apps, so the UI is served
// from a tiny local server. Add http://127.0.0.1:43821/callback in your Spotify dashboard.
const PORT = 43821;
const ROOT = path.join(__dirname, 'src');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

let mainWin = null;
let ampWin = null;
const ampOpts = { opacity: 1, onTop: true, snap: true };
const ampPosFile = () => path.join(app.getPath('userData'), 'amp-window.json');
const boundsFile = () => path.join(app.getPath('userData'), 'window.json');

/* ---------------- prefs needed before startup ---------------- */
const prefsFile = () => path.join(app.getPath('userData'), 'prefs.json');
let prefs = { closeToTray: true, startup: 'off', hwAccel: true, taskbar: true, discord: false, discordAppId: '' };
try { prefs = { ...prefs, ...JSON.parse(fs.readFileSync(prefsFile(), 'utf8')) }; } catch {}
if (prefs.hwAccel === false) app.disableHardwareAcceleration(); // saves the GPU process (~100 MB)
// Lighter Chromium: no hardware media-key handler (we use our own global shortcuts), capped disk cache.
// CalculateNativeWinOcclusion: Chromium can wrongly think a small window that straddles two monitors
// is covered and stop painting it (the mini amp froze). Turning that detection off keeps it live.
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,SpareRendererForSitePerProcess,CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disk-cache-size', String(64 * 1024 * 1024));
const startupMode = (process.argv.find(a => a.startsWith('--startup=')) || '').split('=')[1] || 'normal';
let quitting = false;
app.on('before-quit', () => { quitting = true; });

// Only one Amplite at a time: a second launch just focuses the first one and exits right away.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.exit(0);
app.on('second-instance', () => {
  if (!mainWin) return;
  if (!mainWin.isVisible()) mainWin.show();
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.focus();
});

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
        if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
        let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
        if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
        let st = null; try { st = fs.statSync(file); } catch {}
        if (url.pathname === '/' || !st || st.isDirectory()) { file = path.join(ROOT, 'index.html'); st = fs.statSync(file); }
        // Revalidate instead of no-store: lets Chromium keep its compiled-code cache between launches,
        // while an update (new file) is still picked up immediately.
        const etag = `"${st.size}-${Math.round(st.mtimeMs)}"`;
        if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag }); return res.end(); }
        fs.readFile(file, (err, data) => {
          if (err) { res.writeHead(404); return res.end(); }
          res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ETag: etag });
          res.end(data);
        });
      } catch { res.writeHead(400); res.end(); }
    });
    server.once('error', reject);
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

// Local API for the Stream Deck plugin. Only apps on this PC can use it: wrong Host (DNS rebinding)
// and any web page (they always send an Origin header) are refused, and commands need a custom header
// that browsers can't send cross-site without permission.
// eq:on / eq:off / eq:<preset> switch the equalizer (used by Mantel's Now Playing widget).
const API_CMDS = /^(toggle|next|prev|like|vol:[+-]\d{1,3}|seek:[+-]\d{1,7}|eq:[a-z]{1,16})$/;
function handleApi(req, res, url) {
  const json = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
  const host = (req.headers.host || '').toLowerCase();
  if (host !== `127.0.0.1:${PORT}` && host !== `localhost:${PORT}`) return json(403, { ok: false });
  if (req.headers.origin) return json(403, { ok: false });
  if (url.pathname === '/api/now' && req.method === 'GET') return json(200, { ...integrations.nowState(), version: app.getVersion() });
  if (url.pathname === '/api/cmd' && req.method === 'POST') {
    if (req.headers['x-amplite'] !== '1') return json(403, { ok: false });
    let body = '';
    req.on('data', c => { body += c; if (body.length > 200) req.destroy(); });
    req.on('end', () => {
      let cmd = ''; try { cmd = JSON.parse(body).cmd; } catch {}
      if (!API_CMDS.test(cmd || '')) return json(400, { ok: false });
      mainWin?.webContents.send('media', cmd);
      json(200, { ok: true });
    });
    return;
  }
  json(404, { ok: false });
}

function loadBounds() {
  try { return JSON.parse(fs.readFileSync(boundsFile(), 'utf8')); } catch { return {}; }
}
let boundsT;
function saveBounds() {
  // Debounced: dragging fires dozens of move events; write once it settles.
  clearTimeout(boundsT);
  boundsT = setTimeout(() => {
    if (!mainWin || mainWin.isDestroyed() || mainWin.isMinimized() || !mainWin.isVisible()) return;
    fs.writeFile(boundsFile(), JSON.stringify({ ...mainWin.getNormalBounds(), maximized: mainWin.isMaximized() }), () => {});
  }, 500);
}

function createMain() {
  const b = loadBounds();
  mainWin = new BrowserWindow({
    width: b.width || 1280, height: b.height || 820, x: b.x, y: b.y,
    minWidth: 800, minHeight: 560,
    show: false,
    title: 'Amplite',
    backgroundColor: '#0b0d12',
    icon: path.join(__dirname, 'build', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0b0d12', symbolColor: '#e9ecf2', height: 36 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      backgroundThrottling: false, // keep playback + timers running when hidden behind the mini amp
      spellcheck: false,
      v8CacheOptions: 'bypassHeatCheck', // cache compiled JS for faster startup
    },
  });
  if (b.maximized) mainWin.maximize();
  mainWin.once('ready-to-show', () => { if (startupMode === 'normal') mainWin.show(); });
  // Close to tray: keep playing in the background instead of quitting.
  mainWin.on('close', e => { if (prefs.closeToTray && tray && !quitting) { e.preventDefault(); mainWin.hide(); } });
  mainWin.on('resize', saveBounds);
  mainWin.on('move', saveBounds);
  mainWin.on('closed', () => { mainWin = null; app.quit(); });
  // Tell the page whether it's really on screen (hidden to tray, minimised, behind the mini amp).
  const vis = v => () => { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('win-visible', v); };
  mainWin.on('hide', vis(false)); mainWin.on('minimize', vis(false));
  mainWin.on('show', vis(true)); mainWin.on('restore', vis(true));
  mainWin.webContents.on('did-finish-load', () => { if (!mainWin.isVisible() || mainWin.isMinimized()) vis(false)(); });

  // window.open('', 'amp') from the renderer becomes the frameless, always-on-top mini amp.
  mainWin.webContents.setWindowOpenHandler(({ url, frameName }) => {
    if (frameName === 'amp') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 330, height: 150, frame: false, resizable: false, maximizable: false, fullscreenable: false,
          alwaysOnTop: true, skipTaskbar: false, title: 'Amplite', backgroundColor: '#05070b',
          icon: path.join(__dirname, 'build', 'icon.png'),
          webPreferences: { backgroundThrottling: false },
        },
      };
    }
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWin.webContents.on('did-create-window', win => {
    ampWin = win;
    win.setAlwaysOnTop(ampOpts.onTop, 'floating');
    win.setOpacity(ampOpts.opacity);
    win.setMenu(null);
    // Reopen where you left it (if that spot is still on a screen).
    try {
      const { x, y } = JSON.parse(fs.readFileSync(ampPosFile(), 'utf8'));
      const { screen } = require('electron');
      const area = screen.getDisplayNearestPoint({ x, y }).workArea;
      if (x >= area.x - 20 && y >= area.y - 20 && x < area.x + area.width - 40 && y < area.y + area.height - 40) win.setPosition(x, y);
    } catch {}
    let t;
    // Windows fires 'moved' when you let go after dragging; other systems only fire 'move'.
    if (process.platform === 'win32') win.on('moved', () => { clearTimeout(t); t = setTimeout(() => snapAmp(win), 60); });
    else win.on('move', () => { clearTimeout(t); t = setTimeout(() => snapAmp(win), 300); });
    win.on('closed', () => { if (ampWin === win) ampWin = null; });
  });
  // Keep in-app navigation on our origin or Spotify's login pages.
  mainWin.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith(`http://127.0.0.1:${PORT}`) || url.startsWith('https://accounts.spotify.com') || url.startsWith('https://www.spotify.com') || url.startsWith('https://challenge.spotify.com')) return;
    e.preventDefault();
    shell.openExternal(url);
  });

  // If Spotify shows a bare error page during login (e.g. redirect URI not added yet),
  // explain the fix and go back to Amplite instead of leaving the user stuck.
  mainWin.webContents.on('did-finish-load', async () => {
    const wc = mainWin?.webContents; if (!wc) return;
    const url = wc.getURL();
    if (!url.startsWith('https://accounts.spotify.com')) return;
    let text = '';
    try { text = await wc.executeJavaScript('(document.body && document.body.innerText || "").slice(0, 400)'); } catch {}
    const redirect = /redirect_uri/i.test(text), client = /invalid_client|INVALID_CLIENT/i.test(text);
    if (!redirect && !client) return;
    const { dialog, clipboard } = require('electron');
    let sent = {};
    try { const q = new URL(url).searchParams; sent = { client: q.get('client_id'), redirect: q.get('redirect_uri') }; } catch {}
    const uri = sent.redirect || `http://127.0.0.1:${PORT}/callback`;
    const r = await dialog.showMessageBox(mainWin, {
      type: 'warning', title: 'Spotify login setup',
      message: redirect ? 'Spotify doesn’t recognise Amplite’s redirect URI yet.' : 'Spotify rejected the Client ID.',
      detail: redirect
        ? `In developer.spotify.com/dashboard, open the app whose Client ID is\n${sent.client || '(unknown)'}\n→ Settings → Edit, add this Redirect URI exactly, then click Save at the bottom:\n\n${uri}\n\nChanges can take a minute to apply. Then try logging in again. (Amplite v${app.getVersion()})`
        : `Check the Client ID in your Spotify developer dashboard.\n\nSpotify said: ${text.trim()}`,
      buttons: redirect ? ['Copy URI and go back', 'Go back'] : ['Go back'],
      defaultId: 0,
    });
    if (redirect && r.response === 0) clipboard.writeText(uri);
    mainWin?.loadURL(`http://127.0.0.1:${PORT}/`);
  });

  mainWin.loadURL(`http://127.0.0.1:${PORT}/`);
}

ipcMain.on('theme', (_e, { bg, text }) => {
  try { mainWin?.setTitleBarOverlay({ color: bg, symbolColor: text }); mainWin?.setBackgroundColor(bg); } catch {}
});
ipcMain.on('main-visibility', (_e, show) => {
  if (!mainWin) return;
  if (show) { mainWin.show(); mainWin.focus(); } else mainWin.hide();
});
ipcMain.on('quit', () => app.quit());
ipcMain.handle('startup-mode', () => startupMode);
// Synced lyrics from LRCLIB (free, public). Fetched here so the page needs no extra permissions.
ipcMain.handle('lyrics', async (_e, q = {}) => {
  const { net } = require('electron');
  const headers = { 'User-Agent': 'Amplite (https://github.com/larosa023/Amplite)' };
  const get = async url => { const r = await net.fetch(url, { headers }); return r.ok ? r.json() : null; };
  try {
    const exact = await get('https://lrclib.net/api/get?' + new URLSearchParams({ track_name: q.track, artist_name: q.artist, album_name: q.album || '', duration: String(q.duration || '') }));
    if (exact) return exact;
    const list = await get('https://lrclib.net/api/search?' + new URLSearchParams({ track_name: q.track, artist_name: q.artist }));
    if (!Array.isArray(list) || !list.length) return null;
    // Prefer synced lyrics whose length matches the song.
    list.sort((a, b) => (!!b.syncedLyrics - !!a.syncedLyrics) || Math.abs((a.duration || 0) - q.duration) - Math.abs((b.duration || 0) - q.duration));
    return list[0];
  } catch (e) { return { error: e.message }; }
});
ipcMain.on('prefs', (_e, p = {}) => {
  prefs = { ...prefs, ...p };
  try { fs.writeFileSync(prefsFile(), JSON.stringify(prefs)); } catch {}
  integrations.configure(p);
  if (app.isPackaged && process.platform === 'win32') {
    try { app.setLoginItemSettings({ openAtLogin: prefs.startup !== 'off', args: prefs.startup !== 'off' ? [`--startup=${prefs.startup}`] : [] }); } catch {}
  }
});

/* ---------------- tray ---------------- */
let tray = null, now = { title: '', artist: '', paused: true };
function showMain() { if (!mainWin) return; mainWin.show(); if (mainWin.isMinimized()) mainWin.restore(); mainWin.focus(); }
function trayMenu() {
  const send = cmd => mainWin?.webContents.send('media', cmd);
  return Menu.buildFromTemplate([
    { label: now.title ? `${now.title}${now.artist ? ' — ' + now.artist : ''}`.slice(0, 60) : 'Nothing playing', enabled: false },
    { type: 'separator' },
    { label: now.paused ? 'Play' : 'Pause', click: () => send('toggle') },
    { label: 'Next', click: () => send('next') },
    { label: 'Previous', click: () => send('prev') },
    { type: 'separator' },
    { label: 'Show Amplite', click: showMain },
    { label: 'Mini amp', click: () => send('amp') },
    { type: 'separator' },
    { label: 'Quit Amplite', click: () => { quitting = true; app.quit(); } },
  ]);
}
function createTray() {
  try {
    const icon = nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png')).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip('Amplite');
    tray.setContextMenu(trayMenu());
    tray.on('click', () => (mainWin?.isVisible() && !mainWin.isMinimized() ? mainWin.hide() : showMain()));
  } catch (e) { console.warn('Tray unavailable', e); }
}
ipcMain.on('now-playing', (_e, n = {}) => {
  integrations.update(n);
  const changed = n.title !== now.title || n.artist !== now.artist || (n.paused !== false) !== now.paused;
  now = { title: n.title || '', artist: n.artist || '', paused: n.paused !== false };
  if (!changed) return; // position-only update (seek): nothing for the tray
  if (!tray) return;
  tray.setToolTip(now.title ? `${now.paused ? '⏸' : '▶'} ${now.title} — ${now.artist}`.slice(0, 120) : 'Amplite');
  tray.setContextMenu(trayMenu());
});
// Snap the mini amp to screen edges/corners when dropped within 24 px of them, and remember the spot.
// Snap the mini amp to screen edges/corners when dropped within 24 px of them, and always keep it
// entirely on ONE monitor (never hanging over onto the next screen). Remembers the spot.
function snapAmp(win, corner, again = true) {
  if (!win || win.isDestroyed()) return;
  const { screen } = require('electron');
  const b = win.getBounds();
  // The monitor that holds the centre of the amp is "its" monitor.
  const disp = screen.getDisplayNearestPoint({ x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) });
  const area = disp.workArea, T = 24;
  // Edges shared with another monitor get a 1 px margin, so DPI rounding can't push the amp across.
  const others = screen.getAllDisplays().filter(d => d.id !== disp.id).map(d => d.bounds);
  const touches = side => others.some(o => side === 'l' ? Math.abs(o.x + o.width - disp.bounds.x) <= 1 && o.y < area.y + area.height && o.y + o.height > area.y
    : side === 'r' ? Math.abs(o.x - (disp.bounds.x + disp.bounds.width)) <= 1 && o.y < area.y + area.height && o.y + o.height > area.y
    : side === 't' ? Math.abs(o.y + o.height - disp.bounds.y) <= 1 && o.x < area.x + area.width && o.x + o.width > area.x
    : Math.abs(o.y - (disp.bounds.y + disp.bounds.height)) <= 1 && o.x < area.x + area.width && o.x + o.width > area.x);
  const L = area.x + (touches('l') ? 1 : 0), R = area.x + area.width - (touches('r') ? 1 : 0);
  const Tp = area.y + (touches('t') ? 1 : 0), B = area.y + area.height - (touches('b') ? 1 : 0);
  let { x, y } = b;
  if (corner) {
    x = corner.includes('l') ? L : R - b.width;
    y = corner.includes('t') ? Tp : B - b.height;
  } else if (ampOpts.snap) {
    if (Math.abs(x - L) < T) x = L;
    if (Math.abs(R - (x + b.width)) < T) x = R - b.width;
    if (Math.abs(y - Tp) < T) y = Tp;
    if (Math.abs(B - (y + b.height)) < T) y = B - b.height;
  }
  // Never straddle monitors: clamp fully inside this one.
  x = Math.min(Math.max(x, L), R - b.width);
  y = Math.min(Math.max(y, Tp), B - b.height);
  if (x !== b.x || y !== b.y) {
    win.setBounds({ x, y, width: b.width, height: b.height });
    // Windows may rescale the window when it changes monitor (different DPI); check once more.
    if (again) setTimeout(() => snapAmp(win, corner, false), 120);
  }
  try { fs.writeFileSync(ampPosFile(), JSON.stringify({ x, y })); } catch {}
}
ipcMain.on('amp-window', (_e, o = {}) => {
  if (typeof o.snap === 'boolean') ampOpts.snap = o.snap;
  if ((o.corner || o.clamp) && ampWin && !ampWin.isDestroyed()) setTimeout(() => ampWin && !ampWin.isDestroyed() && snapAmp(ampWin, o.corner || null), 30);
  if (typeof o.opacity === 'number') ampOpts.opacity = Math.max(0.3, Math.min(1, o.opacity));
  if (typeof o.onTop === 'boolean') ampOpts.onTop = o.onTop;
  if (ampWin && !ampWin.isDestroyed()) { ampWin.setOpacity(ampOpts.opacity); ampWin.setAlwaysOnTop(ampOpts.onTop, 'floating'); }
});

/* ---------------- audio engine (librespot, 320 kbps) ---------------- */
const { Engine } = require('./engine');
const engine = new Engine(st => mainWin?.webContents.send('engine', st));
ipcMain.handle('engine-status', () => engine.status());
ipcMain.handle('engine-logs', () => engine.logs.slice(-120));
ipcMain.on('engine-start', (_e, opts) => { engine.configure(typeof opts === 'number' ? { volume: opts } : opts || {}); engine.start(); });
// Only restart for new settings if the engine is actually in use (not in web-player / Spotify-app mode).
ipcMain.on('engine-config', (_e, opts) => { if (engine.configure(opts || {}) && engine.wanted) engine.restart(); });
ipcMain.on('engine-restart', (_e, opts) => engine.restart(opts || {}));
ipcMain.on('engine-stop', () => engine.stop());
ipcMain.on('eq-set', (_e, eq) => engine.setEq(eq));

/* ---------------- official Spotify app (fallback playback) ---------------- */
// Used when Spotify refuses the engine's audio keys for an account: Amplite starts the
// regular Spotify desktop app minimised and sends playback to it over Spotify Connect.
function findSpotifyExe() {
  const env = process.env;
  const c = process.platform === 'win32'
    ? [path.join(env.APPDATA || '', 'Spotify', 'Spotify.exe'), path.join(env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps', 'Spotify.exe')]
    : process.platform === 'darwin' ? ['/Applications/Spotify.app/Contents/MacOS/Spotify'] : ['/usr/bin/spotify', '/snap/bin/spotify'];
  return c.find(p => { try { fs.accessSync(p); return true; } catch { return false; } });
}
let launchedSpotify = false; // true only if Amplite itself started Spotify hidden
// Hides Spotify's window completely (no taskbar button) using Win32 ShowWindow(SW_HIDE).
// Spotify keeps running and playing; Amplite stays the only thing you see.
function hideSpotifyWindow() {
  if (process.platform !== 'win32') return;
  const ps = `Add-Type -Namespace A -Name W -MemberDefinition '[DllImport("user32.dll")] public static extern bool ShowWindowAsync(System.IntPtr h, int n);';
Get-Process Spotify -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | ForEach-Object { [A.W]::ShowWindowAsync($_.MainWindowHandle, 0) | Out-Null }`;
  try {
    const { spawn } = require('child_process');
    spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', ps], { windowsHide: true, stdio: 'ignore' });
  } catch {}
}
ipcMain.handle('spotify-app', async (_e, action, opts = {}) => {
  const exe = findSpotifyExe();
  if (action === 'check') return { installed: !!exe, host: require('os').hostname() };
  if (action === 'hide') { hideSpotifyWindow(); return { ok: true }; }
  try {
    if (exe) {
      const { spawn } = require('child_process');
      spawn(exe, ['--minimized'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    } else await shell.openExternal('spotify:');
    launchedSpotify = opts.hide !== false;
    // Spotify creates its window a few seconds after launch; hide it as soon as it appears.
    if (opts.hide !== false) [1500, 3000, 5000, 8000, 12000, 18000].forEach(ms => setTimeout(hideSpotifyWindow, ms));
    return { ok: true, how: exe ? 'exe' : 'protocol' };
  } catch (e) { return { ok: false, error: e.message }; }
});
// If Amplite started Spotify for you, close it again when Amplite quits.
app.on('before-quit', () => {
  if (!launchedSpotify || process.platform !== 'win32') return;
  try { require('child_process').spawn('taskkill', ['/F', '/IM', 'Spotify.exe', '/T'], { windowsHide: true, stdio: 'ignore', detached: true }).unref(); } catch {}
});

/* ---------------- auto-update (GitHub Releases) ---------------- */
let autoUpdater = null;
const sendUpdate = (state, extra = {}) => mainWin?.webContents.send('update', { state, ...extra });
function initUpdater() {
  if (!app.isPackaged) return; // only in the installed app
  try { ({ autoUpdater } = require('electron-updater')); } catch (e) { console.warn('Updater unavailable', e); return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => sendUpdate('checking'));
  autoUpdater.on('update-available', i => sendUpdate('downloading', { version: i.version }));
  autoUpdater.on('update-not-available', () => sendUpdate('latest'));
  autoUpdater.on('download-progress', p => sendUpdate('downloading', { percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', i => sendUpdate('ready', { version: i.version }));
  autoUpdater.on('error', e => sendUpdate('error', { message: String(e?.message || e).split('\n')[0] }));
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(check, 5000);
  setInterval(check, 4 * 60 * 60 * 1000);
}
ipcMain.on('player-extra', (_e, x = {}) => {
  const e = x.eq && typeof x.eq === 'object' ? x.eq : null;
  integrations.setExtra({
    volume: typeof x.volume === 'number' ? x.volume : null,
    accent: /^#[0-9a-f]{6}$/i.test(x.accent || '') ? x.accent : '',
    // Equalizer state + the preset list, so local apps (Mantel) can show and switch presets.
    eq: e ? {
      available: !!e.available, on: !!e.on,
      preset: /^[a-z]{1,16}$/.test(e.preset || '') ? e.preset : 'custom',
      presets: (Array.isArray(e.presets) ? e.presets : []).slice(0, 24)
        .filter(p => Array.isArray(p) && /^[a-z]{1,16}$/.test(p[0]) && typeof p[1] === 'string')
        .map(p => ({ id: p[0], name: p[1].slice(0, 32) })),
    } : null,
  });
});
ipcMain.handle('history', async (_e, action, a = {}) => {
  const H = integrations.history;
  try {
    if (action === 'read') return { ok: true, items: await H.read() };
    if (action === 'append') { H.append((a.items || []).filter(r => r && typeof r.ts === 'number' && typeof r.title === 'string').slice(0, 20000)); return { ok: true }; }
    if (action === 'clear') { H.clear(); return { ok: true }; }
    if (action === 'lastfm') return { ok: true, ...(await H.lastfmPage(a.page || 1)) };
    if (action === 'tags') return { ok: true, tags: await H.tags(a.artist) };
  } catch (e) { return { ok: false, error: e.message }; }
  return { ok: false };
});
ipcMain.handle('discord-status', () => integrations.discordStatus());
ipcMain.handle('lastfm', async (_e, action, a = {}) => {
  const L = integrations.lastfm;
  try {
    if (action === 'connect') return { ok: true, state: await L.connect(a.key, a.secret) };
    if (action === 'similar') { if (!L.state().key) return { ok: false, error: 'nokey' }; return { ok: true, similar: await L.similar(a) }; }
    if (action === 'disconnect') L.disconnect();
    if (action === 'on') L.setOn(a.on);
    return { ok: true, state: L.state() };
  } catch (e) { return { ok: false, error: e.message, state: L.state() }; }
});
ipcMain.handle('app-info', () => ({ version: app.getVersion(), packaged: app.isPackaged }));
ipcMain.on('update-check', () => {
  if (!autoUpdater) return sendUpdate('error', { message: app.isPackaged ? 'Updater unavailable' : 'Updates only work in the installed app' });
  autoUpdater.checkForUpdates().catch(e => sendUpdate('error', { message: String(e?.message || e).split('\n')[0] }));
});
ipcMain.on('update-install', () => { if (autoUpdater) setImmediate(() => autoUpdater.quitAndInstall(false, true)); });

app.whenReady().then(async () => {
  if (!gotLock) return;
  Menu.setApplicationMenu(null);
  try {
    await components.whenReady();
    console.log('Widevine components:', components.status());
  } catch (e) { console.warn('Widevine unavailable:', e?.message || e); }

  try { await startServer(); }
  catch (e) {
    const { dialog } = require('electron');
    dialog.showErrorBox('Amplite', `Couldn't start on port ${PORT}. Is Amplite already running?\n\n${e.message}`);
    return app.quit();
  }
  createMain();
  createTray();
  initUpdater();

  const send = cmd => mainWin?.webContents.send('media', cmd);
  integrations.init(mainWin, send, prefs);
  integrations.onDiscord(s => mainWin?.webContents.send('discord', s));
  integrations.lastfm.onChange(s => mainWin?.webContents.send('lastfm', s));
  globalShortcut.register('MediaPlayPause', () => send('toggle'));
  globalShortcut.register('MediaNextTrack', () => send('next'));
  globalShortcut.register('MediaPreviousTrack', () => send('prev'));
  globalShortcut.register('MediaStop', () => send('stop'));
});

app.on('will-quit', () => { globalShortcut.unregisterAll(); integrations.shutdown(); engine.stop(); });
app.on('window-all-closed', () => app.quit());
