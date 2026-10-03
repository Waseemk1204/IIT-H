// The jugaad rules: items, what they combine into, where they are hidden,
// and every way through each lock. Items have properties, not jobs: a lock
// asks for "something thin" or "something heavy", never for one item.
// Pure logic (no Three.js) so the tests can prove every lock has 2+ ways.
import { doorAt } from './map.js';

export const ITEMS = {
  phone:     { name: 'Phone', icon: '📱', props: ['light', 'alarm'], hint: 'F: torch. Q: alarm laga ke yahin rakh do.' },
  newspaper: { name: 'Akhbaar', icon: '📰', props: ['flat'], hint: 'Patla aur chauda. Darwaze ke neeche sarak jaata hai.' },
  compass:   { name: 'Compass', icon: '📐', props: ['thin'], hint: 'Geometry box ka compass. Nukila.' },
  bobbypin:  { name: 'Bobby pin', icon: '📌', props: ['thin'], hint: "Roommate ka 'lucky' bobby pin." },
  hanger:    { name: 'Wire hanger', icon: '🪝', props: ['hook', 'thin'], hint: 'Seedha karo toh kahin bhi pahunch jaaye.' },
  ruler:     { name: 'Steel scale', icon: '📏', props: ['long'], hint: '30 cm ka steel scale.' },
  lockpick:  { name: 'Jugaad lock pick', icon: '🔧', props: ['pick', 'thin'], hint: 'Taala kholne ke kaam aayega.' },
  longhook:  { name: 'Lambi kundi', icon: '🎣', props: ['hook', 'longhook', 'thin'], hint: 'Door se cheezein utaar lo.' },
  bat:       { name: 'Cricket bat', icon: '🏏', props: ['heavy'], hint: 'Bhaari. Bahut shor karega.' },
  glass:     { name: 'Steel glass', icon: '🥛', props: ['throw'], hint: 'Click / V: phenko. TANNNG!', throwNoise: 10, sfx: 'TANNNG!' },
  ball:      { name: 'Tennis ball', icon: '🎾', props: ['throw'], hint: 'Click / V: phenko.', throwNoise: 6, sfx: 'TUP! TUP!' },
  roomkey:   { name: 'Room 106 ki chaabi', icon: '🔑', props: ['key106'], hint: 'Apne hi kamre ki chaabi.' },
  gatekey:   { name: 'Main gate ki chaabi', icon: '🗝️', props: ['keyMain'], hint: 'Chowkidar ki chaabi. Main gate ka taala.' },
  book:      { name: 'Udhaar ki kitaab', icon: '📖', props: ['book'], hint: 'Study circle mein baith ke ratta maaro. Warden khush.' },
  kettle:    { name: 'Electric kettle', icon: '🫖', props: ['appliance'], hint: 'Bahut current kheenchti hai...' },
  iron:      { name: 'Press (iron)', icon: '👔', props: ['appliance'], hint: 'Kisi ki shirt press karne waala tha.' },
  heater:    { name: 'Room heater', icon: '🔥', props: ['appliance'], hint: "Warden Saab ka 'personal' heater." },
};

export const RECIPES = [
  { a: 'bobbypin', b: 'compass', makes: 'lockpick', line: 'Bobby pin ko compass se moda... ban gaya lock pick!' },
  { a: 'hanger', b: 'ruler', makes: 'longhook', line: 'Hanger + steel scale = lambi kundi!' },
];

// How much each kind of answer is worth on the score card.
export const POINTS = { improvised: 300, sneaky: 250, key: 150, brute: 50 };
export const INV_CAP = 6;

// What is hidden where: container id (its first cell, "x,z") -> items.
// Every lock can be beaten with what is in the wing, in at least two ways.
export const LOOT = {
  '1,9': ['compass', 'glass'],    // Room 106: your table
  '4,9': ['bobbypin'],            // Room 106: roommate's table
  '1,12': ['newspaper'],          // Room 106: under your mattress
  '4,12': ['hanger'],             // Room 106: almirah
  '1,4': ['ruler'],               // Room 101
  '4,1': ['ball'],
  '11,4': ['glass'],              // Room 103
  '14,1': ['hanger'],
  '21,1': ['bat'],                // Room 105: under the bed
  '11,9': ['ruler'],              // Room 108
  '14,9': ['compass'],
  '14,12': ['bobbypin'],
  '21,12': ['bat'],               // Room 110
  '26,12': ['ball'],              // Lobby
  '30,3': ['kettle'],             // Common room: carrom table
  '40,12': ['iron'],              // Lobby almirah
  '38,3': ['heater'],             // Warden's desk
};

