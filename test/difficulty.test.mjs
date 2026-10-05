import test from 'node:test';
import assert from 'node:assert/strict';
import { createMap, WARDEN_ROUTE } from '../shared/map.js';
import { createWarden, updateWarden, sightRate, yawTo, isBehind, HUNT } from '../shared/warden-ai.js';
import { createJugaad, actionsFor, perform, confiscateAll, canOpen, startAct2 } from '../shared/jugaad.js';

const away = { x: 2.5, z: 10.5, crouch: false, torch: false };
const run = (w, s, p = away) => { const ev = []; for (let t = 0; t < s; t += 0.05) ev.push(...updateWarden(w, 0.05, p)); return ev; };
const door = (map, k) => ({ type: 'door', door: map.doors.get(k) });

test('lights on: he spots you from much further, and faster', () => {
  const map = createMap();
  const w = createWarden(map, { x: 2.5, z: 6.5 }, WARDEN_ROUTE);
  w.yaw = yawTo(1, 0); w.lookOffset = 0;
  const far = { x: 20.5, z: 6.5, crouch: false, torch: false };
  w.lookOffset = 1;                                   // torch away: in the dark he misses you
  assert.equal(sightRate(w, far, map), 0);
  w.lightsOn = true;
  assert.ok(sightRate(w, far, map) > 0.4, '18 m away, lights on');
  const mid = { ...far, x: 12.5 };
  assert.ok(sightRate(w, mid, map) > 0.8, '10 m: meter fills in about a second');
});

test('hunting: faster, sees further and fills the meter quicker', () => {
  const map = createMap();
  const a = createWarden(map, { x: 2.5, z: 6.5 }, WARDEN_ROUTE);
  const b = createWarden(map, { x: 2.5, z: 6.5 }, WARDEN_ROUTE);
  b.alert = 1;
  for (const w of [a, b]) { w.yaw = yawTo(1, 0); w.lookOffset = 0; w.lightsOn = true; }
  const p = { x: 14.5, z: 6.5, crouch: false, torch: false };
  assert.ok(sightRate(b, p, map) > sightRate(a, p, map) * 1.3);
  a.lightsOn = b.lightsOn = false;
  run(a, 6); run(b, 6);
  const da = Math.hypot(a.x - 2.5, a.z - 6.5), db = Math.hypot(b.x - 2.5, b.z - 6.5);
  assert.ok(HUNT.speed > 1 && db > da, `hunting walks further: ${db.toFixed(1)} vs ${da.toFixed(1)}`);
});

test('he walks over and shuts a room door he sees standing open', () => {
  const map = createMap();
  const d = map.doors.get('12,5');
  d.open = true;
  const w = createWarden(map, { x: 16.5, z: 6.5 }, WARDEN_ROUTE);
  w.yaw = yawTo(-1, 0);
  const ev = run(w, 8);
  assert.equal(d.open, false);
  assert.ok(ev.some((e) => e.type === 'say' && /darwaza/.test(e.line)));
});

test('a grill you picked gets locked again; a grill you smashed only gets shut', () => {
  for (const [how, item] of [['pickGrill', 'lockpick'], ['smashGrill', 'bat']]) {
    const map = createMap();
    const st = createJugaad(map);
    st.inv.push(item);
    perform(st, door(map, '25,6'), actionsFor(st, door(map, '25,6')).find((a) => a.id === how));
    const w = createWarden(map, { x: 30.5, z: 6.5 }, WARDEN_ROUTE);
    w.yaw = yawTo(-1, 0);
    let shut = false;
    for (let t = 0; t < 10 && !shut; t += 0.05) shut = updateWarden(w, 0.05, away).some((e) => e.type === 'errandDone' && e.tag === 'closeDoor');
    const g = map.doors.get('25,6');
    assert.equal(g.open, false, `${how}: shut`);
    assert.equal(g.locked, how === 'pickGrill', `${how}: locked again?`);
  }
});

