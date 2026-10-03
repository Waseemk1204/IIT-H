// Boots the game: renderer, scene, the loop, and the glue between you,
// Warden Saab, the jugaad rules and the screen.
import * as THREE from 'three';
import { createMap, WARDEN_START, WARDEN_ROUTE, OUTSIDE_ROUTE, inMyRoom, areaName } from '../shared/map.js';
import { createWarden, updateWarden, resumePatrol, sendWarden } from '../shared/warden-ai.js';
import {
  ITEMS, MY_DOOR, SMELL_R, loseMaggi, createJugaad, actionsFor, perform, lockedHint, combine, recipeFor,
  selected, dropItem, setAlarm, updateJugaad, chowkidarHears, grabTick, confiscateHeld, tailgated, score,
  startAct2, restorePower, STUDY_CIRCLES, FUSE_BOX,
} from '../shared/jugaad.js';
import { createStudents } from './render/students.js';
import { playComic } from './cutscenes.js';
import { buildWorld } from './render/world.js';
import { createWardenModel } from './render/warden.js';
import { createChowkidarModel } from './render/chowkidar.js';
import { createWorldItems } from './render/items.js';
import { createViewmodel, ACTION_ANIM } from './render/viewmodel.js';
import { createBhaiya } from './render/bhaiya.js';
import { makeItemModel } from './render/props.js';
import { inkBox, canvasTexture } from './render/toon.js';
import { createInput, isTouch } from './input.js';
import { createPlayer, updatePlayer, respawn, forward, RADIUS } from './player.js';
import { findTarget, landingPoint } from './interact.js';
import { createHud, showOverlay } from './hud.js';
import * as sfx from './audio.js';

const START_MINUTES = 90;            // 1:30 AM
const MINUTES_PER_SECOND = 1 / 10;   // game clock: 1:30 to 3:00 AM is 15 real minutes
const CLOSING = 180;
const CHANCES = 5;                   // caught this many times: Papa ko phone, detention                 // 3:00 AM: Bhaiya pulls the shutter down
const CAUGHT_LINES = [
  'Raat ke do baje Maggi?! Chal kamre mein!',
  'Exam kal hai aur janab ghoom rahe hain!',
  'Naam register mein likh raha hoon. Kamre mein jao!',
  'Tumhare papa ko phone karoon kya?!',
  'Lights off ka matlab SONA hai, beta!',
];

await document.fonts?.load('48px "Bangers"').catch(() => {});

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
// Resolution: phones start lower, and it adapts to keep the frame rate up.
const MAX_PR = Math.min(devicePixelRatio, isTouch ? 1.5 : 2);
let pixelRatio = isTouch ? Math.min(MAX_PR, 1.25) : MAX_PR;
renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;          // two passes: the world, then your hands on top

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04050b);
scene.fog = new THREE.Fog(0x04050b, 5, 24);

const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 60);
scene.add(camera);

// Moonlight leaking in: just enough to make out shapes.
const hemi = new THREE.HemisphereLight(0x6f80b8, 0x221f28, 1.15);
scene.add(hemi);
const DARK = { sky: new THREE.Color(0x6f80b8), ground: new THREE.Color(0x221f28), i: 1.15, fog: 24 };
const LIT = { sky: new THREE.Color(0xf4f2ea), ground: new THREE.Color(0x5d574e), i: 2.1, fog: 55 };
// Light the scene for a power level between 0 (dark) and 1 (tube lights on).
function applyPower(p) {
  hemi.color.copy(DARK.sky).lerp(LIT.sky, p);
  hemi.groundColor.copy(DARK.ground).lerp(LIT.ground, p);
  hemi.intensity = DARK.i + (LIT.i - DARK.i) * p;
  scene.fog.far = DARK.fog + (LIT.fog - DARK.fog) * p;
}
// Only used for the opening comic: your room with its light on.
const roomLamp = new THREE.PointLight(0xfff1d6, 0, 7, 1.3);
roomLamp.position.set(2.5, 2.6, 10.5);
roomLamp.visible = false;            // switched on only while drawing those panels
scene.add(roomLamp);

const map = createMap();
const jug = createJugaad(map);
const world = buildWorld(map, { lite: isTouch });
scene.add(world.root);

const warden = createWarden(map, WARDEN_START, WARDEN_ROUTE);
const wardenModel = createWardenModel({ shadowSize: isTouch ? 512 : 1024 });
scene.add(wardenModel.group);
const chowModel = createChowkidarModel();
scene.add(chowModel.group);
const worldItems = createWorldItems(scene);
const students = createStudents(scene, STUDY_CIRCLES);
// A second Warden Saab, for the ending: standing at the Maggi stall.
const cutWarden = createWardenModel({ torchLight: false });
cutWarden.group.visible = false;
cutWarden.setTorch(false);
scene.add(cutWarden.group);
const bowls = [];
for (const x of [36.15, 35.5]) {
  const b = new THREE.Group();
  b.add(inkBox(0.26, 0.1, 0.26, 0xf2f2ee, 0, 0, 0, 0.01));
  b.add(inkBox(0.22, 0.05, 0.22, 0xf0c33c, 0, 0.08, 0, 0.006));   // Maggi
  b.position.set(x, 0.95, 18.3);
  b.visible = false;
  scene.add(b); bowls.push(b);
}