const EMPTY_LINES = [
  'Sirf gande moze. Chhee.',
  'Purane question papers... 2019 ke.',
  'Maggi ka khaali packet. Dard.',
  'Kuch nahi. Sirf mayoosi.',
  'Ek adhkhaya samosa. Nahi, thank you.',
  'Charger hai, par bijli hi nahi hai.',
];

// Rooms whose doors are locked from inside, with someone asleep in there.
export const OCCUPIED = ['7,5', '17,5', '7,8', '17,8'];
export const MY_DOOR = '2,8';
export const CHOWKIDAR = { x: 34.5, z: 12.5 };
export const RADIO = { x: 28.5, z: 1.5, cells: ['28,1', '29,1'] };
export const CANTEEN = { x: 36, z: 18.5, r: 2.6 };

// Act 2: where students sit and cram once the power is back. Each circle
// takes up `cells`; you sit at `seat`, facing `yaw` (camera yaw).
export const STUDY_CIRCLES = [
  { id: 'A', cells: [[6, 7], [7, 7]], seat: { x: 8.35, z: 7.5 }, yaw: Math.PI / 2 },
  { id: 'B', cells: [[15, 6], [16, 6]], seat: { x: 17.35, z: 6.5 }, yaw: Math.PI / 2 },
  { id: 'C', cells: [[20, 7], [21, 7]], seat: { x: 19.65, z: 7.5 }, yaw: -Math.PI / 2 },
  { id: 'D', cells: [[29, 8], [30, 8], [29, 9], [30, 9]], seat: { x: 31.35, z: 9 }, yaw: Math.PI / 2 },
  { id: 'E', cells: [[36, 7], [37, 7]], seat: { x: 38.35, z: 7.5 }, yaw: Math.PI / 2 },
];
export const BOARD = { x: 33.5, z: 4.5, cell: '33,4' };
export const FUSE_BOX = { x: 36.5, z: 1.5 };     // in the warden's room
export const POWER_FALLBACK = 60;                 // seconds until someone fixes it anyway

// Find every container: runs of beds, tables and almirahs.
function findContainers(map) {
  const out = new Map();
  const seen = new Set();
  const kinds = { b: 'bed', t: 'table', c: 'almirah' };
  for (let z = 0; z < map.h; z++) {
    for (let x = 0; x < map.w; x++) {
      const ch = map.cells[z][x];
      if (!kinds[ch] || seen.has(`${x},${z}`)) continue;
      const cells = [[x, z]];
      let dx = 1;
      while (map.cells[z][x + dx] === ch) { cells.push([x + dx, z]); dx++; }
      if (cells.length === 1) {
        let dz = 1;
        while (map.cells[z + dz]?.[x] === ch) { cells.push([x, z + dz]); dz++; }
      }
      for (const [cx, cz] of cells) seen.add(`${cx},${cz}`);
      const id = `${x},${z}`;
      if (RADIO.cells.includes(id)) continue;
      out.set(id, { id, kind: kinds[ch], cells, items: [...(LOOT[id] || [])], searched: false });
    }
  }
  return out;
}

