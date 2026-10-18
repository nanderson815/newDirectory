# Extending Broadside

Battles are data built from four kinds of primitive. Each lives in a registry, and the validator, the docs
and the test bot all read those registries, so adding a primitive is one module plus one line in a list.

| primitive | where | registry |
|---|---|---|
| goal (what wins or loses a battle) | `src/sim/goals/<id>.js` | `GOALS` in `src/sim/goals/index.js` |
| ability (a ship behaviour) | `src/sim/abilities/<id>.js` | `ABILITIES` in `src/sim/abilities/index.js` |
| event condition / action | `src/sim/events.js` | `WHEN` / `DO` |
| ship type | `src/config/ships.js` | `TYPES` |

[PRIMITIVES.md](PRIMITIVES.md) lists every one of them with its params and defaults. It is generated, so
don't edit it by hand.

**The loop:** edit, then `npm run check` (a second or two, no browser). Then open
`npm run dev` at `http://localhost:5173/?battle=<id>` to jump straight into the battle. Dev builds also
`console.warn` any content problems at boot. After changing a primitive, run `npm run docs`.

Positions are fractions of a portrait map: `x` runs across, `y` runs down, and the player starts at the
bottom. Landscape screens rotate the layout for you. Headings `h` and `wind` are in degrees: 0 is east,
-90 is north (up the chart), 90 is south.

## Add a battle (data only)

Add an entry to `BATTLES` in `src/config/battles.js`. Its position in the list sets the unlock order, since
each battle opens once the one before it is won. The chart groups battles by `region`, and a new region goes
in `REGIONS`.

```js
{
  id: 'reef', region: 'pirate', roman: 'XIIa', year: 1661, name: 'Reef of Bones', foe: 'pirate hunters',
  faction: 'pirate',              // black sails; leave out for Spain
  reward: 480, wind: 60,          // gold for the first win; the wind blows toward 60°
  brief: 'Three pirate ships wait among the reefs. Sink them all.',
  enemy: [
    { type: 'schooner', name: 'Bonebreaker', x: 0.3, y: 0.14, h: 90 },
    { type: 'schooner', name: 'Widowmaker', x: 0.7, y: 0.14, h: 90 },
    { type: 'brig', name: 'Black Tom', x: 0.5, y: 0.08, h: 90, hp: 160, chasers: 1 },
  ],
  islands: [{ x: 0.3, y: 0.42, r: 30 }, { x: 0.7, y: 0.46, r: 32 }, { x: 0.5, y: 0.62, r: 22 }],
  ai: { spread: 0.11, reloadMul: 1.05, dmgMul: 0.85, hpMul: 1.3 },   // enemy aim scatter, reload, shot weight, hulls
}
```

With no `goal`/`goals` the goal is `sink`. Optional fields:
- `player: [shipDefs]` replaces the campaign fleet.
- `forts: [{ island, name, hp, guns, need, team? }]`: `island` indexes `islands`, `need` is the marines it
  takes to capture, and `team: 'player'` makes it your fort.
- `events`, `hat`, `fog` (how far your lookouts see).

Ship defs take `type`, `name`, `x`, `y` and `h`, plus optional `hp` (fixed hull; otherwise the type's hull ×
`ai.hpMul`), `chasers`, `reloadMul`, `passive`, `boss` and `abilities`.

## Give a boss a new ability

A boss is an enemy ship with `boss: { captain, title, hat }`. The battle takes `goal: 'boss'` and a `hat`
matching the boss's, and that hat must exist in `src/config/hats.js`. `abilities` merge over the type's own,
and `true` takes the defaults:

```js
goal: 'boss', hat: 'rojo',
enemy: [
  { type: 'galleon', name: 'La Bruja', x: 0.5, y: 0.16, h: 90, hp: 340, chasers: 2,
    abilities: { mortar: { range: 480, reload: 5 }, mineLayer: true, launcher: { type: 'fireship', every: 20 } },
    boss: { captain: 'Capitán Rojo', title: 'La Bruja', hat: 'rojo' } },
  ...
],
```

## Script an event

`events: [{ ...conditions, ...actions }]`. Each event fires once, on the first tick when all of its
conditions hold, and runs its actions in order. An event with no conditions fires at the start. It needs at
least one action.

```js
events: [
  { at: 40, banner: ['Enemy reinforcements!', 'A xebec and a bomb ketch'],
    spawn: [{ type: 'xebec', name: 'La Lanza', x: 0.2, y: 0.08, h: 90 }, { type: 'bomb', name: 'El Rayo', x: 0.8, y: 0.08, h: 90 }] },
  { bossHp: 0.5, banner: ['She signals for help!'], spawn: [{ type: 'brig', name: 'San Telmo' }] },  // x, y, h default to top centre
  { enemiesLeft: 1, fog: 180 },
  { at: 90, wind: 180, banner: ['The wind backs round!'] },
],
```

