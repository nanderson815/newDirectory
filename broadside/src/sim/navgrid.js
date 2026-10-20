import { S } from '../state.js';
import { grounds } from './terrain.js';
import { penetration } from './steering.js';
import { geoStamp } from './flow.js';

// A coarse navigation planner. Steering (src/sim/steering.js) is local: it bends a heading round whatever sits
// across it, which is fine in open water but can trap a ship in a cove or send her the long way round an island
// chain. When the way to a destination isn't in plain sight, this plans a route instead: a grid over the map,
// built once per battle for each size of ship (and rebuilt when the tide turns or a boom breaks), A* through
// it with a clearance margin, and the route pulled taut into a few waypoints.
//
// It is used in exactly three places, each a marked one-line call:
//   followPath (drawn courses, tap-to-sail, the test bot)  navLeg(s, p): waypoints to splice in before p, or null
//   beamSteer (enemy captains, the engage order) and escortSteer (merchantmen bound for the exit)
//                                                          navBearing(s, x, y): the heading to the next waypoint, or null
// Nothing here is saved except the small route a ship carries in s.navTo (plain JSON).
//
// Cells: 0 open water, 1 near the land (allowed, dearer), 2 tight (allowed, much dearer, never cut across when
// smoothing), 3 blocked (the ship's centre can't be there: land, a reef, a shoal she'd ground on, a closed boom).
export const NAV = { cell: 18, near: 0.55, tight: 10, edge: 34, cost: [1, 2.2, 6, Infinity], bucket: 12, replan: 2.5, reach: 46, greed: 1.6 };

const grids = new Map();
let gridG = null, gridStamp = '';
// The size class for a ship: clearances in steering depend on her length (and whether she grounds on shoals).
const classL = (L) => Math.ceil(L / NAV.bucket) * NAV.bucket;

// Builds (or fetches) the grid for ships of length L in battle G (S.G unless given).
export function navGrid(L, G = S.G) {
  const stamp = geoStamp(G);
  if (gridG !== G || gridStamp !== stamp) { grids.clear(); gridG = G; gridStamp = stamp; }
  const cl = classL(L), k = `${cl}`;
  let g = grids.get(k);
  if (!g) { g = buildGrid(G, cl); grids.set(k, g); }
  return g;
}
export const forgetNav = () => { grids.clear(); gridG = null; };

function buildGrid(G, L) {
  const cs = Math.max(NAV.cell, Math.min(G.W, G.H) / 70), nx = Math.ceil(G.W / cs), ny = Math.ceil(G.H / cs);
  const c = new Uint8Array(nx * ny), room = new Float32Array(nx * ny);
  // A stand-in ship of this class (penetration reads S.G, so point it at G while we measure).
  const ghost = { L, B: L * 0.36, x: 0, y: 0 };
  const prev = S.G;
  S.G = G;
  const nearM = L * NAV.near;
  for (let j = 0; j < ny; j++) {
    const y = (j + 0.5) * cs;
    for (let i = 0; i < nx; i++) {
      const x = (i + 0.5) * cs, edge = Math.min(x, y, G.W - x, G.H - y);
      const pen = penetration(ghost, x, y);
      let v = pen > 0 ? 3 : pen > -NAV.tight ? 2 : pen > -nearM ? 1 : 0;
      if (edge < NAV.edge) v = Math.max(v, 2); else if (edge < NAV.edge * 1.8) v = Math.max(v, 1);
      c[j * nx + i] = v;
      // How much room the centre of a ship of this class has here beyond what she must keep (the map's edge
      // counts as land NAV.edge in), for the navigability check's wider channels.
      room[j * nx + i] = Math.min(-pen, edge - NAV.edge);
    }
  }
  S.G = prev;
  return { cs, nx, ny, c, room, L, grounds: grounds(ghost) };
}

