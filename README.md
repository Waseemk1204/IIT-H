# Maggie ke liye kuch bhi!

A comic jugaad stealth game for the IIT-H Game Jam (themes: **Comic · Twist · Light**).

It is 1:30 AM before the Endsem, the hostel has a power cut, and the night canteen still has Maggi.
Sneak past the warden's torch and through the locked gate with whatever a hostel has lying around.
Halfway through, the power comes back.

- **Play it: https://waseemk1204.github.io/IIT-H/** (desktop browser, or a phone held sideways)
- Proposal: [proposal.pdf](proposal.pdf) (source: [docs/proposal.html](docs/proposal.html))
- Solo developer: Mohammad Waseem Khan · [IndieConnect @waseemk1204](https://www.indieconnect.in/@waseemk1204)

All game code is written from scratch during the jam. The only third-party code is
[Three.js](https://threejs.org) (MIT), kept in `assets/vendor/`.

## Play it locally

```bash
npm start
```

Then open http://localhost:5180. There is nothing to install and no build step. It is a
plain static site, so any static host (GitHub Pages, Vercel, Netlify) can serve the repo
root as it is.

```bash
npm test
```

runs the tests for the map, collision, line of sight and the warden's AI.

```bash
npm run build
```

packs just the playable files into `dist/maggie-ke-liye-kuch-bhi-web.zip` for itch.io /
IndieConnect (index.html at the root). The store-page text, upload settings, cover and
screenshots are in [`itch/`](itch/STORE-PAGE.md).

**First time?** A short tutorial runs inside Room 106: look, walk, torch, search, pick an
item, and get through your locked door (a yellow arrow points at what to use, and the clock
waits until you are out). Then a few stealth tips. Press T (or Skip) to skip it; the pause
menu can replay it.

**On a phone:** landscape only. Held upright, the page shows nothing but a "turn your phone"
card (pure CSS, so it works before the game loads) and the game pauses and stops drawing.
Phones get a lighter build: static furniture and walls are baked into a few big meshes
(hundreds of draw calls down to about 150), half the lights, smaller shadows, no
antialiasing, and a resolution that drops by itself if frames get slow. The buttons only
show when they do something (THROW with a throwable, JODO when two things combine), USE
glows when there is something to use and fills up while you hold it, and big moments buzz
(Android). Left thumb on the
joystick, drag on the right half to look, and buttons for USE (hold it for longer jobs),
RUN, CROUCH, TORCH, THROW, JODO (combine) and DROP; tap an inventory slot to pick it.
Starting the game goes full screen where the browser allows it.

**Controls:** WASD move · mouse look (click to lock; drag also works) · Shift run (loud) ·
C crouch · F phone torch · E use (hold E for longer jobs) · 1–6 or mouse wheel pick an item ·
G combine · Q drop (the phone: set an alarm and leave it) · click or V throw · P pause · M mute.

**Difficulty** (pick on the title screen, remembered): 🙂 Aasaan (gentler warden, 7 chances,
only the item in your hand is confiscated, 15 minutes, score ×0.75) · 😐 Theek-thaak (5
chances, only the item in your hand is confiscated, 12 minutes) · 😈 Warden Mode (sharper
and faster warden, frequent room checks, 3 chances, every tool confiscated, 10 minutes,
score ×1.5). Best scores are
kept per difficulty.

## Status

**Phase 1 (done):** the hostel block (A-wing rooms, corridor, grill gate, lobby, common
room, warden's room, compound and the Maggi stall), first-person movement with collision,
crouch and run, the power-cut darkness, your phone torch, and Warden Saab: patrol route,
torch-beam sight cone, hearing, investigating noises, chasing, and catching you.

**Phase 2 (done):** jugaad. Search beds, tables and almirahs; carry six things; combine
them (bobby pin + compass = lock pick, hanger + steel scale = lambi kundi). Three locks, each
with at least two ways through (the tests check every one):

| Lock | Ways through |
|---|---|
| Your room (roommate locked it from outside) | newspaper under the door + poke the key out + pull it in · hanger through the ventilator |
| Wing grill gate | jugaad lock pick · Warden Saab's own key bunch · slip through behind him · smash it with a cricket bat (very loud) |
| Main gate | the sleeping chowkidar's keys (hook them off with the lambi kundi, or grab them crouching) · the spare key in Warden Saab's desk · his own key bunch (pick his pocket from behind, crouched) · slip out behind him · break the loose lobby window with a bat |

Distractions: throw a steel glass or tennis ball, leave your phone with an alarm (he
confiscates it if he finds it), switch on the common-room radio, or knock on a sleeping
student's door. The sleeping chowkidar wakes to loud noise and shouts for the warden. Get
caught and you're marched back to your room, and he takes whatever you were holding into
his almirah (you can steal it back). On Warden Mode he takes every tool; with nothing left,
the only way through a gate is behind his back when he opens it.

**Warden Saab doesn't make it easy:**
- He shuts every door he finds open, and locks the grill and the main gate again (a lock you
  smashed can't be relocked). Keys you use, you keep.
- Every minute or so he checks on Room 106. A toast warns you he's on his way. In bed: all
  good. Room empty: he **hunts** you, about 35% faster, seeing further and wider, spotting
  you quicker, wandering in no fixed order and checking more often, until a check finds you
  back in bed (or he catches you).
- With the tube lights on he sees about 22 m down a corridor, about 80 degrees either side,
  and fills the meter in about a second at 10 m.
- In your own room you're where you should be: he leaves you alone.
You get **five chances**: the HUD shows five bowls of Maggi, and each catch takes one. The
fifth time, Warden Saab rings your parents ("KYAAA?! Exam se pehle?!") and the night ends
in detention, writing "Lights off = SONA" until 6 AM while he eats your Maggi.

**At the stall:** order (before 3 AM). Maggi takes one real minute, and while it cooks
Warden Saab does his rounds out in the compound and stops at the stall for chai, and the
stall's lantern lights up anyone waiting at the counter: hide in the dark. Bhaiya shouts
when it's ready. Claim it and slip behind the stall to eat... and watch who walks up to order
a plate for himself (the final twist, told from your hiding spot). Then the score card: improvised answers beat sneaky ones, which beat keys, which beat brute force.

**Phase 3 (done):** the twist. Get through the grill gate and the power comes back: tube
lights stutter on, fans spin up, the whole block cheers, and students pour into the corridor
and lobby to cram in study circles. Darkness no longer hides you; Warden Saab puts his torch
away and sees anything in front of him. Two answers:

- **Hide in plain sight:** borrow a book from a study circle and sit down to cram. He walks
  right past ("Shabash! Aise hi padhai karo sab.").
- **Bring the darkness back:** plug the kettle (common room), the press (lobby almirah) and
  his own heater (his desk) into the common-room extension board. PHATAAK! The fuse blows,
  the block groans, and he goes to his room to fix the MCB, which gives you a window of dark.

Comic-page cutscenes open and close the game, drawn by the engine itself. The ending has one
last twist at the Maggi stall. Audio: mains hum and fans when the power is on, a murmuring
crowd, the fuse blowing, and a dhol-and-tabla loop that gets busier when he is suspicious
and frantic when he is chasing you.

**Phase 4 (done):** touch controls and a landscape-only phone layout; a KAAM line under the
clock that always says what to do next; the 3 AM deadline (order before the stall closes:
12 real minutes, with a warning at 2:45, for a 10-15 minute game); a time bonus and a saved best score on the score card;
a pause menu with sensitivity, controls and restart; an icon and web manifest.

## How it is built

| Path | What it does |
|---|---|
| `shared/map.js` | The hostel grid, collision, line of sight, A* path finding (no Three.js; tested in Node) |
| `shared/warden-ai.js` | Warden Saab's patrol, sight, hearing and chase (pure logic; tested in Node) |
| `shared/jugaad.js` | Items, recipes, loot, every way through each lock, distractions, chowkidar, score (pure logic; tested) |
| `src/interact.js` | What you are looking at, and where a thrown thing lands |
| `src/render/chowkidar.js` | The sleeping chowkidar |
| `src/render/props.js` | A 3D model of every item, and how each one sits in your hand |
| `src/render/viewmodel.js` | First-person hands, drawn on top of the world, with an animation for every way of using things |
| `src/render/items.js` | Dropped and thrown items lying in the world |
| `src/render/bhaiya.js` | Bhaiya of Bhaiya Maggi Point, stirring his pot and calling out |
| `src/render/merge.js` | Bakes everything that never moves into one mesh per material (fewer draw calls) |
| `src/render/students.js` | Act 2's students cramming in study circles |
| `src/cutscenes.js` | Comic-page cutscenes built from engine-rendered panels |
| `src/input.js` | Keyboard, mouse, and the phone joystick, look-drag and buttons |
| `src/tutorial.js` | The first-room tutorial: steps that finish when you do the thing |
| `tools/build-web.mjs` | Packs the game into the itch.io zip |
| `shared/difficulty.js` | The three difficulty levels and everything they scale |
| `src/main.js` | Renderer, the game loop, and the glue between player, warden and HUD |
| `src/player.js` | First-person movement, crouch, run, footstep noise |
| `src/render/world.js` | Builds the hostel in 3D from the grid |
| `src/render/warden.js` | The warden's model, torch light and visible beam |
| `src/render/toon.js` | Toon shading and ink outlines |
| `src/hud.js` | Spotted meter, prompts, comic speech and sound-effect bubbles |
| `src/audio.js` | All sounds, synthesised in the browser (no audio files) |
| `test/` | `node --test` suites |

## AI use log

| Date | Tool | What it was used for |
|---|---|---|
| 2 Oct 2026 | Claude (Anthropic) | Brainstorming the concept, drafting and laying out the proposal |
| 3 Oct 2026 | Claude Code (Anthropic) | Phase 1 code: map and collision, line of sight and path finding, warden AI, 3D hostel and warden models, toon rendering, HUD, synthesised audio, tests. |
| 3 Oct 2026 | Claude Code (Anthropic) | Phase 2 code: jugaad rules (items, recipes, locks, distractions, chowkidar, score), inventory and interaction, chowkidar model, item stickers, window and radio, score card, tests. |
| 3 Oct 2026 | Claude Code (Anthropic) | Phase 3 code: Act 2 power-flip (lights, fans, students, warden sight with lights on), study-circle hiding, extension-board fuse trip and the warden's repair errand, opening and ending comic cutscenes rendered in-engine, power/crowd/fuse sounds and dhol tension music, tests. |
| 3 Oct 2026 | Claude Code (Anthropic) | Phase 4 code: touch controls and phone layout, objective line, deadline and time bonus, best score, pause settings, icon and manifest. |
| 3 Oct 2026 | Claude Code (Anthropic) | 3D item models, first-person hands with use animations (rummage, pick, swing, throw, combine, twist...), Bhaiya the Maggi wala NPC with steam and call-outs. |
| 3 Oct 2026 | Claude Code (Anthropic) | Comic pages that fit the screen, full screen buttons, phone optimisation (static mesh merging, lite lighting, adaptive resolution, contextual touch buttons, haptics), portrait blocked. |
| 3 Oct 2026 | Claude Code (Anthropic) | Five chances with a HUD counter and last-chance warning; the parents-call and detention comic ending. |
| 3 Oct 2026 | Claude Code (Anthropic) | New win: order at the stall, hide while the warden patrols outside, carry the Maggi back (smell, no running), eat it in Room 106; new ending comic. |
| 3 Oct 2026 | Claude Code (Anthropic) | First-room tutorial with step cards, a 3D pointer arrow, clock freeze, skip and replay. |
| 5 Oct 2026 | Claude Code (Anthropic) | Difficulty pass: sharper lights-on sight, Room 106 checks and hunt mode, the warden shuts and relocks doors and gates, master key and desk key, confiscate-all on catch, 12-minute clock, tests. |
| 5 Oct 2026 | Claude Code (Anthropic) | Difficulty selector. (A lights-on brawl and a carry-it-home ending were tried and removed to stay within the proposal's premise.) |
| 6 Oct 2026 | Claude Code (Anthropic) | Final review fixes (phone never confiscated as a held item, proposal's 'Curfew Ka Baap' title, dead code), web build script, store-page text, cover and screenshots rendered from the game. |
