import { GUNS } from './guns.js';

// Gun slots: where on a ship a battery of guns is mounted, and which gun kinds (src/config/guns.js) it takes.
//
// A ship class with `slots` (so far only the great ship, src/config/flagship.js) declares them by id:
//
//   slots: {
//     portLower: { label: 'Lower tier', pos: 'broadside', side: 'port', tier: 'lower', count: 5,
//                  accepts: ['long', 'demicannon'], default: 'long', at: [-0.3, 0.3] },
//     forecastle: { label: 'Forecastle', pos: 'deck', count: 2, accepts: ['swivel', 'mortar', 'firepot'], default: 'swivel', at: [0.3, 0.36] },
//     ...
//   }, tons: 92,
//
// and a ship's `loadout` is { slotId: gunId } (missing slots take their default). Every gun in a slot is the same
// kind, and the slot holds `count` of them (one if the gun is `single`, like a mortar). A class with slots also
// sets `tons`, the most weight of guns she can carry; her `speed` and `turn` are quoted with the default loadout,
// and each ton more or less moves them by WEIGHT.speed / tons and WEIGHT.turn / tons (as a share).
//
// Every other class has implicit slots (classSlots): a `port` and a `starboard` broadside of `guns` long guns
// (plus the shipyard's extra guns), and a `bow` slot of bow chasers when she has any. A battle may still give such
// a ship a `loadout` for those slots (an enemy frigate with carronades to port), so combat has one path for all.

// Positions, in the order the ledger lists them. `face` is the way the slot points, in degrees from the bow
// (positive to starboard); a deck mount has none and fires every way round.
export const POSITIONS = {
  broadside: { about: 'along her side: a battery that fires abeam, port or starboard (lower or upper tier)', face: null },
  bow: { about: 'in the bow: guns that fire dead ahead', face: 0 },
  stern: { about: 'in the stern windows: guns that fire dead astern', face: 180 },
  deck: { about: 'on the open deck (forecastle, waist, quarterdeck): mounts that train all round', face: null },
};
export const SIDES = { port: -90, starboard: 90 };
export const TIERS = ['lower', 'upper'];

// What a slot def may say.
export const SLOT_PARAMS = {
  label: 'its name in the ledger ("Lower tier", "Forecastle")',
  pos: 'broadside, bow, stern or deck (POSITIONS)',
  side: "port or starboard (broadside slots only)",
  tier: "lower or upper (broadside slots, optional): the lower tier sits nearer the water",
  count: 'how many guns it holds',
  accepts: 'gun ids it takes; each must fit its position (optional, default every gun that fits)',
  default: 'the gun it carries when the loadout says nothing',
  at: '[from, to]: where along the hull its guns sit, as fractions of her length from amidships (-0.5 the stern, 0.5 the bow; optional)',
};

// How much weight of guns slows her (see above).
export const WEIGHT = { speed: 0.45, turn: 0.5 };

const AT = { broadside: [-0.28, 0.28], bow: [0.5, 0.5], stern: [-0.5, -0.5], deck: [0, 0] };

// A class's slots, explicit or implicit. `extra` = { guns, chasers }: the shipyard's extra guns a side and the
// bow chasers a ship def or upgrade adds (implicit classes only).
export function classSlots(T, extra = {}) {
  if (T.slots) return T.slots;
  const guns = (T.guns || 0) + (extra.guns || 0), chasers = extra.chasers || 0;
  const out = {};
  if (guns > 0) {
    for (const side of ['port', 'starboard']) {
      out[side] = { label: side === 'port' ? 'Larboard battery' : 'Starboard battery', pos: 'broadside', side, count: guns,
        accepts: ['long', 'demicannon', 'carronade'], default: 'long', at: AT.broadside, implicit: true };
    }
  }
  if (chasers > 0) out.bow = { label: 'Bow', pos: 'bow', count: chasers, accepts: ['bowChaser'], default: 'bowChaser', at: AT.bow, implicit: true };
  return out;
}

export const slotAt = (slot) => slot.at || AT[slot.pos] || [0, 0];
// The gun ids a slot takes.
export const accepts = (slot) => (slot.accepts || Object.keys(GUNS)).filter((g) => GUNS[g] && GUNS[g].fits.includes(slot.pos));
// Guns in a slot once it is fitted with gun g.
export const slotCount = (slot, g) => (GUNS[g] && GUNS[g].single ? 1 : slot.count);

// The full loadout: every slot fitted, defaults where the loadout is silent or names something the slot won't take.
export function fullLoadout(T, loadout = {}, extra = {}) {
  const slots = classSlots(T, extra), out = {};
  for (const [id, slot] of Object.entries(slots)) out[id] = loadout && accepts(slot).includes(loadout[id]) ? loadout[id] : slot.default;
  return out;
}
export const defaultLoadout = (T) => (T.slots ? fullLoadout(T, {}) : {});

