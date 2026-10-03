// The hostel block as a grid of 1 m cells, plus everything that only needs
// the grid: collision, line of sight and path finding. No Three.js here, so
// the tests can run it in Node.

// Legend
//   #  wall (full height)           .  floor
//   b  bed (low)                    t  table (low)
//   s  sofa (low)                   Q  canteen counter (low)
//   c  almirah / cabinet (tall)     T  tree (tall)
//   D  room door                    G  wing grill gate (locked, see-through)
//   M  main gate (locked, see-through)
//   o  outside ground               P  player start (floor)
export const ROWS = [
  '##########################################',
  '#bb.c#bb.c#bb.c#bb.c#bb.c#s.cc...s#c...bb#',
  '#....#....#....#....#....#s.......#......#',
  '#....#....#....#....#....#s...tt..#...tt.#',
  '#t..t#t..t#t..t#t..t#t..t#........#......#',
  '##D####D####D####D####D#####....#####D####',
  '#........................G...............#',
  '#........................G...............#',
  '##D####D####D####D####D###...............#',
  '#t..t#t..t#t..t#t..t#t..t#...............#',
  '#.P..#....#....#....#....#..#.........#..#',
  '#....#....#....#....#....#..........tt...#',
  '#bb.c#bb.c#bb.c#bb.c#bb.c#c.............c#',
  '###############################MMM########',
  '#oooooooooooooooooooooooooooooooooooooooo#',
  '#ooooTooooooooooTooooooooooooooooooooooTo#',
  '#oooooooooooooooooooooooooooooooooooooooo#',
  '#ooooooooooTooooooooooooToooooooooooooooo#',
  '#oooooooooooooooooooooooooooooooQQQQQQQoo#',
  '#ooTooooooooooooooooooooooooooooooooooooo#',
  '#oooooooooooooooooooooooooooooooooooooooo#',
  '##########################################',
];

export const WALL_H = 3;
export const LOW = new Set(['b', 't', 's', 'Q']);
export const TALL = new Set(['#', 'c', 'T']);
export const GATES = new Set(['G', 'M']);

// Where Warden Saab walks, in cell coordinates, with how long he stops and
// which way he looks while stopped (yaw, radians; 0 = facing +z / south).
export const WARDEN_START = { x: 37.5, z: 2.5 };
export const WARDEN_ROUTE = [
  { x: 37.5, z: 3.5, wait: 6, look: Math.PI / 2 },      // his desk
  { x: 34.5, z: 7.0, wait: 1, look: -Math.PI / 2 },
  { x: 30.0, z: 10.5, wait: 3, look: 0 },               // looks at the main gate
  { x: 27.0, z: 6.5, wait: 2, look: -Math.PI / 2 },     // peers down the wing
  { x: 13.5, z: 7.0, wait: 2, look: Math.PI / 2 },
  { x: 2.5, z: 6.5, wait: 4, look: -Math.PI / 2 },      // end of the wing
  { x: 18.0, z: 7.0, wait: 1, look: Math.PI / 2 },
  { x: 29.5, z: 3.0, wait: 4, look: Math.PI / 2 },      // common room
  { x: 36.5, z: 10.5, wait: 3, look: 0 },
];

export function createMap(rows = ROWS) {
  const h = rows.length;
  const w = rows[0].length;
  const cells = rows.map((r) => r.split(''));
  let spawn = null;
  const doors = new Map();
  for (let z = 0; z < h; z++) {
    if (rows[z].length !== w) throw new Error(`map row ${z} is ${rows[z].length} wide, expected ${w}`);
    for (let x = 0; x < w; x++) {
      const c = cells[z][x];
      if (c === 'P') { spawn = { x: x + 0.5, z: z + 0.5 }; cells[z][x] = '.'; }
      if (c === 'D' || c === 'G' || c === 'M') {
        doors.set(key(x, z), { x, z, kind: c, open: false, locked: c !== 'D' });
      }
    }
  }
  return { w, h, cells, spawn, doors };
}

export const key = (x, z) => `${x},${z}`;

export function cellAt(map, x, z) {
  const cx = Math.floor(x), cz = Math.floor(z);
  if (cx < 0 || cz < 0 || cx >= map.w || cz >= map.h) return '#';
  return map.cells[cz][cx];
}

export function doorAt(map, cx, cz) {
  return map.doors.get(key(cx, cz)) || null;
}

// Can the player stand in this cell?
export function solidForPlayer(map, cx, cz) {
  if (cx < 0 || cz < 0 || cx >= map.w || cz >= map.h) return true;
  const c = map.cells[cz][cx];
  if (c === '.' || c === 'o') return false;
  if (c === 'D' || c === 'G' || c === 'M') return !doorAt(map, cx, cz).open;
  return true;
}

// The warden has every key and opens doors as he goes.
export function walkableForWarden(map, cx, cz) {
  if (cx < 0 || cz < 0 || cx >= map.w || cz >= map.h) return false;
  const c = map.cells[cz][cx];
  return c === '.' || c === 'o' || c === 'D' || c === 'G' || c === 'M';
}

