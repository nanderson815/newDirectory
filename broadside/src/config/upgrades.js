// Per-ship shipyard upgrades. costs[i] buys level i + 1.
export const UPGRADES = [
  { id: 'guns',    name: 'More guns',    desc: '+1 cannon on each side',                 max: 2, costs: [90, 180] },
  { id: 'chasers', name: 'Bow chasers',  desc: 'Forward guns for ships dead ahead',      max: 2, costs: [120, 200] },
  { id: 'mines',   name: 'Sea mines',    desc: '+2 mines to drop astern each battle',    max: 2, costs: [100, 180] },
  { id: 'hull',    name: 'Oak plating',  desc: '+20% hull strength',                     max: 3, costs: [70, 140, 220] },
  { id: 'sails',   name: 'New canvas',   desc: '+7% speed and turning',                  max: 2, costs: [80, 160] },
  { id: 'marines', name: 'Marines',      desc: '+10 troops for landing parties',         max: 2, costs: [60, 120] },
];

// Extra ships the shipyard can hire, in order. A fleet tops out at five.
export const HIRES = [
  { name: 'Merlin', cls: 'sloop', cost: 220 },
  { name: 'Osprey', cls: 'sloop', cost: 320 },
];
export const MAX_FLEET = 5;
