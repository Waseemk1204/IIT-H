// Bhaiya of Bhaiya Maggi Point: vest, lungi, gamchha on the shoulder,
// stirring a steaming pot behind the counter and calling out to customers.
import * as THREE from 'three';
import { inkBox, inkMesh, canvasTexture } from './toon.js';

const SKIN = 0x8a5a36, VEST = 0xeeeeea, HAIR = 0x1b1512;
const lungi = canvasTexture(64, 64, (ctx, w, h) => {
  ctx.fillStyle = '#1f6f6a'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e8c23a';
  for (let i = 0; i < w; i += 16) { ctx.fillRect(i, 0, 3, h); ctx.fillRect(0, i, w, 3); }
  ctx.fillStyle = '#b8342a';
  for (let i = 8; i < w; i += 16) { ctx.fillRect(i, 0, 2, h); ctx.fillRect(0, i, w, 2); }
}, [1, 1]);
const gamchha = canvasTexture(32, 32, (ctx, w, h) => {
  ctx.fillStyle = '#c0392b'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f4ead0';
  for (let i = 0; i < w; i += 8) { ctx.fillRect(i, 0, 2, h); ctx.fillRect(0, i, w, 2); }
}, [1, 1]);

const CALLS = [
  'Garma garam Maggi!', 'Aaja bhai, last order!', 'Double masala? Ho jayega!',
  'Do minute... sach mein do minute!', 'Cheese daalun?', 'Exam hai? Maggi khao, sab aayega!',
];

export function createBhaiya(scene) {
  const group = new THREE.Group();
  // lungi (a tapered tube) and feet
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.85, 14), new THREE.MeshToonMaterial({ map: lungi }));
  skirt.position.y = 0.43;
  group.add(skirt);
  for (const sx of [-1, 1]) group.add(inkBox(0.11, 0.06, 0.22, 0x3a2a1a, sx * 0.1, 0, 0.04, 0.005));   // chappals
  // vest and a little belly
  group.add(inkMesh(new THREE.CylinderGeometry(0.21, 0.22, 0.55, 14), VEST));
  group.children.at(-1).position.y = 1.12;
  const belly = inkMesh(new THREE.SphereGeometry(0.21, 14, 10), VEST);
  belly.scale.set(1, 0.9, 1.05); belly.position.set(0, 1.0, 0.05);
  group.add(belly);
  // gamchha over the left shoulder
  const towel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.03), new THREE.MeshToonMaterial({ map: gamchha }));
  towel.position.set(-0.17, 1.2, 0.0); towel.rotation.z = 0.15;
  group.add(towel);
  // arms: left on the counter, right stirring
  const armL = inkBox(0.09, 0.45, 0.09, SKIN, -0.27, 0.95, 0.08);
  armL.rotation.x = -0.6;
  group.add(armL);
  const shoulderR = new THREE.Group();
  shoulderR.position.set(0.26, 1.33, 0);
  const upper = inkBox(0.09, 0.3, 0.09, SKIN, 0, -0.3, 0);
  const fore = new THREE.Group();
  fore.position.set(0, -0.28, 0);
  fore.add(inkBox(0.08, 0.28, 0.08, SKIN, 0, -0.26, 0));
  const ladle = new THREE.Group();
  ladle.position.set(0, -0.28, 0);
  ladle.add(inkBox(0.015, 0.35, 0.015, 0x6b4a2a, 0, -0.3, 0, 0.003));
  ladle.add(inkMesh(new THREE.SphereGeometry(0.035, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0xb9c2c8, 0.003));
  ladle.children.at(-1).position.y = -0.3;
  fore.add(ladle);
  shoulderR.add(upper, fore);
  group.add(shoulderR);
  // head: moustache, stubble, a bit of hair
  const head = new THREE.Group();
  head.position.set(0, 1.58, 0);
  head.add(inkMesh(new THREE.SphereGeometry(0.15, 14, 10), SKIN));
  const hair = inkMesh(new THREE.SphereGeometry(0.155, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), HAIR, 0.006);
  hair.position.y = 0.02;
  head.add(hair);
  head.add(inkBox(0.18, 0.04, 0.04, HAIR, 0, -0.07, 0.13, 0.006));
  for (const sx of [-1, 1]) head.add(inkBox(0.04, 0.03, 0.01, HAIR, sx * 0.055, 0.02, 0.145, 0.003));
  group.add(head);
  group.traverse((o) => { if (o.isMesh && !o.userData.isHull) o.castShadow = true; });

  // Steam off the pot.
  const puffTex = canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  });
  const puffs = [];
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0 }));
    s.userData.t = i / 10;
    scene.add(s);
    puffs.push(s);
  }

  // He stands behind the stove end of the counter, facing the hostel.
  const POT = { x: 38.2, y: 1.3, z: 18.5 };
  group.position.set(38.2, 0, 19.35);
  group.rotation.y = Math.PI;
  scene.add(group);

  let t = 0, callT = 4;
  return {
    group,
    pos: { x: 38.2, z: 19.35 },
    headWorld(out = new THREE.Vector3()) { return head.getWorldPosition(out).add(new THREE.Vector3(0, 0.35, 0)); },
    // Returns a call-out now and then if you are close enough to hear it.
    update(dt, player) {
      t += dt;
      // stirring: the forearm and ladle go round the pot
      shoulderR.rotation.x = -0.9 + Math.sin(t * 4) * 0.12;
      shoulderR.rotation.z = 0.25 + Math.cos(t * 4) * 0.12;
      fore.rotation.x = -0.5 + Math.sin(t * 4 + 1) * 0.15;
      head.rotation.y = Math.sin(t * 0.5) * 0.25;
      skirt.rotation.y = Math.sin(t * 2) * 0.03;
      for (const s of puffs) {
        s.userData.t = (s.userData.t + dt * 0.35) % 1;
        const k = s.userData.t;
        s.position.set(POT.x + Math.sin(k * 6 + s.id) * 0.08, POT.y + k * 1.1, POT.z + Math.cos(k * 5 + s.id) * 0.06);
        s.scale.setScalar(0.15 + k * 0.45);
        s.material.opacity = Math.sin(k * Math.PI) * 0.45;
      }
      callT -= dt;
      const d = Math.hypot(player.x - 38.2, player.z - 19.35);
      if (callT <= 0 && d < 16) {
        callT = 7 + Math.random() * 5;
        return CALLS[Math.floor(Math.random() * CALLS.length)];
      }
      return null;
    },
  };
}
