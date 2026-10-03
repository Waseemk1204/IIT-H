// A small 3D model for every item, in the same toon-and-ink style as the
// hostel. Sizes are real-world metres; the origin is where a hand holds it.
import * as THREE from 'three';
import { inkBox, inkMesh, toon, canvasTexture } from './toon.js';

const STEEL = 0xb9c2c8, DARK = 0x2b2b2b, WIRE = 0x9aa3a8, GOLD = 0xd8b23a;

// A bent wire along points (no outline: it is too thin for one).
function wire(points, radius = 0.003, color = WIRE) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.05);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, points.length * 8, radius, 6, false), toon(color));
  m.castShadow = true;
  return m;
}

const printed = canvasTexture(128, 128, (ctx, w, h) => {
  ctx.fillStyle = '#e9e2cf'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1a1410'; ctx.font = 'bold 18px Impact, sans-serif'; ctx.fillText('HOSTEL TIMES', 8, 22);
  ctx.fillStyle = '#6b665c';
  for (let y = 32; y < h - 6; y += 7) { ctx.fillRect(8, y, 52, 3); ctx.fillRect(68, y, 52, 3); }
});

const MAKERS = {
  phone() {
    const g = new THREE.Group();
    g.add(inkBox(0.072, 0.145, 0.009, 0x1a1a22, 0, -0.072, 0, 0.003));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.062, 0.128), new THREE.MeshBasicMaterial({ color: 0x223355 }));
    screen.position.set(0, 0, 0.0051);
    g.add(screen);
    const led = new THREE.Mesh(new THREE.CircleGeometry(0.006, 10), new THREE.MeshBasicMaterial({ color: 0x555555 }));
    led.position.set(0.022, 0.058, -0.0051); led.rotation.y = Math.PI;
    g.add(led);
    g.userData.led = led; g.userData.screen = screen;
    return g;
  },
  newspaper() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.27), [toon(0xd9d2bf), toon(0xd9d2bf), new THREE.MeshToonMaterial({ map: printed }), toon(0xd9d2bf), toon(0xd9d2bf), toon(0xd9d2bf)]);
    m.position.y = 0.006;
    g.add(m);
    return g;
  },
  compass() {
    const g = new THREE.Group();
    const hinge = inkMesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 10), STEEL, 0.002);
    hinge.rotation.x = Math.PI / 2; hinge.position.y = 0.11;
    g.add(hinge);
    const legA = inkBox(0.005, 0.11, 0.004, STEEL, -0.012, 0, 0, 0.002); legA.rotation.z = -0.22;
    const legB = inkBox(0.005, 0.11, 0.004, STEEL, 0.012, 0, 0, 0.002); legB.rotation.z = 0.22;
    g.add(legA, legB, inkBox(0.004, 0.02, 0.004, 0x333333, 0, 0.12, 0, 0.001));
    return g;
  },
  bobbypin() {
    const g = new THREE.Group();
    g.add(wire([[0, 0, 0], [0, 0.065, 0], [0.004, 0.07, 0], [0.008, 0.065, 0], [0.008, 0.01, 0], [0.006, 0.0, 0]], 0.0015, 0x2a2a2a));
    return g;
  },
  hanger() {
    const g = new THREE.Group();
    g.add(wire([[0, 0.05, 0], [0, 0.08, 0], [0.012, 0.1, 0], [0.026, 0.085, 0], [0.018, 0.07, 0]], 0.003));
    g.add(wire([[0, 0.05, 0], [-0.2, -0.05, 0], [0.2, -0.05, 0], [0, 0.05, 0]], 0.003));
    return g;
  },
  ruler() {
    const g = new THREE.Group();
    g.add(inkBox(0.03, 0.3, 0.003, STEEL, 0, 0, 0, 0.002));
    for (let i = 0; i < 15; i++) g.add(inkBox(0.008 + (i % 5 === 0) * 0.006, 0.0015, 0.001, 0x222222, -0.011, 0.01 + i * 0.019, 0.002, 0.0002));
    return g;
  },
  lockpick() {
    const g = MAKERS.compass();
    const pin = MAKERS.bobbypin();
    pin.position.set(0.0, -0.06, 0); pin.rotation.z = Math.PI;
    g.add(pin);
    g.add(inkBox(0.03, 0.015, 0.014, 0xe0e0d0, 0, 0.03, 0, 0.002));       // tape
    return g;
  },
  longhook() {
    const g = MAKERS.ruler();
    g.add(wire([[0, 0.28, 0], [0, 0.4, 0], [0.02, 0.43, 0], [0.04, 0.41, 0], [0.035, 0.38, 0]], 0.003));
    g.add(inkBox(0.036, 0.03, 0.01, 0xe0e0d0, 0, 0.26, 0, 0.002));          // tape
    return g;
  },
  bat() {
    const g = new THREE.Group();
    g.add(inkMesh(new THREE.CylinderGeometry(0.016, 0.016, 0.28, 10), 0x2c2c2c, 0.003));   // grip
    g.children[0].position.y = 0.14;
    const blade = inkBox(0.11, 0.55, 0.04, 0xd9b77a, 0, 0.28, 0, 0.005);
    g.add(blade);
    g.add(inkBox(0.112, 0.06, 0.042, 0xb03a2e, 0, 0.62, 0, 0.002));          // sticker band
    return g;
  },
  glass() {
    const g = new THREE.Group();
    const m = inkMesh(new THREE.CylinderGeometry(0.037, 0.03, 0.11, 16, 1, true), STEEL, 0.003);
    m.material = new THREE.MeshToonMaterial({ color: STEEL, side: THREE.DoubleSide });
    m.position.y = 0.055;
    g.add(m, inkMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.004, 16), STEEL, 0.002));
    return g;
  },
  ball() {
    const g = new THREE.Group();
    const b = inkMesh(new THREE.SphereGeometry(0.033, 16, 12), 0xd7e83a, 0.003);
    b.position.y = 0.033;
    const seam = new THREE.Mesh(new THREE.TorusGeometry(0.033, 0.002, 4, 24), toon(0xffffff));
    seam.position.y = 0.033; seam.rotation.set(0.6, 0.3, 0);
    g.add(b, seam);
    return g;
  },
  roomkey() { return key(0.06, 0xc9a54a); },
  gatekey() {
    const g = new THREE.Group();
    g.add(inkMesh(new THREE.TorusGeometry(0.025, 0.003, 6, 18), GOLD, 0.002));
    for (let i = 0; i < 3; i++) {
      const k = key(0.07 + i * 0.012, i === 1 ? 0x8a8f94 : GOLD);
      k.position.set(-0.01 + i * 0.01, -0.025, 0); k.rotation.z = (i - 1) * 0.35;
      g.add(k);
    }
    return g;
  },
  book() {
    const g = new THREE.Group();
    g.add(inkBox(0.16, 0.032, 0.22, 0x2e6fb3, 0, 0, 0, 0.003));
    g.add(inkBox(0.152, 0.026, 0.212, 0xf4ead0, 0.006, 0.003, 0, 0.0005));
    return g;
  },
  kettle() {
    const g = new THREE.Group();
    g.add(inkMesh(new THREE.CylinderGeometry(0.06, 0.075, 0.17, 16), 0xe8e8e8, 0.004));
    g.children[0].position.y = 0.1;
    g.add(inkBox(0.13, 0.015, 0.13, 0x333333, 0, 0, 0, 0.003));
    const spout = inkMesh(new THREE.CylinderGeometry(0.01, 0.016, 0.07, 8), 0xe8e8e8, 0.003);
    spout.position.set(0.085, 0.13, 0); spout.rotation.z = -0.9;
    g.add(spout, inkBox(0.02, 0.12, 0.03, 0x333333, -0.08, 0.05, 0, 0.003));
    g.add(wire([[-0.06, 0.04, 0], [-0.18, 0.0, 0], [-0.24, -0.08, 0]], 0.004, 0x111111));   // flex
    return g;
  },
  iron() {
    const g = new THREE.Group();
    const base = inkBox(0.22, 0.03, 0.1, STEEL, 0, 0, 0, 0.003);
    const body = inkBox(0.19, 0.05, 0.085, 0x3f7fbf, -0.01, 0.03, 0, 0.003);
    const nose = inkBox(0.06, 0.05, 0.06, 0x3f7fbf, 0.1, 0.03, 0, 0.003); nose.rotation.y = Math.PI / 4;
    const handle = inkBox(0.13, 0.025, 0.03, 0x222222, -0.01, 0.1, 0, 0.003);
    g.add(base, body, nose, handle, inkBox(0.02, 0.04, 0.02, 0x222222, -0.06, 0.08, 0, 0.002), inkBox(0.02, 0.04, 0.02, 0x222222, 0.04, 0.08, 0, 0.002));
    g.add(wire([[-0.11, 0.05, 0], [-0.2, 0.0, 0], [-0.26, -0.08, 0]], 0.004, 0x111111));
    return g;
  },
  heater() {
    const g = new THREE.Group();
    g.add(inkBox(0.26, 0.22, 0.06, 0x6d6d64, 0, 0, 0, 0.004));
    for (let i = 0; i < 3; i++) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 8), new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
      rod.rotation.z = Math.PI / 2; rod.position.set(0, 0.05 + i * 0.06, 0.035);
      g.add(rod);
    }
    for (let i = 0; i < 6; i++) g.add(inkBox(0.004, 0.2, 0.004, 0x999999, -0.11 + i * 0.044, 0.01, 0.045, 0.0005));
    g.add(inkBox(0.3, 0.02, 0.1, 0x444444, 0, 0, 0, 0.003));
    return g;
  },
};

