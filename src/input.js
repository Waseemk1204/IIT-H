// Keyboard and mouse, plus on-screen touch controls for phones: a joystick
// on the left, drag-to-look on the right, and buttons that press the same
// keys the keyboard does.
export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();     // keys pressed since the last frame
  let mx = 0, my = 0;
  const axis = { x: 0, y: 0 };   // joystick, -1..1

  const press = (code) => { if (!down.has(code)) pressed.add(code); down.add(code); };
  const release = (code) => down.delete(code);

  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    press(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => release(e.code));
  addEventListener('blur', () => down.clear());
  // Pointer lock when the browser allows it; otherwise drag to look.
  addEventListener('mousemove', (e) => {
    const locked = document.pointerLockElement === canvas;
    if (!locked && !(e.buttons & 1 && e.target === canvas)) return;
    mx += e.movementX; my += e.movementY;
  });

  if (isTouch) setupTouch();

  function setupTouch() {
    document.body.classList.add('touch');
    const stick = document.getElementById('stick'), knob = document.getElementById('knob');
    const lookZone = document.getElementById('look-zone');
    let stickId = null, cx = 0, cy = 0;
    const R = 50;
    stick.addEventListener('pointerdown', (e) => {
      stickId = e.pointerId; stick.setPointerCapture(e.pointerId);
      const r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      moveStick(e);
    });
    const moveStick = (e) => {
      if (e.pointerId !== stickId) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
      axis.x = dx / R; axis.y = dy / R;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const endStick = (e) => {
      if (e.pointerId !== stickId) return;
      stickId = null; axis.x = axis.y = 0;
      knob.style.transform = '';
    };
    stick.addEventListener('pointermove', moveStick);
    stick.addEventListener('pointerup', endStick);
    stick.addEventListener('pointercancel', endStick);

    // Drag anywhere on the right to look around.
    const looks = new Map();
    lookZone.addEventListener('pointerdown', (e) => { looks.set(e.pointerId, { x: e.clientX, y: e.clientY }); lookZone.setPointerCapture(e.pointerId); });
    lookZone.addEventListener('pointermove', (e) => {
      const p = looks.get(e.pointerId);
      if (!p) return;
      mx += (e.clientX - p.x) * 1.6; my += (e.clientY - p.y) * 1.6;
      p.x = e.clientX; p.y = e.clientY;
    });
    const endLook = (e) => looks.delete(e.pointerId);
    lookZone.addEventListener('pointerup', endLook);
    lookZone.addEventListener('pointercancel', endLook);

    // Buttons press keys: data-key="KeyE" etc.
    for (const b of document.querySelectorAll('[data-key]')) {
      const code = b.dataset.key;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('down'); press(code); });
      const up = () => { b.classList.remove('down'); release(code); };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
    }
  }

  return {
    held: (...codes) => codes.some((c) => down.has(c)),
    tapped: (...codes) => codes.some((c) => pressed.has(c)),
    axis: () => axis,
    // Mouse movement since the last call.
    look() { const o = { x: mx, y: my }; mx = my = 0; return o; },
    endFrame() { pressed.clear(); },
    press, release,
    lock() {
      if (isTouch) return;
      try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch { /* drag-to-look still works */ }
    },
    get locked() { return document.pointerLockElement === canvas; },
  };
}
