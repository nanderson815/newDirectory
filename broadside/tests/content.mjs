// Content check (node only, no browser, about a second): validates every battle, ship type, hat and endless
// wave against the goal/ability/event registries, proves the validator catches common mistakes, and checks
// docs/PRIMITIVES.md is up to date with the registries.
//
//   npm run check
import fs from 'fs';
import { loadContent } from '../scripts/registries.mjs';
import { renderPrimitives, DOC } from '../scripts/primitives.mjs';
import { validateContent } from '../src/config/validate.js';
import { check } from './lib.mjs';

const failures = [];
const C = await loadContent();

console.log('content:');
const problems = validateContent(C);
for (const p of problems) console.log('       ' + p);
check(problems.length === 0, `battles, ship types, hats and endless waves are valid (${C.BATTLES.length} battles, ${problems.length} problems)`, failures);

// ---------- the validator catches mistakes ----------
// Each case breaks a copy of one battle (or table) and expects a message mentioning `expect`.
console.log('validator catches:');
const clone = (v) => structuredClone(v);
const find = (pred) => C.BATTLES.find(pred);
const goalsOf = (B) => B.goals || [{ kind: B.goal || 'sink' }];
const firstAbility = Object.keys(C.ABILITIES)[0];
const firstWhen = Object.keys(C.WHEN)[0], firstDo = Object.keys(C.DO)[0];
const kindWithParams = Object.keys(C.GOALS).find((k) => Object.keys(C.GOALS[k].params || {}).length);
const kindWithNeed = Object.keys(C.GOALS).find((k) => 'need' in (C.GOALS[k].params || {}));
const firstType = Object.keys(C.TYPES)[0];
const plain = find((B) => B.enemy.length && !B.goals);

function expectCaught(label, mutate, expect, base = plain) {
  if (!base) { check(true, `${label} (skipped: no battle to break)`, failures); return; }
  const B = clone(base);
  const extra = mutate(B) || {};
  const got = validateContent({ ...C, ...extra, BATTLES: extra.BATTLES || C.BATTLES.map((b) => (b.id === base.id ? B : b)) });
  const hit = got.find((m) => m.includes(expect));
  check(!!hit, `${label}${hit ? `: "${hit}"` : ` (expected a problem mentioning "${expect}", got ${JSON.stringify(got)})`}`, failures);
}

expectCaught('unknown ship type', (B) => { B.enemy[0].type = 'brigantine'; }, "unknown ship type 'brigantine'");
expectCaught('unknown ability', (B) => { B.enemy[0].abilities = { cannonade: true }; }, "unknown ability");
expectCaught('unknown ability param', (B) => { B.enemy[0].abilities = { [firstAbility]: { oomph: 3 } }; }, "unknown param 'oomph'");
expectCaught('ability param of the wrong type', (B) => {
  const [k] = Object.entries(C.ABILITIES[firstAbility].defaults || {}).find(([, v]) => typeof v === 'number') || [];
  B.enemy[0].abilities = { [firstAbility]: { [k]: 'lots' } };
}, 'should be a number');
expectCaught('launcher-style ability with an unknown ship type', (B) => {
  const id = Object.keys(C.ABILITIES).find((a) => 'type' in (C.ABILITIES[a].params || {}));
  B.enemy[0].abilities = { [id]: { type: 'dragon' } };
}, "unknown ship type 'dragon'");
expectCaught('unknown event key', (B) => { B.events = [{ [firstWhen]: 5, kaboom: true, [firstDo]: C.DO.banner ? ['x'] : [] }]; }, "unknown key 'kaboom'");
expectCaught('event with no action', (B) => { B.events = [{ [firstWhen]: 5 }]; }, 'has no action');
expectCaught('bad ship in an event spawn', (B) => { B.events = [{ [firstWhen]: 5, spawn: [{ type: 'raft', name: 'Kon-Tiki' }] }]; }, "unknown ship type 'raft'");
expectCaught('unknown goal kind', (B) => { B.goals = [{ kind: 'conquer' }]; }, "unknown goal kind 'conquer'");
expectCaught('unknown goal param', (B) => { B.goals = [{ kind: kindWithParams, flavour: 'salty' }]; }, "unknown param 'flavour'");
expectCaught('missing required goal param', (B) => { B.goals = [{ kind: kindWithParams }]; }, 'missing required param');
expectCaught('goal need larger than its list', (B) => { B.goals.find((o) => 'need' in o).need = 99; }, 'need 99 is more than',
  find((B) => goalsOf(B).some((o) => o.kind === kindWithNeed && 'need' in o)));
