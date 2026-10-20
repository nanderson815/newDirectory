// Navigability check (node only, no browser): builds every battle on a few nominal screens and asks the route
// planner (src/sim/navgrid.js) for a way from every spawn of your fleet to everything the battle asks you to
// reach: each enemy's start (to within gun range), each fort's landing spot, the exit, every chest, reach ring
// and working harbour, and each harbour boom (to within gun range, with the boom still across). It sails the
// biggest ship you could bring (the largest refit class, and never less than 1.2x a man-o'-war), so every
// channel, gap and lagoon mouth a battle relies on is wide enough for her. Chests on shoals may be left to small
// ships. Also checks that every ship starts in open water for her size. Used by npm run check
// (tests/content.mjs) and tests/maps.mjs.
//
//   node tests/navcheck.mjs            # prints every route, fails on any unreachable objective
//   ONLY=tortuga,cove node tests/navcheck.mjs
import { loadContent } from '../scripts/registries.mjs';

const SEA_SCALE = 1.45;
// Portrait chart sizes (map units, before the battle's own sea multiplier): a squat tablet, a phone, and a tall
// phone as the camera fits it (landscape turns the same chart, so these cover it).
export const NAV_MAPS = [[620, 830], [520, 1110], [520, 1390]];
// Beams of clear water a channel must have beyond the ship's own clearance from the shore.
export const ROOM = +(process.env.ROOM || 3);

