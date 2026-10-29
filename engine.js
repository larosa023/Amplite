// Amplite audio engine: a bundled librespot (open-source Spotify Connect player).
// Streams at 320 kbps (Spotify "Very high") and outputs 32-bit float audio.
// It shows up as the Spotify Connect device "Amplite", and the UI drives it through the Web API.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEVICE_NAME = 'Amplite';

class Engine {
  constructor(send) {
    this.send = send;          // (state) => void, forwards status to the UI
    this.proc = null;
    this.state = 'off';        // off | starting | auth | ready | error | missing
    this.detail = '';
    this.restarts = 0;
    this.quitting = false;
    this.volume = 60;
    this.bitrate = 320;      // 96 | 160 | 320 kbps
    this.normalise = false;
  }

  configure({ volume, bitrate, normalise } = {}) {
    if (Number.isFinite(volume)) this.volume = Math.max(0, Math.min(100, Math.round(volume)));
    const changed = (bitrate && bitrate !== this.bitrate) || (normalise !== undefined && !!normalise !== this.normalise);
    if ([96, 160, 320].includes(bitrate)) this.bitrate = bitrate;
    if (normalise !== undefined) this.normalise = !!normalise;
    return changed;
  }

  get bin() {
    const exe = process.platform === 'win32' ? 'librespot.exe' : 'librespot';
    const candidates = [
      path.join(process.resourcesPath || '', 'bin', exe),
      path.join(__dirname, 'bin', exe),
    ];
    return candidates.find(p => { try { return fs.statSync(p).isFile(); } catch { return false; } });
  }

  get cacheDir() { return path.join(app.getPath('userData'), 'engine'); }
  get hasLogin() { return fs.existsSync(path.join(this.cacheDir, 'credentials.json')); }

  set(state, detail = '') {
    this.state = state; this.detail = detail;
    this.send(this.status());
  }

  status() { return { state: this.state, detail: this.detail, name: DEVICE_NAME, bitrate: this.bitrate, normalise: this.normalise, hasLogin: this.hasLogin }; }

  start() {
    if (this.proc) return;
    const bin = this.bin;
    if (!bin) return this.set('missing', 'Engine not bundled with this build');
    fs.mkdirSync(this.cacheDir, { recursive: true });
    const args = [
      '--name', DEVICE_NAME,
      '--device-type', 'computer',
      '--bitrate', String(this.bitrate),
      '--format', 'F32',
      '--backend', 'rodio',
      '--cache', this.cacheDir,
      '--system-cache', this.cacheDir,
      '--cache-size-limit', '1G',
      '--initial-volume', String(this.volume),
      '--volume-ctrl', 'log',
      '--autoplay', 'on',
      '--enable-oauth',
      '--oauth-port', '5588',
    ];
    if (this.normalise) args.push('--enable-volume-normalisation');
    this.set('starting', this.hasLogin ? 'Connecting…' : 'Waiting for one-time approval');
    const p = spawn(bin, args, { windowsHide: true, env: { ...process.env, RUST_LOG: 'info' } });
    this.proc = p;
    const onLine = line => {
      if (!line.trim()) return;
      if (/Browse to:/i.test(line)) this.set('auth', 'Approve Amplite in your browser (one time only)');
      else if (/Authenticated as/i.test(line)) { this.restarts = 0; this.set('ready', `Ready · ${this.bitrate} kbps`); }
      else if (/Premium/i.test(line) && /required|not/i.test(line)) this.set('error', 'Spotify Premium is required for playback');
      else if (/Failed to get Spotify access token|Bad credentials|Login failed/i.test(line)) this.set('error', line.replace(/^.*?\]\s*/, '').slice(0, 160));
      if (process.env.AMPLITE_ENGINE_DEBUG) console.log('[engine]', line);
    };
    let buf = '';
    const feed = d => { buf += d.toString(); const lines = buf.split(/\r?\n/); buf = lines.pop(); lines.forEach(onLine); };
    p.stdout.on('data', feed);
    p.stderr.on('data', feed);
    p.on('error', e => { this.proc = null; this.set('error', e.message); });
    p.on('exit', code => {
      this.proc = null;
      if (this.quitting) return;
      // Bad cached login: clear it so the next start asks again.
      if (code && this.state === 'error' && /credentials/i.test(this.detail)) {
        try { fs.rmSync(path.join(this.cacheDir, 'credentials.json'), { force: true }); } catch {}
      }
      if (this.restarts < 5) {
        const wait = 1000 * 2 ** this.restarts++;
        this.set('starting', 'Restarting engine…');
        setTimeout(() => this.start(), wait);
      } else this.set('error', `Engine stopped (code ${code}). Use “Restart engine” in the menu.`);
    });
  }

  stop() {
    this.quitting = true;
    if (this.proc) { try { this.proc.kill(); } catch {} }
    this.proc = null;
  }

  restart({ forget = false } = {}) {
    this.stop();
    if (forget) { try { fs.rmSync(path.join(this.cacheDir, 'credentials.json'), { force: true }); } catch {} }
    this.quitting = false; this.restarts = 0;
    setTimeout(() => this.start(), 600);
  }
}

module.exports = { Engine, DEVICE_NAME };
