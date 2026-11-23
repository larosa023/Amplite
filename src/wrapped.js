// Amplite Wrapped: your year as a full-screen story, from Amplite's history (plus imported Last.fm
// scrobbles). Every slide is described once as data and drawn both as HTML and, for sharing, on a
// canvas. Loaded only when opened.
let X = null, W = null; // W = { year, slides, i, t, paused, el }
const DUR = 7000;
const keyOf = s => (s || '').toLowerCase().replace(/^the\s+/, '').replace(/\s*[([].*?[)\]]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
const MS = r => r.ms || r.duration || 210000;
const artOf = r => (r.artists?.length ? r.artists[0] : r.artist) || '';
// Spotify covers / artist photos at their 640 px size.
const big = u => (u || '').replace(/(ab67616d0000)(4851|1e02)/, '$1b273').replace(/(ab6761610000)(f178|5174)/, '$1e5eb');
const STAR = /2a96cbd8b46e442fc41c2b86b821562f/; // Last.fm's blank "no picture" star
const good = u => (u && !STAR.test(u) ? u : '');
const isSp = u => /\.scdn\.co\//.test(u || '');
const biggest = arr => (arr || []).slice().sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || '';
const MONTHS = [...Array(12)].map((_, m) => new Date(2000, m, 1).toLocaleDateString([], { month: 'long' }));

export function yearsWithData(items) {
  const c = new Map(); items.forEach(r => { const y = new Date(r.ts * 1000).getFullYear(); c.set(y, (c.get(y) || 0) + 1); });
  return [...c].filter(([, n]) => n >= 50).map(([y]) => y).sort((a, b) => b - a);
}
function crunch(items, year) {
  const inY = items.filter(r => r.ts && new Date(r.ts * 1000).getFullYear() === year).sort((a, b) => a.ts - b.ts);
  const before = new Set(items.filter(r => new Date(r.ts * 1000).getFullYear() < year).map(r => keyOf(artOf(r))));
  const prevMs = items.filter(r => new Date(r.ts * 1000).getFullYear() === year - 1).reduce((t, r) => t + MS(r), 0);
  const art = new Map(), songs = new Map(), months = Array.from({ length: 12 }, () => ({ ms: 0, songs: new Map() })), hours = Array(24).fill(0);
  for (const r of inY) {
    const d = new Date(r.ts * 1000), ms = MS(r), a = artOf(r), ak = keyOf(a), sk = ak + '|' + keyOf(r.title), im = good(r.image);
    hours[d.getHours()] += ms;
    const A = art.get(ak) || art.set(ak, { k: 'a:' + ak, name: a, id: r.artistIds?.[0] || '', ms: 0, n: 0, first: r.ts, image: '', cover: '', isNew: !before.has(ak) }).get(ak);
    A.ms += ms; A.n++; if (!A.id && r.artistIds?.[0]) A.id = r.artistIds[0]; if (isSp(im) && !A.cover) A.cover = big(im);
    const S = songs.get(sk) || songs.set(sk, { k: 's:' + sk, title: r.title, artist: r.artists?.join(', ') || a, uri: r.uri || '', image: '', n: 0, ms: 0, months: Array(12).fill(0) }).get(sk);
    S.n++; S.ms += ms; S.months[d.getMonth()]++; if (!S.uri && r.uri) S.uri = r.uri;
    if (isSp(im)) { if (!S.image) S.image = big(im); } else if (im && !S.alt) S.alt = im; // Last.fm pictures only as a last resort
    const M = months[d.getMonth()]; M.ms += ms; M.songs.set(sk, (M.songs.get(sk) || 0) + 1);
  }
  const total = inY.reduce((t, r) => t + MS(r), 0);
  const topA = [...art.values()].sort((a, b) => b.ms - a.ms), topS = [...songs.values()].sort((a, b) => b.n - a.n || b.ms - a.ms);
  const mi = months.reduce((b, m, i) => m.ms > months[b].ms ? i : b, 0), mTop = [...months[mi].songs].sort((a, b) => b[1] - a[1])[0];
  return { year, plays: inY.length, total, prevMs, topA, topS, hours, monthsMs: months.map(m => m.ms), month: { i: mi, ms: months[mi].ms, song: mTop ? songs.get(mTop[0]) : null, n: mTop?.[1] || 0 },
    discovered: topA.filter(a => a.isNew && a.ms >= 10 * 60000), artists: art.size, songsN: songs.size, first: inY[0]?.ts };
}
// Your "listening personality": the trait that stands out most.
function personality(d) {
  const share = (from, to) => { let s = 0; for (let h = from; h < to; h++) s += d.hours[h % 24]; return d.total ? s / d.total : 0; };
  const night = share(22, 29), morning = share(5, 10), top = d.topA[0] ? d.topA[0].ms / d.total : 0, fresh = d.artists ? d.discovered.length / d.artists : 0;
  const replay = d.topS[0]?.n || 0;
  const traits = [
    { t: 'The Night Owl', k: night / 0.3, s: `${Math.round(night * 100)}% of your listening happened after 10 pm.`, i: '🌙' },
    { t: 'The Early Bird', k: morning / 0.28, s: `${Math.round(morning * 100)}% of your listening happened before 10 am.`, i: '☀️' },
    { t: 'The Loyalist', k: top / 0.18, s: `${d.topA[0]?.name} was ${Math.round(top * 100)}% of everything you played.`, i: '🫶' },
    { t: 'The Explorer', k: fresh / 0.25 * (d.discovered.length >= 15 ? 1 : 0.6), s: `${d.discovered.length} artists were new to you this year.`, i: '🧭' },
    { t: 'The Replayer', k: replay / 60, s: `You played “${d.topS[0]?.title}” ${replay} times.`, i: '🔁' },
  ].sort((a, b) => b.k - a.k);
  return traits[0].k >= 1 ? traits[0] : { t: 'The All-Rounder', s: `${d.artists.toLocaleString()} artists and ${d.songsN.toLocaleString()} different songs, a bit of everything.`, i: '🎧' };
}

/* ---------- pictures ----------
   Plays imported from Last.fm have no Spotify IDs and often only Last.fm's blank star, so every
   picture Wrapped shows is looked up on Spotify (artist photo, album cover), remembered for a month,
   and loaded before its slide comes up. Anything still missing shows a clean lettered tile. */
const PC = { m: null, t: 0 };
const pcache = () => (PC.m ??= X.store?.get('wrPics', {}) || {});
function pget(k) { const e = pcache()[k]; return e && Date.now() - e.at < 30 * 864e5 ? e : null; }
function pset(k, v) {
  const m = pcache(); m[k] = { ...v, at: Date.now() }; clearTimeout(PC.t);
  PC.t = setTimeout(() => { const ks = Object.keys(m); if (ks.length > 500) ks.sort((a, b) => m[a].at - m[b].at).slice(0, ks.length - 500).forEach(x => delete m[x]); X.store?.set('wrPics', m); }, 800);
}
async function artistPic(a) {
  const c = pget(a.k);
  if (c) { if (c.id && !a.id) a.id = c.id; a.image = c.u || a.image; if (c.u) return; }
  let u = '', id = a.id;
  try {
    if (id) u = biggest((await X.api(`/artists/${id}`, { bg: true })).images);
    else {
      const r = await X.api('/search', { bg: true, query: { q: a.name, type: 'artist', limit: 5 } });
      const hit = (r.artists?.items || []).find(x => keyOf(x.name) === keyOf(a.name.split(/,| feat\.? | & /i)[0]));
      if (hit) { id = hit.id; u = biggest(hit.images); }
    }
  } catch { return; } // busy or offline: try again next time
  if (id) a.id = id; if (u) a.image = u;
  pset(a.k, { u, id });
}
async function songPic(s) {
  if (isSp(s.image)) return;
  const c = pget(s.k);
  if (c) { if (c.uri && !s.uri) s.uri = c.uri; if (c.u) { s.image = c.u; return; } }
  const artist = s.artist.split(',')[0].trim();
  let u = '', uri = s.uri;
  try {
    if (uri.startsWith('spotify:track:')) u = biggest((await X.api(`/tracks/${uri.split(':')[2]}`, { bg: true })).album?.images);
    if (!u) { const t = await X.resolveRec(artist, s.title).catch(() => null); if (t?.uri) { uri = uri || t.uri; u = big(t.album?.image || ''); } }
    if (!u) { // looser search: any version of the song by that artist (even one that can't play in your country)
      const r = await X.api('/search', { bg: true, query: { q: `${s.title} ${artist}`, type: 'track', limit: 10 } });
      const items = r.tracks?.items || [], ak = keyOf(artist), tk = keyOf(s.title);
      const hit = items.find(t => keyOf(t.name) === tk && t.artists?.some(x => keyOf(x.name) === ak)) || items.find(t => t.artists?.some(x => keyOf(x.name) === ak) && (keyOf(t.name).includes(tk) || tk.includes(keyOf(t.name))));
      if (hit) { u = biggest(hit.album?.images); uri = uri || hit.uri; }
    }
  } catch { if (!s.image && s.alt) s.image = s.alt; return; }
  if (uri) s.uri = uri;
  if (u) { s.image = u; pset(s.k, { u, uri }); } else if (s.alt) s.image = s.alt;
}
const preload = u => u ? new Promise(r => { const i = new Image(); i.onload = i.onerror = () => r(); i.src = u; setTimeout(r, 8000); }) : null;
// Fetch pictures in the order the slides need them, a couple at a time.
async function fetchPics(d, w) {
  const want = [];
  const add = (o, f) => { if (o && !want.some(x => x.o === o)) want.push({ o, f }); };
  add(d.topA[0], artistPic); add(d.topS[0], songPic); add(d.month.song, songPic);
  d.topA.slice(1, 5).forEach(a => add(a, artistPic)); d.topS.slice(1, 5).forEach(s => add(s, songPic));
  d.discovered.slice(0, 5).forEach(a => add(a, artistPic)); d.topS.slice(5, 12).forEach(s => add(s, songPic));
  let i = 0;
  await Promise.all([0, 1].map(async () => {
    while (i < want.length && W === w) {
      const { o, f } = want[i++];
      await f(o).catch(() => {});
      if (f === artistPic && !o.image) o.image = o.cover || d.topS.find(x => x.artist.split(',')[0].trim() === o.name && isSp(x.image))?.image || ''; // no photo: their most-played cover
      await preload(o.image);
      paintPic(o);
    }
  }));
}
function letter(o) { const t = (o.name || o.title || '').replace(/^the\s+/i, '').trim(); return (t.match(/[\p{L}\p{N}]/u)?.[0] || '♪').toUpperCase(); }
function pic(o, cls = '') {
  const { esc } = X;
  return `<span class="wr-pic ${cls}" data-k="${esc(o.k)}" data-l="${esc(letter(o))}" style="--ph:${[...o.k].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)}">${o.image ? `<img src="${esc(o.image)}" alt="" decoding="async">` : ''}</span>`;
}
function paintPic(o) {
  if (!W || !o.image) return;
  W.el.querySelectorAll(`.wr-pic[data-k="${CSS.escape(o.k)}"]`).forEach(el => {
    let im = el.querySelector('img');
    if (!im) { im = document.createElement('img'); im.alt = ''; el.append(im); }
    if (im.getAttribute('src') !== o.image) { el.classList.remove('has'); im.src = o.image; }
  });
  if (W.slides[W.i]?.pic === o) setBg(o.image);
}
function setBg(u) {
  const [a, b] = W.el.querySelectorAll('.wr-bg'), on = a.classList.contains('on') ? a : b, off = on === a ? b : a;
  if (on.dataset.u === (u || '')) return;
  off.dataset.u = u || ''; off.style.backgroundImage = u ? `url("${u.replace(/"/g, '%22')}")` : 'none';
  off.classList.add('on'); on.classList.remove('on');
}

/* ---------- slides ---------- */
const hrs = ms => { const h = ms / 3600000; return h < 10 ? h.toFixed(1).replace(/\.0$/, '') : Math.round(h).toLocaleString(); };
function slides(d) {
  const p = personality(d), mins = Math.round(d.total / 60000), A = d.topA[0], S = d.topS[0];
  // Only compare with last year when there's real listening to compare with.
  const delta = d.prevMs >= 10 * 3600000 ? Math.round((d.total - d.prevMs) / d.prevMs * 100) : null;
  const out = [
    { id: 'intro', kicker: 'Amplite Wrapped', big: String(d.year), sub: 'Your year in music. Click or press → to go on.', hue: 250, mosaic: true },
    { id: 'minutes', kicker: 'You listened for', big: mins.toLocaleString(), unit: 'minutes', sub: `That’s ${hrs(d.total)} hours, or ${(d.total / 864e5).toFixed(1)} days of music${delta !== null ? `, ${Math.abs(delta)}% ${delta >= 0 ? 'more' : 'less'} than ${d.year - 1}` : ''}.`, count: mins, bars: true, hue: 200 },
  ];
  if (A) out.push({ id: 'artist', kicker: 'Your top artist', big: A.name, sub: `${hrs(A.ms)} hours over ${A.n.toLocaleString()} plays. You first played them this year on ${new Date(A.first * 1000).toLocaleDateString([], { month: 'long', day: 'numeric' })}.`, pic: A, round: true, hue: 330 });
  if (d.topA.length >= 3) out.push({ id: 'artists', kicker: 'Your top artists', list: d.topA.slice(0, 5).map(a => ({ o: a, a: a.name, b: `${hrs(a.ms)} hours · ${a.n.toLocaleString()} plays`, w: a.ms / d.topA[0].ms })), round: true, hue: 290 });
  if (S) { const pk = S.months.indexOf(Math.max(...S.months)); out.push({ id: 'song', kicker: 'Your song of the year', big: S.title, sub: `${S.artist} · played ${S.n} times, most of them in ${MONTHS[pk]}.`, pic: S, hue: 160 }); }
  if (d.topS.length >= 3) out.push({ id: 'songs', kicker: 'Your top songs', list: d.topS.slice(0, 5).map(s => ({ o: s, a: s.title, b: s.artist, n: `${s.n} plays`, w: s.n / d.topS[0].n })), hue: 185 });
  if (d.month.song) out.push({ id: 'month', kicker: 'Your obsession month', big: MONTHS[d.month.i], sub: `${hrs(d.month.ms)} hours of music, and you couldn’t stop playing “${d.month.song.title}” (${d.month.n} times).`, pic: d.month.song, hue: 30 });
  if (d.discovered.length) out.push({ id: 'new', kicker: 'New to you this year', big: String(d.discovered.length), unit: d.discovered.length === 1 ? 'artist' : 'artists', sub: d.discovered.length > 5 ? 'Your biggest new finds:' : '', faces: d.discovered.slice(0, 5), count: d.discovered.length, hue: 100 });
  out.push({ id: 'you', kicker: 'Your listening personality', big: p.t, emoji: p.i, sub: p.s, hue: 270 });
  out.push({ id: 'end', kicker: `Your ${d.year}`, summary: true, hue: 345 });
  return out;
}
function bars(d) {
  const now = new Date(), last = d.year === now.getFullYear() ? now.getMonth() : 11, max = Math.max(...d.monthsMs) || 1;
  return `<div class="wr-bars" aria-hidden="true">${d.monthsMs.slice(0, last + 1).map((ms, i) => `<div class="${i === d.month.i ? 'top' : ''}" style="--v:${Math.max(0.03, ms / max).toFixed(3)};--d:${(i * 0.04).toFixed(2)}s"><i></i><small>${MONTHS[i][0]}</small></div>`).join('')}</div>`;
}
function slideHTML(s, d) {
  const { esc } = X;
  const text = `<p class="wr-kicker">${esc(s.kicker)}</p>${s.emoji ? `<div class="wr-emoji">${s.emoji}</div>` : ''}${s.big ? `<h1 class="wr-big${s.big.length > 26 ? ' xlong' : s.big.length > 14 ? ' long' : ''}"${s.count ? ` data-count="${s.count}"` : ''}>${esc(s.count ? '0' : s.big)}</h1>` : ''}${s.unit ? `<p class="wr-unit">${esc(s.unit)}</p>` : ''}${s.sub ? `<p class="wr-sub">${esc(s.sub)}</p>` : ''}`;
  if (s.summary) {
    const p = personality(d), A = d.topA[0];
    return `<div class="wr-sum">
      <div class="wr-sum-head">${A ? pic(A, 'round') : ''}<div><small>Amplite Wrapped</small><h2>Your ${d.year}</h2><p>${p.i} ${esc(p.t)}</p></div></div>
      <div class="wr-sum-cols">
        <div><h4>Top artists</h4><ol>${d.topA.slice(0, 5).map((a, i) => `<li><span class="n">${i + 1}</span>${pic(a, 'round')}<b>${esc(a.name)}</b></li>`).join('')}</ol></div>
        <div><h4>Top songs</h4><ol>${d.topS.slice(0, 5).map((x, i) => `<li><span class="n">${i + 1}</span>${pic(x)}<b>${esc(x.title)}</b></li>`).join('')}</ol></div>
      </div>
      <div class="wr-sum-nums"><div><small>Minutes</small><b>${Math.round(d.total / 60000).toLocaleString()}</b></div><div><small>Songs</small><b>${d.songsN.toLocaleString()}</b></div><div><small>Artists</small><b>${d.artists.toLocaleString()}</b></div><div><small>New artists</small><b>${d.discovered.length.toLocaleString()}</b></div></div>
    </div>
    <div class="wr-acts"><button class="btn primary" data-wr="top50">Save my top 50 as a playlist</button><button class="btn" data-wr="again">Watch again</button></div>`;
  }
  if (s.list) return `<div class="wr-text"><p class="wr-kicker">${esc(s.kicker)}</p></div><ol class="wr-list">${s.list.map((x, i) => `<li style="--d:${(i * 0.09).toFixed(2)}s"><span class="wr-n">${i + 1}</span>${pic(x.o, s.round ? 'round' : '')}<div class="wr-li"><b>${esc(x.a)}</b><small>${esc(x.b)}${x.n ? ` · ${esc(x.n)}` : ''}</small><i class="wr-share" style="--w:${x.w.toFixed(3)}"></i></div></li>`).join('')}</ol>`;
  if (s.pic) return `<div class="wr-hero">${pic(s.pic, (s.round ? 'round ' : '') + 'xl')}</div><div class="wr-text">${text}</div>`;
  if (s.faces) return `<div class="wr-text">${text}</div><div class="wr-faces">${s.faces.map((a, i) => `<figure style="--d:${(0.35 + i * 0.08).toFixed(2)}s">${pic(a, 'round')}<figcaption>${esc(a.name)}</figcaption></figure>`).join('')}</div>`;
  if (s.mosaic) return `<div class="wr-text">${text}</div>`;
  return `<div class="wr-text">${text}${s.bars ? bars(d) : ''}</div>`;
}
function mosaic(d) {
  const tiles = d.topS.slice(0, 12); if (tiles.length < 4) return '';
  return `<div class="wr-mosaic" aria-hidden="true">${[...tiles, ...tiles].slice(0, 16).map((s, i) => pic(s, i % 3 ? '' : 'alt')).join('')}</div>`;
}
function go(i) {
  if (!W) return;
  W.i = Math.max(0, Math.min(W.slides.length - 1, i)); W.elapsed = 0;
  const s = W.slides[W.i], st = W.el.querySelector('.wr-stage');
  W.el.style.setProperty('--h', s.hue);
  W.el.dataset.slide = s.id;
  st.className = 'wr-stage' + (s.pic ? ' split' : '') + (s.list ? ' listing' : '') + (s.summary ? ' summary' : '');
  st.dataset.id = s.id;
  void st.offsetWidth;
  st.innerHTML = slideHTML(s, W.d); st.classList.add('in');
  W.el.querySelector('.wr-mosaic')?.classList.toggle('on', !!s.mosaic);
  markLoaded(st);
  W.el.querySelectorAll('.wr-prog i').forEach((b, j) => { b.classList.toggle('done', j < W.i); b.style.setProperty('--p', j < W.i ? 1 : 0); });
  setBg(s.pic?.image || (s.list ? s.list[0].o.image : '') || (s.summary ? W.d.topA[0]?.image : '') || '');
  const c = st.querySelector('[data-count]');
  if (c) { const to = +c.dataset.count, t0 = performance.now(); const step = t => { const k = Math.min(1, (t - t0) / 1400), e = 1 - (1 - k) ** 3; c.textContent = Math.round(to * e).toLocaleString(); if (k < 1 && W && W.slides[W.i] === s) requestAnimationFrame(step); }; requestAnimationFrame(step); }
  W.el.querySelector('[data-wr="prev"]').disabled = W.i === 0;
}
// Pictures that were already in the cache don't always fire "load" again.
function markLoaded(root) { root.querySelectorAll('.wr-pic img').forEach(im => { if (im.complete && im.naturalWidth) im.parentElement.classList.add('has'); }); }
function setPaused(p) {
  if (!W) return; W.paused = p;
  const b = W.el.querySelector('[data-wr="pause"]'); if (b) { b.innerHTML = X.svg(p ? 'play' : 'pause'); b.title = p ? 'Play (P)' : 'Pause (P)'; }
  W.el.classList.toggle('paused', p);
}
function tick(t) {
  if (!W) return;
  if (!W.paused && !W.held && W.i < W.slides.length - 1) {
    W.elapsed += Math.min(100, t - (W.last || t));
    const p = Math.min(1, W.elapsed / DUR), bar = W.el.querySelectorAll('.wr-prog i')[W.i];
    if (bar) bar.style.setProperty('--p', p);
    if (p >= 1) go(W.i + 1);
  }
  W.last = t; requestAnimationFrame(tick);
}
function close() {
  if (!W) return;
  document.removeEventListener('keydown', W.key, true);
  W.el.classList.remove('show'); const el = W.el; W = null; setTimeout(() => el.remove(), 250);
}
// The current slide as a 1080×1920 picture (story size) for sharing.
async function shareSlide(copy) {
  const s = W.slides[W.i], d = W.d, c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
  const g = c.getContext('2d'), F = (w, px) => `${w} ${px}px "Segoe UI", system-ui, sans-serif`;
  const grad = g.createLinearGradient(0, 0, 1080, 1920);
  grad.addColorStop(0, `hsl(${s.hue}, 62%, 30%)`); grad.addColorStop(1, `hsl(${(s.hue + 50) % 360}, 70%, 9%)`);
  g.fillStyle = grad; g.fillRect(0, 0, 1080, 1920);
  const load = async u => { if (!u) return null; const data = await window.amplite.imageData(u).catch(() => null); if (!data) return null; const im = new Image(); im.src = data; try { await im.decode(); return im; } catch { return null; } };
  const coverAt = (im, x, y, w, h, round) => { g.save(); g.beginPath(); round ? g.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2) : g.roundRect(x, y, w, h, Math.round(w / 14)); g.clip(); const k = Math.max(w / im.width, h / im.height); g.drawImage(im, x + (w - im.width * k) / 2, y + (h - im.height * k) / 2, im.width * k, im.height * k); g.restore(); };
  const tile = (o, x, y, w, round) => { g.save(); g.beginPath(); round ? g.arc(x + w / 2, y + w / 2, w / 2, 0, Math.PI * 2) : g.roundRect(x, y, w, w, Math.round(w / 14)); g.clip(); g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(x, y, w, w); g.fillStyle = 'rgba(255,255,255,.8)'; g.font = F(800, w * 0.42); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(letter(o), x + w / 2, y + w / 2 + 2); g.textBaseline = 'alphabetic'; g.restore(); };
  const draw = (o, im, x, y, w, round) => im ? coverAt(im, x, y, w, w, round) : tile(o, x, y, w, round);
  const fit = (t, maxW) => { if (g.measureText(t).width <= maxW) return t; while (t.length > 2 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1); return t + '…'; };
  const wrap = (text, x, y, maxW, lh, font, color = '#fff', maxLines = 3, align = 'center') => {
    g.font = font; g.fillStyle = color; g.textAlign = align; const words = String(text).split(/\s+/), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur);
    const out = lines.slice(0, maxLines); if (lines.length > maxLines) out[maxLines - 1] = fit(out[maxLines - 1] + '…', maxW);
    out.forEach((l, i) => g.fillText(l, x, y + i * lh)); return y + out.length * lh;
  };
  let y = 220;
  g.fillStyle = 'rgba(255,255,255,.7)'; g.font = F(800, 34); g.textAlign = 'center'; g.fillText(`AMPLITE WRAPPED ${d.year}`, 540, 130);
  if (s.summary) {
    const A = d.topA[0], aim = await load(A?.image);
    if (A) draw(A, aim, 390, 200, 300, true);
    wrap(`My ${d.year}`, 540, 620, 900, 100, F(900, 96));
    g.fillStyle = 'rgba(255,255,255,.8)'; g.font = F(700, 42); g.fillText(`${personality(d).i} ${personality(d).t}`, 540, 700);
    g.textAlign = 'left';
    const col = (title, arr, x) => { g.fillStyle = 'rgba(255,255,255,.65)'; g.font = F(800, 30); g.fillText(title.toUpperCase(), x, 840); arr.slice(0, 5).forEach((t, i) => { g.fillStyle = 'rgba(255,255,255,.55)'; g.font = F(800, 42); g.fillText(String(i + 1), x, 920 + i * 74); g.fillStyle = '#fff'; g.font = F(700, 42); g.fillText(fit(t, 380), x + 50, 920 + i * 74); }); };
    col('Top artists', d.topA.map(a => a.name), 90); col('Top songs', d.topS.map(x => x.title), 570);
    const nums = [['MINUTES', Math.round(d.total / 60000)], ['SONGS', d.songsN], ['ARTISTS', d.artists]];
    nums.forEach(([k, v], i) => { const x = 90 + i * 320; g.fillStyle = 'rgba(255,255,255,.65)'; g.font = F(800, 30); g.fillText(k, x, 1390); g.fillStyle = '#fff'; g.font = F(900, 76); g.fillText(v.toLocaleString(), x, 1480); });
  } else if (s.list) {
    wrap(s.kicker, 540, 300, 900, 90, F(900, 84));
    const ims = await Promise.all(s.list.map(x => load(x.o.image)));
    s.list.forEach((x, i) => {
      const yy = 450 + i * 250; g.textAlign = 'left';
      g.fillStyle = 'rgba(255,255,255,.55)'; g.font = F(900, 64); g.fillText(String(i + 1), 90, yy + 125);
      draw(x.o, ims[i], 170, yy, 200, s.round);
      g.fillStyle = '#fff'; g.font = F(800, 56); g.fillText(fit(x.a, 600), 410, yy + 95);
      g.fillStyle = 'rgba(255,255,255,.7)'; g.font = F(600, 40); g.fillText(fit(x.b, 600), 410, yy + 155);
    });
  } else {
    if (s.pic) { const im = await load(s.pic.image); draw(s.pic, im, 240, 230, 600, s.round); y = 960; } else y = 560;
    g.fillStyle = 'rgba(255,255,255,.8)'; g.font = F(700, 46); g.textAlign = 'center'; g.fillText(s.kicker, 540, y); y += 40;
    if (s.emoji) { g.font = F(400, 140); g.fillText(s.emoji, 540, y + 150); y += 190; }
    y = wrap(s.big, 540, y + 130, 960, 140, F(900, s.big.length > 14 ? 104 : 150), '#fff', 2);
    if (s.unit) { g.font = F(700, 56); g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(s.unit, 540, y + 10); y += 70; }
    if (s.faces) { const ims = await Promise.all(s.faces.map(a => load(a.image))), n = s.faces.length, w = 170, gap = 20, x0 = 540 - (n * w + (n - 1) * gap) / 2; s.faces.forEach((a, i) => { draw(a, ims[i], x0 + i * (w + gap), y + 40, w, true); g.fillStyle = 'rgba(255,255,255,.85)'; g.font = F(600, 30); g.textAlign = 'center'; g.fillText(fit(a.name, w + 10), x0 + i * (w + gap) + w / 2, y + 40 + w + 50); }); }
    else if (s.sub) wrap(s.sub, 540, y + 60, 880, 62, F(500, 46), 'rgba(255,255,255,.85)', 5);
  }
  g.fillStyle = 'rgba(255,255,255,.5)'; g.font = F(600, 32); g.textAlign = 'center'; g.fillText('made with Amplite', 540, 1850);
  const r = await window.amplite.shareImage({ dataUrl: c.toDataURL('image/png'), action: copy ? 'copy' : 'save', name: `Amplite Wrapped ${d.year} - ${s.id}` });
  if (r?.ok) X.toast(copy ? 'Copied. Paste it into Discord or a chat.' : 'Saved');
}
async function top50(btn) {
  btn.disabled = true; const t = btn.textContent; btn.textContent = 'Finding your songs…';
  try {
    const uris = [];
    for (const s of W.d.topS.slice(0, 60)) { if (uris.length >= 50) break; const u = s.uri || (await X.resolveRec(s.artist.split(',')[0], s.title).catch(() => null))?.uri; if (u && !uris.includes(u)) uris.push(u); }
    const name = `Amplite Wrapped ${W.d.year}`;
    const pl = await X.api('/me/playlists', { method: 'POST', body: { name, description: `Your 50 most-played songs of ${W.d.year}, from Amplite.`, public: false } });
    await X.api(`/playlists/${pl.id}/items`, { method: 'POST', body: { uris } });
    X.refreshPlaylists();
    X.toast(`Saved “${name}”`, { label: 'Open', run: () => { close(); X.navigate('playlist', pl.id); } });
    btn.textContent = 'Saved ✓';
  } catch (e) { btn.disabled = false; btn.textContent = t; if (!X.needsEditPermission(e)) X.toast(e.message); }
}
export async function openWrapped(ctx, year) {
  X = ctx;
  const items = await X.histItems();
  const years = yearsWithData(items);
  year = years.includes(year) ? year : years[0];
  if (!year) return X.toast('Play some more music first. Wrapped needs at least 50 plays in a year.');
  const d = crunch(items, year);
  const list = slides(d);
  const el = document.createElement('div'); el.className = 'wr'; el.tabIndex = -1;
  el.innerHTML = `<div class="wr-bg"></div><div class="wr-bg"></div><div class="wr-shade"></div>${mosaic(d)}
    <div class="wr-prog">${list.map(() => '<i></i>').join('')}</div>
    <header class="wr-top">${years.length > 1 ? `<select class="wr-year" aria-label="Year">${years.map(y => `<option${y === year ? ' selected' : ''}>${y}</option>`).join('')}</select>` : ''}
      <span class="flex1"></span><button class="icon-btn" data-wr="pause" title="Pause (P)">${X.svg('pause')}</button><button class="icon-btn" data-wr="copy" title="Copy this slide as a picture">${X.svg('share')}</button><button class="icon-btn" data-wr="save" title="Save this slide as a picture">${X.svg('listadd')}</button><button class="icon-btn" data-wr="close" title="Close (Esc)">${X.svg('x')}</button></header>
    <div class="wr-stage"></div>
    <button class="wr-nav prev" data-wr="prev" aria-label="Previous"></button><button class="wr-nav next" data-wr="next" aria-label="Next"></button>`;
  document.body.append(el);
  W = { d, slides: list, i: 0, el, paused: false, held: false, elapsed: 0, last: 0 };
  const w = W;
  fetchPics(d, w);
  // Pictures fade in once they've loaded; one that fails falls back to its lettered tile.
  el.addEventListener('load', e => { if (e.target.tagName === 'IMG') e.target.parentElement?.classList.add('has'); }, true);
  el.addEventListener('error', e => { if (e.target.tagName === 'IMG') { const p = e.target.parentElement; p?.classList.remove('has'); e.target.remove(); } }, true);
  W.key = e => {
    if (!W) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); go(W.i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); go(W.i - 1); }
    else if (e.key.toLowerCase() === 'p') { e.preventDefault(); e.stopPropagation(); setPaused(!W.paused); }
  };
  document.addEventListener('keydown', W.key, true);
  el.addEventListener('pointerdown', e => { if (!e.target.closest('button, select') && W) W.held = true; });
  el.addEventListener('pointerup', () => { if (W) W.held = false; });
  el.addEventListener('pointerleave', () => { if (W) W.held = false; });
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-wr]'); if (!b || !W) return;
    const a = b.dataset.wr;
    if (a === 'close') close(); else if (a === 'next') go(W.i + 1); else if (a === 'prev') go(W.i - 1);
    else if (a === 'again') go(0); else if (a === 'top50') top50(b); else if (a === 'pause') setPaused(!W.paused);
    else if (a === 'copy' || a === 'save') shareSlide(a === 'copy');
  });
  el.querySelector('.wr-year')?.addEventListener('change', e => { close(); setTimeout(() => openWrapped(X, +e.target.value), 260); });
  requestAnimationFrame(() => el.classList.add('show'));
  go(0); markLoaded(el); requestAnimationFrame(tick); el.focus();
}
