// Generates docs/PRIMITIVES.md, the reference of every building block a battle can use, straight from the
// registries: goals (src/sim/goals/), abilities (src/sim/abilities/), event conditions and actions
// (src/sim/events.js), ship types (src/config/ships.js) and hats. tests/content.mjs fails if the committed
// file is stale, so run this after adding or changing a primitive:
//
//   npm run docs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadContent } from './registries.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DOC = path.resolve(here, '..', 'docs', 'PRIMITIVES.md');

const cell = (v) => String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const code = (v) => '`' + (typeof v === 'string' ? v : JSON.stringify(v)) + '`';
const table = (head, rows) => rows.length
  ? [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n')
  : '';

// Optional goal hooks and flags, in the order docs/EXTENDING.md explains them.
const GOAL_HOOKS = ['setup', 'update', 'failed', 'hud', 'sunk', 'escaped', 'weigh', 'steer', 'aiForts', 'exit', 'tip', 'endless', 'validate'];
const ABILITY_HOOKS = ['init', 'update', 'steer', 'wind', 'sunk'];
const STATS = ['hp', 'guns', 'reload', 'speed', 'turn', 'range', 'marines', 'masts'];

// Guns (src/config/guns.js), slot positions and the classes that declare slots (src/config/slots.js, flagship.js).
const GUN_BEHAVIOUR = ['auto', 'single', 'pellets', 'crewKill', 'repel', 'minRange', 'radius', 'burn', 'traverse'];
function renderGuns({ TYPES, GUNS, GUN_PARAMS, POSITIONS, SLOT_PARAMS, WEIGHT, FLAGSHIP, loadoutWeight, accepts }) {
  const out = ['## Guns and slots', '',
    'From `GUNS` in `src/config/guns.js` and `src/config/slots.js`. A class with `slots` (the great ship) fits one gun kind',
    'per slot, chosen slot by slot at the shipyard and saved as the fleet ship\'s `loadout` (`{ slotId: gunId }`); a battle ship',
    'def may carry a `loadout` too. Every other class has implicit slots: `port` and `starboard` broadsides of its `guns`',
    'long guns (firing with the class\'s own `range` and `reload`) and a `bow` slot when it has chasers; a battle may still',
    'refit those (an enemy frigate with carronades to port). Numbers are per gun; range is with the gun\'s first shot type',
    '(chain and grape scale it by their `range`), arc is the half-angle either side of the slot\'s facing.', ''];
  out.push(table(['gun', 'label', 'fits', 'fires', 'range', 'reload', 'dmg', 'weight', 'arc', 'shot', 'crew', 'cost', 'render', 'behaviour'],
    Object.entries(GUNS).map(([id, G]) => [code(id), G.label, G.fits.join(', '), G.fires, G.range, G.reload, G.dmg, G.weight, `${G.arc}°`,
      G.shot.length ? G.shot.join(', ') : '(its own)', G.crew, G.cost, `${G.render.barrel} × ${G.render.bore}`,
      GUN_BEHAVIOUR.filter((k) => G[k] != null && G[k] !== false).map((k) => (G[k] === true ? k : `${k} ${G[k]}`)).join(', ')])), '');
  out.push(Object.entries(GUNS).map(([id, G]) => `- ${code(id)}: ${G.about}`).join('\n'), '');
  out.push('Gun fields:', '', table(['field', 'description'], Object.entries(GUN_PARAMS).map(([k, d]) => [code(k), d])), '');
  out.push('Positions a slot can take:', '', table(['pos', 'facing', 'description'], Object.entries(POSITIONS).map(([k, P]) => [code(k),
    k === 'broadside' ? 'abeam (port -90°, starboard 90°)' : P.face == null ? 'all round' : `${P.face}°`, P.about])), '');
  out.push('Slot fields:', '', table(['field', 'description'], Object.entries(SLOT_PARAMS).map(([k, d]) => [code(k), d])), '');
  for (const [id, T] of Object.entries(TYPES)) {
    if (!T.slots) continue;
    const def = loadoutWeight ? loadoutWeight(T, {}) : '?';
    out.push(`### \`${id}\` slots`, '', `${T.label}: carries at most ${T.tons} tons of guns; the default loadout weighs ${def}. Her speed (${T.speed}) and turn (${T.turn})`,
      `are with the default loadout; every ton more or less moves them by ${WEIGHT.speed} and ${WEIGHT.turn} of themselves per ${T.tons} tons.`, '');
    out.push(table(['slot', 'label', 'pos', 'side / tier', 'guns', 'takes', 'default'], Object.entries(T.slots).map(([sid, sl]) => [code(sid), sl.label, sl.pos,
      [sl.side, sl.tier].filter(Boolean).join(' / '), sl.count, (accepts ? accepts(sl) : sl.accepts || []).join(', '), sl.default])), '');
  }
  if (FLAGSHIP) {
    out.push(`The campaign offers the \`${FLAGSHIP.type}\` once \`${FLAGSHIP.unlock}\` is won: a ${Object.entries(FLAGSHIP.from).map(([c, g]) => `${c} rebuilds for ${g} gold`).join(', a ')},`,
      'one to a squadron. Fitting a slot costs the gun\'s price times the guns it takes.', '');
  }
  return out;
}

export function renderPrimitives(C) {
  // Only the registries and the type/hat tables go in, never the battles, so rebalancing battles.js never
  // makes this file stale.
  const { TYPES, HATS, GOALS, ABILITIES, WHEN, DO, TERRAIN, RAKE, CRIT, LANDMARKS = {}, LAND_FIELDS = {}, LANDMARK_PLACE = {} } = C;
  const { GUNS = {}, GUN_PARAMS = {}, POSITIONS = {}, SLOT_PARAMS = {}, WEIGHT = {}, FLAGSHIP = null } = C;
  const out = [
    '# Broadside primitives',
    '',
    '<!-- Generated by scripts/primitives.mjs (npm run docs) from the registries. Do not edit by hand. -->',
    '',
    'Every building block a battle in `src/config/battles.js` can use. How to combine them, and how to add new',
    'ones: [EXTENDING.md](EXTENDING.md).',
    '',
    `- [Goals](#goals): ${Object.keys(GOALS).map(code).join(', ')}`,
    `- [Abilities](#abilities): ${Object.keys(ABILITIES).map(code).join(', ')}`,
    `- [Event conditions](#event-conditions-when): ${Object.keys(WHEN).map(code).join(', ')}`,
    `- [Event actions](#event-actions-do): ${Object.keys(DO).map(code).join(', ')}`,
    `- [Ship types](#ship-types): ${Object.keys(TYPES).map(code).join(', ')}`,
    `- [Guns and slots](#guns-and-slots): ${Object.keys(GUNS).map(code).join(', ')}`,
    `- [Hats](#hats): ${Object.keys(HATS).map(code).join(', ')}`,
    `- [Geography and openings](#geography-and-openings): ${Object.keys(TERRAIN).map(code).join(', ')}`,
    `- [Land and landmarks](#land-and-landmarks): ${Object.keys(LANDMARKS).map(code).join(', ')}`,
    '- [Combat rules](#combat-rules): raking fire, critical hits',
    '',
    '## Goals',
    '',
    'A battle lists `goals: [{ kind, ...params }]` (all must be met) or the shorthand `goal: \'boss\'`; with',
    'neither it is `sink`. Params marked optional (their description says "default") may be left out.',
    '',
  ];
  for (const [id, g] of Object.entries(GOALS)) {
    out.push(`### \`${id}\``, '', g.about || '(no description)', '');
    const params = Object.entries(g.params || {});
    out.push(params.length ? table(['param', 'description'], params.map(([k, d]) => [code(k), d])) : 'No params.', '');
    const hooks = GOAL_HOOKS.filter((h) => g[h] != null && g[h] !== false);
    if (hooks.length) out.push(`Hooks: ${hooks.map((h) => (typeof g[h] === 'function' ? code(h) : `${code(h)} (${JSON.stringify(g[h])})`)).join(', ')}.`, '');
    if (g.lost) out.push(`Can be lost: ${Object.keys(g.lost).map(code).join(', ')}.`, '');
  }

  out.push('## Abilities', '', 'A ship type (`abilities` in TYPES) or one ship in a battle (`abilities` on its def) carries',
    '`{ abilityId: config | true }`; `true` takes the defaults, and a battle ship\'s config is merged over its type\'s.', '');
  for (const [id, A] of Object.entries(ABILITIES)) {
    out.push(`### \`${id}\``, '', A.about || '(no description)', '');
    const keys = [...new Set([...Object.keys(A.params || {}), ...Object.keys(A.defaults || {})])];
    out.push(keys.length
      ? table(['param', 'default', 'description'], keys.map((k) => [code(k), A.defaults && k in A.defaults ? code(A.defaults[k]) : '(required)', (A.params || {})[k] || '']))
      : 'No params.', '');
    const hooks = ABILITY_HOOKS.filter((h) => typeof A[h] === 'function');
    if (hooks.length) out.push(`Hooks: ${hooks.map(code).join(', ')}.`, '');
    const types = Object.entries(TYPES).filter(([, T]) => T.abilities && T.abilities[id]).map(([t]) => code(t));
    if (types.length) out.push(`Ship types that carry it: ${types.join(', ')}.`, '');
  }

  out.push('## Event conditions (WHEN)', '', '`events: [{ ...conditions, ...actions }]`: an event fires once, the first tick all of its conditions',
    'hold (no conditions: at the start), and runs its actions in order.', '');
  out.push(table(['key', 'fires when'], Object.entries(WHEN).map(([k, w]) => [code(k), w.about || ''])), '');
  out.push('## Event actions (DO)', '');
  out.push(table(['key', 'does'], Object.entries(DO).map(([k, d]) => [code(k), d.about || ''])), '');

  out.push('## Ship types', '', 'From `TYPES` in `src/config/ships.js`. Speed in units/sec, turn in rad/sec, reload in sec; L × B is',
    'length × beam. Enemy hulls are multiplied by the battle\'s `ai.hpMul` unless the ship sets `hp`.', '');
  out.push(table(['type', 'label', ...STATS, 'L × B', 'rig', 'abilities'], Object.entries(TYPES).map(([id, T]) => [
    code(id), T.label, ...STATS.map((k) => T[k]), `${T.L} × ${T.B}`, T.rig || 'square',
    T.abilities ? Object.entries(T.abilities).map(([a, c]) => (c === true ? a : `${a} ${JSON.stringify(c)}`)).join(', ') : '',
  ])), '');
  const extra = Object.entries(TYPES).flatMap(([id, T]) => Object.keys(T).filter((k) => !['label', 'L', 'B', 'rig', 'abilities', 'slots', 'tons', ...STATS].includes(k)).map((k) => `${code(id)}: ${code(k)} = ${code(T[k])}`));
  if (extra.length) out.push(`Other flags: ${extra.join('; ')}.`, '');
  const slotted = Object.entries(TYPES).filter(([, T]) => T.slots).map(([id]) => code(id));
  if (slotted.length) out.push(`Classes with gun slots (see [Guns and slots](#guns-and-slots)): ${slotted.join(', ')}.`, '');

  out.push(...renderGuns({ TYPES, GUNS, GUN_PARAMS, POSITIONS, SLOT_PARAMS, WEIGHT, FLAGSHIP, loadoutWeight: C.loadoutWeight, accepts: C.accepts }));

  out.push('## Hats', '', 'Won by finishing a battle that sets `hat` (bosses carry the same id in `boss.hat`).', '');
  out.push(table(['hat', 'name', 'from'], Object.entries(HATS).map(([id, h]) => [code(id), h.name, h.from])), '');

  out.push('## Geography and openings', '', 'Battle fields from `TERRAIN` in `src/sim/terrain.js`. Positions are portrait fractions and radii map',
    'units, as for islands; landscape turns the whole layout (coasts and long axes included). Ships may not start on',
    'land, on a reef, or (if they are big enough to ground) on a shoal; `npm run check` says so.', '');
  for (const [id, T] of Object.entries(TERRAIN)) {
    out.push(`### \`${id}\``, '', T.about, '');
    out.push(table([id === 'fleetAt' ? 'value' : 'field', 'description'], Object.entries(T.params).map(([k, d]) => [code(k), d])), '');
  }
  out.push('Example: a narrow channel between a coast and a long island, with shoals off the cape.', '', '```js',
    "coast: { side: 'left', depth: 0.2, capes: [{ at: 0.45, width: 0.3, depth: 0.1 }] },",
    'islands: [{ x: 0.72, y: 0.46, r: 34, stretch: 2.6, angle: 80 }],',
    'shoals: [{ x: 0.42, y: 0.3, r: 34, stretch: 1.6, angle: 20 }],',
    "reefs: [{ x: 0.55, y: 0.66, r: 12, stretch: 4, angle: -10 }], fleetAt: 'left',", '```', '');

  out.push('## Land and landmarks', '', 'The look of a battle\'s land and what stands on it: `src/config/lands.js`, keyed by battle id (or a battle def\'s own',
    '`land`), with landmark kinds from `LANDMARKS` in `src/sim/land.js`. Most are scenery; harbour (repairs), town (loot),',
    'peak and volcano (a lee that steals the wind) and lighthouse (sight in fog) change the battle. `npm run check`',
    'checks that each one fits on its land, inside the outline ships collide with.', '');
  out.push(table(['field', 'description'], Object.entries(LAND_FIELDS).map(([k, d]) => [code(k), d])), '');
  out.push('Every landmark is `{ kind, ...placement, ...params }`. Placement (one of island, coast, or x and y):', '');
  out.push(table(['field', 'description'], Object.entries(LANDMARK_PLACE).map(([k, d]) => [code(k), d])), '');
  for (const [id, M] of Object.entries(LANDMARKS)) {
    out.push(`### \`${id}\``, '', M.about, '');
    const params = Object.entries(M.params || {});
    if (params.length) out.push(table(['param', 'default', 'description'], params.map(([k, d]) => [code(k), M.defaults && k in M.defaults ? (M.defaults[k] === '' ? '(the region’s)' : code(M.defaults[k])) : '', d])), '');
  }
  out.push('Example: Port Royal under siege, its harbour patching your ships while Spanish mortars set the town alight.', '', '```js',
    "siege: {",
    "  style: 'port',",
    "  landmarks: [",
    "    { kind: 'town', island: 0, at: 150, d: 0.64, houses: 6, team: 'player', name: 'Port Royal' },",
    "    { kind: 'harbour', island: 0, at: -60, r: 80 },",
    "    { kind: 'lighthouse', island: 2, at: 0, d: 0.45 },",
    "  ],",
    "},", '```', '');

  out.push('## Combat rules', '', 'From `RAKE` and `CRIT` in `src/sim/hazards.js`.', '');
  out.push(`- **Raking fire.** A ball that flies within ${Math.round(RAKE.cone * 180 / Math.PI)}° of the target's bow-stern line has come in`,
    `  through her stern (×${RAKE.stern} damage) or her bow (×${RAKE.bow}). The hit shows "Raked!" over the ship. Enemy captains`,
    '  come in at an angle rather than bows-on to a broadside, and some (bosses more often) work round to cross your stern',
    '  while the broadside facing them is reloading.',
    `- **Critical hits.** Each round-shot ball that lands (bow chasers too; not chain or grape) has a ${CRIT.chance * 100}% chance`,
    `  of a lucky hit, ${CRIT.rakeChance * 100}% when it rakes (a stern rake finds the rudder twice as often):`,
    `  - *Mast down*: ${Math.round(CRIT.mastSlow * 100)}% slower for the rest of the battle (at worst ${Math.round(CRIT.mastMin * 100)}% speed); she always keeps her main mast, and the lost one lies toppled over the side (\`s.mastsDown\`).`,
    `  - *Rudder shot away*: the helm answers at ${CRIT.rudderTurn * 100}% for ${CRIT.rudderSecs} s (\`s.rudderT\`).`,
    `  - *Fire aboard*: ${CRIT.fireDps} hull a second for ${CRIT.fireSecs} s (\`s.fireT\`).`, '');
  return out.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const md = renderPrimitives(await loadContent());
  fs.mkdirSync(path.dirname(DOC), { recursive: true });
  fs.writeFileSync(DOC, md);
  console.log(`wrote ${path.relative(process.cwd(), DOC)}`);
}
