// Boots the game: renderer, scene, the loop, and the glue between you,
// Warden Saab, the jugaad rules and the screen.
import * as THREE from 'three';
import { createMap, WARDEN_START, WARDEN_ROUTE, areaName } from '../shared/map.js';
import { createWarden, updateWarden, resumePatrol } from '../shared/warden-ai.js';
import {
  ITEMS, MY_DOOR, CANTEEN, createJugaad, actionsFor, perform, lockedHint, combine, recipeFor,
  selected, dropItem, setAlarm, updateJugaad, chowkidarHears, grabTick, confiscateHeld, tailgated, score,
} from '../shared/jugaad.js';
import { buildWorld } from './render/world.js';
import { createWardenModel } from './render/warden.js';
import { createChowkidarModel } from './render/chowkidar.js';
import { createWorldItems, itemSprite } from './render/items.js';
import { inkBox } from './render/toon.js';
import { createInput } from './input.js';
import { createPlayer, updatePlayer, respawn, forward, RADIUS } from './player.js';
import { findTarget, landingPoint } from './interact.js';
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
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04050b);
scene.fog = new THREE.Fog(0x04050b, 5, 24);

const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 60);
scene.add(camera);

// Moonlight leaking in: just enough to make out shapes.
scene.add(new THREE.HemisphereLight(0x6f80b8, 0x221f28, 1.15));

const map = createMap();
const jug = createJugaad(map);
const world = buildWorld(map);
scene.add(world.root);

const warden = createWarden(map, WARDEN_START, WARDEN_ROUTE);
const wardenModel = createWardenModel();
scene.add(wardenModel.group);
const chowModel = createChowkidarModel();
scene.add(chowModel.group);
const worldItems = createWorldItems(scene);

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
// Whatever else you are holding, in the other hand.
let heldSprite = null, heldId = null;
function showHeld(id) {
  if (id === heldId) return;
  heldId = id;
  if (heldSprite) { camera.remove(heldSprite); heldSprite = null; }
  if (!id || id === 'phone') return;
  heldSprite = itemSprite(id, 0.075);
  heldSprite.position.set(-0.17, -0.15, -0.4);
  camera.add(heldSprite);
}

let state = 'title';
let minutes = START_MINUTES;
let caughtCount = 0;
let wardenStepT = 0;
let stepSide = 0;
let time = 0;
let hold = null;              // { key, action, target, t, noiseT }
let holdLatch = false;        // E must be released before the next action
let prevX = player.x;

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
document.getElementById('again').addEventListener('click', () => location.reload());
document.addEventListener('pointerlockchange', () => {
  if (!input.locked && state === 'playing') { state = 'paused'; showOverlay('pause'); }
});
let muted = false;
let caughtReady = false;
addEventListener('keydown', (e) => {
  if (e.code === 'KeyP' && state === 'playing') { state = 'paused'; document.exitPointerLock?.(); showOverlay('pause'); }
  if (state === 'caught' && caughtReady) backToRoom();
  if (e.code === 'KeyM') { muted = !muted; sfx.setMuted(muted); }
});
document.getElementById('caught').addEventListener('click', () => { if (caughtReady) backToRoom(); });
canvas.addEventListener('mousedown', (e) => { if (e.button === 0 && state === 'playing' && input.locked) throwSelected(); });
addEventListener('wheel', (e) => {
  if (state !== 'playing' || !jug.inv.length) return;
  jug.sel = (jug.sel + (e.deltaY > 0 ? 1 : -1) + jug.inv.length) % jug.inv.length;
}, { passive: true });

function getCaught() {
  state = 'caught';
  caughtCount++;
  caughtReady = false;
  hold = null;
  sfx.sting('caught');
  const taken = confiscateHeld(jug);
  document.getElementById('caught-line').textContent = `"${CAUGHT_LINES[(caughtCount - 1) % CAUGHT_LINES.length]}"`;
  document.getElementById('caught-taken').textContent = taken
    ? `${ITEMS[taken].icon} ${ITEMS[taken].name} confiscate! (Uski almirah mein gaya...)` : '';
  document.getElementById('caught-count').textContent = `Pakde gaye: ${caughtCount} baar`;
  document.exitPointerLock?.();
  showOverlay('caught');
  setTimeout(() => { caughtReady = true; }, 900);
}

function backToRoom() {
  respawn(player, map.spawn);
  prevX = player.x;
  const myDoor = map.doors.get(MY_DOOR);
  if (!myDoor.locked) myDoor.open = false;
  // He marches back to his desk to write your name in the register.
  warden.x = WARDEN_ROUTE[0].x; warden.z = WARDEN_ROUTE[0].z;
  resumePatrol(warden);
  hud.clearBubbles();
  startPlaying();
}

