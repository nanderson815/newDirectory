// Loads the game's content and primitive registries in plain node, with no browser.
//
// The sim modules import a few browser-side ones for side effects (sound effects, the renderer), and those
// touch window/AudioContext/three.js as soon as they load. A tiny module hook swaps every module under
// src/audio, src/render, src/hud and src/ui for a stub that exports the same names as inert no-ops, so the
// registries (goals, abilities, events) and the config tables import cleanly. Nothing here runs a battle.
//
//   import { loadContent } from './registries.mjs';
//   const C = await loadContent();   // { BATTLES, REGIONS, TYPES, HATS, HAT_ORDER, GOALS, ABILITIES, WHEN, DO, TERRAIN, LANDMARKS, LANDS, ... }
import { register } from 'node:module';

const HOOKS = `
import fs from 'node:fs';
const BROWSER = /\\/src\\/(audio|render|hud|ui)\\/[^/]+\\.js$/;
const ID = '[A-Za-z_$][\\\\w$]*';
// Every name a module exports, read from its source (export const/let/var/function/class X, export { a, b as c }).
function exportNames(src) {
  const names = new Set();
  for (const m of src.matchAll(new RegExp('^export\\\\s+(?:async\\\\s+)?(?:function\\\\*?|const|let|var|class)\\\\s+(' + ID + ')', 'gm'))) names.add(m[1]);
  for (const m of src.matchAll(/^export\\s*\\{([^}]*)\\}/gm)) {
    for (const part of m[1].split(',')) { const n = part.trim().split(/\\s+as\\s+/).pop(); if (n) names.add(n); }
  }
  return names;
}
export async function load(url, context, next) {
  if (!url.startsWith('file:') || !BROWSER.test(url)) return next(url, context);
  const src = fs.readFileSync(new URL(url), 'utf8');
  const names = exportNames(src);
  // A callable, indexable no-op: any property, call or construction gives back another one.
  let out = 'const stub = new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === "then" ? undefined : stub), apply: () => stub, construct: () => stub, set: () => true });\\n';
  for (const n of names) out += 'export const ' + n + ' = stub;\\n';
  if (/^export\\s+default\\b/m.test(src)) out += 'export default stub;\\n';
  return { format: 'module', source: out, shortCircuit: true };
}
`;
register('data:text/javascript,' + encodeURIComponent(HOOKS));

const src = (p) => new URL('../src/' + p, import.meta.url).href;

export async function loadContent() {
  const [battles, ships, hats, endless, goals, abilities, events, terrain, hazards, land, lands, guns, slots, ammo, flagship] = await Promise.all([
    import(src('config/battles.js')), import(src('config/ships.js')), import(src('config/hats.js')), import(src('config/endless.js')),
    import(src('sim/goals/index.js')), import(src('sim/abilities/index.js')), import(src('sim/events.js')),
    import(src('sim/terrain.js')), import(src('sim/hazards.js')), import(src('sim/land.js')), import(src('config/lands.js')),
    import(src('config/guns.js')), import(src('config/slots.js')), import(src('config/ammo.js')), import(src('config/flagship.js')),
  ]);
  return {
    BATTLES: battles.BATTLES, REGIONS: battles.REGIONS, FLEET_SLOTS: battles.FLEET_SLOTS,
    TYPES: ships.TYPES, HATS: hats.HATS, HAT_ORDER: hats.HAT_ORDER,
    ENDLESS: endless.ENDLESS, waveEnemies: endless.waveEnemies,
    GOALS: goals.GOALS, ABILITIES: abilities.ABILITIES, WHEN: events.WHEN, DO: events.DO,
    TERRAIN: terrain.TERRAIN, fleetLayout: terrain.fleetLayout, SHOAL: terrain.SHOAL, REEF: terrain.REEF,
    RAKE: hazards.RAKE, CRIT: hazards.CRIT,
    LANDMARKS: land.LANDMARKS, LAND_FIELDS: land.LAND_FIELDS, LANDMARK_PLACE: land.LANDMARK_PLACE, LAND_STYLES: land.LAND_STYLES,
    LANDS: lands.LANDS, landOf: land.landOf, checkLand: land.checkLand,
    // Guns and slots (src/config/guns.js, src/config/slots.js, src/config/flagship.js).
    GUNS: guns.GUNS, GUN_PARAMS: guns.GUN_PARAMS, POSITIONS: slots.POSITIONS, SLOT_PARAMS: slots.SLOT_PARAMS, WEIGHT: slots.WEIGHT,
    checkLoadout: slots.checkLoadout, checkSlots: slots.checkSlots, loadoutWeight: slots.loadoutWeight, accepts: slots.accepts, FLAGSHIP: flagship.FLAGSHIP,
    AMMO: ammo.AMMO,
  };
}
