// Your music timeline: every month of your listening (Amplite's history plus imported Last.fm
// scrobbles), newest first — what you were into, what you couldn't stop playing, who you found that
// month — plus "on this day" from earlier years. Each month plays or saves as a playlist.
// Loaded only when the page opens; months are drawn as you scroll so long histories stay quick.
let X = null;
const MS = r => r.ms || r.duration || 210000; // imported scrobbles don't say how long: assume a typical song
const keyOf = s => (s || '').toLowerCase().replace(/\s*[([].*?[)\]]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
const artOf = r => (r.artists?.length ? r.artists[0] : r.artist) || '';
const MONTH = (y, m) => new Date(y, m, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
const hrs = ms => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.round(m / 60).toLocaleString()} h`; };

function crunch(items) {
  const months = new Map(), firstSeen = new Map();
  const sorted = items.filter(r => r.ts && r.title).sort((a, b) => a.ts - b.ts);
  for (const r of sorted) {
    const d = new Date(r.ts * 1000), k = d.getFullYear() * 12 + d.getMonth();
    let M = months.get(k);
    if (!M) months.set(k, M = { k, y: d.getFullYear(), m: d.getMonth(), plays: 0, ms: 0, days: new Array(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()).fill(0), songs: new Map(), artists: new Map(), firsts: [] });
    const a = artOf(r), ak = keyOf(a), sk = ak + '|' + keyOf(r.title);
    M.plays++; M.ms += MS(r); M.days[d.getDate() - 1] += MS(r);
    const s = M.songs.get(sk) || M.songs.set(sk, { title: r.title, artist: a, uri: r.uri || '', image: r.image || '', n: 0, ms: 0 }).get(sk);
    s.n++; s.ms += MS(r); if (!s.uri && r.uri) s.uri = r.uri; if (!s.image && r.image) s.image = r.image;
    if (ak) {
      const A = M.artists.get(ak) || M.artists.set(ak, { name: a, id: r.artistIds?.[0] || '', n: 0, ms: 0, image: '' }).get(ak);
      A.n++; A.ms += MS(r); if (!A.id && r.artistIds?.[0]) A.id = r.artistIds[0]; if (!A.image && r.image) A.image = r.image;
      if (!firstSeen.has(ak)) { firstSeen.set(ak, r.ts); M.firsts.push(a); }
    }
  }
  const list = [...months.values()].sort((a, b) => b.k - a.k);
  const firstMonth = list.at(-1);
  for (const M of list) {
    M.top = [...M.songs.values()].sort((a, b) => b.n - a.n || b.ms - a.ms);
    M.topArtists = [...M.artists.values()].sort((a, b) => b.ms - a.ms);
    // The very first month just lists everything as "new", which says nothing.
    if (M === firstMonth) M.firsts = [];
    // Only count first listens that stuck a little (2+ plays that month).
    else M.firsts = M.firsts.filter(n => (M.artists.get(keyOf(n))?.n || 0) >= 2);
  }
  return { list, total: sorted.length, ms: sorted.reduce((t, r) => t + MS(r), 0), first: sorted[0]?.ts || 0 };
}
function onThisDay(items) {
  const now = new Date(), byYear = new Map();
  for (const r of items) {
    const d = new Date(r.ts * 1000);
    if (d.getDate() !== now.getDate() || d.getMonth() !== now.getMonth() || d.getFullYear() === now.getFullYear()) continue;
    const Y = byYear.get(d.getFullYear()) || byYear.set(d.getFullYear(), { y: d.getFullYear(), ms: 0, songs: new Map() }).get(d.getFullYear());
    Y.ms += MS(r);
    const k = keyOf(artOf(r)) + '|' + keyOf(r.title), s = Y.songs.get(k) || Y.songs.set(k, { title: r.title, artist: artOf(r), image: r.image || '', uri: r.uri || '', n: 0 }).get(k);
    s.n++;
  }
  return [...byYear.values()].sort((a, b) => b.y - a.y).map(Y => ({ ...Y, top: [...Y.songs.values()].sort((a, b) => b.n - a.n).slice(0, 3) }));
}
const cover = (u, cls = '') => u ? `<img class="${cls}" src="${X.esc(u)}" alt="" loading="lazy">` : `<div class="${cls} ph">${X.svg('music')}</div>`;
function monthHTML(M) {
  const { esc } = X, ob = M.top[0], peak = Math.max(...M.days, 1), today = new Date();
  const isNow = M.y === today.getFullYear() && M.m === today.getMonth();
  const bars = M.days.map((v, i) => `<i style="height:${v ? Math.max(8, Math.round(v / peak * 100)) : 0}%" title="${new Date(M.y, M.m, i + 1).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}: ${hrs(v)}"></i>`).join('');
  return `<article class="tl-month" data-k="${M.k}" id="tl-${M.k}">
    <header><div><h2>${MONTH(M.y, M.m)}${isNow ? ' <em>so far</em>' : ''}</h2><p>${hrs(M.ms)} · ${M.plays.toLocaleString()} plays · ${M.artists.size} artists</p></div>
      <div class="tl-acts"><button class="pill-btn" data-tl="play" data-k="${M.k}">${X.svg('play')} Play</button><button class="btn ctl" data-tl="save" data-k="${M.k}" title="Save this month's top songs as a playlist">Save as playlist</button></div></header>
    <div class="tl-grid">
      ${ob ? `<div class="tl-ob">${cover(ob.image, 'tl-ob-art')}<div><small>Couldn’t stop playing</small><b>${esc(ob.title)}</b><span>${esc(ob.artist)}</span><em>${ob.n} plays</em></div></div>` : ''}
      <div class="tl-col"><h4>Top artists</h4><ol>${M.topArtists.slice(0, 5).map(a => `<li><a data-tl-artist="${esc(a.id)}" data-name="${esc(a.name)}">${esc(a.name)}</a><em>${hrs(a.ms)}</em></li>`).join('')}</ol></div>
      <div class="tl-col"><h4>Top songs</h4><ol>${M.top.slice(0, 5).map(s => `<li><span>${esc(s.title)} <small>${esc(s.artist)}</small></span><em>${s.n}</em></li>`).join('')}</ol></div>
      <div class="tl-col tl-new"><h4>First listens</h4>${M.firsts.length ? `<p><b>${M.firsts.length}</b> new artist${M.firsts.length === 1 ? '' : 's'}: ${M.firsts.slice(0, 6).map(esc).join(', ')}${M.firsts.length > 6 ? '…' : ''}</p>` : '<p class="muted">Nobody new this month.</p>'}</div>
    </div>
    <div class="tl-days" aria-label="Listening per day">${bars}</div>
  </article>`;
}
let DATA = null, shown = 0, obs = null;
function more(box) {
  const next = DATA.list.slice(shown, shown + 6); if (!next.length) return;
  shown += next.length;
  box.insertAdjacentHTML('beforeend', next.map(monthHTML).join(''));
  const s = box.querySelector('#tlSentinel'); if (s) box.append(s);
}
async function playMonth(k, save, btn) {
  const M = DATA.list.find(x => x.k === +k); if (!M) return;
  btn.disabled = true; const label = btn.innerHTML; btn.textContent = 'Finding songs…';
  try {
    const want = M.top.slice(0, 50), uris = [];
    // Songs played in Amplite already have their Spotify ID; imported scrobbles are looked up by name.
    const found = await X.pool(want, 3, s => s.uri ? { uri: s.uri } : X.resolveRec(s.artist, s.title));
    found.forEach(t => { if (t?.uri && !uris.includes(t.uri)) uris.push(t.uri); });
    if (!uris.length) { X.toast('Couldn’t find those songs on Spotify right now.'); return; }
    if (!save) { X.playUris(uris, 0); return; }
    const name = `${MONTH(M.y, M.m)} · Amplite`;
    const pl = await X.api('/me/playlists', { method: 'POST', body: { name, description: `Your most-played songs in ${MONTH(M.y, M.m)}, from Amplite's timeline.`, public: false } });
    await X.api(`/playlists/${pl.id}/items`, { method: 'POST', body: { uris: uris.slice(0, 100) } });
    X.refreshPlaylists();
    X.toast(`Saved “${name}” (${uris.length} songs)`, { label: 'Open', run: () => X.navigate('playlist', pl.id) });
  } catch (e) { if (!X.needsEditPermission(e)) X.toast(e.message); }
  finally { btn.disabled = false; btn.innerHTML = label; }
}
export async function viewTimeline(el, ctx, alive) {
  X = ctx;
  const items = await X.histItems();
  if (!alive()) return;
  DATA = crunch(items); shown = 0;
  const lfm = await window.amplite.lastfm('state').then(r => r?.state).catch(() => null);
  const imported = X.store.get('statsLastfmImported', 0);
  const days = onThisDay(items);
  const years = [...new Set(DATA.list.map(M => M.y))];
  const canImport = lfm?.user;
  el.innerHTML = `<div class="pad nr tl"><header class="lib-head"><div><h1>Your music timeline</h1>
      <p class="nr-sub">${DATA.total ? `Since ${new Date(DATA.first * 1000).toLocaleDateString([], { month: 'long', year: 'numeric' })} · ${DATA.total.toLocaleString()} plays · ${hrs(DATA.ms)}` : ''}</p></div>
      <div class="lib-ctl">${years.length > 1 ? `<div class="seg st-range tl-years">${years.map(y => `<button data-tl-year="${y}">${y}</button>`).join('')}</div>` : ''}</div></header>
    ${canImport && (!imported || Date.now() - imported > 7 * 864e5) ? `<div class="tl-import"><div><b>${imported ? 'Top up from Last.fm' : 'See years back'}</b><span>${imported ? 'Bring in scrobbles from other apps since your last import.' : `Bring in your whole Last.fm history (${X.esc(lfm.user)}) so the timeline goes back further than Amplite.`}</span></div><button class="btn primary" id="tlImport">Import from Last.fm</button><span class="tl-imsg" id="tlImsg"></span></div>` : ''}
    ${days.length ? `<section class="tl-otd"><h3>On this day</h3><div class="tl-otd-row">${days.map(Y => `<div class="tl-otd-y"><small>${new Date().getFullYear() - Y.y} year${new Date().getFullYear() - Y.y === 1 ? '' : 's'} ago · ${Y.y}</small>
      ${Y.top.map(s => `<div class="tl-otd-s">${cover(s.image, 'tl-otd-art')}<div><b>${X.esc(s.title)}</b><span>${X.esc(s.artist)}</span></div></div>`).join('')}<em>${hrs(Y.ms)} that day</em></div>`).join('')}</div></section>` : ''}
    <div id="tlMonths">${DATA.list.length ? '<div id="tlSentinel"></div>' : `<div class="empty"><h2>Nothing here yet</h2><p>Play some music${canImport ? ', or import your Last.fm history above' : ''}, and your months show up here.</p></div>`}</div></div>`;
  const box = el.querySelector('#tlMonths');
  if (DATA.list.length) {
    more(box);
    obs?.disconnect();
    obs = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && alive()) more(box); }, { root: document.getElementById('view'), rootMargin: '900px' });
    obs.observe(box.querySelector('#tlSentinel'));
  }
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-tl]'); if (b) { playMonth(b.dataset.k, b.dataset.tl === 'save', b); return; }
    const a = e.target.closest('[data-tl-artist]'); if (a) { a.dataset.tlArtist ? X.navigate('artist', a.dataset.tlArtist) : X.searchFor(a.dataset.name); return; }
    const y = e.target.closest('[data-tl-year]'); if (y) {
      const M = DATA.list.find(x => x.y === +y.dataset.tlYear); if (!M) return;
      while (!document.getElementById('tl-' + M.k) && shown < DATA.list.length) more(box);
      // Scroll only the page area (scrollIntoView would also nudge the window's own layout).
      const v = document.getElementById('view'), t = document.getElementById('tl-' + M.k);
      if (v && t) v.scrollTo({ top: v.scrollTop + t.getBoundingClientRect().top - v.getBoundingClientRect().top - 70, behavior: 'smooth' });
    }
  });
  el.querySelector('#tlImport')?.addEventListener('click', async ev => {
    const btn = ev.currentTarget, msg = el.querySelector('#tlImsg'); btn.disabled = true;
    try {
      const { importScrobbles } = await import('./stats.js');
      const added = await importScrobbles({ store: X.store, histItems: X.histItems, alive, say: t => { msg.textContent = t; } });
      X.forgetHistory();
      msg.textContent = added ? `Imported ${added.toLocaleString()} plays.` : 'Already up to date.';
      if (added && alive()) setTimeout(() => alive() && X.navigate('timeline', '', false), 800);
    } catch (e) { msg.textContent = 'Couldn’t import: ' + e.message; btn.disabled = false; }
  });
}
