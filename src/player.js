// You: first-person movement, crouching, running, and the noise it all makes.
import { moveCircle } from '../shared/map.js';

export const RADIUS = 0.25;
const SPEED = { crouch: 1.1, walk: 2.1, run: 3.9 };
const EYE = { stand: 1.6, crouch: 0.95 };
const STEP_EVERY = { walk: 0.55, run: 0.32, crouch: 0.7 };
const STEP_NOISE = { walk: 2.2, run: 7.5, crouch: 0 };   // how far the warden hears it

export function createPlayer(spawn) {
  return {
    x: spawn.x, z: spawn.z,
    yaw: 0, pitch: 0,          // camera yaw: 0 looks toward -z (north)
    crouch: false, running: false, torch: false,
    eye: EYE.stand,
    stepT: 0, bob: 0, moving: false,
  };
}

export function respawn(p, spawn) {
  Object.assign(p, { x: spawn.x, z: spawn.z, yaw: 0, pitch: 0, crouch: false, running: false, torch: false });
}

// Returns noises made this frame: [{ x, z, r, kind }].
export function updatePlayer(p, dt, input, map, sensitivity = 0.0022) {
  const m = input.look();
  p.yaw -= m.x * sensitivity;
  p.pitch = Math.max(-1.3, Math.min(1.3, p.pitch - m.y * sensitivity));

  if (input.tapped('KeyC', 'ControlLeft')) p.crouch = !p.crouch;
  if (input.tapped('KeyF')) p.torch = !p.torch;

  let fx = 0, fz = 0;
  if (input.held('KeyW', 'ArrowUp')) fz -= 1;
  if (input.held('KeyS', 'ArrowDown')) fz += 1;
  if (input.held('KeyA', 'ArrowLeft')) fx -= 1;
  if (input.held('KeyD', 'ArrowRight')) fx += 1;
  const len = Math.hypot(fx, fz);
  p.running = input.held('ShiftLeft', 'ShiftRight') && len > 0 && fz < 0;
  if (p.running) p.crouch = false;
  const gait = p.crouch ? 'crouch' : p.running ? 'run' : 'walk';

  const noises = [];
  p.moving = len > 0;
  if (len > 0) {
    fx /= len; fz /= len;
    const s = Math.sin(p.yaw), c = Math.cos(p.yaw);
    const wx = fx * c + fz * s;
    const wz = -fx * s + fz * c;
    const sp = SPEED[gait] * dt;
    const before = { x: p.x, z: p.z };
    const n = moveCircle(map, p.x, p.z, wx * sp, wz * sp, RADIUS);
    p.x = n.x; p.z = n.z;
    const moved = Math.hypot(p.x - before.x, p.z - before.z);
    p.stepT += dt * Math.min(1, moved / (sp || 1));
    p.bob += dt * (gait === 'run' ? 13 : gait === 'crouch' ? 6 : 9);
    if (p.stepT >= STEP_EVERY[gait]) {
      p.stepT = 0;
      noises.push({ x: p.x, z: p.z, r: STEP_NOISE[gait], kind: gait === 'run' ? 'run' : 'step', gait });
    }
  }
  const eyeTarget = p.crouch ? EYE.crouch : EYE.stand;
  p.eye += (eyeTarget - p.eye) * Math.min(1, dt * 10);
  return noises;
}

// Unit vector the camera is looking along, on the ground plane.
export function forward(p) {
  return { x: -Math.sin(p.yaw), z: -Math.cos(p.yaw) };
}
