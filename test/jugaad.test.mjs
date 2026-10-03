import test from 'node:test';
import assert from 'node:assert/strict';
import { createMap } from '../shared/map.js';
import {
  ITEMS, RECIPES, LOOT, createJugaad, actionsFor, perform, combine, MY_DOOR,
  updateJugaad, chowkidarHears, setAlarm, score, recipeFor,
} from '../shared/jugaad.js';

const fresh = () => { const map = createMap(); return { map, st: createJugaad(map) }; };
const door = (map, k) => ({ type: 'door', door: map.doors.get(k) });
const ids = (acts) => acts.map((a) => a.id);
function search(st, id) {
  const c = st.containers.get(id);
  assert.ok(c, `no container at ${id}`);
  perform(st, { type: 'container', container: c }, { id: 'search' });
}
function act(st, target, id, ctx = {}) {
  const a = actionsFor(st, target, ctx).find((x) => x.id === id);
  assert.ok(a, `${id} not offered; offered: ${ids(actionsFor(st, target, ctx))}`);
  return perform(st, target, a, ctx);
}

test('every hidden item exists and sits in a real container', () => {
  const { st } = fresh();
  for (const [id, items] of Object.entries(LOOT)) {
    assert.ok(st.containers.has(id), `LOOT key ${id} is not a container`);
    for (const it of items) assert.ok(ITEMS[it], `unknown item ${it}`);
  }
  for (const r of RECIPES) for (const k of [r.a, r.b, r.makes]) assert.ok(ITEMS[k]);
});

test('your door, way 1: newspaper under the door, poke the key, pull it in', () => {
  const { map, st } = fresh();
  const t = door(map, MY_DOOR);
  assert.deepEqual(actionsFor(st, t, { inside: true }), []);
  search(st, '1,12'); search(st, '1,9');            // newspaper, compass
  act(st, t, 'slidePaper', { inside: true });
  act(st, t, 'pokeKey', { inside: true });
  act(st, t, 'pullPaper', { inside: true });
  act(st, t, 'unlock106', { inside: true });
  assert.equal(t.door.locked, false);
  assert.equal(st.solved.room.kind, 'improvised');
});

test('your door, way 2: a hanger through the ventilator', () => {
  const { map, st } = fresh();
  const t = door(map, MY_DOOR);
  search(st, '4,12');                               // hanger
  act(st, t, 'vent', { inside: true });
  assert.equal(t.door.locked, false);
});

test('grill gate: pick it (combined tool) or smash it (bat)', () => {
  let { map, st } = fresh();
  search(st, '4,9'); search(st, '1,9');             // bobby pin, compass
  st.sel = st.inv.indexOf('bobbypin');
  assert.equal(recipeFor(st).ready, true);
  assert.equal(combine(st).makes, 'lockpick');
  act(st, door(map, '25,6'), 'pickGrill');
  assert.equal(map.doors.get('25,7').open, true);
  assert.equal(st.solved.grill.kind, 'improvised');

  ({ map, st } = fresh());
  search(st, '21,1');                               // bat in room 105
  const ev = act(st, door(map, '25,7'), 'smashGrill');
  assert.ok(ev.some((e) => e.type === 'noise' && e.r >= 15), 'smashing should be loud');
  assert.equal(st.solved.grill.kind, 'brute');
});

test('main gate: hook the keys, grab them, or break the window', () => {
  let { map, st } = fresh();
  search(st, '4,12'); search(st, '1,4');            // hanger, ruler
  st.sel = st.inv.indexOf('ruler');
  assert.equal(combine(st).makes, 'longhook');
  const chow = { type: 'chowkidar' };
  assert.deepEqual(ids(actionsFor(st, chow, { dist: 3 })), []);
  act(st, chow, 'hookKeys', { dist: 2 });
  act(st, door(map, '32,13'), 'unlockMain');
  assert.equal(map.doors.get('31,13').open, true);
  assert.equal(st.solved.main.kind, 'improvised');

  ({ map, st } = fresh());
  act(st, chow, 'grabKeys', { dist: 1 });
  act(st, door(map, '31,13'), 'unlockMain');
  assert.equal(st.solved.main.kind, 'sneaky');

  ({ map, st } = fresh());
  search(st, '21,12');                              // bat in room 110
  act(st, door(map, '27,13'), 'smashWindow');
  assert.equal(map.doors.get('27,13').open, true);
  assert.equal(st.solved.main.kind, 'brute');
});

test('occupied rooms answer a knock with a shout the warden can hear', () => {
  const { map, st } = fresh();
  act(st, door(map, '7,8'), 'knock');
  let ev = [];
  for (let i = 0; i < 40; i++) ev.push(...updateJugaad(st, 0.05, { player: { x: 2, z: 7 }, warden: null }));
  assert.ok(ev.some((e) => e.type === 'noise' && e.r >= 10));
  assert.ok(ev.some((e) => e.type === 'say'));
});

test('a loud noise wakes the chowkidar, who shouts for the warden', () => {
  const { st } = fresh();
  chowkidarHears(st, [{ x: 30, z: 12, r: 18 }]);
  const ev = updateJugaad(st, 0.05, { player: { x: 2, z: 7 }, warden: null });
  assert.equal(st.chowkidar.awake, true);
  assert.ok(ev.some((e) => e.type === 'noise' && e.r >= 25));
});

test('a ringing phone the warden finds is confiscated into his almirah', () => {
  const { st } = fresh();
  setAlarm(st, 10.5, 7);
  assert.equal(st.inv.includes('phone'), false);
  const warden = { x: 10.5, z: 7.4 };
  for (let i = 0; i < 200; i++) updateJugaad(st, 0.05, { player: { x: 2, z: 10 }, warden });
  assert.ok(st.containers.get('35,1').items.includes('phone'));
});

test('the score card rewards improvised answers over brute force', () => {
  const a = fresh(), b = fresh();
  search(a.st, '4,12'); act(a.st, door(a.map, MY_DOOR), 'vent', { inside: true });
  search(b.st, '21,1'); act(b.st, door(b.map, '25,6'), 'smashGrill');
  assert.ok(score(a.st, 0).total > score(b.st, 0).total);
});
