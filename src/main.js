// Boots the game: renderer, scene, the loop, and the glue between you,
// Warden Saab and the screen.
import * as THREE from 'three';
import { createMap, WARDEN_START, WARDEN_ROUTE, doorAt, solidForPlayer, areaName } from '../shared/map.js';
import { createWarden, updateWarden, resumePatrol } from '../shared/warden-ai.js';
import { buildWorld } from './render/world.js';
import { createWardenModel } from './render/warden.js';
import { inkBox } from './render/toon.js';
import { createInput } from './input.js';
import { createPlayer, updatePlayer, respawn, forward, RADIUS } from './player.js';
import { createHud, showOverlay } from './hud.js';
import * as sfx from './audio.js';

const START_MINUTES = 90;            // 1:30 AM
const MINUTES_PER_SECOND = 1 / 3;    // game clock speed
const CAUGHT_LINES = [
  'Raat ke do baje Maggi?! Chal kamre mein!',
  'Exam kal hai aur janab ghoom rahe hain!',
  'Naam register mein likh raha hoon. Kamre mein jao!',
  'Tumhare papa ko phone karoon kya?!',
  'Lights off ka matlab SONA hai, beta!',
];

await document.fonts?.load('48px "Bangers"').catch(() => {});

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04050b);
scene.fog = new THREE.Fog(0x04050b, 5, 24);

const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 60);
scene.add(camera);

// Moonlight leaking in: just enough to make out shapes.
scene.add(new THREE.HemisphereLight(0x6f80b8, 0x221f28, 1.15));

const map = createMap();
const world = buildWorld(map);
scene.add(world.root);

const warden = createWarden(map, WARDEN_START, WARDEN_ROUTE);
const wardenModel = createWardenModel();
scene.add(wardenModel.group);

const player = createPlayer(map.spawn);
const input = createInput(canvas);
const hud = createHud();

// Your phone, in your hand, with its torch.
const phone = new THREE.Group();
const hand = inkBox(0.07, 0.09, 0.1, 0xc68b59, 0, -0.05, 0.02, 0.006);
const handset = inkBox(0.075, 0.15, 0.012, 0x1a1a22, 0, 0, 0, 0.006);
const led = new THREE.Mesh(new THREE.CircleGeometry(0.008, 10), new THREE.MeshBasicMaterial({ color: 0x555555 }));
led.position.set(0.02, 0.06, -0.008);
led.rotation.y = Math.PI;
phone.add(hand, handset, led);
phone.position.set(0.15, -0.2, -0.42);
phone.rotation.set(-0.35, -0.2, 0);
phone.scale.setScalar(0.75);
camera.add(phone);
const torch = new THREE.SpotLight(0xf3f6ff, 0, 12, 0.55, 0.7, 1.6);
torch.position.set(0.16, -0.1, -0.5);
const torchTarget = new THREE.Object3D();
torchTarget.position.set(0, -0.6, -6);
camera.add(torch, torchTarget);
torch.target = torchTarget;

let state = 'title';
let minutes = START_MINUTES;
let caughtCount = 0;
let wardenStepT = 0;
let stepSide = 0;

