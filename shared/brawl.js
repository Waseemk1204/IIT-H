// The hostel brawl that breaks out when the lights come back on. Brawlers
// fight each other, turn on you when you come close, telegraph their swings
// (back off to dodge), and go down after a couple of punches. Pure logic.
import { moveCircle, inMyRoom } from './map.js';

// Where they burst out: the lobby first (where you are), then down the wing.
export const BRAWL_SPAWNS = [
  { x: 27.5, z: 8.5 }, { x: 29.5, z: 11.0 }, { x: 33.5, z: 7.5 }, { x: 36.5, z: 9.5 },
  { x: 22.5, z: 7.0 }, { x: 31.5, z: 12.3 }, { x: 17.5, z: 6.5 }, { x: 13.5, z: 7.2 },
  { x: 9.5, z: 6.8 }, { x: 4.5, z: 6.6 },
];
export const PLAYER_HP = 100;
export const CALM_TIME = 10;          // seconds in your room before it all calms down
const REACH = 1.15, HIT_REACH = 1.45, WINDUP = 0.45, AGGRO = 5, RADIUS = 0.28;
const SHOUTS = ['Kisne meri Maggi khaayi?!', 'Tu bhi?!', 'Aaja, aaja!', 'Bijli aate hi shuru?!', 'Mera charger kahan hai?!', 'DHISHOOM!'];

export function createBrawl(diff, rng = Math.random) {
  const brawlers = BRAWL_SPAWNS.slice(0, diff.count).map((s, i) => ({
    id: i, x: s.x, z: s.z, home: { ...s }, hp: diff.hp, ko: false,
    state: 'brawl', t: rng() * 2, cd: 0.5 + rng(), yaw: 0, stun: 0, swing: 0,
    partner: i ^ 1,
  }));
  return {
    active: true, diff, rng, brawlers,
    hp: PLAYER_HP, sinceHit: 9, calm: 0, kos: 0,
    shoutT: 1,
  };
}

// Is a brawler standing between the warden and you? (Hide in the crowd.)
export function crowdCover(b, wx, wz, px, pz) {
  if (!b || !b.active) return 0;
  const lx = px - wx, lz = pz - wz, L = Math.hypot(lx, lz) || 1;
  for (const r of b.brawlers) {
    if (r.ko) continue;
    const t = ((r.x - wx) * lx + (r.z - wz) * lz) / (L * L);
    if (t < 0.05 || t > 0.95) continue;
    const cx = wx + lx * t, cz = wz + lz * t;
    if (Math.hypot(r.x - cx, r.z - cz) < 0.45) return 0.75;
  }
  return 0;
}

// One tick. player = { x, z }. Returns events for sound and comic text.
export function updateBrawl(b, dt, player, map) {
  const ev = [];
  if (!b.active) return ev;
  const safe = inMyRoom(player.x, player.z);
  b.sinceHit += dt;
  if (b.sinceHit > 3) b.hp = Math.min(PLAYER_HP, b.hp + 4 * dt);

  for (const r of b.brawlers) {
    if (r.ko) continue;
    r.t += dt;
    r.swing = Math.max(0, r.swing - dt * 4);
    if (r.stun > 0) { r.stun -= dt; continue; }
    const dx = player.x - r.x, dz = player.z - r.z, d = Math.hypot(dx, dz);
    const onYou = !safe && (d < AGGRO || r.state === 'windup');

    if (r.state === 'windup') {
      r.cd -= dt;
      r.yaw = Math.atan2(dx, dz);
      if (r.cd <= 0) {
        r.swing = 1;
        if (!safe && d < HIT_REACH) {
          b.hp = Math.max(0, b.hp - b.diff.damage);
          b.sinceHit = 0;
          ev.push({ type: 'hit', id: r.id, dmg: b.diff.damage, kx: (dx / (d || 1)) * 0.7, kz: (dz / (d || 1)) * 0.7 });
          if (b.hp <= 0) ev.push({ type: 'playerKO' });
        } else ev.push({ type: 'whiff', id: r.id });
        r.state = 'brawl';
        r.cd = 1.1 + b.rng() * 0.6;
      }
      continue;
    }

    r.cd -= dt;
    if (onYou) {
      r.yaw = Math.atan2(dx, dz);
      if (d < REACH && r.cd <= 0) {
        r.state = 'windup'; r.cd = WINDUP;
        ev.push({ type: 'windup', id: r.id });
        continue;
      }
      if (d > 0.8) step(r, dx / d, dz / d, b.diff.speed * dt, map);
    } else {
      // Scrapping with their partner, close to where they started.
      const p = b.brawlers[r.partner];
      const tx = p && !p.ko ? p.x : r.home.x + Math.sin(r.t) * 1.2;
      const tz = p && !p.ko ? p.z : r.home.z + Math.cos(r.t * 0.7) * 0.8;
      const ex = tx - r.x, ez = tz - r.z, e = Math.hypot(ex, ez);
      r.yaw = Math.atan2(ex, ez);
      if (e > 0.9) step(r, ex / e, ez / e, 1.2 * dt, map);
      else if (r.cd <= 0) { r.swing = 1; r.cd = 0.6 + b.rng() * 0.9; if (b.rng() < 0.3) ev.push({ type: 'flail', id: r.id, x: r.x, z: r.z }); }
    }
  }

  b.shoutT -= dt;
  if (b.shoutT <= 0) {
    b.shoutT = 2.5 + b.rng() * 2.5;
    const up = b.brawlers.filter((r) => !r.ko);
    if (up.length) {
      const r = up[Math.floor(b.rng() * up.length)];
      ev.push({ type: 'shout', id: r.id, x: r.x, z: r.z, line: SHOUTS[Math.floor(b.rng() * SHOUTS.length)] });
    }
  }
  return ev;
}

function step(r, ux, uz, len, map) {
  const n = moveCircle(map, r.x, r.z, ux * len, uz * len, RADIUS);
  if (inMyRoom(n.x, n.z)) return;            // they don't follow you into your room
  r.x = n.x; r.z = n.z;
}

// You swing at whoever is in front of you. heavy = the cricket bat.
export function playerPunch(b, player, heavy = false) {
  if (!b.active) return [];
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  let best = null, bd = Infinity;
  for (const r of b.brawlers) {
    if (r.ko) continue;
    const dx = r.x - player.x, dz = r.z - player.z, d = Math.hypot(dx, dz);
    if (d > 1.6 || (dx * fx + dz * fz) / (d || 1) < 0.55) continue;
    if (d < bd) { bd = d; best = r; }
  }
  if (!best) return [{ type: 'miss' }];
  best.hp -= heavy ? 3 : 1;
  best.stun = 0.6;
  if (best.state === 'windup') { best.state = 'brawl'; best.cd = 1.2; }
  const ux = (best.x - player.x) / (bd || 1), uz = (best.z - player.z) / (bd || 1);
  best.x += ux * 0.4; best.z += uz * 0.4;
  if (best.hp <= 0) {
    best.ko = true;
    b.kos++;
    return [{ type: 'ko', id: best.id, x: best.x, z: best.z }];
  }
  return [{ type: 'punched', id: best.id, x: best.x, z: best.z }];
}

// Stay in your room long enough and it all calms down. Returns true when it does.
export function tickCalm(b, dt, player) {
  if (!b.active) return false;
  if (inMyRoom(player.x, player.z)) b.calm += dt; else b.calm = 0;
  if (b.calm >= CALM_TIME) { b.active = false; return true; }
  return false;
}
