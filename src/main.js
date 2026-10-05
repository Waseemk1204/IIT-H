// Boots the game: renderer, scene, the loop, and the glue between you,
// Warden Saab, the jugaad rules and the screen.
import * as THREE from 'three';
import { createMap, WARDEN_START, WARDEN_ROUTE, OUTSIDE_ROUTE, inMyRoom, areaName, moveCircle } from '../shared/map.js';
import { createWarden, updateWarden, resumePatrol, sendWarden, isBehind } from '../shared/warden-ai.js';
import {
  ITEMS, MY_DOOR, createJugaad, actionsFor, perform, lockedHint, combine, recipeFor,
  selected, dropItem, setAlarm, updateJugaad, chowkidarHears, grabTick, confiscateAll, confiscateHeld, canOpen, tailgated, tailgatedMain, score,
  startAct2, restorePower, STUDY_CIRCLES, FUSE_BOX,
} from '../shared/jugaad.js';
import { createStudents } from './render/students.js';
import { getDifficulty, DIFFICULTY } from '../shared/difficulty.js';
import { playComic } from './cutscenes.js';
import { createTutorial } from './tutorial.js';
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
const CLOSING = 180;                 // 3:00 AM: Bhaiya pulls the shutter down
// Set from the difficulty picked on the title screen (see shared/difficulty.js).
let diff = getDifficulty('normal');
let MINUTES_PER_SECOND = 90 / (diff.clockMinutes * 60);   // 1:30 to 3:00 AM in real minutes
let ROOM_CHECK = diff.roomCheck;     // seconds between his checks on Room 106
let CHANCES = diff.chances;          // caught this many times: Papa ko phone, detention
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

// The tutorial and its bouncing arrow.
const tutorial = createTutorial({ isTouch });
let tutorialStarted = false;
const marker = new THREE.Group();
{
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 4), new THREE.MeshBasicMaterial({ color: 0xf2c230 }));
  cone.rotation.x = Math.PI;                         // pointing down
  const edge = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.36, 4), new THREE.MeshBasicMaterial({ color: 0x14110f, side: THREE.BackSide }));
  edge.rotation.x = Math.PI;
  marker.add(cone, edge);
  marker.visible = false;
  scene.add(marker);
}
function placeMarker(m) {
  marker.visible = !!m;
  if (m) { marker.position.set(m.x, m.y + Math.abs(Math.sin(time * 4)) * 0.18, m.z); marker.rotation.y = time * 2; }
}
function endTutorial() {
  tutorial.stop();
  store.set('tutorialDone', true);
  hud.setTutorial(null);
  marker.visible = false;
}

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
let chaiT = 0, torchAway = false, orderedAt = START_MINUTES;
let prevZ = player.z, roomCheckT = 0, checksStarted = false, stripped = false;

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
  if (!tutorialStarted && !store.get('tutorialDone', false)) { tutorialStarted = true; tutorial.start(); }
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
document.getElementById('tut-replay').addEventListener('click', () => { store.set('tutorialDone', false); location.reload(); });
document.getElementById('tut-skip').addEventListener('click', (e) => { e.stopPropagation(); endTutorial(); });
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
// ---- difficulty picker on the title screen
function applyDifficulty(id) {
  diff = getDifficulty(id);
  store.set('diff', diff.id);
  MINUTES_PER_SECOND = 90 / (diff.clockMinutes * 60);
  ROOM_CHECK = diff.roomCheck;
  CHANCES = diff.chances;
  warden.diff = diff.warden;
  for (const b of document.querySelectorAll('.diff-btn')) b.classList.toggle('on', b.dataset.diff === diff.id);
  document.getElementById('diff-blurb').textContent = diff.blurb;
}
for (const b of document.querySelectorAll('.diff-btn')) b.addEventListener('click', () => applyDifficulty(b.dataset.diff));
applyDifficulty(store.get('diff', 'normal'));

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
  const grill = map.doors.get('25,6'), gate = map.doors.get('32,13'), lobbyWindow = map.doors.get('27,13');
  const behindHim = 'Kuch nahi bacha? Ek hi raasta: Warden Saab gate kholein, tab unke peeche-peeche nikal jao.';
  if (!jug.solved.grill) {
    if (!canOpen(jug, 'grill') && stripped) return behindHim;
    return 'A-wing ka grill gate paar karo. Lock pick (bobby pin + compass), cricket bat, Warden Saab ki chaabi, ya unke peeche-peeche.';
  }
  if (!jug.solved.main) {
    if (jug.power.on) return 'Bijli wapas! Ab Warden Saab door se dekh lete hain. Study circle mein chhupo, ya kettle + press + heater se fuse udaao. Phir: main gate ki chaabi.';
    return 'Main gate ki chaabi: soye chowkidar ki belt pe, Warden Saab ki table mein, ya unki jeb mein (peeche se!). Ya lobby ki dheeli khidki...';
  }
  // He locks gates again: tell you when you are on the wrong side of one.
  const inWing = player.x < 25 && player.z < 13, outside = player.z > 13.5;
  if (inWing && grill.locked && !grill.open) {
    return canOpen(jug, 'grill') ? 'Grill phir se band kar diya! Dobara kholo.' : behindHim;
  }
  if (!outside && gate.locked && !gate.open && !lobbyWindow.open && jug.maggi.state === 'none') {
    return canOpen(jug, 'main') ? 'Main gate phir band kar diya! Chaabi se kholo.' : behindHim;
  }
  const m = jug.maggi;
  if (m.state === 'none') return 'Bahar niklo! Bhaiya ki Maggi Point pe order do (counter pe E).';
  if (m.state === 'cooking') return `Maggi ban rahi hai (${Math.ceil(m.t)}s). Warden Saab bahar ghoom rahe hain: andhere mein chhupo, lantern ke paas mat ruko!`;
  if (m.state === 'ready') return 'MAGGI READY! Counter pe jao.';
  return 'Maggi ke liye... kuch bhi!';
}