expectCaught('duplicate battle id', (B) => ({ BATTLES: [...C.BATTLES, B] }), 'duplicate battle id');
expectCaught('unknown region', (B) => { B.region = 'atlantis'; }, "unknown region 'atlantis'");
expectCaught('position off the map', (B) => { B.enemy[0].x = 1.4; }, 'x must be a map fraction');
expectCaught('ship on an island', (B) => { B.enemy[0].x = B.islands[0].x; B.enemy[0].y = B.islands[0].y; }, 'on (or touching) island 0');
expectCaught('fort on a missing island', (B) => { B.forts = [{ island: 9, name: 'Fort Nowhere', hp: 100, guns: 2, need: 10 }]; }, 'is not an index into islands');
expectCaught('missing ai field', (B) => { delete B.ai.dmgMul; }, 'ai.dmgMul');
expectCaught('missing reward', (B) => { delete B.reward; }, 'reward must be gold');
expectCaught('unknown battle hat', (B) => { B.hat = 'sombrero'; }, "hat 'sombrero' is not in HATS");
const boss = find((B) => B.goal === 'boss');
expectCaught('boss battle with two bosses', (B) => { B.enemy.find((e) => !e.boss).boss = { captain: 'X', title: 'Y', hat: B.hat }; }, 'exactly one enemy ship with boss', boss);
expectCaught('boss with an unknown hat', (B) => { B.enemy.find((e) => e.boss).boss.hat = 'fez'; }, "boss hat 'fez' is not in HATS", boss);
expectCaught('ship type missing a stat', () => { const T = clone(C.TYPES); delete T[firstType].hp; return { TYPES: T }; }, `TYPES.${firstType}: hp must be`);
expectCaught('ship type with an unknown ability', () => { const T = clone(C.TYPES); T[firstType].abilities = { teleport: true }; return { TYPES: T }; }, `TYPES.${firstType} ability 'teleport'`);
expectCaught('bad endless wave', () => ({ waveEnemies: (n) => C.waveEnemies(n).map((d) => ({ ...d, type: n === 3 ? 'canoe' : d.type })) }), "endless wave 3 ship 0");

// Worlds and bonus objectives (src/config/worlds.js, src/sim/goals/index.js).
console.log('worlds:');
expectCaught('battle in an unknown world', (B) => { B.world = 'atlantis'; }, "world 'atlantis' is not in WORLDS");
expectCaught('battle in another world\'s region', (B) => { B.region = 'straits'; }, "region 'straits' belongs to world 'med'");
expectCaught('world unlocked by a missing battle', () => ({ WORLDS: C.WORLDS.map((W, i) => (i ? { ...W, unlock: { won: 'eldorado' } } : W)) }), "unlock.won 'eldorado' is not a battle id");
expectCaught('bonus as the main goal', (B) => { B.goals = [{ kind: 'sink', bonus: true }]; }, "the first goal is the main one and can't be a bonus");
expectCaught('bonus gold without bonus', (B) => { B.goals = [{ kind: 'sink' }, { kind: 'timer', secs: 90, gold: 50 }]; }, 'add bonus: true');
expectCaught('a calm out of range', (B) => { B.breeze = 0; }, 'breeze must be a wind strength');
expectCaught('unknown faction', (B) => { B.faction = 'venice'; }, "unknown faction 'venice'");

