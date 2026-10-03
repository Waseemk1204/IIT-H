# Maggie ke liye kuch bhi!

A comic jugaad stealth game for the IIT-H Game Jam (themes: **Comic · Twist · Light**).

It is 1:30 AM before the Endsem, the hostel has a power cut, and the night canteen still has Maggi.
Sneak past the warden's torch and through the locked gate with whatever a hostel has lying around.
Halfway through, the power comes back.

- Proposal: [proposal.pdf](proposal.pdf) (source: [docs/proposal.html](docs/proposal.html))
- Solo developer: Mohammad Waseem Khan · [IndieConnect @waseemk1204](https://www.indieconnect.in/@waseemk1204)

All game code is written from scratch during the jam. The only third-party code is
[Three.js](https://threejs.org) (MIT), kept in `assets/vendor/`.

## Play it locally

```bash
npm start
```

Then open http://localhost:5180. There is nothing to install and no build step.

```bash
npm test
```

runs the tests for the map, collision, line of sight and the warden's AI.

**Controls:** WASD move · mouse look (click to lock; drag also works) · Shift run (loud) ·
C crouch · F phone torch · E open/close doors · P pause · M mute.

## Status

**Phase 1 (done):** the hostel block (A-wing rooms, corridor, grill gate, lobby, common
room, warden's room, compound and the Maggi stall), first-person movement with collision,
crouch and run, the power-cut darkness, your phone torch, and Warden Saab: patrol route,
torch-beam sight cone, hearing, investigating noises, chasing, and catching you.

Next: Phase 2 (jugaad items, inventory, combining, the three locks, distractions), Phase 3
(the power-comes-back twist, cutscenes, audio polish), Phase 4 (phone controls, polish).

## How it is built

| Path | What it does |
|---|---|
| `shared/map.js` | The hostel grid, collision, line of sight, A* path finding (no Three.js; tested in Node) |
| `shared/warden-ai.js` | Warden Saab's patrol, sight, hearing and chase (pure logic; tested in Node) |
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
