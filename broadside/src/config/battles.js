// The campaign. Positions are fractions of a portrait map (x across, y down; the player starts at the bottom),
// headings are degrees (0 = east, -90 = north) and wind is the direction it blows toward.
// Difficulty climbs through `ai`: spread is enemy aim scatter (lower = sharper), reloadMul < 1 reloads faster,
// dmgMul is shot weight and hpMul pads enemy hulls.
//
// Everything here is built from primitives; see docs/EXTENDING.md.
// goals: what wins the battle, a list of { kind, ...params } from src/sim/goals/ (all must be met), or the
//   shorthand goal: 'boss'. Without either the goal is 'sink'. Kinds: sink, boss, capture, treasure, escort,
//   hold, breakthrough, timer, protect, hunt, reach, survive.
// Ships: { type (src/config/ships.js), name, x, y, h, hp?, chasers?, passive?, boss?, abilities?, loadout? }. Boss ships
//   carry boss: { captain, title, hat } and win you that captain's hat. abilities: { id: config } from
//   src/sim/abilities/ (mortar, fireship, launcher, mineLayer, oars, repair, ram, flee, rally), merged over the
//   ship type's own.
// forts: [{ island, name, hp, guns, need, team? }] (team: 'player' for your own forts).
// events: scripted moments from src/sim/events.js, e.g. { at: 40, banner: [...], spawn: [...ships] } or
//   { shipSunk: 'San Juan', retreat: 'La Paga', say: ['La Paga', '¡Huid!'] }.
// faction: 'pirate' gives the enemy black sails and pirate flags. fog: how far (map units) your lookouts see.
// Geography (src/sim/terrain.js): islands may be long ({ x, y, r, stretch, angle }); shoals and reefs take the
//   same shape; coast: { side, depth, coves?, capes? } (or a list) lays a shore along an edge; fleetAt moves
//   your fleet's start ('top', 'left', 'right', 'center' or { slots, h }).
// sea: optional size multiplier (linear) for the battle's sea on top of the camera's SEA_SCALE, e.g. 1.2 for a
//   wide-open chase or 0.85 for a tight harbour. Positions are fractions, so the layout scales with it.

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
    player: [{ type: 'sloop', name: 'Swift', x: 0.5, y: 0.8, h: -90 }],
    enemy: [{ type: 'brig', name: 'Old Hulk', x: 0.62, y: 0.3, h: 0, passive: true, hp: 36 }],
    islands: [{ x: 0.22, y: 0.42, r: 38 }, { x: 0.78, y: 0.6, r: 30 }],
    buoy: { x: 0.3, y: 0.62 },
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
    // The narrows: Tortuga's shore pushes a cape out from the left; a long island lies across from it.
    coast: { side: 'left', depth: 0.13, rough: 0.35, capes: [{ at: 0.46, width: 0.34, depth: 0.25 }] },
    islands: [{ x: 0.8, y: 0.44, r: 30, stretch: 2.3, angle: 95 }, { x: 0.62, y: 0.7, r: 22 }],
    ai: { spread: 0.14, reloadMul: 1.25, dmgMul: 0.85, hpMul: 2.5 },
  },
  {
    id: 'cayman', region: 'windward', roman: 'II', year: 1656, name: 'Cayman Shoals', foe: 'brig squadron',
    reward: 150, wind: -30,
    brief: 'Three brigs lurk among the Cayman shoals. Brigs and frigates run aground in the pale water, but a sloop sails right over. Use the shoals to split them up.',
    enemy: [
      { type: 'brig', name: 'San Pablo', x: 0.2, y: 0.18, h: 90 },
      { type: 'brig', name: 'La Paloma', x: 0.5, y: 0.12, h: 90 },
      { type: 'brig', name: 'San Telmo', x: 0.8, y: 0.18, h: 90 },
    ],
    islands: [{ x: 0.28, y: 0.4, r: 28, stretch: 1.5, angle: 35 }, { x: 0.74, y: 0.34, r: 26 }],
    shoals: [
      { x: 0.5, y: 0.55, r: 44, stretch: 2, angle: 8 }, { x: 0.18, y: 0.63, r: 32, stretch: 1.4, angle: 70 },
      { x: 0.8, y: 0.58, r: 30, stretch: 1.6, angle: 110 }, { x: 0.52, y: 0.3, r: 28, stretch: 1.3, angle: -20 },
    ],
    ai: { spread: 0.13, reloadMul: 1.15, dmgMul: 0.72, hpMul: 1.8 },
  },
  {
    id: 'rojo', region: 'windward', roman: 'III', year: 1656, name: 'La Bruja', foe: 'Capitán Rojo',
    goal: 'boss', hat: 'rojo', reward: 220, wind: 20,
    brief: 'Capitán Rojo’s galleon La Bruja carries bow chasers, so don’t linger in front of her. Sink her and his red tricorne is yours.',
    enemy: [
      { type: 'galleon', name: 'La Bruja', x: 0.5, y: 0.16, h: 90, hp: 350, chasers: 2, reloadMul: 0.9,
        boss: { captain: 'Capitán Rojo', title: 'La Bruja', hat: 'rojo' } },
      { type: 'brig', name: 'El Lobo', x: 0.25, y: 0.22, h: 90 },
    ],
    islands: [{ x: 0.28, y: 0.5, r: 40 }, { x: 0.74, y: 0.52, r: 40 }],
    ai: { spread: 0.12, reloadMul: 1.1, dmgMul: 0.7, hpMul: 1.6 },
  },

  {
    id: 'sanlucas', region: 'main', roman: 'IV', year: 1657, name: 'Fort San Lucas', foe: 'fort garrison',
    goal: 'capture', reward: 240, wind: 0,
    brief: 'A stone fort guards the anchorage. Pound it silent, then stop a ship beside it and land your marines.',
    enemy: [
      { type: 'brig', name: 'San Lucas', x: 0.3, y: 0.18, h: 90 },
      { type: 'brig', name: 'Santa Clara', x: 0.7, y: 0.18, h: 90 },
    ],
    islands: [{ x: 0.5, y: 0.38, r: 50 }, { x: 0.2, y: 0.62, r: 26 }, { x: 0.82, y: 0.6, r: 26 }],
    forts: [{ island: 0, name: 'Fort San Lucas', hp: 380, guns: 2, need: 10 }],
    ai: { spread: 0.12, reloadMul: 1.1, dmgMul: 1.0, hpMul: 2.1 },
  },
  {
    id: 'silver', region: 'main', roman: 'V', year: 1657, name: 'The Silver Fleet', foe: 'treasure convoy',
    reward: 260, wind: -90,
    brief: 'Two treasure galleons and an escort run north up the coast with the wind behind them. You lie in wait off their flank: strike before they turn on you.',
    fleetAt: 'left',
    enemy: [
      { type: 'galleon', name: 'Nuestra Señora', x: 0.62, y: 0.56, h: -90 },
      { type: 'galleon', name: 'San José', x: 0.68, y: 0.74, h: -90 },
      { type: 'brig', name: 'La Golondrina', x: 0.56, y: 0.38, h: -90 },
    ],
    coast: { side: 'right', depth: 0.15, rough: 0.4, coves: [{ at: 0.25, width: 0.2, depth: 0.07 }] },
    islands: [{ x: 0.22, y: 0.2, r: 30 }, { x: 0.3, y: 0.82, r: 28, stretch: 1.8, angle: 20 }],
    reefs: [{ x: 0.5, y: 0.14, r: 11, stretch: 3.5, angle: -15 }],
    ai: { spread: 0.13, reloadMul: 1.15, dmgMul: 0.76, hpMul: 1.3 },
  },
  {
    id: 'comodoro', region: 'main', roman: 'VI', year: 1658, name: 'San Cristóbal', foe: 'El Comodoro',
    goal: 'boss', hat: 'comodoro', reward: 320, wind: 0,
    brief: 'El Comodoro keeps his flagship between two forts. Take the forts first, or dash in and sink him.',
    enemy: [
      { type: 'galleon', name: 'San Cristóbal', x: 0.5, y: 0.12, h: 90, hp: 455, chasers: 1,
        boss: { captain: 'El Comodoro', title: 'San Cristóbal', hat: 'comodoro' } },
      { type: 'brig', name: 'El Alcón', x: 0.3, y: 0.24, h: 90 },
      { type: 'brig', name: 'La Garza', x: 0.7, y: 0.24, h: 90 },
    ],
    islands: [{ x: 0.27, y: 0.36, r: 44 }, { x: 0.73, y: 0.36, r: 44 }, { x: 0.5, y: 0.6, r: 26 }],
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
      { type: 'galleon', name: 'San Martín', x: 0.5, y: 0.12, h: 90 },
      { type: 'brig', name: 'El Rayo', x: 0.22, y: 0.2, h: 90 },
      { type: 'brig', name: 'La Centella', x: 0.78, y: 0.2, h: 90 },
    ],
    islands: [{ x: 0.6, y: 0.33, r: 48 }, { x: 0.27, y: 0.45, r: 28 }, { x: 0.72, y: 0.6, r: 24 }, { x: 0.36, y: 0.64, r: 22 }],
    forts: [{ island: 0, name: 'Fort San Felipe', hp: 400, guns: 3, need: 15 }],
    ai: { spread: 0.09, reloadMul: 1, dmgMul: 0.85, hpMul: 1.6 },
  },
  {
    id: 'santamarta', region: 'golden', roman: 'VIII', year: 1659, name: 'Twin Towers of Santa Marta', foe: 'coastal batteries',
    goal: 'capture', reward: 380, wind: 180,
    brief: 'Two forts cover each other’s approaches, with a galleon and two brigs on guard. Take both.',
    enemy: [
      { type: 'galleon', name: 'Santiago', x: 0.5, y: 0.13, h: 90 },
      { type: 'brig', name: 'El Trueno', x: 0.25, y: 0.18, h: 90 },
      { type: 'brig', name: 'La Tormenta', x: 0.75, y: 0.18, h: 90 },
    ],
    islands: [{ x: 0.31, y: 0.32, r: 46 }, { x: 0.69, y: 0.44, r: 46 }, { x: 0.5, y: 0.63, r: 24 }],
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
      { type: 'manowar', name: 'Santísima Trinidad', x: 0.5, y: 0.12, h: 90, hp: 450, chasers: 2, abilities: { mineLayer: { every: 7 } },
        boss: { captain: 'Almirante de Oro', title: 'Santísima Trinidad', hat: 'oro' } },
      { type: 'galleon', name: 'San Lorenzo', x: 0.24, y: 0.18, h: 90 },
      { type: 'galleon', name: 'San Nicolás', x: 0.76, y: 0.18, h: 90 },
    ],
    islands: [{ x: 0.27, y: 0.48, r: 36 }, { x: 0.73, y: 0.48, r: 36 }, { x: 0.5, y: 0.64, r: 24 }],
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
    coast: { side: 'top', depth: 0.34, rough: 0.25, coves: [{ at: 0.5, width: 0.6, depth: 0.27 }] },
    reefs: [{ x: 0.27, y: 0.4, r: 12, stretch: 4, angle: 25 }, { x: 0.74, y: 0.41, r: 12, stretch: 4, angle: -25 }, { x: 0.5, y: 0.6, r: 16 }],
    shoals: [{ x: 0.5, y: 0.37, r: 34, stretch: 1.6, angle: 0 }],
    islands: [{ x: 0.24, y: 0.62, r: 24 }, { x: 0.77, y: 0.64, r: 22, stretch: 1.6, angle: 60 }],
    events: [
      { enemiesLeft: 2, banner: ['Ambush from the reefs!', 'Two more schooners slip out of the cove'],
        spawn: [{ type: 'schooner', name: 'Cutlass', x: 0.07, y: 0.5, h: 0 }, { type: 'schooner', name: 'Barracuda', x: 0.93, y: 0.46, h: 180 }] },
      { enemiesLeft: 1, banner: ['The Black Dog!', 'The smugglers’ brig joins the hunt'],
        spawn: [{ type: 'brig', name: 'Black Dog', x: 0.5, y: 0.18, h: 90 }] },
    ],
    ai: { spread: 0.1, reloadMul: 1.0, dmgMul: 1.52, hpMul: 2.75 },
  },
  {
    id: 'wreck', region: 'pirate', roman: 'XI', year: 1660, name: 'The Treasure Wreck', foe: 'pirate salvors',
    faction: 'pirate', reward: 460, wind: -20,
    brief: 'A treasure galleon broke up on the shoals and her chests are floating free, most of them close to the pirates. Haul them aboard before the Spanish salvage fleet comes over the horizon, and sink any salvor that beats you to one.',
    goals: [{ kind: 'treasure', need: 6, chests: [
      { x: 0.5, y: 0.12 }, { x: 0.14, y: 0.2 }, { x: 0.86, y: 0.2 }, { x: 0.32, y: 0.27 },
      { x: 0.68, y: 0.29 }, { x: 0.22, y: 0.54 }, { x: 0.78, y: 0.55 },
    ] }, { kind: 'timer', secs: 46 }],
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
      { at: 40, banner: ['Spanish topsails on the horizon!', 'Haul up the last chests, quickly'] },
    ],
    islands: [{ x: 0.33, y: 0.44, r: 26 }, { x: 0.67, y: 0.46, r: 26 }, { x: 0.5, y: 0.66, r: 24 }],
    ai: { spread: 0.1, reloadMul: 1.0, dmgMul: 1.0, hpMul: 2.4 },
  },
  {
    id: 'kate', region: 'pirate', roman: 'XII', year: 1661, name: 'Black Wyvern', foe: 'Calico Kate',
    faction: 'pirate', goal: 'boss', hat: 'kate', reward: 560, wind: 90,
    brief: 'Calico Kate, queen of the Brethren, sends burning fireships ahead of her frigate. Sink the fireships before they reach you, then sink her. Hurt her and she will call for help. Her larboard guns are carronades: stand off, or keep to her starboard side.',
    enemy: [
      // Carronades to larboard (src/config/guns.js): she closes to smash with them, so keep off her left side.
      { type: 'frigate', name: 'Black Wyvern', x: 0.5, y: 0.1, h: 90, hp: 930, chasers: 2, reloadMul: 0.9, abilities: { launcher: { type: 'fireship', every: 13 } }, loadout: { port: 'carronade' },
        boss: { captain: 'Calico Kate', title: 'Black Wyvern', hat: 'kate' } },
      { type: 'schooner', name: 'Viper', x: 0.25, y: 0.16, h: 90 },
      { type: 'schooner', name: 'Adder', x: 0.75, y: 0.16, h: 90 },
      { type: 'fireship', name: 'Hellfire', x: 0.38, y: 0.22, h: 90 },
      { type: 'fireship', name: 'Brimstone', x: 0.62, y: 0.22, h: 90 },
    ],
    events: [
      { bossHp: 0.5, banner: ['Kate fires a signal gun!', 'The Brethren come to her aid'],
        spawn: [{ type: 'schooner', name: 'Barracuda', x: 0.1, y: 0.08, h: 90 }, { type: 'schooner', name: 'Moray', x: 0.9, y: 0.08, h: 90 },
          { type: 'fireship', name: 'Inferno', x: 0.5, y: 0.04, h: 90 }] },
    ],
    islands: [{ x: 0.27, y: 0.46, r: 34 }, { x: 0.73, y: 0.46, r: 34 }, { x: 0.5, y: 0.62, r: 22 }],
    ai: { spread: 0.1, reloadMul: 1.0, dmgMul: 1.3, hpMul: 1.8 },
  },

  // ---------- The Bay of Campeche ----------
  {
    id: 'convoy', region: 'campeche', roman: 'XIII', year: 1662, name: 'Convoy to Jamaica', foe: 'Spanish raiders',
    reward: 500, wind: -90,
    fleetAt: { slots: [[0.5, 0.6], [0.18, 0.66], [0.82, 0.66], [0.4, 0.82], [0.6, 0.82]], h: -90 },
    brief: 'Three merchantmen carry the colony’s silver, with marines aboard to beat off boarders. They sail for the top of the chart on their own; keep the raiders’ guns off them. Two must get through.',
    goals: [{ kind: 'escort', need: 2, ships: [
      { type: 'merchant', name: 'Good Hope', x: 0.3, y: 0.72, h: -90, up: { marines: 2 } },
      { type: 'merchant', name: 'Prosperous', x: 0.5, y: 0.7, h: -90, up: { marines: 2 } },
      { type: 'merchant', name: 'Bountiful', x: 0.7, y: 0.72, h: -90, up: { marines: 2 } },
    ] }],
    enemy: [
      { type: 'xebec', name: 'El Cuchillo', x: 0.1, y: 0.4, h: 0 },
      { type: 'xebec', name: 'La Daga', x: 0.9, y: 0.34, h: 180 },
      { type: 'brig', name: 'San Bruno', x: 0.28, y: 0.14, h: 90 },
      { type: 'galleon', name: 'San Felipe', x: 0.5, y: 0.08, h: 90 },
      { type: 'brig', name: 'San Diego', x: 0.72, y: 0.14, h: 90 },
    ],
    events: [
      { at: 15, wind: 180, banner: ['The wind backs into the east!', 'On the beam now: the convoy picks up speed'] },
      { at: 20, banner: ['Oars astern!', 'Two xebecs row up behind the convoy'],
        spawn: [{ type: 'xebec', name: 'El Puñal', x: 0.06, y: 0.94, h: -45 }, { type: 'xebec', name: 'La Navaja', x: 0.94, y: 0.94, h: -135 }] },
    ],
    islands: [{ x: 0.3, y: 0.5, r: 30 }, { x: 0.72, y: 0.6, r: 28 }, { x: 0.5, y: 0.3, r: 26 }],
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
        spawn: [{ type: 'galleon', name: 'Santa Catalina', x: 0.75, y: 0.05, h: 90 }, { type: 'bomb', name: 'El Volcán', x: 0.15, y: 0.06, h: 90 }, { type: 'xebec', name: 'La Flecha', x: 0.9, y: 0.2, h: 180 }] },
      { at: 130, banner: ['Relief from Kingston!', 'The brig Gloucester beats into the harbour'],
        spawn: [{ type: 'brig', name: 'Gloucester', team: 'player', x: 0.92, y: 0.95, h: -90 }] },
    ],
    islands: [{ x: 0.5, y: 0.66, r: 50 }, { x: 0.22, y: 0.42, r: 26 }, { x: 0.78, y: 0.4, r: 26 }],
    ai: { spread: 0.1, reloadMul: 1.0, dmgMul: 1.46, hpMul: 1.7 },
  },
  {
    id: 'hierro', region: 'campeche', roman: 'XV', year: 1663, name: 'The Iron Marquis', foe: 'Marqués de Hierro',
    goal: 'boss', hat: 'morion', reward: 640, wind: 0,
    brief: 'The Marqués de Hierro has fitted his galleon with mortars. Watch for the red rings: that is where his shells will land. Close in fast.',
    enemy: [
      { type: 'galleon', name: 'San Jerónimo', x: 0.5, y: 0.08, h: 90, hp: 680, chasers: 1,
        abilities: { mortar: { range: 480, reload: 5, dmg: 26, radius: 40 } },
        boss: { captain: 'Marqués de Hierro', title: 'San Jerónimo', hat: 'morion' } },
      { type: 'bomb', name: 'El Martillo', x: 0.25, y: 0.12, h: 90 },
      { type: 'bomb', name: 'El Yunque', x: 0.75, y: 0.12, h: 90 },
      { type: 'brig', name: 'San Pedro', x: 0.5, y: 0.2, h: 90 },
    ],
    events: [
      { bossHp: 0.5, banner: ['The Marqués signals the shore!', 'Two galleys row out to his aid'],
        spawn: [{ type: 'xebec', name: 'La Tenaza', x: 0.06, y: 0.3, h: 0 }, { type: 'xebec', name: 'El Clavo', x: 0.94, y: 0.3, h: 180 }] },
      { bossHp: 0.2, banner: ['The San Jerónimo is holed!', 'She is settling by the bow: one more broadside'] },
    ],
    islands: [{ x: 0.3, y: 0.42, r: 32 }, { x: 0.7, y: 0.42, r: 32 }, { x: 0.5, y: 0.58, r: 26 }],
    ai: { spread: 0.1, reloadMul: 1.05, dmgMul: 1.05, hpMul: 1.4 },
  },

  // ---------- The Last Armada ----------
  {
    id: 'fog', region: 'armada', roman: 'XVI', year: 1664, name: 'Fog off the Mosquito Coast', foe: 'xebec squadron',
    fog: 210, reward: 600, wind: 30,
    brief: 'A thick fog hides a squadron of oared xebecs off the Mosquito Coast, and you have sailed into the middle of the bay. Your lookouts see only so far; keep the fleet together and watch every side, astern too.',
    fleetAt: 'center',
    enemy: [
      { type: 'xebec', name: 'La Sombra', x: 0.2, y: 0.12, h: 90 },
      { type: 'xebec', name: 'El Fantasma', x: 0.5, y: 0.08, h: 90 },
      { type: 'xebec', name: 'La Niebla', x: 0.72, y: 0.14, h: 90 },
      { type: 'brig', name: 'San Cristóbal', x: 0.35, y: 0.2, h: 90 },
      { type: 'brig', name: 'San Rafael', x: 0.6, y: 0.2, h: 90 },
    ],
    coast: { side: 'right', depth: 0.14, rough: 0.45, coves: [{ at: 0.3, width: 0.16, depth: 0.08 }], capes: [{ at: 0.7, width: 0.22, depth: 0.1 }] },
    islands: [{ x: 0.22, y: 0.32, r: 28 }, { x: 0.58, y: 0.3, r: 26, stretch: 1.7, angle: 15 }, { x: 0.2, y: 0.74, r: 24, stretch: 1.5, angle: 80 }],
    reefs: [{ x: 0.45, y: 0.78, r: 12, stretch: 3, angle: 10 }],
    events: [
      { at: 20, fog: 150, banner: ['The fog thickens', 'Keep the fleet close together'] },
      { enemiesLeft: 2, banner: ['Oars astern!', 'More xebecs creep up behind you in the fog'],
        spawn: [{ type: 'xebec', name: 'El Espectro', x: 0.12, y: 0.95, h: -90 }, { type: 'xebec', name: 'La Bruma', x: 0.76, y: 0.95, h: -90 },
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
      { type: 'galleon', name: 'San Martín', x: 0.4, y: 0.25, h: 0 },
      { type: 'galleon', name: 'San Lorenzo', x: 0.62, y: 0.2, h: 180 },
      { type: 'xebec', name: 'La Saeta', x: 0.27, y: 0.44, h: 0 },
      { type: 'xebec', name: 'El Venablo', x: 0.73, y: 0.44, h: 180 },
      { type: 'bomb', name: 'El Bronce', x: 0.5, y: 0.1, h: 90 },
    ],
    // The strait: a shore on either hand, reef lines across it with three gaps to run. The fleet comes up it in
    // close order.
    fleetAt: { slots: [[0.5, 0.8], [0.34, 0.86], [0.66, 0.86], [0.42, 0.93], [0.58, 0.93]], h: -90 },
    coast: [{ side: 'left', depth: 0.16, rough: 0.4, seed: 3 }, { side: 'right', depth: 0.16, rough: 0.4, seed: 11 }],
    reefs: [{ x: 0.33, y: 0.33, r: 11, stretch: 3.2, angle: -8 }, { x: 0.67, y: 0.31, r: 11, stretch: 3.2, angle: 12 }],
    islands: [{ x: 0.5, y: 0.44, r: 28, stretch: 1.6, angle: 0 }],
    events: [
      { at: 18, wind: 0, banner: ['The wind veers!', 'A fresh breeze on the beam: crack on for the gap'] },
      { at: 30, banner: ['A galley from the shore!', 'La Jabalina rows out to close the gap'],
        spawn: [{ type: 'xebec', name: 'La Jabalina', x: 0.26, y: 0.08, h: 45 }] },
    ],
    ai: { spread: 0.1, reloadMul: 1.05, dmgMul: 1.24, hpMul: 1.6 },
  },
  {
    id: 'armada', region: 'armada', roman: 'XVIII', year: 1665, name: 'La Gran Armada', foe: 'Capitán General',
    goal: 'boss', hat: 'armada', reward: 900, wind: 0,
    brief: 'The Capitán General leads the last great Armada in the Real Felipe: mines astern, mortars aboard, a harbour fort behind her and galleys in reserve. Win this and the sea is England’s.',
    enemy: [
      // Spain's great ship (src/config/flagship.js): demi-cannon below, swivels above, a sea mortar forward.
      { type: 'greatship', name: 'Real Felipe', x: 0.5, y: 0.08, h: 90, hp: 780,
        loadout: { portLower: 'demicannon', starboardLower: 'demicannon', portUpper: 'swivel', starboardUpper: 'swivel', forecastle: 'mortar' },
        abilities: { mineLayer: { every: 9 } },
        boss: { captain: 'Capitán General', title: 'Real Felipe', hat: 'armada' } },
      { type: 'galleon', name: 'San Felipe', x: 0.26, y: 0.14, h: 90 },
      { type: 'galleon', name: 'Santiago', x: 0.74, y: 0.14, h: 90 },
    ],
    events: [
      { bossHp: 0.65, banner: ['The Armada’s galleys!', 'La Furia and El Diablo row into the fight'],
        spawn: [{ type: 'xebec', name: 'La Furia', x: 0.06, y: 0.3, h: 0 }, { type: 'xebec', name: 'El Diablo', x: 0.94, y: 0.3, h: 180 }] },
      { bossHp: 0.3, banner: ['The Real Felipe is burning!', 'One more broadside and the Armada is finished'] },
    ],
    islands: [{ x: 0.5, y: 0.24, r: 40 }, { x: 0.25, y: 0.5, r: 30 }, { x: 0.75, y: 0.5, r: 30 }],
    forts: [{ island: 0, name: 'Castillo del Morro', hp: 260, guns: 3, need: 15 }],
    ai: { spread: 0.09, reloadMul: 1.0, dmgMul: 0.85, hpMul: 1.45 },
  },
];

export const battleIndex = (id) => BATTLES.findIndex((b) => b.id === id);
