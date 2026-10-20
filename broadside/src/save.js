import { TYPES, REFIT, REFIT_COST } from './config/ships.js';
import { UPGRADES, HIRES, MAX_FLEET } from './config/upgrades.js';
import { BATTLES } from './config/battles.js';
import { WORLDS, worldById, DEFAULT_WORLD } from './config/worlds.js';
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

// ---------- Worlds and unlocking ----------
// Progress is per world (src/config/worlds.js): a world opens once its `unlock` battle is won, its first battle
// (and in the West Indies the tutorial and the first battle) is open as soon as the world is, and each later
// battle opens once the one before it in the same world is won. Stars are kept by battle id, so a save from
// before worlds existed keeps all its progress (and a finished West Indies opens the Mediterranean).
const won = (id) => (save.stars[id] || 0) > 0;
export const worldOpen = (id) => { const W = worldById(id); return !W.unlock || won(W.unlock.won); };
const worldOf = (B) => (B && B.world) || DEFAULT_WORLD;
export function isUnlocked(i) {
  const B = BATTLES[i];
  if (!B) return false;
  const w = worldOf(B);
  if (!worldOpen(w)) return false;
  const list = BATTLES.filter((b) => worldOf(b) === w), k = list.indexOf(B);
  return k <= (w === DEFAULT_WORLD ? 1 : 0) || won(list[k - 1].id);
}
// The worlds open to this save, and the one the chart shows: the save's choice if it is open, else the latest
// open world with a battle still to win (else the latest open one).
export const openWorlds = () => WORLDS.filter((W) => worldOpen(W.id));
export function currentWorld() {
  if (save.world && worldOpen(save.world)) return save.world;
  const open = openWorlds();
  const todo = [...open].reverse().find((W) => BATTLES.some((b) => worldOf(b) === W.id && !won(b.id)));
  return (todo || open[open.length - 1] || WORLDS[0]).id;
}
export function setWorld(id) {
  if (!worldOpen(id)) return false;
  save.world = id;
  writeSave();
  return true;
}
// The battle after battle i: the next in its world, or once a world is finished, the first battle of the next
// world if that is open. null when there is none.
export function nextAfter(i) {
  const B = BATTLES[i];
  if (!B) return null;
  const w = worldOf(B), list = BATTLES.filter((b) => worldOf(b) === w), k = list.indexOf(B);
  if (k + 1 < list.length) return BATTLES.indexOf(list[k + 1]);
  const wi = WORLDS.findIndex((W) => W.id === w), nextW = WORLDS[wi + 1];
  if (!nextW || !worldOpen(nextW.id)) return null;
  const first = BATTLES.findIndex((b) => worldOf(b) === nextW.id);
  return first < 0 ? null : first;
}
// Is battle i the last of its world?
export const lastOfWorld = (i) => { const w = worldOf(BATTLES[i]); return BATTLES.filter((b) => worldOf(b) === w).pop() === BATTLES[i]; };

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
  // Bonus goals met in this battle (src/sim/goals/index.js) pay their gold, 40% on replays like the reward.
  const bonuses = (S.G && S.G.battle === idx ? S.G.goals || [] : []).filter((o) => o.bonus && o.met);
  const bonus = Math.round(bonuses.reduce((n, o) => n + (o.gold || 0), 0) * (prev ? 0.4 : 1));
  const gold = Math.round(B.reward * (prev ? 0.4 : 1) * (stars === 3 ? 1.5 : 1)) + prizeGold + plunder + bonus;
  save.gold += gold;
  save.stars[B.id] = Math.max(prev, stars);
  let hat = null;
  if (B.hat && !save.hats.includes(B.hat)) { save.hats.push(B.hat); hat = B.hat; }
  if (bonuses.length) save.bonus = { ...(save.bonus || {}), [B.id]: true };
  writeSave();
  return { gold, stars, hat, first: !prev, prizes, prizeGold, plunder, bonus, bonuses: bonuses.length };
}