// Guns and slots (src/config/guns.js, src/config/slots.js): ship defs' loadouts, the gun table, class slot tables.
console.log('guns and slots:');
const slotted = find((B) => B.enemy.some((e) => C.TYPES[e.type] && C.TYPES[e.type].slots));
const great = (B) => B.enemy.find((e) => C.TYPES[e.type].slots);
expectCaught('loadout with an unknown gun', (B) => { great(B).loadout = { portUpper: 'basilisk' }; }, "unknown gun 'basilisk' in portUpper", slotted);
expectCaught('loadout with a gun the slot will not take', (B) => { great(B).loadout = { bow: 'mortar' }; }, "bow is a bow slot and does not take 'mortar'", slotted);
expectCaught('carronades on the lower tier', (B) => { great(B).loadout = { portLower: 'carronade' }; }, "portLower is a broadside slot and does not take 'carronade'", slotted);
expectCaught('overweight loadout', (B) => {
  great(B).loadout = { portLower: 'demicannon', starboardLower: 'demicannon', forecastle: 'mortar', quarterdeck: 'mortar' };
}, 'loadout: overweight', slotted);
expectCaught('loadout with an unknown slot', (B) => { great(B).loadout = { orlop: 'long' }; }, "unknown slot 'orlop'", slotted);
expectCaught('loadout on a simple class names a slot she lacks', (B) => { B.enemy[0].type = 'sloop'; B.enemy[0].loadout = { stern: 'sternChaser' }; }, "unknown slot 'stern'");
expectCaught('gun with an unknown field', () => ({ GUNS: { ...C.GUNS, long: { ...C.GUNS.long, calibre: 18 } } }), "GUNS.long: unknown field 'calibre'");
expectCaught('gun that fits nowhere', () => ({ GUNS: { ...C.GUNS, swivel: { ...C.GUNS.swivel, fits: ['masthead'] } } }), 'GUNS.swivel: fits must list positions');
expectCaught('gun loading a shot that does not exist', () => ({ GUNS: { ...C.GUNS, carronade: { ...C.GUNS.carronade, shot: ['round', 'canister'] } } }), "shot 'canister' is not in AMMO");
{
  const id = Object.keys(C.TYPES).find((t) => C.TYPES[t].slots);
  expectCaught('class slot that takes a gun it cannot mount', () => {
    const T = clone(C.TYPES); T[id].slots.bow.accepts = ['bowChaser', 'demicannon']; return { TYPES: T };
  }, `TYPES.${id}: slot 'bow': accepts 'demicannon', which does not fit a bow slot`);
  expectCaught('class whose default loadout is overweight', () => { const T = clone(C.TYPES); T[id].tons = 20; return { TYPES: T }; }, 'the default loadout weighs');
}

// Looks (src/config/looks.js): a ship def's `look`, and the catalogue's own tables.
console.log('looks:');
expectCaught('look with an unknown paint', (B) => { B.enemy[0].look = { paint: 'tartan' }; }, "look: unknown paint \"tartan\"");
expectCaught('look with an unknown field', (B) => { B.enemy[0].look = { cape: 'velvet' }; }, "look: unknown field 'cape'");
expectCaught('look with too many lanterns', (B) => { B.enemy[0].look = { lanterns: 7 }; }, 'look: lanterns must be 1, 2 or 3');
{
  const L = C.LOOK_CATALOGUE, P = [];
  for (const [field, cat] of Object.entries(L)) {
    for (const [id, it] of Object.entries(cat)) {
      if (!it.name) P.push(`${field}.${id} has no name`);
      if (!it.foe && !it.about) P.push(`${field}.${id} has no line for the ledger`);
      if (!it.foe && it.hat === undefined && typeof it.cost !== 'number') P.push(`${field}.${id} needs a cost or a hat`);
      if (it.hat && !C.HATS[it.hat]) P.push(`${field}.${id}: unknown hat '${it.hat}'`);
    }
  }
  for (const [fac, pal] of Object.entries(C.FACTION_LOOKS)) for (const [k, list] of Object.entries(pal)) for (const v of list) P.push(...C.checkLook({ [k]: v }, { foe: true }).map((m) => `FACTION_LOOKS.${fac}: ${m}`));
  for (const [hat, look] of Object.entries(C.BOSS_LOOKS)) { if (!C.HATS[hat]) P.push(`BOSS_LOOKS.${hat}: no such hat`); P.push(...C.checkLook(look, { foe: true }).map((m) => `BOSS_LOOKS.${hat}: ${m}`)); }
  for (const p of P) console.log('       ' + p);
  check(P.length === 0, `the looks catalogue, faction palettes and boss looks are sound (${P.length} problems)`, failures);
  const save = C.checkLook({ paint: 'spain' });
  check(save.some((m) => m.includes('only for the enemy')), `a save may not dress your ship in the enemy's fashions ("${save[0]}")`, failures);
}

// Land (src/config/lands.js, src/sim/land.js LANDMARKS): a battle's own `land` is checked like a LANDS entry.
console.log('land:');
expectCaught('unknown landmark kind', (B) => { B.land = { landmarks: [{ kind: 'pyramid', island: 0 }] }; }, 'unknown kind "pyramid"');
expectCaught('landmark on a missing island', (B) => { B.land = { landmarks: [{ kind: 'church', island: 9 }] }; }, 'is not an index into islands');
expectCaught('landmark past the shore', (B) => { B.land = { landmarks: [{ kind: 'ruin', island: 0, d: 0.95 }] }; }, 'past its shore');
expectCaught('unknown landmark param', (B) => { B.land = { landmarks: [{ kind: 'town', island: 0, colour: 'pink' }] }; }, "unknown param 'colour'");
expectCaught('two landmarks in one spot', (B) => { B.land = { landmarks: [{ kind: 'church', island: 0 }, { kind: 'windmill', island: 0 }] }; }, 'overlaps landmarks[0]');
expectCaught('wreck in open water', (B) => { B.land = { landmarks: [{ kind: 'wreck', x: 0.5, y: 0.95 }] }; }, 'must lie on a reef, a shoal or an island');
expectCaught('unknown land style', (B) => { B.land = { style: 'arctic' }; }, 'style must be one of');
expectCaught('land for a battle that does not exist', () => ({ LANDS: { ...C.LANDS, atlantis: {} } }), 'LANDS.atlantis');

