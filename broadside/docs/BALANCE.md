# Balance

Bot win rates for every campaign battle, measured with `tests/balance.mjs`: the scripted captain (`tests/bot.js`)
plays each battle 16 times with seeded randomness, sim-only, in a fleet a greedy shipyard policy could afford by
then (the gold from winning every earlier battle once, 40% of first wins flawless). The fleet each battle sees
does not depend on how earlier battles went, so each battle can be tuned on its own.

```sh
npm run build:single
WORKERS=1 WORLD=caribbean node tests/balance.mjs        # the West Indies
WORKERS=1 WORLD=med node tests/balance.mjs              # the Mediterranean (the fleet still comes through the Indies)
WORKERS=1 WORLD=med ONLY=goletta RUNS=8 node tests/balance.mjs   # one battle while iterating
```

Targets allow ±10 points. Outcomes near a target are chaotic: a 2% change in one battle's `dmgMul` can move its
16-run number by 20–30 points either way, because every seed replays a slightly different fight. Read a single
number as "about here", and check a battle at 16 runs before believing a retune.

Tuning knobs, in order of preference: what the enemy brings (ships, reinforcement waves, fort guns), how they
fight (`ai.reloadMul`, `ai.dmgMul`, `ai.spread`, abilities such as `flee`), and only then hulls (`ai.hpMul`, a
boss's `hp`). The core sim, the bot's fleet avoidance and the route planner are not touched by a retune.

## The West Indies

Measured on the balance pass after the fleet-avoidance, route-planner and map passes (16 runs per battle).

| #     | battle      | goal         | target | before | now  |
|-------|-------------|--------------|-------:|-------:|-----:|
| 0     | tutorial    | sink         |   100  |   100  |  100 |
| I     | tortuga     | sink         |    95  |    88  |   88 |
| II    | cayman      | sink         |    85  |   100  |   81 |
| III   | rojo        | boss         |    70  |    81  |   75 |
| IV    | sanlucas    | capture      |    75  |    44  |   69 |
| V     | silver      | sink         |    72  |   100  |   63 |
| VI    | comodoro    | boss         |    60  |   100  |   50 |
| VII   | cartagena   | capture      |    65  |    75  |   75 |
| VIII  | santamarta  | capture      |    55  |    69  |   50 |
| IX    | oro         | boss         |    45  |   100  |   44 |
| X     | cove        | sink         |    70  |    38  |   63 |
| XI    | wreck       | treasure     |    65  |    88  |   75 |
| XII   | kate        | boss         |    55  |    69  |   63 |
| XIII  | convoy      | escort       |    60  |   100  |   69 |
| XIV   | siege       | hold         |    55  |    81  |   50 |
| XV    | hierro      | boss         |    45  |    81  |   44 |
| XVI   | fog         | sink         |    50  |    38  |   50 |
| XVII  | blockade    | breakthrough |    45  |   100  |   44 |
| XVIII | armada      | boss         |    30  |    50  |   31 |

What changed:

- **Cayman Shoals (II)**: the brigs hit harder (`dmgMul` 0.72 → 0.95) and are a little stouter (`hpMul` 1.4 → 1.55).
- **La Bruja (III)**: `dmgMul` 0.85 → 0.87.
- **Fort San Lucas (IV)**: easier, `hpMul` 2.1 → 1.8 (the bot was losing its marines before the fort fell).
- **The Silver Fleet (V)**: the convoy fights back (`dmgMul` 0.76 → 0.85, `hpMul` 1.3 → 1.6).
- **San Cristóbal (VI)**: `dmgMul` 0.78 → 0.84, `hpMul` 1.15 → 1.2.
- **Santa Marta (VIII)**: `dmgMul` 1.0 → 1.05.
- **Santísima Trinidad (IX)**: the Almirante's man-o'-war 360 → 440 hp and her galleons no longer under-built
  (`hpMul` 0.7 → 1.1, `dmgMul` 0.9 → 1.1).
- **Smugglers' Cove (X)**: easier, `dmgMul` 1.52 → 1.45, `hpMul` 2.65 → 2.5.
- **The Treasure Wreck (XI)**: `dmgMul` 1.0 → 1.18.
- **Black Wyvern (XII)**: `dmgMul` 1.3 → 1.4.
- **Convoy to Jamaica (XIII)**: a fifth raider, the xebec El Estoque, rows out of the creek at 40 s; the raiders
  reload faster (`reloadMul` 0.85) and hit harder (`dmgMul` 1.35, `hpMul` 1.8).
- **The Siege of Port Royal (XIV)**: `dmgMul` 1.46 → 1.65.
- **The Iron Marquis (XV)**: San Jerónimo 800 → 850 hp, `dmgMul` 1.05 → 1.18.
- **Fog off the Mosquito Coast (XVI)**: easier, `dmgMul` 1.2 → 1.1.
- **Run the Blockade (XVII)**: a fourth galleon, San Juan, waits above the reef by the exit; sharper aim
  (`spread` 0.1 → 0.08) and `dmgMul` 0.95 → 1.22.
- **La Gran Armada (XVIII)**: `dmgMul` 0.85 → 1.0.

## The Mediterranean

A gentle slope from about 70 at Tangier to about 30 at the Kapudan Pasha (16 runs per battle).

| #    | battle     | goal         | target | before | now |
|------|------------|--------------|-------:|-------:|----:|
| I    | tangier    | sink         |    70  |    63  |  63 |
| II   | gibraltar  | hunt         |    68  |    81  |  63 |
| III  | sale       | boss         |    66  |   100  |  69 |
| IV   | bougie     | sink         |    64  |   100  |  56 |
| V    | bagnio     | rescue       |    62  |    88  |  63 |
| VI   | goletta    | hunt         |    60  |   100  |  56 |
| VII  | algiers    | boss         |    58  |    81  |  63 |
| VIII | knights    | sink         |    55  |   100  |  56 |
| IX   | passero    | sink         |    55  |    75  |  63 |
| X    | tripoli    | boss         |    52  |   100  |  50 |
| XI   | zante      | escort       |    50  |   100  |  56 |
| XII  | navarino   | protect      |    48  |    75  |  44 |
| XIII | candia     | hold         |    45  |    50  |  50 |
| XIV  | dia        | capture      |    45  |    50  |  50 |
| XV   | narrows    | breakthrough |    40  |    94  |  44 |
| XVI  | kapudan    | boss         |    30  |    63  |  31 |

What changed:

- **Under the Rock (II)**: the polacres run sooner and faster (flee below 70% hull at 1.3× speed, was 55% at 1.2×),
  so a slow chase lets them clear the Straits; `dmgMul` 2.0 → 2.15.
- **The Rover of Salé (III)**: Burak 720 → 950 hp and Reis Ibrahim runs for the open sea sooner (below 35%, was
  28%); his squadron reloads faster (`reloadMul` 0.9).
- **Becalmed off Bougie (IV)**: a third galley, Hamza, in the 30 s wave from Cape Carbon (`dmgMul` 2.38 → 2.2 to
  keep the calm from becoming a massacre).
- **The Bagnio of Algiers (V)**: `reloadMul` 0.92.
- **Fireships at La Goletta (VI)**: a third guard galley, Hamza, off the spit; `reloadMul` 0.8, `dmgMul` 2.06 → 2.45.
- **The Admiral of Algiers (VII)**: `dmgMul` 2.17 → 2.1.
- **The Knights' Galleys (VIII)**: a sixth corsair, the galley Hamza, in the first line (the battle was won in 25 s
  before the second wave ever came); `dmgMul` 1.56 → 2.3, `hpMul` 2.12 → 2.8.
