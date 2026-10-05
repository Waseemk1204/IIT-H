// First-time tutorial, inside Room 106: look, walk, torch, search, pick an
// item, get through your locked door, then a few stealth tips outside.
// Each step finishes itself when you do the thing.
import { MY_DOOR } from '../shared/jugaad.js';

const ROOM_CONTAINERS = ['1,9', '4,9', '1,12', '4,12'];
const has = (jug, id) => jug.inv.includes(id);

export function createTutorial({ isTouch }) {
  const k = (desk, touch) => (isTouch ? touch : desk);
  const STEPS = [
    {
      text: () => k('Pehle dekho: <b>mouse</b> ghumao.', 'Pehle dekho: screen ke <b>right side</b> ungli ghumao.'),
      done: (c, s) => s.look > 1.2,
    },
    {
      text: () => k('Chalo: <b>W A S D</b>.', 'Chalo: <b>left joystick</b>.'),
      done: (c, s) => s.walk > 1.2,
    },
    {
      text: () => k('Bahut andhera hai. <b>F</b> se phone ki torch jalao.', 'Bahut andhera hai. <b>TORCH</b> dabao.')
        + '<small>Dhyaan: torch jali ho toh Warden Saab tumhe door se dekh lete hain.</small>',
      done: (c) => c.player.torch,
    },
    {
      text: () => 'Roommate ne bahar se lock kar diya! Jugaad dhoondo: almirah ke saamne '
        + k('<b>E dabaye rakho</b>.', '<b>USE dabaye rakho</b>.'),
      marker: () => ({ x: 4.5, y: 2.0, z: 12.5 }),
      done: (c) => ROOM_CONTAINERS.some((id) => c.jug.containers.get(id)?.searched) || c.jug.inv.length > 1,
    },
    {
      text: () => 'Mil gaya! Neeche tumhara saaman hai. ' + k('<b>1–6</b> ya <b>scroll</b> se chuno.', 'Slot <b>tap</b> karke chuno.')
        + '<small>Chuni hui cheez batati hai woh kis kaam ki hai, aur kiske saath judti hai.</small>',
      done: (c, s) => s.t > 6 || (c.jug.inv[c.jug.sel] && c.jug.inv[c.jug.sel] !== 'phone' && s.t > 1.5),
    },
    {
      text: (c) => {
        const use = k('<b>E dabaye rakho</b>', '<b>USE dabaye rakho</b>');
        if (has(c.jug, 'hanger') || has(c.jug, 'longhook')) return `Hanger kaam aayega! Darwaze ke saamne ${use}: ventilator se chaabi ghumao.`;
        if (has(c.jug, 'newspaper') && (has(c.jug, 'compass') || has(c.jug, 'bobbypin'))) {
          return `Akhbaar + kuch nukila: darwaze pe ${use}. Akhbaar sarkao, chaabi dhakelo, akhbaar kheencho!`;
        }
        return 'Aur talaashi lo: bistar, table, almirah. Chahiye: <b>hanger</b>, ya <b>akhbaar + compass / bobby pin</b>.';
      },
      marker: (c) => {
        const ready = has(c.jug, 'hanger') || has(c.jug, 'longhook')
          || (has(c.jug, 'newspaper') && (has(c.jug, 'compass') || has(c.jug, 'bobbypin')));
        if (ready) return { x: 2.5, y: 2.5, z: 8.5 };
        const next = ROOM_CONTAINERS.map((id) => c.jug.containers.get(id)).find((ct) => !ct.searched && ct.items.length);
        return next ? { x: next.cells[0][0] + 0.5 + (next.cells.length > 1 ? 0.5 : 0), y: 1.8, z: next.cells[0][1] + 0.5 } : null;
      },
      done: (c) => !c.map.doors.get(MY_DOOR).locked,
      freeze: true,
    },
    {
      text: () => k('Darwaza khul gaya! Ab chupke se: <b>C</b> se jhuko (dheere, kam awaaz). <b>Shift</b> = bhaagna = SHOR.',
        'Darwaza khul gaya! Ab chupke se: <b>CROUCH</b> se jhuko (dheere, kam awaaz). <b>RUN</b> = SHOR.'),
      done: (c, s) => (c.player.crouch && s.t > 1) || s.t > 8,
    },
    {
      text: () => "Warden Saab ki torch ki roshni mein mat aana. Upar ka <b>meter</b> bhare toh chhupo."
        + '<small>Woh beech beech mein Room 106 check karte hain. Kamra khaali mila toh tumhe dhoondhne nikalte hain, aur tez! Khule darwaze band karte hain, gate phir se lock. Pakde gaye toh saara saaman le lete hain.</small>',
      done: (c, s) => s.t > 11,
    },
    {
      text: () => 'Aage kya karna hai, upar <b>KAAM</b> line hamesha batayegi. Maggi ke liye... kuch bhi! 🍜',
      done: (c, s) => s.t > 6,
    },
  ];

  const st = { i: 0, t: 0, look: 0, walk: 0, lastYaw: null, lastX: null, lastZ: null };
  let active = false;

  return {
    get active() { return active; },
    get total() { return STEPS.length; },
    start() { active = true; Object.assign(st, { i: 0, t: 0, look: 0, walk: 0, lastYaw: null, lastX: null }); },
    stop() { active = false; },
    // Does the clock wait? (Only while you are still locked in.)
    get freezeClock() { return active && st.i <= 5; },
    // Returns { text, n, marker, advanced } for the HUD, or null when finished.
    update(dt, c) {
      if (!active) return null;
      const p = c.player;
      if (st.lastYaw !== null) {
        st.look += Math.abs(p.yaw - st.lastYaw) + Math.abs(p.pitch - st.lastPitch);
        st.walk += Math.hypot(p.x - st.lastX, p.z - st.lastZ);
      }
      st.lastYaw = p.yaw; st.lastPitch = p.pitch; st.lastX = p.x; st.lastZ = p.z;
      st.t += dt;
      let advanced = false;
      // Skip steps that are already done (e.g. you found the door trick on your own).
      while (st.i < STEPS.length && STEPS[st.i].done(c, st)) {
        st.i++; st.t = 0; advanced = true;
      }
      if (st.i >= STEPS.length) { active = false; return { finished: true, advanced }; }
      const step = STEPS[st.i];
      return { text: step.text(c), n: st.i + 1, marker: step.marker ? step.marker(c) : null, advanced };
    },
  };
}
