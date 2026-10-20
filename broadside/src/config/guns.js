// The gun registry: every kind of piece a ship can mount. A ship class with slots (src/config/slots.js) fits
// one gun kind per slot; every other class fires implicit long-gun broadsides and bow chasers built from its
// `guns`, `range` and `reload` (see classSlots), so combat runs one path for both (src/sim/guns.js).
//
// Each gun is { id, label, short, about, fits, range, reload, dmg, weight, arc, shot, crew, cost, render, ...behaviour }.
// GUN_PARAMS describes every field (the validator checks entries against it and the docs print it).
// Numbers are per gun: a slot of four carronades weighs four times one, costs four times one, and fires four balls.

export const GUN_PARAMS = {
  label: 'its name in the shipyard ledger (plural: a slot holds several)',
  short: 'a short name for tight spaces',
  about: 'one italic line for the ledger',
  fits: 'positions it can be mounted in (broadside, bow, stern, deck; see POSITIONS in src/config/slots.js)',
  fires: "what leaves the muzzle: 'ball' (a cannonball or a spray of pellets), 'shell' (a mortar shell lobbed over everything) or 'pot' (a fire-pot that sets her burning)",
  range: 'reach in map units with its first shot type (chain and grape scale it by AMMO[...].range)',
  minRange: 'it cannot hit anything closer than this (optional, default 0)',
  reload: 'seconds between shots',
  dmg: 'hull damage per ball (or per pellet, or at the centre of a shell burst)',
  weight: 'tons per gun; a slotted class may carry at most its `tons` in all',
  arc: 'half-angle of its firing arc in degrees, either side of the way its slot faces (a deck mount faces every way)',
  shot: 'shot types it can load, the first being what it fires when the ship\'s chosen shot does not fit (empty: its own, shells or pots)',
  crew: 'men to work one gun (for the ledger and the 3D yard)',
  cost: 'gold per gun to fit it',
  render: '{ barrel, bore }: barrel length and bore relative to a long gun (1, 1), for the battle model and the 3D yard',
  auto: 'fires on its own even when you have the guns on Manual (optional, default false)',
  single: 'one piece takes the whole slot, however many guns the slot holds (optional, default false)',
  pellets: 'balls in one discharge (grapeshot-style spray; optional, default 1)',
  crewKill: 'chance each ball that lands cuts down a marine (optional; grapeshot is 0.25)',
  repel: 'added to her defence against boarders per gun (optional, default 0)',
  radius: 'burst radius of a shell (shell guns only)',
  burn: 'seconds a fire-pot sets her burning (pot guns only)',
  traverse: 'radians the gun can train either side of its slot\'s facing when aimed (optional; default 0.7)',
};

export const GUNS = {
  long: {
    label: 'Long guns', short: 'Long', about: 'Culverins: the long reach of the line. Steady, heavy, slow to load.',
    fits: ['broadside'], fires: 'ball', range: 300, reload: 3.4, dmg: 4, weight: 3, arc: 36,
    shot: ['round', 'chain', 'grape'], crew: 6, cost: 30, render: { barrel: 1, bore: 1 },
  },
  demicannon: {
    label: 'Demi-cannon', short: 'Demi', about: 'Thirty-two pounders for the lower tier. They hit like a church falling, and load like one.',
    fits: ['broadside'], fires: 'ball', range: 265, reload: 4.4, dmg: 6.5, weight: 4.5, arc: 34,
    shot: ['round', 'chain', 'grape'], crew: 9, cost: 55, render: { barrel: 1.1, bore: 1.3 },
  },
  carronade: {
    label: 'Carronades', short: 'Carronade', about: 'Short, fat smashers: half the reach, twice the weight of ball, quick to load. Close in or waste them.',
    fits: ['broadside'], fires: 'ball', range: 150, reload: 2.3, dmg: 7, weight: 1.6, arc: 40,
    shot: ['round', 'grape'], crew: 4, cost: 45, render: { barrel: 0.55, bore: 1.4 },
  },
  swivel: {
    label: 'Swivel guns', short: 'Swivel', about: 'Murderers on the rail. They sweep a deck at pistol shot on their own, and make boarders think twice.',
    fits: ['broadside', 'bow', 'stern', 'deck'], fires: 'ball', range: 100, reload: 1.6, dmg: 0.8, weight: 0.3, arc: 70,
    shot: ['grape'], crew: 1, cost: 15, render: { barrel: 0.45, bore: 0.4 },
    auto: true, pellets: 3, crewKill: 0.3, repel: 2, traverse: 1.2,
  },
  bowChaser: {
    label: 'Bow chasers', short: 'Bow chaser', about: 'Long guns run out through the bow, for the ship you are chasing.',
    fits: ['bow'], fires: 'ball', range: 270, reload: 2.4, dmg: 4, weight: 2.4, arc: 18,
    shot: ['round', 'chain'], crew: 4, cost: 60, render: { barrel: 1.5, bore: 0.95 }, auto: true, traverse: 0.35,
  },
  sternChaser: {
    label: 'Stern chasers', short: 'Stern chaser', about: 'Long guns in the great cabin windows, for whoever tries to cross your stern.',
    fits: ['stern'], fires: 'ball', range: 260, reload: 2.4, dmg: 4, weight: 2.4, arc: 18,
    shot: ['round', 'chain'], crew: 4, cost: 60, render: { barrel: 1.5, bore: 0.95 }, auto: true, traverse: 0.35,
  },
  mortar: {
    label: 'Sea mortar', short: 'Mortar', about: 'A bomb ketch\'s mortar on your own deck: shells over islands and walls onto anything in reach.',
    fits: ['deck'], fires: 'shell', range: 460, minRange: 110, reload: 6.5, dmg: 22, radius: 36, weight: 8, arc: 180,
    shot: [], crew: 8, cost: 340, render: { barrel: 0.6, bore: 2.2 }, auto: true, single: true,
  },
  firepot: {
    label: 'Fire-pot engine', short: 'Fire-pots', about: 'A sling that hurls pots of pitch and wildfire. Short reach, and every pot that lands sets her burning.',
    fits: ['deck'], fires: 'pot', range: 140, reload: 5, dmg: 2, burn: 6, weight: 1.5, arc: 180,
    shot: [], crew: 3, cost: 160, render: { barrel: 0.9, bore: 1.1 }, auto: true, single: true, traverse: 3.2,
  },
};

// The order the ledger and the docs list guns in.
export const GUN_ORDER = Object.keys(GUNS);
