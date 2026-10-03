// The chowkidar: asleep on a plastic chair by the main gate, keys on his belt.
import * as THREE from 'three';
import { inkBox, inkMesh } from './toon.js';

const UNIFORM = 0x6b7480, CAP = 0x3b4a2f, SKIN = 0x9c6a43, CHAIR = 0x2f6fb0, HAIR = 0x1b1512;

export function createChowkidarModel() {
  const group = new THREE.Group();
  // the plastic chair
  group.add(inkBox(0.5, 0.05, 0.48, CHAIR, 0, 0.42, 0));
  group.add(inkBox(0.5, 0.5, 0.05, CHAIR, 0, 0.45, -0.24));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) group.add(inkBox(0.04, 0.42, 0.04, CHAIR, sx * 0.22, 0, sz * 0.2, 0.008));

  const body = new THREE.Group();
  group.add(body);
  // legs stretched out in front
  for (const sx of [-1, 1]) {
    body.add(inkBox(0.15, 0.15, 0.45, UNIFORM, sx * 0.1, 0.42, 0.2));
    body.add(inkBox(0.14, 0.42, 0.15, UNIFORM, sx * 0.1, 0.02, 0.45));
    body.add(inkBox(0.15, 0.07, 0.24, 0x222222, sx * 0.1, 0, 0.5));
  }
  const torso = inkBox(0.42, 0.5, 0.26, UNIFORM, 0, 0.47, -0.05);
  torso.rotation.x = -0.25;
  body.add(torso);
  const belt = inkBox(0.44, 0.06, 0.28, 0x2a1d14, 0, 0.5, 0.0, 0.01);
  body.add(belt);
  const keys = new THREE.Group();
  const ring = inkMesh(new THREE.TorusGeometry(0.05, 0.012, 6, 14), 0xd8b23a, 0.006);
  ring.position.set(0.18, 0.5, 0.15);
  keys.add(ring);
  for (let i = 0; i < 3; i++) {
    const k = inkBox(0.02, 0.08, 0.01, 0xd8b23a, 0.16 + i * 0.025, 0.4, 0.16, 0.004);
    k.rotation.z = (i - 1) * 0.3;
    keys.add(k);
  }
  body.add(keys);
  // arms folded on the belly
  body.add(inkBox(0.5, 0.11, 0.12, UNIFORM, 0, 0.72, 0.12));

  const head = new THREE.Group();
  head.position.set(0, 1.1, -0.12);
  head.add(inkMesh(new THREE.SphereGeometry(0.15, 14, 10), SKIN));
  const cap = inkMesh(new THREE.CylinderGeometry(0.15, 0.16, 0.1, 14), CAP, 0.01);
  cap.position.y = 0.1;
  const peak = inkBox(0.2, 0.02, 0.1, CAP, 0, 0.06, 0.14, 0.006);
  head.add(cap, peak);
  head.add(inkBox(0.17, 0.04, 0.04, HAIR, 0, -0.06, 0.13, 0.008));
  const eyes = [];
  for (const sx of [-1, 1]) {
    const e = inkBox(0.05, 0.012, 0.01, HAIR, sx * 0.055, 0.02, 0.145, 0.003);   // closed: a line
    eyes.push(e); head.add(e);
  }
  body.add(head);
  // his lathi leaning on the chair
  const lathi = inkMesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), 0x7a5230, 0.008);
  lathi.position.set(0.32, 0.72, -0.15);
  lathi.rotation.z = -0.25;
  group.add(lathi);

  group.traverse((o) => { if (o.isMesh && !o.userData.isHull) o.castShadow = true; });

  let t = 0;
  return {
    group,
    keys,
    head,
    update(ch, dt) {
      t += dt;
      group.position.set(ch.x, 0, ch.z);
      group.rotation.y = Math.PI * 0.85;      // facing into the lobby, towards the gate side
      keys.visible = ch.hasKeys;
      if (ch.awake) {
        head.rotation.x = 0; head.rotation.z = Math.sin(t * 10) * 0.1;
        for (const e of eyes) e.scale.y = 5;
      } else {
        head.rotation.x = -0.45 + Math.sin(t * 1.4) * 0.05;    // snoring, head tipped back
        head.rotation.z = 0.15;
        for (const e of eyes) e.scale.y = 1;
        body.scale.y = 1 + Math.sin(t * 1.4) * 0.015;
      }
    },
    headWorld(out = new THREE.Vector3()) { return head.getWorldPosition(out).add(new THREE.Vector3(0, 0.35, 0)); },
  };
}
