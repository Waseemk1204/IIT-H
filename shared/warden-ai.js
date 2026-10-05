// Warden Saab: patrols with a torch, sees what his torch (or yours) lights
// up, comes to look when he hears something, shuts every door he finds open,
// and once he knows you are out of your room he hunts you: faster, sharper.
// Pure logic: the renderer reads his state, and the tests drive it directly.
import { findPath, lineOfSight, doorAt, walkableForWarden } from './map.js';

export const SPEED = { patrol: 1.25, investigate: 1.7, chase: 2.7 };
export const BEAM_HALF_ANGLE = 0.3;   // radians, matches the visible cone
export const BEAM_RANGE = 11;
export const CATCH_DIST = 0.9;
export const LIT_RANGE = 22;          // with the tube lights on he sees down the whole corridor
export const LIT_FOV = 1.4;           // half-angle, radians (~80 degrees each side)
const TURN_RATE = 3.2;                // radians per second
const SUSPICIOUS_AT = 0.25;
const CHASE_AT = 0.6;
const DECAY = 0.18;                   // meter drain per second unseen
const DOOR_SEE = 8;                   // how far away he notices an open door

// Hunting (alert = 1): everything a notch sharper.
export const HUNT = { speed: 1.35, range: 1.3, fov: 1.3, rate: 1.4, hear: 1.3, decay: 0.6, wait: 0.4 };
const k = (w, key) => (w.alert ? HUNT[key] : 1);

// Angle a - b wrapped to [-PI, PI].
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
// yaw 0 faces +z; yaw PI/2 faces +x.
export const yawTo = (dx, dz) => Math.atan2(dx, dz);

export function createWarden(map, start, route) {
  return {
    x: start.x, z: start.z,
    yaw: Math.PI / 2,
    lookOffset: 0,         // torch sweep while standing
    mode: 'patrol',        // patrol | suspicious | investigate | search | chase | errand
    lightsOn: false,       // power back: he sees without his torch
    alert: 0,              // 1 = hunting you (your room was empty)
    errand: null,          // { x, z, wait, tag, door? }
    route, wp: 0,
    path: null, pathI: 0,
    wait: 0, waitLook: null,
    meter: 0,              // 0..1 "spotted" meter; 1 = caught
    target: null,          // where he is heading to look
    lastSeen: null,
    unseenFor: 0,
    searchT: 0,
    doorScanT: 0,
    t: 0,
    moving: false,
    map,
  };
}

// Reset after a catch: back on his route at the nearest stop.
export function resumePatrol(w) {
  let best = 0, bd = Infinity;
  w.route.forEach((p, i) => {
    const d = Math.hypot(p.x - w.x, p.z - w.z);
    if (d < bd) { bd = d; best = i; }
  });
  w.wp = best; w.mode = 'patrol'; w.meter = 0; w.errand = null;
  w.path = null; w.wait = 0; w.target = null; w.lastSeen = null;
}

// Is the player close behind his back (for picking his pocket)?
export function isBehind(w, p, reach = 1.5) {
  const dx = p.x - w.x, dz = p.z - w.z;
  const d = Math.hypot(dx, dz);
  return d < reach && Math.abs(angleDiff(yawTo(dx, dz), w.yaw)) > 2.2;
}

