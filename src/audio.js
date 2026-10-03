// Every sound is synthesised in the browser: no audio files.
let ctx = null, master = null, noiseBuf = null;

export function startAudio() {
  if (ctx) { ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  crickets();
}

function out(pan = 0, gain = 1) {
  const g = ctx.createGain();
  g.gain.value = gain;
  const p = ctx.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  g.connect(p).connect(master);
  return g;
}

function noiseBurst(dest, { dur = 0.08, freq = 900, q = 1, type = 'bandpass', vol = 0.5, at = 0 }) {
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.random() * 0.5, dur + 0.05);
}

function tone(dest, { f0, f1 = f0, dur = 0.2, type = 'sine', vol = 0.3, at = 0 }) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}

// Your own footsteps.
export function footstep(gait) {
  if (!ctx) return;
  const vol = gait === 'run' ? 0.5 : gait === 'crouch' ? 0.08 : 0.2;
  noiseBurst(out(0, 1), { dur: 0.07, freq: gait === 'run' ? 700 : 450, q: 0.8, vol });
}

// A sound somewhere in the world: volume by distance, panned by direction.
function spatial(dist, pan, maxDist = 18) {
  const g = Math.max(0, 1 - dist / maxDist) ** 1.5;
  return g > 0.01 ? out(pan, g) : null;
}

export function wardenStep(dist, pan, chasing) {
  if (!ctx) return;
  const o = spatial(dist, pan, 20);
  if (o) {
    noiseBurst(o, { dur: 0.12, freq: 260, q: 1.2, vol: chasing ? 1.1 : 0.8 });
    tone(o, { f0: 90, f1: 60, dur: 0.08, vol: 0.25 });          // chappals slap
  }
}

export function doorCreak(dist, pan) {
  if (!ctx) return;
  const o = spatial(dist, pan);
  if (o) tone(o, { f0: 420, f1: 240, dur: 0.45, type: 'sawtooth', vol: 0.05 });
}

export function gateClang(dist, pan) {
  if (!ctx) return;
  const o = spatial(dist, pan, 25);
  if (!o) return;
  for (const [f, at] of [[620, 0], [910, 0.02], [470, 0.12]]) tone(o, { f0: f, f1: f * 0.98, dur: 0.5, type: 'triangle', vol: 0.12, at });
  noiseBurst(o, { dur: 0.15, freq: 2500, q: 3, vol: 0.2 });
}

// Comic sting when he notices you.
export function sting(kind) {
  if (!ctx) return;
  const o = out(0, 1);
  if (kind === 'caught') {
    tone(o, { f0: 600, f1: 120, dur: 0.6, type: 'square', vol: 0.12 });
    noiseBurst(o, { dur: 0.25, freq: 1500, q: 0.5, vol: 0.6, type: 'lowpass' });
  } else if (kind === 'chase') {
    for (let i = 0; i < 3; i++) tone(o, { f0: 880, f1: 860, dur: 0.09, type: 'square', vol: 0.07, at: i * 0.12 });
  } else {
    tone(o, { f0: 300, f1: 900, dur: 0.25, type: 'triangle', vol: 0.15 });
  }
}

export function torchClick() {
  if (!ctx) return;
  noiseBurst(out(0, 1), { dur: 0.02, freq: 3000, q: 2, vol: 0.3 });
}

export function bump() {
  if (!ctx) return;
  tone(out(0, 1), { f0: 160, f1: 120, dur: 0.12, type: 'triangle', vol: 0.15 });
}

// A night outside: crickets, and now and then a dog far away.
function crickets() {
  const o = out(0, 0.05);
  const tick = () => {
    if (!ctx) return;
    const n = 2 + Math.floor(Math.random() * 3);
    const f = 4200 + Math.random() * 600;
    for (let i = 0; i < n; i++) tone(o, { f0: f, dur: 0.035, type: 'sine', vol: 0.5, at: i * 0.06 });
    if (Math.random() < 0.03) {
      const d = out(Math.random() * 2 - 1, 0.05);
      tone(d, { f0: 520, f1: 300, dur: 0.18, type: 'sawtooth', vol: 0.5 });
      tone(d, { f0: 520, f1: 300, dur: 0.18, type: 'sawtooth', vol: 0.5, at: 0.3 });
    }
    setTimeout(tick, 350 + Math.random() * 600);
  };
  tick();
}

export function setMuted(m) { if (master) master.gain.value = m ? 0 : 0.8; }
