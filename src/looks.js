// Looks: whole-app redesigns. Each look restyles everything (type, shapes, sidebar, player, cards; see
// looks.css), comes with its own color palettes, and puts a signature section at the top of Home.
// "stock" is Amplite's own look, where the regular themes apply.

const G = 'https://fonts.googleapis.com/css2?display=swap&family=';

// Palette: bg, panel (sidebar/cards), text, accent (a), second color (b). Everything else is derived.
const P = (name, bg, panel, text, a, b, extra = {}) => ({ name, v: { bg, panel, text, accent: a, a2: b, ...extra } });

export const LOOKS = [
  { id: 'stock', name: 'Amplite', blurb: 'The classic look. Works with every theme.' },
  { id: 'signal', name: 'Signal', blurb: 'Poster type, paper, one loud color.', fonts: 'Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;500;700', ui: "'Space Grotesk'", display: "'Space Grotesk'", mono: "'JetBrains Mono'",
    palettes: [P('Orange', '#f1efe9', '#e8e5dc', '#111111', '#ff4f00', '#2747ff'), P('Ink & lime', '#111111', '#1a1a1a', '#f1efe9', '#d4ff3c', '#ff4f00'), P('Blueprint', '#eef1f6', '#e1e6ee', '#0d1b3d', '#2747ff', '#ff4f00'), P('Red', '#f4f1ea', '#ebe7de', '#161616', '#e10600', '#161616')] },
  { id: 'crate', name: 'Crate', blurb: 'A cozy record store. Warm paper and vinyl.', fonts: 'Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,800;1,9..144,500;1,9..144,700&family=Work+Sans:wght@400;500;600', ui: "'Work Sans'", display: 'Fraunces',
    palettes: [P('Kraft', '#efe6d5', '#e6dbc6', '#2a2019', '#b8432a', '#35594a'), P('Forest', '#e9ecdf', '#dfe3d2', '#1f2a22', '#35594a', '#c2862a'), P('After hours', '#1d1915', '#26201b', '#efe6d5', '#d9a441', '#c2492d'), P('Denim', '#e6e9ee', '#dbe0e8', '#1c2433', '#3f5f8f', '#c2492d')] },
  { id: 'nocturne', name: 'Nocturne', blurb: 'Dark and calm, glowing with the album’s colors.', fonts: 'Manrope:wght@500;600;700;800&family=Inter:wght@400;500;600', ui: 'Inter', display: 'Manrope',
    palettes: [P('Lilac', '#07080c', '#0f1118', '#eef0f6', '#c9bbff', '#f6a6c8'), P('Ember', '#0c0807', '#16100e', '#f6eee9', '#ff9a62', '#ffd27a'), P('Glacier', '#060a0e', '#0d141b', '#eaf3f8', '#7fd4ff', '#a5ffde'), P('Rose', '#0d0709', '#170e12', '#f8eef1', '#ff7aa8', '#c9bbff')] },
  { id: 'marquee', name: 'Marquee', blurb: 'Like a streaming TV app. Big hero, rows to browse.', fonts: 'Anton&family=Inter:wght@400;500;600;700', ui: 'Inter', display: 'Anton',
    palettes: [P('Violet', '#0a0a0c', '#141418', '#ffffff', '#8b5cff', '#ff8a63'), P('Crimson', '#0b0809', '#161012', '#ffffff', '#ff3b5c', '#ffb347'), P('Teal', '#07100f', '#0f1a19', '#ffffff', '#22d3b5', '#8b5cff'), P('Gold', '#0b0a07', '#16140f', '#ffffff', '#f5b82e', '#ff5b3a')] },
  { id: 'pulse', name: 'Pulse', blurb: 'Bright, playful tiles and a floating player.', fonts: 'Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=DM+Sans:wght@400;500;600;700', ui: "'DM Sans'", display: "'Bricolage Grotesque'",
    palettes: [P('Indigo', '#f4f1ff', '#ffffff', '#1a1530', '#4b3cff', '#ff6b4a', { a3: '#ffd23f', a4: '#2ed3a5' }), P('Candy', '#fff2f6', '#ffffff', '#2a1020', '#ff3d8b', '#3db8ff', { a3: '#ffe14d', a4: '#8ce99a' }), P('Mint', '#eefaf5', '#ffffff', '#0f2a22', '#0f9d74', '#ff7a45', { a3: '#ffd23f', a4: '#6c63ff' }), P('Night', '#14121f', '#1d1a2c', '#f4f1ff', '#8b7bff', '#ff6b4a', { a3: '#ffd23f', a4: '#2ed3a5' })] },
  { id: 'headliner', name: 'Headliner', blurb: 'A festival poster of your month.', fonts: 'Oswald:wght@500;600;700&family=Archivo:wght@400;500;600;700', ui: 'Archivo', display: 'Oswald',
    palettes: [P('Teal & orange', '#0b2c2b', '#103736', '#f3e9d2', '#ff6a3d', '#f3e9d2'), P('Purple & gold', '#22123a', '#2b1847', '#fff1d6', '#ffcc33', '#ff6a9a'), P('Black & red', '#111111', '#1b1b1b', '#f3e9d2', '#ff3b2f', '#f3e9d2'), P('Sky & pink', '#e9f2ff', '#dbe8fb', '#14213d', '#ff4f8b', '#14213d')] },
  { id: 'dailyspin', name: 'The Daily Spin', blurb: 'Your music as a newspaper front page.', fonts: 'UnifrakturMaguntia&family=Playfair+Display:wght@700;900&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=Inter:wght@500;600;700', ui: "'Source Serif 4'", display: "'Playfair Display'", mono: 'Inter',
    palettes: [P('Newsprint', '#f2efe6', '#e9e5da', '#151515', '#a50d26', '#151515'), P('Sepia', '#efe3cc', '#e6d8bd', '#2b2014', '#7a3b12', '#2b2014'), P('Night edition', '#141414', '#1d1d1d', '#ece8dd', '#ff5a4a', '#ece8dd'), P('Salmon', '#f7e3d6', '#efd5c5', '#1d1412', '#b3261e', '#1d1412')] },
  { id: 'room', name: 'Listening Room', blurb: 'A turntable, a lamp and your records at night.', fonts: 'Gloock&family=Karla:ital,wght@0,400;0,500;0,700;1,400', ui: 'Karla', display: 'Gloock',
    palettes: [P('Walnut', '#17100c', '#21170f', '#f1e4cf', '#f0a35c', '#c4572c'), P('Oxblood', '#160c0d', '#211214', '#f3e2dc', '#e0605e', '#d9a441'), P('Smoke', '#121314', '#1b1c1e', '#e8e4dc', '#c8a96e', '#8fa7b3'), P('Moss', '#0f130e', '#171c15', '#e7ead9', '#c9b458', '#7ea172')] },
  { id: 'mosaic', name: 'Mosaic', blurb: 'Dark tiles, each tinted by its music.', fonts: 'Sora:wght@500;600;700;800&family=Inter:wght@400;500;600;700', ui: 'Inter', display: 'Sora',
    palettes: [P('Lime', '#0c0c0f', '#18181d', '#f2f2f5', '#d4ff5c', '#f6a6c8'), P('Coral', '#0d0b0b', '#1b1717', '#f5f0ef', '#ff7a59', '#7ee0d2'), P('Ice', '#0a0c10', '#161a21', '#eef3f9', '#7cc4ff', '#d4ff5c'), P('Mono', '#0c0c0c', '#181818', '#f2f2f2', '#ffffff', '#9a9a9a')] },
  { id: 'spotlight', name: 'Spotlight', blurb: 'Cinematic. The album art fills the screen.', fonts: 'Syne:wght@600;700;800&family=Inter:wght@400;500;600;700', ui: 'Inter', display: 'Syne',
    palettes: [P('Ember', '#120708', '#1d0e10', '#ffffff', '#ff8a63', '#ffd2b8'), P('Ocean', '#06111a', '#0d1c28', '#ffffff', '#5ccfff', '#a5ffde'), P('Violet', '#0e0816', '#1a1026', '#ffffff', '#b388ff', '#ff8ad8'), P('Silver', '#0d0d0f', '#18181b', '#ffffff', '#e4e4e7', '#a1a1aa')] },
];
export const lookById = id => LOOKS.find(l => l.id === id) || LOOKS[0];
export const fontsUrl = l => (l.fonts ? G + l.fonts : '');

