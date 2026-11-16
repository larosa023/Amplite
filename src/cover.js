// Playlist cover maker: a 2×2 / 3×3 grid of the playlist's album art, one album, or your own
// picture, with an optional title. Drawn on a canvas and uploaded to Spotify as a JPEG.
// Loaded only when you open it.
const SIZE = 640, MAX_B64 = 250000; // Spotify's limit is 256 KB of base64 JPEG

let C = null; // { ctx, pl, tracks, onDone }
const st = { mode: 'grid2', albums: [], picks: [], title: false, titlePos: 'bottom', tint: false, upload: null, imgs: new Map(), drawSeq: 0, busy: false };

const big = u => (u || '').replace(/(ab67616d0000)(4851|1e02)/, '$1b273');
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const need = () => st.mode === 'grid3' ? 9 : st.mode === 'grid2' ? 4 : 1;

// The playlist's albums, most-used first (a cover made of the albums it's really about).
function rankAlbums(tracks) {
  const m = new Map();
  for (const t of tracks) {
    const a = t.album; if (!a?.image) continue;
    const k = a.id || a.image, e = m.get(k) || { id: a.id, name: a.name, image: big(a.image), n: 0, first: m.size };
    e.n++; m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.first - b.first);
}
function fillPicks(fresh = false) {
  const n = need(), pool = st.albums.length;
  if (!pool) { st.picks = []; return; }
  if (fresh) st.picks = shuffle([...Array(Math.min(pool, Math.max(n * 2, 12))).keys()]).slice(0, n);
  else { st.picks = st.picks.filter(i => i < pool).slice(0, n); for (let i = 0; st.picks.length < n && i < pool; i++) if (!st.picks.includes(i)) st.picks.push(i); }
  while (st.picks.length < n) st.picks.push(st.picks[st.picks.length % Math.max(1, st.picks.length)] ?? 0); // tiny playlists: repeat
}
async function loadImg(url) {
  if (!url) return null;
  if (st.imgs.has(url)) return st.imgs.get(url);
  const p = (async () => {
    const data = url.startsWith('data:') ? url : await window.amplite.imageData(url).catch(() => null);
    if (!data) return null;
    const im = new Image(); im.src = data;
    try { await im.decode(); return im; } catch { return null; }
  })();
  st.imgs.set(url, p); return p;
}
function cover(g, im, x, y, w, h) {
  if (!im) { g.fillStyle = '#2a2d36'; g.fillRect(x, y, w, h); return; }
  const s = Math.max(w / im.width, h / im.height), sw = w / s, sh = h / s;
  g.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, x, y, w, h);
}
function wrap(g, text, maxW) {
  const words = text.split(/\s+/), lines = [];
  let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}
