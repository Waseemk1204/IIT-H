// Comic-page cutscenes: panels are snapshots rendered by the game engine,
// laid out as a comic page and revealed one at a time.
import { showOverlay } from './hud.js';

const $ = (id) => document.getElementById(id);

// panel: { img, caption, bubbles: [{ text, x, y, who? }], sfx: { text, x, y } }
// x / y are percentages inside the panel.
export function playComic(panels, { title = '' } = {}) {
  const root = $('comic-panels');
  const next = $('comic-next'), skip = $('comic-skip');
  $('comic-title').textContent = title;
  root.innerHTML = '';
  const els = panels.map((p) => {
    const el = document.createElement('div');
    el.className = `cpanel${p.dim ? ' dim' : ''}`;
    const img = document.createElement('img');
    img.src = p.img; img.alt = p.caption || '';
    el.appendChild(img);
    if (p.caption) {
      const c = document.createElement('div');
      c.className = 'cap'; c.textContent = p.caption;
      el.appendChild(c);
    }
    for (const b of p.bubbles || []) {
      const d = document.createElement('div');
      d.className = `cbub${b.shout ? ' shout' : ''}${b.tail === 'right' ? ' tail-right' : ''}`;
      d.style.left = `${b.x}%`; d.style.top = `${b.y}%`;
      d.textContent = b.text;
      el.appendChild(d);
    }
    if (p.sfx) {
      const s = document.createElement('div');
      s.className = 'csfx';
      s.style.left = `${p.sfx.x}%`; s.style.top = `${p.sfx.y}%`;
      s.style.setProperty('--r', `${p.sfx.rot ?? -8}deg`);
      s.textContent = p.sfx.text;
      el.appendChild(s);
    }
    root.appendChild(el);
    return el;
  });

  showOverlay('comic');
  return new Promise((resolve) => {
    let i = 0;
    const reveal = () => {
      if (i < els.length) {
        els[i].classList.add('on');
        els[i].scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
        i++;
        next.textContent = i < els.length ? 'AAGE →' : 'CHALO! →';
      } else finish();
    };
    const onKey = (e) => {
      if (e.code === 'Escape') finish();
      else if (['Space', 'Enter', 'KeyE', 'ArrowRight'].includes(e.code)) { e.preventDefault(); reveal(); }
    };
    const finish = () => {
      next.onclick = skip.onclick = null;
      removeEventListener('keydown', onKey);
      resolve();
    };
    next.onclick = reveal;
    skip.onclick = finish;
    addEventListener('keydown', onKey);
    reveal();
  });
}