const player = createPlayer(map.spawn);
const input = createInput(canvas);
const hud = createHud();
hud.onSlot = (i) => { if (i < jug.inv.length) jug.sel = i; };

// Your hands (drawn in their own pass) and the phone torch in the left one.
const vm = createViewmodel();
const torch = new THREE.SpotLight(0xf3f6ff, 0, 12, 0.55, 0.7, 1.6);
torch.position.set(-0.18, -0.12, -0.5);
const torchTarget = new THREE.Object3D();
torchTarget.position.set(0, -0.6, -6);
camera.add(torch, torchTarget);
torch.target = torchTarget;
// Your Maggi, waiting on the counter when it's ready, and on your desk in the last comic.
const readyBowl = makeItemModel('maggi');
readyBowl.scale.setScalar(1.8);
readyBowl.position.set(37.3, 0.96, 18.3);
readyBowl.visible = false;
scene.add(readyBowl);
const plate = makeItemModel('maggi');
plate.scale.setScalar(1.5);
plate.position.set(1.55, 0.76, 9.45);
plate.visible = false;
scene.add(plate);

// Bhaiya, at his stall.
const bhaiya = createBhaiya(scene);
const bhaiyaHead = () => bhaiya.headWorld();

let state = 'title';
let minutes = START_MINUTES;
let caughtCount = 0;
let wardenStepT = 0;
let stepSide = 0;
let time = 0;
let hold = null;              // { key, action, target, t, noiseT }
let holdLatch = false;        // E must be released before the next action
let prevX = player.x;
let wasSeated = false;
let warned15 = false;
let canUseNow = false;
let smellT = 0, chaiT = 0, torchAway = false, orderedAt = START_MINUTES;

let sizeW = 0, sizeH = 0;
function resize() {
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
  if (w === sizeW && h === sizeH) return;
  sizeW = w; sizeH = h;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  vm.resize(w / h);
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
// Settings that stick between visits (if the browser lets us store them).
const store = {
  get(k, d) { try { const v = localStorage.getItem(`mkkb-${k}`); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`mkkb-${k}`, JSON.stringify(v)); } catch { /* private mode */ } },
};
let sensitivity = store.get('sens', 1);
const sens = document.getElementById('sens');
sens.value = sensitivity;
sens.addEventListener('input', () => { sensitivity = Number(sens.value); store.set('sens', sensitivity); });
document.getElementById('restart').addEventListener('click', () => location.reload());
document.getElementById('late-again').addEventListener('click', () => location.reload());
document.getElementById('det-again').addEventListener('click', () => location.reload());

// Full screen: the buttons on the title, pause menu and HUD all toggle it.
const fsButtons = document.querySelectorAll('.fs-btn');
const canFullscreen = document.fullscreenEnabled || document.webkitFullscreenEnabled;
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else await (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement);
  } catch { /* the browser said no */ }
}
function syncFullscreenButtons() {
  const on = !!(document.fullscreenElement || document.webkitFullscreenElement);
  for (const b of fsButtons) {
    b.hidden = !canFullscreen;
    if (b.classList.contains('fs-label')) b.textContent = on ? '⛶ EXIT FULL SCREEN' : '⛶ FULL SCREEN';
    b.title = on ? 'Exit full screen' : 'Full screen';
  }
}
for (const b of fsButtons) b.addEventListener('click', (e) => { e.stopPropagation(); toggleFullscreen(); });
document.addEventListener('fullscreenchange', syncFullscreenButtons);
document.addEventListener('webkitfullscreenchange', syncFullscreenButtons);
syncFullscreenButtons();

const portrait = matchMedia('(orientation: portrait)');
let introDone = false;
document.getElementById('start').addEventListener('click', async () => {
  sfx.startAudio();
  if (isTouch) {
    if (!document.fullscreenElement) try { await document.documentElement.requestFullscreen?.(); } catch { /* not allowed */ }
    try { await screen.orientation?.lock?.('landscape'); } catch { /* iPhone can't */ }
  }
  if (!introDone && !window.__skipComics) await playComic(openingPanels(), { title: 'Raat 1:29 baje...' });
  introDone = true;
  startPlaying();
});
document.getElementById('resume').addEventListener('click', startPlaying);
document.getElementById('again').addEventListener('click', () => location.reload());
document.addEventListener('pointerlockchange', () => {
  if (!input.locked && state === 'playing') { state = 'paused'; showOverlay('pause'); }
});
let muted = false;
let caughtReady = false;
addEventListener('keydown', (e) => {
  if (state === 'caught' && caughtReady) backToRoom();
  if (e.code === 'KeyM') { muted = !muted; sfx.setMuted(muted); }
});
document.getElementById('caught').addEventListener('click', () => { if (caughtReady) backToRoom(); });
canvas.addEventListener('mousedown', (e) => { if (e.button === 0 && state === 'playing' && input.locked) throwSelected(); });
addEventListener('wheel', (e) => {
  if (state !== 'playing' || !jug.inv.length) return;
  jug.sel = (jug.sel + (e.deltaY > 0 ? 1 : -1) + jug.inv.length) % jug.inv.length;
}, { passive: true });

