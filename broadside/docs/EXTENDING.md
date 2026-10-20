# Extending Broadside

Battles are data built from six kinds of primitive. Each lives in a registry, and the validator, the docs
and the test bot all read those registries, so adding a primitive is one module plus one line in a list.

| primitive | where | registry |
|---|---|---|
| goal (what wins or loses a battle) | `src/sim/goals/<id>.js` | `GOALS` in `src/sim/goals/index.js` |
| ability (a ship behaviour) | `src/sim/abilities/<id>.js` | `ABILITIES` in `src/sim/abilities/index.js` |
| event condition / action | `src/sim/events.js` | `WHEN` / `DO` |
| ship type | `src/config/ships.js` (the great ship: `src/config/flagship.js`) | `TYPES` |
| gun (a kind of piece a slot can mount) | `src/config/guns.js` | `GUNS` (slots: `src/config/slots.js`) |
| landmark (scenery, or land that matters) | `src/sim/land.js` + `src/render/landmarks.js` | `LANDMARKS` / `BUILD` |

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
- `events`, `hat`, `fog` (how far your lookouts see), `land` (its look and landmarks; see Dress the land), `sea` (size multiplier for the battle's sea on top of the camera's `SEA_SCALE`: 1.2 for a wide-open chase, 0.85 for a tight harbour).

