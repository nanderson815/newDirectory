// Content validator: checks the battle table, ship types, hats and endless waves against the primitive
// registries (goals, abilities, event conditions/actions) and returns a list of human-readable problems
// (empty = all good). It imports nothing, so it runs in node (tests/content.mjs, npm run check) and in the
// page (dev builds warn at boot). Everything it knows about goals, abilities and events comes from the
// registries passed in, so new primitives are picked up without touching this file:
//   - a goal/ability param is optional when the ability has a default for it or its description mentions
//     "default", "optional" or "omit"/"left out"; otherwise it is required;
//   - an ability param named `type` whose description says "ship type" must name a TYPES entry;
//   - a goal module may add its own checks as validate(o, B) returning a list of problem strings.
//
//   - geography fields (islands, shoals, reefs, coast, fleetAt) are checked by the TERRAIN registry
//     (src/sim/terrain.js): check(value, B) for the data, blocks(B, p, T, W, H) for ships that start on land,
//     aground or on a reef.
//
//   - a battle's land (src/config/lands.js by id, or its own `land`) is checked by checkLand from
//     src/sim/land.js: styles, relief, landmark kinds and params, and that each landmark fits on its land.
//
//   validateContent({ BATTLES, TYPES, HATS, REGIONS, GOALS, ABILITIES, WHEN, DO,
//                     waveEnemies?, ENDLESS?, HAT_ORDER?, FLEET_SLOTS?, TERRAIN?, fleetLayout?, LANDS?, landOf?, checkLand? })
//   (the ? ones add checks when given)
//
//   - guns and slots (src/config/guns.js, src/config/slots.js), when C.GUNS and C.checkLoadout are given: every gun
//     entry against GUN_PARAMS, every class's slot table (checkSlots), and every ship def's `loadout` against its
//     class (unknown slot or gun, a gun its slot won't take, overweight).

// The numbers makeShip() reads from a ship type.
const TYPE_STATS = ['L', 'B', 'hp', 'guns', 'reload', 'speed', 'turn', 'range', 'masts', 'marines'];
const POSITIVE_STATS = ['L', 'B', 'hp', 'speed', 'turn'];
// Enemy gunnery and hull multipliers every battle needs (see the header of battles.js).
const AI_FIELDS = ['spread', 'reloadMul', 'dmgMul', 'hpMul'];
// Nominal portrait maps (the real one depends on the screen) for "starts on an island" checks.
const MAPS = [[520, 1100], [620, 930]];
const ISLAND_MARGIN = 12;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isFrac = (v) => isNum(v) && v >= 0 && v <= 1;
const isStr = (v) => typeof v === 'string' && v.length > 0;
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const q = (v) => (typeof v === 'string' ? `'${v}'` : JSON.stringify(v));
const list = (o) => Object.keys(o).join(', ');
const optional = (desc, key, defaults) => (defaults && key in defaults) || /default|optional|omit|left out|leave out/i.test(String(desc || ''));
const shipDefList = (v) => Array.isArray(v) && v.length > 0 && v.every((d) => isObj(d) && 'type' in d);
const pointList = (v) => Array.isArray(v) && v.length > 0 && v.every((d) => isObj(d) && 'x' in d && 'y' in d && !('type' in d));

