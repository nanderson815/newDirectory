// Maps (src/sim/flow.js, src/sim/navgrid.js, src/config/battles.js): the sea that moves and the route planner
// behave, and every Caribbean battle loads, starts its ships in open water and plays a short bot run cleanly.
//   - a ship in a current drifts with it (and the course preview drifts too);
//   - a tidal shoal covers and uncovers on schedule, and grounds the ships it should at each stage;
//   - a boom holds ships off until its fort falls, and shot from the other side breaks it;
//   - a course into a cove behind a long island is routed round it, and the preview shows the planned route;
//   - every battle: no page errors, every ship clear of land, the bot sails 40 s of it.
// Run after npm run build:single (part of npm test). The node-only reachability check is tests/navcheck.mjs.
import { launch, open, check, save } from './lib.mjs';

const failures = [];
const browser = await launch();
const page = await open(browser, { save: save({ stars: { tutorial: 3 } }) });
const B = (fn, arg) => page.evaluate(fn, arg);
const CAMPAIGN = ['tutorial', 'tortuga', 'cayman', 'rojo', 'sanlucas', 'silver', 'comodoro', 'cartagena', 'santamarta', 'oro', 'cove', 'wreck', 'kate', 'convoy', 'siege', 'hierro', 'fog', 'blockade', 'armada'];

// ---------- Currents ----------
console.log('Currents');
const cur = await B(() => {
  const b = window.__broadside;
  const def = {
    player: [{ type: 'sloop', name: 'Swift', x: 0.2, y: 0.85, h: -90 }],
    enemy: [{ type: 'brig', name: 'Hulk', x: 0.5, y: 0.5, h: 90, passive: true }, { type: 'brig', name: 'Still', x: 0.5, y: 0.2, h: 90, passive: true }],
    islands: [], currents: [{ x: 0.5, y: 0.5, r: 120, speed: 20, angle: 0 }],
  };
  const G = b.playDef(def);
  const hulk = G.ships.find((s) => s.name === 'Hulk'), still = G.ships.find((s) => s.name === 'Still');
  const x0 = hulk.x, y0 = hulk.y, s0 = still.x;
  b.sim(120);
  const set = b.flow.currentAt(x0, y0);
  // The preview of a ship told to cross the current bends downstream of a straight line.
  const sw = G.ships.find((s) => s.name === 'Swift');
  sw.x = G.W * 0.5; sw.y = G.H * 0.68; sw.h = -Math.PI / 2; sw.v = 30;
  sw.path = [{ x: G.W * 0.5, y: G.H * 0.32 }];
  const pv = b.preview(sw.id);
  let maxDx = 0;
  if (pv) for (let i = 0; i < pv.pts.length; i += 2) maxDx = Math.max(maxDx, pv.pts[i] - G.W * 0.5);
  return { dx: hulk.x - x0, dy: hulk.y - y0, still: still.x - s0, set, maxDx };
});
check(cur.dx > 25 && Math.abs(cur.dy) < 8, `a hulk in a current drifts with it (${cur.dx.toFixed(1)} downstream, ${cur.dy.toFixed(1)} across in 2 s; set ${cur.set.map((v) => v.toFixed(1)).join(', ')})`, failures);
check(Math.abs(cur.still) < 1, `a hulk outside the current stays put (${cur.still.toFixed(2)})`, failures);
check(cur.maxDx > 8, `the course preview drifts with the current (${cur.maxDx.toFixed(1)} downstream)`, failures);

// ---------- The tide ----------
console.log('The tide');
const tide = await B(() => {
  const b = window.__broadside;
  const def = {
    player: [{ type: 'sloop', name: 'Swift', x: 0.5, y: 0.5, h: 0 }, { type: 'frigate', name: 'Resolute', x: 0.5, y: 0.85, h: 0 }],
    enemy: [{ type: 'brig', name: 'Hulk', x: 0.5, y: 0.15, h: 90, passive: true }],
    islands: [], shoals: [{ x: 0.5, y: 0.5, r: 60, stretch: 2, tidal: true }],
    tide: { level: 1, turns: [{ at: 3, to: 0.5, secs: 2 }, { at: 8, to: 0, secs: 2 }] },
  };
  const G = b.playDef(def);
  const sw = G.ships.find((s) => s.name === 'Swift'), fr = G.ships.find((s) => s.name === 'Resolute');
  const cx = G.W * 0.5, cy = G.H * 0.5;
  const at = () => ({ t: +G.t.toFixed(1), stage: G.tide.stage, level: +G.tide.level.toFixed(2), sloopBlocked: b.blockedAt(sw, cx, cy), frigateBlocked: b.blockedAt(fr, cx, cy), sloopAground: !!sw.aground });
  const out = [];
  sw.pivot = sw.h; // anchored on the bar
  b.sim(60); out.push(at());
  b.sim(5 * 60); out.push(at());
  b.sim(5 * 60); out.push(at());
  return out;
});
const [hi, mid, lo] = tide;
check(hi.stage === 'covered' && !hi.frigateBlocked && !hi.sloopBlocked, `high water covers the bar for every ship (t ${hi.t}: ${JSON.stringify(hi)})`, failures);
check(mid.stage === 'half' && mid.frigateBlocked && !mid.sloopBlocked, `half tide: a frigate must keep off the bar, a sloop may cross (t ${mid.t}: ${mid.stage})`, failures);
check(lo.stage === 'dry' && lo.sloopBlocked && lo.sloopAground, `low water dries the bar and a sloop on it is aground (t ${lo.t}: ${lo.stage}, aground ${lo.sloopAground})`, failures);

