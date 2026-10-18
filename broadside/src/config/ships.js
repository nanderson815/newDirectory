// Ship classes. L = length, B = beam (world units); speed in units/sec, turn in rad/sec, reload in sec.
// marines = troops a ship can put ashore to take a fort.
export const TYPES = {
  sloop:   { label: 'Sloop',      L: 60,  B: 22, hp: 70,  guns: 3, reload: 2.4, speed: 62, turn: 1.35, range: 235, masts: 2, marines: 10 },
  brig:    { label: 'Brig',       L: 66,  B: 24, hp: 85,  guns: 3, reload: 2.6, speed: 57, turn: 1.15, range: 240, masts: 2, marines: 15 },
  frigate: { label: 'Frigate',    L: 84,  B: 30, hp: 130, guns: 5, reload: 3.0, speed: 50, turn: 0.85, range: 255, masts: 3, marines: 20 },
  manowar: { label: "Man-o'-war", L: 104, B: 38, hp: 210, guns: 7, reload: 3.3, speed: 43, turn: 0.62, range: 280, masts: 3, marines: 30 },
  galleon: { label: 'Galleon',    L: 92,  B: 34, hp: 150, guns: 6, reload: 3.4, speed: 42, turn: 0.65, range: 270, masts: 3, marines: 20 },
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