// How fast the player fills the meter this instant (0 = not seen).
export function sightRate(w, p, map) {
  const dx = p.x - w.x, dz = p.z - w.z;
  const dist = Math.hypot(dx, dz);
  const lit = w.lightsOn || p.lit;
  if (dist > (lit ? LIT_RANGE : 15) * k(w, 'range')) return 0;
  const torchYaw = w.yaw + w.lookOffset;
  const off = Math.abs(angleDiff(yawTo(dx, dz), torchYaw));
  const bodyOff = Math.abs(angleDiff(yawTo(dx, dz), w.yaw));
  // In your own room you are where you should be (unless there's Maggi in your hands).
  if (p.inRoom && !p.hasMaggi) return 0;
  // Sitting in a study circle with a book: just another student cramming.
  if (p.hidden && w.mode !== 'chase' && dist > 1.2) return 0;
  if (!lineOfSight(map, w.x, w.z, p.x, p.z, { targetCrouched: p.crouch })) return 0;
  let rate = 0;
  if (lit) {
    // Tube lights on (or you are standing in the stall's lantern light):
    // no shadows to hide in. He sees far, wide and fast.
    const R = LIT_RANGE * k(w, 'range');
    if (bodyOff < LIT_FOV * k(w, 'fov')) rate = 0.35 + 1.4 * Math.max(0, 1 - dist / R) ** 1.3;
    else if (dist < 2.5 && bodyOff < 1.9) rate = 0.9;
    if (p.crouch) rate *= 0.75;
    return rate * k(w, 'rate');
  }
  if (off < BEAM_HALF_ANGLE + 0.04 && dist < BEAM_RANGE * k(w, 'range')) {
    rate = 0.25 + 1.4 * Math.max(0, 1 - dist / (12 * k(w, 'range'))) ** 2;   // caught in his beam
  } else if (p.torch && bodyOff < 1.45 * k(w, 'fov')) {
    rate = 0.2 + 0.8 * Math.max(0, 1 - dist / 16);                            // your torch gives you away
  } else if (dist < 2.2 * k(w, 'range') && bodyOff < 1.1 * k(w, 'fov')) {
    rate = 0.9;                                                               // right under his nose
  }
  if (p.crouch && !p.torch) rate *= 0.6;
  return rate * k(w, 'rate');
}

// The closest cell he can actually stand in (noises come from beds, chairs...).
function nearestWalkable(map, x, z) {
  const cx = Math.floor(x), cz = Math.floor(z);
  if (walkableForWarden(map, cx, cz)) return { x, z };
  for (let r = 1; r <= 3; r++) {
    let best = null, bd = Infinity;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r || !walkableForWarden(map, cx + dx, cz + dz)) continue;
      const d = Math.hypot(cx + dx + 0.5 - x, cz + dz + 0.5 - z);
      if (d < bd) { bd = d; best = { x: cx + dx + 0.5, z: cz + dz + 0.5 }; }
    }
    if (best) return best;
  }
  return null;
}

function setPath(w, tx, tz) {
  const goal = nearestWalkable(w.map, tx, tz);
  if (!goal) { w.path = null; return false; }
  tx = goal.x; tz = goal.z;
  const path = findPath(w.map, w.x, w.z, tx, tz);
  w.path = path; w.pathI = path ? 1 : 0;
  return !!path;
}

// Walk along the current path. Returns true when it has arrived.
function followPath(w, dt, speed, events) {
  if (!w.path || w.pathI >= w.path.length) { w.moving = false; return true; }
  const tgt = w.path[w.pathI];
  const dx = tgt.x - w.x, dz = tgt.z - w.z;
  const d = Math.hypot(dx, dz);
  const step = speed * k(w, 'speed') * dt;
  turnToward(w, yawTo(dx, dz), dt);
  // Open any door that is in the way (and remember to shut it behind him).
  const door = doorAt(w.map, Math.floor(tgt.x), Math.floor(tgt.z));
  if (door && !door.open && d < 1.3) {
    door.open = true;
    door.byWarden = true;
    events.push({ type: 'door', door, by: 'warden' });
  }
  if (d <= step) {
    w.x = tgt.x; w.z = tgt.z; w.pathI++;
  } else {
    w.x += (dx / d) * step; w.z += (dz / d) * step;
  }
  w.moving = true;
  return w.pathI >= w.path.length;
}

function turnToward(w, yaw, dt) {
  const d = angleDiff(yaw, w.yaw);
  const m = TURN_RATE * dt;
  w.yaw += Math.abs(d) <= m ? d : Math.sign(d) * m;
}

// Doors he walked through close behind him. A locked one stays locked.
function closeGatesBehind(w, events) {
  for (const door of w.map.doors.values()) {
    if (!door.byWarden || !door.open) continue;
    const d = Math.hypot(door.x + 0.5 - w.x, door.z + 0.5 - w.z);
    if (d > 3) {                 // a moment to slip through behind him
      door.open = false; door.byWarden = false;
      events.push({ type: 'door', door, by: 'warden', closed: true });
    }
  }
}

// Where to stand to shut a door, on whichever side he is.
function approachFor(w, door) {
  if (door.kind === 'G') return { x: w.x < door.x + 0.5 ? door.x - 0.6 : door.x + 1.6, z: door.z + 0.5 };
  if (door.kind === 'M') return { x: door.x + 0.5, z: w.z < door.z + 0.5 ? door.z - 0.6 : door.z + 1.6 };
  return { x: door.x + 0.5, z: door.z < 6 ? door.z + 1.4 : door.z - 0.4 };   // room doors: corridor side
}

