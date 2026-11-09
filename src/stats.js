// Amplite Stats — "Wrapped, but always": your listening from Amplite's own history (kept on this PC),
// optionally topped up with your Last.fm scrobbles. Loaded only when the Stats page opens.

const DAY = 864e5;
const RANGES = { week: { label: 'Last 7 days', days: 7, prev: 'last week' }, month: { label: 'Last 30 days', days: 30, prev: 'the 30 days before' },
  year: { label: 'Last 12 months', days: 365, prev: 'the year before' }, all: { label: 'All time', days: 0 } };
// Categorical slots for genres (validated colour-blind-safe order), dark and light steps.
const CAT = { dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'], light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'] };
const OTHER = { dark: '#5c5f66', light: '#b4b6bb' };
// Last.fm tags that aren't genres.
const NOT_GENRE = /^(seen live|favou?rites?|favou?rite songs?|my favou?rite|love|loved|awesome|beautiful|albums i own|under \d+.*|\d{2,4}s?|female vocalists?|male vocalists?|vocalists?|american|british|uk|usa|canadian|korean|japanese|swedish|german|french|australian|spotify|all|other|unknown|soundtrack|cover|covers|singer-songwriter-ish)$/i;

let C = null;          // helpers from the app (api, store, svg, esc, …)
let H = { items: null, at: 0 };
let range = 'week';
let busy = false;
let importMsg = ''; // survives the redraw after an import

const keyOf = s => (s || '').toLowerCase().replace(/\s*[([].*?[)\]]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
const playMs = r => r.ms || r.duration || 210000; // imported scrobbles don't say how long: assume a typical song
const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const hm = ms => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`; };
const bigNum = ms => { const m = Math.round(ms / 60000); return m.toLocaleString(); };
const pct = (a, b) => b ? Math.round(((a - b) / b) * 100) : null;
const artistsOf = r => (r.artists?.length ? r.artists : (r.artist ? [r.artist] : [])).filter(Boolean);

/* ---------------- loading history ---------------- */
async function loadHistory(force) {
  if (H.items && !force && Date.now() - H.at < 15000) return H.items;
  const r = await window.amplite.history('read');
  H = { items: (r.items || []).sort((a, b) => a.ts - b.ts), at: Date.now() };
  return H.items;
}
const dupe = (have, r) => { // same song within 90 s = the same play (Amplite also scrobbles to Last.fm)
  const k = keyOf(r.title), list = have.get(k); if (!list) return false;
  return list.some(t => Math.abs(t - r.ts) < 90);
};
const indexByTitle = items => { const m = new Map(); for (const r of items) { const k = keyOf(r.title); (m.get(k) || m.set(k, []).get(k)).push(r.ts); } return m; };
// First visit with an empty history: start with the last 50 plays Spotify remembers.
async function seedFromSpotify() {
  if (C.store.get('statsSeeded')) return;
  C.store.set('statsSeeded', true);
  try {
    const d = await C.bgApi('/me/player/recently-played', { query: { limit: 50 } });
    const have = indexByTitle(H.items || []);
    const recs = (d?.items || []).filter(i => i.track && i.played_at).map(i => {
      const t = i.track, dur = t.duration_ms || 0;
      return { ts: Math.floor(Date.parse(i.played_at) / 1000 - dur / 1000), ms: dur, uri: t.uri, title: t.name, artist: t.artists.map(a => a.name).join(', '),
        artists: t.artists.map(a => a.name), artistIds: t.artists.map(a => a.id), album: t.album?.name || '', albumId: t.album?.id || '',
        image: C.img(t.album?.images, 300) || '', duration: dur, src: 'spotify' };
    }).filter(r => !dupe(have, r));
    if (recs.length) { await window.amplite.history('append', { items: recs }); await loadHistory(true); }
  } catch {}
}
async function importLastfm(btn) {
  if (busy) return; busy = true;
  const msg = document.getElementById('stImportMsg');
  const say = t => { if (msg) msg.textContent = t; };
  btn.disabled = true;
  try {
    await loadHistory(true);
    const have = indexByTitle(H.items);
    let page = 1, pages = 1, added = 0, seen = 0, total = 0;
    do {
      const r = await window.amplite.history('lastfm', { page });
      if (!r.ok) throw new Error(r.error);
      pages = Math.min(r.pages, 50); total = r.total; seen += r.tracks.length;
      const fresh = r.tracks.filter(x => !dupe(have, x));
      fresh.forEach(x => { const k = keyOf(x.title); (have.get(k) || have.set(k, []).get(k)).push(x.ts); });
      if (fresh.length) await window.amplite.history('append', { items: fresh });
      added += fresh.length;
      say(`Importing… ${seen.toLocaleString()} of ${Math.min(total, 10000).toLocaleString()} scrobbles`);
      page++;
    } while (page <= pages && C.alive());
    C.store.set('statsLastfmImported', Date.now());
    importMsg = added ? `Imported ${added.toLocaleString()} plays from Last.fm.` : 'Already up to date — nothing new on Last.fm.';
    say(importMsg);
    await loadHistory(true);
    if (C.alive()) render(true);
  } catch (e) { say('Couldn’t import: ' + e.message); }
  btn.disabled = false; busy = false;
}

/* ---------------- artist info: picture + genres (cached 30 days) ---------------- */
function infoMap() { C._info ??= C.store.get('artinfo', {}) || {}; return C._info; }
let infoSaveT;
const saveInfo = () => { clearTimeout(infoSaveT); infoSaveT = setTimeout(() => { const m = infoMap(), k = Object.keys(m); if (k.length > 1500) k.slice(0, k.length - 1200).forEach(x => delete m[x]); C.store.set('artinfo', m); }, 800); };
// needPicture: only the top artists on screen need Spotify (for their photo). Genres for the rest come
// from Last.fm when there's a key, so opening Stats costs Spotify only a handful of requests.
async function artistInfo(name, id, needPicture = false) {
  const k = keyOf(name), m = infoMap(), have = m[k];
  if (have && Date.now() - have.at < 30 * DAY && (have.img || have.spotifyTried || !needPicture)) return have;
  let out = { id: id || have?.id || '', img: have?.img || '', genres: have?.genres || [], at: Date.now() };
  const useSpotify = needPicture || !C.lastfmKey;
  if (useSpotify && !C.rateLimited()) {
    try {
      let a = out.id ? await C.bgApi(`/artists/${out.id}`) : null;
      if (!a && needPicture) { const d = await C.bgApi('/search', { query: { q: `artist:"${name.replace(/"/g, '')}"`, type: 'artist', limit: 1 } }); a = d.artists?.items?.[0]; if (a && keyOf(a.name) !== k) a = null; }
      if (a) out = { id: a.id, img: C.img(a.images, 160) || '', genres: (a.genres || []).slice(0, 4).length ? a.genres.slice(0, 4) : out.genres, at: Date.now() };
      out.spotifyTried = true;
    } catch (e) { if (e.status === 429) return have || out; }
  }
  // Spotify often has no genres for an artist: Last.fm's tags (when a Last.fm key is set) fill in.
  if (!out.genres.length) {
    try {
      const r = await window.amplite.history('tags', { artist: name });
      if (r.ok) out.genres = r.tags.filter(t => t.count >= 10 && !NOT_GENRE.test(t.name.trim()) && keyOf(t.name) !== k).slice(0, 3).map(t => t.name.toLowerCase());
    } catch {}
  }
  m[k] = out; saveInfo();
  return out;
}
async function pool(items, n, fn) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const j = i++; await fn(items[j]); } })); }