export function createJugaad(map) {
  for (const k of OCCUPIED) { const d = map.doors.get(k); d.locked = true; d.occupant = true; }
  const mine = map.doors.get(MY_DOOR);
  mine.locked = true;
  mine.outsideKey = 'inLock';   // inLock -> onPaper -> taken
  mine.paperUnder = false;
  const containers = findContainers(map);
  const byCell = new Map();
  for (const c of containers.values()) for (const [x, z] of c.cells) byCell.set(`${x},${z}`, c);
  return {
    map,
    inv: ['phone'], sel: 0,
    containers, byCell,
    worldItems: [],             // { id, item, x, z }
    nextId: 1,
    chowkidar: { ...CHOWKIDAR, hasKeys: true, wake: 0, awake: false, awakeT: 0, snoreT: 0 },
    radio: { ...RADIO, on: false, t: 0, pulse: 0 },
    alarm: null,                // { itemId, t, ringing, pulse }
    knocks: new Map(),          // door key -> seconds until the shout (or cooldown)
    solved: {},                 // obstacle -> { kind, how }
    distractions: new Set(),
    log: [],                    // score card lines { text, kind, points }
    emptyI: 0,
    act: 1,                     // 1: dark. 2: the power came back.
    power: { on: false, tripped: false, offT: 0 },
    plugged: [],                // appliances in the extension board
    seated: null,               // the study circle you are pretending in
    circleByCell: new Map(),
  };
}

// ---------- inventory ----------
export const has = (st, prop) => st.inv.some((id) => ITEMS[id].props.includes(prop));
export const selected = (st) => st.inv[st.sel] || null;

// The item to use for a property: the selected one if it fits, else the first that does.
export function itemWith(st, prop) {
  const s = selected(st);
  if (s && ITEMS[s].props.includes(prop)) return s;
  return st.inv.find((id) => ITEMS[id].props.includes(prop)) || null;
}

export function addItem(st, id) {
  if (st.inv.length >= INV_CAP) return false;
  st.inv.push(id);
  return true;
}

export function removeItem(st, id) {
  const i = st.inv.indexOf(id);
  if (i < 0) return false;
  st.inv.splice(i, 1);
  if (st.sel >= st.inv.length) st.sel = Math.max(0, st.inv.length - 1);
  return true;
}

// What could the selected item be combined with?
export function recipeFor(st, id = selected(st)) {
  if (!id) return null;
  for (const r of RECIPES) {
    const other = r.a === id ? r.b : r.b === id ? r.a : null;
    if (other) return { ...r, other, ready: st.inv.includes(other) && other !== id };
  }
  return null;
}

export function combine(st) {
  const r = recipeFor(st);
  if (!r || !r.ready) return null;
  removeItem(st, r.a); removeItem(st, r.b);
  st.inv.push(r.makes);
  st.sel = st.inv.length - 1;
  return r;
}

export function dropItem(st, id, x, z) {
  removeItem(st, id);
  const w = { id: st.nextId++, item: id, x, z };
  st.worldItems.push(w);
  return w;
}

function solve(st, obstacle, kind, text) {
  if (st.solved[obstacle]) return;
  st.solved[obstacle] = { kind, how: text };
  st.log.push({ text, kind, points: POINTS[kind] });
}

export function useDistraction(st, name) {
  if (st.distractions.has(name)) return;
  st.distractions.add(name);
  st.log.push({ text: name, kind: 'distraction', points: 25 });
}