// Listening numbers the signature sections use, from your play history (newest last).
export function lookStats(items) {
  const now = Date.now() / 1000, d30 = now - 30 * 86400, MS = r => r.ms || r.duration || 210000;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const t0 = today.getTime() / 1000 - 6 * 86400, weekDays = Array(7).fill(0);
  const arts = new Map(), songs = new Map(), days = new Set();
  let week = 0, month = 0, night = 0;
  for (let i = items.length - 1; i >= 0; i--) {
    const r = items[i]; if (!r?.ts) continue;
    if (r.ts < d30 - 400 * 86400) break;
    const day = new Date(r.ts * 1000); days.add(day.toDateString());
    if (r.ts < d30) continue;
    const ms = MS(r); month += ms;
    if (r.ts >= t0) { week += ms; weekDays[Math.min(6, Math.floor((r.ts - t0) / 86400))] += ms; }
    const h = day.getHours(); if (h >= 22 || h < 4) night += ms;
    const an = (r.artists?.[0] || r.artist || '').trim(); if (!an) continue;
    const ak = an.toLowerCase(), A = arts.get(ak) || arts.set(ak, { name: an, id: r.artistIds?.[0] || '', ms: 0, n: 0 }).get(ak);
    A.ms += ms; A.n++; if (!A.id && r.artistIds?.[0]) A.id = r.artistIds[0];
    const sk = ak + '|' + (r.title || '').toLowerCase(), S = songs.get(sk) || songs.set(sk, { title: r.title, artist: an, uri: r.uri || '', album: r.album || '', n: 0 }).get(sk);
    S.n++; if (!S.uri && r.uri) S.uri = r.uri; if (!S.album && r.album) S.album = r.album;
  }
  let streak = 0; for (let t = new Date(); days.has(t.toDateString()); t.setDate(t.getDate() - 1)) streak++;
  const topArtists = [...arts.values()].sort((a, b) => b.ms - a.ms), topSongs = [...songs.values()].sort((a, b) => b.n - a.n);
  const dayNames = Array.from({ length: 7 }, (_, i) => new Date(t0 * 1000 + i * 86400000).toLocaleDateString([], { weekday: 'narrow' }));
  return { weekMin: Math.round(week / 60000), weekDays: weekDays.map(m => Math.round(m / 60000)), dayNames, monthMs: month, nightPct: month ? Math.round(night / month * 100) : 0, topArtists, topSongs, streak, share: topArtists[0] && month ? Math.round(topArtists[0].ms / month * 100) : 0 };
}