function key(len, color) {
  const g = new THREE.Group();
  const bow = inkMesh(new THREE.TorusGeometry(0.012, 0.004, 6, 14), color, 0.002);
  g.add(bow);
  g.add(inkBox(0.005, len, 0.004, color, 0, -len - 0.008, 0, 0.001));
  for (let i = 0; i < 3; i++) g.add(inkBox(0.008, 0.005, 0.004, color, 0.005, -len + i * 0.009, 0, 0.001));
  return g;
}

export function makeItemModel(id) {
  const make = MAKERS[id];
  return make ? make() : inkBox(0.06, 0.06, 0.06, 0xff00ff);
}

// How each item sits in your right hand (position and rotation of the model
// relative to the hand).
export const GRIP = {
  phone:     { p: [0, 0.03, 0], r: [0.1, 0, 0] },
  newspaper: { p: [-0.02, 0.02, -0.04], r: [1.15, 0.25, 0], s: 0.8 },
  compass:   { p: [0, -0.01, -0.02], r: [-0.9, 0, 0.2], s: 1.3 },
  bobbypin:  { p: [0, 0.0, -0.02], r: [-0.9, 0, 0.2], s: 2 },
  hanger:    { p: [-0.05, 0.02, -0.06], r: [-0.4, 0, 0.1], s: 0.6 },
  ruler:     { p: [0, -0.02, -0.02], r: [-1.1, 0, 0] },
  lockpick:  { p: [0, -0.01, -0.02], r: [-1.0, 0, 0] },
  longhook:  { p: [0, -0.02, -0.02], r: [-1.1, 0, 0] },
  bat:       { p: [-0.02, -0.08, 0.0], r: [-0.45, 0.2, 0.6], s: 0.55 },
  glass:     { p: [0, -0.03, -0.01], r: [0, 0, 0] },
  ball:      { p: [0, -0.01, -0.02], r: [0, 0, 0] },
  roomkey:   { p: [0, 0.05, -0.02], r: [2.0, 0, -0.8], s: 2.2 },
  gatekey:   { p: [0, 0.03, -0.03], r: [-0.4, 0, 0], s: 1.4 },
  book:      { p: [0, 0, -0.06], r: [-1.1, 0, 0], s: 0.8 },
  kettle:    { p: [0, -0.1, -0.03], r: [0, 0.6, 0], s: 0.7 },
  iron:      { p: [0, -0.06, -0.04], r: [0, Math.PI / 2, 0], s: 0.8 },
  heater:    { p: [0, -0.12, -0.05], r: [0, 0.3, 0], s: 0.6 },
};
