import test from 'node:test';
import assert from 'node:assert/strict';
import { createMap, WARDEN_ROUTE, WARDEN_START } from '../shared/map.js';
import { createWarden, updateWarden, sightRate, yawTo } from '../shared/warden-ai.js';

const away = { x: 2.5, z: 10.5, crouch: false, torch: false }; // shut in room 106

function run(w, seconds, player = away, noises = () => []) {
  const events = [];
  for (let t = 0; t < seconds; t += 0.05) events.push(...updateWarden(w, 0.05, player, noises(t)));
  return events;
}

test('he walks his whole route and comes back round', () => {
  const map = createMap();
  const w = createWarden(map, WARDEN_START, WARDEN_ROUTE);
  const visited = new Set();
  for (let t = 0; t < 400; t += 0.05) {
    updateWarden(w, 0.05, away);
    WARDEN_ROUTE.forEach((p, i) => { if (Math.hypot(p.x - w.x, p.z - w.z) < 0.3) visited.add(i); });
  }
  assert.equal(visited.size, WARDEN_ROUTE.length);
  assert.equal(w.mode, 'patrol');
});

test('standing in his torch beam gets you caught', () => {
  const map = createMap();
  const w = createWarden(map, { x: 10.5, z: 6.5 }, WARDEN_ROUTE);
  w.mode = 'search'; w.searchT = -100;      // standing still, looking
  w.yaw = yawTo(-1, 0); w.lookOffset = 0;   // facing west
  const p = { x: 5.5, z: 6.5, crouch: false, torch: false };
  assert.ok(sightRate(w, p, map) > 0.5);
  const ev = run(w, 6, p);
  assert.ok(ev.some((e) => e.type === 'caught'));
});

test('in the dark, behind him, you are invisible; your own torch gives you away', () => {
  const map = createMap();
  const w = createWarden(map, { x: 10.5, z: 6.5 }, WARDEN_ROUTE);
  w.yaw = yawTo(1, 0); w.lookOffset = 0;    // facing east
  const p = { x: 5.5, z: 6.5, crouch: false, torch: false };
  assert.equal(sightRate(w, p, map), 0, 'behind him in the dark');
  w.yaw = yawTo(-0.3, 1);                   // facing mostly south, you are off to his side
  assert.equal(sightRate(w, p, map), 0, 'off to the side, torch off');
  assert.ok(sightRate(w, { ...p, torch: true }, map) > 0, 'off to the side, torch on');
});

test('a closed door hides you completely', () => {
  const map = createMap();
  const w = createWarden(map, { x: 2.5, z: 7.2 }, WARDEN_ROUTE);
  w.yaw = 0; w.lookOffset = 0;              // torch pointed straight at room 106's door
  assert.equal(sightRate(w, { x: 2.5, z: 10.5, crouch: false, torch: true }, map), 0);
});

test('a loud noise brings him over to look, then he gives up', () => {
  const map = createMap();
  const w = createWarden(map, { x: 20.5, z: 6.5 }, WARDEN_ROUTE);
  w.wp = 4;
  const ev = run(w, 0.1, away, (t) => (t < 0.06 ? [{ x: 12.5, z: 7.0, r: 9 }] : []));
  assert.equal(w.mode, 'investigate');
  assert.ok(ev.some((e) => e.type === 'say'));
  run(w, 20);
  assert.equal(w.mode, 'patrol');
});

test('a quiet noise far away goes unheard', () => {
  const map = createMap();
  const w = createWarden(map, { x: 37.5, z: 3.5 }, WARDEN_ROUTE);
  run(w, 0.1, away, () => [{ x: 3.5, z: 7.0, r: 2 }]);
  assert.equal(w.mode, 'patrol');
});

test('he opens the grill gate with his key and locks it behind him', () => {
  const map = createMap();
  const w = createWarden(map, WARDEN_START, WARDEN_ROUTE);
  const gate = map.doors.get('25,6');
  let opened = false;
  for (let t = 0; t < 120 && !(opened && w.x < 20); t += 0.05) {
    updateWarden(w, 0.05, away);
    if (map.doors.get('25,6').open || map.doors.get('25,7').open) opened = true;
  }
  assert.ok(opened, 'never opened the gate');
  assert.ok(w.x < 20, 'never got into the wing');
  assert.equal(gate.open, false);
  assert.equal(map.doors.get('25,7').open, false);
});
