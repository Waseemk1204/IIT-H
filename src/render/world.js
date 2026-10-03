// Builds the hostel in 3D from the grid in shared/map.js.
import * as THREE from 'three';
import { WALL_H, areaName } from '../../shared/map.js';
import { toon, inkBox, inkMesh, inkLines, canvasTexture, outlined } from './toon.js';

const PAINT_H = 1.1;             // the green oil-paint band every hostel has
const COMPOUND_H = 2.2;          // outer boundary wall
const C = {
  paint: 0x5f9b7c, distemper: 0xd8cfa6, compound: 0x9a5a44, ceiling: 0x3a3a3f,
  door: 0x8a5a2b, frame: 0x5b3a1d, steel: 0x3d5a62, almirah: 0x6f8f8a,
  bedFrame: 0x4a3324, mattress: 0x4d6fae, sheet: 0xe8e0c8, pillow: 0xf2ecd8,
  table: 0x9b6a3c, sofa: 0x8c3b3b, trunk: 0x4b3424, leaf: 0x2f5a35,
  counter: 0x7a4b2a, tin: 0x8b9aa0,
};

// Merge many axis-aligned boxes into one geometry (one draw call).
function mergeBoxes(boxes) {
  const pos = [], nor = [];
  for (const b of boxes) {
    const g = new THREE.BoxGeometry(b.w, b.h, b.d).toNonIndexed();
    g.translate(b.x, b.y, b.z);
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

function textPanel(lines, { w = 512, h = 320, bg = '#f4ead0', fg = '#1a1410', font = 'bold 46px "Bangers", Impact, sans-serif', border = '#1a1410' } = {}) {
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 12; ctx.strokeStyle = border; ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => {
      ctx.font = typeof l === 'object' ? l.font : font;
      ctx.fillText(typeof l === 'object' ? l.text : l, w / 2, (h / (lines.length + 1)) * (i + 1));
    });
  });
}

function signMesh(tex, w, h) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshToonMaterial({ map: tex }));
  return m;
}

