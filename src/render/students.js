// Act 2: students sitting in study circles on the floor, cramming.
import * as THREE from 'three';
import { inkBox, inkMesh } from './toon.js';

const SHIRTS = [0xd35454, 0x3f7fbf, 0x4fa36b, 0xe0a23a, 0x8a5cc2, 0x2f2f38, 0xe3e0d6, 0x36a3a0];
const SKINS = [0xc68b59, 0x9c6a43, 0xb47a4c, 0x8a5a36, 0xd19a6a];
const BOOKS = [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad];
const MUMBLES = [
  'Integration by parts...', 'Ratta maar, ratta!', 'Bhai ye kab padhaya tha?!', 'Chapter 4 aayega pakka',
  'dx/dt... dx/dt...', 'Neend aa rahi hai yaar', 'Kal ka paper = khatam', 'Ye formula yaad nahi ho raha',
];

function student(i) {
  const g = new THREE.Group();
  const shirt = SHIRTS[i % SHIRTS.length], skin = SKINS[(i * 3) % SKINS.length];
  g.add(inkBox(0.5, 0.14, 0.45, 0x2b3a55, 0, 0, 0.05));                        // crossed legs
  const torso = inkBox(0.36, 0.46, 0.22, shirt, 0, 0.12, -0.05);
  g.add(torso);
  const head = new THREE.Group();
  head.position.set(0, 0.74, -0.03);
  head.add(inkMesh(new THREE.SphereGeometry(0.13, 12, 9), skin));
  const hair = inkMesh(new THREE.SphereGeometry(0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x1b1512, 0.008);
  hair.position.y = 0.02;
  head.add(hair);
  g.add(head);
  // the book, held open in front
  const book = new THREE.Group();
  const col = BOOKS[(i * 7) % BOOKS.length];
  const l = inkBox(0.15, 0.2, 0.02, col, -0.075, 0, 0, 0.006); l.rotation.y = 0.35;
  const r = inkBox(0.15, 0.2, 0.02, col, 0.075, 0, 0, 0.006); r.rotation.y = -0.35;
  book.add(l, r);
  book.position.set(0, 0.42, 0.2);
  book.rotation.x = -0.5;
  g.add(book);
  g.traverse((o) => { if (o.isMesh && !o.userData.isHull) o.castShadow = true; });
  return { g, head, phase: i * 1.7 };
}

export function createStudents(scene, circles) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const all = [];
  let n = 0;
  for (const c of circles) {
    const cx = c.cells.reduce((s, [x]) => s + x + 0.5, 0) / c.cells.length;
    const cz = c.cells.reduce((s, [, z]) => s + z + 0.5, 0) / c.cells.length;
    // A ring of students around the middle of the circle's cells.
    const count = c.cells.length >= 4 ? 5 : 3;
    const rad = c.cells.length >= 4 ? 0.75 : 0.5;
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + 0.4;
      const s = student(n++);
      const x = cx + Math.cos(a) * rad * (c.cells.length >= 4 ? 1 : 1.5), z = cz + Math.sin(a) * rad * (c.cells.length >= 4 ? 1 : 0.55);
      s.g.position.set(x, 0, z);
      s.g.rotation.y = Math.atan2(cx - x, cz - z);         // face the middle
      group.add(s.g);
      all.push({ ...s, x, z });
    }
    // a pile of notes in the middle
    const notes = inkBox(0.3, 0.03, 0.22, 0xf4ead0, cx, 0, cz, 0.006);
    notes.rotation.y = 0.3;
    group.add(notes);
  }
  let t = 0, mumbleT = 3;
  return {
    group,
    show(v) { group.visible = v; },
    // Returns a mumble { text, x, z } now and then, from someone near you.
    update(dt, near) {
      t += dt;
      for (const s of all) s.head.rotation.x = 0.35 + Math.sin(t * 2.2 + s.phase) * 0.12;   // nodding over the book
      if (!group.visible) return null;
      mumbleT -= dt;
      if (mumbleT > 0) return null;
      mumbleT = 2.5 + Math.random() * 3;
      const close = all.filter((s) => Math.hypot(s.x - near.x, s.z - near.z) < 7);
      if (!close.length) return null;
      const s = close[Math.floor(Math.random() * close.length)];
      return { text: MUMBLES[Math.floor(Math.random() * MUMBLES.length)], x: s.x, z: s.z };
    },
  };
}