// Push a circle out of every solid cell it overlaps. Returns the new position.
export function moveCircle(map, x, z, dx, dz, r, solid = solidForPlayer) {
  let nx = x + dx, nz = z + dz;
  for (let iter = 0; iter < 4; iter++) {
    let pushed = false;
    const x0 = Math.floor(nx - r), x1 = Math.floor(nx + r);
    const z0 = Math.floor(nz - r), z1 = Math.floor(nz + r);
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (!solid(map, cx, cz)) continue;
        const px = Math.max(cx, Math.min(nx, cx + 1));
        const pz = Math.max(cz, Math.min(nz, cz + 1));
        let ox = nx - px, oz = nz - pz;
        const d2 = ox * ox + oz * oz;
        if (d2 >= r * r) continue;
        if (d2 < 1e-9) {
          // Centre is inside the cell: back out the way we came.
          ox = x - nx; oz = z - nz;
          const l = Math.hypot(ox, oz) || 1;
          nx += (ox / l) * r; nz += (oz / l) * r;
        } else {
          const d = Math.sqrt(d2);
          nx += (ox / d) * (r - d); nz += (oz / d) * (r - d);
        }
        pushed = true;
      }
    }
    if (!pushed) break;
  }
  return { x: nx, z: nz };
}

// Does this cell block a line of sight? Low furniture hides a crouching
// target only when it is right next to them.
function blocksSight(map, cx, cz, opts, tx, tz) {
  if (cx < 0 || cz < 0 || cx >= map.w || cz >= map.h) return true;
  const c = map.cells[cz][cx];
  if (TALL.has(c)) return true;
  if (c === 'D') return !doorAt(map, cx, cz).open;
  if (LOW.has(c) && opts.targetCrouched) {
    const d = Math.hypot(cx + 0.5 - tx, cz + 0.5 - tz);
    return d < 1.6;
  }
  return false;
}

// Grid walk (Amanatides & Woo) from (x0,z0) to (x1,z1). The start and end
// cells never block, so standing in a doorway still counts as visible.
export function lineOfSight(map, x0, z0, x1, z1, opts = {}) {
  let cx = Math.floor(x0), cz = Math.floor(z0);
  const ex = Math.floor(x1), ez = Math.floor(z1);
  const dx = x1 - x0, dz = z1 - z0;
  const sx = Math.sign(dx), sz = Math.sign(dz);
  const tdx = sx ? Math.abs(1 / dx) : Infinity;
  const tdz = sz ? Math.abs(1 / dz) : Infinity;
  let tmx = sx > 0 ? (cx + 1 - x0) * tdx : sx < 0 ? (x0 - cx) * tdx : Infinity;
  let tmz = sz > 0 ? (cz + 1 - z0) * tdz : sz < 0 ? (z0 - cz) * tdz : Infinity;
  for (let guard = 0; guard < 500; guard++) {
    if (cx === ex && cz === ez) return true;
    if (tmx < tmz) { tmx += tdx; cx += sx; } else { tmz += tdz; cz += sz; }
    if (cx === ex && cz === ez) return true;
    if (blocksSight(map, cx, cz, opts, x1, z1)) return false;
  }
  return false;
}

// A* over cells with 8 neighbours (no cutting corners). Returns cell-centre
// waypoints from start to goal, or null.
export function findPath(map, sx, sz, gx, gz, walkable = walkableForWarden) {
  const start = [Math.floor(sx), Math.floor(sz)];
  const goal = [Math.floor(gx), Math.floor(gz)];
  if (!walkable(map, goal[0], goal[1])) return null;
  const W = map.w;
  const idx = (x, z) => z * W + x;
  const g = new Float64Array(map.w * map.h).fill(Infinity);
  const came = new Int32Array(map.w * map.h).fill(-1);
  const closed = new Uint8Array(map.w * map.h);
  const open = [];
  const hfn = (x, z) => {
    const ax = Math.abs(x - goal[0]), az = Math.abs(z - goal[1]);
    return Math.max(ax, az) + 0.414 * Math.min(ax, az);
  };
  const s = idx(start[0], start[1]);
  g[s] = 0;
  open.push({ i: s, f: hfn(start[0], start[1]) });
  const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (open[k].f < open[bi].f) bi = k;
    const { i } = open.splice(bi, 1)[0];
    if (closed[i]) continue;
    closed[i] = 1;
    const x = i % W, z = (i - x) / W;
    if (x === goal[0] && z === goal[1]) {
      const out = [];
      for (let c = i; c !== -1; c = came[c]) out.push({ x: (c % W) + 0.5, z: Math.floor(c / W) + 0.5 });
      out.reverse();
      out[out.length - 1] = { x: gx, z: gz };
      return out;
    }
    for (const [ddx, ddz, cost] of dirs) {
      const nx = x + ddx, nz = z + ddz;
      if (!walkable(map, nx, nz)) continue;
      if (ddx && ddz && (!walkable(map, x + ddx, z) || !walkable(map, x, z + ddz))) continue;
      const ni = idx(nx, nz);
      if (closed[ni]) continue;
      const ng = g[i] + cost;
      if (ng < g[ni]) {
        g[ni] = ng; came[ni] = i;
        open.push({ i: ni, f: ng + hfn(nx, nz) });
      }
    }
  }
  return null;
}

// Where in the building is this point? Used for the HUD.
export function areaName(x, z) {
  if (z >= 13) return 'Hostel ground';
  if (x < 25) {
    if (z >= 6 && z < 8) return 'Wing corridor';
    const room = Math.floor(x / 5) + 1 + (z > 8 ? 5 : 0);
    return `Room ${100 + room}`;
  }
  if (z < 5 && x < 34) return 'Common room';
  if (z < 5) return "Warden's room";
  return 'Lobby';
}