Ship defs take `type`, `name`, `x`, `y` and `h`, plus optional `hp` (fixed hull; otherwise the type's hull ×
`ai.hpMul`), `chasers`, `reloadMul`, `passive`, `boss`, `abilities` and `loadout` (her guns slot by slot; see
[Guns and slots](#guns-and-slots)).

## Shape the sea (geography and openings)

Round islands on open water get old fast. A battle can also lay out (all optional, see
[PRIMITIVES.md](PRIMITIVES.md#geography-and-openings) for every field):

```js
coast: { side: 'top', depth: 0.34, coves: [{ at: 0.5, width: 0.6, depth: 0.27 }] },   // a shore with a cove in it
islands: [{ x: 0.8, y: 0.44, r: 30, stretch: 2.3, angle: 95 }],   // a long island lying down the chart
shoals: [{ x: 0.5, y: 0.37, r: 34, stretch: 1.6 }],   // pale shallows: brigs and bigger run aground, sloops sail over
reefs: [{ x: 0.27, y: 0.4, r: 12, stretch: 4, angle: 25 }],   // a reef line that holes any hull crossing it
fleetAt: 'center',   // your fleet starts mid-chart (also 'top', 'left', 'right', or { slots, h })
```

`coast` may be a list (two shores make a strait). Coast depth is a fraction of the chart across that edge;
coves cut into the land and capes push out to sea. Ships, chests and the buoy may not start on land, and ships
may not start on a reef or (if they're big enough to ground) on a shoal: `npm run check` names the culprit.
Every captain, your drawn courses and the test bot steer round all of it. Enemy positions can go anywhere, so
pair `fleetAt` with enemies astern or on the flank for an ambush.

The sea can move, too (`src/sim/flow.js`, drawn by `src/render/flow.js`):

```js
currents: [{ x: 0.5, y: 0.45, r: 120, stretch: 2.6, angle: 90, speed: 16 }],   // the water sets every ship along (streaks)
shoals: [{ x: 0.4, y: 0.33, r: 40, stretch: 3, tidal: true }],                // a bar the tide covers and uncovers
tide: { level: 0.5, turns: [{ at: 45, to: 1, secs: 14 }] },                    // 1 high water (all pass), 0 low (none)
booms: [{ from: [0.46, 0.35], to: [0.79, 0.36], hp: 70, fort: 0 }],            // land until shot through or fort 0 falls
```

Steering is local, so when the way to a mark isn't in plain sight (a cove, an island chain) the route planner
(`src/sim/navgrid.js`) finds one and the ship sails its waypoints; the course preview shows them. Keep every
battle navigable: `npm run check` runs `tests/navcheck.mjs`, which plans from your fleet's slots to every
objective for the biggest ship you could bring, with three beams of room in every channel and at every stage
of the tide, and names whatever it can't reach. `node tests/navcheck.mjs` on its own prints the same, faster.

Give each map one shape and one reason to manoeuvre, and say what it is in a line above its geography in
`battles.js` (a strait with a set against you, a reef gate, a bar the flood opens at 45 seconds...). Bigger
seas (`sea: 1.3`-`1.5`) leave room to scout and flank; island radii are map units, so a bigger sea needs bigger
or more land to keep its shape. `node tests/map-shots.mjs` shoots every map zoomed out and at mid zoom.

## Dress the land

Every battle's land lives in `src/config/lands.js`, keyed by battle id (a battle def may carry its own `land`
instead). It says how the land looks and what stands on it; the geography itself (islands, coasts) stays in
`battles.js`, and landmarks refer to it by index:

```js
siege: {
  style: 'port',                                     // the look: port, windward, main, golden, pirate, campeche, armada
  relief: [{ island: 2, height: 1.1, cliffs: 0.4, at: 0 }],   // hill height, share of cliff shore, which way they face
  landmarks: [
    { kind: 'town', island: 0, at: 150, d: 0.66, houses: 6, team: 'player', name: 'Port Royal' },
    { kind: 'harbour', island: 0, at: -60, r: 80 },  // your ships lying still here patch their hulls
    { kind: 'lighthouse', island: 2, at: 0, d: 0.45 },
    { kind: 'wreck', x: 0.5, y: 0.6 },               // in the water: only on a reef, a shoal or land
  ],
},
```

On an island, `at` is the direction from its centre (degrees, 0 east, 90 down the chart) and `d` how far out
toward the shore (0-1); on a coast, `at` is how far along its edge (0-1) and `inland` how many map units in from
the shore. `npm run check` makes sure each landmark fits inside the land ships collide with, stays off a fort's
tower and doesn't overlap its neighbours. Most kinds are scenery; four change the battle (all optional):

- `harbour` with `rate` > 0: ships lying still in its anchorage patch their hulls until the yard's `stock` of
  timber runs out. On a fort's island it serves whoever holds the fort.
- `town` with `loot` > 0: the other side's shot that lands on it sets it burning; once it has taken `hp` it is
  sacked and its loot is paid with the battle's reward on a win.
- `peak` and `volcano`: high land casts a lee downwind (`lee` island radii long) where ships keep only `calm` of
  the wind at worst. Calm water shows it, swinging with the wind.
- `lighthouse` with `sight`: lifts the fog that far round it, for your lookouts and on screen.

To add a kind: an entry in `LANDMARKS` in `src/sim/land.js` (about, params, defaults, where, extent and any sim
hooks), a builder in `BUILD` in `src/render/landmarks.js`, then `npm run docs`. Landmarks register their living
details (chimney smoke, lamps, flags, gulls, people) with the builder's `ctx`; `render/land.js` animates them,
and they show more the closer you zoom. `ctx.shadow` grounds a building with a soft shadow and `ctx.flat`
lays a packed-earth street or square under it; plants come from `src/render/flora.js` (each region's mix and
palette is its `STYLES` entry in `render/land.js`). `node tests/land-budget.mjs` reports each battle's land
draw calls, vertices and plants: keep a new kind lean.

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
line ("2 pinnaces"). To make the type one the player can refit into, add it to `REFIT`/`REFIT_COST`. A type
that fits its guns slot by slot sets `slots` and `tons` (see [Guns and slots](#guns-and-slots)); without them it
fires `guns` long guns a side.

## Guns and slots

Every ship fires through **batteries**, one per gun slot (`src/sim/guns.js`, fired by `updateGuns` and
`fireBattery` in `src/sim/combat.js`). Most classes never say so: a class without `slots` gets implicit ones, a
`port` and a `starboard` broadside of its `guns` long guns (plus the shipyard's extra guns) firing with the class's
own `range` and `reload`, and a `bow` slot of chasers when the ship def or an upgrade gives it any. The great ship
(`src/config/flagship.js`, merged into `TYPES`) is the one class that declares its slots, and the player fits them
one by one at the shipyard. [PRIMITIVES.md](PRIMITIVES.md#guns-and-slots) has the full gun table.

**A gun** is an entry in `GUNS` (`src/config/guns.js`); every field is described in `GUN_PARAMS`, and the
validator rejects anything else:

```js
culverin: {
  label: 'Long culverins', short: 'Culverin', about: 'One line for the ledger, in the game\'s voice.',
  fits: ['broadside'],            // positions: broadside, bow, stern, deck (POSITIONS in src/config/slots.js)
  fires: 'ball',                  // 'ball', 'shell' (lobbed like the mortar ability) or 'pot' (sets her burning)
  range: 330, reload: 4, dmg: 3.5, weight: 3.4, arc: 30,      // per gun; arc is the half-angle off the slot's facing
  shot: ['round', 'chain'],       // what it can load; the first is what it fires when her chosen shot won't fit
  crew: 7, cost: 40,              // cost is gold per gun: a slot of five costs five times this to fit
  render: { barrel: 1.2, bore: 0.9 },   // relative to a long gun, for the battle model and the 3D yard
  // optional: auto (fires on its own in Manual), single (one piece fills the slot), pellets, crewKill, repel,
  // minRange, radius (shell), burn (pot), traverse
},
```

Then list it in a slot's `accepts` to make it fittable. Hand-fired guns (`auto` unset) are the broadside: they
fire on their own for the enemy and in Auto, and on the Fire tiles in Manual. Guns marked `auto` (swivels,
chasers, mortars, fire-pots) always look after themselves. Each battery waits for a target inside its own reach
and arc, so short guns (carronades) only speak when the enemy is close.

**Slots** belong to a class. A class with `slots` must also set `tons`, the most weight of guns she may carry;
her `speed` and `turn` are quoted with the default loadout, and each ton more or less moves them by
`WEIGHT.speed` / `WEIGHT.turn` of themselves per `tons` (`src/config/slots.js`). Her `guns`, `reload` and `range`
are only the at-a-glance figures for the type table.

```js
slots: {
  portLower: { label: 'Lower tier', pos: 'broadside', side: 'port', tier: 'lower', count: 5,
               accepts: ['long', 'demicannon'], default: 'long', at: [-0.3, 0.3] },
  bow: { label: 'Bow', pos: 'bow', count: 2, accepts: ['bowChaser', 'swivel'], default: 'bowChaser' },
  forecastle: { label: 'Forecastle', pos: 'deck', count: 2, accepts: ['swivel', 'mortar', 'firepot'], default: 'swivel', at: [0.3, 0.36] },
},
tons: 92,
```

`at` is where along the hull the guns sit (fractions of her length from amidships: 0.5 the bow), used for the
muzzles in battle, the battle model and the 3D yard. `npm run check` checks every slot table (positions, sides,
tiers, that each accepted gun fits the position, that the default loadout isn't overweight).

**A loadout** is `{ slotId: gunId }`; slots it leaves out take their `default`. Battle ship defs may carry one,
on a slotted class or on a simple class's implicit slots:

```js
{ type: 'frigate', name: 'Black Wyvern', ..., loadout: { port: 'carronade' } },          // carronades to larboard
{ type: 'greatship', name: 'Real Felipe', ..., loadout: { portLower: 'demicannon', starboardLower: 'demicannon', portUpper: 'swivel', starboardUpper: 'swivel', forecastle: 'mortar' } },
```

The validator names an unknown slot or gun, a gun its slot won't take, and an overweight loadout. A ship's captain
fights at the reach of her *main battery*, the one throwing the most weight of shot a second (`s.range`): a ship
heavy in carronades closes in, one heavy in long guns stands off.

**The campaign** offers the great ship once `FLAGSHIP.unlock` (La Gran Armada) is won: a frigate or a man-o'-war
from `FLAGSHIP.from` can be rebuilt as one, one to a squadron (`greatOffer`/`buyGreatShip` in `src/save.js`).
Fitting a slot costs the gun's `cost` times the guns it takes (`fitOffer`/`fitGun`); a fit that would take her
over `tons` is refused. Her slots replace the simple *More guns* and *Bow chasers* upgrades; hull, canvas,
marines, mines and shot carry over.

**The save** is v2 (`src/save.js`, key `broadside.save.v2`; a v1 save under `broadside.save.v1` is migrated on
load and left in place as a backup):

```js
{ v: 2, gold, stars: { battleId: 1-3 }, hats: [hatId], hired, best?, tips?: [tipId],
  fleet: [{ name, cls, up: { upgradeId: level, chain?: 1, grape?: 1 },
            loadout: { slotId: gunId },   // every slot, for a slotted class; {} otherwise
            look: {} }] }                  // cosmetics, empty for now: see LOOK_FIELDS
```

`look` is for cosmetics a 3D shipyard will set (`LOOK_FIELDS` in `src/save.js`: `paint`, `sails`, `figurehead`,
`flags`, `lanterns`); every field is optional and a missing one means the class's usual look. Add new fields to
`LOOK_FIELDS` and keep them plain JSON; the migration keeps whatever is there.

**In battle** a ship carries `s.batteries` (plain JSON, saved with the battle) and summaries the rest of the game
reads: `s.guns`, `s.chasers`, `s.range`, `s.reloadTime`, `s.reload[side]` (seconds until that side's first
hand-fired battery is loaded; writing it shifts that side's batteries, so `s.reload = [0, 0]` still means "loaded")
and `s.repel` (her swivels' help against boarders). `hasten(s, secs)` loads every gun aboard faster (the rally
ability uses it). The HUD's Fire tiles split their reload rule into one segment per battery on that side
(`sideLoad`), and the selected ship shows a range rim for each different reach.

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
type-checks values against the defaults, and checks that a `type` param described as a "ship type" names one.
A param with no default is required unless its description says "default" or "optional".

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