function pause() {
  state = 'paused';
  hold = null;
  document.exitPointerLock?.();
  document.getElementById('pause-objective').textContent = objective();
  showOverlay('pause');
}

function tooLate() {
  state = 'late';
  hold = null;
  document.exitPointerLock?.();
  sfx.setTension(0);
  sfx.sting('caught');
  showOverlay('late');
}

// What should you be doing right now? Shown under the clock.
function objective() {
  if (map.doors.get(MY_DOOR).locked) return 'Kamre se niklo. Chaabi bahar taale mein hai. Almirah, bistar, table: talaashi lo!';
  if (!jug.solved.grill) return 'A-wing ka grill gate paar karo. Lock pick (bobby pin + compass), cricket bat, ya Warden Saab ke peeche-peeche.';
  if (!jug.solved.main) {
    if (jug.power.on) return 'Bijli wapas! Study circle mein chhupo, ya kettle + press + heater se fuse udaao. Phir: chowkidar ki chaabi.';
    return 'Main gate ki chaabi soye chowkidar ki belt pe hai. Ya lobby ki dheeli khidki...';
  }
  const m = jug.maggi;
  if (m.state === 'none') return 'Bahar niklo! Bhaiya ki Maggi Point pe order do (counter pe E).';
  if (m.state === 'cooking') return `Maggi ban rahi hai (${Math.ceil(m.t)}s). Warden Saab bahar ghoom rahe hain: andhere mein chhupo, lantern ke paas mat ruko!`;
  if (m.state === 'ready') return 'MAGGI READY! Counter se utha lo.';
  if (inMyRoom(player.x, player.z)) return 'Darwaza band karo, phir chupke se khao (E dabaye rakho). Slurp ki awaaz aati hai!';
  return 'Maggi lekar Room 106 wapas jao. Bhaago mat (garam hai!). Paas aaye toh Warden Saab ko khushboo aa jayegi...';
}

// While your Maggi cooks (or waits on the counter) he does his rounds outside.
const routeFor = () => (jug.maggi.state === 'cooking' || jug.maggi.state === 'ready' ? OUTSIDE_ROUTE : WARDEN_ROUTE);
function switchRoute() {
  const r = routeFor();
  if (warden.route === r) return;
  warden.route = r;
  if (warden.mode === 'patrol') resumePatrol(warden);
}

function getCaught() {
  caughtCount++;
  if (caughtCount >= CHANCES) { detention(); return; }
  state = 'caught';
  caughtReady = false;
  hold = null;
  sfx.sting('caught');
  buzz([120, 60, 220]);
  jug.seated = null;
  sfx.setTension(0);
  const lostMaggi = loseMaggi(jug);
  const taken = lostMaggi ? null : confiscateHeld(jug);
  document.getElementById('caught-line').textContent = lostMaggi
    ? '"Ye Maggi? Ye toh main khaunga. CONFISCATED!"'
    : `"${CAUGHT_LINES[(caughtCount - 1) % CAUGHT_LINES.length]}"`;
  document.getElementById('caught-taken').textContent = lostMaggi
    ? '🍜 Maggi gayi! Phir se order karna padega.'
    : taken ? `${ITEMS[taken].icon} ${ITEMS[taken].name} confiscate! (Uski almirah mein gaya...)` : '';
  const left = CHANCES - caughtCount;
  document.getElementById('caught-count').innerHTML = `<span class="bowls">${'🍜'.repeat(left)}<i>${'🍜'.repeat(caughtCount)}</i></span> Chances bache: <b>${left}</b>`;
  document.getElementById('caught-warn').textContent = left === 1 ? 'Ek aur baar... aur PAPA KO PHONE!' : '';
  document.exitPointerLock?.();
  showOverlay('caught');
  setTimeout(() => { caughtReady = true; }, 900);
}

// The detention notebook, only ever seen in that comic panel.
const notebook = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), new THREE.MeshToonMaterial({
  map: canvasTexture(512, 360, (ctx, w, h) => {
    ctx.fillStyle = '#f7f3e6'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#9fb7d8'; ctx.lineWidth = 2;
    for (let y = 36; y < h; y += 26) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.strokeStyle = '#d66'; ctx.beginPath(); ctx.moveTo(48, 0); ctx.lineTo(48, h); ctx.stroke();
    ctx.fillStyle = '#1b2a6b'; ctx.font = 'italic 22px "Comic Neue", "Comic Sans MS", cursive';
    for (let i = 0, y = 31; y < h; y += 26, i++) ctx.fillText(`${i + 1}. Lights off = SONA.`, 56, y);
  }),
}));
notebook.rotation.set(-Math.PI / 2, 0, 0.25);
notebook.position.set(30.75, 0.765, 3.15);
notebook.visible = false;
scene.add(notebook);

// Five strikes: the warden rings home, and the night ends in detention.
async function detention() {
  state = 'detention';
  hold = null;
  jug.seated = null;
  document.exitPointerLock?.();
  sfx.setTension(0);
  sfx.sting('caught');
  buzz([200, 80, 200, 80, 400]);
  if (!window.__skipComics) await playComic(detentionPanels(), { title: 'Paanchvi baar...' });
  const s = score(jug, caughtCount);
  const used = jug.log.filter((l) => l.kind !== 'time').length;
  document.getElementById('det-lines').textContent =
    `Pakde gaye: ${caughtCount}/${CHANCES}. Jugaad kiye: ${used}. Maggi: 0.`;
  document.getElementById('det-score').textContent = Math.max(0, s.total);
  showOverlay('detention');
}

