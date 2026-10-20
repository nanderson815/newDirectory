import { PI, clamp, lerp } from '../util.js';

// Geography: the shape of the sea a battle is fought on. Pure geometry, no state of its own, so it loads in
// node for the content check and the docs as well as in the game.
//
// Battle data (portrait fractions, like everything in src/config/battles.js):
//   islands: [{ x, y, r, stretch?, angle? }]   land; stretch > 1 makes a long island (a capsule) along `angle`
//   shoals:  [{ x, y, r, stretch?, angle? }]   shallows: big ships run aground, small ones sail over
//   reefs:   [{ x, y, r, stretch?, angle? }]   rocks just under the surf: they hole any ship that crosses
//   coast:   { side, depth, rough?, coves?, capes?, seed? } (or a list of them): a land mass along a map edge
//   fleetAt: where the player's fleet starts ('bottom', 'top', 'left', 'right', 'center' or { slots, h })
//
// In the battle state G, islands/shoals/reefs are capsules in map units: { x, y, r, hl, ang } where hl is the
// half-length of the core segment (0 for a round one) and ang its direction in radians. A point's distance to
// the shape is its distance to the core segment minus r. A coast is a shoreline polyline sorted along the edge.

// Ships longer than this run aground on shoals (brigs, frigates and up); sloops, schooners, xebecs, bomb
// ketches and fireships draw little enough water to sail over them.
export const SHOAL = { maxL: 48, slow: 0.3, turn: 0.6, bump: 4, dps: 1 };
// A reef holes any hull that crosses it: `dps` hull a second at full speed (40% of it when barely moving),
// and the ship is slowed while she grinds over.
export const REEF = { dps: 16, slow: 0.5 };
export const grounds = (s) => s.L > SHOAL.maxL;

// ---------- Capsules ----------
const P = { x: 0, y: 0 };
// The point of a capsule's core segment nearest (x, y). Returns a shared scratch point: copy it out.
export function corePt(c, x, y) {
  if (!c.hl) { P.x = c.x; P.y = c.y; return P; }
  const ux = Math.cos(c.ang), uy = Math.sin(c.ang);
  const t = clamp((x - c.x) * ux + (y - c.y) * uy, -c.hl, c.hl);
  P.x = c.x + ux * t; P.y = c.y + uy * t;
  return P;
}
export const coreDist = (c, x, y) => { const p = corePt(c, x, y); return Math.hypot(x - p.x, y - p.y); };
// Distance from the centre of a capsule to its edge in direction a (radians, map space).
export function capsuleRadius(c, a) {
  if (!c.hl) return c.r;
  // In the capsule's own frame (axis along x): leave through a straight side if that point lies along the
  // segment, otherwise through the end cap, the far root of |t·(ca, sa) - (hl, 0)| = r.
  const rel = a - c.ang, ca = Math.abs(Math.cos(rel)), sa = Math.abs(Math.sin(rel));
  if (sa > 1e-6 && (c.r / sa) * ca <= c.hl) return c.r / sa;
  const b = c.hl * ca;
  return b + Math.sqrt(Math.max(0, b * b - c.hl * c.hl + c.r * c.r));
}

// Turns a capsule def (portrait fractions) into map units. rot is the landscape rotation.
export function makeCapsule(d, place, rot) {
  const [x, y] = place(d.x, d.y);
  const st = Math.max(1, d.stretch || 1);
  return { x, y, r: d.r, hl: d.r * (st - 1), ang: ((d.angle || 0) * PI) / 180 + rot };
}