const cellOf = (g, x, y) => {
  const i = Math.min(g.nx - 1, Math.max(0, Math.floor(x / g.cs))), j = Math.min(g.ny - 1, Math.max(0, Math.floor(y / g.cs)));
  return j * g.nx + i;
};
const cx = (g, k) => ((k % g.nx) + 0.5) * g.cs, cy = (g, k) => (Math.floor(k / g.nx) + 0.5) * g.cs;

// The nearest cell she may sail in (not blocked), searching outward a few rings; -1 if none.
function freeNear(g, x, y, rings = 8, worst = 2) {
  const k0 = cellOf(g, x, y);
  if (g.c[k0] <= worst) return k0;
  const i0 = k0 % g.nx, j0 = Math.floor(k0 / g.nx);
  let best = -1, bd = Infinity;
  for (let r = 1; r <= rings && best < 0; r++) {
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = i0 + di, j = j0 + dj;
      if (i < 0 || j < 0 || i >= g.nx || j >= g.ny) continue;
      const k = j * g.nx + i;
      if (g.c[k] > worst) continue;
      const d = Math.hypot(cx(g, k) - x, cy(g, k) - y);
      if (d < bd) { bd = d; best = k; }
    }
  }
  return best;
}

// Is the straight run from (x0, y0) to (x1, y1) clear for this grid's ships? `worst` is the dearest cell it may
// cross; the ends (`skip` map units at each) are forgiven, since a ship near a beach or a mark by a fort sits
// in tight water anyway.
export function clearLine(g, x0, y0, x1, y1, worst = 1, skip = 0, skipEnd = skip) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / (g.cs * 0.5));
  for (let i = 1; i < n; i++) {
    const t = i / n, along = t * d;
    if (along < skip || d - along < skipEnd) continue;
    if (g.c[cellOf(g, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)] > worst) return false;
  }
  return true;
}

// ---------- A* ----------
let F = null, Gs = null, From = null, Seen = null, heap = null, heapK = null, size = 0;
function ensure(n) {
  if (F && F.length >= n) return;
  F = new Float32Array(n); Gs = new Float32Array(n); From = new Int32Array(n); Seen = new Uint32Array(n);
  heap = new Int32Array(n * 9); heapK = new Float32Array(n * 9);
}
let pass = 1;
// A binary heap of (cell, key) pairs; a cell whose cost improves is pushed again and its stale entry skipped.
function push(k, f) {
  let i = size++;
  heap[i] = k; heapK[i] = f;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (heapK[p] <= heapK[i]) break;
    let t = heap[p]; heap[p] = heap[i]; heap[i] = t;
    t = heapK[p]; heapK[p] = heapK[i]; heapK[i] = t;
    i = p;
  }
}
let topK = 0;
function pop() {
  const top = heap[0];
  topK = heapK[0];
  size--;
  heap[0] = heap[size]; heapK[0] = heapK[size];
  let i = 0;
  for (;;) {
    const l = i * 2 + 1, r = l + 1;
    let m = i;
    if (l < size && heapK[l] < heapK[m]) m = l;
    if (r < size && heapK[r] < heapK[m]) m = r;
    if (m === i) break;
    let t = heap[m]; heap[m] = heap[i]; heap[i] = t;
    t = heapK[m]; heapK[m] = heapK[i]; heapK[i] = t;
    i = m;
  }
  return top;
}
const DI = [1, -1, 0, 0, 1, 1, -1, -1], DJ = [0, 0, 1, -1, 1, -1, 1, -1], DW = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];