Spawned ships are enemies unless they set `team: 'player'`.

## Combine goals

Goals are a list, and every goal must be met. The first goal is the main one: it sets the music and the
victory line. The battle is lost when any goal fails or the fleet is gone.

```js
goals: [
  { kind: 'treasure', need: 3, chests: [{ x: 0.2, y: 0.3 }, { x: 0.5, y: 0.35 }, { x: 0.8, y: 0.3 }, { x: 0.5, y: 0.5 }] },
  { kind: 'timer', secs: 180 },   // a timer only limits the others; on its own it is won at once
],
```

The chart and briefing treat a battle as a boss fight only when `goal: 'boss'` is set. To add goals to a
boss fight, keep the shorthand and list `boss` first:

```js
goal: 'boss', hat: 'rojo', goals: [{ kind: 'boss' }, { kind: 'timer', secs: 240 }],
```

## Add a ship type

Add an entry to `TYPES` in `src/config/ships.js`. The renderer builds the model from `L`, `B`, `masts` (2 or
3) and `rig`, so no art is needed.

```js
pinnace: { label: 'Pinnace', L: 50, B: 17, hp: 50, guns: 2, reload: 2.1, speed: 72, turn: 1.6, range: 215,
           masts: 2, marines: 8, rig: 'fore-aft', abilities: { oars: true } },
```

`rig` is `square` (the default), `fore-aft` (points high into the wind) or `lateen`; the sailing curves are in
`src/sim/wind.js`. Also add the plural to `PLURAL` in `src/ui/screens.js`, which builds the chart's roster
line ("2 pinnaces"). To make the type one the player can refit into, add it to `REFIT`/`REFIT_COST`.

## Write an ability module

Create `src/sim/abilities/repair.js`, then add it to the list in `src/sim/abilities/index.js`:

```js
// Carpenters patch the hull: `rate` hull points a second, up to `upTo` of her full hull.
export default {
  id: 'repair',
  about: 'Carpenters slowly patch the hull.',
  params: { rate: 'hull points a second', upTo: 'share of her full hull they can restore' },
  defaults: { rate: 1.5, upTo: 0.6 },
  update(s, a, dt) {
    const cap = s.maxHp * a.upTo;
    if (s.hp < cap) s.hp = Math.min(cap, s.hp + a.rate * dt);
  },
};
```

`a` is this ship's copy of `defaults` merged with the config. It is also where the ability keeps its state
(timers and so on). It is saved with the battle, so keep it plain JSON. All hooks are optional:

| hook | when |
|---|---|
| `init(s, a)` | once, when the ship is built (for example to set flags on `s`, as `oars` sets `s.oars`) |
| `update(s, a, dt)` | every tick while she's afloat, not a hulk and not locked in a boarding action |
| `steer(s, a)` | AI-sailed ships: return a heading (radians) to take the helm, or `null` |
| `wind(s, a, f)` | return her adjusted wind speed factor `f` |
| `sunk(s, a)` | when she starts to go down |

Document every param in `params`. The validator rejects config keys that aren't in `params` or `defaults`,
type-checks values against the defaults, and checks that a param named `type` is a ship type. A param with no
default is required unless its description says "default" or "optional".

## Write a goal module

Create `src/sim/goals/hunt.js`, then add it to the list in `src/sim/goals/index.js`:

```js
import { afloat } from '../../state.js';
import { avoidIslands } from '../steering.js';

// Sink the enemy ships named in `targets`; the rest may be left afloat. The quarry runs from English ships.
export default {
  id: 'hunt',
  about: 'Sink the named enemy ships; they run from English ships that come close.',
  params: { targets: 'names of the enemy ships to sink', flee: 'how close an English ship makes them run (default 200)' },
  setup(o, G) {
    o.ids = G.ships.filter((s) => s.team === 'enemy' && o.targets.includes(s.name)).map((s) => s.id);
    o.flee = o.flee || 200;
  },
  done: (o, G) => !G.ships.some((s) => o.ids.includes(s.id) && s.team === 'enemy' && afloat(s)),
  hud: (o, G) => [`Quarry afloat: ${G.ships.filter((s) => o.ids.includes(s.id) && s.team === 'enemy' && afloat(s)).length}`],
  steer(o, G, s) {
    if (!o.ids.includes(s.id)) return null;
    const p = G.ships.find((q) => q.team === 'player' && afloat(q) && Math.hypot(q.x - s.x, q.y - s.y) < o.flee);
    return p ? avoidIslands(s, Math.atan2(s.y - p.y, s.x - p.x), 160) : null;
  },
  validate: (o, B) => o.targets.filter((n) => !B.enemy.some((e) => e.name === n)).map((n) => `no enemy ship named '${n}'`),
  brief: (o) => `Sink ${o.targets.join(' and ')}. They will run if you come close.`,
  won: (o) => `${o.targets.join(' and ')} will trouble the sea no more.`,
};
```

