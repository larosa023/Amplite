// Amplite Wrapped: your year as a full-screen story, from Amplite's history (plus imported Last.fm
// scrobbles). Every slide is described once as data and drawn both as HTML and, for sharing, on a
// canvas. Loaded only when opened.
let X = null, W = null; // W = { year, slides, i, t, paused, el }
const DUR = 7000;
const keyOf = s => (s || '').toLowerCase().replace(/^the\s+/, '').replace(/\s*[([].*?[)\]]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
const MS = r => r.ms || r.duration || 210000;
const artOf = r => (r.artists?.length ? r.artists[0] : r.artist) || '';
const big = u => (u || '').replace(/(ab67616d0000)(4851|1e02)/, '$1b273');
const MONTHS = [...Array(12)].map((_, m) => new Date(2000, m, 1).toLocaleDateString([], { month: 'long' }));

export function yearsWithData(items) {
  const c = new Map(); items.forEach(r => { const y = new Date(r.ts * 1000).getFullYear(); c.set(y, (c.get(y) || 0) + 1); });
  return [...c].filter(([, n]) => n >= 50).map(([y]) => y).sort((a, b) => b - a);
}
function crunch(items, year) {
  const inY = items.filter(r => r.ts && new Date(r.ts * 1000).getFullYear() === year).sort((a, b) => a.ts - b.ts);
  const before = new Set(items.filter(r => new Date(r.ts * 1000).getFullYear() < year).map(r => keyOf(artOf(r))));
  const prevMs = items.filter(r => new Date(r.ts * 1000).getFullYear() === year - 1).reduce((t, r) => t + MS(r), 0);
  const art = new Map(), songs = new Map(), months = Array.from({ length: 12 }, () => ({ ms: 0, songs: new Map() })), hours = Array(24).fill(0), newA = new Map();
  for (const r of inY) {
    const d = new Date(r.ts * 1000), ms = MS(r), a = artOf(r), ak = keyOf(a), sk = ak + '|' + keyOf(r.title);
    hours[d.getHours()] += ms;
    const A = art.get(ak) || art.set(ak, { name: a, id: r.artistIds?.[0] || '', ms: 0, n: 0, first: r.ts, image: '', cover: r.image || '' }).get(ak);
    A.ms += ms; A.n++; if (!A.id && r.artistIds?.[0]) A.id = r.artistIds[0]; if (!A.cover && r.image) A.cover = r.image;
    const S = songs.get(sk) || songs.set(sk, { title: r.title, artist: r.artists?.join(', ') || a, uri: r.uri || '', image: r.image || '', n: 0, ms: 0, months: Array(12).fill(0) }).get(sk);
    S.n++; S.ms += ms; S.months[d.getMonth()]++; if (!S.uri && r.uri) S.uri = r.uri; if (!S.image && r.image) S.image = r.image;
    const M = months[d.getMonth()]; M.ms += ms; M.songs.set(sk, (M.songs.get(sk) || 0) + 1);
    if (ak && !before.has(ak)) { const e = newA.get(ak) || newA.set(ak, { name: a, ms: 0 }).get(ak); e.ms += ms; }
  }
  const total = inY.reduce((t, r) => t + MS(r), 0);
  const topA = [...art.values()].sort((a, b) => b.ms - a.ms), topS = [...songs.values()].sort((a, b) => b.n - a.n || b.ms - a.ms);
  const mi = months.reduce((b, m, i) => m.ms > months[b].ms ? i : b, 0), mTop = [...months[mi].songs].sort((a, b) => b[1] - a[1])[0];
  return { year, plays: inY.length, total, prevMs, topA, topS, hours, month: { i: mi, ms: months[mi].ms, song: mTop ? songs.get(mTop[0]) : null, n: mTop?.[1] || 0 },
    discovered: [...newA.values()].filter(a => a.ms >= 10 * 60000).sort((a, b) => b.ms - a.ms), artists: art.size, songsN: songs.size, first: inY[0]?.ts };
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
const hrs = ms => Math.round(ms / 3600000).toLocaleString();
function slides(d) {
  const p = personality(d), mins = Math.round(d.total / 60000), A = d.topA[0], S = d.topS[0];
  const delta = d.prevMs ? Math.round((d.total - d.prevMs) / d.prevMs * 100) : null;
  const out = [
    { id: 'intro', kicker: 'Amplite Wrapped', big: String(d.year), sub: 'Your year in music. Tap or press → to go on.', hue: 0 },
    { id: 'minutes', kicker: 'You listened for', big: mins.toLocaleString(), unit: 'minutes', sub: `That’s ${hrs(d.total)} hours, or ${(d.total / 864e5).toFixed(1)} days of music${delta !== null ? `, ${Math.abs(delta)}% ${delta >= 0 ? 'more' : 'less'} than ${d.year - 1}` : ''}.`, count: mins, hue: 40 },
  ];
  if (A) out.push({ id: 'artist', kicker: 'Your top artist', big: A.name, sub: `${hrs(A.ms)} hours · ${A.n.toLocaleString()} plays. You first played them this year on ${new Date(A.first * 1000).toLocaleDateString([], { month: 'long', day: 'numeric' })}.`, image: A.image || big(A.cover), round: !!A.image, hue: 80 });
  if (d.topA.length >= 3) out.push({ id: 'artists', kicker: 'Your top artists', list: d.topA.slice(0, 5).map(a => ({ a: a.name, b: `${hrs(a.ms)} h`, image: a.image || a.cover, round: !!a.image })), hue: 120 });
  if (S) out.push({ id: 'song', kicker: 'Your song of the year', big: S.title, sub: `by ${S.artist} · ${S.n} plays${S.months.indexOf(Math.max(...S.months)) >= 0 ? `, most of them in ${MONTHS[S.months.indexOf(Math.max(...S.months))]}` : ''}.`, image: big(S.image), hue: 160 });
  if (d.topS.length >= 3) out.push({ id: 'songs', kicker: 'Your top songs', list: d.topS.slice(0, 5).map(s => ({ a: s.title, b: s.artist, image: s.image })), hue: 200 });
  if (d.month.song) out.push({ id: 'month', kicker: 'Your obsession month', big: MONTHS[d.month.i], sub: `${hrs(d.month.ms)} hours of music, and you couldn’t stop playing “${d.month.song.title}” (${d.month.n} times).`, image: big(d.month.song.image), hue: 240 });
  if (d.discovered.length) out.push({ id: 'new', kicker: 'New to you this year', big: String(d.discovered.length), unit: d.discovered.length === 1 ? 'artist' : 'artists', sub: `Including ${d.discovered.slice(0, 4).map(a => a.name).join(', ')}.`, count: d.discovered.length, hue: 280 });
  out.push({ id: 'you', kicker: 'Your listening personality', big: p.t, emoji: p.i, sub: p.s, hue: 320 });
  out.push({ id: 'end', kicker: `Your ${d.year}`, summary: true, sub: 'Thanks for listening.', hue: 350 });
  return out;
}
function slideHTML(s, d) {
  const { esc } = X;
  const img = s.image ? `<div class="wr-img${s.round ? ' round' : ''}"><img src="${esc(s.image)}" alt=""></div>` : '';
  if (s.summary) return `<div class="wr-sum">
      <div class="wr-sum-col"><h4>Top artists</h4><ol>${d.topA.slice(0, 5).map(a => `<li>${esc(a.name)}</li>`).join('')}</ol></div>
      <div class="wr-sum-col"><h4>Top songs</h4><ol>${d.topS.slice(0, 5).map(x => `<li>${esc(x.title)}</li>`).join('')}</ol></div>
      <div class="wr-sum-nums"><div><small>Minutes</small><b>${Math.round(d.total / 60000).toLocaleString()}</b></div><div><small>Personality</small><b>${esc(personality(d).t.replace('The ', ''))}</b></div></div>
    </div><p class="wr-sub">${esc(s.sub)}</p>
    <div class="wr-acts"><button class="btn primary" data-wr="top50">Save my top 50 as a playlist</button><button class="btn" data-wr="again">Watch again</button></div>`;
  if (s.list) return `<p class="wr-kicker">${esc(s.kicker)}</p><ol class="wr-list">${s.list.map((x, i) => `<li style="--d:${i * 0.12}s"><span class="wr-n">${i + 1}</span>${x.image ? `<img class="${x.round ? 'round' : ''}" src="${esc(x.image)}" alt="">` : '<i></i>'}<div><b>${esc(x.a)}</b><small>${esc(x.b)}</small></div></li>`).join('')}</ol>`;
  return `${img}<p class="wr-kicker">${esc(s.kicker)}</p>${s.emoji ? `<div class="wr-emoji">${s.emoji}</div>` : ''}<h1 class="wr-big${s.big.length > 18 ? ' long' : ''}" ${s.count ? `data-count="${s.count}"` : ''}>${esc(s.count ? '0' : s.big)}</h1>${s.unit ? `<p class="wr-unit">${esc(s.unit)}</p>` : ''}<p class="wr-sub">${esc(s.sub)}</p>`;
}
function go(i) {
  if (!W) return;
  W.i = Math.max(0, Math.min(W.slides.length - 1, i)); W.t0 = performance.now(); W.elapsed = 0;
  const s = W.slides[W.i], st = W.el.querySelector('.wr-stage');
  W.el.style.setProperty('--h', s.hue);
  st.classList.remove('in'); void st.offsetWidth;
  st.innerHTML = slideHTML(s, W.d); st.classList.add('in');
  W.el.querySelectorAll('.wr-prog i').forEach((b, j) => { b.classList.toggle('done', j < W.i); b.classList.toggle('on', j === W.i); b.style.setProperty('--p', j < W.i ? 1 : 0); });
  const bg = W.el.querySelector('.wr-bg'); bg.style.backgroundImage = s.image ? `url("${s.image.replace(/"/g, '%22')}")` : 'none';
  const c = st.querySelector('[data-count]');
  if (c) { const to = +c.dataset.count, t0 = performance.now(); const step = t => { const k = Math.min(1, (t - t0) / 1400), e = 1 - (1 - k) ** 3; c.textContent = Math.round(to * e).toLocaleString(); if (k < 1 && W && W.slides[W.i] === s) requestAnimationFrame(step); }; requestAnimationFrame(step); }
  W.el.querySelector('[data-wr="prev"]').disabled = W.i === 0;
}
function tick(t) {
  if (!W) return;
  if (!W.paused && W.i < W.slides.length - 1) {
    W.elapsed += t - (W.last || t);
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
  grad.addColorStop(0, `hsl(${s.hue}, 70%, 32%)`); grad.addColorStop(1, `hsl(${(s.hue + 60) % 360}, 75%, 12%)`);
  g.fillStyle = grad; g.fillRect(0, 0, 1080, 1920);
  const load = async u => { if (!u) return null; const data = await window.amplite.imageData(u).catch(() => null); if (!data) return null; const im = new Image(); im.src = data; try { await im.decode(); return im; } catch { return null; } };
  const coverAt = (im, x, y, w, h, round) => { g.save(); g.beginPath(); round ? g.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2) : g.roundRect(x, y, w, h, 24); g.clip(); const k = Math.max(w / im.width, h / im.height); g.drawImage(im, x + (w - im.width * k) / 2, y + (h - im.height * k) / 2, im.width * k, im.height * k); g.restore(); };
  const wrap = (text, x, y, maxW, lh, font, color = '#fff', maxLines = 3, align = 'center') => {
    g.font = font; g.fillStyle = color; g.textAlign = align; const words = String(text).split(/\s+/), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur);
    lines.slice(0, maxLines).forEach((l, i) => g.fillText(l, x, y + i * lh)); return y + Math.min(lines.length, maxLines) * lh;
  };
  let y = 220;
  g.fillStyle = 'rgba(255,255,255,.75)'; g.font = F(700, 38); g.textAlign = 'center'; g.fillText(`AMPLITE WRAPPED ${d.year}`, 540, 130);
  if (s.summary) {
    y = wrap(`My ${d.year}`, 540, 300, 900, 110, F(900, 110));
    g.textAlign = 'left';
    const col = (title, arr, x) => { g.fillStyle = 'rgba(255,255,255,.7)'; g.font = F(700, 34); g.fillText(title.toUpperCase(), x, 520); arr.slice(0, 5).forEach((t, i) => { g.fillStyle = '#fff'; g.font = F(700, 44); let s2 = `${i + 1}. ${t}`; while (g.measureText(s2).width > 430 && s2.length > 4) s2 = s2.slice(0, -2); g.fillText(s2 + (s2 !== `${i + 1}. ${t}` ? '…' : ''), x, 600 + i * 76); }); };
    col('Top artists', d.topA.map(a => a.name), 90); col('Top songs', d.topS.map(x => x.title), 570);
    g.fillStyle = 'rgba(255,255,255,.7)'; g.font = F(700, 34); g.fillText('MINUTES', 90, 1100); g.fillText('PERSONALITY', 570, 1100);
    g.fillStyle = '#fff'; g.font = F(900, 96); g.fillText(Math.round(d.total / 60000).toLocaleString(), 90, 1200); g.font = F(900, 64); g.fillText(personality(d).t.replace('The ', ''), 570, 1190);
  } else if (s.list) {
    wrap(s.kicker, 540, 300, 900, 90, F(900, 84));
    const ims = await Promise.all(s.list.map(x => load(x.image)));
    s.list.forEach((x, i) => {
      const yy = 470 + i * 250; g.textAlign = 'left';
      g.fillStyle = 'rgba(255,255,255,.6)'; g.font = F(900, 64); g.fillText(String(i + 1), 90, yy + 125);
      if (ims[i]) coverAt(ims[i], 170, yy, 200, 200, x.round);
      g.fillStyle = '#fff'; g.font = F(800, 56); let t = x.a; while (g.measureText(t).width > 600 && t.length > 4) t = t.slice(0, -2); g.fillText(t + (t !== x.a ? '…' : ''), 410, yy + 95);
      g.fillStyle = 'rgba(255,255,255,.7)'; g.font = F(600, 40); g.fillText(x.b, 410, yy + 155);
    });
  } else {
    const im = await load(s.image);
    if (im) { coverAt(im, 240, 230, 600, 600, s.round); y = 960; } else y = 560;
    g.fillStyle = 'rgba(255,255,255,.8)'; g.font = F(700, 46); g.textAlign = 'center'; g.fillText(s.kicker, 540, y); y += 40;
    if (s.emoji) { g.font = F(400, 140); g.fillText(s.emoji, 540, y + 150); y += 190; }
    y = wrap(s.big, 540, y + 130, 960, 140, F(900, s.big.length > 14 ? 104 : 150), '#fff', 2);
    if (s.unit) { g.font = F(700, 56); g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(s.unit, 540, y + 10); y += 70; }
    wrap(s.sub, 540, y + 60, 880, 62, F(500, 46), 'rgba(255,255,255,.85)', 5);
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
  // Real artist photos for the top artists (Spotify), where Amplite knows their IDs.
  await Promise.all(d.topA.slice(0, 5).map(async a => { if (a.id) a.image = await X.artistImage(a.id).catch(() => '') || ''; }));
  const el = document.createElement('div'); el.className = 'wr'; el.tabIndex = -1;
  el.innerHTML = `<div class="wr-bg"></div><div class="wr-shade"></div>
    <div class="wr-prog">${slides(d).map(() => '<i></i>').join('')}</div>
    <header class="wr-top">${years.length > 1 ? `<select class="wr-year" aria-label="Year">${years.map(y => `<option${y === year ? ' selected' : ''}>${y}</option>`).join('')}</select>` : ''}
      <span class="flex1"></span><button class="icon-btn" data-wr="copy" title="Copy this slide as a picture">${X.svg('share')}</button><button class="icon-btn" data-wr="save" title="Save this slide as a picture">${X.svg('listadd')}</button><button class="icon-btn" data-wr="close" title="Close (Esc)">${X.svg('x')}</button></header>
    <div class="wr-stage"></div>
    <button class="wr-nav prev" data-wr="prev" aria-label="Previous"></button><button class="wr-nav next" data-wr="next" aria-label="Next"></button>`;
  document.body.append(el);
  W = { d, slides: slides(d), i: 0, el, paused: false, elapsed: 0, last: 0 };
  W.key = e => {
    if (!W) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); go(W.i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); go(W.i - 1); }
  };
  document.addEventListener('keydown', W.key, true);
  el.addEventListener('pointerdown', e => { if (!e.target.closest('button, select')) W && (W.paused = true); });
  el.addEventListener('pointerup', () => { if (W) W.paused = false; });
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-wr]'); if (!b || !W) return;
    const a = b.dataset.wr;
    if (a === 'close') close(); else if (a === 'next') go(W.i + 1); else if (a === 'prev') go(W.i - 1);
    else if (a === 'again') go(0); else if (a === 'top50') top50(b);
    else if (a === 'copy' || a === 'save') shareSlide(a === 'copy');
  });
  el.querySelector('.wr-year')?.addEventListener('change', e => { close(); setTimeout(() => openWrapped(X, +e.target.value), 260); });
  requestAnimationFrame(() => el.classList.add('show'));
  go(0); requestAnimationFrame(tick); el.focus();
}
