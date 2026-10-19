# Broadside!

A cartoony 1600s naval battle game for phones. Command a small English squadron in the Caribbean, beat three
Spanish captains and collect their hats.

## Play

```sh
npm install
npm run dev        # local server; open the printed URL on your phone (same Wi-Fi)
npm run build      # production build in dist/
```

`npm run build:artifact` makes a single self-contained page (`dist-single/artifact.html`) for sharing.

## How it plays

- **Drag from a ship** to draw its course. **Press and hold** a ship, then drag around it, to anchor and turn on
  the spot. **Tap** a ship to clear its course or raise the anchor.
- **Broadsides**: cannons are on the sides. Auto fire (crews fire when an enemy is in arc) or manual fire buttons.
- **Wind** sets your speed; sailing straight into it is slow. Islands block hulls and shot.
- **Forts** fire in every direction. Shoot one silent, stop a ship beside it and tap **Land troops** to garrison
  it; a captured fort fires for you.
- **Campaign**: a tutorial plus nine battles across three regions, each region ending in a boss. Wins pay gold and
  stars (3 stars = no ships lost); bosses drop their captain's hat.
- **Shipyard**: refit ships into bigger classes (sloop → brig → frigate → man-o'-war), add guns, bow chasers, sea
  mines, oak plating, new canvas and marines, or hire more ships (up to five).

Progress is saved in the browser (localStorage).

## Code layout

```
src/
  config/   ships, battles (the campaign table), upgrades, hats
  sim/      battle setup, steering + AI, combat, forts, mines, particles, wind, the update tick
  render/   three.js renderer, toon water, ship/island/fort models, camera framing, scene sync
  hud/      2D HUD canvas and touch input
  ui/       DOM screens: menu, sea chart, shipyard, hats, briefing, pause, results, tutorial coach
  audio/    synthesised music, sea ambience and sound effects (no audio files)
  save.js   campaign progress, shipyard purchases, rewards
  state.js  shared live state
  main.js   boot and game loop
```

The simulation runs in 2D map space; the renderer copies it into a tilted 3D scene each frame.

## Making content

Battles are data (`src/config/battles.js`) built from primitives: goals, ship abilities, scripted events and
ship types. [docs/EXTENDING.md](docs/EXTENDING.md) has copy-paste recipes for new battles and new primitives;
[docs/PRIMITIVES.md](docs/PRIMITIVES.md) lists every primitive (generated with `npm run docs`).
`npm run check` validates all content in a second or two, and `?battle=<id>` in the URL jumps straight into
a battle.

## Tests

```sh
npm run check   # content validation + docs freshness, no browser
npm test        # the check, then builds the single-file page and runs the Playwright tests
```

`tests/smoke.mjs` plays the tutorial with touch input, buys shipyard upgrades, captures a fort, fights a boss
and checks landscape; screenshots go to `tests/out/`. `tests/islands.mjs` sends every ship size at every island
from eight directions. Set `CHROMIUM_PATH` to use a specific Chromium build.
