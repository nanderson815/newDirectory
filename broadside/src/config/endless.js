import { BATTLES } from './battles.js';
import { clamp, rand } from '../util.js';

// Endless Skirmish: wave after wave of Spanish ships, each wave tougher than the last, a flagship every fifth
// wave. Opens once the first campaign battle is won. Gold per wave cleared, best wave kept in the save.
export const ENDLESS_ID = 'endless';
export const WAVE_GOLD = 30;
export const WAVE_REPAIR = 0.25; // share of max hull repaired between waves

export const ENDLESS = {
  id: ENDLESS_ID, region: 'endless', roman: '∞', year: 1660, name: 'Endless Skirmish', foe: 'Spanish fleet',
  goal: 'waves', reward: 0, wind: 0,
  brief: 'The whole Spanish fleet is coming, one squadron at a time. Hold out as long as you can.',
  enemy: [], islands: [],
};

// Campaign battles by index, plus the skirmish by id.
export const battleDef = (i) => (i === ENDLESS_ID ? ENDLESS : BATTLES[i]);

// Enemy gunnery sharpens and hulls thicken with every wave, up to a ceiling.
export function waveAI(n) {
  return {
    spread: clamp(0.15 - n * 0.007, 0.06, 0.15),
    reloadMul: clamp(1.25 - n * 0.035, 0.85, 1.25),
    dmgMul: clamp(0.85 + n * 0.05, 0.85, 1.6),
    hpMul: clamp(0.95 + n * 0.05, 0.95, 1.8),
  };
}

const NAMES = ['San Juan', 'Santa Lucía', 'El Gavilán', 'La Sirena', 'San Andrés', 'Santa Teresa', 'El Tiburón',
  'La Estrella', 'San Mateo', 'La Fortuna', 'El Dragón', 'Santa Isabel', 'San Fernando', 'La Victoria'];
const FLAGSHIPS = ['Almirante Negro', 'Reina del Mar', 'San Felipe el Real', 'Gran Poder'];

// Lighter ships join the waves as they go on: schooners, oared xebecs, a bomb ketch, a fireship.
const MIX = ['brig', 'schooner', 'xebec', 'brig', 'bomb', 'fireship'];
const FROM = { brig: 1, schooner: 2, xebec: 4, bomb: 6, fireship: 7 };

// The ships in wave n, spread across the top of the map. Positions are portrait fractions.
export function waveEnemies(n) {
  const boss = n % 5 === 0;
  const count = clamp(1 + Math.ceil(n / 2), 2, 6) - (boss ? 1 : 0);
  const galleons = Math.min(count, Math.floor((n - 1) / 3));
  const defs = [], once = new Set();
  for (let i = 0; i < count; i++) {
    let type = MIX[(n + i) % MIX.length];
    if (n < FROM[type] || once.has(type)) type = 'brig';
    if (type === 'bomb' || type === 'fireship') once.add(type);
    defs.push({ type: i < galleons ? 'galleon' : type, name: NAMES[(n * 3 + i) % NAMES.length], h: 90 });
  }
  if (boss) {
    defs.unshift({
      type: n >= 10 ? 'manowar' : 'galleon', name: FLAGSHIPS[(n / 5 - 1) % FLAGSHIPS.length], h: 90,
      hp: 180 + n * 18, chasers: 2, abilities: n >= 10 ? { mineLayer: { every: 8 } } : {},
      boss: { captain: `Wave ${n} flagship`, title: FLAGSHIPS[(n / 5 - 1) % FLAGSHIPS.length], hat: null },
    });
  }
  defs.forEach((d, i) => { d.x = (i + 1) / (defs.length + 1); d.y = 0.1 + (i % 2) * 0.07; });
  return defs;
}

// A fresh scatter of islands for each skirmish, kept clear of the fleets and the map edges.
export function randomIslands() {
  const out = [];
  for (let tries = 0; out.length < 4 && tries < 200; tries++) {
    const r = rand(24, 44);
    const c = { x: rand(0.22, 0.78), y: rand(0.32, 0.66), r };
    if (out.every((o) => Math.hypot((o.x - c.x) * 520, (o.y - c.y) * 1100) > o.r + c.r + 110)) out.push(c);
  }
  return out;
}
