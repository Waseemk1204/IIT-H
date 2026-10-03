// Warden Saab: pot belly, safari suit, moustache, and the torch.
import * as THREE from 'three';
import { inkBox, inkMesh, toon } from './toon.js';
import { BEAM_HALF_ANGLE, BEAM_RANGE } from '../../shared/warden-ai.js';

const SUIT = 0xb59a62, PANTS = 0x5d4e33, SKIN = 0xc68b59, HAIR = 0x1b1512, SHOE = 0x2a1d14;

function beamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(0xffe2a0) }, uStrength: { value: 0.32 }, uLen: { value: 9 } },
    vertexShader: `
      varying float vAlong;
      varying vec3 vN;
      varying vec3 vView;
      uniform float uLen;
      void main() {
        vAlong = position.z / uLen;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vAlong;
      varying vec3 vN;
      varying vec3 vView;
      uniform vec3 uColor;
      uniform float uStrength;
      void main() {
        float fade = pow(clamp(1.0 - vAlong, 0.0, 1.0), 1.6);
        float edge = pow(abs(dot(normalize(vN), normalize(vView))), 1.5);
        gl_FragColor = vec4(uColor * uStrength * fade * edge, 1.0);
      }`,
  });
}

// torchLight: false for the ending's stand-in (no light, no shadow pass).
export function createWardenModel({ shadowSize = 1024, torchLight = true } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  // legs
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(sx * 0.13, 0.88, 0);
    const leg = inkBox(0.17, 0.82, 0.19, PANTS, 0, -0.85, 0);
    const shoe = inkBox(0.18, 0.08, 0.28, SHOE, 0, -0.88, 0.04);
    hip.add(leg, shoe);
    body.add(hip);
    legs.push(hip);
  }
  // torso and the famous belly
  const torso = inkMesh(new THREE.CylinderGeometry(0.25, 0.28, 0.62, 14), SUIT);
  torso.position.y = 1.2;
  const belly = inkMesh(new THREE.SphereGeometry(0.31, 16, 12), SUIT);
  belly.scale.set(1.05, 0.95, 1.15);
  belly.position.set(0, 1.08, 0.08);
  const belt = inkBox(0.6, 0.06, 0.62, 0x3a2a1a, 0, 0.88, 0.04, 0.01);
  const pocketL = inkBox(0.12, 0.12, 0.02, 0xa38a55, -0.13, 1.33, 0.27, 0.008);
  const pocketR = pocketL.clone(); pocketR.position.x = 0.13;
  body.add(torso, belly, belt, pocketL, pocketR);

  // head
  const head = new THREE.Group();
  head.position.set(0, 1.62, 0);
  const skull = inkMesh(new THREE.SphereGeometry(0.17, 16, 12), SKIN);
  skull.scale.set(1, 1.08, 1);
  const hairBand = inkMesh(new THREE.CylinderGeometry(0.175, 0.175, 0.09, 16, 1, true, Math.PI * 0.75, Math.PI * 1.5), HAIR, 0.01);
  hairBand.position.y = 0.0;
  const nose = inkMesh(new THREE.SphereGeometry(0.045, 8, 6), 0xb57a4c, 0.01);
  nose.position.set(0, -0.01, 0.17);
  const mo = inkBox(0.2, 0.05, 0.05, HAIR, 0, -0.08, 0.15, 0.01);
  mo.rotation.x = 0.2;
  const moL = inkBox(0.06, 0.04, 0.04, HAIR, -0.11, -0.1, 0.13, 0.008); moL.rotation.z = 0.5;
  const moR = inkBox(0.06, 0.04, 0.04, HAIR, 0.11, -0.1, 0.13, 0.008); moR.rotation.z = -0.5;
  const specs = [];
  for (const sx of [-1, 1]) {
    const lens = inkMesh(new THREE.TorusGeometry(0.045, 0.01, 6, 14), 0x111111, 0.004);
    lens.position.set(sx * 0.065, 0.04, 0.155);
    specs.push(lens);
  }
  const brows = [];
  for (const sx of [-1, 1]) {
    const b = inkBox(0.08, 0.02, 0.02, HAIR, sx * 0.065, 0.095, 0.155, 0.006);
    brows.push(b);
  }
  head.add(skull, hairBand, nose, mo, moL, moR, ...specs, ...brows);
  body.add(head);

  // left arm hangs; right arm holds the torch out in front
  const armL = new THREE.Group();
  armL.position.set(-0.34, 1.45, 0);
  armL.add(inkBox(0.12, 0.6, 0.13, SUIT, 0, -0.6, 0));
  const handL = inkMesh(new THREE.SphereGeometry(0.06, 8, 6), SKIN, 0.01); handL.position.y = -0.63;
  armL.add(handL);
  armL.rotation.z = 0.12;
  body.add(armL);

  const torchPivot = new THREE.Group();          // rotates with his torch sweep
  torchPivot.position.set(0, 1.3, 0);
  body.add(torchPivot);
  const armR = inkBox(0.12, 0.13, 0.5, SUIT, 0.32, -0.06, 0.2);
  const handR = inkMesh(new THREE.SphereGeometry(0.06, 8, 6), SKIN, 0.01); handR.position.set(0.32, 0, 0.48);
  const torch = inkMesh(new THREE.CylinderGeometry(0.045, 0.035, 0.26, 10), 0x2b2b2b, 0.01);
  torch.rotation.x = Math.PI / 2;
  torch.position.set(0.32, 0.02, 0.55);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.044, 14), new THREE.MeshBasicMaterial({ color: 0xfff4c8 }));
  lens.position.set(0.32, 0.02, 0.685);
  torchPivot.add(armR, handR, torch, lens);

  const pitch = -0.1;
  const spot = new THREE.SpotLight(0xffefc4, 90, BEAM_RANGE + 3, BEAM_HALF_ANGLE, 0.35, 1.2);
  spot.position.set(0.32, 0.02, 0.7);
  spot.castShadow = true;
  spot.shadow.mapSize.set(shadowSize, shadowSize);
  spot.shadow.camera.near = 0.3;
  spot.shadow.bias = -0.002;
  const target = new THREE.Object3D();
  target.position.set(0.32, 0.02 + Math.sin(pitch) * 8, 0.7 + 8);
  spot.target = target;
  if (torchLight) torchPivot.add(spot, target);

  const L = 9;
  const coneGeo = new THREE.ConeGeometry(Math.tan(BEAM_HALF_ANGLE) * L, L, 28, 1, true);
  coneGeo.translate(0, -L / 2, 0);   // apex at the origin, opening down -y
  coneGeo.rotateX(-Math.PI / 2);     // now opening along +z
  const beam = new THREE.Mesh(coneGeo, beamMaterial());
  beam.position.copy(spot.position);
  beam.rotation.x = -pitch;
  beam.renderOrder = 10;
  if (torchLight) torchPivot.add(beam);

  group.traverse((o) => { if (o.isMesh && !o.userData.isHull && o !== beam && o !== lens) o.castShadow = true; });
  beam.castShadow = false;

  let phase = 0, mood = 'calm', moodT = 0;
  return {
    group,
    beam,
    head,
    setMood(m) { mood = m; moodT = 2.5; },
    // With the tube lights on he puts his torch away.
    setTorch(on) {
      spot.intensity = on ? 90 : 0;
      beam.visible = on;
      lens.material.color.set(on ? 0xfff4c8 : 0x333333);
    },
    update(w, dt) {
      group.position.set(w.x, 0, w.z);
      group.rotation.y = w.yaw;
      torchPivot.rotation.y = w.lookOffset;
      head.rotation.y = w.lookOffset * 0.8;
      const speed = w.mode === 'chase' ? 2 : 1;
      if (w.moving) phase += dt * 7 * speed; else phase *= 0.9;
      const swing = Math.sin(phase) * (w.moving ? 0.45 : 0);
      legs[0].rotation.x = swing; legs[1].rotation.x = -swing;
      armL.rotation.x = -swing * 0.8;
      body.position.y = Math.abs(Math.cos(phase)) * (w.moving ? 0.04 : 0);
      belly.scale.y = 0.95 + Math.sin(phase * 2) * (w.moving ? 0.03 : 0.01);
      // eyebrows act out his mood
      moodT -= dt;
      const m = moodT > 0 ? mood : (w.mode === 'chase' ? 'angry' : w.mode === 'calm' ? 'calm' : (w.meter > 0.2 ? 'alert' : 'calm'));
      const tilt = m === 'angry' ? 0.45 : m === 'alert' ? -0.25 : 0;
      const lift = m === 'alert' ? 0.03 : 0;
      brows[0].rotation.z = -tilt; brows[1].rotation.z = tilt;
      brows[0].position.y = brows[1].position.y = 0.095 + lift;
    },
    // Head position in world space, for speech bubbles.
    headWorld(out = new THREE.Vector3()) {
      return head.getWorldPosition(out).add(new THREE.Vector3(0, 0.35, 0));
    },
    toon,
  };
}