async function draw() {
  const seq = ++st.drawSeq, cv = document.getElementById('cvCanvas'); if (!cv) return;
  const g = cv.getContext('2d');
  let imgs;
  if (st.mode === 'upload') imgs = [await loadImg(st.upload)];
  else imgs = await Promise.all(st.picks.map(i => loadImg(st.albums[i]?.image)));
  if (seq !== st.drawSeq) return;
  g.clearRect(0, 0, SIZE, SIZE);
  if (st.mode === 'grid2' || st.mode === 'grid3') {
    const n = st.mode === 'grid3' ? 3 : 2, c = SIZE / n;
    imgs.forEach((im, i) => cover(g, im, (i % n) * c, Math.floor(i / n) * c, Math.ceil(c), Math.ceil(c)));
  } else cover(g, imgs[0], 0, 0, SIZE, SIZE);
  if (st.mode === 'upload' && !st.upload) {
    g.fillStyle = '#9aa0ad'; g.font = '600 26px Inter, "Segoe UI", system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText('Choose a picture', SIZE / 2, SIZE / 2);
  }
  if (st.tint) {
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#1db954';
    g.save(); g.globalCompositeOperation = 'color'; g.globalAlpha = .55; g.fillStyle = accent; g.fillRect(0, 0, SIZE, SIZE); g.restore();
  }
  const name = (document.getElementById('cvText')?.value ?? C.pl.name).trim();
  if (st.title && name) {
    const center = st.titlePos === 'center';
    const grad = center ? null : g.createLinearGradient(0, SIZE * .45, 0, SIZE);
    if (grad) { grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,.78)'); g.fillStyle = grad; g.fillRect(0, SIZE * .45, SIZE, SIZE * .55); }
    else { g.fillStyle = 'rgba(0,0,0,.38)'; g.fillRect(0, 0, SIZE, SIZE); }
    let fs = 92; g.font = `800 ${fs}px Inter, "Segoe UI", system-ui, sans-serif`;
    let lines = wrap(g, name, SIZE - 80);
    while ((lines.length > 2 || lines.some(l => g.measureText(l).width > SIZE - 80)) && fs > 40) { fs -= 6; g.font = `800 ${fs}px Inter, "Segoe UI", system-ui, sans-serif`; lines = wrap(g, name, SIZE - 80); }
    g.fillStyle = '#fff'; g.textAlign = center ? 'center' : 'left'; g.textBaseline = 'alphabetic';
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 18;
    const lh = fs * 1.05, total = lh * lines.length;
    const y0 = center ? (SIZE - total) / 2 + fs * .85 : SIZE - 44 - total + fs * .85;
    lines.forEach((l, i) => g.fillText(l, center ? SIZE / 2 : 40, y0 + i * lh));
    g.shadowBlur = 0;
  }
}
function jpeg() {
  const cv = document.getElementById('cvCanvas');
  for (let q = .92; q >= .4; q -= .08) { const u = cv.toDataURL('image/jpeg', q), b = u.slice(u.indexOf(',') + 1); if (b.length <= MAX_B64) return b; }
  return null;
}
function render() {
  const el = document.getElementById('coverDlg'), x = C.ctx;
  const few = st.albums.length;
  el.querySelectorAll('[data-cv-mode]').forEach(b => b.classList.toggle('on', b.dataset.cvMode === st.mode));
  el.querySelector('#cvShuffle').hidden = st.mode === 'upload' || few < 2;
  el.querySelector('#cvPick').hidden = st.mode !== 'upload';
  el.querySelector('#cvTitle').checked = st.title;
  el.querySelector('#cvText').disabled = !st.title;
  el.querySelectorAll('[data-cv-pos]').forEach(b => { b.classList.toggle('on', b.dataset.cvPos === st.titlePos); b.disabled = !st.title; });
  el.querySelector('#cvTint').checked = st.tint;
  el.querySelector('#cvHint').textContent = st.mode === 'upload' ? 'JPEG, PNG or WebP. It’s cropped to a square from the middle.'
    : few ? `Click a square in the preview to swap that album.${few < need() ? ' This playlist doesn’t have enough different albums, so some repeat.' : ''}` : 'This playlist has no album art to use. Upload a picture instead.';
  draw();
}
export function openCover(ctx, pl, tracks, onDone) {
  C = { ctx, pl, tracks, onDone };
  st.albums = rankAlbums(tracks); st.upload = null; st.busy = false;
  st.mode = st.albums.length >= 4 ? 'grid2' : st.albums.length ? 'single' : 'upload';
  st.title = false; st.titlePos = 'bottom'; st.tint = false; st.picks = [];
  fillPicks();
  let el = document.getElementById('coverDlg');
  if (!el) {
    el = document.createElement('div'); el.id = 'coverDlg'; el.className = 'modal hidden'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    document.body.append(el);
  }
  const { svg, esc } = ctx;
  el.innerHTML = `<div class="modal-card cv-card">
    <header class="modal-head"><h2>Playlist cover</h2><button type="button" class="round-btn" data-cv-close title="Close (Esc)">${svg('x')}</button></header>
    <div class="cv-body">
      <div class="cv-prev"><canvas id="cvCanvas" width="${SIZE}" height="${SIZE}"></canvas></div>
      <div class="cv-side">
        <div class="cv-sec"><h4>Style</h4><div class="seg cv-seg">
          <button data-cv-mode="grid2">2 × 2</button><button data-cv-mode="grid3">3 × 3</button><button data-cv-mode="single">One album</button><button data-cv-mode="upload">Your picture</button></div>
          <div class="cv-row"><button class="btn ctl" id="cvShuffle">${svg('shuffle')} Shuffle albums</button><button class="btn ctl" id="cvPick">Choose a picture…</button></div>
          <p class="cv-hint" id="cvHint"></p>
          <input type="file" id="cvFile" accept="image/jpeg,image/png,image/webp,image/gif" hidden></div>
        <div class="cv-sec"><h4>Title</h4>
          <label class="cv-check"><input type="checkbox" id="cvTitle"> Write the name on the cover</label>
          <input id="cvText" class="cv-text" maxlength="60" value="${esc(pl.name)}" spellcheck="false">
          <div class="seg cv-seg"><button data-cv-pos="bottom">Bottom</button><button data-cv-pos="center">Middle</button></div></div>
        <div class="cv-sec"><h4>Color</h4><label class="cv-check"><input type="checkbox" id="cvTint"> Tint it with my accent color</label></div>
        <p class="login-err hidden" id="cvErr"></p>
        <div class="cv-actions"><button class="btn ctl" id="cvSaveImg" title="Save the picture to your PC">Save…</button><span class="flex1"></span>
          <button class="btn" data-cv-close>Cancel</button><button class="btn primary" id="cvApply">Use as cover</button></div>
      </div>
    </div></div>`;
  el.classList.remove('hidden');
  const close = () => { el.classList.add('hidden'); document.removeEventListener('keydown', onKey, true); };
  const onKey = e => { if (e.key === 'Escape' && !el.classList.contains('hidden')) { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  el.onclick = async e => {
    if (e.target === el || e.target.closest('[data-cv-close]')) return close();
    const m = e.target.closest('[data-cv-mode]'); if (m) { st.mode = m.dataset.cvMode; fillPicks(); if (st.mode === 'upload' && !st.upload) el.querySelector('#cvFile').click(); return render(); }
    const p = e.target.closest('[data-cv-pos]'); if (p) { st.titlePos = p.dataset.cvPos; return render(); }
    if (e.target.closest('#cvShuffle')) { fillPicks(true); return render(); }
    if (e.target.closest('#cvPick')) return el.querySelector('#cvFile').click();
    if (e.target.closest('#cvSaveImg')) {
      const r = await window.amplite.shareImage({ dataUrl: el.querySelector('#cvCanvas').toDataURL('image/png'), action: 'save', name: `${pl.name} cover` });
      if (r?.ok) ctx.toast('Saved'); return;
    }
    if (e.target.closest('#cvApply')) return apply(el, close);
    const cv = e.target.closest('#cvCanvas');
    if (cv && (st.mode === 'grid2' || st.mode === 'grid3' || st.mode === 'single') && st.albums.length > 1) {
      // Swap the clicked square for the next album that isn't on the cover yet.
      const r = cv.getBoundingClientRect(), n = st.mode === 'grid3' ? 3 : st.mode === 'grid2' ? 2 : 1;
      const slot = Math.min(n - 1, Math.floor((e.clientY - r.top) / r.height * n)) * n + Math.min(n - 1, Math.floor((e.clientX - r.left) / r.width * n));
      let nx = st.picks[slot];
      for (let k = 0; k < st.albums.length; k++) { nx = (nx + 1) % st.albums.length; if (!st.picks.includes(nx) || st.albums.length <= need()) break; }
      st.picks[slot] = nx; draw();
    }
  };
  el.querySelector('#cvTitle').onchange = e => { st.title = e.target.checked; render(); };
  el.querySelector('#cvTint').onchange = e => { st.tint = e.target.checked; render(); };
  el.querySelector('#cvText').oninput = () => draw();
  el.querySelector('#cvFile').onchange = e => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    if (f.size > 25e6) return ctx.toast('That picture is too big (25 MB max).');
    const rd = new FileReader();
    rd.onload = () => { st.upload = rd.result; st.mode = 'upload'; render(); };
    rd.readAsDataURL(f);
  };
  render();
}
async function apply(el, close) {
  if (st.busy) return;
  if (st.mode === 'upload' && !st.upload) return el.querySelector('#cvFile').click();
  const err = el.querySelector('#cvErr'), btn = el.querySelector('#cvApply');
  err.classList.add('hidden');
  await draw();
  const b64 = jpeg();
  if (!b64) { err.textContent = 'Couldn’t make the picture small enough for Spotify.'; err.classList.remove('hidden'); return; }
  st.busy = true; btn.disabled = true; btn.textContent = 'Uploading…';
  try {
    await C.ctx.api(`/playlists/${C.pl.id}/images`, { method: 'PUT', raw: { type: 'image/jpeg', data: b64 } });
    close();
    C.onDone?.('data:image/jpeg;base64,' + b64);
  } catch (e) {
    if (C.ctx.needsScope(e, 'ugc-image-upload', 'change playlist covers')) { close(); return; }
    err.textContent = e.status === 403 ? 'Spotify only lets the playlist’s owner change its cover.' : `Couldn’t upload: ${e.message}`;
    err.classList.remove('hidden');
  } finally { st.busy = false; btn.disabled = false; btn.textContent = 'Use as cover'; }
}
