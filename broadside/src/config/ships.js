import { MED_TYPES } from './ships-med.js';

// Ship classes. L = length, B = beam (world units); speed in units/sec, turn in rad/sec, reload in sec.
// marines = troops a ship can put ashore to take a fort.
export const TYPES = {
  sloop:   { label: 'Sloop',      L: 60,  B: 22, hp: 70,  guns: 3, reload: 2.4, speed: 62, turn: 1.35, range: 235, masts: 2, marines: 10 },
  brig:    { label: 'Brig',       L: 66,  B: 24, hp: 85,  guns: 3, reload: 2.6, speed: 57, turn: 1.15, range: 240, masts: 2, marines: 15 },
  frigate: { label: 'Frigate',    L: 84,  B: 30, hp: 130, guns: 5, reload: 3.0, speed: 50, turn: 0.85, range: 255, masts: 3, marines: 20 },
  manowar: { label: "Man-o'-war", L: 104, B: 38, hp: 210, guns: 7, reload: 3.3, speed: 43, turn: 0.62, range: 280, masts: 3, marines: 30 },
  galleon: { label: 'Galleon',    L: 92,  B: 34, hp: 150, guns: 6, reload: 3.4, speed: 42, turn: 0.65, range: 270, masts: 3, marines: 20 },
  // Expansion classes. rig: 'square' (default) | 'fore-aft' (gaff schooner, points high into the wind) |
  // 'lateen' (xebec). abilities: behaviours from src/sim/abilities/ (oars, mortar, fireship, ...).
  // fireship: no guns; a burning hulk that rams and explodes. merchant: a slow, lightly armed trader to protect.
  schooner: { label: 'Schooner',    L: 56, B: 18, hp: 60,  guns: 2, reload: 2.2, speed: 70, turn: 1.5,  range: 220, masts: 2, marines: 12, rig: 'fore-aft' },
  xebec:    { label: 'Xebec',       L: 62, B: 18, hp: 75,  guns: 3, reload: 2.5, speed: 58, turn: 1.4,  range: 230, masts: 3, marines: 18, rig: 'lateen', abilities: { oars: true } },
  bomb:     { label: 'Bomb ketch',  L: 64, B: 24, hp: 95,  guns: 2, reload: 3.0, speed: 44, turn: 0.9,  range: 220, masts: 2, marines: 10,
              abilities: { mortar: { range: 430, reload: 6.5, dmg: 22, radius: 36 } } },
  fireship: { label: 'Fireship',    L: 54, B: 20, hp: 40,  guns: 0, reload: 9,   speed: 62, turn: 1.25, range: 0,   masts: 2, marines: 0, abilities: { fireship: true } },
  merchant: { label: 'Merchantman', L: 74, B: 30, hp: 130, guns: 1, reload: 4.0, speed: 36, turn: 0.7,  range: 200, masts: 3, marines: 6, merchant: true },
};

// Shipyard refits: each class grows into the next, for this much gold.
export const REFIT = { sloop: 'brig', brig: 'frigate', frigate: 'manowar' };
export const REFIT_COST = { brig: 150, frigate: 260, manowar: 420 };

export const BALL_SPEED = 430;
export const BALL_DMG = 4;
export const MINE_DMG = 30;
export const CHASER_RELOAD = 2.4;
export const CAPTURE_TIME = 3; // seconds a landing party needs ashore
export const FORT = { range: 240, reload: 2.8, dmgMul: 1.25, gunHeight: 40 };

// The Mediterranean's classes (galleys, polacres, the Ottoman line) live in their own file.
Object.assign(TYPES, MED_TYPES);