// ---------- Booms ----------
console.log('Booms');
const boom = await B(() => {
  const b = window.__broadside;
  const def = {
    player: [{ type: 'brig', name: 'Swift', x: 0.5, y: 0.75, h: -90 }],
    enemy: [{ type: 'brig', name: 'Hulk', x: 0.5, y: 0.12, h: 90, passive: true }],
    islands: [{ x: 0.1, y: 0.45, r: 60 }, { x: 0.9, y: 0.45, r: 60 }],
    booms: [{ from: [0.05, 0.45], to: [0.95, 0.45], hp: 40, fort: 0 }],
    forts: [{ island: 1, name: 'Fort Test', hp: 50, guns: 0, need: 10 }],
  };
  const G = b.playDef(def);
  const sw = G.ships.find((s) => s.name === 'Swift'), bm = G.booms[0], line = G.H * 0.45;
  sw.path = [{ x: G.W * 0.5, y: G.H * 0.2 }];
  b.sim(12 * 60);
  const held = { y: Math.round(sw.y), line: Math.round(line), open: bm.open, blocked: b.flow.activeBooms().length };
  // Shot from the attackers breaks it.
  for (let i = 0; i < 12 && !bm.open; i++) {
    b.S.balls.push({ x: bm.x, y: bm.y + 30, vx: 0, vy: -430, travel: 0, max: 200, team: 'player', dmg: 4, z0: 10, kind: 'round' });
    b.sim(6);
  }
  const shot = { open: bm.open, hp: bm.hp };
  // A fresh boom comes down when its fort is silenced.
  const G2 = b.playDef(def);
  const f = G2.forts[0];
  f.hp = 0; f.state = 'silenced';
  b.sim(2);
  const fort = G2.booms[0].open;
  const sw2 = G2.ships.find((s) => s.name === 'Swift');
  sw2.path = [{ x: G2.W * 0.5, y: G2.H * 0.2 }];
  b.sim(20 * 60);
  return { held, shot, fort, through: sw2.y < G2.H * 0.4 };
});
check(boom.held.y > boom.held.line && !boom.held.open, `a closed boom holds a ship off (she is at ${boom.held.y}, the boom at ${boom.held.line})`, failures);
check(boom.shot.open, `shot from the other side breaks it (${JSON.stringify(boom.shot)})`, failures);
check(boom.fort && boom.through, `silencing its fort lowers it and the ship sails through (open ${boom.fort}, through ${boom.through})`, failures);

// ---------- The route planner ----------
console.log('The route planner');
const nav = await B(() => {
  const b = window.__broadside;
  // A cove behind a long island: the straight line runs into the island; the way in is round its east end.
  const def = {
    player: [{ type: 'frigate', name: 'Resolute', x: 0.3, y: 0.85, h: -90 }],
    enemy: [{ type: 'brig', name: 'Hulk', x: 0.85, y: 0.1, h: 90, passive: true }],
    islands: [{ x: 0.35, y: 0.5, r: 40, stretch: 5.5, angle: 0 }],
    coast: { side: 'left', depth: 0.06, rough: 0 },
  };
  const G = b.playDef(def);
  const s = G.ships[0], goal = { x: G.W * 0.3, y: G.H * 0.25 };
  s.path = [goal];
  const pv = b.preview(s.id);
  // The preview swings east round the island's end before it turns back west.
  let maxX = 0;
  if (pv) for (let i = 0; i < pv.pts.length; i += 2) maxX = Math.max(maxX, pv.pts[i]);
  const legs = s.path.length;
  let t = 0;
  while (t < 60 * 60 && Math.hypot(s.x - goal.x, s.y - goal.y) > 60) { b.sim(30); t += 30; }
  const r = b.nav.planRoute(s.L, s.x, s.y, G.W * 0.3, G.H * 0.85, 0);
  return { maxX: Math.round(maxX), end: Math.round(G.W * 0.35 + 40 * 4.5), legs, arrived: Math.hypot(s.x - goal.x, s.y - goal.y) <= 60, secs: Math.round(t / 60), back: r ? r.length : 0 };
});
check(nav.arrived, `a ship told to sail into the cove behind a long island gets there (${nav.secs} s)`, failures);
check(nav.maxX > nav.end * 0.9, `the course preview shows the planned way round the island's end (reaches x ${nav.maxX}, the end is at ${nav.end})`, failures);
check(nav.back >= 2, `the planner finds the way back out too (${nav.back} legs)`, failures);

// ---------- Every Caribbean battle ----------
console.log('Every battle');
for (const id of CAMPAIGN) {
  page.errors.length = 0;
  const r = await B((id) => {
    const b = window.__broadside;
    b.startBattle(id);
    b.step(2);
    const G = b.G;
    const stuck = G.ships.filter((s) => s.state === 'afloat' && b.blockedAt(s, s.x, s.y)).map((s) => s.name);
    const ours = G.ships.filter((s) => s.team === 'player');
    for (let t = 0; t < 40 && G.endAt == null; t++) { window.__bot.tick(); b.sim(60); }
    b.step(1);
    return { stuck, t: Math.round(G.t), over: G.endAt != null ? G.result : null, ships: ours.length, grids: !!b.nav.grid(84) };
  }, id);
  check(!r.stuck.length && !page.errors.length && r.grids, `${id}: starts clear, plays ${r.t} s with the bot${r.over ? ` (${r.over})` : ''}${r.stuck.length ? `; on land: ${r.stuck.join(', ')}` : ''}${page.errors.length ? `; ${page.errors.slice(0, 2).join(' | ')}` : ''}`, failures);
}

await browser.close();
console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASSED');
process.exit(failures.length ? 1 : 0);
