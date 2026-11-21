// Playlist health check: goes through the playlists you own or collaborate on and finds songs that
// won't play (greyed out in Spotify), songs that are gone from Spotify, and duplicates — and fixes them,
// swapping a greyed-out song for a version that plays where one exists. Loaded only when opened.
let X = null;
const H = { busy: false, done: 0, total: 0, cur: '', res: null, undo: new Map() };
const NAMES = new Map(); // uri → { name, artist } from the last check, for the "in lots of playlists" list
const REASON = { market: 'Not available in your country', product: 'Not available on your plan', explicit: 'Blocked by your explicit-content setting' };

async function checkOne(pl) {
  const items = await X.pageAll(`/playlists/${pl.id}/items`, { limit: 50, market: 'from_token' }, 5000, { bg: true, fresh: true });
  const tracks = [], gone = [], bad = [];
  items.forEach((it, i) => {
    const t = it.item || it.track;
    if (!t) { gone.push(i); return; }
    if (t.is_local || t.type === 'episode') { tracks.push({ uri: t.uri, skip: true }); return; }
    const n = X.norm(t); if (!n) { gone.push(i); return; }
    n.pos = tracks.length; tracks.push(n);
    NAMES.set(n.uri, { name: n.name, artist: n.artists.map(a => a.name).join(', ') });
    if (t.is_playable === false) bad.push({ ...n, why: REASON[t.restrictions?.reason] || 'Greyed out in Spotify (the label pulled it or it changed)' });
  });
  const real = tracks.filter(t => !t.skip);
  const dup = X.findDuplicates(real);
  return { id: pl.id, name: pl.name, uri: pl.uri, image: X.img(pl.images, 64), count: items.length, uris: real.map(t => t.uri), allUris: items.map(it => (it.item || it.track)?.uri).filter(Boolean), bad, gone: gone.length, dup, fixes: {} };
}
// A playable version of the same song (another release, the remaster, the album version …).
async function findFix(t) {
  const name = t.name.replace(/\s*[-–(].*(remaster|version|edit|mix|mono|stereo).*$/i, '').trim() || t.name, artist = t.artists[0]?.name || '';
  try {
    const d = await X.api('/search', { bg: true, query: { q: `track:"${name.replace(/"/g, '')}" artist:"${artist.replace(/"/g, '')}"`, type: 'track', limit: 10, market: 'from_token' } });
    const c = (d.tracks?.items || []).filter(x => x && x.is_playable !== false && x.uri !== t.uri && x.artists?.some(a => X.sameArtist(a.name, artist)));
    const same = c.filter(x => X.recKey('', x.name.replace(/\s*[-–(].*$/, '')) === X.recKey('', name) || X.recKey('', x.name) === X.recKey('', t.name));
    const pick = (same.length ? same : []).sort((a, b) => Math.abs((a.duration_ms || 0) - t.duration) - Math.abs((b.duration_ms || 0) - t.duration))[0];
    return pick ? X.norm(pick) : null;
  } catch (e) { if (e.status === 429) throw e; return null; }
}
async function scan() {
  if (H.busy) return;
  const pls = X.editablePlaylists();
  H.busy = true; H.done = 0; H.total = pls.length; H.res = { at: Date.now(), list: [], errors: 0 }; draw();
  try {
    for (const pl of pls) {
      H.cur = pl.name; draw(true);
      try {
        const r = await checkOne(pl);
        for (const t of r.bad) { if (X.rateLimited()) break; r.fixes[t.uri] = await findFix(t); }
        H.res.list.push(r);
      } catch (e) { if (e.status === 429) break; H.res.errors++; }
      H.done++; draw(true);
      if (X.rateLimited()) break;
    }
  } finally {
    H.busy = false; H.cur = '';
    manyOf(H.res);
    save();
    draw();
  }
}
function manyOf(res) {
  const cnt = new Map();
  for (const r of res.list) for (const u of new Set(r.uris)) cnt.set(u, (cnt.get(u) || 0) + 1);
  res.many = [...cnt].filter(([u, n]) => n >= 3 && NAMES.has(u)).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([u, n]) => ({ uri: u, n, ...NAMES.get(u) }));
}
// Saved without the full song lists (they can be big); those are fetched again before fixing.
const save = () => X.store.set('health', { ...H.res, list: H.res.list.map(({ uris, allUris, ...r }) => r) });
async function ensure(r) {
  if (r.uris) return r;
  const pl = X.editablePlaylists().find(p => p.id === r.id); if (!pl) throw new Error('That playlist isn’t in your library any more.');
  const f = await checkOne(pl);
  for (const t of f.bad) f.fixes[t.uri] = r.fixes?.[t.uri] !== undefined ? r.fixes[t.uri] : await findFix(t);
  Object.assign(r, f); return r;
}
const issues = r => r.bad.length + r.gone + r.dup.extra;
function snapshot(r) { if (!H.undo.has(r.id)) H.undo.set(r.id, r.allUris.slice()); }
async function fixReplace(r, t, sub) {
  snapshot(r);
  const at = r.uris.indexOf(t.uri);
  await X.addToPlaylist(r.id, [sub.uri], at < 0 ? undefined : at);
  await X.removeFromPlaylist(r.id, [t.uri]);
  r.uris = r.uris.map(u => u === t.uri ? sub.uri : u).filter((u, i, a) => u !== sub.uri || a.indexOf(u) === i);
  r.bad = r.bad.filter(x => x.uri !== t.uri); delete r.fixes[t.uri];
}
async function fixRemove(r, t) {
  snapshot(r);
  await X.removeFromPlaylist(r.id, [t.uri]);
  r.uris = r.uris.filter(u => u !== t.uri); r.bad = r.bad.filter(x => x.uri !== t.uri); delete r.fixes[t.uri];
}
async function fixDups(r) {
  snapshot(r);
  const d = r.dup; let arr = r.uris.slice();
  for (const u of d.near) { await X.removeFromPlaylist(r.id, [u]); arr = arr.filter(x => x !== u); }
  for (const u of d.exact) { const at = arr.indexOf(u); await X.removeFromPlaylist(r.id, [u]); arr = arr.filter(x => x !== u); await X.addToPlaylist(r.id, [u], at); arr.splice(at, 0, u); }
  r.uris = arr; r.dup = { exact: [], near: [], extra: 0 };
}
async function fixGone(r) {
  // Songs Spotify deleted have no ID left to remove them by, so the playlist is rewritten without them.
  snapshot(r);
  await X.rewritePlaylist(r.id, r.uris);
  r.gone = 0; r.allUris = r.uris.slice();
}
async function fixAll(r, { keepBad = false } = {}) {
  for (const t of r.bad.slice()) { const s = r.fixes[t.uri]; if (s) await fixReplace(r, t, s); else if (!keepBad) await fixRemove(r, t); }
  if (r.dup.extra) await fixDups(r);
  if (r.gone) await fixGone(r);
}
async function run(label, fn, r) {
  try {
    if (r) await ensure(r); else for (const x of H.res.list.filter(issues)) await ensure(x);
    await fn();
    save(); draw();
    X.toast(label, r ? { label: 'Undo', run: () => undo(r) } : undefined);
  } catch (e) { if (!X.needsEditPermission(e)) X.toast(`Couldn’t finish: ${e.message}`); draw(); }
}
async function undo(r) {
  const before = H.undo.get(r.id); if (!before) return;
  try { await X.rewritePlaylist(r.id, before); H.undo.delete(r.id); X.toast(`Put ${r.name} back the way it was`); H.res.list = H.res.list.filter(x => x.id !== r.id); save(); scanOne(r.id); }
  catch (e) { X.toast(`Couldn’t undo: ${e.message}`); }
}
async function scanOne(id) {
  const pl = X.editablePlaylists().find(p => p.id === id); if (!pl) return;
  try { const r = await checkOne(pl); for (const t of r.bad) r.fixes[t.uri] = await findFix(t); H.res.list = [...H.res.list.filter(x => x.id !== id), r]; save(); draw(); } catch {}
}
function card(r) {
  const { esc, svg } = X, n = issues(r);
  const rows = r.bad.map(t => {
    const s = r.fixes[t.uri];
    return `<li><div class="hc-song"><b>${esc(t.name)}</b><span>${esc(t.artists.map(a => a.name).join(', '))} · ${esc(t.why)}</span>
      ${s ? `<em>${svg('right')} Plays as: ${esc(s.name)}${s.album?.name ? ` <small>(${esc(s.album.name)})</small>` : ''}</em>` : '<em class="none">No playable version found</em>'}</div>
      <div class="hc-acts">${s ? `<button class="btn ctl" data-hc="replace" data-pl="${esc(r.id)}" data-uri="${esc(t.uri)}">Replace</button>` : ''}<button class="btn ctl ghost" data-hc="remove" data-pl="${esc(r.id)}" data-uri="${esc(t.uri)}">Remove</button></div></li>`;
  }).join('');
  return `<article class="hc" data-id="${esc(r.id)}">
    <header><div class="hc-art">${r.image ? `<img src="${esc(r.image)}" alt="">` : svg('music')}</div><div class="hc-t"><a data-open="playlist:${esc(r.id)}">${esc(r.name)}</a>
      <small>${r.count} songs · ${n} thing${n === 1 ? '' : 's'} to fix</small></div>
      <button class="pill-btn" data-hc="all" data-pl="${esc(r.id)}">${svg('check')} Fix this playlist</button></header>
    ${rows ? `<ul class="hc-list">${rows}</ul>` : ''}
    ${r.dup.extra ? `<div class="hc-line"><span><b>${r.dup.extra}</b> duplicate${r.dup.extra === 1 ? '' : 's'} (the same song more than once${r.dup.near.length ? ', or another release of it' : ''})</span><button class="btn ctl" data-hc="dups" data-pl="${esc(r.id)}">Remove duplicates</button></div>` : ''}
    ${r.gone ? `<div class="hc-line"><span><b>${r.gone}</b> song${r.gone === 1 ? ' is' : 's are'} gone from Spotify completely</span><button class="btn ctl" data-hc="gone" data-pl="${esc(r.id)}" title="Spotify has no ID left for them, so Amplite saves the playlist again without them (the “date added” of its songs resets)">Clean up</button></div>` : ''}
  </article>`;
}
function draw(progressOnly = false) {
  const el = document.getElementById('hcBody'); if (!el) return;
  const st = document.getElementById('hcStatus'), b = document.getElementById('hcScan');
  if (b) { b.disabled = H.busy; b.innerHTML = `${X.svg('refresh')} ${H.res ? 'Check again' : 'Check my playlists'}`; }
  if (st) st.innerHTML = H.busy ? `<span class="nr-spin"></span>Checking ${H.done + 1 > H.total ? H.total : H.done + 1} of ${H.total}${H.cur ? ` · ${X.esc(H.cur)}` : ''}…`
    : H.res ? `${H.res.list.length} playlists checked ${X.since(H.res.at)}${H.res.errors ? ` · ${H.res.errors} couldn’t be read` : ''}` : '';
  if (progressOnly && H.res?.list.length && el.dataset.n == H.res.list.length) return;
  const res = H.res; el.dataset.n = res?.list.length || 0;
  if (!res) { el.innerHTML = `<div class="empty"><h2>Is everything in your playlists still playable?</h2><p>Songs get greyed out when a label pulls them or swaps them for another release. This finds them, along with duplicates, and fixes them.</p></div>`; return; }
  const sick = res.list.filter(r => issues(r)), ok = res.list.filter(r => !issues(r));
  const tot = k => sick.reduce((n, r) => n + (k === 'bad' ? r.bad.length : k === 'dup' ? r.dup.extra : r.gone), 0);
  const fixable = sick.reduce((n, r) => n + r.bad.filter(t => r.fixes[t.uri]).length, 0);
  const many = res.many || [];
  el.innerHTML = `<div class="hc-tiles">
      <div class="hc-tile${tot('bad') ? ' warn' : ''}"><b>${tot('bad')}</b><span>won’t play${fixable ? ` · ${fixable} can be swapped` : ''}</span></div>
      <div class="hc-tile${tot('dup') ? ' warn' : ''}"><b>${tot('dup')}</b><span>duplicates</span></div>
      <div class="hc-tile${tot('gone') ? ' warn' : ''}"><b>${tot('gone')}</b><span>gone from Spotify</span></div>
      <div class="hc-tile good"><b>${ok.length}</b><span>playlist${ok.length === 1 ? '' : 's'} all good</span></div>
      ${sick.length > 1 && !H.busy ? `<button class="btn primary" data-hc="everything">Fix everything</button>` : ''}</div>${H.busy ? '<p class="hc-sofar">So far. Still checking the rest…</p>' : ''}
    ${sick.length ? sick.map(card).join('') : H.busy ? '' : `<div class="empty small"><p>${X.svg('check')} Every playlist is healthy. Nothing to fix.</p></div>`}
    ${many.length ? `<section class="hc-many"><h3>In lots of your playlists</h3><p>Not a problem, just so you know.</p><ol>${many.map(m => `<li><span><b>${X.esc(m.name)}</b> · ${X.esc(m.artist)}</span><em>${m.n} playlists</em></li>`).join('')}</ol></section>` : ''}
    ${ok.length && !H.busy ? `<details class="hc-ok"><summary>${ok.length} healthy playlist${ok.length === 1 ? '' : 's'}</summary><p>${ok.map(r => `<a data-open="playlist:${X.esc(r.id)}">${X.esc(r.name)}</a>`).join(' · ')}</p></details>` : ''}`;
}
export function viewHealth(el, ctx, plId) {
  X = ctx;
  if (!H.res) H.res = X.store.get('health', null);
  el.innerHTML = `<div class="pad nr hcp"><header class="lib-head"><div><h1>Playlist health</h1><p class="nr-sub" id="hcStatus"></p></div>
    <div class="lib-ctl"><button class="pill-btn" id="hcScan"></button></div></header><div id="hcBody"></div></div>`;
  el.querySelector('#hcScan').onclick = () => scan();
  el.querySelector('#hcBody').addEventListener('click', e => {
    const b = e.target.closest('[data-hc]'); if (!b || b.disabled) return;
    const a = b.dataset.hc, r = H.res?.list.find(x => x.id === b.dataset.pl), t = r?.bad.find(x => x.uri === b.dataset.uri);
    b.disabled = true;
    if (a === 'replace' && t) run(`Replaced ${t.name} in ${r.name}`, () => fixReplace(r, t, r.fixes[t.uri]), r);
    else if (a === 'remove' && t) run(`Removed ${t.name} from ${r.name}`, () => fixRemove(r, t), r);
    else if (a === 'dups') run(`Removed duplicates from ${r.name}`, () => fixDups(r), r);
    else if (a === 'gone') run(`Cleaned up ${r.name}`, () => fixGone(r), r);
    else if (a === 'all') run(`Fixed ${r.name}`, () => fixAll(r), r);
    else if (a === 'everything') run('Fixed all your playlists', async () => { for (const x of H.res.list.filter(issues)) await fixAll(x); });
  });
  draw();
  if (plId) { // "Check this playlist" from a playlist's tools menu
    if (!H.res) H.res = { at: Date.now(), list: [], errors: 0 };
    H.busy = true; H.total = 1; H.done = 0; H.cur = ctx.editablePlaylists().find(p => p.id === plId)?.name || ''; draw();
    scanOne(plId).finally(() => { H.busy = false; H.cur = ''; draw(); });
  } else if (!H.res) scan();
}
