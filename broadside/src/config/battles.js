// The campaign. Positions are fractions of a portrait map (x across, y down; the player starts at the bottom),
// headings are degrees (0 = east, -90 = north) and wind is the direction it blows toward.
// Difficulty climbs through `ai`: spread is enemy aim scatter (lower = sharper), reloadMul < 1 reloads faster,
// dmgMul is shot weight and hpMul pads enemy hulls.
//
// Everything here is built from primitives; see docs/EXTENDING.md.
// goals: what wins the battle, a list of { kind, ...params } from src/sim/goals/ (all must be met), or the
//   shorthand goal: 'boss'. Without either the goal is 'sink'. Kinds: sink, boss, capture, treasure, escort,
//   hold, breakthrough, timer, protect, hunt, reach, survive.
// Ships: { type (src/config/ships.js), name, x, y, h, hp?, chasers?, passive?, boss?, abilities? }. Boss ships
//   carry boss: { captain, title, hat } and win you that captain's hat. abilities: { id: config } from
//   src/sim/abilities/ (mortar, fireship, launcher, mineLayer, oars, repair, ram, flee, rally), merged over the
//   ship type's own.
// forts: [{ island, name, hp, guns, need, team? }] (team: 'player' for your own forts).
// events: scripted moments from src/sim/events.js, e.g. { at: 40, banner: [...], spawn: [...ships] } or
//   { shipSunk: 'San Juan', retreat: 'La Paga', say: ['La Paga', '¡Huid!'] }.
// faction: 'pirate' gives the enemy black sails and pirate flags. fog: how far (map units) your lookouts see.
// Geography (src/sim/terrain.js): islands may be long ({ x, y, r, stretch, angle }); shoals and reefs take the
//   same shape; coast: { side, depth, coves?, capes? } (or a list) lays a shore along an edge; fleetAt moves
//   your fleet's start ('top', 'left', 'right', 'center' or { slots, h }). The sea that moves (src/sim/flow.js):
//   currents: [{ x, y, r, stretch?, angle?, speed, dir? }] set ships along; tide: { level, turns: [{ at, to }] }
//   covers and uncovers shoals marked tidal: true; booms: [{ from, to, hp?, fort? }] close a harbour mouth.
// sea: optional size multiplier (linear) for the battle's sea on top of the camera's SEA_SCALE, e.g. 1.2 for a
//   wide-open chase or 0.85 for a tight harbour. Positions are fractions, so the layout scales with it; island
//   radii are map units, so a bigger sea is roomier.
//
// Every map has its own shape and a reason to manoeuvre; the line above each battle's geography says what it is
// for. `npm run check` proves every objective can be reached by the biggest ship you could bring, with room to
// spare in every channel (tests/navcheck.mjs), and that nobody starts on land, a reef or a shoal.

export const REGIONS = [
  { id: 'port', name: 'Port Royal' },
  { id: 'windward', name: 'The Windward Passage' },
  { id: 'main', name: 'The Spanish Main' },
  { id: 'golden', name: 'The Golden Isles' },
  { id: 'pirate', name: 'The Pirate Coast' },
  { id: 'campeche', name: 'The Bay of Campeche' },
  { id: 'armada', name: 'The Last Armada' },
];

// Where the player's fleet starts, by fleet position.
export const FLEET_SLOTS = [[0.5, 0.8], [0.24, 0.85], [0.76, 0.85], [0.37, 0.92], [0.63, 0.92]];

