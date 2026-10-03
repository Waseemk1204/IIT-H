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

**On a phone:** play in landscape (a card asks you to turn the phone). Left thumb on the
joystick, drag on the right half to look, and buttons for USE (hold it for longer jobs),
RUN, CROUCH, TORCH, THROW, JODO (combine) and DROP; tap an inventory slot to pick it.
Starting the game goes full screen where the browser allows it.

**Controls:** WASD move · mouse look (click to lock; drag also works) · Shift run (loud) ·
C crouch · F phone torch · E use (hold E for longer jobs) · 1–6 or mouse wheel pick an item ·
G combine · Q drop (the phone: set an alarm and leave it) · click or V throw · P pause · M mute.

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
| Wing grill gate | jugaad lock pick · slip through behind Warden Saab · smash it with a cricket bat (very loud) |
| Main gate (chowkidar asleep with the keys) | hook the keys off with the lambi kundi · grab them crouching · break the loose lobby window with a bat |

Distractions: throw a steel glass or tennis ball, leave your phone with an alarm (he
confiscates it if he finds it), switch on the common-room radio, or knock on a sleeping
student's door. The sleeping chowkidar wakes to loud noise and shouts for the warden. Get
caught and whatever you are holding goes into the warden's almirah (you can steal it back).
Reach the Maggi stall for the score card: improvised answers beat sneaky ones, which beat
keys, which beat brute force.

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
clock that always says what to do next; the 3 AM deadline (the stall closes; 15 real
minutes, with a warning at 2:45); a time bonus and a saved best score on the score card;
a pause menu with sensitivity, controls and restart; an icon and web manifest.

## How it is built

| Path | What it does |
|---|---|
| `shared/map.js` | The hostel grid, collision, line of sight, A* path finding (no Three.js; tested in Node) |
| `shared/warden-ai.js` | Warden Saab's patrol, sight, hearing and chase (pure logic; tested in Node) |
| `shared/jugaad.js` | Items, recipes, loot, every way through each lock, distractions, chowkidar, score (pure logic; tested) |
| `src/interact.js` | What you are looking at, and where a thrown thing lands |
| `src/render/chowkidar.js`, `src/render/items.js` | The chowkidar; items drawn as comic stickers |
| `src/render/students.js` | Act 2's students cramming in study circles |
| `src/cutscenes.js` | Comic-page cutscenes built from engine-rendered panels |
| `src/input.js` | Keyboard, mouse, and the phone joystick, look-drag and buttons |
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