// ---------- what can you do here? ----------
// target: { type: 'door'|'container'|'chowkidar'|'radio'|'item', ... }
// ctx: { dist, crouch, inside } -- inside = you are on the room side of your door
// Returns [{ id, label, hold, noise? }]; the first one is what E does.
export function actionsFor(st, target, ctx = {}) {
  const A = [];
  const it = (prop) => itemWith(st, prop);
  const name = (id) => ITEMS[id].name;

  if (target.type === 'container') {
    const c = target.container;
    A.push({ id: 'search', label: c.searched ? 'Phir se dekho' : 'Talaashi lo', hold: c.kind === 'almirah' ? 1.4 : 1.0, noise: c.kind === 'almirah' ? 2.5 : 0 });
  } else if (target.type === 'item') {
    A.push({ id: 'pickup', label: `Utha lo: ${name(target.w.item)}`, hold: 0 });
  } else if (target.type === 'radio') {
    A.push({ id: 'radio', label: st.radio.on ? 'Radio band karo' : 'Radio chalao (shor!)', hold: 0 });
  } else if (target.type === 'circle') {
    if (st.seated) A.push({ id: 'standUp', label: 'Uth jao', hold: 0 });
    else if (!has(st, 'book')) A.push({ id: 'borrowBook', label: 'Ek kitaab udhaar maango', hold: 0 });
    else A.push({ id: 'sit', label: 'Baith ke padhai ka natak karo', hold: 0 });
  } else if (target.type === 'board') {
    if (!st.power.on) return A;
    const ap = itemWith(st, 'appliance');
    if (ap) A.push({ id: 'plug', label: `${name(ap)} plug karo (${st.plugged.length + 1}/3)`, hold: 1, uses: ap });
  } else if (target.type === 'chowkidar') {
    const ch = st.chowkidar;
    if (ch.awake || !ch.hasKeys) return A;
    if (it('longhook') && ctx.dist <= 2.4) A.push({ id: 'hookKeys', label: `Chaabi utaaro (${name(it('longhook'))})`, hold: 2.5, uses: it('longhook') });
    if (ctx.dist <= 1.3) A.push({ id: 'grabKeys', label: 'Chupke se chaabi nikalo', hold: 2.5 });
  } else if (target.type === 'door') {
    const d = target.door;
    if (d.kind === 'D') {
      if (d.outsideKey !== undefined && d.locked && ctx.inside) {
        if (it('key106')) A.push({ id: 'unlock106', label: 'Taala kholo (chaabi)', hold: 0.8, uses: it('key106') });
        if (!d.paperUnder && d.outsideKey === 'inLock' && it('flat')) A.push({ id: 'slidePaper', label: `${name(it('flat'))} darwaze ke neeche sarkao`, hold: 1, uses: it('flat') });
        if (d.paperUnder && d.outsideKey === 'inLock' && it('thin')) A.push({ id: 'pokeKey', label: `Chaabi andar se dhakelo (${name(it('thin'))})`, hold: 2.2, noise: 1.5, uses: it('thin') });
        if (d.paperUnder && d.outsideKey === 'onPaper') A.push({ id: 'pullPaper', label: 'Akhbaar kheencho', hold: 1 });
        if (d.outsideKey === 'inLock' && it('hook')) A.push({ id: 'vent', label: `Ventilator se chaabi ghumao (${name(it('hook'))})`, hold: 3.5, noise: 1.5, uses: it('hook') });
      } else if (d.locked && d.occupant) {
        A.push({ id: 'knock', label: 'Khatkhatao (koi so raha hai)', hold: 0 });
      } else if (!d.locked) {
        A.push({ id: 'toggle', label: d.open ? 'Darwaza band karo' : 'Darwaza kholo', hold: 0 });
      }
    } else if (d.kind === 'G') {
      if (!d.locked) return A;
      if (it('pick')) A.push({ id: 'pickGrill', label: `Taala kholo (${name(it('pick'))})`, hold: 4, noise: 3, uses: it('pick') });
      if (it('heavy')) A.push({ id: 'smashGrill', label: `Taala tod do (${name(it('heavy'))}) — bahut shor!`, hold: 1.2, uses: it('heavy') });
    } else if (d.kind === 'M') {
      if (!d.locked) return A;
      if (it('keyMain')) A.push({ id: 'unlockMain', label: 'Chain ka taala kholo', hold: 2, noise: 4, uses: it('keyMain') });
    } else if (d.kind === 'W') {
      if (!d.locked) return A;
      if (it('heavy')) A.push({ id: 'smashWindow', label: `Dheeli grill tod do (${name(it('heavy'))}) — bahut shor!`, hold: 1.5, uses: it('heavy') });
    }
  }
  return A;
}