const fmt = ms => { const s = Math.max(0, Math.floor((ms || 0) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The now-playing bits inside a signature section update in place when the song changes.
export function paintNp(root, np) {
  if (!root) return;
  root.querySelectorAll('[data-np="title"]').forEach(x => { x.textContent = np?.title || 'Nothing playing'; });
  root.querySelectorAll('[data-np="artist"]').forEach(x => { x.textContent = np?.artist || 'Pick something to play'; });
  root.querySelectorAll('img[data-np="art"]').forEach(x => { if (np?.art) { if (x.getAttribute('src') !== np.art) x.src = np.art; x.hidden = false; } else { x.removeAttribute('src'); x.hidden = true; } });
  root.querySelectorAll('[data-np="play"]').forEach(x => x.classList.toggle('on', !!np && !np.paused));
  root.querySelectorAll('[data-np="like"]').forEach(x => x.classList.toggle('on', !!np?.liked));
  root.querySelectorAll('[data-np="shuffle"]').forEach(x => x.classList.toggle('on', !!np?.shuffle));
  root.querySelectorAll('[data-np="radio"]').forEach(x => x.classList.toggle('on', !!np?.radio));
  root.querySelectorAll('.lk').forEach(x => x.classList.toggle('lk-idle', !np));
}
// Song position and the current lyric line, several times a second.
export function paintTick(root, t) {
  if (!root) return;
  const f = t.d ? Math.min(1, t.p / t.d) : 0;
  root.querySelectorAll('[data-np="bar"]').forEach(x => x.style.setProperty('--p', (f * 100).toFixed(2) + '%'));
  root.querySelectorAll('[data-np="cur"]').forEach(x => { const v = fmt(t.p); if (x.textContent !== v) x.textContent = v; });
  root.querySelectorAll('[data-np="dur"]').forEach(x => { const v = fmt(t.d); if (x.textContent !== v) x.textContent = v; });
  root.querySelectorAll('[data-np="left"]').forEach(x => { const v = '-' + fmt(t.d - t.p); if (x.textContent !== v) x.textContent = v; });
  root.querySelectorAll('[data-np="lyr"]').forEach(x => { const v = t.line || ''; if (x.textContent !== v) x.textContent = v; });
  root.querySelectorAll('[data-np="lyr2"]').forEach(x => { const v = t.next || ''; if (x.textContent !== v) x.textContent = v; });
  root.querySelectorAll('.lk-lyrics').forEach(x => { x.hidden = !t.line && !t.next; });
}
// The queue (and for Spotlight's carousel, the song before) in each look's own style.
export function paintQueue(root, q, prev, X) {
  if (!root) return;
  const items = (q || []).filter(Boolean), cover = t => X.img(t?.album?.images, 64) || '', big = t => X.img(t?.album?.images, 300) || '';
  const by = t => (t?.artists || []).map(a => a.name).join(', ');
  const ph = `<span class="lk-art-ph">${X.svg('music')}</span>`;
  const im = (u, cls = '') => `<span class="lk-qa ${cls}">${u ? `<img src="${e(u)}" alt="" loading="lazy">` : ph}</span>`;
  root.querySelectorAll('[data-np-q]').forEach(box => {
    const kind = box.dataset.npQ, n = +box.dataset.n || 5, list = items.slice(0, n);
    let html = '';
    if (kind === 'carousel') {
      const nx = items.slice(0, 2);
      html = `<span class="lk-c lk-cp2">${prev?.[1] ? im(big(prev[1])) : ''}</span><span class="lk-c lk-cp1">${prev?.[0] ? im(big(prev[0])) : ''}</span>`
        + `<div class="lk-art lk-c0"><img data-np="art" alt="">${ph}</div>`
        + `<span class="lk-c lk-cn1">${nx[0] ? im(big(nx[0])) : ''}</span><span class="lk-c lk-cn2">${nx[1] ? im(big(nx[1])) : ''}</span>`;
    } else if (!list.length) html = `<p class="lk-qempty">${kind === 'set' ? 'No more acts announced.' : 'Nothing queued up.'}</p>`;
    else if (kind === 'list') html = list.map(t => `<button class="lk-q" data-lk="qplay" data-uri="${e(t.uri)}">${im(cover(t))}<span class="lk-qt"><b>${e(t.name)}</b><span>${e(by(t))}</span></span><small>${fmt(t.duration_ms)}</small></button>`).join('');
    else if (kind === 'side') html = list.map((t, i) => `<button class="lk-li" data-lk="qplay" data-uri="${e(t.uri)}"><em>A${i + 2}</em><b>${e(t.name)}</b><span>${e(by(t))}</span><i></i><small>${fmt(t.duration_ms)}</small></button>`).join('');
    else if (kind === 'set') {
      let at = Date.now() + Math.max(0, (X.left || 0));
      html = list.map(t => { const tm = new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); at += t.duration_ms || 0; return `<button class="lk-set" data-lk="qplay" data-uri="${e(t.uri)}"><span>${e(tm)}</span><b>${e((t.artists?.[0]?.name || '').toUpperCase())}</b><small>${e(t.name)}</small></button>`; }).join('');
    } else if (kind === 'covers') html = list.map(t => `<button class="lk-qc" data-lk="qplay" data-uri="${e(t.uri)}">${im(big(t))}<span>${e(t.name)} · ${e(t.artists?.[0]?.name || '')}</span></button>`).join('');
    else if (kind === 'mini') html = list.map(t => `<button class="lk-qm" data-lk="qplay" data-uri="${e(t.uri)}"><span class="lk-qt"><b>${e(t.name)}</b><span>${e(by(t))}</span></span>${im(cover(t))}</button>`).join('');
    box.innerHTML = html;
  });
}

const fmtMin = m => m >= 600 ? `${Math.round(m / 60)} h` : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;

// Signature section at the top of Home for each look.
export function homeHero(id, X) {
  const { esc, svg, greet, first, st } = X, albums = X.albums || [], pls = X.playlists || [];
  const A = st.topArtists, Sg = st.topSongs, month = new Date().toLocaleDateString([], { month: 'long' });
  const btn = (act, icon, label, cls = '', np = '') => `<button class="lk-btn ${cls}" data-lk="${act}" ${np ? `data-np="${np}"` : ''} aria-label="${label}" title="${label}">${svg(icon)}</button>`;
  const playBtn = cls => `<button class="lk-btn lk-play ${cls || ''}" data-lk="play" data-np="play" aria-label="Play or pause" title="Play / pause">${svg('play')}<span class="lk-pause">${svg('pause')}</span></button>`;
  const ctl = (cls = '', extra = false) => `<div class="lk-ctl ${cls}">${extra ? btn('shuffle', 'shuffle', 'Shuffle', 'lk-tog', 'shuffle') : ''}${btn('prev', 'prev', 'Previous')}${playBtn()}${btn('next', 'next', 'Next')}${extra ? btn('like', 'heart', 'Save to Liked Songs', 'lk-tog lk-like', 'like') : ''}</div>`;
  const art = cls => `<div class="lk-art ${cls || ''}"><img data-np="art" alt=""><span class="lk-art-ph">${svg('music')}</span></div>`;
  const npText = (k = 'Now playing') => `<span class="lk-kick">${esc(k)}</span><b class="lk-title" data-np="title"></b><span class="lk-artist" data-np="artist"></span>`;
  const prog = (cls = '') => `<div class="lk-prog ${cls}"><span data-np="cur">0:00</span><i class="lk-bar" data-np="bar"><i></i></i><span data-np="dur">0:00</span></div>`;
  const lyr = (cls = '') => `<div class="lk-lyrics ${cls}" hidden><span class="lk-l1" data-np="lyr"></span><span class="lk-l2" data-np="lyr2"></span></div>`;
  const top5 = Sg.slice(0, 5), hi = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
  const who = first ? `, ${esc(first)}` : '';
  const albumCard = a => `<button class="lk-al" data-lk="album" data-id="${esc(a.id)}" title="${esc(a.name)} · ${esc(a.artist)}"><span class="lk-qa">${a.image ? `<img src="${esc(a.image)}" alt="" loading="lazy">` : `<span class="lk-art-ph">${svg('music')}</span>`}</span><b>${esc(a.name)}</b><span>${esc(a.artist)}</span></button>`;

  if (id === 'signal') {
    const mx = Math.max(1, ...st.weekDays);
    return `<section class="lk lk-signal">
    <div class="lk-l"><h1 class="lk-greet">${esc(greet)}${who}.</h1>
      <div class="lk-npblock">${art()}<div class="lk-npt"><span class="lk-kick">Now playing</span><b class="lk-title" data-np="title"></b><span class="lk-artist" data-np="artist"></span>${prog('lk-mono')}</div></div>
      <div class="lk-row">${`<button class="lk-tbtn lk-main" data-lk="play" data-np="play"><span class="lk-p1">Play</span><span class="lk-p2">Pause</span></button>`}<button class="lk-tbtn" data-lk="next">Next</button><button class="lk-tbtn" data-lk="lyrics">Lyrics</button><button class="lk-tbtn" data-lk="queue">Queue</button></div></div>
    <div class="lk-r"><span class="lk-mono">This week</span>
      <div class="lk-wk"><div class="lk-big"><b>${st.weekMin.toLocaleString()}</b><span class="lk-mono">min</span></div>
        <div class="lk-days" role="img" aria-label="Minutes per day this week">${st.weekDays.map((m, i) => `<span><i style="height:${Math.max(3, Math.round(m / mx * 64))}px" class="${i === 6 ? 'today' : ''}"></i><small>${esc(st.dayNames[i])}</small></span>`).join('')}</div></div>
      <div class="lk-list"><div class="lk-list-h"><span class="lk-mono">Top this month</span><span class="lk-mono">Plays</span></div>
      ${top5.map((s, i) => `<button class="lk-li" data-lk="song" data-uri="${esc(s.uri)}" data-q="${esc(s.artist + ' ' + s.title)}"><span class="lk-mono lk-n">${String(i + 1).padStart(2, '0')}</span><b>${esc(s.title)}</b><span>${esc(s.artist)}</span><span class="lk-mono">${s.n}</span></button>`).join('') || '<p class="muted">Play some music and your top songs show up here.</p>'}</div></div>
    <div class="lk-made"><div class="lk-list-h"><span class="lk-mono">Made for you</span></div><div class="lk-blocks">
      <button class="lk-blk b1" data-lk="discover"><span class="lk-mono">Fresh Mondays</span><b>Discover<br>Mix</b></button>
      <button class="lk-blk b2" data-lk="releases"><span class="lk-mono">From artists you follow</span><b>New<br>releases</b></button>
      <button class="lk-blk b3" data-lk="${A[0]?.id ? 'artist' : 'stats'}" data-id="${esc(A[0]?.id || '')}"><span class="lk-mono">Your #1 lately</span><b>${esc(hi(A[0]?.name || 'Your stats', 18))}</b></button>
      <button class="lk-blk b4" data-lk="timeline"><span class="lk-mono">Month by month</span><b>Your<br>timeline</b></button>
      <button class="lk-blk b5" data-lk="stats"><span class="lk-mono">${new Date().getFullYear()}</span><b>Your<br>stats</b></button></div></div></section>`;
  }

  if (id === 'crate') return `<section class="lk lk-crate">
    <div class="lk-deck"><div class="lk-vinyl"><i></i></div>${art('lk-sleeve')}</div>
    <div class="lk-notes"><span class="lk-kick">Now spinning</span><b class="lk-title" data-np="title"></b><span class="lk-artist" data-np="artist"></span>
      ${prog('lk-thumb')}
      <div class="lk-ctl">${btn('prev', 'prev', 'Previous')}<button class="lk-tbtn lk-main" data-lk="play" data-np="play"><span class="lk-p1">Drop the needle</span><span class="lk-p2">Lift the needle</span></button>${btn('next', 'next', 'Next')}<button class="lk-tbtn lk-shelve" data-lk="like" data-np="like"><span class="lk-p1">Shelve it</span><span class="lk-p2">On your shelf ✓</span></button></div>
      <span class="lk-kick lk-mt">Up next on side A</span><div data-np-q="side" data-n="3"></div></div>
    <div class="lk-dig"><h2>Dig the crate</h2><span>Your records, spine out. Pull one to play it.</span></div>
    <div class="lk-spines">${(albums.length ? albums : Sg.slice(0, 26).map(s => ({ name: s.album || s.title }))).slice(0, 26).map((a, i) => `<button ${a.id ? `data-lk="album" data-id="${esc(a.id)}"` : ''} title="${esc(a.name)}${a.artist ? ' · ' + esc(a.artist) : ''}" style="--h:${150 + (i * 37) % 50}px;--w:${36 + (i * 7) % 14}px;--c:${i % 4}"><span>${esc(hi(a.name, 26))}</span></button>`).join('')}</div></section>`;

  if (id === 'nocturne') return `<section class="lk lk-nocturne"><div class="lk-main">
    <div class="lk-top">${art()}
    <div class="lk-npt">${npText('Now playing')}${lyr()}
      <div class="lk-wprog"><span data-np="cur">0:00</span><div class="lk-wave" data-np="bar" aria-hidden="true">${[0, 1].map(k => `<div class="lk-w${k}">${Array.from({ length: 60 }, (_, i) => `<i style="--h:${8 + Math.round(Math.abs(Math.sin(i * 0.61) * Math.cos(i * 0.17)) * 30 + (i % 5) * 1.5)}px"></i>`).join('')}</div>`).join('')}</div><span data-np="dur">0:00</span></div>
      <div class="lk-ctl">${btn('shuffle', 'shuffle', 'Shuffle', 'lk-tog', 'shuffle')}${btn('prev', 'prev', 'Previous')}${playBtn('big')}${btn('next', 'next', 'Next')}<span class="flex1"></span>${btn('like', 'heart', 'Save to Liked Songs', 'lk-tog lk-like lk-ring', 'like')}<button class="lk-tbtn" data-lk="lyrics">Lyrics</button>${btn('full', 'expand', 'Full screen', 'lk-ring')}</div></div></div>
    ${albums.length ? `<div class="lk-rot"><div class="lk-rot-h"><h2>Your rotation</h2><span>What you keep coming back to</span></div><div class="lk-rot-grid">${albums.slice(0, 6).map(albumCard).join('')}</div></div>` : ''}</div>
    <aside class="lk-upnext"><div class="lk-un-h"><h2>Up next</h2></div><div data-np-q="list" data-n="7"></div>
      <button class="lk-keep" data-lk="radio" data-np="radio"><span><b>Keep the music going</b><small>Similar songs when the queue ends</small></span><i class="lk-sw"></i></button></aside></section>`;

  if (id === 'marquee') {
    const a = A[0];
    return `<section class="lk lk-marquee"><div class="lk-mq-bg" aria-hidden="true"></div>
      <div class="lk-mq-text"><span class="lk-badge">${a ? 'Your artist of the month' : 'Welcome to Amplite'}</span><h1>${esc(a?.name || 'Press play')}</h1>
      <p>${a ? `${st.share}% of everything you played lately. ${a.n.toLocaleString()} plays in the last 30 days.` : 'Play some music and your top artist takes over this banner.'}</p>
      <div class="lk-row">${a ? `<button class="lk-tbtn lk-main" data-lk="${a.id ? 'artist' : 'search'}" data-id="${esc(a.id)}" data-q="${esc(a.name)}">${svg('play')} Go to ${esc(a.name)}</button>` : ''}<button class="lk-tbtn" data-lk="stats">Your stats</button><button class="lk-tbtn" data-lk="releases">New releases</button></div></div>
      <div class="lk-mq-np">${art()}<div class="lk-mq-t">${npText('Now playing')}${prog()}</div>${playBtn()}</div></section>
      ${A.length > 1 ? `<section class="lk lk-mq-row"><h2>More from your rotation</h2><div class="lk-mq-art">${A.slice(1, 11).map(x => `<button data-lk="${x.id ? 'artist' : 'search'}" data-id="${esc(x.id)}" data-q="${esc(x.name)}"><span>${esc(x.name)}</span></button>`).join('')}</div></section>` : ''}`;
  }

  if (id === 'pulse') return `<section class="lk lk-pulse">
    <h1 class="lk-greet">Hey${who ? ' ' + esc(first) : ''}, ${st.nightPct >= 40 ? 'it’s a <mark>late-night</mark> kind of mood.' : `here’s your <mark>${esc(month)}</mark> so far.`}</h1>
    <div class="lk-bento">
      <div class="lk-tile lk-t1"><span class="lk-sticker">${A[0] ? 'On repeat' : 'Hi!'}</span>${art()}<div class="lk-npt">${npText('Now playing')}</div>${prog()}${ctl('', true)}</div>
      <div class="lk-tile lk-t2"><span class="lk-kick">This week</span><b class="lk-num">${fmtMin(st.weekMin)}</b><span>of music</span><div class="lk-mini">${st.weekDays.map((m, i) => `<i style="--v:${Math.max(0.06, m / Math.max(1, ...st.weekDays)).toFixed(2)}" class="${i === 6 ? 'today' : ''}"></i>`).join('')}</div></div>
      <div class="lk-tile lk-t3"><span class="lk-kick">Streak</span><b class="lk-num">${st.streak}</b><span>day${st.streak === 1 ? '' : 's'} in a row</span></div>
      <button class="lk-tile lk-t4" data-lk="discover"><span class="lk-sticker">Fresh Mondays</span><span class="lk-kick">Made for you</span><b class="lk-num">Discover Mix</b><span>New artists picked from the ones you love</span></button>
      <div class="lk-tile lk-t5"><span class="lk-kick">Up next</span><div data-np-q="list" data-n="3"></div></div>
      <div class="lk-tile lk-t6"><span class="lk-kick">Your top artists lately</span><div class="lk-chips">${A.slice(0, 8).map((a, i) => `<button class="lk-chip${i ? '' : ' on'}" data-lk="${a.id ? 'artist' : 'search'}" data-id="${esc(a.id)}" data-q="${esc(a.name)}">${esc(a.name)}</button>`).join('') || '<span>Nothing yet</span>'}</div></div>
    </div></section>`;

  if (id === 'headliner') {
    const tiers = [[0, 1, 120], [1, 4, 54], [4, 8, 36], [8, 13, 27], [13, 19, 21]];
    const lines = tiers.map(([a, b]) => A.slice(a, b)).filter(x => x.length).map((names, i) => `<div class="lk-line" style="--s:${tiers[i][2]}px">${names.map(n => `<button data-lk="${n.id ? 'artist' : 'search'}" data-id="${esc(n.id)}" data-q="${esc(n.name)}">${esc(n.name)}</button>`).join('<i>·</i>')}</div>`).join('');
    return `<section class="lk lk-headliner"><div class="lk-poster">
      <span class="lk-kick">${esc(month)} ${new Date().getFullYear()} · your headphones · all month</span><span class="lk-who">${first ? esc(first.toUpperCase()) + '’S' : 'YOUR'} LINEUP</span><i class="lk-rule"></i>
      ${lines || '<div class="lk-line" style="--s:60px"><button>Your lineup</button></div><p>Play some music and your top artists get top billing.</p>'}
      ${A.length > 19 ? `<span class="lk-more">+ ${A.length - 19} more artists you played this month</span>` : ''}
      <div class="lk-row"><button class="lk-tbtn lk-main" data-lk="stats">See the full lineup</button><button class="lk-tbtn" data-lk="wrapped">Your Wrapped</button></div></div>
      <div class="lk-side"><div class="lk-ticket"><div class="lk-npt">${npText('Now on stage')}${prog()}${ctl()}</div><span class="lk-stub" aria-hidden="true">ADMIT ONE</span></div>
      <div class="lk-sets"><span class="lk-kick">Set times · up next</span><div data-np-q="set" data-n="7"></div></div></div></section>`;
  }

  if (id === 'dailyspin') {
    const s = Sg[0], date = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    return `<section class="lk lk-dailyspin">
      <div class="lk-mast"><span>Your edition · free</span><b>The Daily Spin</b><span>${esc(date)}</span></div>
      <div class="lk-cols">
        <article class="lk-lead"><span class="lk-kick">Lead story</span>
          <h1>${s ? `“${esc(s.title)}” Reaches ${s.n} Plays This Month; Listener Shows No Sign of Stopping` : 'Local Listener Yet to Press Play; Editors Hopeful'}</h1>
          <p>${s ? `${esc(s.artist)} tops this month’s chart. ${A[0] ? `${esc(A[0].name)} was ${st.share}% of everything played, ` : ''}and ${st.nightPct}% of the listening happened after 10 pm, sources confirm.` : 'More news as it happens.'}</p>
          <div class="lk-np">${art()}<div class="lk-np-t">${npText('Now playing')}${prog()}</div>${ctl()}</div>
          <div class="lk-row"><button class="lk-tbtn" data-lk="lyrics">Read the lyrics</button><button class="lk-tbtn" data-lk="queue">Coming up</button></div></article>
        <div class="lk-side"><span class="lk-kick">The numbers</span>
          <div class="lk-fig"><b>${st.weekMin.toLocaleString()}</b><span>minutes this week</span></div>
          <div class="lk-fig"><b>${A.length}</b><span>artists in the last 30 days</span></div>
          <div class="lk-fig"><b>${st.nightPct}%</b><span>of plays after 10 pm</span></div>
          <div class="lk-fig"><b>${st.streak}</b><span>day listening streak</span></div></div>
        <div class="lk-side"><span class="lk-kick">The charts</span>${top5.map((x, i) => `<button class="lk-li" data-lk="song" data-uri="${esc(x.uri)}" data-q="${esc(x.artist + ' ' + x.title)}"><b>${i + 1}. ${esc(x.title)}</b><span>${esc(x.artist)} · ${x.n} plays</span></button>`).join('') || '<p>No charts yet.</p>'}
          <span class="lk-kick lk-mt">Up next</span><div data-np-q="side" data-n="3"></div></div>
      </div>
      ${pls.length ? `<div class="lk-ads"><span class="lk-kick">Classifieds</span>${pls.slice(0, 5).map(p => `<button class="lk-ad" data-lk="playlist" data-id="${esc(p.id)}"><b>${esc(p.name.toUpperCase())}</b><span>${(p.items?.total ?? p.tracks?.total) ? `${(p.items?.total ?? p.tracks?.total)} songs. ` : ''}${p.owner?.id === X.me ? 'Your playlist.' : 'Ask for it by name.'}</span></button>`).join('')}</div>` : ''}</section>`;
  }

  if (id === 'room') return `<section class="lk lk-room"><div class="lk-room-top">
    <div class="lk-table" aria-hidden="true"><div class="lk-platter"><div class="lk-rec"><div class="lk-label">${art()}</div></div></div><i class="lk-arm"></i></div>
    <div class="lk-npt"><span class="lk-kick">On the platter</span><b class="lk-title" data-np="title"></b><span class="lk-artist" data-np="artist"></span>
      <p class="lk-quote lk-lyrics" hidden>“<span data-np="lyr"></span>”</p>
      ${prog('lk-thumb')}
      <div class="lk-ctl round">${btn('prev', 'prev', 'Previous')}${playBtn()}${btn('next', 'next', 'Next')}<span class="flex1"></span><button class="lk-tbtn" data-lk="next">Flip to side B</button>${btn('like', 'heart', 'Save to Liked Songs', 'lk-tog lk-like lk-ring', 'like')}</div></div></div>
    ${albums.length ? `<div class="lk-shelf-h"><h2>Face out this week</h2><span>records you keep reaching for</span></div><div class="lk-shelf">${albums.slice(0, 8).map((a, i) => `<button class="lk-rec-out" data-lk="album" data-id="${esc(a.id)}" style="--r:${[-2, 1.5, -1, 2, -1.5, 1, -2.5, 1.5][i]}deg"><span class="lk-qa">${a.image ? `<img src="${esc(a.image)}" alt="" loading="lazy">` : ''}</span><small>${esc(a.name)} · ${esc(a.artist)}</small></button>`).join('')}</div>` : ''}</section>`;

  if (id === 'mosaic') return `<section class="lk lk-mosaic">
    <div class="lk-tile lk-t1"><div class="lk-np">${art()}<div class="lk-npt">${npText('Now playing')}</div></div>${prog()}${ctl('', true)}</div>
    <button class="lk-tile lk-t2" data-lk="discover"><span class="lk-kick">New this Monday</span><b>Discover Mix</b><span>New artists picked from the ones you love</span><span class="lk-go">Play the mix</span></button>
    <div class="lk-tile lk-t3"><span class="lk-kick">This week</span><b class="lk-num">${fmtMin(st.weekMin)}</b></div>
    <div class="lk-tile lk-t6"><div class="lk-tile-h"><b>Up next</b><button data-lk="queue">See all</button></div><div data-np-q="covers" data-n="4"></div></div>
    <div class="lk-tile lk-t4"><span class="lk-kick">Top artist lately</span><b>${esc(A[0]?.name || '—')}</b><span>${A[0] ? `${A[0].n} plays · ${st.share}% of your listening` : 'Play some music'}</span></div>
    <button class="lk-tile lk-t7" data-lk="releases"><span class="lk-kick">Out Friday</span><b>New releases</b><span>From artists you follow</span></button>
    <div class="lk-tile lk-t5"><span class="lk-kick">Streak</span><b class="lk-num">${st.streak}d</b></div></section>`;

  if (id === 'spotlight') return `<section class="lk lk-spotlight">
    <div class="lk-carousel" data-np-q="carousel">${art('lk-c0')}</div>
    <b class="lk-title" data-np="title"></b><span class="lk-artist" data-np="artist"></span>
    ${prog()}
    ${ctl('big', true)}
    <div class="lk-sp-foot">${lyr('lk-sp-lyr')}<div class="lk-sp-next"><span class="lk-kick">Coming up</span><div data-np-q="mini" data-n="3"></div></div></div></section>`;

  return '';
}