// Cells from start cell k0 to the first cell that passes goal(k), as a list of cell indices; null if none.
// (hx, hy) steers the search (the heuristic aims there, less `slack`).
function astar(g, k0, goal, hx, hy, slack = 0, minRoom = -Infinity) {
  const n = g.nx * g.ny;
  ensure(n);
  if (++pass >= 0xffffffff) { Seen.fill(0); pass = 1; }
  size = 0;
  // Weighted (NAV.greed): a little longer than the best route at worst, and far fewer cells searched.
  const gx = hx / g.cs - 0.5, gy = hy / g.cs - 0.5, sl = slack / g.cs, nx = g.nx;
  const h = (k) => { const ci = k % nx, dx = ci - gx, dy = (k - ci) / nx - gy; return Math.max(0, Math.sqrt(dx * dx + dy * dy) - sl) * NAV.greed; };
  Gs[k0] = 0; F[k0] = h(k0); From[k0] = -1; Seen[k0] = pass; push(k0, F[k0]);
  let found = -1, budget = n * 9;
  while (size && budget-- > 0) {
    const k = pop();
    if (topK > F[k] + 1e-4) continue; // a stale entry: this cell was reached more cheaply since
    if (goal(k)) { found = k; break; }
    const i = k % g.nx, j = (k - i) / g.nx;
    for (let d = 0; d < 8; d++) {
      const di = DI[d], dj = DJ[d], w = DW[d];
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= g.nx || b >= g.ny) continue;
      const q = b * g.nx + a, cq = g.c[q];
      // The wide-channel test spares her first and last stretch (a mark beside a fort, a slot near a shore).
      if (cq === 3 || (g.room[q] < minRoom && Math.hypot(cx(g, q) - hx, cy(g, q) - hy) > slack + g.L && Math.hypot(cx(g, q) - cx(g, k0), cy(g, q) - cy(g, k0)) > g.L)) continue;
      // No squeezing diagonally between two blocked cells.
      if (di && dj && (g.c[j * g.nx + a] === 3 || g.c[b * g.nx + i] === 3)) continue;
      const ng = Gs[k] + w * NAV.cost[cq];
      if (Seen[q] === pass && ng >= Gs[q]) continue;
      Seen[q] = pass; Gs[q] = ng; From[q] = k; F[q] = ng + h(q);
      if (size < heap.length) push(q, F[q]);
    }
  }
  if (found < 0) return null;
  const out = [];
  for (let k = found; k >= 0; k = From[k]) out.push(k);
  return out.reverse();
}

// Pulls a cell route taut: from each anchor, the farthest later cell in plain sight (over open or near water).
function smooth(g, cells, x0, y0, x1, y1) {
  const pts = cells.map((k) => [cx(g, k), cy(g, k)]);
  pts[0] = [x0, y0];
  if (x1 != null) pts.push([x1, y1]);
  const out = [];
  let a = 0;
  while (a < pts.length - 1) {
    let b = pts.length - 1;
    while (b > a + 1 && !clearLine(g, pts[a][0], pts[a][1], pts[b][0], pts[b][1], 1, a === 0 ? g.cs : 0)) b--;
    out.push(pts[b]);
    a = b;
  }
  return out;
}

// Plans from (x0, y0) for ships of length L to within `reach` of (x1, y1) (0: the spot itself, or the nearest
// water to it). Returns waypoints [[x, y], ...] ending at or near the goal, or null when there is no way.
// minRoom (map units) asks for that much clear water beyond her own clearance on every cell of the route (the
// navigability check asks for a channel 3 beams wider than the ship needs).
export function planRoute(L, x0, y0, x1, y1, reach = 0, G = S.G, minRoom = -Infinity) {
  const g = navGrid(L, G);
  const k0 = freeNear(g, x0, y0);
  if (k0 < 0) return null;
  const kg = freeNear(g, x1, y1, 10);
  const goal = reach > 0
    ? (k) => g.c[k] < 3 && Math.hypot(cx(g, k) - x1, cy(g, k) - y1) <= reach
    : (k) => k === kg;
  if (!reach && kg < 0) return null;
  const cells = astar(g, k0, goal, x1, y1, reach, minRoom);
  if (!cells) return null;
  const end = cells[cells.length - 1];
  const last = !reach && end === cellOf(g, x1, y1) ? [x1, y1] : [cx(g, end), cy(g, end)];
  return smooth(g, cells, x0, y0, ...last);
}

