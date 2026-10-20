import { BALL_DMG, CHASER_RELOAD } from '../config/ships.js';
import { GUNS } from '../config/guns.js';
import { AMMO } from '../config/ammo.js';
import { classSlots, fullLoadout, slotAt, slotCount, POSITIONS, SIDES } from '../config/slots.js';
import { PI, rand } from '../util.js';

// A ship's guns in battle: one battery per slot (src/config/slots.js), each with its own gun's range, reload and
// weight of ball. Classes without slots get implicit long-gun broadsides and bow chasers with their own class
// numbers, so the firing path in src/sim/combat.js is the same for every ship. A battery is plain JSON (it is
// saved with the battle):
//
//   { slot, gun, pos, side (0 port, 1 starboard, null), face (radians from the bow, null on deck), arc (half-angle),
//     count, range, minRange, reloadTime, t (seconds until loaded), dmg, auto, at: [from, to], tier, lat, z }
//
// The ship keeps summaries the rest of the game reads: s.guns (broadside guns a side), s.chasers (bow guns),
// s.range and s.reloadTime (her main battery, the one throwing the most weight of shot a second, which is what her
// captain fights at), s.reload[side] (seconds until the first of that side's hand-fired batteries is loaded) and
// s.repel (boarders kept off by her swivels).

const DEG = PI / 180;

export function makeBatteries(T, def = {}, up = {}) {
  const extra = { guns: up.guns || 0, chasers: def.chasers || up.chasers || 0 };
  // A slotted class ignores the simple upgrades' extra guns and chasers: her slots say what she mounts.
  const slots = classSlots(T, T.slots ? {} : extra);
  const full = fullLoadout(T, def.loadout || {}, T.slots ? {} : extra);
  const mul = def.reloadMul || 1;
  const out = [];
  for (const [id, slot] of Object.entries(slots)) {
    const g = full[id], G = GUNS[g], P = POSITIONS[slot.pos];
    let range = G.range, reload = G.reload, dmg = G.dmg;
    // Implicit long guns and chasers fire with the class's own numbers, as they always have.
    if (slot.implicit && g === 'long') { range = T.range; reload = T.reload; dmg = BALL_DMG; }
    if (slot.implicit && g === 'bowChaser') { range = T.range * 0.85; reload = CHASER_RELOAD; dmg = BALL_DMG; }
    const face = slot.pos === 'broadside' ? SIDES[slot.side] * DEG : P.face == null ? null : P.face * DEG;
    out.push({
      slot: id, gun: g, pos: slot.pos, side: slot.pos === 'broadside' ? (slot.side === 'port' ? 0 : 1) : null,
      face, arc: face == null ? PI : G.arc * DEG, count: slotCount(slot, g), range, minRange: G.minRange || 0,
      reloadTime: reload * mul, dmg, auto: !!G.auto, at: slotAt(slot), tier: slot.tier || null,
      lat: slot.tier === 'upper' ? 0.5 : 0.55, z: slot.tier === 'upper' ? 9 : slot.pos === 'deck' ? 11 : slot.pos === 'broadside' ? 6 : 7,
      t: G.fires === 'shell' ? rand(2, 4) : slot.pos === 'broadside' ? rand(0.6, 1.6) : rand(0.5, 1.5),
    });
  }
  return out;
}

// Weight of shot a second, for picking her main battery.
const punch = (b) => (b.count * b.dmg * (GUNS[b.gun].pellets || 1)) / b.reloadTime;
export const handFired = (b) => b.pos === 'broadside' && !b.auto;

// Fills in the summaries from her batteries (once, when she is built).
export function summarize(s, T) {
  const bs = s.batteries;
  const side = (k) => bs.filter((b) => b.pos === 'broadside' && b.side === k).reduce((n, b) => n + b.count, 0);
  s.guns = Math.max(side(0), side(1));
  s.chasers = bs.filter((b) => b.pos === 'bow').reduce((n, b) => n + b.count, 0);
  s.repel = bs.reduce((n, b) => n + (GUNS[b.gun].repel || 0) * b.count, 0);
  let main = null;
  for (const b of bs) if (b.pos === 'broadside' && (!main || punch(b) > punch(main))) main = b;
  s.range = main ? main.range : T.range;
  s.reloadTime = main ? main.reloadTime : T.reload;
  s._rl = [0, 0];
  syncReload(s);
}

// s.reload[side] is a summary, but older code (and tests) write it: a write shifts every hand-fired battery on
// that side by the same amount, so `s.reload = [0, 0]` still means "loaded now" and `[99, 99]` "not for a while".
// Called before her guns tick (applyReloadWrites) and after (syncReload).
export function applyReloadWrites(s) {
  if (!Array.isArray(s.reload) || !s._rl) return;
  for (let k = 0; k < 2; k++) {
    const d = s.reload[k] - s._rl[k];
    if (!d) continue;
    for (const b of s.batteries) if (b.side === k && handFired(b)) b.t += d;
  }
}
export function syncReload(s) {
  const r = [Infinity, Infinity];
  for (const b of s.batteries) if (handFired(b) && b.t < r[b.side]) r[b.side] = b.t;
  for (let k = 0; k < 2; k++) if (r[k] === Infinity) r[k] = 0;
  s.reload = r;
  s._rl = [r[0], r[1]];
}

// Every gun aboard loads faster by `secs` (a rally ship's example).
export function hasten(s, secs) {
  if (!s.batteries) return;
  applyReloadWrites(s);
  for (const b of s.batteries) b.t -= secs;
  syncReload(s);
}

// How loaded one side's hand-fired guns are, for the HUD: [{ k (0-1), w (guns), range }].
export function sideLoad(s, side) {
  return s.batteries.filter((b) => b.side === side && handFired(b)).map((b) => ({ k: Math.max(0, Math.min(1, 1 - b.t / b.reloadTime)), w: b.count, range: b.range, gun: b.gun }));
}

// The shot a battery loads: the ship's chosen shot if this gun takes it, else its own first (grape for swivels).
export function shotFor(s, b) {
  const G = GUNS[b.gun];
  if (G.fires === 'pot') return 'pot';
  if (G.fires !== 'ball') return null;
  return G.shot.includes(s.ammo) ? s.ammo : G.shot[0];
}
// Her reach with that shot (ranges are quoted for a gun's first shot type).
export function batteryRange(s, b, shot = shotFor(s, b)) {
  const G = GUNS[b.gun];
  if (!shot || !AMMO[shot] || !G.shot.length) return b.range;
  return b.range * AMMO[shot].range / AMMO[G.shot[0]].range;
}

// Where gun gi of battery b sits, in map coordinates, and how high its muzzle is.
export function gunPoint(s, b, gi) {
  const c = Math.cos(s.h), sn = Math.sin(s.h);
  let along, off;
  if (b.pos === 'broadside') {
    along = (b.count === 1 ? (b.at[0] + b.at[1]) / 2 : b.at[0] + (b.at[1] - b.at[0]) * gi / (b.count - 1)) * s.L;
    off = (b.side === 0 ? -1 : 1) * s.B * b.lat;
  } else if (b.pos === 'deck') {
    along = (b.count === 1 ? (b.at[0] + b.at[1]) / 2 : b.at[gi % 2]) * s.L;
    off = b.count === 1 ? 0 : (gi % 2 ? 1 : -1) * s.B * 0.3;
  } else {
    along = b.at[0] * s.L;
    off = b.count === 1 ? 0 : (gi % 2 ? 1 : -1) * s.B * 0.18;
  }
  return [s.x + c * along - sn * off, s.y + sn * along + c * off, b.z];
}
