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
expectCaught('ship on a long island', (B) => { B.islands = [{ x: ship0(B).x + 0.15, y: ship0(B).y, r: 20, stretch: 4, angle: 0 }]; }, 'is on (or touching) island 0');
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

// ---------- generated docs ----------
console.log('docs:');
const fresh = renderPrimitives(C);
const onDisk = fs.existsSync(DOC) ? fs.readFileSync(DOC, 'utf8') : '';
check(fresh === onDisk, 'docs/PRIMITIVES.md matches the registries (if not: npm run docs)', failures);

console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
