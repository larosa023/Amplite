// Friends: what your friends are playing right now (through their Last.fm), and how your taste
// compares with theirs, with a "You & them" playlist of what you both love. Loaded only when opened.
let X = null, timer = null;
const lf = (op, user, extra = {}) => window.amplite.lastfm('user', { op, user, ...extra }).then(r => { if (!r?.ok) throw new Error(r?.error || 'Last.fm didn’t answer'); return r.data; });
const key = s => (s || '').toLowerCase().replace(/^the\s+/, '').replace(/\s*[([].*?[)\]]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
const friends = () => (X.store.get('friends', []) || []).filter(Boolean);
const NOW = new Map(), INFO = new Map(), COMPAT = new Map();
const ago = ts => { const m = Math.round((Date.now() / 1000 - ts) / 60); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

function card(u) {
  const { esc, svg } = X, n = NOW.get(u.toLowerCase()), i = INFO.get(u.toLowerCase()) || {}, c = COMPAT.get(u.toLowerCase());
  return `<article class="fr-card" data-user="${esc(u)}">
    <header><span class="fr-av">${i.image ? `<img src="${esc(i.image)}" alt="">` : esc(u[0].toUpperCase())}</span>
      <div class="fr-who"><b>${esc(i.real || u)}</b><small>${i.real ? esc(u) + ' · ' : ''}${i.plays ? `${i.plays.toLocaleString()} scrobbles` : 'Last.fm'}</small></div>
      <button class="icon-btn fr-x" data-fr="remove" title="Remove ${esc(u)}">${svg('x')}</button></header>
    ${n ? `<div class="fr-now${n.now ? ' live' : ''}">${n.image ? `<img src="${esc(n.image)}" alt="">` : `<span class="ph">${svg('music')}</span>`}
      <div><small>${n.now ? '<i></i>Listening now' : `Played ${ago(n.ts)}`}</small><b>${esc(n.title)}</b><span>${esc(n.artist)}</span></div>
      <button class="icon-btn" data-fr="play" title="Play it here">${svg('play')}</button></div>` : `<div class="fr-now empty">${NOW.has(u.toLowerCase()) ? 'Nothing played yet' : 'Loading…'}</div>`}
    <div class="fr-compat" id="fc-${esc(u.toLowerCase())}">${c ? compatHTML(u, c) : `<button class="btn ctl" data-fr="compat">${svg('heart')} How do our tastes match?</button>`}</div>
  </article>`;
}
function level(p) { return p >= 60 ? 'Super' : p >= 40 ? 'Very high' : p >= 25 ? 'High' : p >= 12 ? 'Medium' : p >= 5 ? 'Low' : 'Very low'; }
function compatHTML(u, c) {
  const { esc } = X;
  if (c.loading) return '<div class="loading small"><span></span><span></span><span></span></div>';
  if (c.error) return `<p class="muted">${esc(c.error)}</p>`;
  const R = 26, L = 2 * Math.PI * R;
  return `<div class="fr-score"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${R}" class="trk"/><circle cx="32" cy="32" r="${R}" class="val" style="stroke-dasharray:${(L * c.score / 100).toFixed(1)} ${L.toFixed(1)}"/></svg><b>${c.score}%</b></div>
    <div class="fr-ctext"><b>${level(c.score)} compatibility</b><p>${c.shared.length ? `You both like ${c.shared.slice(0, 4).map(a => `<em>${esc(a)}</em>`).join(', ')}${c.shared.length > 4 ? ` and ${c.shared.length - 4} more` : ''}.` : 'No artists in common yet.'}</p>
      ${c.both.length ? `<p class="muted">${c.both.length} song${c.both.length === 1 ? '' : 's'} you both play a lot.</p>` : ''}
      <button class="btn ctl" data-fr="mix" ${c.both.length + c.tryThese.length ? '' : 'disabled'}>Make “You &amp; ${esc(INFO.get(u.toLowerCase())?.real?.split(' ')[0] || u)}” playlist</button></div>`;
}
// Overlap of your top artists (each weighted by how much of your listening they are), 0–100.
async function compat(u) {
  const k = u.toLowerCase(); COMPAT.set(k, { loading: true }); paint(u);
  try {
    const [ma, fa, mt, ft] = await Promise.all([lf('artists', 'me'), lf('artists', u), lf('tracks', 'me'), lf('tracks', u)]);
    const share = list => { const t = list.reduce((s, x) => s + x.n, 0) || 1, m = new Map(); list.forEach(x => m.set(key(x.name), { name: x.name, w: x.n / t })); return m; };
    const A = share(ma), B = share(fa);
    let s = 0; const shared = [];
    for (const [k2, v] of A) { const o = B.get(k2); if (o) { s += Math.min(v.w, o.w); shared.push({ name: v.name, w: v.w + o.w }); } }
    const score = Math.round(Math.min(1, s * 1.25) * 100); // a 50% overlap of listening already reads as "Super"
    const mine = new Map(mt.map(x => [key(x.artist) + '|' + key(x.title), x]));
    const both = ft.filter(x => mine.has(key(x.artist) + '|' + key(x.title))).slice(0, 30);
    // Their favourites by artists you both like, that you haven't been playing.
    const sharedSet = new Set(shared.map(x => key(x.name)));
    const tryThese = ft.filter(x => sharedSet.has(key(x.artist)) && !mine.has(key(x.artist) + '|' + key(x.title))).slice(0, 20);
    COMPAT.set(k, { score, shared: shared.sort((a, b) => b.w - a.w).map(x => x.name), both, tryThese });
  } catch (e) { COMPAT.set(k, { error: e.message === 'nokey' ? 'Needs a Last.fm API key (Settings → Connections).' : e.message.includes('User not found') ? 'Last.fm doesn’t know that user.' : e.message }); }
  paint(u);
}
async function mix(u, btn) {
  const c = COMPAT.get(u.toLowerCase()); if (!c) return;
  btn.disabled = true; const t = btn.textContent; btn.textContent = 'Finding the songs…';
  try {
    const want = [...c.both, ...c.tryThese].slice(0, 50), uris = [];
    for (const s of want) { const r = await X.resolveRec(s.artist, s.title).catch(() => null); if (r?.uri && !uris.includes(r.uri)) uris.push(r.uri); if (X.rateLimited()) break; }
    if (!uris.length) { X.toast('Couldn’t find those songs on Spotify right now.'); return; }
    const who = INFO.get(u.toLowerCase())?.real?.split(' ')[0] || u, name = `You & ${who}`;
    const pl = await X.api('/me/playlists', { method: 'POST', body: { name, description: `Songs you and ${who} both love, plus a few of theirs to try. Made by Amplite.`, public: false } });
    await X.api(`/playlists/${pl.id}/items`, { method: 'POST', body: { uris } });
    X.refreshPlaylists();
    X.toast(`Saved “${name}” (${uris.length} songs)`, { label: 'Open', run: () => X.navigate('playlist', pl.id) });
  } catch (e) { if (!X.needsEditPermission(e)) X.toast(e.message); }
  finally { btn.disabled = false; btn.textContent = t; }
}
function paint(u) {
  const el = document.querySelector(`.fr-card[data-user="${CSS.escape(u)}"]`); if (el) el.outerHTML = card(u);
}
async function refresh(all = false) {
  await Promise.all(friends().map(async u => {
    const k = u.toLowerCase();
    try { NOW.set(k, await lf('now', u)); } catch { NOW.set(k, null); }
    if (all || !INFO.has(k)) try { INFO.set(k, await lf('info', u)); } catch {}
    paint(u);
  }));
}
function draw(el) {
  const { esc, svg } = X, list = friends();
  el.querySelector('#frList').innerHTML = list.length ? list.map(card).join('') : `<div class="empty small"><p>Add a friend by their Last.fm username to see what they’re listening to.</p></div>`;
}
export async function viewFriends(el, ctx, alive) {
  X = ctx;
  const st = await window.amplite.lastfm('state').then(r => r?.state).catch(() => null);
  if (!alive()) return;
  if (!st?.key) { el.innerHTML = `<div class="pad nr"><header class="lib-head"><div><h1>Friends</h1></div></header><div class="empty"><h2>Friends uses Last.fm</h2><p>Add your Last.fm API key in Settings → Connections. Then you can follow friends by their Last.fm username, see what they’re playing, and compare your taste.</p></div></div>`; return; }
  el.innerHTML = `<div class="pad nr fr"><header class="lib-head"><div><h1>Friends</h1><p class="nr-sub">What your friends are playing, through Last.fm${st.user ? ` · you’re ${esc(st.user)}` : ''}</p></div>
      <form class="fr-add" id="frAdd"><input id="frName" placeholder="Last.fm username" maxlength="15" spellcheck="false" autocomplete="off"><button class="btn primary">Add friend</button></form></header>
    <div id="frSugg" class="fr-sugg"></div><div id="frList" class="fr-grid"></div></div>`;
  function esc(s) { return X.esc(s); }
  draw(el);
  const add = async name => {
    name = name.trim(); if (!name) return;
    if (friends().some(f => f.toLowerCase() === name.toLowerCase())) return X.toast(`${name} is already here.`);
    try { const i = await lf('info', name); INFO.set(i.name.toLowerCase(), i); X.store.set('friends', [...friends(), i.name]); draw(el); refresh(); sugg(); }
    catch (e) { X.toast(/not found/i.test(e.message) ? `Last.fm doesn’t know “${name}”.` : e.message); }
  };
  el.querySelector('#frAdd').onsubmit = e => { e.preventDefault(); const i = el.querySelector('#frName'); add(i.value).then(() => { i.value = ''; }); };
  el.addEventListener('click', e => {
    const s = e.target.closest('[data-fr-add]'); if (s) { add(s.dataset.frAdd); return; }
    const b = e.target.closest('[data-fr]'); if (!b) return;
    const u = b.closest('.fr-card')?.dataset.user; if (!u) return;
    const a = b.dataset.fr;
    if (a === 'remove') { X.store.set('friends', friends().filter(f => f !== u)); draw(el); sugg(); }
    else if (a === 'compat') compat(u);
    else if (a === 'mix') mix(u, b);
    else if (a === 'play') { const n = NOW.get(u.toLowerCase()); if (n) X.resolveRec(n.artist, n.title).then(t => t?.uri ? X.playUris([t.uri]) : X.toast('Couldn’t find that song on Spotify.')); }
  });
  // Your Last.fm friends you haven't added here yet.
  async function sugg() {
    const box = el.querySelector('#frSugg'); if (!box || !st.user) return;
    const have = new Set(friends().map(f => f.toLowerCase()));
    const list = (await lf('friends').catch(() => [])).filter(f => !have.has(f.name.toLowerCase())).slice(0, 8);
    box.innerHTML = list.length ? `<span>Your Last.fm friends:</span>${list.map(f => `<button class="fr-chip" data-fr-add="${X.esc(f.name)}">${f.image ? `<img src="${X.esc(f.image)}" alt="">` : ''}${X.esc(f.name)} <b>+</b></button>`).join('')}` : '';
  }
  sugg(); refresh(true);
  clearInterval(timer);
  timer = setInterval(() => { if (!alive()) return clearInterval(timer); if (!document.hidden) refresh(); }, 45000);
}
