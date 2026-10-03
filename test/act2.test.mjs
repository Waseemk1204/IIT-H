import test from 'node:test';
import assert from 'node:assert/strict';
import { createMap, findPath, WARDEN_ROUTE, WARDEN_START } from '../shared/map.js';
import { createWarden, updateWarden, sightRate, sendWarden, yawTo } from '../shared/warden-ai.js';
import {
  createJugaad, startAct2, actionsFor, perform, restorePower, updateJugaad,
  STUDY_CIRCLES, BOARD, FUSE_BOX, POWER_FALLBACK,
} from '../shared/jugaad.js';

const act2 = () => { const map = createMap(); const st = createJugaad(map); startAct2(st); return { map, st }; };

test("study circles never block the warden's route, the gate or the seats", () => {
  const { map } = act2();
  let from = WARDEN_START;
  for (const p of [...WARDEN_ROUTE, WARDEN_ROUTE[0]]) {
    assert.ok(findPath(map, from.x, from.z, p.x, p.z), `blocked on the way to ${p.x},${p.z}`);
    from = p;
  }
  assert.ok(findPath(map, 3.5, 6.5, 30.5, 11.5), 'wing to lobby');
  for (const c of STUDY_CIRCLES) {
    assert.equal(map.extraSolid.has(`${Math.floor(c.seat.x)},${Math.floor(c.seat.z)}`), false, `seat of ${c.id} is inside the circle`);
  }
});

test('with the lights on he sees you without his torch; a book and a circle hide you', () => {
  const { map } = act2();
  const w = createWarden(map, { x: 34.5, z: 7.5 }, WARDEN_ROUTE);
  w.yaw = yawTo(-1, 0.5); w.lookOffset = 1.2;          // torch pointed well away
  const p = { x: 31.35, z: 9, crouch: false, torch: false };
  assert.equal(sightRate(w, p, map), 0, 'dark: torch elsewhere, so unseen');
  w.lightsOn = true;
  assert.ok(sightRate(w, p, map) > 0.3, 'lights on: seen');
  assert.equal(sightRate(w, { ...p, hidden: true }, map), 0, 'cramming in a circle: unseen');
});

test('borrow a book, sit, stand up', () => {
  const { st } = act2();
  const circle = STUDY_CIRCLES[0];
  const t = { type: 'circle', circle, at: { x: 7, z: 7.5 } };
  const go = (id) => perform(st, t, actionsFor(st, t).find((a) => a.id === id));
  go('borrowBook');
  assert.ok(st.inv.includes('book'));
  go('sit');
  assert.equal(st.seated, circle);
  go('standUp');
  assert.equal(st.seated, null);
});

test('three appliances in one board blow the fuse; it comes back with the appliances on the floor', () => {
  const { st } = act2();
  st.inv.push('kettle', 'iron', 'heater');
  const t = { type: 'board', at: BOARD };
  let ev = [];
  for (let i = 0; i < 3; i++) ev = perform(st, t, actionsFor(st, t)[0]);
  assert.equal(st.power.on, false);
  assert.ok(ev.some((e) => e.type === 'noise' && e.r >= 15));
  assert.ok(ev.some((e) => e.type === 'power' && e.on === false));
  assert.equal(st.solved.fuse.kind, 'improvised');
  restorePower(st);
  assert.equal(st.power.on, true);
  assert.equal(st.worldItems.filter((w) => ['kettle', 'iron', 'heater'].includes(w.item)).length, 3);
});

test('if nobody fixes the fuse, the power comes back by itself', () => {
  const { st } = act2();
  st.inv.push('kettle', 'iron', 'heater');
  const t = { type: 'board', at: BOARD };
  for (let i = 0; i < 3; i++) perform(st, t, actionsFor(st, t)[0]);
  for (let s = 0; s < POWER_FALLBACK + 1; s += 0.5) updateJugaad(st, 0.5, { player: { x: 2, z: 7 }, warden: null });
  assert.equal(st.power.on, true);
});

test('the warden walks to the fuse box, fiddles, and reports back', () => {
  const { map } = act2();
  const w = createWarden(map, { x: 30.5, z: 10.5 }, WARDEN_ROUTE);
  assert.ok(sendWarden(w, FUSE_BOX.x, FUSE_BOX.z, 3, 'fuse'));
  const away = { x: 2.5, z: 10.5, crouch: false, torch: false };
  const ev = [];
  for (let t = 0; t < 30 && !ev.some((e) => e.type === 'errandDone'); t += 0.05) ev.push(...updateWarden(w, 0.05, away));
  assert.ok(ev.some((e) => e.type === 'errandDone' && e.tag === 'fuse'));
  assert.equal(w.mode, 'patrol');
});