// While your Maggi cooks (or waits on the counter) he does his rounds outside.
const routeFor = () => (jug.maggi.state === 'cooking' || jug.maggi.state === 'ready' ? OUTSIDE_ROUTE : WARDEN_ROUTE);
function switchRoute() {
  const r = routeFor();
  if (warden.route === r) return;
  warden.route = r;
  if (warden.mode === 'patrol') resumePatrol(warden);
}

// Hunting: he knows you are out. Faster, sees further, checks more often.
const alertChip = document.getElementById('alert-chip');
function startHunt(line) {
  if (warden.alert) return;
  warden.alert = 1;
  alertChip.hidden = false;
  hud.say(line, wardenHead, 'angry');
  hud.bigPop('WARDEN ALERT!');
  hud.subtitle('Warden Saab ab tumhe dhoondh rahe hain: tez chalte hain, door tak aur jaldi dekhte hain. Agli check pe kamre mein mile toh shaant ho jayenge.', 6);
  sfx.sting('chase');
  buzz([80, 60, 80]);
}
function calmDown(line) {
  if (line) hud.say(line, wardenHead, 'calm');
  if (!warden.alert) return;
  warden.alert = 0;
  alertChip.hidden = true;
  hud.toast('😮‍💨 Warden Saab shaant ho gaye.');
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
  const taken = diff.confiscate === 'all' ? confiscateAll(jug) : [confiscateHeld(jug)].filter(Boolean);
  if (taken.length) stripped = true;
  warden.alert = 0; alertChip.hidden = true;     // he knows exactly where you are now
  document.getElementById('caught-line').textContent = `"${CAUGHT_LINES[(caughtCount - 1) % CAUGHT_LINES.length]}"`;
  const lines = [];
  if (taken.length) lines.push(`${taken.map((id) => ITEMS[id].icon).join(' ')} ${diff.confiscate === 'all' ? 'Saara saaman' : 'Haath ka saaman'} confiscate! (Uski almirah mein...)`);
  const stuck = (!jug.solved.grill || map.doors.get('25,6').locked) && !canOpen(jug, 'grill');
  if (taken.length && stuck) lines.push('Ab ek hi raasta: Warden Saab ke peeche-peeche nikalna, jab woh gate kholein.');
  document.getElementById('caught-taken').innerHTML = lines.map((l) => `<span></span>`).join('<br>');
  [...document.querySelectorAll('#caught-taken span')].forEach((el, i) => { el.textContent = lines[i]; });
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
  roomCheckT = ROOM_CHECK.calm;
  hud.clearBubbles();
  startPlaying();
}

