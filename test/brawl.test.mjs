import test from 'node:test';
import assert from 'node:assert/strict';
import { createMap, findPath, inMyRoom } from '../shared/map.js';
import { createBrawl, updateBrawl, playerPunch, tickCalm, crowdCover, BRAWL_SPAWNS, CALM_TIME, PLAYER_HP } from '../shared/brawl.js';
import { DIFFICULTY, getDifficulty } from '../shared/difficulty.js';
import { createWarden, sightRate, yawTo } from '../shared/warden-ai.js';
import { createJugaad, startAct2 } from '../shared/jugaad.js';

const fixedRng = () => 0.5;
const act2Map = () => { const map = createMap(); startAct2(createJugaad(map)); return map; };

test('every brawler starts on open floor, clear of the study circles', () => {
  const map = act2Map();
  for (const s of BRAWL_SPAWNS) {
    assert.ok(findPath(map, s.x, s.z, 2.5, 7.5), `spawn ${s.x},${s.z} is boxed in`);
    assert.equal(map.extraSolid.has(`${Math.floor(s.x)},${Math.floor(s.z)}`), false);
  }
});

test('come close and one winds up, then hits you if you stay', () => {
  const map = act2Map();
  const b = createBrawl(getDifficulty('normal').brawl, fixedRng);
  const r = b.brawlers[0];
  const me = { x: r.x + 0.9, z: r.z };
  let ev = [];
  for (let t = 0; t < 2; t += 0.05) ev.push(...updateBrawl(b, 0.05, me, map));
  assert.ok(ev.some((e) => e.type === 'windup'));
  assert.ok(ev.some((e) => e.type === 'hit'));
  assert.ok(b.hp < PLAYER_HP);
});

test('back off during the windup and the swing whiffs', () => {
  const map = act2Map();
  const b = createBrawl(getDifficulty('normal').brawl, fixedRng);
  const r = b.brawlers[0];
  const me = { x: r.x + 0.9, z: r.z };
  let wound = false;
  for (let t = 0; t < 2 && !wound; t += 0.05) wound = updateBrawl(b, 0.05, me, map).some((e) => e.type === 'windup');
  me.x += 2;                                         // step back
  const ev = [];
  for (let t = 0; t < 0.6; t += 0.05) ev.push(...updateBrawl(b, 0.05, me, map));
  assert.ok(ev.some((e) => e.type === 'whiff'));
  assert.equal(b.hp, PLAYER_HP);
});

test('two punches (or one bat swing) put a brawler down', () => {
  const b = createBrawl(getDifficulty('normal').brawl, fixedRng);
  const r = b.brawlers[0];
  const me = { x: r.x + 1, z: r.z, yaw: Math.PI / 2 };   // facing -x, towards them
  assert.equal(playerPunch(b, me)[0].type, 'punched');
  assert.equal(playerPunch(b, me)[0].type, 'ko');
  assert.equal(r.ko, true);
  const b2 = createBrawl(getDifficulty('hard').brawl, fixedRng);
  const r2 = b2.brawlers[0];
  assert.equal(playerPunch(b2, { x: r2.x + 1, z: r2.z, yaw: Math.PI / 2 }, true)[0].type, 'ko');
});

test('ten quiet seconds in your room end the brawl; stepping out restarts the count', () => {
  const b = createBrawl(getDifficulty('easy').brawl, fixedRng);
  const room = { x: 2.5, z: 10.5 }, out = { x: 2.5, z: 7 };
  for (let t = 0; t < CALM_TIME - 2; t += 0.5) assert.equal(tickCalm(b, 0.5, room), false);
  tickCalm(b, 0.5, out);
  assert.equal(b.calm, 0);
  let done = false;
  for (let t = 0; t < CALM_TIME + 0.5 && !done; t += 0.5) done = tickCalm(b, 0.5, room);
  assert.equal(done, true);
  assert.equal(b.active, false);
});

test('they will not follow you into your room', () => {
  const map = act2Map();
  map.doors.get('2,8').open = true;
  const b = createBrawl({ ...getDifficulty('normal').brawl, count: 10 }, fixedRng);
  b.brawlers[9].x = 2.5; b.brawlers[9].z = 7.5;          // waiting right outside the door
  const me = { x: 2.5, z: 10.2 };
  for (let t = 0; t < 10; t += 0.05) updateBrawl(b, 0.05, me, map);
  for (const r of b.brawlers) assert.ok(!inMyRoom(r.x, r.z), `brawler ${r.id} got into room 106`);
});

test('a brawler between you and the warden hides you', () => {
  const map = act2Map();
  const b = createBrawl(getDifficulty('normal').brawl, fixedRng);
  b.brawlers[0].x = 12; b.brawlers[0].z = 6.5;
  const cover = crowdCover(b, 16, 6.5, 8, 6.5);
  assert.ok(cover > 0.5);
  const w = createWarden(map, { x: 16, z: 6.5 }, []);
  w.lightsOn = true; w.yaw = yawTo(-1, 0);
  const p = { x: 8, z: 6.5, crouch: false, torch: false };
  assert.ok(sightRate(w, { ...p, cover }, map) < sightRate(w, p, map) * 0.5);
});

test('difficulty scales the warden, the chances and the brawl', () => {
  const map = act2Map();
  const p = { x: 12, z: 6.5, crouch: false, torch: false };
  const rates = ['easy', 'normal', 'hard'].map((id) => {
    const w = createWarden(map, { x: 2.5, z: 6.5 }, []);
    w.diff = DIFFICULTY[id].warden; w.lightsOn = true; w.yaw = yawTo(1, 0);
    return sightRate(w, p, map);
  });
  assert.ok(rates[0] < rates[1] && rates[1] < rates[2], rates.join(' < '));
  assert.ok(DIFFICULTY.easy.chances > DIFFICULTY.normal.chances && DIFFICULTY.normal.chances > DIFFICULTY.hard.chances);
  assert.ok(DIFFICULTY.easy.brawl.damage < DIFFICULTY.hard.brawl.damage);
  assert.equal(getDifficulty('nonsense').id, 'normal');
});