function win() {
  state = 'won';
  hold = null;
  document.exitPointerLock?.();
  const s = score(jug, caughtCount);
  const list = document.getElementById('score-lines');
  list.innerHTML = '';
  for (const l of s.lines) {
    const li = document.createElement('li');
    li.className = l.kind;
    li.innerHTML = `<span></span><b>${l.points > 0 ? '+' : ''}${l.points}</b>`;
    li.firstChild.textContent = l.text;
    list.appendChild(li);
  }
  document.getElementById('score-total').textContent = s.total;
  document.getElementById('score-title').textContent = s.title;
  const h = Math.floor(minutes / 60), m = Math.floor(minutes % 60);
  document.getElementById('score-time').textContent = `Maggi Point pahunche: ${h}:${String(m).padStart(2, '0')} AM`;
  sfx.sting('alert');
  showOverlay('won');
}

// ---- events from the rules into sound and comic text
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
function earOf(x, z) {
  const dx = x - player.x, dz = z - player.z;
  const dist = Math.hypot(dx, dz) || 0.001;
  const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  return { dist, pan: (dx * rx + dz * rz) / dist };
}
const wardenHead = () => wardenModel.headWorld();
const chowHead = () => chowModel.headWorld();

function handle(events, noises) {
  for (const e of events) {
    if (e.type === 'noise') noises.push({ x: e.x, z: e.z, r: e.r });
    else if (e.type === 'sfx') {
      if (e.quiet && Math.hypot(e.x - player.x, e.z - player.z) > 7) continue;
      hud.sfx(e.text, v3(e.x, 1.5, e.z), e.size || 1, e.quiet ? 1.4 : 0.9);
      if (/DHADAAM|CRAAASH/.test(e.text)) sfx.gateClang(1, 0);
      if (/TINK|KLIK|KHATAK/.test(e.text)) sfx.torchClick();
    } else if (e.type === 'msg') hud.subtitle(e.text, 3);
    else if (e.type === 'got') {
      for (const id of e.items) hud.toast(`${ITEMS[id].icon} ${ITEMS[id].name} mil gaya!`);
      sfx.sting('got');
    } else if (e.type === 'say') {
      if (e.who === 'warden') { hud.say(e.line, wardenHead, 'alert'); wardenModel.setMood('angry'); }
      else if (e.who === 'chowkidar') hud.say(e.line, chowHead, /CHOR/.test(e.line) ? 'angry' : '', 'Chowkidar');
      else hud.say(e.line, v3(e.x, 2.1, e.z), 'angry', 'Kamre se awaaz');
    }
  }
}

// ---- inventory actions
function throwSelected() {
  const id = selected(jug);
  if (!id || !ITEMS[id].props.includes('throw')) return;
  const land = landingPoint(player, map);
  const it = ITEMS[id];
  const w = dropItem(jug, id, land.x, land.z);
  jug.worldItems = jug.worldItems.filter((x) => x !== w);     // in the air for now
  worldItems.throwFlight(id, v3(player.x, player.eye - 0.2, player.z), land, () => {
    jug.worldItems.push(w);
    pendingNoises.push({ x: land.x, z: land.z, r: it.throwNoise });
    hud.sfx(it.sfx, v3(land.x, 0.8, land.z), 1.1);
    const ear = earOf(land.x, land.z);
    sfx.gateClang(ear.dist, ear.pan);
  });
  if (!jug.distractions.has('throw')) { jug.distractions.add('throw'); jug.log.push({ text: `${it.name} phenk ke dhyaan bhatkaya`, kind: 'distraction', points: 25 }); }
}
const pendingNoises = [];

function inventoryKeys() {
  for (let i = 0; i < 6; i++) if (input.tapped(`Digit${i + 1}`) && i < jug.inv.length) jug.sel = i;
  if (input.tapped('KeyG')) {
    const r = recipeFor(jug);
    if (r && r.ready) {
      combine(jug);
      hud.subtitle(r.line, 3);
      hud.bigPop('JUGAAD!');
      sfx.sting('got');
    } else if (r) hud.subtitle(`${ITEMS[r.other].name} bhi chahiye.`, 2);
    else hud.subtitle('Isse kuch nahi banta.', 1.5);
  }
  if (input.tapped('KeyQ')) {
    const id = selected(jug);
    if (!id) return;
    const f = forward(player);
    const x = player.x + f.x * 0.5, z = player.z + f.z * 0.5;
    if (id === 'phone') {
      setAlarm(jug, x, z);
      player.torch = false;
      hud.subtitle('Phone pe 8 second ka alarm laga ke rakh diya. Bhaago!', 3);
    } else {
      dropItem(jug, id, x, z);
    }
  }
  if (input.tapped('KeyV')) throwSelected();
}

