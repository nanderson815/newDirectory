// The campaign. Positions are fractions of a portrait map (x across, y down; the player starts at the bottom),
// headings are degrees (0 = east, -90 = north) and wind is the direction it blows toward.
// Difficulty climbs through `ai`: spread is enemy aim scatter (lower = sharper), reloadMul < 1 reloads faster,
// dmgMul is shot weight and hpMul pads enemy hulls.
//
// goal: 'sink' (default) sinks every enemy ship, 'capture' takes every fort, 'boss' sinks the boss.
// Boss ships carry boss: { captain, title, hat } and win you that captain's hat.

export const REGIONS = [
  { id: 'port', name: 'Port Royal' },
  { id: 'windward', name: 'The Windward Passage' },
  { id: 'main', name: 'The Spanish Main' },
  { id: 'golden', name: 'The Golden Isles' },
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
    reward: 120, wind: 0,
    brief: 'Two Spanish brigs guard the narrows. Sink them both.',
    enemy: [
      { type: 'brig', name: 'Santa Rosa', x: 0.32, y: 0.2, h: 90 },
      { type: 'brig', name: 'El Halcón', x: 0.68, y: 0.2, h: 90 },
    ],
    islands: [{ x: 0.27, y: 0.48, r: 42 }, { x: 0.76, y: 0.42, r: 38 }, { x: 0.6, y: 0.64, r: 24 }],
    ai: { spread: 0.14, reloadMul: 1.25, dmgMul: 0.9, hpMul: 1 },
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
    ai: { spread: 0.13, reloadMul: 1.15, dmgMul: 1, hpMul: 1 },
  },
  {
    id: 'rojo', region: 'windward', roman: 'III', year: 1656, name: 'La Bruja', foe: 'Capitán Rojo',
    goal: 'boss', hat: 'rojo', reward: 220, wind: 20,
    brief: 'Capitán Rojo’s galleon La Bruja carries bow chasers, so don’t linger in front of her. Sink her and his red tricorne is yours.',
    enemy: [
      { type: 'galleon', name: 'La Bruja', x: 0.5, y: 0.16, h: 90, hp: 230, chasers: 2, reloadMul: 0.9,
        boss: { captain: 'Capitán Rojo', title: 'La Bruja', hat: 'rojo' } },
      { type: 'brig', name: 'El Lobo', x: 0.25, y: 0.22, h: 90 },
    ],
    islands: [{ x: 0.28, y: 0.5, r: 40 }, { x: 0.74, y: 0.52, r: 40 }],
    ai: { spread: 0.12, reloadMul: 1.1, dmgMul: 1, hpMul: 1 },
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
    forts: [{ island: 0, name: 'Fort San Lucas', hp: 120, guns: 2, need: 10 }],
    ai: { spread: 0.12, reloadMul: 1.1, dmgMul: 1, hpMul: 1 },
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
    ai: { spread: 0.11, reloadMul: 1.05, dmgMul: 1.05, hpMul: 1.05 },
  },
  {
    id: 'comodoro', region: 'main', roman: 'VI', year: 1658, name: 'San Cristóbal', foe: 'El Comodoro',
    goal: 'boss', hat: 'comodoro', reward: 320, wind: 0,
    brief: 'El Comodoro keeps his flagship between two forts. Take the forts first, or dash in and sink him.',
    enemy: [
      { type: 'galleon', name: 'San Cristóbal', x: 0.5, y: 0.12, h: 90, hp: 280, chasers: 1,
        boss: { captain: 'El Comodoro', title: 'San Cristóbal', hat: 'comodoro' } },
      { type: 'brig', name: 'El Alcón', x: 0.3, y: 0.24, h: 90 },
      { type: 'brig', name: 'La Garza', x: 0.7, y: 0.24, h: 90 },
    ],
    islands: [{ x: 0.27, y: 0.36, r: 44 }, { x: 0.73, y: 0.36, r: 44 }, { x: 0.5, y: 0.6, r: 26 }],
    forts: [
      { island: 0, name: 'Fort Santa Fe', hp: 110, guns: 2, need: 10 },
      { island: 1, name: 'Fort Santa Inés', hp: 110, guns: 2, need: 10 },
    ],
    ai: { spread: 0.1, reloadMul: 1.05, dmgMul: 1.1, hpMul: 1.05 },
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
    forts: [{ island: 0, name: 'Fort San Felipe', hp: 150, guns: 3, need: 15 }],
    ai: { spread: 0.1, reloadMul: 1, dmgMul: 1.1, hpMul: 1.1 },
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
      { island: 0, name: 'North Tower', hp: 140, guns: 3, need: 10 },
      { island: 1, name: 'South Tower', hp: 140, guns: 3, need: 10 },
    ],
    ai: { spread: 0.09, reloadMul: 1, dmgMul: 1.15, hpMul: 1.1 },
  },
  {
    id: 'oro', region: 'golden', roman: 'IX', year: 1659, name: 'Santísima Trinidad', foe: 'Almirante de Oro',
    goal: 'boss', hat: 'oro', reward: 500, wind: 0,
    brief: 'The Almirante’s man-o’-war lays sea mines in her wake and carries bow chasers. Beat her and the Caribbean is yours.',
    enemy: [
      { type: 'manowar', name: 'Santísima Trinidad', x: 0.5, y: 0.12, h: 90, hp: 420, chasers: 2, mineEvery: 7,
        boss: { captain: 'Almirante de Oro', title: 'Santísima Trinidad', hat: 'oro' } },
      { type: 'galleon', name: 'San Lorenzo', x: 0.24, y: 0.18, h: 90 },
      { type: 'galleon', name: 'San Nicolás', x: 0.76, y: 0.18, h: 90 },
    ],
    islands: [{ x: 0.27, y: 0.48, r: 36 }, { x: 0.73, y: 0.48, r: 36 }, { x: 0.5, y: 0.64, r: 24 }],
    ai: { spread: 0.08, reloadMul: 0.95, dmgMul: 1.2, hpMul: 1.15 },
  },
];

export const battleIndex = (id) => BATTLES.findIndex((b) => b.id === id);
