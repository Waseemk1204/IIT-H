import test from 'node:test';
import assert from 'node:assert/strict';
import { ROWS, createMap, cellAt, moveCircle, lineOfSight, findPath, solidForPlayer, WARDEN_ROUTE, WARDEN_START } from '../shared/map.js';

test('every row is the same width and the player has a start', () => {
  const map = createMap();
  for (const r of ROWS) assert.equal(r.length, map.w);
  assert.ok(map.spawn);
  assert.equal(cellAt(map, map.spawn.x, map.spawn.z), '.');
});

test('the warden can reach every stop on his route', () => {
  const map = createMap();
  let from = WARDEN_START;
  for (const p of [...WARDEN_ROUTE, WARDEN_ROUTE[0]]) {
    assert.ok(findPath(map, from.x, from.z, p.x, p.z), `no path to ${p.x},${p.z}`);
    from = p;
  }
});

test('the player cannot walk through walls, closed doors or locked gates', () => {
  const map = createMap();
  // Walk north from the start room into its closed door.
  let pos = { x: 2.5, z: 10.5 };
  for (let i = 0; i < 100; i++) pos = moveCircle(map, pos.x, pos.z, 0, -0.05, 0.25);
  assert.ok(pos.z > 9.2, `went through the door: z=${pos.z}`);
  // Open it and the corridor is reachable.
  map.doors.get('2,8').open = true;
  for (let i = 0; i < 100; i++) pos = moveCircle(map, pos.x, pos.z, 0, -0.05, 0.25);
  assert.ok(pos.z < 8, `still stuck: z=${pos.z}`);
  // The grill gate holds.
  pos = { x: 22.5, z: 6.8 };
  for (let i = 0; i < 200; i++) pos = moveCircle(map, pos.x, pos.z, 0.05, 0, 0.25);
  assert.ok(pos.x < 25, `walked through the grill gate: x=${pos.x}`);
  assert.equal(solidForPlayer(map, 25, 6), true);
});

test('sight is blocked by walls and closed doors but not by the grill gate', () => {
  const map = createMap();
  assert.equal(lineOfSight(map, 2.5, 6.5, 20.5, 6.5), true, 'straight down the corridor');
  assert.equal(lineOfSight(map, 2.5, 6.5, 2.5, 10.5), false, 'into a room with the door shut');
  map.doors.get('2,8').open = true;
  assert.equal(lineOfSight(map, 2.5, 6.5, 2.5, 10.5), true, 'door open');
  assert.equal(lineOfSight(map, 30.5, 6.5, 20.5, 6.5), true, 'through the grill');
  assert.equal(lineOfSight(map, 2.5, 3.5, 7.5, 3.5), false, 'through a room wall');
});

test('low furniture hides you only when you crouch right behind it', () => {
  const map = createMap();
  // The lobby desk is at (36,11)-(37,11). The warden looks from the north.
  const wx = 36.5, wz = 7.5;
  assert.equal(lineOfSight(map, wx, wz, 36.5, 12.3, { targetCrouched: false }), true, 'standing behind the desk');
  assert.equal(lineOfSight(map, wx, wz, 36.5, 12.3, { targetCrouched: true }), false, 'crouched behind the desk');
  assert.equal(lineOfSight(map, wx, wz, 31.5, 12.3, { targetCrouched: true }), true, 'crouched in the open');
});