// Tons of guns aboard.
export function loadoutWeight(T, loadout = {}, extra = {}) {
  const slots = classSlots(T, extra), full = fullLoadout(T, loadout, extra);
  let w = 0;
  for (const [id, g] of Object.entries(full)) w += GUNS[g].weight * slotCount(slots[id], g);
  return Math.round(w * 10) / 10;
}

// Her speed and turn multipliers from the weight of her guns (1, 1 for a class without `tons`).
export function weightFactors(T, loadout = {}) {
  if (!T.tons || !T.slots) return { speed: 1, turn: 1, weight: 0 };
  const w = loadoutWeight(T, loadout), d = (loadoutWeight(T, {}) - w) / T.tons;
  return { speed: 1 + WEIGHT.speed * d, turn: 1 + WEIGHT.turn * d, weight: w };
}

// Problems with a loadout for class T (empty = fine): unknown slots or guns, a gun the slot won't take, overweight.
export function checkLoadout(T, loadout, extra = {}) {
  const P = [];
  if (loadout == null) return P;
  if (typeof loadout !== 'object' || Array.isArray(loadout)) return ['loadout must be { slotId: gunId }'];
  const slots = classSlots(T, extra);
  for (const [id, g] of Object.entries(loadout)) {
    const slot = slots[id];
    if (!slot) { P.push(`loadout: unknown slot '${id}' (known: ${Object.keys(slots).join(', ') || 'none'})`); continue; }
    if (!GUNS[g]) { P.push(`loadout: unknown gun '${g}' in ${id} (known: ${Object.keys(GUNS).join(', ')})`); continue; }
    if (!accepts(slot).includes(g)) P.push(`loadout: ${id} is a ${slot.pos} slot and does not take '${g}' (takes: ${accepts(slot).join(', ')})`);
  }
  if (T.tons) {
    const w = loadoutWeight(T, loadout, extra);
    if (w > T.tons) P.push(`loadout: overweight, ${w} tons of guns on a ship that carries ${T.tons}`);
  }
  return P;
}

// Problems with a class's own slot table (empty = fine).
export function checkSlots(T) {
  const P = [];
  if (T.slots === undefined) return P;
  if (!T.slots || typeof T.slots !== 'object') return ['slots must be { slotId: slotDef }'];
  if (!(typeof T.tons === 'number' && T.tons > 0)) P.push('a class with slots needs tons (the most weight of guns she carries)');
  for (const [id, s] of Object.entries(T.slots)) {
    const at = `slot '${id}'`;
    for (const k of Object.keys(s)) if (!(k in SLOT_PARAMS)) P.push(`${at}: unknown field '${k}' (known: ${Object.keys(SLOT_PARAMS).join(', ')})`);
    if (!POSITIONS[s.pos]) { P.push(`${at}: pos must be one of ${Object.keys(POSITIONS).join(', ')}, got ${JSON.stringify(s.pos)}`); continue; }
    if (s.pos === 'broadside' && !(s.side in SIDES)) P.push(`${at}: a broadside slot needs side 'port' or 'starboard'`);
    if (s.tier !== undefined && !TIERS.includes(s.tier)) P.push(`${at}: tier must be lower or upper`);
    if (!(Number.isInteger(s.count) && s.count >= 1)) P.push(`${at}: count must be a whole number of at least 1`);
    for (const g of s.accepts || []) {
      if (!GUNS[g]) P.push(`${at}: accepts unknown gun '${g}'`);
      else if (!GUNS[g].fits.includes(s.pos)) P.push(`${at}: accepts '${g}', which does not fit a ${s.pos} slot`);
    }
    if (!accepts(s).includes(s.default)) P.push(`${at}: default '${s.default}' is not a gun it takes`);
    if (s.at !== undefined && !(Array.isArray(s.at) && s.at.length === 2 && s.at.every((v) => typeof v === 'number' && v >= -0.5 && v <= 0.5))) P.push(`${at}: at must be [from, to] in [-0.5, 0.5]`);
  }
  if (T.tons) {
    const w = loadoutWeight(T, {});
    if (w > T.tons) P.push(`the default loadout weighs ${w} tons, more than her ${T.tons}`);
  }
  return P;
}

// The ledger's groups: the slots of class T by position, broadsides by side.
export function slotGroups(T) {
  const groups = [
    { id: 'port', label: 'The larboard broadside', test: (s) => s.pos === 'broadside' && s.side === 'port' },
    { id: 'starboard', label: 'The starboard broadside', test: (s) => s.pos === 'broadside' && s.side === 'starboard' },
    { id: 'chase', label: 'Chase guns', test: (s) => s.pos === 'bow' || s.pos === 'stern' },
    { id: 'deck', label: 'Upon the deck', test: (s) => s.pos === 'deck' },
  ];
  const slots = Object.entries(classSlots(T));
  return groups.map((g) => ({ id: g.id, label: g.label, slots: slots.filter(([, s]) => g.test(s)).map(([id]) => id) })).filter((g) => g.slots.length);
}