// Every so often: is there a door standing open that shouldn't be?
function scanForOpenDoors(w, player, events) {
  for (const door of w.map.doors.values()) {
    if (!door.open || door.byWarden || door.kind === 'W' || (door.ignoreUntil || 0) > w.t) continue;
    // He notices the open doorway from where he'd stand to shut it.
    const a = approachFor(w, door);
    const dx = a.x - w.x, dz = a.z - w.z;
    const d = Math.hypot(dx, dz);
    if (d > DOOR_SEE * k(w, 'range')) continue;
    if (d > 0.6 && Math.abs(angleDiff(yawTo(dx, dz), w.yaw)) > 1.3 * k(w, 'fov')) continue;
    if (!lineOfSight(w.map, w.x, w.z, a.x, a.z)) continue;
    if (!sendWarden(w, a.x, a.z, 0.6, 'closeDoor')) { door.ignoreUntil = w.t + 15; continue; }
    w.errand.door = door;
    events.push({ type: 'say', line: door.kind === 'D' ? 'Ye darwaza khula kyun hai?!' : 'Gate kisne khola?!', mood: 'alert' });
    return;
  }
}

// Shut it, and lock it if it's a gate whose lock still works.
function shutDoor(w, door, player, events) {
  const group = door.kind === 'D' ? [door] : [...w.map.doors.values()].filter((d) => d.kind === door.kind);
  // Not on top of you: he would just see you instead.
  if (group.some((d) => Math.hypot(player.x - (d.x + 0.5), player.z - (d.z + 0.5)) < 0.9)) return;
  for (const d of group) {
    d.open = false; d.byWarden = false;
    if (d.kind !== 'D' && !d.broken) d.locked = true;
  }
  events.push({ type: 'door', door, by: 'warden', closed: true, shut: true });
}

// Send him somewhere to do something (fix the fuse, check your room).
// Seeing you still interrupts.
export function sendWarden(w, x, z, wait, tag) {
  w.mode = 'errand';
  w.errand = { x, z, wait, tag };
  if (!setPath(w, x, z)) { w.mode = 'patrol'; w.errand = null; return false; }
  return true;
}