export function validateContent(C) {
  const { BATTLES = [], TYPES = {}, HATS = {}, REGIONS = [], GOALS = {}, ABILITIES = {}, WHEN = {}, DO = {} } = C;
  const P = [];
  const bad = (where, msg) => P.push(`${where}: ${msg}`);

  // ---------- abilities ----------
  function checkAbilities(where, spec) {
    if (spec == null) return;
    if (!isObj(spec)) { bad(where, 'abilities must be an object { abilityId: config | true }'); return; }
    for (const [id, cfg] of Object.entries(spec)) {
      const A = ABILITIES[id], at = `${where} ability '${id}'`;
      if (!A) { bad(at, `unknown ability (known: ${list(ABILITIES)})`); continue; }
      if (cfg === false) continue; // switched off
      if (cfg === true) required(at, A, {});
      else if (isObj(cfg)) {
        const params = A.params || {}, defaults = A.defaults || {};
        for (const [k, v] of Object.entries(cfg)) {
          if (!(k in params) && !(k in defaults)) { bad(at, `unknown param '${k}' (known: ${list({ ...params, ...defaults }) || 'none'})`); continue; }
          const d = defaults[k];
          if (isNum(d) && !isNum(v)) bad(at, `'${k}' should be a number, got ${q(v)}`);
          else if (typeof d === 'string' && typeof v !== 'string') bad(at, `'${k}' should be a string, got ${q(v)}`);
          else if (Array.isArray(d) && v !== null && !Array.isArray(v)) bad(at, `'${k}' should be a list or null, got ${q(v)}`);
          if (isNum(v) && v < 0) bad(at, `'${k}' should not be negative (${v})`);
        }
        required(at, A, cfg);
      } else bad(at, `config must be true or an object of params, got ${q(cfg)}`);
      // A ship type to put to sea (the launcher's `type`, described as a "ship type") must exist.
      const t = isObj(cfg) && 'type' in cfg ? cfg.type : cfg && A.defaults && A.defaults.type;
      if (t != null && /ship type/i.test((A.params || {}).type || '') && !TYPES[t]) bad(at, `unknown ship type ${q(t)} (known: ${list(TYPES)})`);
    }
  }
  function required(at, A, cfg) {
    for (const [k, desc] of Object.entries(A.params || {})) {
      if (!(k in cfg) && !optional(desc, k, A.defaults)) bad(at, `missing required param '${k}' (${desc})`);
    }
  }

  // ---------- ships ----------
  // opts: { B (for island checks), loose (positions optional, as for spawned ships), nullHat (boss.hat may be null) }
  function checkShip(where, d, opts = {}) {
    if (!isObj(d)) { bad(where, `ship def must be an object, got ${q(d)}`); return; }
    const at = `${where}${isStr(d.name) ? ` (${d.name})` : ''}`;
    if (!TYPES[d.type]) bad(at, `unknown ship type ${q(d.type)} (known: ${list(TYPES)})`);
    if (!isStr(d.name)) bad(at, 'needs a name');
    for (const k of ['x', 'y']) {
      if (d[k] === undefined ? !opts.loose : !isFrac(d[k])) bad(at, `${k} must be a map fraction in [0, 1], got ${q(d[k])}`);
    }
    if (d.h === undefined ? !opts.loose : !isNum(d.h)) bad(at, `h (heading in degrees) must be a number, got ${q(d.h)}`);
    for (const k of ['hp', 'reloadMul']) if (d[k] !== undefined && !(isNum(d[k]) && d[k] > 0)) bad(at, `${k} must be a positive number, got ${q(d[k])}`);
    if (d.chasers !== undefined && !(Number.isInteger(d.chasers) && d.chasers >= 0)) bad(at, `chasers must be a whole number, got ${q(d.chasers)}`);
    if (d.team !== undefined && d.team !== 'player' && d.team !== 'enemy') bad(at, `team must be 'player' or 'enemy', got ${q(d.team)}`);
    if (d.boss != null) {
      const b = d.boss;
      if (!isObj(b)) bad(at, 'boss must be { captain, title, hat }');
      else {
        if (!isStr(b.captain)) bad(at, 'boss needs a captain');
        if (!isStr(b.title)) bad(at, 'boss needs a title');
        if (!(b.hat === null && opts.nullHat) && !HATS[b.hat]) bad(at, `boss hat ${q(b.hat)} is not in HATS (known: ${list(HATS)})`);
      }
    }
    checkAbilities(at, d.abilities);
    if (d.loadout !== undefined && C.checkLoadout && TYPES[d.type]) {
      for (const m of C.checkLoadout(TYPES[d.type], d.loadout, { chasers: d.chasers || 0 })) bad(at, m);
    }
    if (opts.B) onIsland(at, opts.B, { ...d, ship: true });
  }
  // Ships (and points like chests) mustn't start on land; a ship mustn't start aground or on a reef. p.type
  // (when known) lets the shoal check spare small ships.
  function onIsland(at, B, p) {
    if (!isFrac(p.x) || !isFrac(p.y)) return;
    if (C.TERRAIN) {
      const T = p.type ? TYPES[p.type] || null : null;
      for (const [key, R] of Object.entries(C.TERRAIN)) {
        if (!R.blocks || ((key === 'shoals' || key === 'reefs') && !p.ship)) continue;
        const why = MAPS.map(([W, H]) => R.blocks(B, p, T, W, H)).find(Boolean);
        if (why) bad(at, why);
      }
      return;
    }
    if (!Array.isArray(B.islands)) return;
    B.islands.forEach((is, i) => {
      if (!is || !isNum(is.r) || !isFrac(is.x) || !isFrac(is.y)) return;
      if (MAPS.some(([W, H]) => Math.hypot((p.x - is.x) * W, (p.y - is.y) * H) < is.r + ISLAND_MARGIN)) bad(at, `is on (or touching) island ${i}`);
    });
  }

  // ---------- goals ----------
  const KIND_RULES = {
    boss(o, B) {
      const bosses = (B.enemy || []).filter((e) => e && e.boss);
      if (bosses.length !== 1) return [`a boss battle needs exactly one enemy ship with boss: { captain, title, hat }, found ${bosses.length}`];
      const hat = bosses[0].boss.hat;
      const out = [];
      if (B.hat !== hat) out.push(`battle hat ${q(B.hat)} should match the boss's hat ${q(hat)} (the chart shows and awards the battle's, the briefing the boss's)`);
      if (B.goal !== 'boss') out.push("lists a 'boss' goal but has no goal: 'boss'; the chart and briefing only treat goal: 'boss' battles as boss fights (add it alongside goals)");
      return out;
    },
    capture: (o, B) => ((B.forts || []).some((f) => f && f.team !== 'player') ? [] : ['a capture goal needs at least one enemy fort']),
    hold: (o, B) => ((B.forts || []).some((f) => f && f.team === 'player') ? [] : ["a hold goal needs at least one fort with team: 'player'"]),
    timer: (o, B, goals) => (goals.some((g) => g && g.kind !== 'timer') ? [] : ['a timer only limits the other goals; on its own it is won at once (add another goal)']),
    breakthrough: (o, B) => (o.ship !== undefined && Array.isArray(B.player) && o.ship >= B.player.length ? [`ship ${o.ship} is past the end of the player fleet`] : []),
  };
  const goalRules = (o, g, B, goals) => [...(KIND_RULES[o.kind] ? KIND_RULES[o.kind](o, B, goals) : []), ...(g.validate ? g.validate(o, B) || [] : [])];
  function checkGoals(where, B) {
    if (B.goal !== undefined && !GOALS[B.goal]) bad(where, `unknown goal ${q(B.goal)} (known: ${list(GOALS)})`);
    if (B.goals === undefined) {
      // The shorthand goal: 'boss' (or 'sink' when there is neither) still gets the kind's own checks.
      const o = { kind: B.goal === undefined ? 'sink' : B.goal }, g = GOALS[o.kind];
      if (g) for (const m of goalRules(o, g, B, [o])) bad(where, `${o.kind}: ${m}`);
      return;
    }
    if (!Array.isArray(B.goals) || !B.goals.length) { bad(where, 'goals must be a non-empty list of { kind, ...params }'); return; }
    if (B.goal !== undefined && !B.goals.some((o) => o && o.kind === B.goal)) bad(where, `goal ${q(B.goal)} is ignored because goals is set and does not include it`);
    B.goals.forEach((o, i) => {
      const at = `${where} goals[${i}]`;
      if (!isObj(o)) { bad(at, 'must be { kind, ...params }'); return; }
      const g = GOALS[o.kind];
      if (!g) { bad(at, `unknown goal kind ${q(o.kind)} (known: ${list(GOALS)})`); return; }
      const params = g.params || {};
      const arrays = [];
      for (const [k, v] of Object.entries(o)) {
        if (k === 'kind') continue;
        if (!(k in params)) { bad(at, `${o.kind}: unknown param '${k}' (known: ${list(params) || 'none'})`); continue; }
        if (typeof v === 'number' && !(isNum(v) && v >= 0)) bad(at, `${o.kind}: '${k}' must be a non-negative number, got ${v}`);
        if (Array.isArray(v)) arrays.push(k);
        if (shipDefList(v)) v.forEach((d, j) => checkShip(`${at} ${k}[${j}]`, d, { B }));
        else if (pointList(v)) {
          v.forEach((p, j) => {
            if (!isFrac(p.x) || !isFrac(p.y)) bad(at, `${o.kind}: ${k}[${j}] must have x, y map fractions in [0, 1]`);
            else onIsland(`${at} ${k}[${j}]`, B, p);
          });
        } else if (Array.isArray(v) && !v.length) bad(at, `${o.kind}: '${k}' is empty`);
      }
      for (const [k, desc] of Object.entries(params)) {
        if (!(k in o) && !optional(desc, k)) bad(at, `${o.kind}: missing required param '${k}' (${desc})`);
      }
      // `need` counts things out of the goal's one list (chests, merchantmen).
      if ('need' in o) {
        if (!(Number.isInteger(o.need) && o.need >= 1)) bad(at, `${o.kind}: need must be a whole number of at least 1, got ${q(o.need)}`);
        else if (arrays.length === 1 && o.need > o[arrays[0]].length) bad(at, `${o.kind}: need ${o.need} is more than the ${o[arrays[0]].length} in '${arrays[0]}'`);
      }
      for (const m of goalRules(o, g, B, B.goals)) bad(at, `${o.kind}: ${m}`);
    });
  }

  // ---------- events ----------
  const count = (n) => (isNum(n) && n >= 0 ? [] : [`should be a number of at least 0, got ${q(n)}`]);
  const EVENT_RULES = {
    at: count,
    enemiesLeft: count,
    fortsHeld: (n, B) => [...count(n), ...(isNum(n) && n > (B.forts || []).length ? [`asks for ${n} forts but the battle has ${(B.forts || []).length}`] : [])],
    bossHp: (k, B, e) => [
      ...(isNum(k) && k > 0 && k <= 1 ? [] : [`should be a share of the hull in (0, 1], got ${q(k)}`]),
      ...((B.enemy || []).some((s) => s && s.boss) || (B.events || []).some((x) => x !== e && Array.isArray(x.spawn) && x.spawn.some((s) => s && s.boss)) ? [] : ['the battle has no boss ship']),
    ],
    banner: (v) => (Array.isArray(v) && v.length >= 1 && v.length <= 2 && isStr(v[0]) && (v[1] === undefined || typeof v[1] === 'string') ? [] : [`should be [title, subtitle?], got ${q(v)}`]),
    spawn: (v) => (Array.isArray(v) && v.length ? [] : ['should be a non-empty list of ship defs']),
    wind: (v) => (isNum(v) ? [] : [`should be a heading in degrees, got ${q(v)}`]),
    fog: (v) => (isNum(v) && v >= 0 ? [] : [`should be a sight distance of at least 0, got ${q(v)}`]),
  };
  function checkEvents(where, B) {
    if (B.events === undefined) return;
    if (!Array.isArray(B.events)) { bad(where, 'events must be a list'); return; }
    B.events.forEach((e, i) => {
      const at = `${where} events[${i}]`;
      if (!isObj(e)) { bad(at, 'must be an object of conditions and actions'); return; }
      const keys = Object.keys(e);
      for (const k of keys) {
        if (!(k in WHEN) && !(k in DO)) { bad(at, `unknown key '${k}' (conditions: ${list(WHEN)}; actions: ${list(DO)})`); continue; }
        if (EVENT_RULES[k]) for (const m of EVENT_RULES[k](e[k], B, e)) bad(at, `${k} ${m}`);
        // Ships put to sea mid-battle may leave out x, y, h (spawnShip has defaults) and needn't carry a hat.
        if (shipDefList(e[k])) e[k].forEach((d, j) => checkShip(`${at} ${k}[${j}]`, d, { loose: true, nullHat: true, B }));
      }
      if (!keys.some((k) => k in DO)) bad(at, `has no action (actions: ${list(DO)})`);
    });
  }

  // ---------- the registries themselves ----------
  for (const [id, g] of Object.entries(GOALS)) {
    const at = `goal module '${id}'`;
    if (g.id !== id) bad(at, `id is ${q(g.id)}, listed as '${id}'`);
    if (!isStr(g.about)) bad(at, 'needs about (a one-line description)');
    if (!isObj(g.params)) bad(at, 'needs params ({} when it takes none)');
    for (const h of ['done', 'brief']) if (typeof g[h] !== 'function') bad(at, `needs ${h}()`);
  }
  for (const [id, A] of Object.entries(ABILITIES)) {
    const at = `ability module '${id}'`;
    if (A.id !== id) bad(at, `id is ${q(A.id)}, listed as '${id}'`);
    if (!isStr(A.about)) bad(at, 'needs about (a one-line description)');
    if (!isObj(A.params)) bad(at, 'needs params ({} when it takes none)');
    for (const k of Object.keys(A.defaults || {})) if (!(k in (A.params || {}))) bad(at, `default '${k}' is not described in params`);
  }
  for (const [name, R] of [['WHEN', WHEN], ['DO', DO]]) {
    for (const [k, e] of Object.entries(R)) {
      if (!isObj(e) || !isStr(e.about) || typeof e.fn !== 'function') bad(`${name}.${k}`, 'must be { about, fn(G, value) }');
    }
  }
  for (const k of Object.keys(WHEN)) if (k in DO) bad(`events '${k}'`, 'is both a condition (WHEN) and an action (DO)');

  // ---------- battles ----------
  const regions = new Set(REGIONS.map((r) => r.id));
  const seen = new Set();
  BATTLES.forEach((B, bi) => {
    if (!isObj(B)) { bad(`BATTLES[${bi}]`, 'must be an object'); return; }
    const where = `battle ${isStr(B.id) ? q(B.id) : `#${bi}`}`;
    if (!isStr(B.id)) bad(where, 'needs an id');
    else if (seen.has(B.id)) bad(where, 'duplicate battle id');
    seen.add(B.id);
    if (!regions.has(B.region)) bad(where, `unknown region ${q(B.region)} (known: ${[...regions].join(', ')})`);
    for (const k of ['name', 'foe', 'brief', 'roman']) if (!isStr(B[k])) bad(where, `needs ${k} (text)`);
    if (!isNum(B.year)) bad(where, 'needs a year');
    if (!(isNum(B.reward) && B.reward >= 0)) bad(where, `reward must be gold (a number of at least 0), got ${q(B.reward)}`);
    if (!isNum(B.wind)) bad(where, `wind must be a heading in degrees, got ${q(B.wind)}`);
    if (!isObj(B.ai)) bad(where, `needs ai: { ${AI_FIELDS.join(', ')} }`);
    else for (const k of AI_FIELDS) if (!(isNum(B.ai[k]) && B.ai[k] >= 0)) bad(where, `ai.${k} must be a number of at least 0, got ${q(B.ai[k])}`);
    if (B.hat !== undefined && !HATS[B.hat]) bad(where, `hat ${q(B.hat)} is not in HATS (known: ${list(HATS)})`);
    if (B.fog !== undefined && !(isNum(B.fog) && B.fog >= 0)) bad(where, `fog must be a sight distance, got ${q(B.fog)}`);
    if (B.sea !== undefined && !(isNum(B.sea) && B.sea >= 0.5 && B.sea <= 2.5)) bad(where, `sea must be a size multiplier between 0.5 and 2.5, got ${q(B.sea)}`);

    if (C.TERRAIN) {
      for (const [key, R] of Object.entries(C.TERRAIN)) {
        if (B[key] === undefined && key !== 'islands') continue;
        for (const m of R.check(B[key], B)) bad(where, m);
      }
    } else if (!Array.isArray(B.islands)) bad(where, 'needs islands (a list, possibly empty)');
    else B.islands.forEach((is, i) => {
      if (!isObj(is) || !isFrac(is.x) || !isFrac(is.y)) bad(where, `islands[${i}] must have x, y map fractions in [0, 1]`);
      else if (!(isNum(is.r) && is.r > 0)) bad(where, `islands[${i}] needs a radius r > 0`);
    });
    // Without its own player ships a battle uses the campaign fleet, which starts at FLEET_SLOTS (or where
    // fleetAt puts it). Any ship may be in it, so the slots must be clear even for a man-o'-war.
    if (B.player === undefined && Array.isArray(C.FLEET_SLOTS)) {
      const slots = C.fleetLayout && (B.fleetAt === undefined || (C.TERRAIN && !C.TERRAIN.fleetAt.check(B.fleetAt).length)) ? C.fleetLayout(B, C.FLEET_SLOTS).slots : C.FLEET_SLOTS;
      slots.forEach(([x, y], i) => onIsland(`${where} fleet slot ${i}`, B, { x, y, ship: true }));
    }
    if (B.player !== undefined) {
      if (!Array.isArray(B.player) || !B.player.length) bad(where, 'player must be a non-empty list of ship defs (or left out to use the campaign fleet)');
      else B.player.forEach((d, i) => checkShip(`${where} player[${i}]`, d, { B }));
    }
    if (!Array.isArray(B.enemy)) bad(where, 'needs enemy (a list of ship defs)');
    else B.enemy.forEach((d, i) => checkShip(`${where} enemy[${i}]`, d, { B }));

    if (B.forts !== undefined) {
      if (!Array.isArray(B.forts)) bad(where, 'forts must be a list');
      else {
        const used = new Set();
        B.forts.forEach((f, i) => {
          const at = `${where} forts[${i}]${f && isStr(f.name) ? ` (${f.name})` : ''}`;
          if (!isObj(f)) { bad(at, 'must be { island, name, hp, guns, need, team? }'); return; }
          if (!(Number.isInteger(f.island) && Array.isArray(B.islands) && f.island >= 0 && f.island < B.islands.length)) bad(at, `island ${q(f.island)} is not an index into islands (0-${(B.islands || []).length - 1})`);
          else if (used.has(f.island)) bad(at, `island ${f.island} already has a fort`);
          used.add(f.island);
          if (!isStr(f.name)) bad(at, 'needs a name');
          if (!(isNum(f.hp) && f.hp > 0)) bad(at, `hp must be a positive number, got ${q(f.hp)}`);
          if (!(Number.isInteger(f.guns) && f.guns >= 0)) bad(at, `guns must be a whole number, got ${q(f.guns)}`);
          if (f.need !== undefined && !(isNum(f.need) && f.need >= 0)) bad(at, `need (marines to take it) must be a number, got ${q(f.need)}`);
          if (f.team !== undefined && f.team !== 'player' && f.team !== 'enemy') bad(at, `team must be 'player' or 'enemy', got ${q(f.team)}`);
        });
      }
    }
    if (B.buoy !== undefined) {
      if (!isObj(B.buoy) || !isFrac(B.buoy.x) || !isFrac(B.buoy.y)) bad(where, 'buoy must have x, y map fractions in [0, 1]');
      else onIsland(`${where} buoy`, B, B.buoy);
    }
    checkGoals(where, B);
    checkEvents(where, B);
    if (C.checkLand) for (const m of C.checkLand(C.landOf ? C.landOf(B) : B.land, B, MAPS)) bad(where, m);
  });
  if (C.LANDS) for (const id of Object.keys(C.LANDS)) if (!seen.has(id)) bad(`LANDS.${id}`, 'is not a battle id (src/config/lands.js is keyed by battle id)');

  // ---------- ship types ----------
  for (const [id, T] of Object.entries(TYPES)) {
    const at = `TYPES.${id}`;
    if (!isObj(T)) { bad(at, 'must be an object of stats'); continue; }
    if (!isStr(T.label)) bad(at, 'needs a label');
    for (const k of TYPE_STATS) {
      if (!(isNum(T[k]) && T[k] >= 0)) bad(at, `${k} must be a number of at least 0, got ${q(T[k])}`);
      else if (POSITIVE_STATS.includes(k) && T[k] === 0) bad(at, `${k} must be above 0`);
    }
    if (isNum(T.masts) && T.masts !== 2 && T.masts !== 3) bad(at, `masts must be 2 or 3 (the renderer draws two or three), got ${T.masts}`);
    if (T.rig !== undefined && !isStr(T.rig)) bad(at, "rig must be a string ('square', 'fore-aft' or 'lateen'; see src/sim/wind.js)");
    checkAbilities(at, T.abilities);
    if (C.checkSlots) for (const m of C.checkSlots(T)) bad(at, m);
  }

  // ---------- guns ----------
  if (C.GUNS) {
    const params = C.GUN_PARAMS || {}, positions = C.POSITIONS || {};
    for (const [id, G] of Object.entries(C.GUNS)) {
      const at = `GUNS.${id}`;
      if (!isObj(G)) { bad(at, 'must be an object'); continue; }
      for (const k of Object.keys(G)) if (!(k in params)) bad(at, `unknown field '${k}' (known: ${list(params)})`);
      for (const k of ['label', 'short', 'about']) if (!isStr(G[k])) bad(at, `needs ${k} (text)`);
      for (const k of ['range', 'reload', 'dmg', 'weight', 'arc', 'crew', 'cost']) if (!(isNum(G[k]) && G[k] >= 0)) bad(at, `${k} must be a number of at least 0, got ${q(G[k])}`);
      if (!['ball', 'shell', 'pot'].includes(G.fires)) bad(at, `fires must be 'ball', 'shell' or 'pot', got ${q(G.fires)}`);
      if (!Array.isArray(G.fits) || !G.fits.length || G.fits.some((f) => !(f in positions))) bad(at, `fits must list positions (${list(positions)})`);
      if (!Array.isArray(G.shot)) bad(at, 'shot must be a list of shot types');
      else if (G.fires === 'ball' && !G.shot.length) bad(at, 'a gun that fires balls must load at least one shot type');
      else if (C.AMMO) for (const k of G.shot) if (!C.AMMO[k]) bad(at, `shot '${k}' is not in AMMO (known: ${list(C.AMMO)})`);
      if (G.fires === 'shell' && !isNum(G.radius)) bad(at, 'a shell gun needs a burst radius');
      if (G.fires === 'pot' && !isNum(G.burn)) bad(at, 'a fire-pot gun needs burn (seconds)');
      if (!isObj(G.render) || !isNum(G.render.barrel) || !isNum(G.render.bore)) bad(at, 'render must be { barrel, bore }');
    }
  }

  // ---------- hats ----------
  const awarded = new Set(BATTLES.map((B) => B && B.hat).filter(Boolean));
  for (const [id, h] of Object.entries(HATS)) {
    if (!isObj(h) || !isStr(h.name) || !isStr(h.from)) bad(`HATS.${id}`, 'needs a name and from (text)');
    if (!awarded.has(id)) bad(`HATS.${id}`, 'no battle awards this hat (set hat on a battle)');
  }
  if (Array.isArray(C.HAT_ORDER)) {
    for (const id of C.HAT_ORDER) if (!HATS[id]) bad('HAT_ORDER', `${q(id)} is not in HATS`);
    for (const id of Object.keys(HATS)) if (!C.HAT_ORDER.includes(id)) bad('HAT_ORDER', `missing ${q(id)}`);
  }

  // ---------- endless skirmish ----------
  if (C.ENDLESS) checkGoals('endless', C.ENDLESS);
  if (typeof C.waveEnemies === 'function') {
    for (let n = 1; n <= 20; n++) {
      let defs;
      try { defs = C.waveEnemies(n); } catch (e) { bad(`endless wave ${n}`, `waveEnemies threw: ${e.message}`); continue; }
      if (!Array.isArray(defs) || !defs.length) { bad(`endless wave ${n}`, 'waveEnemies returned no ships'); continue; }
      defs.forEach((d, i) => checkShip(`endless wave ${n} ship ${i}`, d, { nullHat: true }));
    }
  }
  return P;
}