// ---------- Coasts ----------
const hash = (seed, i) => { const v = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453; return v - Math.floor(v); };
function vnoise(seed, t) {
  const i = Math.floor(t), f = t - i, k = f * f * (3 - 2 * f);
  return lerp(hash(seed, i), hash(seed, i + 1), k) * 2 - 1;
}
const SIDES = ['left', 'right', 'top', 'bottom'];
const seedOf = (c) => (c.seed != null ? c.seed : SIDES.indexOf(c.side) * 7.3 + c.depth * 13.1 + 1.7);
// A cove or cape: full depth across the middle half of its width, easing off smoothly over the outer quarters.
const bump = (t, at, w) => { const k = clamp((w / 2 - Math.abs(t - at)) / (w / 4), 0, 1); return k * k * (3 - 2 * k); };
// How far the land reaches in from its edge at t (0-1 along the edge), as a fraction of the chart across that
// edge (its width for left/right coasts, its height for top/bottom). Deterministic, so the content check, the
// sim and the renderer all see the same shore.
export function coastDepth(c, t) {
  const seed = seedOf(c), rough = c.rough == null ? 0.3 : c.rough;
  let d = c.depth * (1 + rough * (0.65 * vnoise(seed, t * 5 + 3) + 0.35 * vnoise(seed + 7, t * 13 + 5)));
  for (const k of c.capes || []) d += k.depth * bump(t, k.at, k.width);
  for (const k of c.coves || []) d -= k.depth * bump(t, k.at, k.width);
  return Math.max(0.004, d);
}
// The portrait point at t along the coast's edge and depth d in from it (fractions).
export function coastPoint(c, t, d) {
  switch (c.side) {
    case 'left': return [d, t];
    case 'right': return [1 - d, t];
    case 'top': return [t, d];
    default: return [t, 1 - d];
  }
}
export const COAST_SAMPLES = 140;
// Builds a coast for the battle state: the shoreline in map units, sorted along the edge.
// place maps portrait fractions to the map; W, H are the map size.
export function makeCoast(def, place) {
  const pts = [];
  for (let i = 0; i <= COAST_SAMPLES; i++) {
    const t = -0.08 + (1.16 * i) / COAST_SAMPLES;
    pts.push(place(...coastPoint(def, t, coastDepth(def, t))));
  }
  // Which map axis the edge runs along, and which side of the shore the land is on.
  const axis = Math.abs(pts[pts.length - 1][0] - pts[0][0]) > Math.abs(pts[pts.length - 1][1] - pts[0][1]) ? 0 : 1;
  if (pts[0][axis] > pts[pts.length - 1][axis]) pts.reverse();
  const inland = place(...coastPoint(def, 0.5, -1));
  const c = { def: { ...def }, pts, axis, low: false };
  c.low = inland[1 - axis] < shoreAt(c, inland[axis]);
  return c;
}
// The shore's coordinate across the edge at `a` along it (map units).
export function shoreAt(c, a) {
  const p = c.pts, ax = c.axis, n = p.length;
  if (a <= p[0][ax]) return p[0][1 - ax];
  if (a >= p[n - 1][ax]) return p[n - 1][1 - ax];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[m][ax] <= a) lo = m; else hi = m; }
  const k = (a - p[lo][ax]) / ((p[hi][ax] - p[lo][ax]) || 1);
  return lerp(p[lo][1 - ax], p[hi][1 - ax], k);
}
// How far (x, y) lies seaward of the shore, measured straight across the edge: negative on land. Cheap, and
// never less than the true distance, so it suits quick "is this spot clear" tests.
export function coastGap(c, x, y) {
  const a = c.axis ? y : x, p = c.axis ? x : y, sh = shoreAt(c, a);
  return c.low ? p - sh : sh - p;
}
// The nearest point of the shoreline to (x, y) and the signed distance (negative on land).
const N = { x: 0, y: 0, d: 0 };
export function coastNearest(c, x, y) {
  const p = c.pts;
  let bd = Infinity, bx = 0, by = 0;
  for (let i = 0; i < p.length - 1; i++) {
    const ax = p[i][0], ay = p[i][1], dx = p[i + 1][0] - ax, dy = p[i + 1][1] - ay;
    const L2 = dx * dx + dy * dy || 1;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / L2, 0, 1);
    const qx = ax + dx * t, qy = ay + dy * t, d = (x - qx) * (x - qx) + (y - qy) * (y - qy);
    if (d < bd) { bd = d; bx = qx; by = qy; }
  }
  N.x = bx; N.y = by; N.d = Math.sqrt(bd) * (coastGap(c, x, y) < 0 ? -1 : 1);
  return N;
}

// ---------- Fleet placement ----------
// Where the campaign fleet starts, by fleet position (portrait fractions) and the heading it faces.
const LAYOUTS = {
  top: { slots: [[0.5, 0.2], [0.24, 0.15], [0.76, 0.15], [0.37, 0.08], [0.63, 0.08]], h: 90 },
  left: { slots: [[0.22, 0.52], [0.14, 0.44], [0.14, 0.6], [0.3, 0.42], [0.3, 0.62]], h: 0 },
  right: { slots: [[0.78, 0.52], [0.86, 0.44], [0.86, 0.6], [0.7, 0.42], [0.7, 0.62]], h: 180 },
  center: { slots: [[0.5, 0.5], [0.34, 0.55], [0.66, 0.55], [0.42, 0.62], [0.58, 0.62]], h: -90 },
};
// The slots and heading for a battle's fleetAt (bottom is the classic FLEET_SLOTS).
export function fleetLayout(B, FLEET_SLOTS) {
  const f = B.fleetAt;
  if (f && typeof f === 'object') return { slots: f.slots, h: f.h == null ? -90 : f.h };
  return LAYOUTS[f] || { slots: FLEET_SLOTS, h: -90 };
}

