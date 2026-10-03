// Keyboard and mouse. Touch controls come in a later phase.
export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();     // keys pressed since the last frame
  let mx = 0, my = 0;

  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    down.add(e.code);
    pressed.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => down.delete(e.code));
  addEventListener('blur', () => down.clear());
  // Pointer lock when the browser allows it; otherwise drag to look.
  addEventListener('mousemove', (e) => {
    const locked = document.pointerLockElement === canvas;
    if (!locked && !(e.buttons & 1 && e.target === canvas)) return;
    mx += e.movementX; my += e.movementY;
  });

  return {
    held: (...codes) => codes.some((c) => down.has(c)),
    tapped: (...codes) => codes.some((c) => pressed.has(c)),
    // Mouse movement since the last call.
    look() { const o = { x: mx, y: my }; mx = my = 0; return o; },
    endFrame() { pressed.clear(); },
    lock() {
      try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch { /* drag-to-look still works */ }
    },
    get locked() { return document.pointerLockElement === canvas; },
  };
}