export function buildWorld(map) {
  const root = new THREE.Group();
  const isWall = (x, z) => x < 0 || z < 0 || x >= map.w || z >= map.h || map.cells[z][x] === '#';
  const outdoor = (z) => z >= 14;

  // ---- Floors and ceiling
  const tiles = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b9ad94'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      const c = ['#8a7f6a', '#d9cfb8', '#6f6656', '#a3463b', '#cfc3a5'][i % 5];
      ctx.fillStyle = c;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 2 + Math.random() * 3);
    }
    ctx.strokeStyle = '#5d5547'; ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, w, h);
  }, [map.w, 14]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(map.w, 14), new THREE.MeshToonMaterial({ map: tiles }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(map.w / 2, 0, 7);
  floor.receiveShadow = true;
  root.add(floor);

  const dirt = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2b3324'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = ['#38432c', '#22291c', '#4a4632', '#3b4a2c'][i % 4];
      ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    }
  }, [map.w / 3, 3]);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(map.w, 9),
    new THREE.MeshToonMaterial({ map: dirt, emissive: 0x0d1428 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(map.w / 2, -0.001, 17.5);
  ground.receiveShadow = true;
  root.add(ground);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(map.w, 13), toon(C.ceiling));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(map.w / 2, WALL_H, 6.5);
  root.add(ceiling);

  // ---- Walls: two-tone boxes merged, with ink lines on exposed edges only
  const lower = [], upper = [], compound = [], lines = [];
  const seg = (x0, y0, z0, x1, y1, z1) => lines.push(x0, y0, z0, x1, y1, z1);
  for (let z = 0; z < map.h; z++) {
    for (let x = 0; x < map.w; x++) {
      if (!isWall(x, z)) continue;
      const out = outdoor(z);
      const H = out ? COMPOUND_H : WALL_H;
      if (out) {
        compound.push({ w: 1, h: H, d: 1, x: x + 0.5, y: H / 2, z: z + 0.5 });
      } else {
        lower.push({ w: 1, h: PAINT_H, d: 1, x: x + 0.5, y: PAINT_H / 2, z: z + 0.5 });
        upper.push({ w: 1, h: H - PAINT_H, d: 1, x: x + 0.5, y: PAINT_H + (H - PAINT_H) / 2, z: z + 0.5 });
      }
      // Each side that faces open space gets ink lines.
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (isWall(x + nx, z + nz)) continue;
        // The face runs along the other axis.
        const ax = nx !== 0 ? x + (nx > 0 ? 1 : 0) : null;
        const az = nz !== 0 ? z + (nz > 0 ? 1 : 0) : null;
        const ys = out ? [0.02, H] : [0.02, PAINT_H, H - 0.02];
        for (const y of ys) {
          if (ax !== null) seg(ax, y, z, ax, y, z + 1);
          else seg(x, y, az, x + 1, y, az);
        }
        // Vertical edge where this face ends (a corner).
        const ends = nx !== 0 ? [[0, -1, z], [0, 1, z + 1]] : [[-1, 0, x], [1, 0, x + 1]];
        for (const [ex, ez, at] of ends) {
          const sx = x + ex, sz = z + ez;
          const continues = isWall(sx, sz) && !isWall(sx + nx, sz + nz);
          if (continues) continue;
          if (ax !== null) seg(ax, 0, at, ax, H, at);
          else seg(at, 0, az, at, H, az);
        }
      }
    }
  }
  const wallMesh = (boxes, color) => {
    const m = new THREE.Mesh(mergeBoxes(boxes), toon(color));
    m.castShadow = true; m.receiveShadow = true;
    root.add(m);
  };
  wallMesh(lower, C.paint);
  wallMesh(upper, C.distemper);
  wallMesh(compound, C.compound);
  root.add(inkLines(lines));

  // ---- Furniture: group runs of the same letter into one piece
  const used = new Set();
  const run = (x, z, ch) => {
    let len = 1, horiz = true;
    while (map.cells[z][x + len] === ch) len++;
    if (len === 1) {
      while (map.cells[z + len]?.[x] === ch) len++;
      horiz = len === 1;
    }
    for (let i = 0; i < len; i++) used.add(horiz ? `${x + i},${z}` : `${x},${z + i}`);
    return { len, horiz };
  };
  // Which side of a cell is open floor? Used to face furniture outward.
  const facing = (x, z) => {
    for (const [dx, dz, yaw] of [[0, 1, 0], [0, -1, Math.PI], [1, 0, Math.PI / 2], [-1, 0, -Math.PI / 2]]) {
      const c = map.cells[z + dz]?.[x + dx];
      if (c === '.' || c === 'o') return yaw;
    }
    return 0;
  };

  for (let z = 0; z < map.h; z++) {
    for (let x = 0; x < map.w; x++) {
      const ch = map.cells[z][x];
      if (used.has(`${x},${z}`)) continue;
      if (ch === 'b') { const r = run(x, z, ch); root.add(bed(x, z, r)); }
      else if (ch === 't') { const r = run(x, z, ch); root.add(table(x, z, r, z > 9 && x > 30)); }
      else if (ch === 's') { const r = run(x, z, ch); root.add(sofa(x, z, r)); }
      else if (ch === 'Q') { const r = run(x, z, ch); root.add(counter(x, z, r)); }
      else if (ch === 'c') { const g = almirah(); g.position.set(x + 0.5, 0, z + 0.5); g.rotation.y = facing(x, z); root.add(g); }
      else if (ch === 'T') { root.add(tree(x + 0.5, z + 0.5)); }
    }
  }

  // ---- Doors
  const doors = new Map();
  const gates = [];
  for (const door of map.doors.values()) {
    if (door.kind !== 'D') continue;
    const { x, z } = door;
    const pivot = new THREE.Group();
    pivot.position.set(x + 0.05, 0, z + 0.5);
    const panel = inkBox(0.9, 2.15, 0.06, C.door, 0.45, 0, 0);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), toon(0xd4b04a));
    knob.position.set(0.8, 1.0, 0.05);
    panel.add(knob);
    const knob2 = knob.clone(); knob2.position.z = -0.05; panel.add(knob2);
    pivot.add(panel);
    root.add(pivot);
    // Lintel above the door.
    root.add(inkBox(1, WALL_H - 2.2, 1, C.distemper, x + 0.5, 2.2, z + 0.5));
    const swing = z < 6 ? Math.PI / 2 : -Math.PI / 2;     // into the room
    doors.set(`${x},${z}`, { door, pivot, swing, angle: 0 });
    // Room number plaque on the corridor side.
    const label = areaName(x + 0.5, z < 6 ? z - 0.5 : z + 1.5);
    const num = label.startsWith('Room') ? label.slice(5) : 'W';
    const plaque = signMesh(textPanel([num], { w: 128, h: 72, font: 'bold 48px Impact, sans-serif' }), 0.28, 0.16);
    const side = z < 6 ? 1 : -1;
    plaque.position.set(x + 0.5, 2.45, z + 0.5 + side * 0.505);
    plaque.rotation.y = side > 0 ? 0 : Math.PI;
    root.add(plaque);
  }

  // ---- Gates: collapsible steel grills that fold up when opened
  const gateCells = [...map.doors.values()].filter((d) => d.kind === 'G' || d.kind === 'M');
  const groups = [];
  for (const d of gateCells) {
    const g = groups.find((gr) => gr.kind === d.kind);
    if (g) g.cells.push(d); else groups.push({ kind: d.kind, cells: [d] });
  }
  for (const g of groups) {
    const xs = g.cells.map((c) => c.x), zs = g.cells.map((c) => c.z);
    const alongX = new Set(zs).size === 1;
    const len = alongX ? Math.max(...xs) - Math.min(...xs) + 1 : Math.max(...zs) - Math.min(...zs) + 1;
    const H = 2.4;
    const bars = [];
    for (let i = 0; i <= len * 8; i++) bars.push({ w: 0.025, h: H, d: 0.025, x: i / 8, y: H / 2, z: 0 });
    for (const y of [0.08, 1.2, H - 0.06]) bars.push({ w: len, h: 0.05, d: 0.05, x: len / 2, y, z: 0 });
    // the criss-cross lattice of a collapsible gate
    for (let i = 0; i < len * 4; i++) {
      for (const y of [0.6, 1.8]) bars.push({ w: 0.02, h: 0.02, d: 0.02, x: i / 4 + 0.125, y, z: 0 });
    }
    const panel = new THREE.Mesh(mergeBoxes(bars), toon(C.steel));
    panel.castShadow = true;
    const fold = new THREE.Group();
    fold.add(panel);
    const lock = inkMesh(new THREE.BoxGeometry(0.1, 0.12, 0.05), 0xd8b23a, 0.012);
    lock.position.set(len - 0.08, 1.2, 0.05);
    const lock2 = lock.clone(); lock2.position.z = -0.05;
    const anchor = new THREE.Group();
    anchor.add(fold);
    if (alongX) {
      anchor.position.set(Math.min(...xs), 0, zs[0] + 0.5);
    } else {
      anchor.position.set(xs[0] + 0.5, 0, Math.min(...zs));
      anchor.rotation.y = -Math.PI / 2;
    }
    root.add(anchor);
    root.add(lock, lock2);
    anchor.updateMatrixWorld();
    lock.position.applyMatrix4(anchor.matrixWorld);
    lock2.position.applyMatrix4(anchor.matrixWorld);
    lock.rotation.y = lock2.rotation.y = anchor.rotation.y;
    if (!alongX) {
      // Lintel above the grill gate.
      root.add(inkBox(1, WALL_H - H, len, C.distemper, xs[0] + 0.5, H, Math.min(...zs) + len / 2));
    } else {
      root.add(inkBox(len, WALL_H - H, 1, C.compound, Math.min(...xs) + len / 2, H, zs[0] + 0.5));
    }
    gates.push({ cells: g.cells, fold, locks: [lock, lock2], amount: 0, center: alongX
      ? { x: Math.min(...xs) + len / 2, z: zs[0] + 0.5 } : { x: xs[0] + 0.5, z: Math.min(...zs) + len / 2 } });
  }

  // ---- The loose window grill in the lobby's south wall
  const windows = [];
  for (const d of map.doors.values()) {
    if (d.kind !== 'W') continue;
    const cx = d.x + 0.5, cz = d.z + 0.5;
    root.add(inkBox(1, 0.9, 1, C.paint, cx, 0, cz));                       // sill
    root.add(inkBox(1, WALL_H - 2.1, 1, C.distemper, cx, 2.1, cz));         // lintel
    const bars = [];
    for (let i = 1; i < 8; i++) bars.push({ w: 0.025, h: 1.2, d: 0.025, x: i / 8 - 0.5, y: 1.5, z: 0 });
    bars.push({ w: 1, h: 0.04, d: 0.04, x: 0, y: 1.5, z: 0 });
    const grill = new THREE.Mesh(mergeBoxes(bars), toon(C.steel));
    grill.position.set(cx, 0, cz);
    // one bar already hanging loose
    const loose = inkBox(0.025, 1.2, 0.025, C.steel, cx + 0.31, 0.9, cz + 0.06, 0.006);
    loose.rotation.z = 0.25;
    const rubble = inkBox(0.6, 0.12, 0.4, 0x8a8478, cx, 0, cz + 0.8);
    rubble.visible = false;
    root.add(grill, loose, rubble);
    windows.push({ door: d, grill, loose, rubble });
  }

  // ---- The common room radio, on the cabinet
  const radio = new THREE.Group();
  radio.add(inkBox(0.45, 0.24, 0.16, 0x7a3b22, 0, 0, 0, 0.01));
  const grille = inkBox(0.2, 0.16, 0.01, 0xd9c08a, -0.08, 0.04, 0.085, 0.004);
  const dial = inkMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 10), 0xd9c08a, 0.004);
  dial.rotation.x = Math.PI / 2; dial.position.set(0.13, 0.12, 0.085);
  const antenna = inkBox(0.008, 0.4, 0.008, 0xbbbbbb, 0.18, 0.24, 0, 0.003);
  antenna.rotation.z = -0.4;
  radio.add(grille, dial, antenna);
  radio.position.set(28.6, 1.85, 1.5);
  radio.rotation.y = 0;
  root.add(radio);

  // ---- Fixtures: switched-off tube lights and ceiling fans (Act 2 turns them on)
  const tubes = [];
  const tubeMat = new THREE.MeshToonMaterial({ color: 0xbfc4c8, emissive: 0x000000 });
  const fans = [];
  const addTube = (x, z, rotY = 0) => {
    const t = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.07), tubeMat);
    t.position.set(x, WALL_H - 0.06, z); t.rotation.y = rotY;
    root.add(outlined(t, 0.01)); tubes.push(t);
  };
  for (let x = 3; x < 24; x += 5) addTube(x + 0.5, 7);
  for (let x = 29; x < 41; x += 5) addTube(x, 8.5);
  addTube(30, 2.5);
  for (let i = 0; i < 5; i++) {
    for (const zc of [3, 11]) { const f = fan(i * 5 + 2.5, zc); fans.push(f); root.add(f); }
  }
  // The lights the tubes give off when the power is back (off until then).
  const powerLights = [];
  for (const [x, z] of [[5.5, 7], [13, 7], [20.5, 7], [30, 8.5], [37, 8.5], [32, 11.5], [30, 2.5], [37.5, 2.5]]) {
    const l = new THREE.PointLight(0xeef4ff, 0, 9, 1.4);
    l.position.set(x, WALL_H - 0.3, z);
    root.add(l); powerLights.push(l);
  }

  // ---- The extension board in the common room, and the fuse box
  const boardG = new THREE.Group();
  boardG.add(inkBox(0.6, 0.45, 0.6, C.table, 0, 0, 0));                    // a stool
  boardG.add(inkBox(0.45, 0.06, 0.14, 0xeeeeee, 0, 0.45, 0, 0.008));         // the board
  for (let i = 0; i < 3; i++) boardG.add(inkBox(0.06, 0.012, 0.05, 0x222222, -0.13 + i * 0.13, 0.51, 0, 0.004));
  const boardLed = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ color: 0x331111 }));
  boardLed.position.set(0.2, 0.52, 0.04);
  boardG.add(boardLed);
  const pluggedSlots = [];
  for (let i = 0; i < 3; i++) {
    const plug = inkBox(0.05, 0.05, 0.05, 0x111111, -0.13 + i * 0.13, 0.51, 0, 0.004);
    plug.visible = false; boardG.add(plug); pluggedSlots.push(plug);
  }
  boardG.position.set(33.5, 0, 4.5);
  root.add(boardG);
  const fuseBox = inkBox(0.5, 0.6, 0.15, 0x6d6d64, 36.5, 1.5, 1.08);
  root.add(fuseBox);
  const fuseLabel = signMesh(textPanel([{ text: 'MCB', font: 'bold 70px Impact, sans-serif' }], { w: 128, h: 72, bg: '#e8b923' }), 0.2, 0.11);
  fuseLabel.position.set(36.5, 2.17, 1.16);
  root.add(fuseLabel);

  // ---- Signs
  const notice = signMesh(textPanel([
    { text: 'NOTICE', font: 'bold 64px "Bangers", Impact, sans-serif' },
    { text: 'Lights OFF at 11 PM.', font: 'bold 34px sans-serif' },
    { text: 'NO MAGGI IN ROOMS!!', font: 'bold 38px sans-serif' },
    { text: '— Warden', font: 'italic 30px sans-serif' },
  ]), 1.4, 0.88);
  notice.position.set(34.5, 1.65, 6.01);
  root.add(notice);
  const wingSign = signMesh(textPanel([{ text: 'A-WING', font: 'bold 80px "Bangers", Impact, sans-serif' }], { w: 256, h: 128, bg: '#1d4d3a', fg: '#f4ead0' }), 0.9, 0.45);
  wingSign.position.set(26.02, 2.0, 7); wingSign.rotation.y = Math.PI / 2;
  root.add(wingSign);

  // ---- The canteen, glowing warm beyond the main gate
  const lantern = new THREE.PointLight(0xffa24a, 14, 12, 1.6);
  lantern.position.set(36, 2.3, 18.2);
  root.add(lantern);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd08a }));
  bulb.position.copy(lantern.position);
  root.add(bulb);
  const roof = inkBox(8.4, 0.08, 2.4, C.tin, 36, 2.6, 18.4);
  roof.rotation.x = -0.08;
  root.add(roof);
  for (const px of [32.1, 39.9]) root.add(inkBox(0.1, 2.6, 0.1, C.trunk, px, 0, 19.4));
  const board = signMesh(textPanel([
    { text: 'BHAIYA MAGGI POINT', font: 'bold 60px "Bangers", Impact, sans-serif' },
    { text: 'Open till 3 AM', font: 'bold 34px sans-serif' },
  ], { w: 768, h: 200, bg: '#e8b923', fg: '#2a1a0a' }), 3.6, 0.94);
  board.position.set(36, 3.2, 17.15);
  board.rotation.y = Math.PI;
  root.add(board);

  return {
    root, doors, gates, tubes, lantern, radio,
    power: 0,                  // 0 dark .. 1 lit; set by setPower, eased in update
    target: 0, flicker: 0,
    setPower(on, flicker = false) { this.target = on ? 1 : 0; this.flicker = on && flicker ? 1.6 : 0; },
    setPlugged(n) {
      pluggedSlots.forEach((p, i) => { p.visible = i < n; });
      boardLed.material.color.set(n >= 2 ? 0xff3322 : n === 1 ? 0xffaa22 : 0x331111);
    },
    update(dt) {
      // Tube lights: a stuttering start (tink... tink-tink) then steady.
      let lit = this.target;
      if (this.flicker > 0) {
        this.flicker -= dt;
        lit = Math.sin(this.flicker * 37) > 0.2 || this.flicker < 0.3 ? 1 : 0.05;
      }
      this.power += (lit - this.power) * Math.min(1, dt * (lit < this.power ? 30 : 12));
      tubeMat.emissive.setScalar(this.power * 0.95);
      for (const l of powerLights) l.intensity = this.power * 7;
      for (const f of fans) {
        f.userData.speed += ((this.target ? 9 : 0) - f.userData.speed) * Math.min(1, dt * 0.6);
        f.userData.rotor.rotation.y += f.userData.speed * dt;
      }
      for (const w of windows) {
        const broken = w.door.open;
        w.grill.visible = w.loose.visible = !broken;
        w.rubble.visible = broken;
      }
      for (const d of doors.values()) {
        const target = d.door.open ? d.swing : 0;
        d.angle += (target - d.angle) * Math.min(1, dt * 7);
        d.pivot.rotation.y = d.angle;
      }
      for (const g of gates) {
        const open = g.cells.some((c) => c.open);
        g.amount += ((open ? 1 : 0) - g.amount) * Math.min(1, dt * 5);
        g.fold.scale.x = 1 - g.amount * 0.85;
        for (const l of g.locks) l.visible = g.amount < 0.2;
      }
    },
  };
}

