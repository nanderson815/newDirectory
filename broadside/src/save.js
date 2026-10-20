import { TYPES, REFIT, REFIT_COST } from './config/ships.js';
import { UPGRADES, HIRES, MAX_FLEET } from './config/upgrades.js';
import { BATTLES } from './config/battles.js';
import { AMMO_COSTS, BOARDING } from './config/ammo.js';
import { FLAGSHIP } from './config/flagship.js';
import { GUNS } from './config/guns.js';
import { classSlots, defaultLoadout, fullLoadout, loadoutWeight, accepts, slotCount, weightFactors } from './config/slots.js';
import { S } from './state.js';

// Campaign progress lives in this browser only (localStorage), so it's a per-player convenience:
// losing it costs progress, never breaks the game.
//
// Save v2 (stored under KEY):
//   { v: 2, gold, stars: { battleId: 1-3 }, hats: [hatId], hired, best?, tips?: [tipId],
//     fleet: [{ name, cls, up: { upgradeId: level, chain?: 1, grape?: 1 }, loadout: { slotId: gunId }, look: {} }] }
// `loadout` is only filled for a class with slots (the great ship, src/config/slots.js); for the rest it stays {}.
// `look` is the ship's cosmetics (LOOK_FIELDS), empty until the shipyard has a way to set them.
// A v1 save (under LEGACY_KEY, no loadout or look) is migrated on load and left where it was as a backup.
export const SAVE_VERSION = 2;
const KEY = 'broadside.save.v2';
const LEGACY_KEY = 'broadside.save.v1';

// What a ship's `look` may hold, for the 3D shipyard to fill. Every field is optional; a missing one means the
// class's usual look (src/render/models.js). Values are plain JSON.
export const LOOK_FIELDS = {
  paint: '{ hull, wale, trim }: hull paint colours as "#rrggbb"',
  sails: '{ cloth: "#rrggbb", emblem: id | null }: the colour of her canvas and a device painted on the main course',
  figurehead: 'id of a figurehead carving (a lion, a mermaid, a saint...)',
  flags: '{ ensign: id, pennant: id }: the colours she flies',
  lanterns: 'how many stern lanterns she shows (1-3)',
};

const ship = (name, cls) => ({ name, cls, up: {}, loadout: defaultLoadout(TYPES[cls] || {}), look: {} });

export function freshSave() {
  return {
    v: SAVE_VERSION,
    gold: 0,
    stars: {},   // battle id -> best stars (1-3)
    hats: [],    // hat ids won
    hired: 0,    // how many HIRES have joined
    fleet: [ship('Resolute', 'frigate'), ship('Swift', 'sloop'), ship('Kestrel', 'sloop')],
  };
}

// Brings any save we understand up to v2, keeping every field it has; null for anything else. v1 -> v2 adds
// `loadout` (the class's default, {} for a class without slots) and an empty `look` to every fleet ship.
export function migrate(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.fleet) || !s.fleet.length) return null;
  if (s.v !== 1 && s.v !== SAVE_VERSION) return null;
  const fleet = s.fleet.map((f) => {
    const T = TYPES[f.cls] || {};
    const loadout = f.loadout && typeof f.loadout === 'object' ? (T.slots ? fullLoadout(T, f.loadout) : f.loadout) : defaultLoadout(T);
    return { ...f, up: f.up || {}, loadout, look: f.look && typeof f.look === 'object' ? f.look : {} };
  });
  return { ...s, v: SAVE_VERSION, fleet };
}

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; /* unreadable or blocked storage */ }
}
function load() {
  const now = migrate(read(KEY));
  if (now) return now;
  const old = migrate(read(LEGACY_KEY));
  if (old) {
    try { localStorage.setItem(KEY, JSON.stringify(old)); } catch (e) { /* storage unavailable */ }
    return old;
  }
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
  const m = migrate(s);
  if (m) save = m;
}

export const lvl = (f, id) => (f.up && f.up[id]) || 0;