// ---------- The registry: docs and content checks ----------
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isFrac = (v) => isNum(v) && v >= 0 && v <= 1;
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const CAPSULE = {
  x: 'centre across the chart (portrait fraction)',
  y: 'centre down the chart (portrait fraction)',
  r: 'radius in map units (half the width of a long one)',
  stretch: 'optional: length over width, 1 = round (default 1)',
  angle: 'optional: direction of the long axis in degrees, 0 = across the chart, 90 = down it (default 0)',
};
function checkCapsules(key, v) {
  if (!Array.isArray(v)) return [`${key} must be a list of { x, y, r, stretch?, angle? }`];
  const out = [];
  v.forEach((c, i) => {
    if (!isObj(c) || !isFrac(c.x) || !isFrac(c.y)) { out.push(`${key}[${i}] must have x, y map fractions in [0, 1]`); return; }
    if (!(isNum(c.r) && c.r > 0)) out.push(`${key}[${i}] needs a radius r > 0`);
    if (c.stretch !== undefined && !(isNum(c.stretch) && c.stretch >= 1 && c.stretch <= 8)) out.push(`${key}[${i}] stretch must be a number from 1 to 8, got ${JSON.stringify(c.stretch)}`);
    if (c.angle !== undefined && !isNum(c.angle)) out.push(`${key}[${i}] angle must be degrees, got ${JSON.stringify(c.angle)}`);
    for (const k of Object.keys(c)) if (!(k in CAPSULE) && k !== 'note') out.push(`${key}[${i}]: unknown field '${k}' (known: ${Object.keys(CAPSULE).join(', ')})`);
  });
  return out;
}
// Distance in map units from a portrait point to a capsule def, on a nominal portrait map W x H.
function capsuleGap(c, p, W, H) {
  const st = Math.max(1, c.stretch || 1), hl = c.r * (st - 1), a = ((c.angle || 0) * PI) / 180;
  const dx = (p.x - c.x) * W, dy = (p.y - c.y) * H, ux = Math.cos(a), uy = Math.sin(a);
  const t = clamp(dx * ux + dy * uy, -hl, hl);
  return Math.hypot(dx - ux * t, dy - uy * t) - c.r;
}
const coastList = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const coastGapFrac = (c, p, W, H) => {
  const t = c.side === 'left' || c.side === 'right' ? p.y : p.x;
  const across = { left: p.x, right: 1 - p.x, top: p.y, bottom: 1 - p.y }[c.side];
  return (across - coastDepth(c, t)) * (c.side === 'left' || c.side === 'right' ? W : H);
};
const POINT_FIELDS = { at: 'where along the edge (0-1)', width: 'how much of the edge it spans (0-1)', depth: 'how far in it reaches (fraction of the chart)' };

