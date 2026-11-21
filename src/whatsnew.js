// "What's new" after an update: the notes for every version since the one you last saw.
// Newest first. Each item: [text, optional page to open].
export const NOTES = {
  '1.24.0': [
    ['Stats, Timeline and Wrapped open several times faster with a long history, and Amplite uses less memory'],
    ['Amplite checks Spotify half as often while its own engine is playing (the engine says when a song changes)'],
    ['The sidebar is grouped and tighter, and you can hide items you don’t use (right-click one, or Settings → General → Sidebar)'],
    ['Back and Forward take you to the same spot on the page'],
    ['A clear outline shows where you are when using the keyboard'],
  ],
  '1.23.0': [
    ['Amplite Wrapped: your year as a story, with a top 50 playlist and slides you can share', 'wrapped'],
    ['Friends: what your Last.fm friends are playing, and how your taste compares', 'friends:'],
    ['Stats: your day (mornings vs late nights), skips, albums you play all the way through, a genre map and year vs year', 'stats:'],
    ['Mini amp “Album art” skin that takes its colors from the cover (Settings → Mini Amp)'],
    ['Click the tray icon for quick controls without opening Amplite (double-click opens it)'],
    ['Drag songs, albums, playlists and artists into Discord or a chat to share their link'],
    ['Settings → About → Save diagnostics: one file with everything needed to sort out a problem'],
  ],
  '1.22.0': [
    ['Timeline: every month of your listening, “on this day”, and a full Last.fm import', 'timeline:'],
    ['Playlist health: finds songs that won’t play and duplicates, and fixes them', 'health:'],
    ['Themes: “From album art”, a theme maker, and day and night themes'],
  ],
};
const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
export function notesSince(seen, cur) {
  return Object.keys(NOTES).filter(v => (!seen || cmp(v, seen) > 0) && cmp(v, cur) <= 0).sort((a, b) => cmp(b, a));
}
export function showNotes(ctx, versions, cur) {
  if (!versions.length) return;
  document.getElementById('wnCard')?.remove();
  const el = document.createElement('div'); el.id = 'wnCard'; el.className = 'wn'; el.setAttribute('role', 'dialog');
  el.innerHTML = `<header><div><small>Updated to ${ctx.esc(cur)}</small><h3>What’s new in Amplite</h3></div><button class="icon-btn" data-wn="close" title="Close">${ctx.svg('x')}</button></header>
    <div class="wn-body">${versions.map((v, i) => `${versions.length > 1 ? `<h4>${ctx.esc(v)}</h4>` : ''}<ul>${NOTES[v].map(([t, go]) => `<li>${go ? `<a data-wn-go="${ctx.esc(go)}">${ctx.esc(t)}</a>` : ctx.esc(t)}</li>`).join('')}</ul>`).join('')}</div>
    <footer><button class="btn primary" data-wn="close">Got it</button></footer>`;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const close = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); };
  el.onclick = e => {
    if (e.target.closest('[data-wn="close"]')) return close();
    const g = e.target.closest('[data-wn-go]'); if (!g) return;
    close(); const to = g.dataset.wnGo;
    if (to === 'wrapped') ctx.openWrapped(); else { const [n, a] = to.split(':'); ctx.navigate(n, a || ''); }
  };
}
