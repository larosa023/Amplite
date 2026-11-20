// Theme maker: pick a few colors, a font and corners, see the whole app change live, save it as
// your own theme. Themes export to / import from small .amptheme files (JSON) you can share.
let X = null, draft = null, before = null, editing = null;

const PICKS = [['bg', 'Background'], ['panel', 'Sidebar & panels'], ['elev', 'Cards & menus'], ['text', 'Text'], ['muted', 'Secondary text'], ['accent', 'Accent'], ['viz-mid', 'Visualizer middle'], ['viz-hi', 'Visualizer top']];
const isHex = v => /^#[0-9a-f]{6}$/i.test(v || '');
const toHex = v => {
  v = String(v || '').trim();
  if (isHex(v)) return v.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) return ('#' + [...v.slice(1)].map(c => c + c).join('')).toLowerCase();
  const m = /^rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(v); if (m) return '#' + m.slice(1, 4).map(n => (+n).toString(16).padStart(2, '0')).join('');
  return '';
};
// Start from the theme you're looking at.
function fromScreen() {
  const cs = getComputedStyle(document.documentElement), v = {};
  for (const k of X.THEME_KEYS) { const h = toHex(cs.getPropertyValue('--' + k)); if (h) v[k] = h; }
  return v;
}
function preview() {
  const full = X.deriveTheme(clean(draft.vars));
  X.setThemeStyle(X.themeCss(full, draft.font, draft.square));
  document.documentElement.dataset.theme = 'custom';
  document.documentElement.classList.toggle('square', !!draft.square);
  document.documentElement.classList.remove('theme-glide');
}
// Only the colors you set; the rest are worked out each time (so changing the background updates hovers etc.).
function clean(v) { const o = {}; for (const [k, val] of Object.entries(v)) if (isHex(val)) o[k] = val; return o; }
function draw() {
  const el = document.getElementById('tmDlg'), full = X.deriveTheme(clean(draft.vars));
  el.querySelectorAll('[data-tm]').forEach(i => { i.value = full[i.dataset.tm] || '#000000'; i.closest('label').classList.toggle('auto', !draft.vars[i.dataset.tm]); });
  el.querySelector('#tmFont').value = draft.font || '';
  el.querySelector('#tmSquare').checked = !!draft.square;
  el.querySelector('#tmName').value = draft.name;
  el.querySelector('#tmDelete').hidden = !editing;
  el.querySelector('#tmExport').hidden = !X.saveText;
}
function close(keep) {
  const el = document.getElementById('tmDlg'); el.classList.add('hidden');
  document.removeEventListener('keydown', onKey, true);
  if (!keep) X.applyTheme(before, { save: false });
}
const onKey = e => { if (e.key === 'Escape' && !document.getElementById('tmDlg')?.classList.contains('hidden')) { e.stopPropagation(); close(false); } };
export function openThemeMaker(ctx, id) {
  X = ctx; before = ctx.current();
  const t = id && ctx.customThemes().find(x => x.id === id);
  editing = t ? t.id : null;
  if (t) draft = { name: t.name, vars: { ...t.vars }, font: t.font || '', square: !!t.square };
  else { const v = fromScreen(); draft = { name: 'My theme', vars: { bg: v.bg, panel: v.panel, elev: v.elev, text: v.text, muted: v.muted, accent: v.accent, 'viz-mid': v['viz-mid'], 'viz-hi': v['viz-hi'] }, font: '', square: false }; }
  let el = document.getElementById('tmDlg');
  if (!el) { el = document.createElement('div'); el.id = 'tmDlg'; el.className = 'modal hidden tm-modal'; el.setAttribute('role', 'dialog'); document.body.append(el); }
  const { esc, svg } = ctx;
  el.innerHTML = `<div class="modal-card tm-card">
    <header class="modal-head"><h2>${t ? 'Edit theme' : 'New theme'}</h2><button type="button" class="round-btn" data-tm-close title="Close (Esc)">${svg('x')}</button></header>
    <div class="tm-body">
      <label class="tm-name">Name<input id="tmName" maxlength="40" spellcheck="false"></label>
      <p class="tm-hint">Everything changes live behind this window while you edit.</p>
      <div class="tm-colors">${PICKS.map(([k, n]) => `<label><input type="color" data-tm="${k}"><span>${n}</span><button type="button" class="tm-auto" data-tm-auto="${k}" title="Work it out from the other colors">auto</button></label>`).join('')}</div>
      <div class="tm-row"><label>Font<select id="tmFont">${ctx.FONTS.map(([v, n]) => `<option value="${esc(v)}">${esc(n)}</option>`).join('')}</select></label>
        <label class="tm-check"><input type="checkbox" id="tmSquare"> Square corners</label></div>
      <div class="tm-quick"><span>Quick start:</span><button type="button" data-tm-flip>Light ↔ dark</button><button type="button" data-tm-random>Surprise me</button></div>
    </div>
    <footer class="tm-foot"><button class="btn danger" id="tmDelete">Delete</button><button class="btn ctl" id="tmExport">Export…</button><span class="flex1"></span>
      <button class="btn" data-tm-close>Cancel</button><button class="btn primary" id="tmSave">Save theme</button></footer></div>`;
  el.classList.remove('hidden');
  document.addEventListener('keydown', onKey, true);
  el.oninput = e => {
    const c = e.target.closest('[data-tm]'); if (c) { draft.vars[c.dataset.tm] = c.value; c.closest('label').classList.remove('auto'); preview(); return; }
    if (e.target.id === 'tmName') draft.name = e.target.value;
  };
  el.onchange = e => {
    if (e.target.id === 'tmFont') { draft.font = e.target.value; preview(); }
    if (e.target.id === 'tmSquare') { draft.square = e.target.checked; preview(); }
  };
  el.onclick = e => {
    if (e.target === el || e.target.closest('[data-tm-close]')) return close(false);
    const au = e.target.closest('[data-tm-auto]'); if (au) { e.preventDefault(); delete draft.vars[au.dataset.tmAuto]; preview(); draw(); return; }
    if (e.target.closest('[data-tm-flip]')) {
      const v = X.deriveTheme(clean(draft.vars));
      draft.vars = { bg: v.text, text: v.bg, accent: v.accent, 'viz-mid': draft.vars['viz-mid'], 'viz-hi': draft.vars['viz-hi'] };
      preview(); draw(); return;
    }
    if (e.target.closest('[data-tm-random]')) {
      const h = Math.floor(Math.random() * 360), h2 = (h + 140 + Math.floor(Math.random() * 80)) % 360;
      const hsl = (a, s, l) => { s /= 100; l /= 100; const k = n => (n + a / 30) % 12, q = s * Math.min(l, 1 - l), f = n => l - q * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join(''); };
      draft.vars = { bg: hsl(h, 25, 7), panel: hsl(h, 22, 10), elev: hsl(h, 20, 14), text: hsl(h, 20, 93), accent: hsl(h2, 80, 64), 'viz-mid': hsl((h2 + 40) % 360, 80, 62), 'viz-hi': hsl((h2 + 90) % 360, 85, 66) };
      preview(); draw(); return;
    }
    if (e.target.closest('#tmDelete')) {
      const b = e.target.closest('#tmDelete');
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Click again to delete'; return; }
      X.store.set('customThemes', X.customThemes().filter(x => x.id !== editing));
      close(true); X.renderThemes(); X.applyTheme(before === editing ? 'midnight' : before); X.toast('Theme deleted'); return;
    }
    if (e.target.closest('#tmExport')) {
      const data = { amplite: 'theme', version: 1, name: draft.name.trim() || 'My theme', vars: X.deriveTheme(clean(draft.vars)), font: draft.font || undefined, square: draft.square || undefined };
      X.saveText({ name: `${data.name}.amptheme`, text: JSON.stringify(data, null, 2), kind: 'amptheme' }).then(r => { if (r?.ok) X.toast('Exported. Send the file to a friend and they can import it.'); });
      return;
    }
    if (e.target.closest('#tmSave')) {
      const list = X.customThemes(), name = draft.name.trim() || 'My theme';
      const t2 = { id: editing || 'c-' + Date.now().toString(36), name, vars: clean(draft.vars), font: draft.font || '', square: !!draft.square };
      X.store.set('customThemes', editing ? list.map(x => x.id === editing ? t2 : x) : [...list, t2]);
      close(true); X.renderThemes(); X.applyTheme(t2.id); X.toast(`Saved “${name}”`);
    }
  };
  draw(); preview();
  setTimeout(() => el.querySelector('#tmName').select(), 0);
}
// Import a .amptheme file (or any JSON with the same shape). Only colors, a known font list and the
// corners flag are taken from it.
export function importTheme(ctx) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.amptheme,.json,application/json';
  inp.onchange = async () => {
    const f = inp.files?.[0]; if (!f) return;
    try {
      if (f.size > 100000) throw new Error('too big');
      const j = JSON.parse(await f.text()), vars = {};
      for (const k of ctx.THEME_KEYS) { const h = toHex(j?.vars?.[k]); if (h) vars[k] = h; }
      if (!vars.bg || !vars.text || !vars.accent) throw new Error('missing colors');
      const fonts = ['"Bahnschrift", "Segoe UI", sans-serif', '"Trebuchet MS", "Segoe UI", sans-serif', 'Verdana, "Segoe UI", sans-serif', 'Georgia, "Times New Roman", serif', '"Cascadia Code", "Cascadia Mono", Consolas, monospace', '"Comic Sans MS", "Segoe UI", sans-serif'];
      const t = { id: 'c-' + Date.now().toString(36), name: String(j.name || f.name.replace(/\.\w+$/, '')).slice(0, 40), vars, font: fonts.includes(j.font) ? j.font : '', square: !!j.square };
      ctx.store.set('customThemes', [...(ctx.store.get('customThemes', []) || []), t]);
      ctx.renderThemes(); ctx.applyTheme(t.id); ctx.toast(`Imported “${t.name}”`);
    } catch { ctx.toast('That file isn’t an Amplite theme.'); }
  };
  inp.click();
}