// Each entry: about, params (for the docs); check(value, B) returns problems; blocks(B, p, T, W, H) says why a
// ship (type stats T, or null for a fleet slot whose ship isn't known yet) can't start at portrait point p.
export const TERRAIN = {
  islands: {
    about: 'Land. Ships sail round it and shot can’t pass it; a fort stands on one. A stretched island is a long ridge, collided and steered round as drawn.',
    params: CAPSULE,
    check: (v) => (Array.isArray(v) ? checkCapsules('islands', v) : ['needs islands (a list, possibly empty)']),
    blocks(B, p, T, W, H) {
      for (let i = 0; i < (B.islands || []).length; i++) {
        const c = B.islands[i];
        if (isObj(c) && isFrac(c.x) && isFrac(c.y) && isNum(c.r) && capsuleGap(c, p, W, H) < 12) return `is on (or touching) island ${i}`;
      }
      return null;
    },
  },
  shoals: {
    about: `Shallow, pale water. Ships longer than ${SHOAL.maxL} (brigs and up) run aground: they crawl at ${SHOAL.slow * 100}% speed and ${SHOAL.turn * 100}% helm, lose ${SHOAL.bump} hull as they strike and ${SHOAL.dps} a second while they grind on. Sloops, schooners, xebecs, bomb ketches and fireships sail over. Captains and drawn courses steer big ships round them.`,
    params: CAPSULE,
    check: (v) => checkCapsules('shoals', v),
    blocks(B, p, T, W, H) {
      if (T && T.L <= SHOAL.maxL) return null;
      const L = T ? T.L : 63;
      for (let i = 0; i < (B.shoals || []).length; i++) if (isObj(B.shoals[i]) && capsuleGap(B.shoals[i], p, W, H) < L * 0.3) return `starts aground on shoal ${i}`;
      return null;
    },
  },
  reefs: {
    about: `Rocks just under the surf. Any ship crossing one loses up to ${REEF.dps} hull a second and is slowed to ${REEF.slow * 100}%. Captains and drawn courses steer round them. Long thin ones (stretch 3-6) make reef lines.`,
    params: CAPSULE,
    check: (v) => checkCapsules('reefs', v),
    blocks(B, p, T, W, H) {
      const Bm = T ? T.B : 22.5;
      for (let i = 0; i < (B.reefs || []).length; i++) if (isObj(B.reefs[i]) && capsuleGap(B.reefs[i], p, W, H) < Bm * 0.3 + 6) return `starts on reef ${i}`;
      return null;
    },
  },
  coast: {
    about: 'A land mass along one edge of the chart with a ragged shore, coves and capes. Ships collide with it like an island and steer along it. One object, or a list for several coasts (a strait).',
    params: {
      side: "which edge: 'left', 'right', 'top' or 'bottom' (of the portrait chart; landscape turns it with everything else)",
      depth: 'how far the land reaches in, as a fraction of the chart across that edge (0.1-0.3 is typical)',
      rough: 'optional: how ragged the shore is, 0 = smooth (default 0.3)',
      coves: 'optional: bays cut into the land, [{ at, width, depth }] (fractions: where along the edge, how wide, how deep)',
      capes: 'optional: headlands pushed out to sea, [{ at, width, depth }]',
      seed: 'optional: a number that reshapes the shore (default from side and depth)',
    },
    check(v) {
      const out = [];
      for (const [i, c] of coastList(v).entries()) {
        const at = Array.isArray(v) ? `coast[${i}]` : 'coast';
        if (!isObj(c)) { out.push(`${at} must be { side, depth, ... }`); continue; }
        if (!SIDES.includes(c.side)) out.push(`${at}: side must be one of ${SIDES.join(', ')}, got ${JSON.stringify(c.side)}`);
        if (!(isNum(c.depth) && c.depth > 0 && c.depth <= 0.5)) out.push(`${at}: depth must be a fraction in (0, 0.5], got ${JSON.stringify(c.depth)}`);
        if (c.rough !== undefined && !(isNum(c.rough) && c.rough >= 0 && c.rough <= 1)) out.push(`${at}: rough must be 0-1`);
        if (c.seed !== undefined && !isNum(c.seed)) out.push(`${at}: seed must be a number`);
        for (const k of ['coves', 'capes']) {
          if (c[k] === undefined) continue;
          if (!Array.isArray(c[k])) { out.push(`${at}: ${k} must be a list of { at, width, depth }`); continue; }
          c[k].forEach((q, j) => {
            if (!isObj(q) || !Object.keys(POINT_FIELDS).every((f) => isFrac(q[f]))) out.push(`${at}: ${k}[${j}] needs at, width and depth as fractions in [0, 1]`);
          });
        }
        for (const k of Object.keys(c)) if (!(k in TERRAIN.coast.params)) out.push(`${at}: unknown field '${k}' (known: ${Object.keys(TERRAIN.coast.params).join(', ')})`);
      }
      return out;
    },
    blocks(B, p, T, W, H) {
      const L = T ? T.L : 63;
      for (const [i, c] of coastList(B.coast).entries()) {
        if (!isObj(c) || !SIDES.includes(c.side) || !isNum(c.depth)) continue;
        if (coastGapFrac(c, p, W, H) < L * 0.42 + 8) return `is on (or touching) the ${c.side} coast${Array.isArray(B.coast) ? ` (coast[${i}])` : ''}`;
      }
      return null;
    },
  },
  fleetAt: {
    about: 'Where your campaign fleet starts: bottom (the default), top (facing down the chart), left, right, center, or explicit { slots: [[x, y], ...], h } with one slot per ship in fleet order. Pair it with enemy positions anywhere for ambushes and enemies astern.',
    params: {
      fleetAt: "'bottom' | 'top' | 'left' | 'right' | 'center' | { slots: [[x, y], ...] (portrait fractions, up to 5), h (heading in degrees; default -90) }",
    },
    check(v) {
      if (typeof v === 'string') return v === 'bottom' || v in LAYOUTS ? [] : [`fleetAt must be bottom, ${Object.keys(LAYOUTS).join(', ')} or { slots, h }, got '${v}'`];
      if (!isObj(v) || !Array.isArray(v.slots) || !v.slots.length) return ['fleetAt { slots, h } needs a non-empty list of [x, y] slots'];
      const out = [];
      if (v.slots.length < 5) out.push(`fleetAt slots must cover a full fleet of 5 ships, got ${v.slots.length}`);
      v.slots.forEach((q, i) => { if (!Array.isArray(q) || !isFrac(q[0]) || !isFrac(q[1])) out.push(`fleetAt slots[${i}] must be [x, y] map fractions`); });
      if (v.h !== undefined && !isNum(v.h)) out.push('fleetAt h must be a heading in degrees');
      return out;
    },
  },
};
// The battle fields that hold geography (all but fleetAt), in the order the renderer layers them.
export const TERRAIN_FIELDS = ['islands', 'shoals', 'reefs', 'coast'];
export { coastList };