// Why can't I? Shown when there is nothing to do at a locked thing.
export function lockedHint(st, target) {
  if (target.type === 'chowkidar') {
    if (st.chowkidar.awake) return 'Chowkidar jaag gaya hai! Door raho.';
    if (!st.chowkidar.hasKeys) return 'Zzz... (chaabi toh tumhare paas hai)';
    return 'Chaabi uski belt pe latak rahi hai. Paas jaao... chupke se.';
  }
  if (target.type === 'board') {
    if (!st.power.on) return 'Extension board. Bijli toh gayi hui hai.';
    return `Extension board (${st.plugged.length}/3). Kettle, press aur heater ek saath lagao... toh?`;
  }
  if (target.type !== 'door') return null;
  const d = target.door;
  if (d.kind === 'D' && d.outsideKey !== undefined && d.locked) {
    if (d.outsideKey === 'inLock') return "Bahar se band! Roommate ne 'tere bhale ke liye' lock kar diya. Chaabi bahar taale mein lagi hai...";
    return 'Chaabi bahar akhbaar pe giri hai.';
  }
  if (d.kind === 'G' && d.locked) return 'Taala laga hai. Lock pick chahiye... ya Warden Saab ke peeche-peeche nikal jao?';
  if (d.kind === 'M' && d.locked) return 'Chain aur taala. Chaabi chowkidar ki belt pe hai.';
  if (d.kind === 'W' && d.locked) return 'Ye grill thodi dheeli hai... kuch bhaari chahiye.';
  return null;
}