- **Storm off Cape Passero (IX)**: `reloadMul` 0.9, `dmgMul` 2.93 → 2.89.
- **The Reefs of Tripoli (X)**: Hilal 800 → 950 hp, `reloadMul` 0.9.
- **The Currant Ships (XI)**: a third galley, Hamza, out of the Morea coves at 16 s; `reloadMul` 0.88,
  `dmgMul` 1.64 → 2.1.
- **Navarino Bay (XII)**: `dmgMul` 1.62 → 1.92.
- **The Castles of the Narrows (XV)**: each castle mounts three guns (was two); `dmgMul` 1.21 → 2.0,
  `reloadMul` 1.05 → 1.0.
- **The Kapudan Pasha (XVI)**: Kara Ejder 1100 → 1300 hp, `dmgMul` 1.11 → 1.3.

## The "0% in 5 seconds" table

An early Caribbean run showed battles I–IX and XI at 0% with ~5 s durations and "forts NaN". It was a harness
artifact, not the game: that run was made right after the expansion with `ONLY=` set to the new battles, and the
`tests/balance.mjs` of the time printed a progress line for every battle, measured or not (an unmeasured battle has
no runs, so 0 wins out of 0 printed as 0% at the elapsed time of the previous battle), and averaged its empty fort
and boss columns into NaN. The harness now prints progress only for measured battles, and an unmeasured row leaves
its extra column blank. XI (the Treasure Wreck) was measured in that run, and its 0% in 7 s was a real game bug of
the time: the treasure goal failed as soon as chests hauled + chests in the water fell below `need`, so the
salvors scooping up the near chests in the first seconds lost the battle outright. That was fixed when goals moved
into their registry (src/sim/goals/treasure.js counts chests the salvors carry, since they can be won back). On
the current code every battle runs to a real result.