`o` is this battle's copy of the goal def (`{ kind, ...params }`) and holds the goal's state. It is saved with
the battle, so store ship ids rather than ship objects. `G` is the live battle.

| hook / flag | what it does |
|---|---|
| `id`, `about`, `params` | required; `params` is `{}` if it takes none |
| `done(o, G)` | required: true once the goal is met |
| `brief(o, B)` | required: the order on the briefing screen (`B` is the battle def) |
| `setup(o, G, ctx, B)` | builds state when the battle is created. `ctx.place(x, y)` turns fractions into map coordinates; `ctx.add(def, team)` adds a ship (escort does this) |
| `update(o, G, dt)` | every tick |
| `failed(o, G)` | a reason key once the goal can't be met, else `null` |
| `lost: { reason: text }` | the defeat-screen line for each reason `failed` returns |
| `won(o, B)` | the victory line (used for the first goal) |
| `hud(o, G)` | objective lines at the top right |
| `sunk(o, G, s)` / `escaped(o, G, s)` | a ship went down / left through the exit band |
| `weigh(o, G, s, t, d)` | AI: bias enemy captain `s`'s choice of target `t` at distance `d` (lower is keener; escort uses `d * 0.6` for the merchantmen) |
| `steer(o, G, s)` | AI: return a heading for enemy ship `s` to override her captain, or `null` (treasure sends salvors to chests) |
| `aiForts: true` | AI: enemy captains attack your forts too (hold) |
| `exit: true` | draws the exit band at the top of the chart; ships marked `exits` leave through it |
| `tip: 'id'` | a one-time HUD tip. The text lives in `TIPS` in `src/hud/hud.js`, so add a line there for a new id |
| `endless: true` | never won; the battle ends when the fleet is gone (waves) |
| `validate(o, B)` | content checks for `npm run check`: return a list of problem strings |

The validator rejects unknown params and requires every param unless its description says "default" or
"optional". If `need` is set, it must not exceed the goal's one list (chests, ships). It checks ship defs in
list params, and that `{ x, y }` lists hold map fractions.

## Add an event condition or action

Add a `{ about, fn }` entry to `WHEN` or `DO` in `src/sim/events.js`:

```js
// WHEN: fn(G, value) returns true when the condition holds
shipsLeft: { about: 'at most this many of your ships afloat', fn: (G, n) => G.ships.filter((s) => s.team === 'player' && afloat(s) && !s.escort).length <= n },
// DO: fn(G, value) acts
heal: { about: 'repair every English ship by this share of her hull (0-1)', fn: (G, k) => { for (const s of G.ships) if (s.team === 'player' && afloat(s)) s.hp = Math.min(s.maxHp, s.hp + s.maxHp * k); } },
```

Then use them: `{ shipsLeft: 1, heal: 0.3, banner: ['Carpenters!'] }`. A key must not be in both maps. For
value checks beyond "the key exists", add a rule to `EVENT_RULES` in `src/config/validate.js`.

## Teach the test bot a new goal

The playtests and `tests/balance.mjs` sail your fleet with `tests/bot.js`. For each goal in the battle, the
bot asks `GOAL_ORDERS[kind](s, o, c)` what ship `s` should do:
- `{ to: { x, y } }` to sail there
- `{ target }` to fight that ship or fort
- `null` to fall through to the next goal, and finally to the nearest enemy

`c` holds `G`, `enemies`, `boss`, `hostileForts` and `claimed`, a Set that keeps ships from chasing the same
thing.

```js
hunt: (s, o, c) => {
  const quarry = c.enemies.filter((e) => o.ids.includes(e.id));
  return quarry.length ? { target: nearest(s, quarry) } : null;
},
```

A goal met just by sinking enemies needs no entry. Landing at silenced forts and dodging fireships are
built in.

## Verify

```sh
npm run check                                     # content + docs freshness, no browser (also first in npm test)
npm run docs                                      # regenerate docs/PRIMITIVES.md after changing a primitive
npm test                                          # the full Playwright suite (slow)
npm run build:single && ONLY=reef RUNS=8 node tests/balance.mjs   # bot win rate for one battle
```

`?battle=<id>` (or a campaign index, or `endless`) starts that battle straight away in the dev server and in
the single-file build (`dist-single/index.html?battle=reef`). An unknown id warns in the console and boots to
the menu.
