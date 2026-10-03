import test from 'node:test';
import assert from 'node:assert/strict';
import { createMap, findPath, OUTSIDE_ROUTE, inMyRoom } from '../shared/map.js';
import { createWarden, updateWarden, sightRate, yawTo } from '../shared/warden-ai.js';
import {
  createJugaad, actionsFor, perform, updateJugaad, loseMaggi, MAGGI_TIME, EAT_TIME,
} from '../shared/jugaad.js';

const fresh = () => { const map = createMap(); return { map, st: createJugaad(map) }; };
const counter = { type: 'counter', at: { x: 35.5, z: 18.5 } };
const away = { x: 2.5, z: 10.5, crouch: false, torch: false };

test('order, wait two minutes, take it, eat it in your room', () => {
  const { map, st } = fresh();
  let ev = perform(st, counter, actionsFor(st, counter)[0]);
  assert.equal(st.maggi.state, 'cooking');
  assert.ok(ev.some((e) => e.type === 'act3'));
  assert.equal(map.doors.get('25,6').open, true, 'grill left open for the way back');
  assert.deepEqual(actionsFor(st, counter), [], 'nothing to take while it cooks');
  for (let t = 0; t < MAGGI_TIME - 1; t += 1) updateJugaad(st, 1, { player: away, warden: null });
  assert.equal(st.maggi.state, 'cooking');
  ev = [];
  for (let t = 0; t < 2; t += 1) ev.push(...updateJugaad(st, 1, { player: away, warden: null }));
  assert.equal(st.maggi.state, 'ready');
  assert.ok(ev.some((e) => e.type === 'noise'), 'Bhaiya shouts that it is ready');
  perform(st, counter, actionsFor(st, counter)[0]);
  assert.ok(st.inv.includes('maggi'));
  const eat = actionsFor(st, { type: 'eat' })[0];
  assert.equal(eat.id, 'eat');
  assert.equal(eat.hold, EAT_TIME);
  ev = perform(st, { type: 'eat' }, eat);
  assert.ok(ev.some((e) => e.type === 'won'));
  assert.equal(st.inv.includes('maggi'), false);
});

test('caught carrying it: the Maggi is gone and you order again', () => {
  const { st } = fresh();
  st.maggi = { state: 'ready', t: 0 };
  perform(st, counter, actionsFor(st, counter)[0]);
  assert.ok(loseMaggi(st));
  assert.equal(st.maggi.state, 'none');
  assert.equal(actionsFor(st, counter)[0].id, 'order');
});

test('his compound rounds are walkable and pass close to the stall', () => {
  const map = createMap();
  let from = OUTSIDE_ROUTE[0];
  for (const p of [...OUTSIDE_ROUTE, OUTSIDE_ROUTE[0]]) {
    assert.ok(findPath(map, from.x, from.z, p.x, p.z), `no path to ${p.x},${p.z}`);
    from = p;
  }
  assert.ok(OUTSIDE_ROUTE.some((p) => Math.hypot(p.x - 36, p.z - 18) < 2));
});

test('standing in the lantern light he sees you without his torch', () => {
  const map = createMap();
  const w = createWarden(map, { x: 30.5, z: 17 }, OUTSIDE_ROUTE);
  w.yaw = yawTo(1, 0.3); w.lookOffset = -1.2;        // torch pointed away
  const p = { x: 35.5, z: 17.5, crouch: false, torch: false };
  assert.equal(sightRate(w, p, map), 0, 'in the dark: unseen');
  assert.ok(sightRate(w, { ...p, lit: true }, map) > 0.3, 'in the lantern light: seen');
});

test('a smell carries a line of its own and brings him over', () => {
  const map = createMap();
  const w = createWarden(map, { x: 6.5, z: 7 }, OUTSIDE_ROUTE);
  const ev = updateWarden(w, 0.05, away, [{ x: 4.5, z: 7, r: 3.2, line: 'Ye... Maggi ki khushboo?!' }]);
  assert.equal(w.mode, 'investigate');
  assert.ok(ev.some((e) => e.line === 'Ye... Maggi ki khushboo?!'));
});

test('your room is where the eating happens', () => {
  assert.ok(inMyRoom(2.5, 10.5));
  assert.equal(inMyRoom(2.5, 7), false);
  assert.equal(inMyRoom(7.5, 10.5), false);
});
