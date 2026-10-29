// Amplite audio engine: a bundled librespot (open-source Spotify Connect player).
// Streams at 320 kbps (Spotify "Very high") and outputs 32-bit float audio.
// It shows up as the Spotify Connect device "Amplite", and the UI drives it through the Web API.
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');

// One name per computer, so two PCs on the same Spotify account never get mixed up.
const host = (os.hostname() || 'PC').replace(/\.local$/i, '').slice(0, 24);
const DEVICE_NAME = `Amplite (${host})`;
const redact = l => l.replace(/(code|state|code_challenge|access_token|token)=[^&\s]+/gi, '$1=…');

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
    this.user = null;          // Spotify username the engine signed in as
    this.logs = [];            // last 300 log lines, for diagnostics
    this.format = null;        // file format actually being streamed, e.g. OGG_VORBIS_320
    this.junk = 0;             // undecodable-audio warnings for the current track
    this.keyFails = 0;         // tracks Spotify refused to give a decryption key for
    this.keyRefused = false;   // true once Spotify has clearly refused keys to this account
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
  get eqFile() { return path.join(app.getPath('userData'), 'engine', 'eq.txt'); }
  // Writes the EQ settings the patched engine re-reads live (see patches/librespot-amplite.patch).
  setEq({ enabled = false, preamp = 0, gains = [] } = {}) {
    const g = Array.from({ length: 10 }, (_, i) => Number(gains[i]) || 0);
    try { fs.mkdirSync(path.dirname(this.eqFile), { recursive: true }); fs.writeFileSync(this.eqFile, `${enabled ? 1 : 0} ${Number(preamp) || 0} ${g.join(' ')}\n`); } catch (e) { this.log('eq write failed: ' + e.message); }
  }
  get hasLogin() { return fs.existsSync(path.join(this.cacheDir, 'credentials.json')); }

  set(state, detail = '') {
    this.state = state; this.detail = detail;
    this.send(this.status());
  }

  status() { return { state: this.state, detail: this.detail, name: DEVICE_NAME, bitrate: this.bitrate, normalise: this.normalise, hasLogin: this.hasLogin, user: this.user, running: !!this.proc, keyRefused: this.keyRefused, keyFails: this.keyFails, format: this.format, streamKbps: this.format ? +(this.format.match(/(\d+)$/) || [])[1] || null : null }; }

  // Collapses repeats (e.g. thousands of decoder warnings) so the diagnostics stay readable.
  log(line) {
    const msg = redact(line).slice(0, 400), key = msg.replace(/^\[[^\]]*\]\s*/, '').replace(/\d+/g, '#');
    const last = this.logs[this.logs.length - 1];
    if (last && this.lastKey === key) { this.repeat = (this.repeat || 1) + 1; this.logs[this.logs.length - 1] = msg + `  (×${this.repeat})`; return; }
    this.lastKey = key; this.repeat = 1;
    this.logs.push(msg); if (this.logs.length > 300) this.logs.splice(0, this.logs.length - 300);
  }

  // `wanted` is the single source of truth for "should the engine be running".
  // start() turns it on; stop() turns it off and cancels any pending auto-restart.
  start() {
    this.wanted = true; this.quitting = false;
    clearTimeout(this.restartTimer);
    if (this.proc || this.cleaning) return; // cleaning: start() runs again when it's done
    const bin = this.bin;
    if (!bin) return this.set('missing', 'Engine not bundled with this build');
    // An engine left over from a crash or an update (Windows doesn't end child processes with
    // their parent) would hold the login port and the device name. Clear it out once per launch.
    if (process.platform === 'win32' && !this.cleaned) {
      this.cleaned = this.cleaning = true;
      this.set('starting', 'Connecting…');
      execFile('taskkill', ['/F', '/T', '/IM', path.basename(bin)], { windowsHide: true }, () => {
        setTimeout(() => { this.cleaning = false; if (this.wanted && !this.proc) this.start(); }, 300);
      });
      return;
    }
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
    this.keyFails = 0; this.keyRefused = false; this.format = null; this.junk = 0;
    this.set('starting', this.hasLogin ? 'Connecting…' : 'Waiting for one-time approval');
    const p = spawn(bin, args, { windowsHide: true, env: { ...process.env, RUST_LOG: 'info', AMPLITE_EQ_FILE: this.eqFile } });
    this.proc = p;
    this.log(`--- start ${new Date().toISOString()} · ${path.basename(bin)} ${args.filter(a => !a.includes(path.sep)).join(' ')}`);
    const onLine = line => {
      if (!line.trim() || this.proc !== p) return; // ignore output from an engine we've already replaced
      this.log(line);
      const who = line.match(/Authenticated as '([^']+)'/i);
      if (/Browse to:/i.test(line)) this.set('auth', 'Approve Amplite in your browser (one time only)');
      else if (who) { this.user = who[1]; this.restarts = 0; this.set('ready', `Ready · ${this.bitrate} kbps`); }
      else if (/Amplite format: (\w+)/.test(line)) {
        this.format = line.match(/Amplite format: (\w+)/)[1]; this.junk = 0;
        this.send(this.status());
      }
      else if (/symphonia_bundle_mp3.*(skipping junk|invalid mpeg)/i.test(line)) {
        if (++this.junk === 40) { this.log('!!! Amplite: this track came as an MP3 the engine could not decode (it will be skipped).'); this.keyFail(); }
      }
      else if (/error audio key|Unable to load key|audio key (response )?(error|timeout)|refused the audio key/i.test(line)) this.keyFail();
      else if (/PremiumAccountRequired|premium account required|requires? (a )?premium/i.test(line)) this.set('error', 'This Spotify account isn’t Premium. Spotify only allows playback in apps like Amplite on Premium accounts.');
      else if (/Failed to get Spotify access token|Bad credentials|Login failed/i.test(line)) this.set('error', line.replace(/^.*?\]\s*/, '').slice(0, 160));
      if (process.env.AMPLITE_ENGINE_DEBUG) console.log('[engine]', line);
    };
    let buf = '';
    const feed = d => { buf += d.toString(); const lines = buf.split(/\r?\n/); buf = lines.pop(); lines.forEach(onLine); };
    p.stdout.on('data', feed);
    p.stderr.on('data', feed);
    p.on('error', e => { if (this.proc !== p) return; this.proc = null; this.log('spawn error: ' + e.message); this.set('error', e.message); });
    p.on('exit', code => {
      this.log(`--- exit code ${code}`);
      if (this.proc !== p) return; // an old engine finishing after a restart: ignore it
      this.proc = null;
      if (this.quitting || !this.wanted) return;
      // Bad cached login: clear it so the next start asks again.
      if (code && this.state === 'error' && /credentials/i.test(this.detail)) {
        try { fs.rmSync(path.join(this.cacheDir, 'credentials.json'), { force: true }); } catch {}
      }
      if (this.restarts < 5) {
        const wait = 1000 * 2 ** this.restarts++;
        this.set('starting', 'Restarting engine…');
        this.restartTimer = setTimeout(() => { if (this.wanted && !this.proc) this.start(); }, wait);
      } else this.set('error', `Engine stopped (code ${code}). Use Restart in Settings → Audio.`);
    });
  }

  // Resolves once the process has really exited (Windows can take a moment).
  // Spotify sometimes refuses decryption keys to librespot for certain Premium accounts
  // (librespot #1649 / #1735). After two refused tracks we tell the UI to switch to the Spotify app.
  keyFail() {
    this.keyFails++;
    if (this.keyFails >= 2 && !this.keyRefused) { this.keyRefused = true; this.log('!!! Amplite: Spotify is refusing audio keys for this account; switching to the Spotify app.'); }
    this.send(this.status());
  }

  stop() {
    this.quitting = true; this.wanted = false;
    clearTimeout(this.restartTimer);
    const p = this.proc; this.proc = null;
    if (!p) return Promise.resolve();
    return new Promise(res => {
      const t = setTimeout(() => { try { p.kill('SIGKILL'); } catch {} res(); }, 3000);
      p.once('exit', () => { clearTimeout(t); res(); });
      try { p.kill(); } catch { clearTimeout(t); res(); }
    });
  }

  async restart({ forget = false } = {}) {
    if (this.restarting) return; this.restarting = true;
    await this.stop();
    if (forget) { this.user = null; try { fs.rmSync(path.join(this.cacheDir, 'credentials.json'), { force: true }); } catch {} }
    this.restarts = 0; this.restarting = false;
    this.start();
  }
}

module.exports = { Engine, DEVICE_NAME };
