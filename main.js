// Amplite — desktop shell (Electron, castLabs build with Widevine for Spotify playback)
const { app, BrowserWindow, components, ipcMain, globalShortcut, shell, Menu } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Spotify only accepts loopback redirect URIs for desktop apps, so the UI is served
// from a tiny local server. Add http://127.0.0.1:43821/ in your Spotify dashboard.
const PORT = 43821;
const ROOT = path.join(__dirname, 'src');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

let mainWin = null;
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
    win.setAlwaysOnTop(true, 'floating');
    win.setMenu(null);
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
    const uri = `http://127.0.0.1:${PORT}/`;
    const r = await dialog.showMessageBox(mainWin, {
      type: 'warning', title: 'Spotify login setup',
      message: redirect ? 'Spotify doesn’t recognise Amplite’s redirect URI yet.' : 'Spotify rejected the Client ID.',
      detail: redirect
        ? `In developer.spotify.com/dashboard → your app → Settings → Edit, add this Redirect URI exactly, then click Save at the bottom:\n\n${uri}\n\nThen try logging in again.`
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

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