// One tick. `player` = { x, z, crouch, torch }, `noises` = [{ x, z, r, line? }].
export function updateWarden(w, dt, player, noises = []) {
  const events = [];
  w.t += dt;
  const rate = sightRate(w, player, w.map);
  const seen = rate > 0;

  if (seen) {
    w.meter = Math.min(1, w.meter + rate * dt);
    w.lastSeen = { x: player.x, z: player.z };
    w.unseenFor = 0;
  } else {
    w.unseenFor += dt;
    w.meter = Math.max(0, w.meter - DECAY * k(w, 'decay') * dt);
  }

  const dist = Math.hypot(player.x - w.x, player.z - w.z);
  if (w.meter >= 1 || (seen && w.mode === 'chase' && dist < CATCH_DIST)) {
    w.meter = 1;
    events.push({ type: 'caught' });
    return events;
  }

  // Noticing things.
  if (seen && w.meter >= CHASE_AT && w.mode !== 'chase') {
    w.mode = 'chase';
    events.push({ type: 'say', line: 'Ruk! Ruk ja wahin!', mood: 'angry' });
  } else if (seen && w.meter >= SUSPICIOUS_AT && (w.mode === 'patrol' || w.mode === 'search' || w.mode === 'investigate' || w.mode === 'errand')) {
    w.mode = 'suspicious'; w.wait = 0;
    events.push({ type: 'say', line: 'Kaun hai wahan?!', mood: 'alert' });
  }

  if (w.mode !== 'chase' && w.mode !== 'suspicious' && w.mode !== 'errand') {
    for (const n of noises) {
      const nd = Math.hypot(n.x - w.x, n.z - w.z);
      const r = n.r * k(w, 'hear');
      const heard = lineOfSight(w.map, w.x, w.z, n.x, n.z) ? r : r * 0.55;
      if (nd < heard) {
        const fresh = w.mode !== 'investigate';
        const moved = !w.target || Math.hypot(w.target.x - n.x, w.target.z - n.z) > 1;
        w.mode = 'investigate';
        if (fresh || moved) {
          w.target = { x: n.x, z: n.z };
          if (!setPath(w, n.x, n.z)) w.mode = 'search';
        }
        w.searchT = 0;
        if (fresh) events.push({ type: 'say', line: n.line || (n.r > 5 ? 'Kya awaaz thi?!' : 'Hmm? Koi hai?'), mood: 'alert' });
        break;
      }
    }
  }

  // Open doors bother him.
  if (w.mode === 'patrol' || w.mode === 'search') {
    w.doorScanT -= dt;
    if (w.doorScanT <= 0) { w.doorScanT = 0.4; scanForOpenDoors(w, player, events); }
  }

  switch (w.mode) {
    case 'patrol': {
      w.lookOffset *= 0.9;
      if (!w.path) {
        const p = w.route[w.wp];
        if (!setPath(w, p.x, p.z)) { w.wp = (w.wp + 1) % w.route.length; break; }
        w.wait = p.wait * k(w, 'wait');
      }
      if (followPath(w, dt, SPEED.patrol, events)) {
        const p = w.route[w.wp];
        turnToward(w, p.look, dt);
        w.lookOffset = Math.sin(w.t * (w.alert ? 2.2 : 1.1)) * 0.55;   // sweeps his torch
        w.wait -= dt;
        if (w.wait <= 0) {
          // Hunting, he stops following the usual round: any stop, any order.
          if (w.alert && w.route.length > 2) {
            let n = w.wp;
            while (n === w.wp) n = Math.floor(Math.random() * w.route.length);
            w.wp = n;
          } else w.wp = (w.wp + 1) % w.route.length;
          w.path = null;
        }
      }
      break;
    }
    case 'suspicious': {
      w.moving = false;
      w.lookOffset *= 0.8;
      if (w.lastSeen) turnToward(w, yawTo(w.lastSeen.x - w.x, w.lastSeen.z - w.z), dt);
      if (!seen && w.unseenFor > 1.2) {
        w.mode = 'investigate';
        w.target = w.lastSeen;
        if (!setPath(w, w.target.x, w.target.z)) w.mode = 'search';
        w.searchT = 0;
      }
      break;
    }
    case 'chase': {
      w.lookOffset *= 0.7;
      if (seen) {
        // Straight at you, re-planning every so often.
        if (!w.path || w.t - (w.replanAt || 0) > 0.4) {
          setPath(w, player.x, player.z); w.replanAt = w.t;
        }
        followPath(w, dt, SPEED.chase, events);
      } else if (w.unseenFor > 0.6) {
        w.mode = 'investigate';
        w.target = w.lastSeen;
        if (!setPath(w, w.target.x, w.target.z)) w.mode = 'search';
        w.searchT = 0;
        events.push({ type: 'say', line: 'Kahan gaya?!', mood: 'alert' });
      } else {
        followPath(w, dt, SPEED.chase, events);
      }
      break;
    }
    case 'investigate': {
      if (followPath(w, dt, SPEED.investigate, events)) { w.mode = 'search'; w.searchT = 0; }
      break;
    }
    case 'errand': {
      const e = w.errand;
      if (followPath(w, dt, SPEED.investigate, events)) {
        if (e.door) turnToward(w, yawTo(e.door.x + 0.5 - w.x, e.door.z + 0.5 - w.z), dt);
        else w.lookOffset = Math.sin(w.t * 3) * 0.3;
        e.wait -= dt;
        if (e.wait <= 0) {
          if (e.tag === 'closeDoor' && e.door) shutDoor(w, e.door, player, events);
          events.push({ type: 'errandDone', tag: e.tag, door: e.door });
          resumePatrol(w);
        }
      }
      break;
    }
    case 'search': {
      w.moving = false;
      w.searchT += dt;
      w.lookOffset = 0;
      w.yaw += dt * 1.4 * k(w, 'speed') * Math.sign(Math.sin(w.searchT * 0.8) + 0.01);
      if (w.searchT > (w.alert ? 3 : 5)) {
        events.push({ type: 'say', line: w.alert ? 'Yahin kahin hai... dhoondta hoon.' : 'Hmph. Chooha hoga.', mood: 'calm' });
        resumePatrol(w);
      }
      break;
    }
  }

  closeGatesBehind(w, events);
  return events;
}