// ---------- props ----------
function bed(x, z, { len, horiz }) {
  const g = new THREE.Group();
  const L = len - 0.05, W = 0.9;
  g.add(inkBox(L, 0.35, W, C.bedFrame, 0, 0, 0));
  g.add(inkBox(L - 0.1, 0.14, W - 0.08, C.mattress, 0, 0.35, 0));
  g.add(inkBox(L * 0.55, 0.05, W - 0.06, C.sheet, L * 0.18, 0.49, 0));
  g.add(inkBox(0.35, 0.12, W * 0.7, C.pillow, -L / 2 + 0.28, 0.49, 0));
  if (horiz) g.position.set(x + len / 2, 0, z + 0.5);
  else { g.position.set(x + 0.5, 0, z + len / 2); g.rotation.y = Math.PI / 2; }
  return g;
}

function table(x, z, { len, horiz }, isDesk) {
  const g = new THREE.Group();
  const L = len - 0.1, D = 0.6, H = 0.75;
  g.add(inkBox(L, 0.05, D, C.table, 0, H - 0.05, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(inkBox(0.05, H - 0.05, 0.05, C.frame, sx * (L / 2 - 0.05), 0, sz * (D / 2 - 0.05), 0.01));
  // books and a steel glass
  const colors = [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60];
  for (let i = 0; i < 3; i++) g.add(inkBox(0.22, 0.04, 0.3, colors[(x + z + i) % 4], -L / 2 + 0.2, H + i * 0.04, 0.02 * i, 0.008));
  const glass = inkMesh(new THREE.CylinderGeometry(0.04, 0.035, 0.12, 10), 0xb8c2c8, 0.008);
  glass.position.set(L / 2 - 0.15, H + 0.06, 0.1);
  g.add(glass);
  if (isDesk) g.add(inkBox(0.3, 0.05, 0.4, 0x7a2a1a, 0, H, 0, 0.008));   // the attendance register
  if (horiz) g.position.set(x + len / 2, 0, z + 0.5);
  else { g.position.set(x + 0.5, 0, z + len / 2); g.rotation.y = Math.PI / 2; }
  return g;
}

function sofa(x, z, { len, horiz }) {
  const g = new THREE.Group();
  const L = len - 0.05;
  g.add(inkBox(L, 0.42, 0.8, C.sofa, 0, 0, 0));
  g.add(inkBox(L, 0.5, 0.18, C.sofa, 0, 0.42, -0.31));
  if (horiz) g.position.set(x + len / 2, 0, z + 0.5);
  else { g.position.set(x + 0.5, 0, z + len / 2); g.rotation.y = Math.PI / 2; }
  return g;
}

function counter(x, z, { len }) {
  const g = new THREE.Group();
  g.add(inkBox(len, 0.95, 0.8, C.counter, 0, 0, 0));
  g.add(inkBox(0.5, 0.15, 0.4, 0x333333, len / 2 - 0.8, 0.95, 0));   // stove
  const pot = inkMesh(new THREE.CylinderGeometry(0.18, 0.15, 0.2, 14), 0xa7b0b5, 0.012);
  pot.position.set(len / 2 - 0.8, 1.2, 0);
  g.add(pot);
  g.position.set(x + len / 2, 0, z + 0.5);
  return g;
}

function almirah() {
  const g = new THREE.Group();
  g.add(inkBox(0.85, 1.85, 0.55, C.almirah, 0, 0, 0));
  g.add(inkBox(0.015, 1.6, 0.01, 0x2a3a38, 0, 0.12, 0.28, 0.004));
  g.add(inkBox(0.04, 0.16, 0.03, 0xc9c9c9, 0.07, 0.95, 0.29, 0.006));
  return g;
}

function tree(x, z) {
  const g = new THREE.Group();
  const trunk = inkMesh(new THREE.CylinderGeometry(0.14, 0.2, 2.2, 8), C.trunk);
  trunk.position.y = 1.1;
  g.add(trunk);
  const leaves = [[0, 2.7, 0, 1.1], [0.6, 2.3, 0.2, 0.75], [-0.5, 2.4, -0.3, 0.8]];
  for (const [lx, ly, lz, r] of leaves) {
    const m = inkMesh(new THREE.IcosahedronGeometry(r, 0), C.leaf, 0.04);
    m.material = new THREE.MeshToonMaterial({ color: C.leaf, emissive: 0x08101c });
    m.position.set(lx, ly, lz);
    g.add(m);
  }
  g.position.set(x, 0, z);
  return g;
}

function fan(x, z) {
  const g = new THREE.Group();
  g.add(inkBox(0.03, 0.35, 0.03, 0x444444, 0, WALL_H - 0.35, 0, 0.006));
  const hub = inkMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12), 0x8b6d4b, 0.01);
  hub.position.y = WALL_H - 0.38;
  g.add(hub);
  const rotor = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const blade = inkBox(0.55, 0.01, 0.1, 0x8b6d4b, 0.33, WALL_H - 0.38, 0, 0.006);
    const arm = new THREE.Group();
    arm.add(blade); arm.rotation.y = (i * Math.PI * 2) / 3;
    rotor.add(arm);
  }
  g.add(rotor);
  g.userData = { rotor, speed: 0 };
  g.position.set(x, 0, z);
  return g;
}