let sizeW = 0, sizeH = 0;
function resize() {
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
  if (w === sizeW && h === sizeH) return;
  sizeW = w; sizeH = h;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---- overlays and pause
function startPlaying() {
  sfx.startAudio();
  input.lock();
  state = 'playing';
  showOverlay(null);
}
document.getElementById('start').addEventListener('click', startPlaying);
document.getElementById('resume').addEventListener('click', startPlaying);
document.addEventListener('pointerlockchange', () => {
  if (!input.locked && state === 'playing') { state = 'paused'; showOverlay('pause'); }
});
addEventListener('keydown', (e) => {
  if (e.code === 'KeyP' && state === 'playing') { state = 'paused'; document.exitPointerLock?.(); showOverlay('pause'); }
  if (state === 'caught' && caughtReady) backToRoom();
  if (e.code === 'KeyM') sfx.setMuted(!(muted = !muted));
});
let muted = false;
let caughtReady = false;
document.getElementById('caught').addEventListener('click', () => { if (caughtReady) backToRoom(); });

function getCaught() {
  state = 'caught';
  caughtCount++;
  caughtReady = false;
  sfx.sting('caught');
  document.getElementById('caught-line').textContent = `"${CAUGHT_LINES[(caughtCount - 1) % CAUGHT_LINES.length]}"`;
  document.getElementById('caught-count').textContent = `Pakde gaye: ${caughtCount} baar`;
  document.exitPointerLock?.();
  showOverlay('caught');
  setTimeout(() => { caughtReady = true; }, 900);
}

function backToRoom() {
  respawn(player, map.spawn);
  const myDoor = doorAt(map, 2, 8);
  myDoor.open = false;
  // He marches back to his desk to write your name in the register.
  warden.x = WARDEN_ROUTE[0].x; warden.z = WARDEN_ROUTE[0].z;
  resumePatrol(warden);
  hud.clearBubbles();
  startPlaying();
}

// ---- interaction: doors in front of you
function lookedAtDoor() {
  const f = forward(player);
  for (const d of [0.45, 0.8, 1.15, 1.5]) {
    const cx = Math.floor(player.x + f.x * d), cz = Math.floor(player.z + f.z * d);
    const door = doorAt(map, cx, cz);
    if (door) return door;
    if (solidForPlayer(map, cx, cz)) return null;
  }
  return null;
}

function playerInCell(cx, cz) {
  const px = Math.max(cx, Math.min(player.x, cx + 1)), pz = Math.max(cz, Math.min(player.z, cz + 1));
  return Math.hypot(player.x - px, player.z - pz) < RADIUS + 0.02;
}

const noisesThisFrame = [];
function interact(hudText) {
  const door = lookedAtDoor();
  if (!door) { hud.setPrompt(hudText); return; }
  if (door.kind === 'D') {
    hud.setPrompt(door.open ? '[E] Darwaza band karo' : '[E] Darwaza kholo');
    if (input.tapped('KeyE')) {
      if (door.open && playerInCell(door.x, door.z)) { hud.subtitle('Pehle darwaze se hato!', 1.5); return; }
      door.open = !door.open;
      const pos = new THREE.Vector3(door.x + 0.5, 1.6, door.z + 0.5);
      hud.sfx(door.open ? 'CHURRR...' : 'DHAP!', pos, 0.8);
      sfx.doorCreak(1, 0);
      noisesThisFrame.push({ x: door.x + 0.5, z: door.z + 0.5, r: door.open ? 3 : 4.5, kind: 'door' });
    }
  } else {
    hud.setPrompt(door.kind === 'G' ? 'Grill gate: taala laga hai' : 'Main gate: chain aur taala');
    if (input.tapped('KeyE')) {
      hud.subtitle('Taala laga hai. Jugaad chahiye...', 2);
      hud.sfx('KHATAK!', new THREE.Vector3(door.x + 0.5, 1.3, door.z + 0.5), 0.8);
      sfx.gateClang(1, 0);
      noisesThisFrame.push({ x: door.x + 0.5, z: door.z + 0.5, r: 6, kind: 'rattle' });
    }
  }
}

// Where is a world point relative to your ears? For panning.
function earOf(x, z) {
  const dx = x - player.x, dz = z - player.z;
  const dist = Math.hypot(dx, dz) || 0.001;
  const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  return { dist, pan: (dx * rx + dz * rz) / dist };
}

const headPos = () => wardenModel.headWorld();

// ---- the loop
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  resize();

  if (state === 'playing') {
    const torchWas = player.torch;
    const noises = updatePlayer(player, dt, input, map);
    if (player.torch !== torchWas) sfx.torchClick();
    for (const n of noises) {
      sfx.footstep(n.gait);
      if (n.gait === 'run') hud.sfx(stepSide++ % 2 ? 'DHAP' : 'DHUP', new THREE.Vector3(n.x, 0.3, n.z), 0.6, 0.6);
    }
    noisesThisFrame.length = 0;
    interact(null);
    noises.push(...noisesThisFrame);

    const events = updateWarden(warden, dt, player, noises);
    for (const e of events) {
      if (e.type === 'say') {
        hud.say(e.line, headPos, e.mood);
        wardenModel.setMood(e.mood);
        if (e.mood === 'angry') sfx.sting('chase'); else if (e.mood === 'alert') sfx.sting('alert');
      } else if (e.type === 'door') {
        const { x, z } = e.door;
        const ear = earOf(x + 0.5, z + 0.5);
        const pos = new THREE.Vector3(x + 0.5, 1.4, z + 0.5);
        if (e.door.kind === 'D') { sfx.doorCreak(ear.dist, ear.pan); hud.sfx('CHURRR', pos, 0.8); }
        else { sfx.gateClang(ear.dist, ear.pan); hud.sfx(e.closed ? 'KHATAK!' : 'KHAT-KHAT!', pos, 1); }
      } else if (e.type === 'caught') {
        getCaught();
      }
    }

    // His chappals, heard (and seen, comic-style) through the walls.
    if (warden.moving) {
      wardenStepT += dt;
      const every = warden.mode === 'chase' ? 0.26 : 0.45;
      if (wardenStepT > every) {
        wardenStepT = 0;
        const ear = earOf(warden.x, warden.z);
        sfx.wardenStep(ear.dist, ear.pan, warden.mode === 'chase');
        if (ear.dist < 11) hud.sfx('thap', new THREE.Vector3(warden.x, 0.25, warden.z), 0.55, 0.5);
      }
    }

    minutes += dt * MINUTES_PER_SECOND;
    input.endFrame();
  } else {
    hud.setPrompt(null);
    input.look();
    input.endFrame();
  }

  // camera
  const bob = player.moving ? Math.sin(player.bob) * (player.running ? 0.05 : 0.025) : 0;
  camera.position.set(player.x, player.eye + bob, player.z);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  if (window.__debugCam) {           // dev only: look from anywhere
    camera.position.set(...window.__debugCam.pos);
    camera.lookAt(...window.__debugCam.at);
  }
  torch.intensity = player.torch ? 7 : 0;
  led.material.color.set(player.torch ? 0xffffff : 0x444444);
  phone.position.y = -0.2 + (player.moving ? Math.abs(Math.cos(player.bob)) * 0.012 : 0);

  wardenModel.update(warden, dt);
  world.update(dt);
  hud.setMeter(warden.meter, warden.mode);
  hud.setStatus({ minutes, areaName: areaName(player.x, player.z), torch: player.torch, crouch: player.crouch, running: player.running });
  hud.update(dt, camera, sizeW, sizeH);

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
showOverlay('title');
requestAnimationFrame(frame);

// For poking at the game from the browser console.
window.__game = { map, player, warden, scene, camera, get state() { return state; }, set state(s) { state = s; } };