export async function navCheck(C, { only = null, log = null } = {}) {
  const { createBattle } = await import('../src/sim/battle.js');
  const { setLab, LAB_ID } = await import('../src/config/lab.js');
  const { S } = await import('../src/state.js');
  const nav = await import('../src/sim/navgrid.js');
  const { penetration } = await import('../src/sim/steering.js');
  const { shoalsFor } = await import('../src/sim/terrain.js');
  const { REFIT } = await import('../src/config/ships.js');
  const { TYPES, BATTLES } = C;
  const classes = [...new Set([...Object.keys(REFIT), ...Object.values(REFIT)])].filter((k) => TYPES[k]);
  const biggest = Math.max(...classes.map((k) => TYPES[k].L), TYPES.manowar ? TYPES.manowar.L * 1.2 : 0);
  const small = Math.min(...classes.map((k) => TYPES[k].L));
  const problems = [];
  // Every channel on the way: her clearance plus ROOM beams of clear water (half each side of her track).
  const room = (L) => (ROOM / 2) * L * 0.36;
  const fleet = [0, 1, 2, 3, 4].map((i) => ({ name: `Ship${i}`, cls: i ? 'sloop' : 'frigate', up: {} }));
  const rnd = Math.random;
  let seed = 1;
  Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  try {
    for (let bi = 0; bi < BATTLES.length; bi++) {
      const B = BATTLES[bi];
      if (only && !only.includes(B.id)) continue;
      for (const [w, h] of NAV_MAPS) {
        const k = SEA_SCALE * (B.sea || 1), W = Math.round(w * k), H = Math.round(h * k);
        // Built through the lab, so a battle table handed in (a test's broken copy) is the one checked.
        setLab({ ...B, land: B.land || (C.LANDS || {})[B.id] || null });
        const G = createBattle(LAB_ID, { W, H, land: false }, fleet);
        S.G = G;
        nav.forgetNav();
        const where = `battle '${B.id}' (${W}x${H})`;
        const bad = (m) => problems.push(`${where}: ${m}`);
        const big = { L: biggest, B: biggest * 0.36 };
        const starts = G.ships.filter((s) => s.team === 'player');
        // Everyone starts in open water for her size (your fleet's slots for the biggest ship).
        for (const s of G.ships) {
          const probe = s.team === 'player' && !s.escort && !B.player ? big : s;
          if (penetration(probe, s.x, s.y) > 0) bad(`${s.team} ${s.name} starts too close to land, a reef or a shoal for a ${probe === big ? 'flagship' : s.type}`);
        }
        // What must be reachable: [label, x, y, reach, smallOk].
        const goals = [];
        const range = 0.8 * Math.min(...classes.map((c) => TYPES[c].range));
        for (const s of G.ships) if (s.team === 'enemy') goals.push([`enemy ${s.name}`, s.x, s.y, range]);
        for (const e of B.events || []) for (const d of e.spawn || []) {
          if (d.team === 'player' || d.x == null) continue;
          const [x, y] = [d.x * W, d.y * H];
          goals.push([`spawned enemy ${d.name}`, x, y, range]);
        }
        for (const f of G.forts) {
          const is = G.islands[f.island];
          goals.push([`fort ${f.name} landing`, is.x, is.y, is.r * 1.05 + biggest * 0.42 + 60]);
        }
        for (const c of G.chests || []) {
          const onShoal = (G.shoals || []).some((q) => nav && Math.hypot(q.x - c.x, q.y - c.y) < q.r + (q.hl || 0) + 40);
          goals.push(['chest', c.x, c.y, 40 + biggest * 0.5, onShoal]);
        }
        for (const o of G.goals) {
          if (o.kind === 'reach') goals.push(['reach ring', o.px, o.py, o.pr || 60]);
        }
        for (const o of G.landmarks || []) if (o.kind === 'harbour' && o.rate > 0) goals.push(['harbour', o.ax, o.ay, o.r]);
        const exit = G.goals.some((o) => o.kind === 'breakthrough' || o.kind === 'escort');
        for (const b of G.booms || []) goals.push([`boom ${b.name}`, b.x, b.y, range]);
        // Escorted merchantmen must find the exit from where they start, and so must your flagship.
        const exitFrom = exit ? [...starts] : [];
        const tideStages = G.tide ? ['covered', 'half', 'dry'].filter((st) => st === G.tide.stage || G.tide.turns.some((t) => stageOf(t.to) === st)) : [null];
        for (const st of tideStages) {
          if (st) G.tide.stage = st;
          nav.forgetNav();
          const tag = st ? ` at ${st === 'covered' ? 'high' : st === 'dry' ? 'low' : 'half'} tide` : '';
          // The boom stays across while you sail up to shoot it; everything else is planned with it gone too.
          for (const openBooms of G.booms && G.booms.length ? [false, true] : [true]) {
            for (const b of G.booms || []) b.open = openBooms;
            nav.forgetNav();
            for (const s of starts.filter((q, i) => !q.escort ? i === 0 || !B.player : true).slice(0, 3)) {
              const L = s.escort ? s.L : B.player ? s.L : biggest;
              for (const [label, x, y, reach, smallOk] of goals) {
                const isBoom = label.startsWith('boom');
                if (!openBooms && !isBoom) continue;
                if (openBooms && isBoom) continue;
                if (s.escort) continue;
                let r = nav.planRoute(L, s.x, s.y, x, y, reach, G, room(L));
                if (!r && smallOk) r = nav.planRoute(small, s.x, s.y, x, y, reach, G, room(small));
                if (!r) bad(`no route${tag} for a ${Math.round(L)}-long ship from ${s.name} (${Math.round(s.x)},${Math.round(s.y)}) to ${label} (${Math.round(x)},${Math.round(y)})`);
                else if (log) log(`${where}${tag}: ${s.name} -> ${label}: ${r.length} legs`);
              }
            }
            if (openBooms) for (const s of exitFrom) {
              const L = s.escort ? s.L : biggest;
              const r = nav.planTo(L, s.x, s.y, (x, y) => y < 60, s.x, 0, G, room(L));
              if (!r) bad(`no route${tag} to the exit for ${s.name} (${Math.round(L)} long)`);
            }
          }
          for (const b of G.booms || []) b.open = false;
        }
        void shoalsFor;
      }
    }
  } finally {
    Math.random = rnd;
    nav.forgetNav();
  }
  return problems;
}
const stageOf = (v) => (v >= 0.66 ? 'covered' : v <= 0.33 ? 'dry' : 'half');

if (import.meta.url === `file://${process.argv[1]}`) {
  const C = await loadContent();
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const t0 = Date.now();
  const p = await navCheck(C, { only, log: process.env.VERBOSE ? console.log : null });
  for (const m of p) console.log('  FAIL ' + m);
  console.log(p.length ? `\n${p.length} navigation problems` : `\nevery objective reachable (${Date.now() - t0} ms)`);
  process.exit(p.length ? 1 : 0);
}
