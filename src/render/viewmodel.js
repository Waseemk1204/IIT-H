// First-person hands. Drawn in their own pass on top of the world, so the
// bat never sinks into a wall. Right hand: whatever you have selected. Left
// hand: your phone (and its torch). Every way of using a thing has a little
// procedural animation.
import * as THREE from 'three';
import { inkBox } from './toon.js';
import { makeItemModel, GRIP } from './props.js';

const SKIN = 0xc68b59, SLEEVE = 0x3b5c8c;
const RIGHT = new THREE.Vector3(0.19, -0.19, -0.42);
const LEFT = new THREE.Vector3(-0.2, -0.2, -0.42);

// Which animation each action plays.
export const ACTION_ANIM = {
  search: 'rummage', pickup: 'grab', radio: 'press', toggle: 'push', knock: 'knock',
  slidePaper: 'slide', pokeKey: 'poke', pullPaper: 'pull', unlock106: 'twist', vent: 'reachUp',
  pickGrill: 'pick', smashGrill: 'swing', smashWindow: 'swing', hookKeys: 'hook', grabKeys: 'grab',
  unlockMain: 'twist', borrowBook: 'grab', plug: 'push',
};

const ease = (k) => k * k * (3 - 2 * k);
const bump = (k) => Math.sin(Math.min(1, Math.max(0, k)) * Math.PI);

// Pose offsets for the right hand: [px, py, pz, rx, ry, rz].
// k: 0..1 progress of a one-shot; t: seconds for loops.
const POSES = {
  idle: () => [0, 0, 0, 0, 0, 0],
  rummage: (k, t) => [Math.sin(t * 9) * 0.03, -0.12 + Math.sin(t * 14) * 0.03, -0.14 + Math.sin(t * 7) * 0.04, -0.6 + Math.sin(t * 12) * 0.2, Math.sin(t * 5) * 0.3, Math.sin(t * 11) * 0.2],
  grab: (k) => { const e = bump(k); return [-0.04 * e, -0.1 * e, -0.25 * e, -0.5 * e, 0, 0]; },
  push: (k) => { const e = bump(k); return [-0.03 * e, 0.02 * e, -0.2 * e, 0.1 * e, 0, 0]; },
  press: (k) => { const e = bump(k); return [-0.05 * e, 0.06 * e, -0.15 * e, 0, 0, -0.8 * e]; },
  knock: (k) => { const e = Math.abs(Math.sin(k * Math.PI * 2)); return [-0.05, 0.05, -0.16 * e, 0.2, 0, 0]; },
  slide: (k) => { const e = ease(Math.min(1, k)); return [-0.05 * e, -0.22 * e, -0.2 * e, -1.1 * e, 0, 0]; },
  pull: (k) => { const e = bump(k); return [0, -0.18 * e, 0.08 * e, -0.8 * e, 0, 0]; },
  poke: (k, t) => [-0.05, -0.1, -0.16 + Math.sin(t * 18) * 0.04, -0.4, Math.sin(t * 9) * 0.1, 0],
  pick: (k, t) => [-0.08, 0.02, -0.17 + Math.sin(t * 3) * 0.01, 0.05, Math.sin(t * 7) * 0.08, Math.sin(t * 22) * 0.3],
  twist: (k, t) => { const e = ease(Math.min(1, k * 2)); return [-0.08 * e, 0.03 * e, -0.17 * e, 0.1 * e, 0, -1.3 * ease(Math.min(1, Math.max(0, k * 2 - 0.6))) + Math.sin(t * 20) * 0.02]; },
  reachUp: (k, t) => [-0.06, 0.24, -0.2, 0.9 + Math.sin(t * 6) * 0.2, 0, Math.sin(t * 8) * 0.2],
  hook: (k, t) => [-0.06, 0.04, -0.3 + Math.sin(t * 3.5) * 0.06, 0.25, 0, Math.sin(t * 5) * 0.1],
  swing: (k, t) => {
    const ph = (t * 1.7) % 1;
    if (ph < 0.55) { const e = ease(ph / 0.55); return [0.05 * e, 0.12 * e, 0.05 * e, 0.7 * e, 0.3 * e, 0.6 * e]; }
    const e = ease((ph - 0.55) / 0.45);
    return [0.05 - 0.25 * e, 0.12 - 0.22 * e, 0.05 - 0.2 * e, 0.7 - 2.2 * e, 0.3 - 0.6 * e, 0.6 - 1.4 * e];
  },
  smashHit: (k) => { const e = ease(k); return [-0.2 + 0.2 * e, -0.1 + 0.1 * e, -0.15 + 0.15 * e, -1.5 + 1.5 * e, -0.3 + 0.3 * e, -0.8 + 0.8 * e]; },
  throw: (k) => {
    if (k < 0.4) { const e = ease(k / 0.4); return [0.04 * e, 0.12 * e, 0.12 * e, 0.8 * e, 0, 0]; }
    const e = ease((k - 0.4) / 0.6);
    return [0.04 - 0.1 * e, 0.12 - 0.05 * e, 0.12 - 0.42 * e, 0.8 - 1.6 * e, 0, 0];
  },
  drop: (k) => [0, -0.3 * ease(k), 0, -0.4 * k, 0, 0],
  equip: (k) => [0, -0.3 * (1 - ease(k)), 0, -0.6 * (1 - ease(k)), 0, 0],
  combine: (k) => { const e = ease(Math.min(1, k / 0.55)); const shake = k > 0.55 && k < 0.75 ? Math.sin(k * 120) * 0.02 : 0; return [-0.17 * e + shake, 0.1 * e, -0.16 * e, 0.3 * e, -0.5 * e, 0]; },
};

