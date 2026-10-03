// Everything drawn over the 3D view: the spotted meter, prompts, clock, and
// comic speech / sound-effect bubbles pinned to points in the world.
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);

export function createHud() {
  const meter = $('meter'), meterFill = $('meter-fill'), meterLabel = $('meter-label');
  const prompt = $('prompt'), clock = $('clock'), area = $('area');
  const torchEl = $('torch-state'), stanceEl = $('stance');
  const layer = $('bubbles'), subtitle = $('subtitle');
  const bubbles = [];
  const v = new THREE.Vector3();
  let subT = 0;

  function bubble(text, pos, { kind = 'speech', dur = 2.4, size = 1, mood = '' } = {}) {
    const el = document.createElement('div');
    el.className = `bubble ${kind} ${mood}`;
    el.textContent = text;
    el.style.setProperty('--s', size);
    layer.appendChild(el);
    const b = { el, pos: typeof pos === 'function' ? pos : () => pos, t: 0, dur, kind, text };
    bubbles.push(b);
    return b;
  }

  return {
    bubble,
    say(text, posFn, mood) {
      // One speech bubble at a time: a new line replaces the old one.
      for (const b of bubbles) if (b.kind === 'speech') b.t = b.dur;
      return bubble(text, posFn, { kind: 'speech', dur: 2.6, mood });
    },
    sfx(text, pos, size = 1, dur = 0.9) { return bubble(text, pos, { kind: 'sfx', dur, size }); },
    subtitle(text, dur = 3) { subtitle.textContent = text; subtitle.classList.add('show'); subT = dur; },
    clearBubbles() { for (const b of bubbles) b.el.remove(); bubbles.length = 0; },

    setMeter(value, mode) {
      meter.classList.toggle('show', value > 0.02);
      meterFill.style.width = `${Math.round(value * 100)}%`;
      meter.classList.toggle('hot', mode === 'chase');
      meterLabel.textContent = mode === 'chase' ? 'DEKH LIYA!' : value > 0.25 ? 'Shak ho gaya...' : 'Kuch dikha?';
    },
    setPrompt(text) {
      prompt.textContent = text || '';
      prompt.classList.toggle('show', !!text);
    },
    setStatus({ minutes, areaName, torch, crouch, running }) {
      const h = Math.floor(minutes / 60), m = Math.floor(minutes % 60);
      clock.textContent = `${h}:${String(m).padStart(2, '0')} AM`;
      area.textContent = areaName;
      torchEl.textContent = torch ? 'TORCH ON' : 'TORCH OFF';
      torchEl.classList.toggle('on', torch);
      stanceEl.textContent = crouch ? 'CROUCHING' : running ? 'RUNNING' : 'WALKING';
      stanceEl.classList.toggle('loud', running);
    },

    update(dt, camera, width, height) {
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.t += dt;
        if (b.t > b.dur) { b.el.remove(); bubbles.splice(i, 1); continue; }
        v.copy(b.pos());
        const dist = v.distanceTo(camera.position);
        v.project(camera);
        const onScreen = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        if (!onScreen) {
          b.el.style.opacity = 0;
          // Speech you can't see still gets heard: show it as a subtitle.
          if (b.kind === 'speech' && !b.subbed) { b.subbed = true; this.subtitle(`Warden: "${b.text}"`, 2.5); }
          continue;
        }
        const x = (v.x * 0.5 + 0.5) * width, y = (-v.y * 0.5 + 0.5) * height;
        const fade = Math.min(1, (b.dur - b.t) / 0.3);
        const scale = Math.max(0.45, Math.min(1.2, 6 / Math.max(dist, 0.5)));
        b.el.style.opacity = fade * (b.kind === 'sfx' ? Math.max(0.25, 1 - dist / 14) : 1);
        b.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${b.kind === 'sfx' ? scale : Math.max(0.7, scale)})`;
      }
      if (subT > 0) { subT -= dt; if (subT <= 0) subtitle.classList.remove('show'); }
    },
  };
}

export function showOverlay(name) {
  for (const el of document.querySelectorAll('.overlay')) el.classList.toggle('show', el.id === name);
  document.body.classList.toggle('in-overlay', !!name);
}