// ---- E: look, act, hold
function interact(dt, noises) {
  const target = findTarget(player, jug);
  let actions = target ? actionsFor(jug, target, { dist: target.dist, inside: target.inside, crouch: player.crouch }) : [];
  if (target && target.type === 'door' && target.door.kind === 'D' && actions[0]?.id === 'toggle' && target.door.open && playerInDoor(target.door)) {
    actions = [];
  }
  const action = actions[0] || null;
  if (!input.held('KeyE')) holdLatch = false;

  if (!target) { hud.setPrompt(null); hold = null; return; }
  if (!action) {
    hud.setPrompt(target.type === 'door' && !target.door.locked ? null : (lockedHint(jug, target) || null), true);
    hold = null;
    return;
  }
  const others = actions.slice(1).map((a) => a.label);
  hud.setPrompt(`[E${action.hold ? ' hold' : ''}] ${action.label}`, false, others.length ? `ya: ${others.join(' · ')}` : '');

  const key = `${target.key}:${action.id}`;
  if (input.held('KeyE') && !holdLatch) {
    if (!action.hold) {
      holdLatch = true;
      handle(perform(jug, target, action, { crouch: player.crouch }), noises);
      return;
    }
    if (!hold || hold.key !== key) hold = { key, action, target, t: 0, noiseT: 0 };
    hold.t += dt;
    hold.noiseT += dt;
    if (action.noise && hold.noiseT > 1) {
      hold.noiseT = 0;
      noises.push({ x: target.at.x, z: target.at.z, r: action.noise });
      hud.sfx(action.id === 'pickGrill' ? 'khat-khut' : 'khrr', v3(target.at.x, 1.2, target.at.z), 0.6, 0.6);
    }
    if (action.id === 'grabKeys') grabTick(jug, dt, player.crouch);
    if (hold.t >= action.hold) {
      holdLatch = true;
      hold = null;
      handle(perform(jug, target, action, { crouch: player.crouch }), noises);
    }
  } else {
    hold = null;
  }
}

function playerInDoor(door) {
  const px = Math.max(door.x, Math.min(player.x, door.x + 1)), pz = Math.max(door.z, Math.min(player.z, door.z + 1));
  return Math.hypot(player.x - px, player.z - pz) < RADIUS + 0.02;
}

// ---- the loop
let lastT = performance.now();
function frame() {
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  tick(dt);
  requestAnimationFrame(frame);
}

function tick(dt) {
  time += dt;
  resize();

  if (state === 'playing') {
    const torchWas = player.torch;
    const noises = updatePlayer(player, dt, input, map);
    if (player.torch && !jug.inv.includes('phone')) {
      player.torch = false;
      if (!torchWas) hud.subtitle('Phone hi nahi hai! Torch kaise jalaoge?', 2);
    }
    if (player.torch !== torchWas) sfx.torchClick();
    for (const n of noises) {
      sfx.footstep(n.gait);
      if (n.gait === 'run') hud.sfx(stepSide++ % 2 ? 'DHAP' : 'DHUP', v3(n.x, 0.3, n.z), 0.6, 0.6);
    }
    noises.push(...pendingNoises.splice(0));
    inventoryKeys();
    interact(dt, noises);

    // Slipping through the grill while he holds it open.
    const grill = map.doors.get('25,6');
    if (prevX < 25 && prevX > 24 && player.x >= 25 && player.z > 6 && player.z < 8 && grill.locked) tailgated(jug);
    prevX = player.x;

    handle(updateJugaad(jug, dt, { player, warden }), noises);
    chowkidarHears(jug, noises);

    const events = updateWarden(warden, dt, player, noises);
    for (const e of events) {
      if (e.type === 'say') {
        hud.say(e.line, wardenHead, e.mood);
        wardenModel.setMood(e.mood);
        if (e.mood === 'angry') sfx.sting('chase'); else if (e.mood === 'alert') sfx.sting('alert');
      } else if (e.type === 'door') {
        const { x, z } = e.door;
        const ear = earOf(x + 0.5, z + 0.5);
        const pos = v3(x + 0.5, 1.4, z + 0.5);
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
        if (ear.dist < 11) hud.sfx('thap', v3(warden.x, 0.25, warden.z), 0.55, 0.5);
      }
    }

    if (Math.hypot(player.x - CANTEEN.x, player.z - CANTEEN.z) < CANTEEN.r) win();
    minutes += dt * MINUTES_PER_SECOND;
    input.endFrame();
  } else {
    hud.setPrompt(null);
    hold = null;
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
  phone.visible = jug.inv.includes('phone');
  phone.position.y = -0.2 + (player.moving ? Math.abs(Math.cos(player.bob)) * 0.012 : 0);
  showHeld(selected(jug));

  wardenModel.update(warden, dt);
  chowModel.update(jug.chowkidar, dt);
  worldItems.update(dt, jug.worldItems, time);
  world.update(dt);
  hud.setMeter(warden.meter, warden.mode);
  hud.setStatus({ minutes, areaName: areaName(player.x, player.z), torch: player.torch, crouch: player.crouch, running: player.running });
  hud.setInventory(jug, recipeFor(jug));
  hud.setHold(hold ? hold.t / hold.action.hold : 0);
  hud.update(dt, camera, sizeW, sizeH);

  renderer.render(scene, camera);
}
showOverlay('title');
requestAnimationFrame(frame);

// For poking at the game from the browser console.
window.__game = {
  map, jug, player, warden, scene, camera, renderer,
  // Advance the game by `seconds` without waiting for frames (for testing).
  step(seconds) { for (let t = 0; t < seconds; t += 1 / 60) tick(1 / 60); }, get state() { return state; }, set state(s) { state = s; } };