function hand(sleeve = true) {
  const g = new THREE.Group();
  g.add(inkBox(0.075, 0.085, 0.1, SKIN, 0, -0.04, 0.02, 0.004));
  g.add(inkBox(0.025, 0.06, 0.025, SKIN, -0.045, -0.02, -0.005, 0.003));   // thumb
  if (sleeve) g.add(inkBox(0.075, 0.075, 0.13, SLEEVE, 0, -0.045, 0.1, 0.004));
  return g;
}

export function createViewmodel() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 5);
  const hemi = new THREE.HemisphereLight(0x6f80b8, 0x221f28, 1.2);
  const key = new THREE.DirectionalLight(0xfff0d8, 0.6);
  key.position.set(0.5, 1, 0.6);
  scene.add(hemi, key, camera);

  const right = new THREE.Group(), left = new THREE.Group();
  camera.add(right, left);
  const rHand = hand(); right.add(rHand);
  const rSlot = new THREE.Group(); right.add(rSlot);
  const lHand = hand(); lHand.scale.x = -1; left.add(lHand);
  const lSlot = new THREE.Group(); left.add(lSlot);
  const phone = makeItemModel('phone');
  phone.position.set(0.01, 0.04, -0.02); phone.rotation.set(0.15, 0.25, 0);
  lSlot.add(phone);

  const models = new Map();
  const modelFor = (id) => {
    if (!models.has(id)) {
      const m = makeItemModel(id);
      const gr = GRIP[id] || { p: [0, 0, 0], r: [0, 0, 0] };
      const wrap = new THREE.Group();
      m.position.set(...gr.p); m.rotation.set(...gr.r);
      m.scale.setScalar((gr.s || 1) * 1.5);      // viewmodels read better a bit larger than life
      wrap.add(m);
      models.set(id, wrap);
    }
    return models.get(id);
  };
  const show = (slot, id) => {
    slot.clear();
    if (id) slot.add(modelFor(id));
  };

  let held = null;          // what the right hand shows normally
  let shown = undefined;
  let oneShot = null;       // { name, t, dur, item, other, then }
  let loop = null;          // { name, item }
  let t = 0, swayX = 0, swayY = 0;
  let hasPhone = true, torch = false;

  return {
    scene, camera,
    setHeld(id) {
      if (id === 'phone') id = null;           // the phone lives in the left hand
      if (id !== held) {
        held = id;
        if (!oneShot) oneShot = { name: 'equip', t: 0, dur: 0.25 };
      }
    },
    setPhone(has, on) { hasPhone = has; torch = on; },
    // A one-off move, e.g. 'throw' with the item that is leaving your hand.
    play(name, dur = 0.4, opts = {}) { oneShot = { name, t: 0, dur, ...opts }; },
    // A looping move while you hold E; null to stop.
    hold(name, item) { loop = name ? { name, item } : null; },
    // Light the hands like the world around them.
    light(fromHemi, power) {
      hemi.color.copy(fromHemi.color); hemi.groundColor.copy(fromHemi.groundColor);
      hemi.intensity = fromHemi.intensity * 0.9;
      key.intensity = 0.35 + power * 0.5 + (torch ? 0.5 : 0);
    },
    resize(aspect) { camera.aspect = aspect; camera.updateProjectionMatrix(); },
    update(dt, { moving, bob, running, look }) {
      t += dt;
      // Which item is in the right hand this frame, and which pose.
      let pose = POSES.idle(0, t), item = held, other = null;
      if (oneShot) {
        oneShot.t += dt;
        const k = Math.min(1, oneShot.t / oneShot.dur);
        pose = POSES[oneShot.name](k, t);
        if (oneShot.item !== undefined) item = oneShot.item;
        if (oneShot.name === 'throw' && k > 0.55) item = null;      // it has left your hand
        if (oneShot.name === 'combine') { item = k < 0.7 ? oneShot.a : oneShot.made; other = k < 0.7 ? oneShot.b : null; }
        if (k >= 1) oneShot = null;
      } else if (loop) {
        pose = POSES[loop.name](0, t);
        if (loop.item) item = loop.item;
      }
      if (item !== shown) { show(rSlot, item); shown = item; }
      rHand.visible = true;

      // Walking bob and a lazy sway that trails behind the mouse.
      swayX += ((look?.x || 0) * -0.0004 - swayX) * Math.min(1, dt * 8);
      swayY += ((look?.y || 0) * 0.0004 - swayY) * Math.min(1, dt * 8);
      const b = moving ? Math.sin(bob) * (running ? 0.02 : 0.01) : Math.sin(t * 1.6) * 0.003;
      const bx = moving ? Math.cos(bob * 0.5) * (running ? 0.02 : 0.01) : 0;
      right.position.set(RIGHT.x + pose[0] + bx + swayX, RIGHT.y + pose[1] + b + swayY, RIGHT.z + pose[2]);
      right.rotation.set(pose[3], pose[4], pose[5]);

      // Left hand: the phone, or the second half of a combine.
      const combining = !!other;
      left.visible = hasPhone || combining;
      if (combining) {
        const k = Math.min(1, oneShot ? oneShot.t / oneShot.dur : 1);
        const e = ease(Math.min(1, k / 0.55));
        if (lSlot.userData.shown !== other) { lSlot.clear(); lSlot.add(modelFor(other).clone()); lSlot.userData.shown = other; }
        left.position.set(LEFT.x + 0.17 * e, LEFT.y + 0.1 * e + b, LEFT.z - 0.16 * e);
        left.rotation.set(0, 0.5 * e, 0);
      } else {
        if (lSlot.userData.shown !== 'phone') { lSlot.clear(); lSlot.add(phone); lSlot.userData.shown = 'phone'; }
        left.position.set(LEFT.x - bx + swayX, LEFT.y + b + swayY + (torch ? 0.03 : 0), LEFT.z);
        left.rotation.set(torch ? 0.25 : 0, 0, 0);
        phone.userData.led.material.color.set(torch ? 0xffffff : 0x555555);
        phone.userData.screen.material.color.set(torch ? 0x9fb8ff : 0x223355);
      }
    },
    render(renderer) {
      renderer.clearDepth();
      renderer.render(scene, camera);
    },
  };
}