test("the main gate key is not only the chowkidar's: a spare in his desk, and his own bunch", () => {
  const map = createMap();
  const st = createJugaad(map);
  perform(st, { type: 'container', container: st.containers.get('38,3') }, { id: 'search' });
  assert.ok(st.inv.includes('gatekey'), "spare key in the warden's desk");

  const st2 = createJugaad(createMap());
  const t = { type: 'warden' };
  assert.deepEqual(actionsFor(st2, t, { behind: false }), [], 'not from the front');
  perform(st2, t, actionsFor(st2, t, { behind: true })[0]);
  assert.ok(st2.inv.includes('masterkey'));
  assert.equal(actionsFor(st2, door(st2.map, '25,6'))[0].id, 'unlockGrill');
  assert.equal(actionsFor(st2, door(st2.map, '32,13'))[0].id, 'unlockMain');
  perform(st2, door(st2.map, '32,13'), actionsFor(st2, door(st2.map, '32,13'))[0]);
  assert.ok(st2.inv.includes('masterkey'), 'you keep the key after unlocking');
});

test('in your own room he leaves you be', () => {
  const map = createMap();
  map.doors.get('2,8').open = true;
  const w = createWarden(map, { x: 2.5, z: 7.6 }, WARDEN_ROUTE);
  w.yaw = 0; w.lookOffset = 0;
  const me = { x: 2.5, z: 10.5, crouch: false, torch: true, inRoom: true };
  assert.equal(sightRate(w, me, map), 0);
  assert.ok(sightRate(w, { ...me, inRoom: false }, map) > 0);
});

test('only from behind his back', () => {
  const map = createMap();
  const w = createWarden(map, { x: 10.5, z: 6.5 }, WARDEN_ROUTE);
  w.yaw = yawTo(1, 0);                                 // facing +x
  assert.equal(isBehind(w, { x: 9.4, z: 6.5 }), true);
  assert.equal(isBehind(w, { x: 11.5, z: 6.5 }), false);
});

test('caught: every tool goes, his keys go back to him, the phone stays', () => {
  const st = createJugaad(createMap());
  st.inv.push('lockpick', 'bat', 'masterkey');
  st.wardenKeys = false;
  const taken = confiscateAll(st);
  assert.deepEqual(st.inv, ['phone']);
  assert.equal(taken.length, 3);
  assert.equal(st.wardenKeys, true);
  const almirah = st.containers.get('35,1').items;
  assert.ok(almirah.includes('lockpick') && almirah.includes('bat') && !almirah.includes('masterkey'));
  assert.equal(canOpen(st, 'grill'), false);
});

test('your room check: he walks in and back out, shutting the door behind him', () => {
  const map = createMap();
  startAct2(createJugaad(map));
  const w = createWarden(map, { x: 10.5, z: 6.5 }, WARDEN_ROUTE);
  // Imported lazily to keep the other tests independent of errands.
  return import('../shared/warden-ai.js').then(({ sendWarden }) => {
    assert.ok(sendWarden(w, 2.5, 9.6, 1.5, 'roomcheck'));
    const out = { x: 31.5, z: 11.5, crouch: false, torch: false };   // you are out in the lobby
    const ev = run(w, 15, out);
    assert.ok(ev.some((e) => e.type === 'errandDone' && e.tag === 'roomcheck'));
    run(w, 6, out);
    assert.equal(map.doors.get('2,8').open, false, 'door shut behind him');
  });
});

test('difficulty scales the warden and the chances; taking everything is Warden Mode only', async () => {
  const { DIFFICULTY, getDifficulty } = await import('../shared/difficulty.js');
  const map = createMap();
  const p = { x: 12, z: 6.5, crouch: false, torch: false };
  const rates = ['easy', 'normal', 'hard'].map((id) => {
    const w = createWarden(map, { x: 2.5, z: 6.5 }, []);
    w.diff = DIFFICULTY[id].warden; w.lightsOn = true; w.yaw = yawTo(1, 0);
    return sightRate(w, p, map);
  });
  assert.ok(rates[0] < rates[1] && rates[1] < rates[2], rates.join(' < '));
  assert.ok(DIFFICULTY.easy.chances > DIFFICULTY.normal.chances && DIFFICULTY.normal.chances > DIFFICULTY.hard.chances);
  assert.equal(DIFFICULTY.easy.confiscate, 'held');
  assert.equal(DIFFICULTY.normal.confiscate, 'held');
  assert.equal(DIFFICULTY.hard.confiscate, 'all');
  assert.equal(getDifficulty('nonsense').id, 'normal');
});