async function win() {
  state = 'ending';
  hold = null;
  jug.seated = null;
  document.exitPointerLock?.();
  sfx.setTension(0);
  if (!window.__skipComics) await playComic(endingPanels(), { title: 'Maggi Point ke peeche...' });
  state = 'won';
  const left = Math.max(0, Math.floor(CLOSING - orderedAt));
  if (left > 0) jug.log.push({ text: `Band hone se ${left} minute pehle order diya`, kind: 'time', points: left * 4 });
  let s = score(jug, caughtCount);
  if (diff.scoreMult !== 1) {
    jug.log.push({ text: `${diff.icon} ${diff.label} ×${diff.scoreMult}`, kind: diff.scoreMult > 1 ? 'improvised' : 'caught', points: Math.round(s.total * (diff.scoreMult - 1)) });
    s = score(jug, caughtCount);
  }
  const best = store.get(`best-${diff.id}`, 0);
  if (s.total > best) store.set(`best-${diff.id}`, s.total);
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
  document.getElementById('score-time').textContent = `Maggi Point pe Maggi mili: ${h}:${String(m).padStart(2, '0')} AM.`;
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
  // Right behind Warden Saab, with his keys on his belt: try his pocket.
  const behind = jug.wardenKeys && warden.mode !== 'chase' && isBehind(warden, player, 1.4);
  if (behind && !jug.seated) target = { type: 'warden', dist: 1, at: { x: warden.x, z: warden.z }, key: 'warden' };
  let actions = target ? actionsFor(jug, target, { dist: target.dist, inside: target.inside, crouch: player.crouch, behind }) : [];
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
      noises.push({ x: target.at.x, z: target.at.z, r: action.noise });
      hud.sfx(action.id === 'pickGrill' ? 'khat-khut' : 'khrr', v3(target.at.x, 1.2, target.at.z), 0.6, 0.6);
    }
    if (action.id === 'grabKeys') grabTick(jug, dt, player.crouch);
    // Standing up behind him? He feels it.
    if (action.id === 'pickpocket' && !player.crouch) {
      warden.meter = Math.min(1, warden.meter + dt * 1.2);
      if (!hold.warned) { hold.warned = true; hud.say('Ae?! Kaun hai peeche?!', wardenHead, 'alert'); }
    }
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
    : m.state === 'ready' ? '🍜 READY!' : '';
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