function detentionPanels() {
  const atDesk = (look) => () => {
    wardenModel.group.visible = false;
    cutWarden.group.visible = true;
    cutWarden.update({ x: 37.6, z: 2.4, yaw: 0.8, lookOffset: look, moving: false, mode: 'patrol', meter: 0 }, 0);
  };
  const lamp = { power: 1, lamp: 5, lampAt: [37.5, 2.6, 2.8] };
  const p1 = shot({ pos: [39.7, 1.6, 4.4], at: [37.5, 1.4, 2.4], ...lamp, setup: atDesk(0) });
  const p2 = shot({ pos: [38.6, 1.7, 3.6], at: [37.0, 1.5, 2.2], fov: 40, ...lamp, setup: atDesk(-0.6) });
  cutWarden.group.visible = false;
  notebook.visible = true;
  const p3 = shot({ pos: [31.45, 1.3, 3.75], at: [30.75, 0.76, 3.15], fov: 50, power: 1, lamp: 5, lampAt: [31, 2.4, 3.2] });
  notebook.visible = false;
  const stall = () => {
    wardenModel.group.visible = false;
    cutWarden.group.visible = true;
    cutWarden.update({ x: 36.15, z: 17.6, yaw: 0, lookOffset: 0, moving: false, mode: 'patrol', meter: 0 }, 0);
    bowls.forEach((b) => { b.visible = true; });
    bowls[1].position.set(35.5, 0.95, 18.35);
  };
  const lanternWas = world.lantern.intensity;
  world.lantern.intensity = 4.5;
  const p4 = shot({ pos: [33.9, 1.55, 16.4], at: [36.1, 1.2, 18.0], fov: 50, setup: stall });
  world.lantern.intensity = lanternWas;
  cutWarden.group.visible = false;
  bowls.forEach((b) => { b.visible = false; });
  return [
    { img: p1, caption: "Warden's office. Phone uthaya.", sfx: { text: 'TRRING!', x: 6, y: 62, rot: -8 },
      bubbles: [{ text: 'Hello? Room 106 ke papa? Aapka bachcha raat ke 2 baje MAGGI dhoond raha tha!', x: 50, y: 6 }] },
    { img: p2, caption: 'Speakerphone pe, ghar se:', bubbles: [{ text: 'KYAAA?! Exam se pehle?! Ghar aa, phir batata hoon!!', x: 3, y: 56, shout: true }] },
    { img: p3, caption: 'DETENTION. Common room, subah 6 baje tak.', bubbles: [{ text: 'Sirf 497 baar aur...', x: 52, y: 12 }] },
    { img: p4, caption: '...aur Maggi? Woh Warden Saab ne kha li.', sfx: { text: 'SLURRRRP', x: 48, y: 30, rot: -10 } },
  ];
}

function backToRoom() {
  respawn(player, map.spawn);
  prevX = player.x;
  const myDoor = map.doors.get(MY_DOOR);
  if (!myDoor.locked) myDoor.open = false;
  // He marches back to his desk to write your name in the register.
  warden.x = WARDEN_ROUTE[0].x; warden.z = WARDEN_ROUTE[0].z;
  warden.route = routeFor();
  resumePatrol(warden);
  hud.clearBubbles();
  startPlaying();
}

async function win() {
  state = 'ending';
  hold = null;
  jug.seated = null;
  document.exitPointerLock?.();
  sfx.setTension(0);
  if (!window.__skipComics) await playComic(roomPanels(), { title: 'Room 106, raat ke 3 baje...' });
  state = 'won';
  const left = Math.max(0, Math.floor(CLOSING - orderedAt));
  if (left > 0) jug.log.push({ text: `Band hone se ${left} minute pehle order diya`, kind: 'time', points: left * 4 });
  const s = score(jug, caughtCount);
  const best = store.get('best', 0);
  if (s.total > best) store.set('best', s.total);
  document.getElementById('score-best').textContent = s.total > best
    ? (best ? `NAYA RECORD! Pichhla best: ${best}` : 'Pehla record ban gaya!')
    : `Tumhara best: ${best}`;
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
  document.getElementById('score-time').textContent = `Maggi khatam: ${h}:${String(m).padStart(2, '0')} AM. Warden Saab ko pata bhi nahi chala.`;
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
      buzz(20);
      sfx.sting('got');
    } else if (e.type === 'say') {
      if (e.who === 'warden') { hud.say(e.line, wardenHead, 'alert'); wardenModel.setMood('angry'); }
      else if (e.who === 'chowkidar') hud.say(e.line, chowHead, /CHOR/.test(e.line) ? 'angry' : '', 'Chowkidar');
      else if (e.who === 'student') hud.say(e.line, v3(e.x, 1.2, e.z), '', 'Student');
      else if (e.who === 'bhaiya') hud.say(e.line, bhaiyaHead, /READY/.test(e.line) ? 'alert' : '', 'Bhaiya');
      else hud.say(e.line, v3(e.x, 2.1, e.z), 'angry', 'Kamre se awaaz');
    } else if (e.type === 'power') powerChanged(e);
    else if (e.type === 'act3') {
      orderedAt = minutes;
      hud.bigPop('EK MINUTE!');
      hud.subtitle('Order de diya! Ab ek minute chhupo. Warden Saab bahar raund pe nikal rahe hain...', 5);
      switchRoute();
    } else if (e.type === 'maggiReady') {
      hud.toast('🍜 Maggi ready! Counter pe rakhi hai.');
      buzz([40, 40, 40]);
      switchRoute();
    } else if (e.type === 'carrying') {
      hud.subtitle('Ab Room 106! Bhaago mat, garam hai. Aur khushboo... door se aati hai.', 5);
      switchRoute();
    } else if (e.type === 'won') {
      win();
    }
  }
}

