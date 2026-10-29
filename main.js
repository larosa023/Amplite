// Amplite — desktop shell (Electron). Audio comes from the bundled librespot engine (engine.js);
// the castLabs build keeps Widevine available as a fallback player.
const { app, BrowserWindow, components, ipcMain, globalShortcut, shell, Menu } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Spotify only accepts loopback redirect URIs for desktop apps, so the UI is served
// from a tiny local server. Add http://127.0.0.1:43821/callback in your Spotify dashboard.
const PORT = 43821;
const ROOT = path.join(__dirname, 'src');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

let mainWin = null;
let ampWin = null;
const ampOpts = { opacity: 1, onTop: true };
const boundsFile = () => path.join(app.getPath('userData'), 'window.json');

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => {
  if (!mainWin) return;
  if (!mainWin.isVisible()) mainWin.show();
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.focus();
});

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
      let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      if (url.pathname === '/' || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, 'index.html');
      fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
      });
    });
    server.once('error', reject);
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

function loadBounds() {
  try { return JSON.parse(fs.readFileSync(boundsFile(), 'utf8')); } catch { return {}; }
}
function saveBounds() {
  if (!mainWin || mainWin.isMinimized() || !mainWin.isVisible()) return;
  try { fs.writeFileSync(boundsFile(), JSON.stringify({ ...mainWin.getNormalBounds(), maximized: mainWin.isMaximized() })); } catch {}
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
  mainWin.once('ready-to-show', () => mainWin.show());
  mainWin.on('resize', saveBounds);
  mainWin.on('move', saveBounds);
  mainWin.on('closed', () => { mainWin = null; app.quit(); });

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
ipcMain.on('amp-window', (_e, o = {}) => {
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
ipcMain.on('engine-config', (_e, opts) => { if (engine.configure(opts || {})) engine.restart(); });
ipcMain.on('engine-restart', (_e, opts) => engine.restart(opts || {}));
ipcMain.on('engine-stop', () => engine.stop());

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
ipcMain.handle('spotify-app', async (_e, action) => {
  const exe = findSpotifyExe();
  if (action === 'check') return { installed: !!exe, host: require('os').hostname() };
  try {
    if (exe) {
      const { spawn } = require('child_process');
      spawn(exe, ['--minimized'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
      return { ok: true, how: 'exe' };
    }
    await shell.openExternal('spotify:');
    return { ok: true, how: 'protocol' };
  } catch (e) { return { ok: false, error: e.message }; }
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
ipcMain.handle('app-info', () => ({ version: app.getVersion(), packaged: app.isPackaged }));
ipcMain.on('update-check', () => {
  if (!autoUpdater) return sendUpdate('error', { message: app.isPackaged ? 'Updater unavailable' : 'Updates only work in the installed app' });
  autoUpdater.checkForUpdates().catch(e => sendUpdate('error', { message: String(e?.message || e).split('\n')[0] }));
});
ipcMain.on('update-install', () => { if (autoUpdater) setImmediate(() => autoUpdater.quitAndInstall(false, true)); });

app.whenReady().then(async () => {
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
  initUpdater();

  const send = cmd => mainWin?.webContents.send('media', cmd);
  globalShortcut.register('MediaPlayPause', () => send('toggle'));
  globalShortcut.register('MediaNextTrack', () => send('next'));
  globalShortcut.register('MediaPreviousTrack', () => send('prev'));
  globalShortcut.register('MediaStop', () => send('stop'));
});

app.on('will-quit', () => { globalShortcut.unregisterAll(); engine.stop(); });
app.on('window-all-closed', () => app.quit());
