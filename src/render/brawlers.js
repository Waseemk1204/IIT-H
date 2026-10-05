// The brawlers: students in vests and shorts, fists up. They wind up (fist
// back), swing, and when knocked out sit down dazed under spinning stars.
import * as THREE from 'three';
import { inkBox, inkMesh } from './toon.js';

const SHIRTS = [0xe8e6dc, 0xd35454, 0x3f7fbf, 0xe0a23a, 0x4fa36b, 0x8a5cc2, 0x2f2f38, 0x36a3a0, 0xf2f2ee, 0xc0392b];
const SKINS = [0xc68b59, 0x9c6a43, 0xb47a4c, 0x8a5a36, 0xd19a6a];

function brawler(i) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const shirt = SHIRTS[i % SHIRTS.length], skin = SKINS[(i * 2) % SKINS.length];
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(sx * 0.1, 0.8, 0);
    hip.add(inkBox(0.14, 0.42, 0.15, 0x2b3a55, 0, -0.42, 0));      // shorts
    hip.add(inkBox(0.12, 0.4, 0.13, skin, 0, -0.8, 0));
    body.add(hip); legs.push(hip);
  }
  body.add(inkBox(0.4, 0.55, 0.24, shirt, 0, 0.8, 0));
  const head = new THREE.Group();
  head.position.set(0, 1.55, 0);
  head.add(inkMesh(new THREE.SphereGeometry(0.15, 12, 9), skin));
  const hair = inkMesh(new THREE.SphereGeometry(0.155, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x1b1512, 0.008);
  hair.position.y = 0.02;
  head.add(hair);
  // angry eyebrows
  for (const sx of [-1, 1]) {
    const b = inkBox(0.07, 0.02, 0.02, 0x1b1512, sx * 0.06, 0.06, 0.14, 0.004);
    b.rotation.z = -sx * 0.45;
    head.add(b);
  }
  body.add(head);
  const arms = [];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(sx * 0.26, 1.28, 0);
    sh.add(inkBox(0.1, 0.5, 0.1, skin, 0, -0.5, 0));
    const fist = inkMesh(new THREE.SphereGeometry(0.065, 8, 6), skin, 0.006);
    fist.position.y = -0.52;
    sh.add(fist);
    body.add(sh); arms.push(sh);
  }
  // dizzy stars (shown when knocked out)
  const stars = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), new THREE.MeshBasicMaterial({ color: 0xf2c230 }));
    const a = (k / 3) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.22, 0, Math.sin(a) * 0.22);
    stars.add(s);
  }
  stars.visible = false;
  g.add(stars);
  g.traverse((o) => { if (o.isMesh && !o.userData.isHull) o.castShadow = true; });
  return { g, body, head, legs, arms, stars, last: { x: 0, z: 0 }, phase: i };
}

export function createBrawlers(scene, count) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const all = [];
  for (let i = 0; i < count; i++) { const b = brawler(i); group.add(b.g); all.push(b); }
  let t = 0;
  return {
    group,
    show(v) { group.visible = v; },
    headOf(i) { return all[i].head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.3, 0)); },
    update(dt, brawl) {
      t += dt;
      if (!brawl) return;
      brawl.brawlers.forEach((r, i) => {
        const m = all[i];
        if (!m) return;
        const moved = Math.hypot(r.x - m.last.x, r.z - m.last.z) / Math.max(dt, 1e-3);
        m.last.x = r.x; m.last.z = r.z;
        m.g.position.set(r.x, 0, r.z);
        m.g.rotation.y = r.yaw;
        if (r.ko) {
          // sitting slumped, stars circling
          m.body.position.y = -0.55; m.body.rotation.x = -0.35;
          m.legs.forEach((l) => { l.rotation.x = -1.5; });
          m.arms.forEach((a, k) => { a.rotation.x = 0.2; a.rotation.z = (k ? -1 : 1) * 0.4; });
          m.head.rotation.z = Math.sin(t * 3 + i) * 0.3;
          m.stars.visible = true;
          m.stars.position.set(0, 1.25, 0);
          m.stars.rotation.y = t * 4;
          return;
        }
        m.stars.visible = false;
        m.body.position.y = 0; m.body.rotation.x = 0;
        m.head.rotation.z = 0;
        const walking = moved > 0.3;
        const sw = walking ? Math.sin(t * 10 + m.phase) * 0.5 : 0;
        m.legs[0].rotation.x = sw; m.legs[1].rotation.x = -sw;
        // fists: guard up; the right one cocks back on a windup and shoots out on a swing
        const guard = -1.3 + Math.sin(t * 6 + m.phase) * 0.08;
        m.arms[0].rotation.x = guard;
        if (r.state === 'windup') m.arms[1].rotation.x = 0.6;
        else if (r.swing > 0) m.arms[1].rotation.x = -1.6 - r.swing * 0.3;
        else m.arms[1].rotation.x = guard;
        m.arms.forEach((a) => { a.rotation.z = 0; });
        m.body.rotation.y = r.swing > 0 ? r.swing * 0.4 : 0;
        m.body.position.y = Math.abs(Math.sin(t * 7 + m.phase)) * 0.04;   // bouncing on their toes
      });
    },
  };
}
