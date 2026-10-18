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
    brief: 'Two Spanish brigs guard the narrows. Sink them both.',
    enemy: [
      { type: 'brig', name: 'Santa Rosa', x: 0.32, y: 0.2, h: 90 },
      { type: 'brig', name: 'El Halcón', x: 0.68, y: 0.2, h: 90 },
    ],
    islands: [{ x: 0.27, y: 0.48, r: 42 }, { x: 0.76, y: 0.42, r: 38 }, { x: 0.6, y: 0.64, r: 24 }],
    ai: { spread: 0.14, reloadMul: 1.25, dmgMul: 0.6, hpMul: 2.2 },
  },
  {
    id: 'cayman', region: 'windward', roman: 'II', year: 1656, name: 'Cayman Shoals', foe: 'brig squadron',
    reward: 150, wind: -30,
    brief: 'Three brigs lurk among the shoals. Use the islands to split them up.',
    enemy: [
      { type: 'brig', name: 'San Pablo', x: 0.2, y: 0.18, h: 90 },
      { type: 'brig', name: 'La Paloma', x: 0.5, y: 0.12, h: 90 },
      { type: 'brig', name: 'San Telmo', x: 0.8, y: 0.18, h: 90 },
    ],
    islands: [{ x: 0.3, y: 0.4, r: 32 }, { x: 0.72, y: 0.36, r: 30 }, { x: 0.5, y: 0.55, r: 36 }, { x: 0.2, y: 0.66, r: 22 }],
    ai: { spread: 0.13, reloadMul: 1.15, dmgMul: 0.52, hpMul: 1.7 },
  },
  {
    id: 'rojo', region: 'windward', roman: 'III', year: 1656, name: 'La Bruja', foe: 'Capitán Rojo',
    goal: 'boss', hat: 'rojo', reward: 220, wind: 20,
    brief: 'Capitán Rojo’s galleon La Bruja carries bow chasers, so don’t linger in front of her. Sink her and his red tricorne is yours.',
    enemy: [
      { type: 'galleon', name: 'La Bruja', x: 0.5, y: 0.16, h: 90, hp: 340, chasers: 2, reloadMul: 0.9,
        boss: { captain: 'Capitán Rojo', title: 'La Bruja', hat: 'rojo' } },
      { type: 'brig', name: 'El Lobo', x: 0.25, y: 0.22, h: 90 },
    ],
    islands: [{ x: 0.28, y: 0.5, r: 40 }, { x: 0.74, y: 0.52, r: 40 }],
    ai: { spread: 0.12, reloadMul: 1.1, dmgMul: 0.63, hpMul: 1.6 },
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
    forts: [{ island: 0, name: 'Fort San Lucas', hp: 470, guns: 2, need: 10 }],
    ai: { spread: 0.12, reloadMul: 1.1, dmgMul: 1.0, hpMul: 2.4 },
  },
  {
    id: 'silver', region: 'main', roman: 'V', year: 1657, name: 'The Silver Fleet', foe: 'treasure convoy',
    reward: 260, wind: -90,
    brief: 'Two treasure galleons and an escort run north with the wind behind them.',
    enemy: [
      { type: 'galleon', name: 'Nuestra Señora', x: 0.35, y: 0.15, h: 90 },
      { type: 'galleon', name: 'San José', x: 0.65, y: 0.15, h: 90 },
      { type: 'brig', name: 'La Golondrina', x: 0.5, y: 0.25, h: 90 },
    ],
    islands: [{ x: 0.25, y: 0.42, r: 34 }, { x: 0.76, y: 0.55, r: 36 }],
    ai: { spread: 0.13, reloadMul: 1.15, dmgMul: 0.7, hpMul: 1.3 },
  },
  {
    id: 'comodoro', region: 'main', roman: 'VI', year: 1658, name: 'San Cristóbal', foe: 'El Comodoro',
    goal: 'boss', hat: 'comodoro', reward: 320, wind: 0,
    brief: 'El Comodoro keeps his flagship between two forts. Take the forts first, or dash in and sink him.',
    enemy: [
      { type: 'galleon', name: 'San Cristóbal', x: 0.5, y: 0.12, h: 90, hp: 400, chasers: 1,
        boss: { captain: 'El Comodoro', title: 'San Cristóbal', hat: 'comodoro' } },
      { type: 'brig', name: 'El Alcón', x: 0.3, y: 0.24, h: 90 },
      { type: 'brig', name: 'La Garza', x: 0.7, y: 0.24, h: 90 },
    ],
    islands: [{ x: 0.27, y: 0.36, r: 44 }, { x: 0.73, y: 0.36, r: 44 }, { x: 0.5, y: 0.6, r: 26 }],
    forts: [
      { island: 0, name: 'Fort Santa Fe', hp: 110, guns: 2, need: 10 },
      { island: 1, name: 'Fort Santa Inés', hp: 110, guns: 2, need: 10 },
    ],
    ai: { spread: 0.12, reloadMul: 1.05, dmgMul: 0.68, hpMul: 1.3 },
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
    ai: { spread: 0.09, reloadMul: 1, dmgMul: 1.25, hpMul: 2.2 },
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
      { island: 0, name: 'North Tower', hp: 170, guns: 3, need: 10 },
      { island: 1, name: 'South Tower', hp: 170, guns: 3, need: 10 },
    ],
    ai: { spread: 0.09, reloadMul: 1, dmgMul: 0.88, hpMul: 1.4 },
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
    ai: { spread: 0.11, reloadMul: 1.1, dmgMul: 0.875, hpMul: 1 },
  },

  // ---------- The Pirate Coast ----------
  {
    id: 'cove', region: 'pirate', roman: 'X', year: 1660, name: 'Smugglers’ Cove', foe: 'pirate schooners',
    faction: 'pirate', reward: 420, wind: 45,
    brief: 'With Spain beaten, the Brethren of the Coast come out of hiding. Four fast schooners hunt in a cove of reefs.',
    enemy: [
      { type: 'schooner', name: 'Sea Wolf', x: 0.24, y: 0.16, h: 90 },
      { type: 'schooner', name: 'Ravenous', x: 0.42, y: 0.12, h: 90 },
      { type: 'schooner', name: 'Jolly Meg', x: 0.6, y: 0.12, h: 90 },
      { type: 'schooner', name: 'Gallows', x: 0.78, y: 0.16, h: 90 },
    ],
    islands: [{ x: 0.3, y: 0.38, r: 30 }, { x: 0.7, y: 0.34, r: 28 }, { x: 0.5, y: 0.52, r: 34 }, { x: 0.25, y: 0.64, r: 22 }, { x: 0.77, y: 0.62, r: 22 }],
    ai: { spread: 0.11, reloadMul: 1.05, dmgMul: 0.85, hpMul: 1.4 },
  },
  {
    id: 'wreck', region: 'pirate', roman: 'XI', year: 1660, name: 'The Treasure Wreck', foe: 'pirate salvors',
    faction: 'pirate', reward: 460, wind: -20,
    brief: 'A treasure galleon broke up on the shoals and her chests are floating free. Sail over them to haul them aboard before the pirates do.',
    goals: [{ kind: 'treasure', need: 4, chests: [{ x: 0.2, y: 0.36 }, { x: 0.5, y: 0.3 }, { x: 0.82, y: 0.4 }, { x: 0.36, y: 0.55 }, { x: 0.66, y: 0.58 }, { x: 0.5, y: 0.45 }] }],
    enemy: [
      { type: 'schooner', name: 'Magpie', x: 0.3, y: 0.12, h: 90 },
      { type: 'schooner', name: 'Cutthroat', x: 0.7, y: 0.12, h: 90 },
      { type: 'brig', name: 'Revenge', x: 0.5, y: 0.08, h: 90 },
    ],
    islands: [{ x: 0.33, y: 0.44, r: 26 }, { x: 0.67, y: 0.46, r: 26 }, { x: 0.5, y: 0.66, r: 24 }],
    ai: { spread: 0.11, reloadMul: 1.05, dmgMul: 0.85, hpMul: 1.3 },
  },
  {
    id: 'kate', region: 'pirate', roman: 'XII', year: 1661, name: 'Black Wyvern', foe: 'Calico Kate',
    faction: 'pirate', goal: 'boss', hat: 'kate', reward: 560, wind: 90,
    brief: 'Calico Kate, queen of the Brethren, sends burning fireships ahead of her frigate. Sink the fireships before they reach you, then sink her.',
    enemy: [
      { type: 'frigate', name: 'Black Wyvern', x: 0.5, y: 0.1, h: 90, hp: 460, chasers: 2, abilities: { launcher: { type: 'fireship', every: 16 } },
        boss: { captain: 'Calico Kate', title: 'Black Wyvern', hat: 'kate' } },
      { type: 'schooner', name: 'Viper', x: 0.25, y: 0.16, h: 90 },
      { type: 'schooner', name: 'Adder', x: 0.75, y: 0.16, h: 90 },
      { type: 'fireship', name: 'Hellfire', x: 0.38, y: 0.22, h: 90 },
      { type: 'fireship', name: 'Brimstone', x: 0.62, y: 0.22, h: 90 },
    ],
    islands: [{ x: 0.27, y: 0.46, r: 34 }, { x: 0.73, y: 0.46, r: 34 }, { x: 0.5, y: 0.62, r: 22 }],
    ai: { spread: 0.1, reloadMul: 1.05, dmgMul: 0.85, hpMul: 1.3 },
  },

  // ---------- The Bay of Campeche ----------
  {
    id: 'convoy', region: 'campeche', roman: 'XIII', year: 1662, name: 'Convoy to Jamaica', foe: 'Spanish raiders',
    reward: 500, wind: -90,
    brief: 'Two merchantmen carry the colony’s silver. They sail for the top of the chart on their own; keep the raiders off them. At least one must get through.',
    goals: [{ kind: 'escort', need: 1, ships: [
      { type: 'merchant', name: 'Good Hope', x: 0.4, y: 0.7, h: -90 },
      { type: 'merchant', name: 'Prosperous', x: 0.6, y: 0.73, h: -90 },
    ] }],
    enemy: [
      { type: 'xebec', name: 'El Cuchillo', x: 0.12, y: 0.4, h: 0 },
      { type: 'xebec', name: 'La Daga', x: 0.88, y: 0.32, h: 180 },
      { type: 'brig', name: 'San Bruno', x: 0.3, y: 0.12, h: 90 },
      { type: 'brig', name: 'San Diego', x: 0.7, y: 0.12, h: 90 },
    ],
    islands: [{ x: 0.3, y: 0.5, r: 30 }, { x: 0.72, y: 0.6, r: 28 }, { x: 0.5, y: 0.3, r: 26 }],
    ai: { spread: 0.1, reloadMul: 1.05, dmgMul: 0.85, hpMul: 1.4 },
  },
  {
    id: 'siege', region: 'campeche', roman: 'XIV', year: 1662, name: 'The Siege of Port Royal', foe: 'Spanish siege fleet',
    goals: [{ kind: 'hold', secs: 150 }], reward: 540, wind: 90,
    brief: 'Spain wants Port Royal back. Hold the harbour fort for two and a half minutes. Bomb ketches will shell it from long range; hunt them down.',
    forts: [{ island: 0, name: 'Fort Charles', hp: 260, guns: 3, need: 10, team: 'player' }],
    enemy: [
      { type: 'brig', name: 'San Lucas', x: 0.3, y: 0.12, h: 90 },
      { type: 'bomb', name: 'El Trueno', x: 0.62, y: 0.1, h: 90 },
      { type: 'brig', name: 'Santa Ana', x: 0.75, y: 0.16, h: 90 },
    ],
    events: [
      { at: 40, banner: ['Enemy reinforcements!', 'A xebec and a bomb ketch'], spawn: [{ type: 'xebec', name: 'La Lanza', x: 0.2, y: 0.08, h: 90 }, { type: 'bomb', name: 'El Rayo', x: 0.8, y: 0.08, h: 90 }] },
      { at: 85, banner: ['Enemy reinforcements!', 'A galleon leads them in'], spawn: [{ type: 'galleon', name: 'San Antonio', x: 0.5, y: 0.06, h: 90 }, { type: 'xebec', name: 'La Espada', x: 0.3, y: 0.08, h: 90 }] },
    ],
    islands: [{ x: 0.5, y: 0.66, r: 50 }, { x: 0.22, y: 0.42, r: 26 }, { x: 0.78, y: 0.4, r: 26 }],
    ai: { spread: 0.1, reloadMul: 1.05, dmgMul: 0.85, hpMul: 1.4 },
  },
  {
    id: 'hierro', region: 'campeche', roman: 'XV', year: 1663, name: 'The Iron Marquis', foe: 'Marqués de Hierro',
    goal: 'boss', hat: 'morion', reward: 640, wind: 0,
    brief: 'The Marqués de Hierro has fitted his galleon with mortars. Watch for the red rings: that is where his shells will land. Close in fast.',
    enemy: [
      { type: 'galleon', name: 'San Jerónimo', x: 0.5, y: 0.08, h: 90, hp: 520, chasers: 1,
        abilities: { mortar: { range: 480, reload: 5, dmg: 26, radius: 40 } },
        boss: { captain: 'Marqués de Hierro', title: 'San Jerónimo', hat: 'morion' } },
      { type: 'bomb', name: 'El Martillo', x: 0.25, y: 0.12, h: 90 },
      { type: 'bomb', name: 'El Yunque', x: 0.75, y: 0.12, h: 90 },
      { type: 'brig', name: 'San Pedro', x: 0.38, y: 0.2, h: 90 },
      { type: 'brig', name: 'San Pablo', x: 0.62, y: 0.2, h: 90 },
    ],
    islands: [{ x: 0.3, y: 0.42, r: 32 }, { x: 0.7, y: 0.42, r: 32 }, { x: 0.5, y: 0.58, r: 26 }],
    ai: { spread: 0.1, reloadMul: 1.05, dmgMul: 0.85, hpMul: 1.3 },
  },

  // ---------- The Last Armada ----------
  {
    id: 'fog', region: 'armada', roman: 'XVI', year: 1664, name: 'Fog off the Mosquito Coast', foe: 'xebec squadron',
    fog: 230, reward: 600, wind: 30,
    brief: 'A thick fog hides a squadron of oared xebecs. Your lookouts see only so far; keep the fleet together and watch the edges.',
    enemy: [
      { type: 'xebec', name: 'La Sombra', x: 0.2, y: 0.12, h: 90 },
      { type: 'xebec', name: 'El Fantasma', x: 0.5, y: 0.08, h: 90 },
      { type: 'xebec', name: 'La Niebla', x: 0.8, y: 0.12, h: 90 },
      { type: 'brig', name: 'San Cristóbal', x: 0.35, y: 0.2, h: 90 },
      { type: 'brig', name: 'San Rafael', x: 0.65, y: 0.2, h: 90 },
    ],
    islands: [{ x: 0.25, y: 0.4, r: 30 }, { x: 0.72, y: 0.36, r: 30 }, { x: 0.48, y: 0.54, r: 28 }, { x: 0.22, y: 0.66, r: 22 }, { x: 0.78, y: 0.64, r: 22 }],
    ai: { spread: 0.1, reloadMul: 1.05, dmgMul: 0.85, hpMul: 1.4 },
  },
  {
    id: 'blockade', region: 'armada', roman: 'XVII', year: 1664, name: 'Run the Blockade', foe: 'blockade line',
    goals: [{ kind: 'breakthrough' }], reward: 640, wind: -90,
    brief: 'The Armada has strung a line across the strait. Get your flagship through and out at the top of the chart. The rest of the fleet can cover her.',
    enemy: [
      { type: 'galleon', name: 'San Martín', x: 0.3, y: 0.24, h: 0 },
      { type: 'galleon', name: 'San Lorenzo', x: 0.7, y: 0.24, h: 180 },
      { type: 'xebec', name: 'La Saeta', x: 0.15, y: 0.4, h: 0 },
      { type: 'xebec', name: 'El Venablo', x: 0.85, y: 0.4, h: 180 },
      { type: 'bomb', name: 'El Bronce', x: 0.5, y: 0.1, h: 90 },
    ],
    islands: [{ x: 0.12, y: 0.24, r: 28 }, { x: 0.88, y: 0.24, r: 28 }, { x: 0.5, y: 0.42, r: 30 }],
    ai: { spread: 0.1, reloadMul: 1.05, dmgMul: 0.85, hpMul: 1.4 },
  },
  {
    id: 'armada', region: 'armada', roman: 'XVIII', year: 1665, name: 'La Gran Armada', foe: 'Capitán General',
    goal: 'boss', hat: 'armada', reward: 900, wind: 0,
    brief: 'The Capitán General leads the last great Armada in the Real Felipe: mines astern, mortars aboard, a harbour fort behind her. Win this and the sea is England’s.',
    enemy: [
      { type: 'manowar', name: 'Real Felipe', x: 0.5, y: 0.08, h: 90, hp: 760, chasers: 2,
        abilities: { mineLayer: { every: 9 }, mortar: { range: 460, reload: 7, dmg: 24, radius: 38 } },
        boss: { captain: 'Capitán General', title: 'Real Felipe', hat: 'armada' } },
      { type: 'galleon', name: 'San Felipe', x: 0.26, y: 0.14, h: 90 },
      { type: 'galleon', name: 'Santiago', x: 0.74, y: 0.14, h: 90 },
      { type: 'xebec', name: 'La Furia', x: 0.12, y: 0.26, h: 90 },
      { type: 'xebec', name: 'El Diablo', x: 0.88, y: 0.26, h: 90 },
    ],
    islands: [{ x: 0.5, y: 0.24, r: 40 }, { x: 0.25, y: 0.5, r: 30 }, { x: 0.75, y: 0.5, r: 30 }],
    forts: [{ island: 0, name: 'Castillo del Morro', hp: 260, guns: 3, need: 15 }],
    ai: { spread: 0.09, reloadMul: 1.0, dmgMul: 0.9, hpMul: 1.4 },
  },
];

export const battleIndex = (id) => BATTLES.findIndex((b) => b.id === id);