/* ---------------- crunching ---------------- */
function crunch(items, rangeId) {
  const now = Date.now(), R = RANGES[rangeId];
  const from = R.days ? now - R.days * DAY : 0, prevFrom = R.days ? from - R.days * DAY : 0;
  const inR = items.filter(r => r.ts * 1000 >= from), prev = R.days ? items.filter(r => r.ts * 1000 >= prevFrom && r.ts * 1000 < from) : [];
  const sum = list => list.reduce((s, r) => s + playMs(r), 0);
  const art = new Map(), songs = new Map(), firstSeen = new Map();
  for (const r of items) for (const a of artistsOf(r)) { const k = keyOf(a); if (!firstSeen.has(k)) firstSeen.set(k, r.ts * 1000); }
  for (const r of inR) {
    const ms = playMs(r), names = artistsOf(r);
    names.forEach((a, i) => {
      const k = keyOf(a); if (!k) return;
      const e = art.get(k) || { name: a, ms: 0, plays: 0, id: '' };
      e.ms += ms; e.plays++; if (!e.id && r.artistIds?.[i]) e.id = r.artistIds[i]; art.set(k, e);
    });
    const sk = r.uri || keyOf(names[0]) + '|' + keyOf(r.title);
    const s = songs.get(sk) || { title: r.title, artist: names.join(', '), uri: r.uri, image: r.image, plays: 0, ms: 0 };
    s.plays++; s.ms += ms; if (!s.image && r.image) s.image = r.image; if (!s.uri && r.uri) s.uri = r.uri; songs.set(sk, s);
  }
  const topArtists = [...art.values()].sort((a, b) => b.ms - a.ms);
  const topSongs = [...songs.values()].sort((a, b) => b.plays - a.plays || b.ms - a.ms);
  const discoveries = topArtists.filter(a => (firstSeen.get(keyOf(a.name)) || 0) >= from && from > 0);
  // streaks (whole history)
  const days = new Set(items.map(r => dayKey(r.ts * 1000)));
  let cur = 0, t = startOfDay(now);
  if (!days.has(dayKey(t))) t -= DAY; // today not played yet: the streak is still alive
  while (days.has(dayKey(t))) { cur++; t -= DAY; }
  let best = 0, run = 0, lastDay = null;
  [...days].sort().forEach(d => { const dt = new Date(d + 'T12:00:00').getTime(); run = lastDay && Math.round((dt - lastDay) / DAY) === 1 ? run + 1 : 1; best = Math.max(best, run); lastDay = dt; });
  // hours of the day
  const hours = Array(24).fill(0); inR.forEach(r => { hours[new Date(r.ts * 1000).getHours()] += playMs(r); });
  return { R, from, inR, prev, ms: sum(inR), prevMs: sum(prev), plays: inR.length, prevPlays: prev.length, artists: art.size,
    topArtists, topSongs, discoveries, streak: cur, best, playedToday: days.has(dayKey(now)), hours, estimated: inR.some(r => !r.ms) };
}
function timeline(items, rangeId) {
  // bars: days for week/month, weeks for a year, months for all time
  const now = Date.now(), out = [];
  if (rangeId === 'week' || rangeId === 'month') {
    const n = RANGES[rangeId].days, start = startOfDay(now) - (n - 1) * DAY;
    for (let i = 0; i < n; i++) out.push({ t: start + i * DAY, ms: 0 });
    items.forEach(r => { const i = Math.floor((startOfDay(r.ts * 1000) - start) / DAY); if (i >= 0 && i < n) out[i].ms += playMs(r); });
    out.forEach(b => { b.label = new Date(b.t).toLocaleDateString(undefined, rangeId === 'week' ? { weekday: 'short' } : { month: 'short', day: 'numeric' }); });
  } else if (rangeId === 'year') {
    const start = startOfDay(now) - 51 * 7 * DAY - ((new Date().getDay() + 6) % 7) * DAY;
    for (let i = 0; i < 52; i++) out.push({ t: start + i * 7 * DAY, ms: 0 });
    items.forEach(r => { const i = Math.floor((r.ts * 1000 - start) / (7 * DAY)); if (i >= 0 && i < 52) out[i].ms += playMs(r); });
    out.forEach(b => { b.label = 'Week of ' + new Date(b.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); });
  } else {
    if (!items.length) return out;
    const f = new Date(items[0].ts * 1000), n0 = new Date();
    let y = f.getFullYear(), m = f.getMonth();
    const months = (n0.getFullYear() - y) * 12 + n0.getMonth() - m + 1;
    if (months > 36) { const skip = months - 36; m += skip; y += Math.floor(m / 12); m %= 12; }
    while (y < n0.getFullYear() || (y === n0.getFullYear() && m <= n0.getMonth())) { out.push({ t: new Date(y, m, 1).getTime(), ms: 0 }); m++; if (m > 11) { m = 0; y++; } }
    items.forEach(r => { const d = new Date(r.ts * 1000), i = out.findIndex(b => { const bd = new Date(b.t); return bd.getFullYear() === d.getFullYear() && bd.getMonth() === d.getMonth(); }); if (i >= 0) out[i].ms += playMs(r); });
    out.forEach(b => { b.label = new Date(b.t).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }); });
  }
  return out;
}
function heatmap(items) {
  // last 20 weeks, Monday-first columns
  const today = startOfDay(Date.now()), dow = (new Date(today).getDay() + 6) % 7, weeks = 20;
  const start = today - dow * DAY - (weeks - 1) * 7 * DAY, cells = [];
  const per = new Map(); items.forEach(r => { const k = dayKey(r.ts * 1000); per.set(k, (per.get(k) || 0) + playMs(r)); });
  for (let w = 0; w < weeks; w++) for (let d = 0; d < 7; d++) { const t = start + (w * 7 + d) * DAY; cells.push({ t, w, d, ms: t > today ? -1 : per.get(dayKey(t)) || 0 }); }
  return cells;
}
async function genreDrift(items) {
  // last 12 weeks: share of listening per genre, top 5 + Other
  const weeks = 12, today = startOfDay(Date.now()), dow = (new Date(today).getDay() + 6) % 7, start = today - dow * DAY - (weeks - 1) * 7 * DAY;
  const win = items.filter(r => r.ts * 1000 >= start);
  // look up genres for the artists that make up most of the listening (keeps it to a few dozen lookups)
  const byArtist = new Map(); win.forEach(r => { const a = artistsOf(r)[0]; if (!a) return; const k = keyOf(a); const e = byArtist.get(k) || { name: a, id: r.artistIds?.[0] || '', ms: 0 }; e.ms += playMs(r); byArtist.set(k, e); });
  const top = [...byArtist.values()].sort((a, b) => b.ms - a.ms).slice(0, 40);
  await pool(C.lastfmKey ? top : top.slice(0, 15), 3, a => artistInfo(a.name, a.id));
  const m = infoMap(), wk = Array.from({ length: weeks }, (_, i) => ({ t: start + i * 7 * DAY, g: new Map(), total: 0 }));
  let covered = 0, all = 0;
  for (const r of win) {
    const i = Math.floor((r.ts * 1000 - start) / (7 * DAY)); if (i < 0 || i >= weeks) continue;
    const ms = playMs(r); all += ms; wk[i].total += ms;
    const g = m[keyOf(artistsOf(r)[0])]?.genres || [];
    if (!g.length) continue;
    covered += ms;
    wk[i].g.set(g[0], (wk[i].g.get(g[0]) || 0) + ms); // each artist's main genre
  }
  const tot = new Map(); wk.forEach(w => w.g.forEach((v, k) => tot.set(k, (tot.get(k) || 0) + v)));
  const genres = [...tot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]);
  return { weeks: wk, genres, coverage: all ? covered / all : 0 };
}