// ---- Act 2: the power comes back (and goes again when you blow the fuse)
function powerChanged(e) {
  world.setPower(e.on, e.on);
  sfx.setPower(e.on);
  warden.lightsOn = e.on;
  wardenModel.setTorch(!e.on);
  if (e.on) {
    sfx.tubeTinks();
    sfx.cheer();
    students.show(true);
    if (e.first) {
      hud.bigPop('BIJLI AA GAYI!');
      hud.subtitle('Bijli wapas! Sab padhne baith gaye... aur ab Warden Saab ko sab dikhta hai. Study circle mein chhupo, ya... bijli phir se udaao?', 6);
      hud.say('Bijli aa gayi! Chalo sab, PADHAI KARO!', wardenHead, 'alert');
    } else {
      hud.say('Ho gaya theek. Ab koi haath mat lagana!', wardenHead, 'alert');
    }
  } else {
    sfx.fuseBlow();
    buzz([100, 50, 160]);
    sfx.groan();
    hud.bigPop('PHATAAK!');
    hud.subtitle('Fuse ud gaya! Andhera wapas. Warden Saab MCB theek karne gaye...', 4);
    hud.say('Abey! Fuse kisne udaaya?!', wardenHead, 'angry');
    sendWarden(warden, FUSE_BOX.x, FUSE_BOX.z, 7, 'fuse');
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
  vm.play('throw', 0.45, { item: id });
  const f = forward(player);
  worldItems.throwFlight(id, v3(player.x + f.x * 0.4, player.eye - 0.1, player.z + f.z * 0.4), land, () => {
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
      vm.play('combine', 1.0, { a: r.a, b: r.b, made: r.makes });
      buzz([30, 40, 30]);
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
      vm.play('drop', 0.3, { item: id });
      dropItem(jug, id, x, z);
    }
  }
  if (input.tapped('KeyV')) throwSelected();
}

// ---- E: look, act, hold
function interact(dt, noises) {
  let target = jug.seated
    ? { type: 'circle', circle: jug.seated, dist: 0.5, at: jug.seated.seat, key: `circle:${jug.seated.id}` }
    : findTarget(player, jug);
  let actions = target ? actionsFor(jug, target, { dist: target.dist, inside: target.inside, crouch: player.crouch }) : [];
  // Back in your room with the Maggi: E eats it (unless you are at the door, to shut it first).
  if (jug.inv.includes('maggi') && inMyRoom(player.x, player.z) && !(target && target.type === 'door' && actions.length)) {
    target = { type: 'eat', dist: 0, at: { x: player.x, z: player.z }, key: 'eat' };
    actions = actionsFor(jug, target);
  }
  if (target && target.type === 'door' && target.door.kind === 'D' && actions[0]?.id === 'toggle' && target.door.open && playerInDoor(target.door)) {
    actions = [];
  }
  const action = actions[0] || null;
  canUseNow = !!action;
  if (!input.held('KeyE')) holdLatch = false;

  if (!target) { canUseNow = false; hud.setPrompt(null); hold = null; vm.hold(null); return; }
  if (!action) {
    hud.setPrompt(target.type === 'door' && !target.door.locked ? null : (lockedHint(jug, target) || null), true);
    hold = null;
    vm.hold(null);
    return;
  }
  const others = actions.slice(1).map((a) => a.label);
  hud.setPrompt(`[E${action.hold ? ' hold' : ''}] ${action.label}`, false, others.length ? `ya: ${others.join(' · ')}` : '');

  const key = `${target.key}:${action.id}`;
  if (input.held('KeyE') && !holdLatch) {
    if (!action.hold) {
      holdLatch = true;
      if (ACTION_ANIM[action.id]) vm.play(ACTION_ANIM[action.id], action.id === 'knock' ? 0.55 : 0.4, action.uses ? { item: action.uses } : {});
      handle(perform(jug, target, action, { crouch: player.crouch }), noises);
      return;
    }
    if (ACTION_ANIM[action.id]) vm.hold(ACTION_ANIM[action.id], action.uses);
    if (!hold || hold.key !== key) hold = { key, action, target, t: 0, noiseT: 0 };
    hold.t += dt;
    hold.noiseT += dt;
    if (action.noise && hold.noiseT > 1) {
      hold.noiseT = 0;
      const eating = action.id === 'eat';
      noises.push({ x: target.at.x, z: target.at.z, r: action.noise, line: eating ? 'Ye slurp-slurp kaun kar raha hai?!' : undefined });
      hud.sfx(eating ? 'SLURRP' : action.id === 'pickGrill' ? 'khat-khut' : 'khrr', v3(target.at.x, 1.2, target.at.z), 0.6, 0.6);
      if (eating) sfx.slurp();
    }
    if (action.id === 'grabKeys') grabTick(jug, dt, player.crouch);
    if (hold.t >= action.hold) {
      holdLatch = true;
      hold = null;
      vm.hold(null);
      if (/^smash/.test(action.id)) { vm.play('smashHit', 0.35, { item: action.uses }); buzz(90); }
      else if (action.id === 'pullPaper') vm.play('pull', 0.4);
      handle(perform(jug, target, action, { crouch: player.crouch }), noises);
    }
  } else {
    hold = null;
    vm.hold(null);
  }
}

function playerInDoor(door) {
  const px = Math.max(door.x, Math.min(player.x, door.x + 1)), pz = Math.max(door.z, Math.min(player.z, door.z + 1));
  return Math.hypot(player.x - px, player.z - pz) < RADIUS + 0.02;
}

// ---- phone niceties: only the buttons that do something, a glowing USE, buzzes
const tb = (k) => document.querySelector(`#tbtns [data-key="${k}"]`);
const TB = isTouch ? { use: tb('KeyE'), torch: tb('KeyF'), throw: tb('KeyV'), combine: tb('KeyG'), drop: tb('KeyQ') } : null;
let tbKey = '';
function updateTouchButtons(canUse) {
  if (!TB) return;
  const sel = selected(jug);
  const r = recipeFor(jug);
  const k = [jug.inv.includes('phone'), sel && ITEMS[sel].props.includes('throw'), r && r.ready, !!sel, canUse].join();
  if (k !== tbKey) {
    tbKey = k;
    TB.torch.hidden = !jug.inv.includes('phone');
    TB.throw.hidden = !(sel && ITEMS[sel].props.includes('throw'));
    TB.combine.hidden = !(r && r.ready);
    TB.drop.hidden = !sel;
    TB.use.classList.toggle('ready', canUse);
  }
  TB.use.style.setProperty('--p', `${Math.round((hold ? hold.t / hold.action.hold : 0) * 100)}%`);
}
let chipText = '';
function updateMaggiChip() {
  const m = jug.maggi;
  const secs = Math.ceil(m.t);
  const t = m.state === 'cooking' ? `🍜 ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
    : m.state === 'ready' ? '🍜 READY!' : m.state === 'carried' ? '🍜 HAATH MEIN' : '';
  if (t === chipText) return;
  chipText = t;
  maggiChip.textContent = t;
  maggiChip.hidden = !t;
  maggiChip.classList.toggle('ready', m.state === 'ready');
}
const maggiChip = document.getElementById('maggi-chip');
function buzz(pattern) { if (isTouch) try { navigator.vibrate?.(pattern); } catch { /* no vibration */ } }

// Leaving the app (or locking the phone) pauses the game.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (state === 'playing') pause(); sfx.suspend(); } else sfx.resume();
});

// ---- comic panels, rendered by the engine
function shot({ pos, at, power = 0, lamp = 0, lampAt = [2.5, 2.6, 10.5], fov = 55, setup }) {
  roomLamp.position.set(...lampAt);
  const keep = { power: world.power, target: world.target, flicker: world.flicker, fov: camera.fov, aspect: camera.aspect, lamp: roomLamp.intensity };
  const camPos = camera.position.clone(), camQ = camera.quaternion.clone();
  const vis = { warden: wardenModel.group.visible };
  world.power = world.target = power; world.flicker = 0;
  world.update(0);
  applyPower(power);
  roomLamp.intensity = lamp;
  roomLamp.visible = lamp > 0;
  setup?.();
  camera.position.set(...pos); camera.lookAt(...at);
  camera.fov = fov; camera.aspect = 4 / 3; camera.updateProjectionMatrix();
  renderer.setSize(isTouch ? 640 : 960, isTouch ? 480 : 720, false);
  renderer.clear();
  renderer.render(scene, camera);
  const url = canvas.toDataURL('image/jpeg', 0.86);
  Object.assign(world, { power: keep.power, target: keep.target, flicker: keep.flicker });
  world.update(0);
  applyPower(keep.power);
  roomLamp.intensity = keep.lamp;
  roomLamp.visible = false;
  wardenModel.group.visible = vis.warden;
  camera.position.copy(camPos); camera.quaternion.copy(camQ);
  camera.fov = keep.fov; camera.aspect = keep.aspect; camera.updateProjectionMatrix();
  renderer.setSize(sizeW, sizeH, false);
  return url;
}

function openingPanels() {
  const desk = shot({ pos: [3.9, 1.45, 11.9], at: [1.3, 0.75, 9.3], power: 1, lamp: 6 });
  const bed = shot({ pos: [3.7, 2.3, 9.4], at: [1.6, 0.4, 12.0], power: 1, lamp: 6 });
  const door = shot({ pos: [2.5, 1.5, 11.3], at: [2.5, 1.3, 8.2], power: 1, lamp: 6 });
  const dark = shot({ pos: [3.9, 1.45, 11.9], at: [1.3, 0.75, 9.3], power: 0, lamp: 0.25 });
  return [
    { img: desk, caption: '1:29 AM. Endsem kal hai. Room 106.', bubbles: [{ text: 'Bas ek chapter aur...', x: 52, y: 22 }] },
    { img: bed, caption: '...aur pet mein chuhe daud rahe hain.', sfx: { text: 'GRRRRRR', x: 30, y: 45 }, bubbles: [{ text: "Bhaiya ki Maggi... 3 baje tak khuli hai...", x: 50, y: 20 }] },
    { img: door, caption: 'Roommate, darwaze ke bahar se:', sfx: { text: 'KLIK!', x: 62, y: 58, rot: 10 }, bubbles: [{ text: 'Tu padh! Main 109 mein so raha hoon. Tere bhale ke liye BAHAR se lock kar raha hoon!', x: 10, y: 14, shout: true }] },
    { img: dark, dim: true, caption: 'Aur phir...', sfx: { text: 'BIJLI GAYI!', x: 18, y: 38, rot: -6 }, bubbles: [{ text: '...ab toh Maggi ke liye KUCH BHI.', x: 48, y: 70 }] },
  ];
}

// The winning comic: eating in the dark while he walks past the door.
function roomPanels() {
  const show = (v) => () => { plate.visible = v; };
  const desk = { pos: [3.9, 1.45, 11.9], at: [1.4, 0.8, 9.4] };
  const p1 = shot({ ...desk, power: 0, lamp: 0.7, setup: show(true) });
  const p2 = shot({ pos: [2.5, 1.5, 11.3], at: [2.5, 1.0, 8.2], power: 0, lamp: 0.7, setup: show(true) });
  const p3 = shot({ pos: [2.35, 1.12, 10.15], at: [1.6, 0.8, 9.45], fov: 40, power: 0, lamp: 1.0, setup: show(true) });
  const p4 = shot({ pos: [2.5, 1.5, 11.3], at: [2.5, 1.0, 8.2], power: 0, lamp: 0.7, setup: show(true) });
  plate.visible = false;
  return [
    { img: p1, dim: false, caption: 'Room 106. Darwaza band. Torch band.', sfx: { text: 'SLURRRP', x: 56, y: 40, rot: -8 }, bubbles: [{ text: 'Zindagi ka sabse lamba ek minute tha...', x: 46, y: 10 }] },
    { img: p2, dim: true, caption: 'Bahar... chappal ki awaaz.', sfx: { text: 'thap... thap...', x: 8, y: 72, rot: 4 }, bubbles: [{ text: 'Hmm... ye Maggi ki khushboo...?', x: 36, y: 14, shout: true }] },
    { img: p3, caption: 'Saans roko.', bubbles: [{ text: '.....', x: 60, y: 12 }] },
    { img: p4, dim: true, caption: 'Maggi ke liye... KUCH BHI.', sfx: { text: 'BURRRP!', x: 12, y: 60, rot: -10 }, bubbles: [{ text: 'Chooha hoga. Hmph.', x: 40, y: 14, shout: true }] },
  ];
}

// ---- the loop
let lastT = performance.now();
let perfT = 0, perfFrames = 0, perfSum = 0;
// Every couple of seconds of play: too slow? drop the resolution a notch. Fast? raise it.
function adaptResolution(raw) {
  if (state !== 'playing' || raw > 0.25) return;
  perfSum += raw; perfFrames++; perfT += raw;
  if (perfT < 2) return;
  const avg = perfSum / perfFrames;
  perfT = perfSum = perfFrames = 0;
  let next = pixelRatio;
  if (avg > 1 / 40 && pixelRatio > 0.6) next = Math.max(0.6, pixelRatio - 0.2);
  else if (avg < 1 / 57 && pixelRatio < MAX_PR) next = Math.min(MAX_PR, pixelRatio + 0.1);
  if (next !== pixelRatio) {
    pixelRatio = next;
    renderer.setPixelRatio(pixelRatio);
    sizeW = 0; resize();
  }
}

function frame() {
  const now = performance.now();
  const raw = (now - lastT) / 1000;
  const dt = Math.min(raw, 0.05);
  lastT = now;
  adaptResolution(raw);
  // Held upright, a phone shows only the "turn it" card: don't burn battery drawing behind it.
  if (isTouch && portrait.matches) {
    if (state === 'playing') pause();
    requestAnimationFrame(frame);
    return;
  }
  tick(dt);
  requestAnimationFrame(frame);
}

function tick(dt) {
  time += dt;
  resize();

  if (state === 'playing') {
    const torchWas = player.torch;
    // Sitting in a study circle: any step gets you up.
    if (jug.seated && input.held('KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight')) {
      jug.seated = null;
      player.crouch = false;
    }
    if (input.tapped('KeyP', 'Escape') || (isTouch && portrait.matches)) { pause(); input.endFrame(); return; }
    const carrying = jug.inv.includes('maggi');
    if (carrying && input.tapped('ShiftLeft', 'ShiftRight')) hud.subtitle('Garam Maggi leke bhaagoge? Gir jayegi!', 2);
    const noises = updatePlayer(player, dt, input, map, 0.0022 * sensitivity, { noRun: carrying });
    // The smell of Maggi travels: he notices it if he gets close.
    if (carrying) {
      smellT -= dt;
      if (smellT <= 0) { smellT = 1; noises.push({ x: player.x, z: player.z, r: SMELL_R, line: 'Ye... Maggi ki khushboo?!' }); }
    }
    // The stall's lantern lights you up; indoors the tube lights do (when the power is on).
    player.lit = Math.hypot(player.x - 36, player.z - 18.2) < 3.3;
    warden.lightsOn = jug.power.on && warden.z < 13.2 && player.z < 13.2;
    if (warden.lightsOn !== torchAway) { torchAway = warden.lightsOn; wardenModel.setTorch(!torchAway); }
    if (jug.seated) {
      if (!wasSeated) { player.yaw = jug.seated.yaw; player.pitch = -0.3; }
      player.x = jug.seated.seat.x; player.z = jug.seated.seat.z;
      player.crouch = true;
    }
    wasSeated = !!jug.seated;
    player.hidden = !!jug.seated && jug.inv.includes('book');
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
    if (state !== 'playing') { input.endFrame(); return; }   // the last bite just won the game
    updateTouchButtons(canUseNow);

    // Slipping through the grill while he holds it open.
    const grill = map.doors.get('25,6');
    if (prevX < 25 && prevX > 24 && player.x >= 25 && player.z > 6 && player.z < 8 && grill.locked) tailgated(jug);
    prevX = player.x;

    if (jug.solved.grill && jug.act === 1) handle(startAct2(jug), noises);
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
      } else if (e.type === 'errandDone' && e.tag === 'fuse') {
        handle(restorePower(jug), noises);
      } else if (e.type === 'caught') {
        getCaught();
      }
    }
    sfx.setTension(warden.mode === 'chase' ? 2 : warden.meter > 0.15 || ['suspicious', 'investigate', 'search'].includes(warden.mode) ? 1 : 0);
    const mumble = students.update(dt, player);
    if (mumble) hud.sfx(mumble.text, v3(mumble.x, 1.3, mumble.z), 0.45, 2);

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

    // Chai at the stall: a little scene while he loiters there.
    chaiT -= dt;
    if (chaiT <= 0 && warden.mode === 'patrol' && Math.hypot(warden.x - 35.5, warden.z - 16.8) < 1.2) {
      chaiT = 25;
      hud.say(['Bhaiya, ek cutting chai!', 'Kisi ladke ko dekha idhar?', 'Aaj bahut thand hai, Bhaiya.'][Math.floor(Math.random() * 3)], wardenHead, '');
      setTimeout(() => hud.say(['Abhi lo, Saab!', 'Nahi Saab, koi nahi aaya.', 'Haan Saab, adrak daal doon?'][Math.floor(Math.random() * 3)], bhaiyaHead, '', 'Bhaiya'), 1600);
    }
    minutes += dt * MINUTES_PER_SECOND;
    if (minutes >= CLOSING - 15 && !warned15) { warned15 = true; hud.toast('⏰ 15 minute bache! Maggi Point 3 baje band.'); }
    if (minutes >= CLOSING && state === 'playing' && jug.maggi.state === 'none') tooLate();
    readyBowl.visible = jug.maggi.state === 'ready';
    hud.setObjective(objective(), minutes >= CLOSING - 15 && jug.maggi.state === 'none');
    updateMaggiChip();
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
  vm.setPhone(jug.inv.includes('phone'), player.torch);
  vm.setHeld(selected(jug));
  vm.light(hemi, world.power);
  vm.update(dt, { moving: player.moving, bob: player.bob, running: player.running, look: player.lastLook });
  const call = bhaiya.update(dt, player);
  if (call && state === 'playing') hud.say(call, bhaiyaHead, '', 'Bhaiya');

  applyPower(world.power);
  world.setPlugged(jug.plugged.length);
  wardenModel.update(warden, dt);
  chowModel.update(jug.chowkidar, dt);
  worldItems.update(dt, jug.worldItems, time);
  world.update(dt);
  hud.setMeter(warden.meter, warden.mode);
  hud.setChances(CHANCES - caughtCount, CHANCES);
  hud.setStatus({ minutes, areaName: areaName(player.x, player.z), torch: player.torch, crouch: player.crouch, running: player.running });
  hud.setInventory(jug, recipeFor(jug));
  hud.setHold(hold ? hold.t / hold.action.hold : 0);
  hud.update(dt, camera, sizeW, sizeH);

  renderer.clear();
  renderer.render(scene, camera);
  if (state === 'playing' || state === 'paused') vm.render(renderer);
}
showOverlay('title');
requestAnimationFrame(frame);

// For poking at the game from the browser console.
window.__game = {
  map, jug, player, warden, scene, camera, renderer,
  // Advance the game by `seconds` without waiting for frames (for testing).
  step(seconds) { for (let t = 0; t < seconds; t += 1 / 60) tick(1 / 60); },
  get minutes() { return minutes; }, set minutes(m) { minutes = m; }, get state() { return state; }, set state(s) { state = s; } };
