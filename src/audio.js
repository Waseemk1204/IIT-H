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
  powerBed();
  music();
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
  } else if (kind === 'got') {
    tone(o, { f0: 660, dur: 0.08, type: 'triangle', vol: 0.12 });
    tone(o, { f0: 990, dur: 0.12, type: 'triangle', vol: 0.12, at: 0.08 });
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

// ---------- Phase 3: the power, the crowd, the music ----------
let humGain = null, crowdOn = false, tension = 0;

// Mains hum and fan whoosh, faded in when the power is on.
function powerBed() {
  humGain = ctx.createGain();
  humGain.gain.value = 0;
  humGain.connect(master);
  for (const [f, v] of [[50, 0.05], [100, 0.03], [150, 0.01]]) {
    const o = ctx.createOscillator(); o.frequency.value = f;
    const g = ctx.createGain(); g.gain.value = v;
    o.connect(g).connect(humGain); o.start();
  }
  const fan = ctx.createBufferSource(); fan.buffer = noiseBuf; fan.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
  const fg = ctx.createGain(); fg.gain.value = 0.12;
  fan.connect(lp).connect(fg).connect(humGain); fan.start();
  // a murmuring crowd: short vowel-ish bursts from everywhere
  const murmur = () => {
    if (!ctx) return;
    if (crowdOn) {
      const o = out(Math.random() * 1.6 - 0.8, 0.05);
      noiseBurst(o, { dur: 0.25 + Math.random() * 0.3, freq: 300 + Math.random() * 700, q: 6, vol: 0.6 });
    }
    setTimeout(murmur, 120 + Math.random() * 260);
  };
  murmur();
}

export function setPower(on) {
  if (!ctx) return;
  crowdOn = on;
  humGain.gain.cancelScheduledValues(ctx.currentTime);
  humGain.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, on ? 0.6 : 0.05);
}

export function tubeTinks() {
  if (!ctx) return;
  const o = out(0, 0.6);
  for (let i = 0; i < 6; i++) tone(o, { f0: 2400 + Math.random() * 800, dur: 0.03, type: 'square', vol: 0.05, at: i * 0.18 + Math.random() * 0.1 });
}

export function cheer() {
  if (!ctx) return;
  for (let i = 0; i < 14; i++) {
    const o = out(Math.random() * 2 - 1, 0.18);
    noiseBurst(o, { dur: 0.6 + Math.random() * 0.5, freq: 500 + Math.random() * 900, q: 4, vol: 0.5, at: Math.random() * 0.5 });
  }
}

export function groan() {
  if (!ctx) return;
  for (let i = 0; i < 10; i++) {
    const o = out(Math.random() * 2 - 1, 0.18);
    tone(o, { f0: 260 + Math.random() * 120, f1: 140 + Math.random() * 40, dur: 0.9, type: 'sawtooth', vol: 0.05, at: Math.random() * 0.3 });
  }
}

export function fuseBlow() {
  if (!ctx) return;
  const o = out(0, 1);
  tone(o, { f0: 120, f1: 30, dur: 0.6, type: 'square', vol: 0.3 });
  noiseBurst(o, { dur: 0.5, freq: 1800, q: 0.4, vol: 0.9, type: 'lowpass' });
  for (let i = 0; i < 8; i++) noiseBurst(o, { dur: 0.03, freq: 4000, q: 3, vol: 0.4, at: 0.1 + Math.random() * 0.6 });
}

// 0: calm, 1: he is suspicious, 2: he is chasing you.
export function setTension(level) { tension = level; }

// A dhol-and-tabla loop that gets busier the more trouble you are in.
function music() {
  const beat = 60 / 112 / 2;            // eighth notes
  let next = ctx.currentTime + 0.2, step = 0;
  const bus = ctx.createGain(); bus.gain.value = 0.5; bus.connect(master);
  const dha = (t, v) => {             // low dhol
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(bus); o.start(t); o.stop(t + 0.32);
  };
  const na = (t, v) => {              // tabla ring
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(620, t);
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(bus); o.start(t); o.stop(t + 0.14);
  };
  setInterval(() => {
    if (!ctx) return;
    while (next < ctx.currentTime + 0.15) {
      const s = step % 16;
      if (tension === 0) {
        if (s === 0 || s === 10) dha(next, 0.12);
      } else if (tension === 1) {
        if (s % 4 === 0) dha(next, 0.22);
        if (s % 4 === 2 || s === 7) na(next, 0.06);
      } else {
        if (s % 2 === 0) dha(next, 0.32);
        if (s % 2 === 1) na(next, 0.08);
        if (s === 6 || s === 14) dha(next + beat / 2, 0.25);
      }
      next += tension === 2 ? beat * 0.75 : beat;
      step++;
    }
  }, 50);
}

export function suspend() { ctx?.suspend(); }
export function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