// Like planRoute, to any cell that passes test(x, y) (an exit band, say).
export function planTo(L, x0, y0, test, hx, hy, G = S.G, minRoom = -Infinity) {
  const g = navGrid(L, G);
  const k0 = freeNear(g, x0, y0);
  if (k0 < 0) return null;
  const cells = astar(g, k0, (k) => g.c[k] < 2 && test(cx(g, k), cy(g, k)), hx, hy, 0, minRoom);
  return cells ? smooth(g, cells, x0, y0) : null;
}

// Ships sent the same way would sail the same waypoints in line abreast and shove each other along; each keeps
// to a lane of her own instead (by id: left of the line, on it, or right of it), where the water allows.
function lanes(s, g, pts) {
  const side = ((s.id % 3) + 3) % 3 - 1;
  if (!side || s.id < 0) return pts;
  return pts.map(([x, y], i) => {
    const q = pts[Math.min(pts.length - 1, i + 1)], o = i ? pts[i - 1] : [s.x, s.y];
    const dx = q[0] - o[0], dy = q[1] - o[1], d = Math.hypot(dx, dy) || 1, k = side * s.L * 1.1;
    const nx = x - (dy / d) * k, ny = y + (dx / d) * k;
    return g.c[cellOf(g, nx, ny)] <= 1 && clearLine(g, o[0], o[1], nx, ny, 1, g.cs) ? [nx, ny] : [x, y];
  });
}

// ---------- The calls steering makes ----------
// followPath: is the next mark p of a course in plain sight? If not, the planner's waypoints to sail first
// (new points, already checked), else null. The answer is kept on the point, so the course preview (which sails
// the same points first) and the ship herself take the same route.
export function navLeg(s, p) {
  if (p.nav !== undefined) return p.nav;
  const G = S.G;
  if (!G || !G.W) return null;
  const g = navGrid(s.L);
  p.nav = null;
  if (clearLine(g, s.x, s.y, p.x, p.y, 2, s.L * 0.6)) return null;
  const r = planRoute(s.L, s.x, s.y, p.x, p.y);
  if (!r || r.length < 2) return null;
  r.pop(); // the mark itself stays in the course
  p.nav = lanes(s, g, r).map(([x, y]) => ({ x, y, nav: null }));
  return p.nav;
}

// Enemy captains, the engage order and merchantmen: the heading to the next waypoint on the way to (x, y), or
// null when it is in plain sight (or there's no route: local steering does its best). The route is replanned
// every NAV.replan seconds or when the destination moves.
export function navBearing(s, x, y, exit = false) {
  const G = S.G;
  if (!G || !G.W) return null;
  let n = s.navTo;
  if (!n || G.t - n.at > NAV.replan || Math.hypot(n.x - x, n.y - y) > 90) {
    const g = navGrid(s.L);
    // Close enough to fight from (a fort's island is land right up to the target point).
    const reach = exit ? 0 : Math.max(NAV.reach, (s.standoff || s.range || 200) * 0.85);
    n = s.navTo = { x, y, at: G.t, wps: null };
    if (!clearLine(g, s.x, s.y, x, y, 2, s.L * 0.6, Math.max(s.L * 0.6, reach))) {
      const r = exit ? planTo(s.L, s.x, s.y, exitTest(G), x, y) : planRoute(s.L, s.x, s.y, x, y, reach);
      if (r && r.length > 1) n.wps = lanes(s, g, r.slice(1)).map(([a, b]) => [Math.round(a), Math.round(b)]);
    }
  }
  const w = n.wps;
  if (!w) return null;
  while (w.length && Math.hypot(w[0][0] - s.x, w[0][1] - s.y) < NAV.reach + s.L * 0.3) w.shift();
  if (!w.length) { n.wps = null; return null; }
  return Math.atan2(w[0][1] - s.y, w[0][0] - s.x);
}
// The exit band at the top of the chart (the right edge in landscape), as src/sim/battle.js EXIT_BAND has it.
const exitTest = (G) => (G.land ? (x) => x > G.W - 60 : (x, y) => y < 60);