// The simple upgrades a class with slots does without: her slots say what guns she mounts.
const SLOTTED_SKIP = ['guns', 'chasers'];
export const upgradesFor = (f) => UPGRADES.filter((U) => !(TYPES[f.cls].slots && SLOTTED_SKIP.includes(U.id)));

// What a fleet ship brings to battle once its class, upgrades and (for a great ship) loadout are applied.
export function fleetStats(f) {
  const T = TYPES[f.cls];
  const sails = 1 + 0.07 * lvl(f, 'sails');
  const st = {
    label: T.label,
    hp: Math.round(T.hp * (1 + 0.2 * lvl(f, 'hull'))),
    guns: T.guns + lvl(f, 'guns'),
    chasers: lvl(f, 'chasers'),
    mines: 2 * lvl(f, 'mines'),
    marines: T.marines + 10 * lvl(f, 'marines'),
    speed: Math.round(T.speed * sails),
    ammo: ['round', ...(lvl(f, 'chain') ? ['chain'] : []), ...(lvl(f, 'grape') ? ['grape'] : [])],
  };
  if (T.slots) {
    const slots = classSlots(T), full = fullLoadout(T, f.loadout), wf = weightFactors(T, f.loadout);
    const count = (test) => Object.entries(slots).filter(([, s]) => test(s)).reduce((n, [id, s]) => n + slotCount(s, full[id]), 0);
    st.guns = Math.max(count((s) => s.side === 'port'), count((s) => s.side === 'starboard'));
    st.chasers = count((s) => s.pos === 'bow');
    st.sternGuns = count((s) => s.pos === 'stern');
    st.speed = Math.round(T.speed * sails * wf.speed);
    st.weight = wf.weight;
    st.tons = T.tons;
  }
  return st;
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

// ---------- The great ship ----------
// Once La Gran Armada is won (FLAGSHIP.unlock), a frigate or man-o'-war can be rebuilt as a great ship, one to the
// squadron. She comes with her class's default loadout; each slot can then be refitted for gold.
export const flagshipOpen = () => (save.stars[FLAGSHIP.unlock] || 0) > 0;
export function greatOffer(f) {
  const cost = FLAGSHIP.from[f.cls];
  if (!flagshipOpen() || cost == null || save.fleet.some((q) => q.cls === FLAGSHIP.type)) return null;
  return { next: FLAGSHIP.type, label: TYPES[FLAGSHIP.type].label, cost };
}
export function buyGreatShip(i) {
  const f = save.fleet[i];
  const offer = greatOffer(f);
  if (!offer || !spend(offer.cost)) return false;
  f.cls = offer.next;
  f.loadout = defaultLoadout(TYPES[f.cls]);
  writeSave();
  return true;
}

// Fitting `gun` into `slotId` of fleet ship f: what it costs (gold per gun times the guns the slot takes), whether
// it fits (the slot takes it, she can carry the weight) and what she would then carry.
export function fitOffer(f, slotId, gun) {
  const T = TYPES[f.cls], slot = (T.slots || {})[slotId], G = GUNS[gun];
  if (!slot || !G || !accepts(slot).includes(gun)) return null;
  const full = fullLoadout(T, f.loadout), fitted = full[slotId] === gun;
  const weight = loadoutWeight(T, { ...full, [slotId]: gun });
  const count = slotCount(slot, gun);
  return { slot, gun: G, count, cost: fitted ? null : G.cost * count, fitted, weight, over: weight > T.tons };
}
export function fitGun(i, slotId, gun) {
  const f = save.fleet[i], o = fitOffer(f, slotId, gun);
  if (!o || o.fitted || o.over || !spend(o.cost)) return false;
  f.loadout = { ...fullLoadout(TYPES[f.cls], f.loadout), [slotId]: gun };
  writeSave();
  return true;
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
  if (!upgradesFor(f).some((U) => U.id === id)) return false;
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
  save.fleet.push(ship(h.name, h.cls));
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
