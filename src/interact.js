// What are you looking at? Doors, containers, the radio, items on the floor
// and the sleeping chowkidar, within arm's reach in front of you.
import { doorAt, solidForPlayer } from '../shared/map.js';
import { RADIO, MY_DOOR, BOARD } from '../shared/jugaad.js';
import { forward } from './player.js';

const REACH = 1.7;

function angleTo(p, f, x, z) {
  const dx = x - p.x, dz = z - p.z;
  const d = Math.hypot(dx, dz) || 1e-6;
  return { d, cos: (dx * f.x + dz * f.z) / d };
}

export function findTarget(player, st) {
  const map = st.map;
  const f = forward(player);
  let best = null;

  // Things lying on the floor.
  for (const w of st.worldItems) {
    const { d, cos } = angleTo(player, f, w.x, w.z);
    if (d < 1.6 && cos > 0.82 && (!best || d < best.dist)) best = { type: 'item', w, dist: d, at: { x: w.x, z: w.z }, key: `item:${w.id}` };
  }
  if (best) return best;

  // The chowkidar (reachable from further away with a long hook).
  const ch = st.chowkidar;
  const c = angleTo(player, f, ch.x, ch.z);
  if (c.d < 2.5 && c.cos > 0.85) return { type: 'chowkidar', dist: c.d, at: { x: ch.x, z: ch.z }, key: 'chowkidar' };

  // Walk a ray forward through the grid.
  for (let d = 0.35; d <= REACH; d += 0.15) {
    const x = player.x + f.x * d, z = player.z + f.z * d;
    const cx = Math.floor(x), cz = Math.floor(z);
    const k = `${cx},${cz}`;
    const door = doorAt(map, cx, cz);
    if (door) {
      const inside = k === MY_DOOR ? player.z > 8.5 : false;
      return { type: 'door', door, dist: d, inside, at: { x: cx + 0.5, z: cz + 0.5 }, key: `door:${k}` };
    }
    if (RADIO.cells.includes(k)) return { type: 'radio', dist: d, at: { x: RADIO.x, z: RADIO.z }, key: 'radio' };
    const circle = st.circleByCell.get(k);
    if (circle && st.act === 2) return { type: 'circle', circle, dist: d, at: { x: cx + 0.5, z: cz + 0.5 }, key: `circle:${circle.id}` };
    if (k === BOARD.cell) return { type: 'board', dist: d, at: { x: BOARD.x, z: BOARD.z }, key: 'board' };
    const cont = st.byCell.get(k);
    if (cont) return { type: 'container', container: cont, dist: d, at: { x: cx + 0.5, z: cz + 0.5 }, key: `cont:${cont.id}` };
    if (solidForPlayer(map, cx, cz)) return null;
  }
  return null;
}

// Where does a thrown thing land? Up to `range` metres ahead, short of walls.
export function landingPoint(player, map, range = 7) {
  const f = forward(player);
  let last = { x: player.x, z: player.z };
  for (let d = 0.3; d <= range; d += 0.1) {
    const x = player.x + f.x * d, z = player.z + f.z * d;
    if (solidForPlayer(map, Math.floor(x), Math.floor(z))) break;
    last = { x, z };
  }
  // back off a little from whatever it hit
  return { x: last.x - f.x * 0.2, z: last.z - f.z * 0.2 };
}