// The ending, from where you're hiding: crouched behind the stall with your
// plate, you watch Warden Saab walk up and order his own Maggi... and then he
// finds you. (The proposal's twist and line, told from your side.)
const endPlate = makeItemModel('maggi');
endPlate.scale.setScalar(2.2);
endPlate.position.set(33.05, 0.02, 19.55);
endPlate.visible = false;
scene.add(endPlate);
function endingPanels() {
  const lanternWas = world.lantern.intensity;
  // stand the stand-in warden somewhere, facing a point; walking = mid-stride
  const at = (x, z, faceX, faceZ, walking = false, look = 0) => () => {
    world.lantern.intensity = 4.5;
    wardenModel.group.visible = false;
    readyBowl.visible = false;
    endPlate.visible = true;
    cutWarden.group.visible = true;
    cutWarden.update({ x, z, yaw: Math.atan2(faceX - x, faceZ - z), lookOffset: look, moving: walking, mode: 'patrol', meter: 0 }, walking ? 0.25 : 0);
  };
  const crouch = 0.95;
  const glow = { lamp: 1.6, lampAt: [32.9, 1.6, 19.8] };     // the lantern's spill behind the stall
  const p1 = shot({ pos: [32.55, crouch + 0.1, 20.25], at: [33.1, 0.2, 19.4], fov: 52, ...glow, setup: at(30, 13.2, 30, 20) });
  const p2 = shot({ pos: [31.5, crouch + 0.05, 19.35], at: [31.2, 1.25, 15.3], fov: 50, ...glow, setup: at(31.2, 15.4, 31.5, 19.3, true) });
  const p3 = shot({ pos: [32.35, crouch, 19.45], at: [36.1, 1.35, 17.6], fov: 45, setup: () => {
    at(36.15, 17.55, 36.2, 18.5)();
    bowls[0].visible = true; bowls[0].position.set(36.15, 0.95, 18.3);
  } });
  const p4 = shot({ pos: [32.65, crouch, 19.75], at: [31.65, 1.55, 18.55], fov: 50, ...glow, setup: () => {
    at(31.55, 18.5, 32.65, 19.75, false, 0)();
    bowls[0].visible = false;
  } });
  cutWarden.group.visible = false;
  endPlate.visible = false;
  bowls.forEach((b) => { b.visible = false; });
  world.lantern.intensity = lanternWas;
  return [
    { img: p1, caption: 'Stall ke peeche. Chupke se.', sfx: { text: 'SLURRRP', x: 52, y: 52, rot: -8 }, bubbles: [{ text: 'Aah... zindagi.', x: 8, y: 14 }] },
    { img: p2, caption: 'Phir... chappal ki awaaz.', sfx: { text: 'thap... thap...', x: 8, y: 70, rot: 4 }, bubbles: [{ text: 'Uh-oh.', x: 58, y: 12 }] },
    { img: p3, caption: '...aur khud order kar diya?!', bubbles: [
      { text: 'Bhaiya, ek plate Maggi. Double masala!', x: 30, y: 8 },
      { text: 'Abhi lo, Saab!', x: 66, y: 46 },
    ] },
    { img: p4, caption: 'Pakde gaye. Maggi ke saath.', sfx: { text: '!', x: 70, y: 20, rot: 6 }, bubbles: [{ text: 'Tum bhi?! ...Paper kal hai na? Jaldi kha, phir so ja.', x: 4, y: 58 }] },
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
    const noises = updatePlayer(player, dt, input, map, 0.0022 * sensitivity);
    // The stall's lantern lights you up; indoors the tube lights do (when the power is on).
    player.lit = Math.hypot(player.x - 36, player.z - 18.2) < 3.3;
    player.inRoom = inMyRoom(player.x, player.z);
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
    if (prevX < 25 && prevX > 24 && player.x >= 25 && player.z > 6 && player.z < 8) {
      if (grill.locked) tailgated(jug);
    }
    prevX = player.x;
    // ...and through the main gate the same way.
    const gate = map.doors.get('32,13');
    if (prevZ < 13 && player.z >= 13.6 && player.x > 31 && player.x < 34 && gate.locked && gate.open) {
      tailgatedMain(jug);
      hud.toast('🤫 Warden Saab ke peeche-peeche main gate se!');
    }
    prevZ = player.z;

    // His checks on Room 106. Out of bed when he looks in? He starts hunting you.
    if (!map.doors.get(MY_DOOR).locked && !tutorial.active) {
      if (!checksStarted && !player.inRoom) { checksStarted = true; roomCheckT = ROOM_CHECK.first; }
      if (checksStarted) {
        roomCheckT -= dt;
        if (roomCheckT <= 0) {
          if ((warden.mode === 'patrol' || warden.mode === 'search') && sendWarden(warden, 2.5, 9.6, 2, 'roomcheck')) {
            roomCheckT = warden.alert ? ROOM_CHECK.hunting : ROOM_CHECK.calm;
            if (!player.inRoom) {
              hud.toast('🚨 Warden Saab Room 106 check karne nikle! Wapas pahuncho?');
              hud.say('Zara dekhun, Room 106 wala so raha hai ya nahi...', wardenHead, 'alert');
            }
          } else roomCheckT = 5;
        }
      }
    }

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
      } else if (e.type === 'errandDone' && e.tag === 'roomcheck') {
        if (player.inRoom) calmDown('Achha, so raha hai. Shabash. Subah paper hai!');
        else startHunt('Room 106 KHAALI?! Kahan gaya ye?! Dhoondo usse!');
      } else if (e.type === 'errandDone' && e.tag === 'closeDoor' && e.door === map.doors.get(MY_DOOR) && !player.inRoom) {
        startHunt('Room 106 ka darwaza khula... aur kamra khaali?! DHOONDO!');
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
    // The tutorial: one step at a time, with an arrow over what to use.
    if (tutorial.active) {
      if (input.tapped('KeyT')) endTutorial();
      else {
        const tu = tutorial.update(dt, { player, jug, map });
        if (tu?.advanced) { sfx.sting('got'); hud.tutorialTick(); }
        if (tu?.finished) endTutorial();
        else if (tu) { hud.setTutorial(tu.text, tu.n, tutorial.total); placeMarker(tu.marker); }
      }
    }
    if (!tutorial.freezeClock) minutes += dt * MINUTES_PER_SECOND;
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
  wardenModel.setKeys(jug.wardenKeys);
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
  get minutes() { return minutes; }, set minutes(m) { minutes = m; },
  get roomCheckT() { return roomCheckT; }, set roomCheckT(v) { roomCheckT = v; },
  get state() { return state; }, set state(s) { state = s; } };