/* ---------------- drawing ---------------- */
const esc = s => C.esc(s);
function tiles(d) {
  const delta = (a, b) => { if (!RANGES[range].days || !b) return ''; const p = pct(a, b); if (p === null) return ''; const up = p >= 0;
    return `<span class="st-delta ${up ? 'up' : 'down'}" title="Compared with ${RANGES[range].prev}">${up ? '▲' : '▼'} ${Math.abs(p)}%</span>`; };
  return `<div class="st-tiles">
    <div class="st-tile"><div class="st-k">Minutes listened</div><div class="st-v">${bigNum(d.ms)}</div><div class="st-s">${hm(d.ms)} ${delta(d.ms, d.prevMs)}</div></div>
    <div class="st-tile"><div class="st-k">Songs played</div><div class="st-v">${d.plays.toLocaleString()}</div><div class="st-s">${d.topSongs.length.toLocaleString()} different ${delta(d.plays, d.prevPlays)}</div></div>
    <div class="st-tile"><div class="st-k">Artists</div><div class="st-v">${d.artists.toLocaleString()}</div><div class="st-s">${d.discoveries.length ? `${d.discoveries.length} new to you` : RANGES[range].days ? 'no new ones' : 'all time'}</div></div>
    <div class="st-tile"><div class="st-k">Listening streak</div><div class="st-v">${d.streak} <small>day${d.streak === 1 ? '' : 's'}</small></div><div class="st-s">${d.streak && !d.playedToday ? 'Play something today to keep it · ' : ''}best ${d.best}</div></div>
  </div>`;
}
function headline(d) {
  const a = d.topArtists[0], peak = d.hours.indexOf(Math.max(...d.hours));
  const when = peak < 5 ? 'late at night' : peak < 12 ? 'in the morning' : peak < 17 ? 'in the afternoon' : peak < 21 ? 'in the evening' : 'at night';
  const hr = new Date(2000, 0, 1, peak).toLocaleTimeString(undefined, { hour: 'numeric' });
  const p = RANGES[range].days ? pct(d.ms, d.prevMs) : null;
  const parts = [];
  parts.push(`You listened for <b>${hm(d.ms)}</b>${p !== null && d.prevMs ? ` — <b>${Math.abs(p)}% ${p >= 0 ? 'more' : 'less'}</b> than ${RANGES[range].prev}` : ''}.`);
  if (a) parts.push(`Your top artist is <b>${esc(a.name)}</b>${d.topArtists.length > 1 ? `, ahead of ${esc(d.topArtists[1].name)}` : ''}.`);
  if (d.ms) parts.push(`You listen most ${when}, around <b>${hr}</b>.`);
  return `<p class="st-headline">${parts.join(' ')}</p>`;
}
function topArtistsHTML(d) {
  const list = d.topArtists.slice(0, 8), max = list[0]?.ms || 1, info = infoMap();
  if (!list.length) return '';
  return `<section class="st-card"><h3>Top artists</h3><ol class="st-rank">${list.map((a, i) => {
    const inf = info[keyOf(a.name)];
    return `<li data-tip="${esc(a.name)} — ${hm(a.ms)} · ${a.plays} play${a.plays === 1 ? '' : 's'}">
      <span class="st-n">${i + 1}</span>
      <span class="st-face round" ${inf?.id ? `data-open="artist:${esc(inf.id)}"` : ''}>${inf?.img ? `<img src="${esc(inf.img)}" alt="" loading="lazy">` : C.svg('user')}</span>
      <span class="st-name">${inf?.id ? `<a data-open="artist:${esc(inf.id)}">${esc(a.name)}</a>` : esc(a.name)}</span>
      <span class="st-barwrap"><span class="st-bar" style="width:${Math.max(2, (a.ms / max) * 100).toFixed(1)}%"></span></span>
      <span class="st-val">${hm(a.ms)}</span></li>`; }).join('')}</ol></section>`;
}
function topSongsHTML(d) {
  const list = d.topSongs.slice(0, 10);
  if (!list.length) return '';
  return `<section class="st-card"><h3>Top songs</h3><ol class="st-songs">${list.map((s, i) => `<li data-st-song="${i}" title="Double-click to play">
      <span class="st-n">${i + 1}</span>
      <span class="st-face">${s.image ? `<img src="${esc(s.image)}" alt="" loading="lazy">` : C.svg('music')}</span>
      <span class="st-text"><b>${esc(s.title)}</b><small>${esc(s.artist)}</small></span>
      <span class="st-val">${s.plays} play${s.plays === 1 ? '' : 's'}</span></li>`).join('')}</ol></section>`;
}
function barsHTML(bins, title, sub) {
  const max = Math.max(1, ...bins.map(b => b.ms));
  const every = bins.length > 14 ? Math.ceil(bins.length / 7) : 1;
  return `<section class="st-card"><h3>${title}</h3>${sub ? `<p class="st-sub">${sub}</p>` : ''}
    <div class="st-bars" style="--n:${bins.length}">${bins.map((b, i) => `<div class="st-col" data-tip="${esc(b.label)}: ${b.ms ? hm(b.ms) : 'nothing'}">
      <span class="st-b" style="height:${b.ms ? Math.max(2, (b.ms / max) * 100).toFixed(1) : 0}%"></span></div>`).join('')}</div>
    <div class="st-axis" style="--n:${bins.length}">${bins.map((b, i) => `<span>${i % every === 0 ? esc(b.label.replace('Week of ', '')) : ''}</span>`).join('')}</div></section>`;
}
function hoursHTML(d) {
  const bins = d.hours.map((ms, h) => ({ ms, label: new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' }) }));
  const max = Math.max(1, ...d.hours), peak = d.hours.indexOf(max);
  return `<section class="st-card"><h3>When you listen</h3><p class="st-sub">${d.ms ? `Most around ${bins[peak].label}` : 'No listening yet'}</p>
    <div class="st-bars hours" style="--n:24">${bins.map((b, h) => `<div class="st-col${h === peak && d.ms ? ' peak' : ''}" data-tip="${esc(b.label)}: ${b.ms ? hm(b.ms) : 'nothing'}"><span class="st-b" style="height:${b.ms ? Math.max(2, (b.ms / max) * 100).toFixed(1) : 0}%"></span></div>`).join('')}</div>
    <div class="st-axis" style="--n:24">${bins.map((b, h) => `<span>${h % 6 === 0 ? esc(b.label) : ''}</span>`).join('')}</div></section>`;
}
function heatHTML(cells, d) {
  const vals = cells.filter(c => c.ms > 0).map(c => c.ms).sort((a, b) => a - b);
  const q = p => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] || 1;
  const steps = [q(0.25), q(0.5), q(0.75)];
  const lvl = ms => ms <= 0 ? 0 : ms <= steps[0] ? 1 : ms <= steps[1] ? 2 : ms <= steps[2] ? 3 : 4;
  const months = []; let lastM = -1;
  for (let w = 0; w < 20; w++) { const m = new Date(cells[w * 7].t).getMonth(); months.push(m !== lastM ? new Date(cells[w * 7].t).toLocaleDateString(undefined, { month: 'short' }) : ''); lastM = m; }
  const past = cells.filter(c => c.ms >= 0), on = past.filter(c => c.ms > 0).length;
  const wd = Array(7).fill(0); past.forEach(c => { wd[c.d] += c.ms; });
  const topWd = wd.indexOf(Math.max(...wd)), wdName = new Date(2024, 0, 1 + topWd).toLocaleDateString(undefined, { weekday: 'long' });
  return `<section class="st-card wide"><h3>Streak calendar</h3><p class="st-sub">Every day you listened in the last 20 weeks</p>
    <div class="st-heat-row"><div class="st-heat-wrap"><div class="st-heat-days"><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span><span></span></div>
    <div><div class="st-heat-months">${months.map(m => `<span>${m}</span>`).join('')}</div>
    <div class="st-heat">${cells.map(c => c.ms < 0 ? '<i class="fut"></i>' : `<i class="l${lvl(c.ms)}" data-tip="${esc(new Date(c.t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }))}: ${c.ms ? hm(c.ms) : 'no listening'}"></i>`).join('')}</div>
    <div class="st-legend-seq"><span>Less</span>${[0, 1, 2, 3, 4].map(l => `<i class="l${l}"></i>`).join('')}<span>More</span></div></div></div>
    <dl class="st-facts">
      <div><dt>Current streak</dt><dd>${d.streak} day${d.streak === 1 ? '' : 's'}</dd></div>
      <div><dt>Longest streak</dt><dd>${d.best} day${d.best === 1 ? '' : 's'}</dd></div>
      <div><dt>Days with music</dt><dd>${on} of ${past.length}</dd></div>
      <div><dt>Biggest day</dt><dd>${on ? wdName + 's' : '—'}</dd></div>
    </dl></div></section>`;
}
function driftHTML(g, light) {
  const pal = light ? CAT.light : CAT.dark, other = light ? OTHER.light : OTHER.dark;
  const head = '<h3>Genre drift</h3><p class="st-sub">How your mix of genres changed over the last 12 weeks</p>';
  if (g.coverage < 0.25 || !g.genres.length) {
    return `<section class="st-card wide"><h3>Genre drift</h3><p class="st-empty">${g.weeks.some(w => w.total) ? 'Not enough genre info yet for the artists you play.' : 'Listen for a while and your genres show up here.'}
      ${C.lastfmKey ? '' : ' Spotify has no genres for many artists — add a Last.fm API key in <b>Settings → Connections</b> to fill them in.'}</p></section>`;
  }
  const series = [...g.genres, 'Other'], W = 600, Hh = 170;
  const shares = g.weeks.map(w => {
    const tot = [...w.g.values()].reduce((a, b) => a + b, 0) || 0;
    const top = g.genres.map(x => tot ? (w.g.get(x) || 0) / tot : 0);
    return [...top, tot ? Math.max(0, 1 - top.reduce((a, b) => a + b, 0)) : 0];
  });
  const n = shares.length, x = i => (i / (n - 1)) * W;
  // 100% stacked areas (weeks without listening are left empty)
  const cum = shares.map(s => { let c = 0; return s.map(v => (c += v)); });
  const paths = series.map((name, si) => {
    const top = cum.map((c, i) => [x(i), Hh - c[si] * Hh]), bot = cum.map((c, i) => [x(i), Hh - (si ? c[si - 1] : 0) * Hh]).reverse();
    return `<path d="M${top.map(p => p.map(v => v.toFixed(1)).join(',')).join('L')}L${bot.map(p => p.map(v => v.toFixed(1)).join(',')).join('L')}Z" fill="${si < 5 ? pal[si] : other}" />`;
  }).join('');
  const sep = series.slice(0, -1).map((_, si) => `<path d="M${cum.map((c, i) => `${x(i).toFixed(1)},${(Hh - c[si] * Hh).toFixed(1)}`).join('L')}" class="st-sep" />`).join('');
  const last = shares.filter(s => s.some(v => v)).at(-1) || shares[n - 1], first = shares.find(s => s.some(v => v)) || shares[0];
  const change = g.genres.map((name, i) => ({ name, d: Math.round((last[i] - first[i]) * 100) })).sort((a, b) => b.d - a.d);
  const rising = change[0]?.d > 2 ? change[0] : null, falling = change.at(-1)?.d < -2 ? change.at(-1) : null;
  const cols = g.weeks.map((w, i) => `<div class="st-dcol" data-tip="${esc('Week of ' + new Date(w.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))}${w.total ? ': ' + series.map((nm, si) => `${nm.replace(/(^|[\s-])\p{L}/gu, c => c.toUpperCase())} ${Math.round(shares[i][si] * 100)}%`).filter((_, si) => shares[i][si] >= 0.01).join(' · ') : ': no listening'}"></div>`).join('');
  return `<section class="st-card wide">${head}
    ${rising || falling ? `<p class="st-drift-note">${rising ? `<b>${esc(rising.name)}</b> is rising (▲ ${rising.d} pts)` : ''}${rising && falling ? ' · ' : ''}${falling ? `<b>${esc(falling.name)}</b> is fading (▼ ${-falling.d} pts)` : ''}</p>` : ''}
    <div class="st-drift"><svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" aria-label="Genre share by week">${paths}${sep}</svg><div class="st-dcols" style="--n:${n}">${cols}</div></div>
    <div class="st-axis drift"><span>${new Date(g.weeks[0].t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span><span>this week</span></div>
    <div class="st-legend">${series.map((nm, si) => `<span><i style="background:${si < 5 ? pal[si] : other}"></i>${esc(nm)} <em>${Math.round(last[si] * 100)}%</em></span>`).join('')}</div>
  </section>`;
}

/* ---------------- share card (a "Wrapped"-style image) ---------------- */
let lastD = null, lastG = null;
const PERIOD = { week: 'week', month: 'month', year: 'year', all: 'music' };
async function loadImg(url) {
  if (!url) return null;
  const data = await window.amplite.imageData(url).catch(() => null);
  if (!data) return null;
  return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = data; });
}
function fit(x, text, max) { if (x.measureText(text).width <= max) return text; let t = text; while (t.length > 1 && x.measureText(t + '…').width > max) t = t.slice(0, -1); return t.trimEnd() + '…'; }
function rr(x, X, Y, w, h, r) { x.beginPath(); x.roundRect(X, Y, w, h, r); }
function cover(x, im, X, Y, w, h) { const s = Math.max(w / im.width, h / im.height), iw = im.width * s, ih = im.height * s; x.drawImage(im, X + (w - iw) / 2, Y + (h - ih) / 2, iw, ih); }
async function drawCard(d, g) {
  const W = 1080, H = 1350, P = 80, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const accent = /^#[0-9a-f]{6}$/i.test(css.getPropertyValue('--accent').trim()) ? css.getPropertyValue('--accent').trim() : '#1db954';
  const font = getComputedStyle(document.body).fontFamily || 'Segoe UI, sans-serif';
  const F = (w, px) => `${w} ${px}px ${font}`;
  const ink = '#ffffff', muted = 'rgba(255,255,255,.62)', faint = 'rgba(255,255,255,.08)';
  // background: near-black with two soft glows of the accent colour
  x.fillStyle = '#0b0c10'; x.fillRect(0, 0, W, H);
  const glow = (cx, cy, r, a) => { const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, accent + a); gr.addColorStop(1, accent + '00'); x.fillStyle = gr; x.fillRect(0, 0, W, H); };
  glow(180, 120, 760, '8c'); glow(1000, 1300, 620, '40');
  // header: logo + range
  x.fillStyle = accent; [[0, 26], [14, 40], [28, 32]].forEach(([dx, h]) => { rr(x, P + dx, 104 - h, 10, h, 5); x.fill(); });
  x.fillStyle = ink; x.font = F(750, 30); x.textBaseline = 'alphabetic'; x.fillText('Amplite', P + 52, 104);
  const now = new Date(), from = RANGES[range].days ? new Date(Date.now() - (RANGES[range].days - 1) * DAY) : null;
  const span = from ? `${from.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: range === 'year' ? 'numeric' : undefined })}` : 'All time';
  x.font = F(600, 26); x.fillStyle = muted; x.textAlign = 'right'; x.fillText(span, W - P, 104); x.textAlign = 'left';
  // title
  const who = (C.meName || 'My').trim();
  x.fillStyle = ink; x.font = F(820, 66); x.fillText(fit(x, `${who}’s ${PERIOD[range]}${range === 'all' ? '' : ' in music'}`, W - 2 * P), P, 236);
  x.font = F(500, 30); x.fillStyle = muted;
  x.fillText(fit(x, g?.genres?.[0] ? `Mostly ${g.genres[0]}` + (d.topArtists[0] ? ` · led by ${d.topArtists[0].name}` : '') : RANGES[range].label, W - 2 * P), P, 286);
  // the big number
  x.fillStyle = accent; x.font = F(900, 168); x.fillText(Math.round(d.ms / 60000).toLocaleString(), P - 6, 468);
  x.fillStyle = ink; x.font = F(650, 34); x.fillText('minutes listened', P, 520);
  const p = RANGES[range].days && d.prevMs ? Math.round(((d.ms - d.prevMs) / d.prevMs) * 100) : null;
  if (p !== null) {
    const t = p === 0 ? `same as ${RANGES[range].prev}` : `${p > 0 ? '▲' : '▼'} ${Math.abs(p)}% vs ${RANGES[range].prev}`; x.font = F(700, 24);
    const tw = x.measureText(t).width + 28, X0 = P + x.measureText('minutes listened').width * (34 / 24) + 24;
    x.fillStyle = 'rgba(255,255,255,.12)'; rr(x, X0, 492, tw, 40, 20); x.fill(); x.fillStyle = ink; x.fillText(t, X0 + 14, 521);
  }
  // three tiles
  const tiles = [[d.plays.toLocaleString(), 'songs played'], [d.artists.toLocaleString(), 'artists'], [`${d.streak}`, d.streak === 1 ? 'day streak' : 'day streak']];
  const tw = (W - 2 * P - 2 * 22) / 3;
  tiles.forEach(([v, l], i) => {
    const X = P + i * (tw + 22); x.fillStyle = faint; rr(x, X, 560, tw, 124, 24); x.fill();
    x.fillStyle = ink; x.font = F(820, 50); x.fillText(v, X + 26, 628); x.fillStyle = muted; x.font = F(600, 24); x.fillText(l, X + 26, 664);
  });
  // top artists
  x.fillStyle = ink; x.font = F(780, 32); x.fillText('Top artists', P, 752);
  const info = infoMap(), list = d.topArtists.slice(0, 5);
  const faces = await Promise.all(list.map(a => loadImg(info[keyOf(a.name)]?.img)));
  list.forEach((a, i) => {
    const Y = 780 + i * 80;
    x.fillStyle = muted; x.font = F(700, 28); x.textAlign = 'right'; x.fillText(String(i + 1), P + 26, Y + 46); x.textAlign = 'left';
    x.save(); x.beginPath(); x.arc(P + 78, Y + 36, 30, 0, Math.PI * 2); x.closePath(); x.clip();
    if (faces[i]) cover(x, faces[i], P + 48, Y + 6, 60, 60); else { x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(P + 48, Y + 6, 60, 60); }
    x.restore();
    const mins = `${Math.round(a.ms / 60000).toLocaleString()} min`;
    x.font = F(600, 26); const mw = x.measureText(mins).width;
    x.fillStyle = muted; x.textAlign = 'right'; x.fillText(mins, W - P, Y + 46); x.textAlign = 'left';
    x.fillStyle = ink; x.font = F(i === 0 ? 800 : 680, i === 0 ? 38 : 34); x.fillText(fit(x, a.name, W - 2 * P - 140 - mw - 30), P + 128, Y + 48);
  });
  // top song
  const s = d.topSongs[0];
  if (s) {
    const Y = 1196; x.fillStyle = faint; rr(x, P, Y - 14, W - 2 * P, 118, 22); x.fill();
    const im = await loadImg(s.image);
    x.save(); rr(x, P + 14, Y, 90, 90, 12); x.clip(); if (im) cover(x, im, P + 14, Y, 90, 90); else { x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(P + 14, Y, 90, 90); } x.restore();
    const plays = `${s.plays} play${s.plays === 1 ? '' : 's'}`; x.font = F(650, 26); const pw = x.measureText(plays).width;
    x.fillStyle = accent; x.font = F(750, 20); x.fillText('TOP SONG', P + 128, Y + 26);
    x.fillStyle = ink; x.font = F(780, 34); x.fillText(fit(x, s.title, W - 2 * P - 160 - pw - 30), P + 128, Y + 62);
    x.fillStyle = muted; x.font = F(500, 24); x.fillText(fit(x, s.artist, W - 2 * P - 160 - pw - 30), P + 128, Y + 92);
    x.font = F(650, 26); x.textAlign = 'right'; x.fillText(plays, W - P - 22, Y + 56); x.textAlign = 'left';
  }
  x.fillStyle = 'rgba(255,255,255,.4)'; x.font = F(600, 20); x.textAlign = 'center'; x.fillText('made with Amplite', W / 2, H - 22); x.textAlign = 'left';
  return cv.toDataURL('image/png');
}
async function openShare(btn) {
  if (!lastD) return;
  btn.disabled = true;
  let url = '';
  try { url = await drawCard(lastD, lastG); } catch (e) { console.error(e); }
  btn.disabled = false;
  if (!url) return;
  document.getElementById('stShare')?.remove();
  const m = document.createElement('div'); m.id = 'stShare'; m.className = 'modal';
  m.innerHTML = `<div class="modal-card st-share"><header class="modal-head"><h2>Share your ${PERIOD[range] === 'music' ? 'stats' : PERIOD[range]}</h2><button class="round-btn" data-share-close title="Close (Esc)">${C.svg('x')}</button></header>
    <div class="st-share-body"><img src="${url}" alt="Your listening stats card"><div class="st-share-actions">
      <button class="btn primary" data-share="copy">Copy image</button><button class="btn" data-share="save">Save as PNG…</button>
      <p class="muted" id="stShareMsg">Copy it, then paste into Discord, a chat or a story.</p></div></div></div>`;
  document.body.append(m);
  const close = () => { m.remove(); document.removeEventListener('keydown', esc); };
  const esc = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc);
  m.addEventListener('click', async e => {
    if (e.target === m || e.target.closest('[data-share-close]')) return close();
    const b = e.target.closest('[data-share]'); if (!b) return;
    const r = await window.amplite.shareImage({ dataUrl: url, action: b.dataset.share, name: `Amplite – ${RANGES[range].label}` });
    const msg = m.querySelector('#stShareMsg');
    if (r?.ok) msg.textContent = b.dataset.share === 'copy' ? 'Copied — paste it anywhere (Ctrl+V).' : 'Saved.';
  });
}

