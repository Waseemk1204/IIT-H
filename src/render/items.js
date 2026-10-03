// Items lying around (thrown, dropped, confiscated) are drawn as comic
// stickers: the item's emoji with a thick white-and-ink border.
import * as THREE from 'three';
import { ITEMS } from '../../shared/jugaad.js';

const texCache = new Map();
export function stickerTexture(icon) {
  if (texCache.has(icon)) return texCache.get(icon);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.font = '84px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#14110f'; ctx.shadowBlur = 0;
  // ink outline then white rim, by stamping the glyph around itself
  for (const [col, r] of [['#14110f', 9], ['#ffffff', 5]]) {
    ctx.fillStyle = col;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = col === '#ffffff' ? 'brightness(0) invert(1)' : 'brightness(0)';
      ctx.fillText(icon, 64 + Math.cos(a) * r, 68 + Math.sin(a) * r);
      ctx.restore();
    }
  }
  ctx.fillText(icon, 64, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(icon, t);
  return t;
}

export function itemSprite(id, size = 0.32) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: stickerTexture(ITEMS[id].icon), transparent: true, depthWrite: false }));
  s.scale.set(size, size, size);
  return s;
}

// Keeps a sprite for every item lying in the world, bobbing gently.
export function createWorldItems(scene) {
  const sprites = new Map();   // world item id -> sprite
  const flights = [];          // thrown items in the air
  return {
    throwFlight(id, from, to, onLand) {
      const s = itemSprite(id, 0.28);
      scene.add(s);
      flights.push({ s, from, to, t: 0, dur: 0.45, onLand });
    },
    update(dt, worldItems, time) {
      const live = new Set();
      for (const w of worldItems) {
        live.add(w.id);
        let s = sprites.get(w.id);
        if (!s) { s = itemSprite(w.item); scene.add(s); sprites.set(w.id, s); }
        s.position.set(w.x, 0.28 + Math.sin(time * 2.5 + w.id) * 0.04, w.z);
      }
      for (const [id, s] of sprites) if (!live.has(id)) { scene.remove(s); sprites.delete(id); }
      for (let i = flights.length - 1; i >= 0; i--) {
        const f = flights[i];
        f.t += dt;
        const k = Math.min(1, f.t / f.dur);
        f.s.position.set(
          f.from.x + (f.to.x - f.from.x) * k,
          f.from.y + (0.3 - f.from.y) * k + Math.sin(k * Math.PI) * 0.8,
          f.from.z + (f.to.z - f.from.z) * k,
        );
        f.s.material.rotation = k * 8;
        if (k >= 1) { scene.remove(f.s); flights.splice(i, 1); f.onLand(); }
      }
    },
  };
}