// Do it. Returns events for the game to show and hear:
// { type: 'say'|'sfx'|'noise'|'got'|'msg', ... }
export function perform(st, target, action, ctx = {}) {
  const ev = [];
  const map = st.map;
  const msg = (text) => ev.push({ type: 'msg', text });
  const at = target.door ? { x: target.door.x + 0.5, z: target.door.z + 0.5 } : (target.at || null);
  const noise = (r, sfx, size = 1) => {
    if (at) ev.push({ type: 'noise', x: at.x, z: at.z, r });
    if (sfx && at) ev.push({ type: 'sfx', text: sfx, x: at.x, z: at.z, size });
  };
  const openGroup = (kind) => {
    for (const d of map.doors.values()) if (d.kind === kind) { d.locked = false; d.open = true; d.byWarden = false; }
  };

  switch (action.id) {
    case 'search': {
      const c = target.container;
      c.searched = true;
      if (!c.items.length) { msg(EMPTY_LINES[st.emptyI++ % EMPTY_LINES.length]); break; }
      const got = [];
      while (c.items.length && st.inv.length < INV_CAP) { const id = c.items.shift(); st.inv.push(id); got.push(id); }
      if (got.length) ev.push({ type: 'got', items: got });
      if (c.items.length) msg('Jeb bhar gayi! Kuch girao (Q) phir aao.');
      break;
    }
    case 'pickup': {
      if (!addItem(st, target.w.item)) { msg('Jeb bhar gayi! Kuch girao (Q).'); break; }
      st.worldItems = st.worldItems.filter((w) => w !== target.w);
      if (st.alarm && st.alarm.itemId === target.w.id) st.alarm = null;
      ev.push({ type: 'got', items: [target.w.item] });
      break;
    }
    case 'radio': {
      st.radio.on = !st.radio.on; st.radio.t = 0; st.radio.pulse = 0;
      if (st.radio.on) useDistraction(st, 'Common room ka radio chala diya');
      break;
    }
    case 'toggle': {
      const d = target.door;
      d.open = !d.open;
      noise(d.open ? 3 : 4.5, d.open ? 'CHURRR...' : 'DHAP!', 0.8);
      break;
    }
    case 'knock': {
      const k = `${target.door.x},${target.door.z}`;
      if (st.knocks.has(k)) { msg('Abhi abhi toh khatkhataya tha...'); break; }
      st.knocks.set(k, 1.4);
      noise(3, 'KHAT KHAT KHAT', 0.9);
      break;
    }
    case 'slidePaper': {
      removeItem(st, 'newspaper');
      target.door.paperUnder = true;
      msg('Akhbaar darwaze ke neeche, bahar ki taraf sarka diya.');
      break;
    }
    case 'pokeKey': {
      target.door.outsideKey = 'onPaper';
      noise(1.5, 'TINK!', 0.7);
      msg('Chaabi taale se nikal ke akhbaar pe giri!');
      break;
    }
    case 'pullPaper': {
      const d = target.door;
      d.paperUnder = false; d.outsideKey = 'taken';
      st.inv.push('newspaper');
      if (st.inv.length < INV_CAP) st.inv.push('roomkey'); else dropItem(st, 'roomkey', at.x, at.z + 0.6);
      ev.push({ type: 'got', items: ['roomkey'] });
      msg('Akhbaar ke saath chaabi bhi andar aa gayi. JUGAAD!');
      break;
    }
    case 'unlock106': {
      const d = target.door;
      d.locked = false;
      removeItem(st, 'roomkey');
      solve(st, 'room', 'improvised', 'Akhbaar ke neeche se chaabi kheench li');
      noise(2, 'KLIK!', 0.8);
      break;
    }
    case 'vent': {
      const d = target.door;
      d.locked = false; d.outsideKey = 'taken';
      solve(st, 'room', 'improvised', 'Ventilator se hanger daal ke taala khola');
      noise(2, 'KLIK!', 0.8);
      msg('Hanger ventilator se bahar... chaabi ghumi... KHUL GAYA!');
      break;
    }
    case 'pickGrill': {
      openGroup('G');
      solve(st, 'grill', 'improvised', 'Bobby pin aur compass ka lock pick');
      noise(3, 'KLIK!', 0.9);
      break;
    }
    case 'smashGrill': {
      openGroup('G');
      solve(st, 'grill', 'brute', 'Grill gate ka taala bat se tod diya');
      noise(18, 'DHADAAM!!', 1.4);
      break;
    }
    case 'smashWindow': {
      const d = target.door;
      d.locked = false; d.open = true;
      solve(st, 'main', 'brute', 'Lobby ki dheeli grill bat se tod di');
      noise(20, 'CRAAASH!!', 1.5);
      break;
    }
    case 'hookKeys':
    case 'grabKeys': {
      const ch = st.chowkidar;
      ch.hasKeys = false;
      st.gateKeyHow = action.id === 'hookKeys' ? 'improvised' : 'sneaky';
      if (!addItem(st, 'gatekey')) dropItem(st, 'gatekey', ch.x - 0.8, ch.z - 0.4);
      ev.push({ type: 'got', items: ['gatekey'] });
      msg(action.id === 'hookKeys' ? 'Lambi kundi se chaabi utaar li. Chowkidar ko pata bhi nahi chala!' : 'Chaabi nikal li! Saans mat lena...');
      break;
    }
    case 'borrowBook': {
      st.inv.length < INV_CAP ? st.inv.push('book') : dropItem(st, 'book', at.x, at.z);
      st.sel = st.inv.indexOf('book');
      ev.push({ type: 'got', items: ['book'] });
      ev.push({ type: 'say', who: 'student', x: at.x, z: at.z, line: ['Le, par wapas dena!', 'Chapter 4 padh, wahi aayega.', 'Bhai notes bhi chahiye? 50 rupay.'][st.emptyI++ % 3] });
      break;
    }
    case 'sit': {
      st.seated = target.circle;
      msg('Baith gaye. Ab ratta maaro... aur Warden Saab ki taraf mat dekho.');
      break;
    }
    case 'standUp': {
      st.seated = null;
      break;
    }
    case 'plug': {
      const ap = itemWith(st, 'appliance');
      removeItem(st, ap);
      st.plugged.push(ap);
      if (st.plugged.length < 3) { noise(1, 'KLIK', 0.7); msg(`${ITEMS[ap].name} lag gaya. Board garam ho raha hai...`); break; }
      tripFuse(st, ev);
      solve(st, 'fuse', 'improvised', 'Kettle + press + heater = fuse ud gaya');
      break;
    }
    case 'unlockMain': {
      openGroup('M');
      removeItem(st, 'gatekey');
      solve(st, 'main', st.gateKeyHow || 'key',
        st.gateKeyHow === 'improvised' ? 'Lambi kundi se chowkidar ki chaabi' : 'Sote chowkidar ki belt se chaabi');
      noise(4, 'KHATAK!', 1);
      break;
    }
  }
  return ev;
}

// ---------- Act 2: the power comes back ----------
export function startAct2(st) {
  if (st.act === 2) return [];
  st.act = 2;
  st.power.on = true;
  for (const c of STUDY_CIRCLES) {
    for (const [x, z] of c.cells) {
      st.map.extraSolid.add(`${x},${z}`);
      st.circleByCell.set(`${x},${z}`, c);
    }
  }
  return [{ type: 'power', on: true, first: true }];
}

