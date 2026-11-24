# gta6-game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/xylo182/gta6-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/xylo182/gta6-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar Bay** — a complete original open-world crime game in the spirit of GTA 6, built for the [make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01?ref=h781tfp4). Top-down 2D, vanilla JavaScript + HTML5 canvas, no libraries, no network requests. Every name, place, character, vehicle and story beat is original — nothing from Rockstar Games.

You are Rook Reyes, back in Solmar Bay, a sun-soaked coastal city. Steal cars, outrun the Bay PD, and run three jobs for fixer Dana Voss: steal wheels for the Marina Docks, run a timed delivery across the city while wanted, and escape a 3-star chase to your safehouse.

## What's in the game

- A living city: road grid, buildings, parks, parking lots, and a beach along the south shore
- On foot and by car: walk with WASD/arrows, aim with the mouse, steal any car with E, drive with arcade physics
- Traffic AI and pedestrians on the sidewalks, who scatter when a car bears down on them
- Wanted level (1–5 stars) and police cruisers that chase, ram, and bust you on foot
- Three story missions with dialogue, objectives, timers, and a live minimap
- Combat: pistol with mouse aim, limited ammo, pickups (cash, health, ammo)
- HUD with cash, health, wanted stars, mission objective, speed, and minimap
- Start screen, pause, busted / wasted screens, and a save (localStorage) that keeps your cash and jobs after every mission
- Procedural WebAudio only: engine hum, sirens, shots, and pickups — no audio files (M to mute)

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — the game runs fully offline from its own files.

Staged screenshots live under `screenshots/` (`?shot=start|drive|chase|street&seed=1` reproduces each one deterministically).

---

<sub>Entered on [make.fun](https://make.fun/?ref=h781tfp4&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
