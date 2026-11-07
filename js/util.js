/* 공통 유틸 */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const Util = {
  uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
  esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  fmtDate(ts) { const d = new Date(ts); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; },
  fmtSize(b) { if (!b) return '-'; if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'; return (b / 1048576).toFixed(2) + ' MB'; },
  toast(msg, type = '') {
    const el = document.createElement('div'); el.className = 'toast ' + type; el.textContent = msg;
    $('#toasts').appendChild(el); setTimeout(() => el.remove(), 3800);
  },
  modal(html, opts = {}) {
    const root = $('#modal-root');
    const bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal">${html}</div>`;
    bg.addEventListener('click', e => { if (e.target === bg && !opts.sticky) bg.remove(); });
    root.appendChild(bg);
    return { el: bg, close: () => bg.remove() };
  },
  download(blob, filename) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  },
  loadImage(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); },
  fileToDataURL(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); },
  blobToDataURL(blob) { return this.fileToDataURL(blob); },
  canvasToBlob(c, type = 'image/png', q) { return new Promise(res => c.toBlob(res, type, q)); },
  settings: {
    key: 'wp.settings',
    get() { try { return JSON.parse(localStorage.getItem(this.key) || '{}'); } catch { return {}; } },
    set(patch) { const s = Object.assign(this.get(), patch); localStorage.setItem(this.key, JSON.stringify(s)); return s; },
    section(name) { return this.get()[name] || {}; },
    setSection(name, val) { return this.set({ [name]: Object.assign(this.section(name), val) }); }
  },
  /** 캔버스 텍스트 줄바꿈 (한글은 글자 단위, 영문은 단어 단위 우선) */
  wrapText(ctx, text, maxWidth) {
    const lines = [];
    String(text || '').split(/\r?\n/).forEach(par => {
      if (!par.trim()) { lines.push(''); return; }
      const words = par.split(/(\s+)/);
      let line = '';
      const pushChars = (word) => {
        for (const ch of word) {
          if (ctx.measureText(line + ch).width > maxWidth && line) { lines.push(line); line = ch; } else line += ch;
        }
      };
      for (const w of words) {
        if (!w) continue;
        if (ctx.measureText(line + w).width <= maxWidth) { line += w; continue; }
        if (ctx.measureText(w).width > maxWidth) { pushChars(w); continue; }
        if (line.trim()) lines.push(line.trimEnd());
        line = w.trimStart();
      }
      if (line.trim()) lines.push(line.trimEnd());
    });
    return lines;
  },
  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  },
  hexToRgb(hex) { const n = parseInt(hex.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; },
  rgba(hex, a) { const [r, g, b] = this.hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
};

/* 공통 컬러 테마 (이미지/영상 공용) */
const THEMES = [
  { id: 'violet', name: '바이올렛', bg: ['#2d1b69', '#6c5ce7'], accent: '#ffd166', text: '#ffffff' },
  { id: 'coral', name: '코랄', bg: ['#ff6b6b', '#ff8e53'], accent: '#1b1f3b', text: '#ffffff' },
  { id: 'mint', name: '민트', bg: ['#0f766e', '#2dd4bf'], accent: '#fef08a', text: '#ffffff' },
  { id: 'navy', name: '네이비', bg: ['#0b1220', '#1e3a5f'], accent: '#38bdf8', text: '#ffffff' },
  { id: 'cream', name: '크림', bg: ['#fff7ed', '#fde68a'], accent: '#c2410c', text: '#1c1917' },
  { id: 'black', name: '블랙', bg: ['#000000', '#262626'], accent: '#a3e635', text: '#ffffff' }
];

function renderThemeSwatches(container, onPick, activeId = 'violet') {
  container.innerHTML = '';
  THEMES.forEach(t => {
    const s = document.createElement('div'); s.className = 'swatch' + (t.id === activeId ? ' active' : '');
    s.title = t.name; s.style.background = `linear-gradient(135deg, ${t.bg[0]}, ${t.bg[1]})`;
    s.addEventListener('click', () => { $$('.swatch', container).forEach(x => x.classList.remove('active')); s.classList.add('active'); onPick(t); });
    container.appendChild(s);
  });
}