function tripFuse(st, ev) {
  st.power.on = false; st.power.tripped = true; st.power.offT = 0;
  st.seated = null;
  ev.push({ type: 'noise', x: BOARD.x, z: BOARD.z, r: 16 });
  ev.push({ type: 'sfx', text: 'PHATAAK!!', x: BOARD.x, z: BOARD.z, size: 1.6 });
  ev.push({ type: 'power', on: false });
}

// Someone fixed the fuse: lights back on, the appliances fall out of the board.
export function restorePower(st) {
  if (st.power.on) return [];
  st.power.on = true; st.power.tripped = false;
  st.plugged.forEach((id, i) => dropItem(st, id, BOARD.x - 0.4 - i * 0.35, BOARD.z - 0.6));
  st.plugged = [];
  return [{ type: 'power', on: true }];
}

// Slipped through the grill gate while Warden Saab had it open.
export function tailgated(st) {
  solve(st, 'grill', 'sneaky', 'Warden Saab ke peeche-peeche grill se nikal gaye');
}

// Called while you hold E on a hold action: some jobs make noise as you go.
export function holdNoise(action) { return action.noise || 0; }

// ---------- the world ticking along ----------
// Returns events (noises, speech, sfx). `warden` is read and may confiscate.
export function updateJugaad(st, dt, { player, warden }) {
  const ev = [];
  // Knocked doors: a sleepy shout, then a cooldown.
  for (const [k, t] of st.knocks) {
    const nt = t - dt;
    if (t > 0 && nt <= 0) {
      const d = st.map.doors.get(k);
      const p = { x: d.x + 0.5, z: d.z + (d.z < 6 ? 1.2 : -0.2) };
      ev.push({ type: 'say', who: 'room', x: p.x, z: p.z, line: ['KAUN HAI BE?! SONE DO!', 'Abey 3 baje kaun khatkhata raha hai?!', 'Bhai paper hai kal! JAAO!'][Math.floor(Math.random() * 3)] });
      ev.push({ type: 'noise', x: p.x, z: p.z, r: 12 });
      useDistraction(st, 'Soye hue ladke ka darwaza khatkhataya');
    }
    if (nt < -25) st.knocks.delete(k); else st.knocks.set(k, nt);
  }

  // The radio: loud until someone switches it off.
  const r = st.radio;
  if (r.on) {
    r.t += dt; r.pulse -= dt;
    if (r.pulse <= 0) {
      r.pulse = 1.2;
      ev.push({ type: 'noise', x: r.x, z: r.z, r: 13 });
      ev.push({ type: 'sfx', text: ['♪ Vividh Bharati ♪', '♫ Pyaar hua... ♫', '♪ Kishore Da ♪'][Math.floor(r.t) % 3], x: r.x, z: r.z, size: 0.8 });
    }
    if (warden && Math.hypot(warden.x - r.x, warden.z - r.z) < 1.8) {
      r.on = false;
      ev.push({ type: 'say', who: 'warden', line: 'Ye radio kisne chalaya?! Bijli nahi hai toh gaane sunoge?!' });
    }
    if (r.t > 25) r.on = false;
  }

  // Your phone alarm, if you left it somewhere.
  const a = st.alarm;
  if (a) {
    const w = st.worldItems.find((x) => x.id === a.itemId);
    if (!w) st.alarm = null;
    else {
      a.t -= dt;
      if (a.t <= 0) {
        if (!a.ringing) { a.ringing = true; useDistraction(st, 'Phone pe alarm laga ke chhod diya'); }
        a.pulse -= dt;
        if (a.pulse <= 0) {
          a.pulse = 1;
          ev.push({ type: 'noise', x: w.x, z: w.z, r: 12 });
          ev.push({ type: 'sfx', text: 'TRRRING! TRRRING!', x: w.x, z: w.z, size: 1 });
        }
        if (a.t < -15) st.alarm = null;
        // He finds it: confiscated.
        if (warden && Math.hypot(warden.x - w.x, warden.z - w.z) < 1.2) {
          st.alarm = null;
          confiscateWorldItem(st, w);
          ev.push({ type: 'say', who: 'warden', line: 'Kiska phone hai ye?! CONFISCATED!' });
        }
      }
    }
  }

  // Nobody fixed the fuse? The generator wallah gets to it eventually.
  if (st.power.tripped) {
    st.power.offT += dt;
    if (st.power.offT > POWER_FALLBACK) {
      ev.push(...restorePower(st));
      ev.push({ type: 'msg', text: 'Generator chalu! Bijli wapas aa gayi.' });
    }
  }

  // Cramming right under his nose.
  if (st.seated && warden && !st.solved.hide && Math.hypot(warden.x - player.x, warden.z - player.z) < 4.5 && warden.mode === 'patrol') {
    solve(st, 'hide', 'sneaky', 'Group study mein ghus ke Warden Saab ke saamne ratta maara');
    ev.push({ type: 'say', who: 'warden', line: 'Shabash! Aise hi padhai karo sab.' });
  }

  // The chowkidar: asleep, but not deaf.
  const ch = st.chowkidar;
  if (ch.awake) {
    ch.awakeT -= dt;
    if (ch.awakeT <= 0) { ch.awake = false; ch.wake = 0.3; ev.push({ type: 'say', who: 'chowkidar', line: 'Hmm... koi nahi... zzz' }); }
  } else {
    const d = Math.hypot(player.x - ch.x, player.z - ch.z);
    if (d < 1.6 && !player.crouch) ch.wake += dt * 0.5;
    if (ch.wake >= 1) {
      ch.awake = true; ch.awakeT = 9;
      ev.push({ type: 'say', who: 'chowkidar', line: 'CHOR! CHOR! WARDEN SAAB!!' });
      ev.push({ type: 'noise', x: ch.x, z: ch.z, r: 30 });
    } else {
      ch.wake = Math.max(0, ch.wake - dt * 0.04);
      ch.snoreT -= dt;
      if (ch.snoreT <= 0) { ch.snoreT = 2.2; ev.push({ type: 'sfx', text: 'Zzz...', x: ch.x, z: ch.z, size: 0.6, quiet: true }); }
    }
  }
  return ev;
}