function rangeTabs() {
  return `<div class="st-head-ctl"><button class="btn st-share-btn" data-st-share title="Make an image of these stats to share">${C.svg('share')} Share</button><div class="seg st-range" role="tablist">${Object.entries(RANGES).map(([k, v]) => `<button class="${k === range ? 'on' : ''}" data-st-range="${k}">${v.label}</button>`).join('')}</div></div>`;
}
function isLight() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(bg); if (!m) return false;
  const n = parseInt(m[1], 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6;
}

let lastSongs = [];
async function render(skipLoad) {
  const el = C.el; if (!el || !C.alive()) return;
  const items = skipLoad ? H.items : await loadHistory();
  if (!C.alive()) return;
  const imported = C.store.get('statsLastfmImported');
  const importBox = C.lastfmUser
    ? `<div class="st-import"><span id="stImportMsg" class="muted">${importMsg ? esc(importMsg) : imported ? `Last.fm plays imported (${esc(C.lastfmUser)}).` : `Bring in your past listening from Last.fm (${esc(C.lastfmUser)}).`}</span><button class="btn" data-st-import>${imported ? 'Update from Last.fm' : 'Import Last.fm history'}</button></div>`
    : `<div class="st-import"><span class="muted">Connect Last.fm in <b>Settings → Connections</b> to bring in your past listening.</span></div>`;
  if (!items.length) {
    el.innerHTML = `<div class="pad st"><header class="st-head"><div><h1>Your stats</h1><p class="muted">Live listening stats from Amplite</p></div></header>
      <div class="empty"><p><b>Nothing here yet.</b><br>Stats fill in as you listen — every song you play for 30 seconds or more counts.</p></div>${importBox}</div>`;
    return;
  }
  const d = crunch(items, range);
  lastSongs = d.topSongs.slice(0, 10); lastD = d;
  el.innerHTML = `<div class="pad st">
    <header class="st-head"><div><h1>Your stats</h1><p class="muted">Live from Amplite · ${RANGES[range].label.toLowerCase()}</p></div>${rangeTabs()}</header>
    ${headline(d)}
    ${tiles(d)}
    <div class="st-grid">
      ${topArtistsHTML(d)}
      ${topSongsHTML(d)}
      ${barsHTML(timeline(d.inR, range), range === 'all' ? 'Listening by month' : range === 'year' ? 'Listening by week' : 'Listening by day', d.estimated ? 'Imported plays count as about 3½ minutes each' : '')}
      ${hoursHTML(d)}
      ${heatHTML(heatmap(items), d)}
      ${d.discoveries.length ? `<section class="st-card wide"><h3>New to you</h3><p class="st-sub">${d.discoveries.length} artist${d.discoveries.length === 1 ? '' : 's'} you hadn't played before</p><ul class="st-chips">${d.discoveries.slice(0, 12).map(a => `<li data-tip="${esc(a.name)} — ${hm(a.ms)}">${esc(a.name)}</li>`).join('')}</ul></section>` : ''}
      <div id="stDrift" class="st-wide-slot"><section class="st-card wide"><h3>Genre drift</h3><div class="loading small"><span></span><span></span><span></span></div></section></div>
    </div>
    ${importBox}
    <p class="st-foot muted">Stats are kept only on this PC. <button class="link-btn" data-st-clear>Clear history</button></p>
  </div>`;
  // Artist pictures + genres arrive after (cached after the first time).
  const topA = d.topArtists.slice(0, 8);
  pool(topA, 2, a => artistInfo(a.name, a.id, true)).then(() => {
    if (!C.alive()) return;
    const card = el.querySelector('.st-rank')?.closest('.st-card'); if (card) card.outerHTML = topArtistsHTML(d);
  });
  genreDrift(items).then(g => { lastG = g; if (!C.alive()) return; const slot = el.querySelector('#stDrift'); if (slot) slot.innerHTML = driftHTML(g, isLight()); });
}

/* ---------------- hover tooltip + clicks ---------------- */
function bind(el) {
  if (el._stBound) return; el._stBound = true;
  let tip = document.getElementById('stTip');
  if (!tip) { tip = document.createElement('div'); tip.id = 'stTip'; tip.className = 'st-tip'; document.body.append(tip); }
  el.addEventListener('mousemove', e => {
    const t = e.target.closest('[data-tip]');
    if (!t) { tip.classList.remove('show'); return; }
    tip.textContent = t.dataset.tip; tip.classList.add('show');
    const r = tip.getBoundingClientRect(), x = Math.min(innerWidth - r.width - 8, e.clientX + 14), y = e.clientY - r.height - 12 < 8 ? e.clientY + 18 : e.clientY - r.height - 12;
    tip.style.transform = `translate(${x}px, ${y}px)`;
  });
  el.addEventListener('mouseleave', () => tip.classList.remove('show'));
  el.addEventListener('click', e => {
    const r = e.target.closest('[data-st-range]'); if (r) { range = r.dataset.stRange; C.store.set('statsRange', range); render(true); return; }
    const imp = e.target.closest('[data-st-import]'); if (imp) { importLastfm(imp); return; }
    const sh = e.target.closest('[data-st-share]'); if (sh) { openShare(sh); return; }
    const clr = e.target.closest('[data-st-clear]');
    if (clr) {
      if (!clr.dataset.armed) { clr.dataset.armed = '1'; clr.textContent = 'Click again to delete all stats'; setTimeout(() => { clr.dataset.armed = ''; clr.textContent = 'Clear history'; }, 4000); return; }
      window.amplite.history('clear').then(() => { C.store.del('statsLastfmImported'); H = { items: [], at: Date.now() }; render(true); });
    }
  });
  el.addEventListener('dblclick', e => {
    const li = e.target.closest('[data-st-song]'); if (!li) return;
    const s = lastSongs[+li.dataset.stSong]; if (!s) return;
    if (s.uri) C.playUris([s.uri]);
    else C.api('/search', { query: { q: `track:"${s.title}" artist:"${s.artist.split(',')[0]}"`, type: 'track', limit: 1 } }).then(d => { const t = d.tracks?.items?.[0]; if (t) C.playUris([t.uri]); }).catch(() => {});
  });
}

export async function viewStats(el, ctx) {
  C = { ...ctx, el };
  range = C.store.get('statsRange', 'week');
  if (!RANGES[range]) range = 'week';
  bind(el);
  el.innerHTML = '<div class="loading"><span></span><span></span><span></span></div>';
  const lf = await window.amplite.lastfm('state').catch(() => null);
  C.lastfmUser = lf?.state?.user || ''; C.lastfmKey = !!lf?.state?.key;
  await loadHistory(true);
  if (!H.items.length) await seedFromSpotify();
  await render(true);
}