export const BATTLES = [
  {
    id: 'tutorial', region: 'port', roman: '0', year: 1655, name: 'Shakedown Cruise', foe: 'old hulk',
    tutorial: true, hat: 'cabin', reward: 60, wind: 0,
    brief: 'Learn to handle your sloop off Port Royal before the Spanish find you. Your bosun will talk you through it.',
    player: [{ type: 'sloop', name: 'Swift', x: 0.42, y: 0.82, h: -90 }],
    enemy: [{ type: 'brig', name: 'Old Hulk', x: 0.66, y: 0.3, h: 0, passive: true, hp: 36 }],
    // Harbour practice: you start inside Port Royal harbour behind the long Palisadoes spit, sail to the buoy
    // under the town, then round the point into open water where the hulk lies.
    islands: [{ x: 0.26, y: 0.62, r: 26, stretch: 8, angle: -6 }, { x: 0.8, y: 0.28, r: 30 }],
    coast: { side: 'bottom', depth: 0.06, rough: 0.25, seed: 4 },
    buoy: { x: 0.36, y: 0.71 },
    ai: { spread: 0.12, reloadMul: 1, dmgMul: 0, hpMul: 1 },
  },

  {
    id: 'tortuga', region: 'windward', roman: 'I', year: 1655, name: 'The Tortuga Narrows', foe: 'Spanish patrol',
    reward: 130, wind: 0,
    brief: 'Two Spanish brigs guard the narrows between Tortuga and Ile-à-Vache. Sink them both.',
    enemy: [
      { type: 'brig', name: 'Santa Rosa', x: 0.42, y: 0.2, h: 90 },
      { type: 'brig', name: 'El Halcón', x: 0.68, y: 0.16, h: 90 },
    ],
    // A strait with a set: the narrows between Tortuga's cape and Ile-à-Vache are short but the current runs
    // down them against you; the long way round outside the island is slack water.
    sea: 1.3,
    coast: { side: 'left', depth: 0.12, rough: 0.35, capes: [{ at: 0.46, width: 0.36, depth: 0.18 }] },
    islands: [{ x: 0.66, y: 0.44, r: 40, stretch: 4.5, angle: 92 }, { x: 0.86, y: 0.82, r: 24 }],
    currents: [{ x: 0.5, y: 0.45, r: 120, stretch: 2.6, angle: 92, speed: 16, dir: 92 }],
    ai: { spread: 0.14, reloadMul: 1.25, dmgMul: 0.85, hpMul: 2.5 },
  },
  {
    id: 'cayman', region: 'windward', roman: 'II', year: 1656, name: 'Cayman Shoals', foe: 'brig squadron',
    reward: 150, wind: -30,
    brief: 'Three brigs lurk among the Cayman shoals. Brigs and frigates run aground in the pale water, but a sloop sails right over. Use the shoals to split them up.',
    enemy: [
      { type: 'brig', name: 'San Pablo', x: 0.2, y: 0.16, h: 90 },
      { type: 'brig', name: 'La Paloma', x: 0.5, y: 0.1, h: 90 },
      { type: 'brig', name: 'San Telmo', x: 0.8, y: 0.16, h: 90 },
    ],
    // A sandbank maze: three rows of banks with their gaps staggered, so the deep water winds like a snake for brigs
    // and frigates, while a sloop runs straight up over the sand and comes out behind them.
    sea: 1.4,
    islands: [{ x: 0.5, y: 0.31, r: 30, stretch: 1.4, angle: 10 }, { x: 0.91, y: 0.3, r: 26 }, { x: 0.12, y: 0.52, r: 26 }],
    shoals: [
      { x: 0.22, y: 0.3, r: 48, stretch: 4, angle: 4 }, { x: 0.72, y: 0.51, r: 48, stretch: 4.4, angle: -4 },
      { x: 0.5, y: 0.7, r: 46, stretch: 3.4, angle: 0 }, { x: 0.94, y: 0.52, r: 30, stretch: 1.4, angle: 90 },
    ],
    ai: { spread: 0.13, reloadMul: 1.15, dmgMul: 0.72, hpMul: 1.8 },
  },
  {
    id: 'rojo', region: 'windward', roman: 'III', year: 1656, name: 'La Bruja', foe: 'Capitán Rojo',
    goal: 'boss', hat: 'rojo', reward: 220, wind: 20,
    brief: 'Capitán Rojo’s galleon La Bruja carries bow chasers, so don’t linger in front of her. Sink her and his red tricorne is yours.',
    enemy: [
      { type: 'galleon', name: 'La Bruja', x: 0.78, y: 0.4, h: 90, hp: 350, chasers: 2, reloadMul: 0.9,
        boss: { captain: 'Capitán Rojo', title: 'La Bruja', hat: 'rojo' } },
      { type: 'brig', name: 'El Lobo', x: 0.24, y: 0.18, h: 90 },
    ],
    // The volcano's lee: La Bruja lies in the calm water downwind of a smoking island. Go in after her and you lose
    // the wind under her chasers; work round to windward and make her come out. Rocks guard the volcano's west.
    sea: 1.2,
    fleetAt: { slots: [[0.3, 0.82], [0.16, 0.86], [0.46, 0.88], [0.24, 0.93], [0.38, 0.94]], h: -70 },
    islands: [{ x: 0.42, y: 0.4, r: 82 }, { x: 0.82, y: 0.74, r: 34 }],
    reefs: [{ x: 0.13, y: 0.42, r: 12, stretch: 4, angle: 80 }, { x: 0.3, y: 0.6, r: 11, stretch: 2.5, angle: 20 }],
    ai: { spread: 0.12, reloadMul: 1.1, dmgMul: 0.7, hpMul: 1.6 },
  },

  {
    id: 'sanlucas', region: 'main', roman: 'IV', year: 1657, name: 'Fort San Lucas', foe: 'fort garrison',
    goal: 'capture', reward: 240, wind: 0,
    brief: 'A stone fort guards the anchorage. Pound it silent, then stop a ship beside it and land your marines.',
    enemy: [
      { type: 'brig', name: 'San Lucas', x: 0.3, y: 0.2, h: 90 },
      { type: 'brig', name: 'Santa Clara', x: 0.7, y: 0.2, h: 90 },
    ],
    // A river mouth: the fort stands on an islet in the estuary, sandbars either side of it, and the river runs out
    // past it. Anchor beside the fort and the stream swings you; small ships can cut over the bars.
    sea: 1.3,
    coast: { side: 'top', depth: 0.3, rough: 0.3, seed: 2, coves: [{ at: 0.5, width: 0.8, depth: 0.2 }] },
    islands: [{ x: 0.5, y: 0.38, r: 46 }, { x: 0.14, y: 0.74, r: 26 }, { x: 0.84, y: 0.66, r: 28 }],
    shoals: [{ x: 0.13, y: 0.38, r: 38, stretch: 1.8, angle: 20 }, { x: 0.87, y: 0.38, r: 38, stretch: 1.8, angle: -20 }],
    currents: [{ x: 0.5, y: 0.3, r: 80, stretch: 3, angle: 90, speed: 10 }],
    forts: [{ island: 0, name: 'Fort San Lucas', hp: 380, guns: 2, need: 10 }],
    ai: { spread: 0.12, reloadMul: 1.1, dmgMul: 1.0, hpMul: 2.1 },
  },
  {
    id: 'silver', region: 'main', roman: 'V', year: 1657, name: 'The Silver Fleet', foe: 'treasure convoy',
    reward: 260, wind: -90,
    brief: 'Two treasure galleons and an escort run north up the coast with the wind behind them. You lie in wait off their flank: strike before they turn on you.',
    fleetAt: 'left',
    enemy: [
      { type: 'galleon', name: 'Nuestra Señora', x: 0.68, y: 0.56, h: -90 },
      { type: 'galleon', name: 'San José', x: 0.7, y: 0.76, h: -90 },
      { type: 'brig', name: 'La Golondrina', x: 0.66, y: 0.36, h: -90 },
    ],
    // The inside passage: a reef line runs parallel to the coast and the convoy rides the coastal current up behind
    // it. Cut through a gap in the reef to get at them, or let them come out at its end.
    sea: 1.35,
    coast: { side: 'right', depth: 0.14, rough: 0.35, coves: [{ at: 0.25, width: 0.2, depth: 0.06 }], capes: [{ at: 0.9, width: 0.2, depth: 0.08 }] },
    reefs: [
      { x: 0.55, y: 0.27, r: 12, stretch: 6, angle: 94 }, { x: 0.53, y: 0.52, r: 12, stretch: 6.5, angle: 88 },
      { x: 0.56, y: 0.79, r: 12, stretch: 5, angle: 96 },
    ],
    islands: [{ x: 0.2, y: 0.18, r: 32 }, { x: 0.26, y: 0.86, r: 28, stretch: 1.8, angle: 20 }],
    currents: [{ x: 0.7, y: 0.52, r: 70, stretch: 6, angle: -90, speed: 12 }],
    ai: { spread: 0.13, reloadMul: 1.15, dmgMul: 0.76, hpMul: 1.3 },
  },
  {
    id: 'comodoro', region: 'main', roman: 'VI', year: 1658, name: 'San Cristóbal', foe: 'El Comodoro',
    goal: 'boss', hat: 'comodoro', reward: 320, wind: 0,
    brief: 'El Comodoro keeps his flagship between two forts. Take the forts first, or dash in and sink him.',
    enemy: [
      { type: 'galleon', name: 'San Cristóbal', x: 0.5, y: 0.12, h: 90, hp: 455, chasers: 1,
        boss: { captain: 'El Comodoro', title: 'San Cristóbal', hat: 'comodoro' } },
      { type: 'brig', name: 'El Alcón', x: 0.3, y: 0.2, h: 90 },
      { type: 'brig', name: 'La Garza', x: 0.7, y: 0.2, h: 90 },
    ],
    // The gate: two fort islands, a reef and a shoal flat wall off the anchorage. Run the gate between the forts
    // under both their guns, slip a small ship over the flat on the left, or swing wide round the right under
    // only one fort's guns.
    sea: 1.3,
    islands: [{ x: 0.29, y: 0.4, r: 42 }, { x: 0.65, y: 0.4, r: 42 }, { x: 0.47, y: 0.66, r: 26 }],
    reefs: [{ x: 0.16, y: 0.39, r: 12, stretch: 4, angle: 0 }],
    shoals: [{ x: 0.06, y: 0.4, r: 50, stretch: 1.5, angle: 90 }],
    forts: [
      { island: 0, name: 'Fort Santa Fe', hp: 110, guns: 2, need: 10 },
      { island: 1, name: 'Fort Santa Inés', hp: 110, guns: 2, need: 10 },
    ],
    ai: { spread: 0.12, reloadMul: 1.05, dmgMul: 0.78, hpMul: 1.3 },
  },

  {
    id: 'cartagena', region: 'golden', roman: 'VII', year: 1658, name: 'Cartagena Approaches', foe: 'harbour squadron',
    goal: 'capture', reward: 340, wind: 30,
    brief: 'Capture the harbour fort while a galleon and two brigs try to drive you off. It needs 15 marines.',
    enemy: [
      { type: 'galleon', name: 'San Martín', x: 0.5, y: 0.17, h: 0 },
      { type: 'brig', name: 'El Rayo', x: 0.3, y: 0.2, h: 0 },
      { type: 'brig', name: 'La Centella', x: 0.7, y: 0.22, h: 180 },
    ],
    // A harbour assault: the bay is closed by Tierra Bomba, the Bocagrande sands (sloops only) and a log boom across
    // Boca Chica under Fort San Felipe. The squadron waits behind the boom; silence the fort and it comes down and
    // they come out, or shoot the boom through and go in after them (and the town).
    sea: 1.3,
    coast: { side: 'top', depth: 0.32, rough: 0.25, seed: 5, coves: [{ at: 0.48, width: 0.74, depth: 0.22 }] },
    islands: [{ x: 0.82, y: 0.36, r: 46 }, { x: 0.32, y: 0.35, r: 34, stretch: 4.2, angle: 4 }, { x: 0.2, y: 0.66, r: 28 }, { x: 0.68, y: 0.7, r: 22 }],
    shoals: [{ x: 0.09, y: 0.33, r: 44, stretch: 1.3, angle: 90 }],
    booms: [{ from: [0.455, 0.352], to: [0.79, 0.36], hp: 70, fort: 0, name: 'the Boca Chica boom' }],
    forts: [{ island: 0, name: 'Fort San Felipe', hp: 400, guns: 3, need: 15 }],
    ai: { spread: 0.09, reloadMul: 1, dmgMul: 0.85, hpMul: 1.6 },
  },
  {
    id: 'santamarta', region: 'golden', roman: 'VIII', year: 1659, name: 'Twin Towers of Santa Marta', foe: 'coastal batteries',
    goal: 'capture', reward: 380, wind: 180,
    brief: 'Two forts cover each other’s approaches, with a galleon and two brigs on guard. Take both.',
    enemy: [
      { type: 'galleon', name: 'Santiago', x: 0.4, y: 0.33, h: 90 },
      { type: 'brig', name: 'El Trueno', x: 0.32, y: 0.42, h: 90 },
      { type: 'brig', name: 'La Tormenta', x: 0.66, y: 0.3, h: 90 },
    ],
    // An atoll lagoon: a ring of reef with a gap at each end and a tower on the islet beside each gap. Force the
    // near gap under the South Tower, or sail round the ring to the far one under the North Tower; inside, the
    // lagoon lies calm under the smoking islet.
    sea: 1.35,
    islands: [{ x: 0.488, y: 0.2, r: 44 }, { x: 0.453, y: 0.538, r: 44 }, { x: 0.58, y: 0.38, r: 30 }],
    reefs: [
      { x: 0.172, y: 0.378, r: 13, stretch: 8, angle: -93 }, { x: 0.209, y: 0.294, r: 13, stretch: 8, angle: -64 },
      { x: 0.328, y: 0.231, r: 13, stretch: 8, angle: -33 }, { x: 0.82, y: 0.33, r: 13, stretch: 7.55, angle: 77 },
      { x: 0.821, y: 0.409, r: 13, stretch: 7.42, angle: 103 }, { x: 0.747, y: 0.479, r: 13, stretch: 7.39, angle: 130 },
      { x: 0.614, y: 0.525, r: 13, stretch: 7.32, angle: 158 },
    ],
    forts: [
      { island: 0, name: 'North Tower', hp: 180, guns: 3, need: 10 },
      { island: 1, name: 'South Tower', hp: 180, guns: 3, need: 10 },
    ],
    ai: { spread: 0.09, reloadMul: 1, dmgMul: 1.0, hpMul: 1.5 },
  },
  {
    id: 'oro', region: 'golden', roman: 'IX', year: 1659, name: 'Santísima Trinidad', foe: 'Almirante de Oro',
    goal: 'boss', hat: 'oro', reward: 500, wind: 0,
    brief: 'The Almirante’s man-o’-war lays sea mines in her wake and carries bow chasers. Beat her and Spain’s Caribbean squadron is broken.',
    enemy: [
      { type: 'manowar', name: 'Santísima Trinidad', x: 0.5, y: 0.1, h: 90, hp: 450, chasers: 2, abilities: { mineLayer: { every: 7 } },
        boss: { captain: 'Almirante de Oro', title: 'Santísima Trinidad', hat: 'oro' } },
      { type: 'galleon', name: 'San Lorenzo', x: 0.2, y: 0.12, h: 90 },
      { type: 'galleon', name: 'San Nicolás', x: 0.8, y: 0.12, h: 90 },
    ],
    // An archipelago maze: three rows of golden isles with their channels staggered, and a mine-layer who strews
    // mines in them behind her. Every turn is a choice of channel; the big island's peak steals the wind from
    // the middle one.
    sea: 1.45,
    islands: [
      { x: 0.3, y: 0.42, r: 66 }, { x: 0.72, y: 0.43, r: 50, stretch: 1.8, angle: -20 }, { x: 0.5, y: 0.63, r: 60, stretch: 1.6, angle: 0 },
      { x: 0.12, y: 0.63, r: 50 }, { x: 0.88, y: 0.64, r: 50 }, { x: 0.55, y: 0.24, r: 44, stretch: 2, angle: 10 },
      { x: 0.13, y: 0.24, r: 40 }, { x: 0.9, y: 0.25, r: 36 },
    ],
    ai: { spread: 0.11, reloadMul: 1.1, dmgMul: 0.9, hpMul: 1 },
  },

  // ---------- The Pirate Coast ----------
  {
    id: 'cove', region: 'pirate', roman: 'X', year: 1660, name: 'Smugglers’ Cove', foe: 'pirate schooners',
    faction: 'pirate', reward: 420, wind: 45,
    brief: 'With Spain beaten, the Brethren of the Coast come out of hiding. Four fast schooners hunt from a cove behind a line of reefs, and more may lurk behind them. Their shallow hulls slip over the sandbar at its mouth; yours may not.',
    enemy: [
      { type: 'schooner', name: 'Sea Wolf', x: 0.38, y: 0.25, h: 90 },
      { type: 'schooner', name: 'Ravenous', x: 0.47, y: 0.19, h: 90 },
      { type: 'schooner', name: 'Jolly Meg', x: 0.57, y: 0.18, h: 90 },
      { type: 'schooner', name: 'Gallows', x: 0.65, y: 0.24, h: 90 },
    ],
    // A cove with a tidal bar: at half tide only the schooners cross the sandbar across most of its mouth; big ships
    // must find the deep gut on the right, past the reef. At 70 seconds the tide makes and covers the bar, and
    // the whole cove lies open to anyone.
    sea: 1.3,
    coast: { side: 'top', depth: 0.3, rough: 0.25, coves: [{ at: 0.5, width: 0.66, depth: 0.24 }] },
    reefs: [{ x: 0.22, y: 0.38, r: 12, stretch: 4, angle: 30 }, { x: 0.86, y: 0.45, r: 12, stretch: 3.4, angle: -60 }, { x: 0.5, y: 0.6, r: 16 }],
    shoals: [{ x: 0.42, y: 0.33, r: 40, stretch: 3, angle: 0, tidal: true }],
    tide: { level: 0.5, turns: [{ at: 70, to: 1, secs: 14 }] },
    islands: [{ x: 0.22, y: 0.62, r: 24 }, { x: 0.78, y: 0.68, r: 22, stretch: 1.6, angle: 60 }],
    events: [
      { enemiesLeft: 2, banner: ['Ambush from the reefs!', 'Two more schooners slip out of hiding'],
        spawn: [{ type: 'schooner', name: 'Cutlass', x: 0.06, y: 0.5, h: 0 }, { type: 'schooner', name: 'Barracuda', x: 0.94, y: 0.56, h: 180 }] },
      { enemiesLeft: 1, banner: ['The Black Dog!', 'The smugglers’ brig joins the hunt'],
        spawn: [{ type: 'brig', name: 'Black Dog', x: 0.5, y: 0.17, h: 90 }] },
    ],
    ai: { spread: 0.1, reloadMul: 1.0, dmgMul: 1.52, hpMul: 2.75 },
  },
  {
    id: 'wreck', region: 'pirate', roman: 'XI', year: 1660, name: 'The Treasure Wreck', foe: 'pirate salvors',
    faction: 'pirate', reward: 460, wind: -20,
    brief: 'A treasure galleon broke up on the shoals and her chests are floating free, most of them close to the pirates. Haul them aboard before the Spanish salvage fleet comes over the horizon, and sink any salvor that beats you to one.',
    goals: [{ kind: 'treasure', need: 6, chests: [
      { x: 0.5, y: 0.15 }, { x: 0.14, y: 0.22 }, { x: 0.86, y: 0.2 }, { x: 0.33, y: 0.29 },
      { x: 0.66, y: 0.3 }, { x: 0.22, y: 0.56 }, { x: 0.78, y: 0.55 },
    ] }, { kind: 'timer', secs: 50 }],
    enemy: [
      { type: 'schooner', name: 'Magpie', x: 0.3, y: 0.12, h: 90 },
      { type: 'schooner', name: 'Cutthroat', x: 0.7, y: 0.12, h: 90 },
      { type: 'schooner', name: 'Jackdaw', x: 0.14, y: 0.1, h: 90 },
      { type: 'schooner', name: 'Kittiwake', x: 0.86, y: 0.1, h: 90 },
      { type: 'brig', name: 'Revenge', x: 0.5, y: 0.06, h: 90 },
    ],
    events: [
      { at: 25, banner: ['More salvors!', 'The Queen Anne comes for her share'],
        spawn: [{ type: 'brig', name: 'Queen Anne', x: 0.82, y: 0.06, h: 90 }, { type: 'schooner', name: 'Gannet', x: 0.18, y: 0.06, h: 90 }] },
      { at: 43, banner: ['Spanish topsails on the horizon!', 'Haul up the last chests, quickly'] },
    ],
    // A wreck field: the galleon's bones lie on a reef in the middle with her chests strewn round it, a pale bank
    // that only the salvors' schooners (and your sloops) cross, and a set running across the field that carries
    // you off a chest if you don't allow for it.
    sea: 1.2,
    reefs: [{ x: 0.5, y: 0.44, r: 14, stretch: 3, angle: 10 }, { x: 0.15, y: 0.42, r: 10, stretch: 1.6, angle: -30 }, { x: 0.85, y: 0.4, r: 10, stretch: 1.6, angle: 40 }],
    shoals: [{ x: 0.5, y: 0.3, r: 44, stretch: 2.2, angle: 0 }],
    islands: [{ x: 0.5, y: 0.72, r: 24 }, { x: 0.9, y: 0.68, r: 22 }],
    currents: [{ x: 0.5, y: 0.45, r: 100, stretch: 4.5, angle: 0, speed: 9 }],
    ai: { spread: 0.1, reloadMul: 1.0, dmgMul: 1.0, hpMul: 2.4 },
  },
  {
    id: 'kate', region: 'pirate', roman: 'XII', year: 1661, name: 'Black Wyvern', foe: 'Calico Kate',
    faction: 'pirate', goal: 'boss', hat: 'kate', reward: 560, wind: 90,
    brief: 'Calico Kate, queen of the Brethren, sends burning fireships ahead of her frigate. Sink the fireships before they reach you, then sink her. Hurt her and she will call for help.',
    enemy: [
      { type: 'frigate', name: 'Black Wyvern', x: 0.5, y: 0.08, h: 90, hp: 930, chasers: 2, abilities: { launcher: { type: 'fireship', every: 13 } },
        boss: { captain: 'Calico Kate', title: 'Black Wyvern', hat: 'kate' } },
      { type: 'schooner', name: 'Viper', x: 0.25, y: 0.14, h: 90 },
      { type: 'schooner', name: 'Adder', x: 0.75, y: 0.14, h: 90 },
      { type: 'fireship', name: 'Hellfire', x: 0.42, y: 0.24, h: 90 },
      { type: 'fireship', name: 'Brimstone', x: 0.58, y: 0.24, h: 90 },
    ],
    events: [
      { bossHp: 0.5, banner: ['Kate fires a signal gun!', 'The Brethren come to her aid'],
        spawn: [{ type: 'schooner', name: 'Barracuda', x: 0.12, y: 0.1, h: 90 }, { type: 'schooner', name: 'Moray', x: 0.88, y: 0.1, h: 90 },
          { type: 'fireship', name: 'Inferno', x: 0.5, y: 0.04, h: 90 }] },
    ],
    // Fireship alley: two long islands make a funnel from Kate's anchorage down to you, with the wind and the
    // current running down it. Meet the fireships in the alley's mouth, or slip up a side channel and come at her
    // from the flank while they burn past.
    sea: 1.45,
    islands: [
      { x: 0.31, y: 0.44, r: 46, stretch: 3, angle: 92 }, { x: 0.69, y: 0.46, r: 46, stretch: 3.2, angle: 88 },
      { x: 0.86, y: 0.68, r: 24 },
    ],
    currents: [{ x: 0.5, y: 0.45, r: 90, stretch: 3, angle: 90, speed: 12 }],
    ai: { spread: 0.1, reloadMul: 1.0, dmgMul: 1.3, hpMul: 1.8 },
  },

  // ---------- The Bay of Campeche ----------
  {
    id: 'convoy', region: 'campeche', roman: 'XIII', year: 1662, name: 'Convoy to Jamaica', foe: 'Spanish raiders',
    reward: 500, wind: -90,
    fleetAt: { slots: [[0.5, 0.6], [0.3, 0.64], [0.7, 0.64], [0.4, 0.84], [0.6, 0.84]], h: -90 },
    brief: 'Three merchantmen carry the colony’s silver, with marines aboard to beat off boarders. They sail for the top of the chart on their own; keep the raiders’ guns off them. Two must get through.',
    goals: [{ kind: 'escort', need: 2, ships: [
      { type: 'merchant', name: 'Good Hope', x: 0.38, y: 0.72, h: -90, up: { marines: 2 } },
      { type: 'merchant', name: 'Prosperous', x: 0.5, y: 0.7, h: -90, up: { marines: 2 } },
      { type: 'merchant', name: 'Bountiful', x: 0.62, y: 0.72, h: -90, up: { marines: 2 } },
    ] }],
    enemy: [
      { type: 'xebec', name: 'El Cuchillo', x: 0.13, y: 0.4, h: 0 },
      { type: 'xebec', name: 'La Daga', x: 0.87, y: 0.34, h: 180 },
      { type: 'brig', name: 'San Bruno', x: 0.3, y: 0.14, h: 90 },
      { type: 'galleon', name: 'San Felipe', x: 0.5, y: 0.08, h: 90 },
      { type: 'brig', name: 'San Diego', x: 0.7, y: 0.14, h: 90 },
    ],
    events: [
      { at: 15, wind: 180, banner: ['The wind backs into the east!', 'On the beam now: the convoy picks up speed'] },
      { at: 20, banner: ['Oars astern!', 'Two xebecs row up behind the convoy'],
        spawn: [{ type: 'xebec', name: 'El Puñal', x: 0.2, y: 0.94, h: -45 }, { type: 'xebec', name: 'La Navaja', x: 0.8, y: 0.94, h: -135 }] },
    ],
    // The long passage between two shores: a barrier cay splits the road north into two lanes, and xebecs lie in
    // creeks on either hand. Keep the convoy together in one lane or cover both.
    sea: 1.3,
    coast: [
      { side: 'left', depth: 0.08, rough: 0.4, seed: 21, coves: [{ at: 0.4, width: 0.14, depth: 0.05 }] },
      { side: 'right', depth: 0.08, rough: 0.4, seed: 23, coves: [{ at: 0.34, width: 0.14, depth: 0.05 }] },
    ],
    islands: [{ x: 0.5, y: 0.4, r: 34, stretch: 3.6, angle: 90 }, { x: 0.26, y: 0.2, r: 24 }],
    shoals: [{ x: 0.8, y: 0.26, r: 34, stretch: 1.6, angle: 30 }],
    ai: { spread: 0.1, reloadMul: 1.0, dmgMul: 1.49, hpMul: 1.5 },
  },
  {
    id: 'siege', region: 'campeche', roman: 'XIV', year: 1662, name: 'The Siege of Port Royal', foe: 'Spanish siege fleet',
    goals: [{ kind: 'hold', secs: 150 }], reward: 540, wind: 90,
    brief: 'Spain wants Port Royal back. Hold the harbour fort for two and a half minutes. Bomb ketches will shell it from long range; hunt them down.',
    forts: [{ island: 0, name: 'Fort Charles', hp: 200, guns: 3, need: 10, team: 'player' }],
    enemy: [
      { type: 'brig', name: 'San Lucas', x: 0.3, y: 0.12, h: 90 },
      { type: 'bomb', name: 'El Trueno', x: 0.62, y: 0.1, h: 90 },
      { type: 'brig', name: 'Santa Ana', x: 0.75, y: 0.16, h: 90 },
    ],
    events: [
      { at: 40, banner: ['Enemy reinforcements!', 'A xebec and a bomb ketch'], spawn: [{ type: 'xebec', name: 'La Lanza', x: 0.2, y: 0.08, h: 90 }, { type: 'bomb', name: 'El Rayo', x: 0.8, y: 0.08, h: 90 }] },
      { at: 80, banner: ['Enemy reinforcements!', 'A galleon leads them in'], spawn: [{ type: 'galleon', name: 'San Antonio', x: 0.5, y: 0.06, h: 90 }, { type: 'xebec', name: 'La Espada', x: 0.3, y: 0.08, h: 90 }] },
      { at: 115, banner: ['The final assault!', 'The siege fleet throws in everything'],
        spawn: [{ type: 'galleon', name: 'Santa Catalina', x: 0.75, y: 0.06, h: 90 }, { type: 'bomb', name: 'El Volcán', x: 0.15, y: 0.08, h: 90 }, { type: 'xebec', name: 'La Flecha', x: 0.9, y: 0.22, h: 180 }] },
      { at: 130, banner: ['Relief from Kingston!', 'The brig Gloucester beats into the harbour'],
        spawn: [{ type: 'brig', name: 'Gloucester', team: 'player', x: 0.86, y: 0.84, h: -90 }] },
    ],
    // Port Royal again, under siege: Fort Charles at the tip of the Palisadoes, your fleet in the harbour behind it
    // with the yard to patch you up. The spit shelters you from the sea side; sortie through the mouth to hunt the
    // bomb ketches, then run back in to the carpenters.
    sea: 1.2,
    fleetAt: { slots: [[0.42, 0.74], [0.22, 0.76], [0.62, 0.76], [0.32, 0.84], [0.52, 0.84]], h: 0 },
    coast: { side: 'bottom', depth: 0.08, rough: 0.3, seed: 12 },
    islands: [{ x: 0.62, y: 0.6, r: 50 }, { x: 0.22, y: 0.62, r: 30, stretch: 7, angle: -4 }, { x: 0.8, y: 0.3, r: 26 }],
    ai: { spread: 0.1, reloadMul: 1.0, dmgMul: 1.46, hpMul: 1.7 },
  },
  {
    id: 'hierro', region: 'campeche', roman: 'XV', year: 1663, name: 'The Iron Marquis', foe: 'Marqués de Hierro',
    goal: 'boss', hat: 'morion', reward: 640, wind: 0,
    brief: 'The Marqués de Hierro has fitted his galleon with mortars. Watch for the red rings: that is where his shells will land. Close in fast.',
    enemy: [
      { type: 'galleon', name: 'San Jerónimo', x: 0.5, y: 0.12, h: 90, hp: 680, chasers: 1,
        abilities: { mortar: { range: 480, reload: 5, dmg: 26, radius: 40 } },
        boss: { captain: 'Marqués de Hierro', title: 'San Jerónimo', hat: 'morion' } },
      { type: 'bomb', name: 'El Martillo', x: 0.25, y: 0.14, h: 90 },
      { type: 'bomb', name: 'El Yunque', x: 0.75, y: 0.14, h: 90 },
      { type: 'brig', name: 'San Pedro', x: 0.5, y: 0.24, h: 90 },
    ],
    events: [
      { bossHp: 0.5, banner: ['The Marqués signals the shore!', 'Two galleys row out to his aid'],
        spawn: [{ type: 'xebec', name: 'La Tenaza', x: 0.06, y: 0.3, h: 0 }, { type: 'xebec', name: 'El Clavo', x: 0.94, y: 0.3, h: 180 }] },
      { bossHp: 0.2, banner: ['The San Jerónimo is holed!', 'She is settling by the bow: one more broadside'] },
    ],
    // Tidal flats: the Marqués shells you from a deep pool beyond a wide bank of sand. At half tide big ships must
    // go the long way round its eastern end under his mortars (small ones cross); at 45 seconds the flood covers
    // the flats and anyone can charge straight across. Run the gauntlet now, or wait for the water.
    sea: 1.3,
    islands: [{ x: 0.14, y: 0.74, r: 34 }, { x: 0.87, y: 0.68, r: 32 }, { x: 0.5, y: 0.66, r: 26 }],
    shoals: [
      { x: 0.2, y: 0.45, r: 70, stretch: 2.6, angle: 6, tidal: true },
      { x: 0.52, y: 0.43, r: 70, stretch: 2.6, angle: -6, tidal: true },
    ],
    tide: { level: 0.5, turns: [{ at: 45, to: 0.9, secs: 14 }] },
    ai: { spread: 0.1, reloadMul: 1.05, dmgMul: 1.05, hpMul: 1.4 },
  },

  // ---------- The Last Armada ----------
  {
    id: 'fog', region: 'armada', roman: 'XVI', year: 1664, name: 'Fog off the Mosquito Coast', foe: 'xebec squadron',
    fog: 210, reward: 600, wind: 30,
    brief: 'A thick fog hides a squadron of oared xebecs off the Mosquito Coast, and you have sailed into the middle of the bay. Your lookouts see only so far; keep the fleet together and watch every side, astern too.',
    fleetAt: 'center',
    enemy: [
      { type: 'xebec', name: 'La Sombra', x: 0.2, y: 0.14, h: 90 },
      { type: 'xebec', name: 'La Niebla', x: 0.6, y: 0.12, h: 90 },
      { type: 'brig', name: 'San Cristóbal', x: 0.32, y: 0.24, h: 90 },
      { type: 'xebec', name: 'El Fantasma', x: 0.66, y: 0.8, h: -90 },
      { type: 'brig', name: 'San Rafael', x: 0.16, y: 0.76, h: -90 },
    ],
    // A cape in fog: you start mid-bay with xebecs ahead and astern. The lighthouse on Bluefields Point lifts the
    // fog for a wide circle round it, but the cape has a reef off it and the current sets round the point onto it.
    sea: 1.45,
    coast: { side: 'right', depth: 0.16, rough: 0.45, coves: [{ at: 0.24, width: 0.16, depth: 0.08 }], capes: [{ at: 0.7, width: 0.2, depth: 0.17 }] },
    islands: [{ x: 0.22, y: 0.32, r: 30 }, { x: 0.46, y: 0.26, r: 26, stretch: 1.7, angle: 15 }, { x: 0.2, y: 0.62, r: 26, stretch: 1.5, angle: 80 }],
    reefs: [{ x: 0.56, y: 0.76, r: 12, stretch: 3.5, angle: 60 }],
    currents: [{ x: 0.62, y: 0.7, r: 80, stretch: 2.6, angle: 100, speed: 11 }],
    events: [
      { at: 20, fog: 150, banner: ['The fog thickens', 'Keep the fleet close together'] },
      { enemiesLeft: 2, banner: ['Oars astern!', 'More xebecs creep up behind you in the fog'],
        spawn: [{ type: 'xebec', name: 'El Espectro', x: 0.12, y: 0.95, h: -90 }, { type: 'xebec', name: 'La Bruma', x: 0.62, y: 0.95, h: -90 },
          { type: 'brig', name: 'San Gabriel', x: 0.5, y: 0.06, h: 90 }] },
      { enemiesLeft: 1, fog: 0, banner: ['The fog lifts!', 'Finish them in the sunshine'] },
    ],
    ai: { spread: 0.1, reloadMul: 1.0, dmgMul: 1.2, hpMul: 1.95 },
  },
  {
    id: 'blockade', region: 'armada', roman: 'XVII', year: 1664, name: 'Run the Blockade', foe: 'blockade line',
    goals: [{ kind: 'breakthrough' }], reward: 640, wind: -90,
    brief: 'The Armada has strung a line across the strait. Get your flagship through and out at the top of the chart. The rest of the fleet can cover her.',
    enemy: [
      { type: 'galleon', name: 'San Martín', x: 0.4, y: 0.27, h: 0 },
      { type: 'galleon', name: 'San Lorenzo', x: 0.62, y: 0.22, h: 180 },
      { type: 'xebec', name: 'La Saeta', x: 0.3, y: 0.46, h: 0 },
      { type: 'xebec', name: 'El Venablo', x: 0.7, y: 0.46, h: 180 },
      { type: 'bomb', name: 'El Bronce', x: 0.5, y: 0.1, h: 90 },
    ],
    // A long thin strait: shores on both hands pinch to the narrows under El Morro at the top, reef lines cross it
    // with three gaps to run, and a current sets up the middle toward the exit. Ride the stream through the
    // middle gap past the galleons, or hug a shore through a side gap out of their reach.
    sea: 1.4,
    fleetAt: { slots: [[0.5, 0.82], [0.38, 0.86], [0.62, 0.86], [0.44, 0.93], [0.56, 0.93]], h: -90 },
    coast: [
      { side: 'left', depth: 0.13, rough: 0.35, seed: 3, capes: [{ at: 0.14, width: 0.2, depth: 0.08 }] },
      { side: 'right', depth: 0.13, rough: 0.35, seed: 11, capes: [{ at: 0.16, width: 0.2, depth: 0.08 }] },
    ],
    reefs: [{ x: 0.3, y: 0.36, r: 11, stretch: 3, angle: -8 }, { x: 0.7, y: 0.34, r: 11, stretch: 3, angle: 12 }],
    islands: [{ x: 0.5, y: 0.5, r: 26, stretch: 1.6, angle: 0 }],
    currents: [{ x: 0.5, y: 0.5, r: 100, stretch: 6, angle: -90, speed: 13 }],
    events: [
      { at: 18, wind: 0, banner: ['The wind veers!', 'A fresh breeze on the beam: crack on for the gap'] },
      { at: 30, banner: ['A galley from the shore!', 'La Jabalina rows out to close the gap'],
        spawn: [{ type: 'xebec', name: 'La Jabalina', x: 0.3, y: 0.1, h: 45 }] },
    ],
    ai: { spread: 0.1, reloadMul: 1.05, dmgMul: 1.24, hpMul: 1.6 },
  },
  {
    id: 'armada', region: 'armada', roman: 'XVIII', year: 1665, name: 'La Gran Armada', foe: 'Capitán General',
    goal: 'boss', hat: 'armada', reward: 900, wind: 0,
    brief: 'The Capitán General leads the last great Armada in the Real Felipe: mines astern, mortars aboard, a harbour fort behind her and galleys in reserve. Win this and the sea is England’s.',
    enemy: [
      { type: 'manowar', name: 'Real Felipe', x: 0.5, y: 0.3, h: 90, hp: 780, chasers: 2,
        abilities: { mineLayer: { every: 9 }, mortar: { range: 460, reload: 7, dmg: 24, radius: 38 } },
        boss: { captain: 'Capitán General', title: 'Real Felipe', hat: 'armada' } },
      { type: 'galleon', name: 'San Felipe', x: 0.28, y: 0.34, h: 90 },
      { type: 'galleon', name: 'Santiago', x: 0.72, y: 0.32, h: 90 },
    ],
    events: [
      { bossHp: 0.65, banner: ['The Armada’s galleys!', 'La Furia and El Diablo row out of the harbour'],
        spawn: [{ type: 'xebec', name: 'La Furia', x: 0.43, y: 0.22, h: 90 }, { type: 'xebec', name: 'El Diablo', x: 0.58, y: 0.22, h: 90 }] },
      { bossHp: 0.3, banner: ['The Real Felipe is burning!', 'One more broadside and the Armada is finished'] },
    ],
    // Havana's mouth, the finale: the Armada lies in the roads before the harbour under El Morro's guns, the Gulf
    // Stream runs along the shore, and a reef shelf guards the cape. Your fleet comes in split, one squadron each
    // side of the shoal bank: join up, or strike from both flanks at once.
    sea: 1.5,
    fleetAt: { slots: [[0.22, 0.8], [0.78, 0.8], [0.14, 0.88], [0.86, 0.88], [0.3, 0.9]], h: -90 },
    coast: { side: 'top', depth: 0.18, rough: 0.3, seed: 6, coves: [{ at: 0.5, width: 0.3, depth: 0.12 }], capes: [{ at: 0.86, width: 0.2, depth: 0.06 }] },
    islands: [{ x: 0.3, y: 0.18, r: 42 }, { x: 0.7, y: 0.17, r: 30 }, { x: 0.12, y: 0.56, r: 30 }],
    reefs: [{ x: 0.88, y: 0.36, r: 12, stretch: 3.6, angle: 70 }],
    shoals: [{ x: 0.5, y: 0.7, r: 60, stretch: 2, angle: 90 }],
    currents: [{ x: 0.5, y: 0.25, r: 80, stretch: 6, angle: 0, speed: 10 }],
    forts: [{ island: 0, name: 'Castillo del Morro', hp: 260, guns: 3, need: 15 }],
    ai: { spread: 0.09, reloadMul: 1.0, dmgMul: 0.85, hpMul: 1.45 },
  },
];

export const battleIndex = (id) => BATTLES.findIndex((b) => b.id === id);
