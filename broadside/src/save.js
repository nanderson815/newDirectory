import { TYPES, REFIT, REFIT_COST } from './config/ships.js';
import { UPGRADES, HIRES, MAX_FLEET } from './config/upgrades.js';
import { BATTLES } from './config/battles.js';
import { AMMO_COSTS, BOARDING } from './config/ammo.js';
import { S } from './state.js';

// Campaign progress lives in this browser only (localStorage), so it's a per-player convenience:
// losing it costs progress, never breaks the game.
const KEY = 'broadside.save.v1';

export function freshSave() {
  return {
    v: 1,
    gold: 0,
    stars: {},   // battle id -> best stars (1-3)
    hats: [],    // hat ids won
    hired: 0,    // how many HIRES have joined
    fleet: [
      { name: 'Resolute', cls: 'frigate', up: {} },
      { name: 'Swift', cls: 'sloop', up: {} },
      { name: 'Kestrel', cls: 'sloop', up: {} },
    ],
  };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (s && s.v === 1 && Array.isArray(s.fleet) && s.fleet.length) return s;
  } catch (e) { /* unreadable or blocked storage: start fresh */ }
  return freshSave();
}

export let save = load();

export function writeSave() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* storage unavailable */ }
}
export function resetSave() {
  save = freshSave();
  writeSave();
}
export function replaceSave(s) {
  if (s && s.v === 1 && Array.isArray(s.fleet)) save = s;
}

export const lvl = (f, id) => (f.up && f.up[id]) || 0;

// What a fleet ship brings to battle once its class and upgrades are applied.
export function fleetStats(f) {
  const T = TYPES[f.cls];
  return {
    label: T.label,
    hp: Math.round(T.hp * (1 + 0.2 * lvl(f, 'hull'))),
    guns: T.guns + lvl(f, 'guns'),
    chasers: lvl(f, 'chasers'),
    mines: 2 * lvl(f, 'mines'),
    marines: T.marines + 10 * lvl(f, 'marines'),
    speed: Math.round(T.speed * (1 + 0.07 * lvl(f, 'sails'))),
    ammo: ['round', ...(lvl(f, 'chain') ? ['chain'] : []), ...(lvl(f, 'grape') ? ['grape'] : [])],
  };
}

// Chain shot and grapeshot are one-off purchases per ship.
export function buyAmmo(i, kind) {
  const f = save.fleet[i];
  if (lvl(f, kind) || !spend(AMMO_COSTS[kind])) return false;
  f.up = { ...f.up, [kind]: 1 };
  writeSave();
  return true;
}

export function refitOffer(f) {
  const next = REFIT[f.cls];
  return next ? { next, label: TYPES[next].label, cost: REFIT_COST[next] } : null;
}

export function upgradeOffer(f, id) {
  const U = UPGRADES.find((u) => u.id === id);
  const level = lvl(f, id);
  return { U, level, cost: level < U.max ? U.costs[level] : null };
}

function spend(cost) {
  if (cost == null || save.gold < cost) return false;
  save.gold -= cost;
  return true;
}

export function buyUpgrade(i, id) {
  const f = save.fleet[i];
  const { level, cost } = upgradeOffer(f, id);
  if (!spend(cost)) return false;
  f.up = { ...f.up, [id]: level + 1 };
  writeSave();
  return true;
}

export function buyRefit(i) {
  const f = save.fleet[i];
  const offer = refitOffer(f);
  if (!offer || !spend(offer.cost)) return false;
  f.cls = offer.next;
  writeSave();
  return true;
}

export const nextHire = () => (save.fleet.length < MAX_FLEET ? HIRES[save.hired] || null : null);

export function buyHire() {
  const h = nextHire();
  if (!h || !spend(h.cost)) return false;
  save.fleet.push({ name: h.name, cls: h.cls, up: {} });
  save.hired++;
  writeSave();
  return true;
}

// Endless Skirmish: pays per wave beaten and remembers the best run.
export function recordSkirmish(waves, gold) {
  const best = save.best || 0;
  save.best = Math.max(best, waves);
  save.gold += gold;
  writeSave();
  return { gold, waves, best: save.best, record: waves > best };
}

// The tutorial and the first battle are always open; each later battle opens once the one before is won.
export function isUnlocked(i) {
  return i <= 1 || (save.stars[BATTLES[i - 1].id] || 0) > 0;
}

export const starsFor = (lost) => (lost === 0 ? 3 : lost === 1 ? 2 : 1);

// Pays out a win: full reward the first time, 40% on replays, +50% for a flawless (3-star) win,
// plus prize money for every enemy ship taken by boarding.
export function recordWin(idx, lost, prizes = 0) {
  const B = BATTLES[idx];
  const prev = save.stars[B.id] || 0;
  const stars = starsFor(lost);
  const prizeGold = prizes * BOARDING.prizeGold;
  // Towns sacked in the battle (src/sim/land.js) pay their plunder on a win.
  const plunder = (S.G && S.G.battle === idx && S.G.stats.plunder) || 0;
  const gold = Math.round(B.reward * (prev ? 0.4 : 1) * (stars === 3 ? 1.5 : 1)) + prizeGold + plunder;
  save.gold += gold;
  save.stars[B.id] = Math.max(prev, stars);
  let hat = null;
  if (B.hat && !save.hats.includes(B.hat)) { save.hats.push(B.hat); hat = B.hat; }
  writeSave();
  return { gold, stars, hat, first: !prev, prizes, prizeGold, plunder };
}
