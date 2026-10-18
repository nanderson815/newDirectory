import mortar from './mortar.js';
import fireship from './fireship.js';
import launcher from './launcher.js';
import mineLayer from './mineLayer.js';
import oars from './oars.js';
import repair from './repair.js';
import ram from './ram.js';
import flee from './flee.js';
import rally from './rally.js';

// Ship abilities: self-contained behaviours a ship type or a single ship in a battle can carry.
// A ship type lists them in TYPES[type].abilities, a battle ship in its def's `abilities`, both as
// { abilityId: config | true }; the battle's config is merged over the type's.
//
// An ability is { id, about, params, defaults, init?, update?, steer?, wind?, sunk?, draw? }:
//   about / params    a one-line description and { param: description }, for docs and validation
//   init(s, a)        once when the ship is built; `a` is this ship's copy of defaults + config, and is also
//                     where the ability keeps its own state (it is saved with the battle)
//   update(s, a, dt)  every tick while she's afloat, not a hulk and not locked in a boarding action
//   steer(s, a)       for AI-sailed ships: return a heading to override the captain's choice, or null
//   wind(s, a, f)     adjust her speed factor f from the wind
//   sunk(s, a)        when she starts to go down
//   draw(s, a, api)   chart markers while she's afloat and seen (api: the HUD's drawing kit, see src/hud/hud.js)
// To add one: write a module like these, then list it here.
export const ABILITIES = Object.fromEntries([mortar, fireship, launcher, mineLayer, oars, repair, ram, flee, rally].map((a) => [a.id, a]));

export function initAbilities(s, spec) {
  s.abilities = {};
  for (const [id, cfg] of Object.entries(spec || {})) {
    const A = ABILITIES[id];
    if (!cfg || !A) continue;
    const a = { ...(A.defaults || {}), ...(cfg === true ? {} : cfg) };
    s.abilities[id] = a;
    if (A.init) A.init(s, a);
  }
}

// Runs fn(abilityModule, a) for each of a ship's abilities that has `hook`.
export const eachAbility = (s, hook, fn) => { for (const id in s.abilities) { const A = ABILITIES[id]; if (A && A[hook]) fn(A, s.abilities[id]); } };
const each = eachAbility;

export const updateAbilities = (s, dt) => each(s, 'update', (A, a) => A.update(s, a, dt));
export const abilitiesSunk = (s) => each(s, 'sunk', (A, a) => A.sunk(s, a));
export function abilityWind(s, f) { each(s, 'wind', (A, a) => { f = A.wind(s, a, f); }); return f; }
export function abilitySteer(s) {
  let h = null;
  each(s, 'steer', (A, a) => { if (h == null) h = A.steer(s, a); });
  return h;
}
