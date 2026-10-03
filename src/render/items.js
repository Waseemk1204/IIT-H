// Items lying around (thrown, dropped, confiscated) as their 3D models,
// a little larger than life and slowly turning so you can spot them.
import * as THREE from 'three';
import { makeItemModel } from './props.js';

const FLOOR_SCALE = 1.6;
const ringMat = new THREE.MeshBasicMaterial({ color: 0xf2c230, transparent: true, opacity: 0.35, depthWrite: false });
const ringGeo = new THREE.RingGeometry(0.12, 0.16, 24);

function floorModel(id) {
  const g = new THREE.Group();
  const m = makeItemModel(id);
  m.scale.setScalar(FLOOR_SCALE);
  // lie long things down
  if (['ruler', 'longhook', 'bat', 'hanger', 'compass', 'lockpick', 'bobbypin', 'roomkey', 'gatekey', 'phone'].includes(id)) {
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.02;
  }
  g.add(m);
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.005;
  g.add(ring);
  g.userData.spin = m;
  return g;
}

export function createWorldItems(scene) {
  const models = new Map();    // world item id -> model
  const flights = [];          // thrown items in the air
  return {
    throwFlight(id, from, to, onLand) {
      const m = makeItemModel(id);
      m.scale.setScalar(1.3);
      scene.add(m);
      flights.push({ m, from, to, t: 0, dur: 0.45, onLand });
    },
    update(dt, worldItems, time) {
      const live = new Set();
      for (const w of worldItems) {
        live.add(w.id);
        let m = models.get(w.id);
        if (!m) { m = floorModel(w.item); scene.add(m); models.set(w.id, m); }
        m.position.set(w.x, Math.sin(time * 2.5 + w.id) * 0.01, w.z);
        const spin = m.userData.spin;
        if (spin.rotation.x !== 0) spin.rotation.z = time * 0.6 + w.id;   // lying flat
        else spin.rotation.y = time * 0.6 + w.id;
      }
      for (const [id, m] of models) if (!live.has(id)) { scene.remove(m); models.delete(id); }
      for (let i = flights.length - 1; i >= 0; i--) {
        const f = flights[i];
        f.t += dt;
        const k = Math.min(1, f.t / f.dur);
        f.m.position.set(
          f.from.x + (f.to.x - f.from.x) * k,
          f.from.y + (0.05 - f.from.y) * k + Math.sin(k * Math.PI) * 0.8,
          f.from.z + (f.to.z - f.from.z) * k,
        );
        f.m.rotation.set(k * 9, k * 5, k * 7);
        if (k >= 1) { scene.remove(f.m); flights.splice(i, 1); f.onLand(); }
      }
    },
  };
}