// Geography (src/sim/terrain.js TERRAIN).
const ship0 = (B) => B.enemy[0];
expectCaught('ship on a coast', (B) => { B.coast = { side: 'top', depth: 0.25 }; ship0(B).y = 0.05; }, 'is on (or touching) the top coast');
expectCaught('big ship aground on a shoal', (B) => { B.shoals = [{ x: ship0(B).x, y: ship0(B).y, r: 30 }]; ship0(B).type = 'frigate'; }, 'starts aground on shoal 0');
expectCaught('fleet slot on a shoal', (B) => { B.shoals = [{ x: 0.5, y: 0.8, r: 30 }]; }, 'fleet slot 0: starts aground on shoal 0', find((B) => !B.player && B.enemy.length));
expectCaught('ship on a reef', (B) => { B.reefs = [{ x: ship0(B).x, y: ship0(B).y, r: 10, stretch: 3 }]; }, 'starts on reef 0');
expectCaught('ship on a long island', (B) => { B.islands = [{ x: ship0(B).x + 0.06, y: ship0(B).y, r: 20, stretch: 4, angle: 0 }]; }, 'is on (or touching) island 0');
expectCaught('coast on an unknown side', (B) => { B.coast = { side: 'west', depth: 0.2 }; }, "side must be one of");
expectCaught('island stretched too far', (B) => { B.islands[0].stretch = 20; }, 'stretch must be a number from 1 to 8');
expectCaught('unknown shoal field', (B) => { B.shoals = [{ x: 0.5, y: 0.5, r: 20, depth: 3 }]; }, "shoals[0]: unknown field 'depth'");
expectCaught('unknown fleetAt', (B) => { B.fleetAt = 'astern'; }, 'fleetAt must be bottom');
expectCaught('fleetAt slot on an island', (B) => { B.fleetAt = 'center'; B.islands = [{ x: 0.5, y: 0.5, r: 30 }]; }, 'fleet slot 0: is on (or touching) island 0', find((B) => !B.player && B.enemy.length));
{
  // A sloop may start on a shoal; she sails over it.
  const B = clone(plain);
  B.shoals = [{ x: B.enemy[0].x, y: B.enemy[0].y, r: 30 }]; B.enemy[0].type = 'sloop';
  const got = validateContent({ ...C, BATTLES: C.BATTLES.map((b) => (b.id === plain.id ? B : b)) }).filter((m) => m.includes('shoal'));
  check(got.length === 0, `a sloop may start on a shoal (${got.join('; ') || 'no complaint'})`, failures);
}

// ---------- navigable (src/sim/navgrid.js, tests/navcheck.mjs) ----------
// Every objective of every battle can be reached by the biggest ship you could bring, through channels with
// room to spare, and every ship starts in open water.
console.log('navigation:');
{
  const { navCheck } = await import('./navcheck.mjs');
  const nav = await navCheck(C);
  for (const p of nav.slice(0, 40)) console.log('       ' + p);
  if (nav.length > 40) console.log(`       ... and ${nav.length - 40} more (node tests/navcheck.mjs)`);
  check(nav.length === 0, `every battle's objectives are reachable for the biggest ship (${nav.length} problems)`, failures);
}
{
  // The planner itself: a ship walled off from the far side of a long island is routed round its end.
  const { navCheck } = await import('./navcheck.mjs');
  const B = clone(plain);
  B.islands = [{ x: 0.56, y: 0.5, r: 40, stretch: 8, angle: 0 }];
  B.coast = [{ side: 'left', depth: 0.3, rough: 0 }];
  const got = await navCheck({ ...C, BATTLES: [B] });
  check(got.some((m) => m.includes('no route')), `the check catches a strait walled off by a long island (${got[0] || 'nothing caught'})`, failures);
}

// ---------- generated docs ----------
console.log('docs:');
const fresh = renderPrimitives(C);
const onDisk = fs.existsSync(DOC) ? fs.readFileSync(DOC, 'utf8') : '';
check(fresh === onDisk, 'docs/PRIMITIVES.md matches the registries (if not: npm run docs)', failures);

console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