// Noises reach the sleeping chowkidar too.
export function chowkidarHears(st, noises) {
  const ch = st.chowkidar;
  if (ch.awake) return;
  for (const n of noises) {
    const d = Math.hypot(n.x - ch.x, n.z - ch.z);
    if (d < n.r) ch.wake += n.r >= 15 ? 1 : 0.35 * (1 - d / n.r) + 0.1;
  }
}

// Grabbing the keys right under his nose keeps waking him a little.
export function grabTick(st, dt, crouch) {
  st.chowkidar.wake += dt * (crouch ? 0.22 : 0.8);
}

// Things he takes go into his almirah, where you can steal them back.
export const WARDEN_ALMIRAH = '35,1';
export function confiscateWorldItem(st, w) {
  st.worldItems = st.worldItems.filter((x) => x !== w);
  st.containers.get(WARDEN_ALMIRAH).items.push(w.item);
}
export function confiscateHeld(st) {
  const id = selected(st);
  if (!id) return null;
  removeItem(st, id);
  st.containers.get(WARDEN_ALMIRAH).items.push(id);
  return id;
}

export function setAlarm(st, x, z) {
  if (!st.inv.includes('phone')) return null;
  const w = dropItem(st, 'phone', x, z);
  st.alarm = { itemId: w.id, t: 8, ringing: false, pulse: 0 };
  return w;
}

// The score card.
export function score(st, caught) {
  const lines = [...st.log];
  if (caught) lines.push({ text: `Pakde gaye x${caught}`, kind: 'caught', points: -50 * caught });
  const total = lines.reduce((s, l) => s + l.points, 0);
  const title = total >= 950 ? 'JUGAAD KA BAAP' : total >= 750 ? 'Maggi Mastermind' : total >= 500 ? 'Hostel Ninja' : total >= 250 ? 'Senior-in-training' : 'Fresher';
  return { lines, total, title };
}

export function doorKeyOf(door) { return `${door.x},${door.z}`; }
export { doorAt };
