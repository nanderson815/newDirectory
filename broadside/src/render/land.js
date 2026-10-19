import * as THREE from 'three';
import { S } from '../state.js';
import { TAU, PI, clamp, lerp, angDiff } from '../util.js';
import { R, toon } from './gl.js';
import { wx, wz, cam } from './camera.js';
import { bakeStatic, FORT_BASE_Y } from './models.js';
import { capsuleRadius, coastDepth, coastPoint, coreDist, coastGap } from '../sim/terrain.js';
import { placer } from '../sim/battle.js';
import { LANDMARKS, RING } from '../sim/land.js';
import { BUILD, palm, broadleaf, pine, cactus, agave, bush, canopy, mangrove, flagCloth, buoys, sharedGeos } from './landmarks.js';
import { buildShoal, buildReef, rng, sharedTerrainGeos } from './terrain.js';

// The land of a battle: islands and coasts with hills, cliffs, beaches and coves in the region's style
// (src/sim/land.js has the styles' ids and the landmarks), the plants and landmarks on them, and the shoals and
// reefs from render/terrain.js. Built once per battle and baked into five meshes: toon land, its ink, the
// translucent shallows, and the swaying things (palms, flags, windmill sails) with their ink, which move in
// the vertex shader. The living details are cheap extras, revealed as you zoom in: chimney smoke (into the
// shared puff pool), lamps (the glow pool), gulls and parrots, people on the wharves and in the squares, scorch
// marks where shot has landed, and calm water in the lee of high land (one draw call each).

// ---------- Styles ----------
// Colours are sRGB hex. hill/plateau in map units; beach is the share of an island's radius that is sand;
// cliffs the share of shore that is cliff on an average island; trees the mix of plants; density per area.
const STYLES = {
  port: {
    sand: '#f2d68f', grass: ['#7cc957', '#61b047'], high: '#4f9a3c', rock: '#9b968c', pad: '#d4bf8c',
    cliffs: 0.12, hill: 18, plateau: 5, beach: 0.17, density: 1, trees: { broad: 0.45, palm: 0.45, bush: 0.1 },
    canopy: ['#3f9a3c', '#4aa13a', '#358a35', '#52ad40'],
  },
  windward: {
    sand: '#e8d39c', grass: ['#9fbe5e', '#80a64e'], high: '#6b8d45', rock: '#8f8b86', pad: '#c9b98f',
    cliffs: 0.45, hill: 26, plateau: 8, beach: 0.09, density: 0.75, trees: { pine: 0.5, palm: 0.2, bush: 0.3 },
    canopy: ['#3f7d45', '#46874a', '#386f3f'],
  },
  main: {
    sand: '#f1d59b', grass: ['#b4c56b', '#98b257'], high: '#7f9a4a', rock: '#c9a679', pad: '#dcc596',
    cliffs: 0.22, hill: 15, plateau: 5, beach: 0.15, density: 0.85, trees: { palm: 0.45, cactus: 0.25, broad: 0.2, agave: 0.1 },
    canopy: ['#6d9e3e', '#7aa846', '#5f9038'],
  },
  golden: {
    sand: '#f4dc98', grass: ['#56b247', '#3f9b3e'], high: '#2f8337', rock: '#7f8b70', pad: '#c9b98c',
    cliffs: 0.18, hill: 30, plateau: 6, beach: 0.13, density: 1.6, trees: { broad: 0.68, palm: 0.32 },
    canopy: ['#2e8a35', '#37963a', '#2a7d31', '#43a33f'],
  },
  pirate: {
    sand: '#f6e3a9', grass: ['#73c457', '#5aad46'], high: '#4b9a3c', rock: '#7a7069', pad: '#d9c08e',
    cliffs: 0.15, hill: 16, plateau: 4, beach: 0.2, density: 1.1, trees: { palm: 0.78, bush: 0.12, broad: 0.1 },
    canopy: ['#3f9a3c', '#4aa13a', '#358a35'],
  },
  campeche: {
    sand: '#eddaa8', grass: ['#8fbb5c', '#74a34c'], high: '#5f8f43', rock: '#9c917e', pad: '#d4c094',
    cliffs: 0, hill: 4, plateau: 2.5, beach: 0.22, density: 1.1, trees: { palm: 0.55, broad: 0.25, bush: 0.2 },
    canopy: ['#3d7d3a', '#46883f', '#538f45'],
  },
  armada: {
    sand: '#eed8a2', grass: ['#7db758', '#63a048'], high: '#4f8c3e', rock: '#cdb88c', pad: '#d8c49a',
    cliffs: 0.35, hill: 16, plateau: 6, beach: 0.12, density: 1, trees: { palm: 0.55, broad: 0.45 },
    canopy: ['#3f9a3c', '#4aa13a', '#358a35'],
  },
};
for (const [id, s] of Object.entries(STYLES)) s.id = id;
export const styleOf = (G) => STYLES[G.style] || STYLES.port;
// Fort stone by region: grey English ragstone, honey-coloured Spanish limestone, mossy jungle stone.
const FORT_LOOK = {
  main: { stone: '#e2cfa2', dark: '#b39d6e' }, armada: { stone: '#dcc48e', dark: '#ae9563' },
  golden: { stone: '#bdb8a0', dark: '#8a8a72' }, campeche: { stone: '#d9cba8', dark: '#a8987a' },
};
export const fortLook = (G) => FORT_LOOK[G.style] || null;
const C = (hex) => new THREE.Color(hex);

const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// Smooth 2D value noise (0-1) and a two-octave sum, for rolling hills and where forests grow.
const hash2 = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hash2(ix, iy), hash2(ix + 1, iy), sx), lerp(hash2(ix, iy + 1), hash2(ix + 1, iy + 1), sx), sy);
}
const fbm = (x, y) => noise2(x, y) * 0.65 + noise2(x * 2.13 + 5.2, y * 2.13 + 1.3) * 0.35;
const bumpA = (a, at, w) => 1 - smooth(w * 0.5, w, Math.abs(angDiff(a, at)));

// ---------- Island relief ----------
// The height of the island's ground at a map offset (dx, dy) from its centre. The shore follows the outline
// the sim made (is.verts), wobbled a little, with a cove bitten out of some; inland it rises from the beach to a
// plateau and rolling hills, and along a cliff arc the high ground runs right to the water. Peaks (landmarks)
// add a mountain; pads flatten the ground under towns, churches and forts.
function islandRelief(G, is, ii, st, pads) {
  const r = rng(is.seed || (ii + 1) * 7919);
  const rel = (G.relief || []).find((q) => q.island === ii) || {};
  const hk = rel.height == null ? 1 : rel.height;
  const n = is.verts.length, s1 = r(0, TAU), s2 = r(0, TAU);
  const cove = !is.fort && r() < 0.5 ? { a: r(0, TAU), w: r(0.5, 0.8), k: r(0.08, 0.13) } : null;
  const shoreR = (a) => {
    const u = ((((a / TAU) % 1) + 1) % 1) * n, i = Math.floor(u), f = u - i, k = f * f * (3 - 2 * f);
    let v = is.verts[i % n] + (is.verts[(i + 1) % n] - is.verts[i % n]) * k;
    v *= 0.96 * (1 + 0.022 * Math.sin(7 * a + s1) + 0.014 * Math.sin(12 * a + s2));
    if (cove) v *= 1 - cove.k * bumpA(a, cove.a, cove.w);
    return is.r * v;
  };
  const cl = clamp(rel.cliffs != null ? rel.cliffs : st.cliffs * r(0.3, 1.6), 0, 0.85), cAt = rel.at != null ? rel.at : r(0, TAU);
  const cliffW = (a) => (cl <= 0.02 ? 0 : 1 - smooth(cl * PI - 0.12, cl * PI + 0.3, Math.abs(angDiff(a, cAt))) * (cove ? 1 : 1));
  // Rolling hills along the island (a long one gets them strung down its ridge).
  const bumps = [], nb = Math.round(r(1, 2.6) * (1 + (is.hl / is.r) * 0.6));
  for (let k = 0; k < nb; k++) {
    const along = is.hl ? r(-0.8, 0.8) * is.hl : 0, a = r(0, TAU), d = r(0, 0.32) * is.r;
    bumps.push([Math.cos(is.ang) * along + Math.cos(a) * d, Math.sin(is.ang) * along + Math.sin(a) * d, is.r * r(0.28, 0.42), st.hill * hk * r(0.45, 1)]);
  }
  const peaks = (G.landmarks || []).filter((o) => (o.kind === 'peak' || o.kind === 'volcano') && o.host && o.host.island === ii)
    .map((o) => ({ x: o.x - is.x, y: o.y - is.y, H: o.height, foot: o.size * is.r * 1.2, crater: o.kind === 'volcano' }));
  const plateau = st.plateau * Math.sqrt(hk);
  // Height without pads, plus what the colours need: share inland, cliff weight, peak weight.
  const out = { t: 0, cliff: 0, peak: 0, crater: false, pad: 0, padColor: null };
  function raw(dx, dy, info) {
    const rho = Math.hypot(dx, dy), a = Math.atan2(dy, dx), Rr = shoreR(a), t = rho / Rr, inland = 1 - t;
    let hills = 0;
    for (const [bx, by, sg, bh] of bumps) { const q = ((dx - bx) ** 2 + (dy - by) ** 2) / (2 * sg * sg); if (q < 6) hills += bh * Math.exp(-q); }
    const land = plateau + (hills + st.hill * hk * 0.3 * noise2((is.x + dx) / 45, (is.y + dy) / 45)) * smooth(0.04, 0.45, inland);
    const sand = 0.45 + 2.3 * smooth(0, st.beach, inland);
    const rise = smooth(st.beach * 0.55, st.beach + 0.22, inland);
    let h = sand + land * rise;
    const c = cliffW(a);
    if (c > 0) h = lerp(h, 0.45 + (3 + land + hills * 0.25) * smooth(0, 0.032, inland), c);
    let pk = 0, cr = false;
    for (const p of peaks) {
      const d = Math.hypot(dx - p.x, dy - p.y) / p.foot;
      if (d >= 1) continue;
      const w = Math.pow(1 - d, 1.3) * (1 - 0.12 * Math.cos(Math.atan2(dy - p.y, dx - p.x) * 3 + s1));
      let ph = p.H * w * smooth(0, 0.25, inland);
      if (p.crater) ph -= p.H * 0.22 * (1 - smooth(0.05, 0.2, d));
      h += ph;
      if (w > pk) { pk = w; cr = p.crater; }
    }
    if (t >= 1) h = lerp(0.45, -3, clamp((t - 1) / 0.035, 0, 1));
    if (info) { info.t = t; info.cliff = c; info.peak = pk; info.crater = cr; }
    return h;
  }
  // Pads: flat ground under buildings at their natural height (a fort's at the tower's foot).
  const flat = [];
  for (const p of pads) flat.push({ x: p.x, y: p.y, r: p.r, h: p.h != null ? p.h : Math.max(3.4, raw(p.x, p.y, null)), color: p.color });
  function h(dx, dy, info) {
    let y = raw(dx, dy, info), pw = 0, pc = null;
    for (const p of flat) {
      const w = 1 - smooth(p.r * 0.85, p.r * 1.8, Math.hypot(dx - p.x, dy - p.y));
      if (w <= 0) continue;
      y = lerp(y, p.h, w);
      if (w > pw) { pw = w; pc = p.color; }
    }
    if (info) { info.pad = pw; info.padColor = pc; }
    return y;
  }
  return { is, h, raw, shoreR, cliffW, out, rnd: r, s1, s2, plateau, cove };
}

// Builds an island's ground mesh (polar grid) with vertex colours, its waterline ink and its shallows.
function islandMesh(rl, st, root, glass) {
  const { is, h, shoreR, out } = rl;
  const TS = [0, 0.12, 0.24, 0.36, 0.47, 0.57, 0.66, 0.74, 0.81, 0.87, 0.92, 0.955, 0.978, 0.992, 1.0, 1.035];
  const nSeg = clamp(Math.round((TAU * is.r + 4 * is.hl) / 5.5), 40, 110);
  const nR = TS.length, pos = new Float32Array((1 + nR * nSeg) * 3), info = [];
  const put = (i, dx, y, dy) => { pos[i * 3] = dx; pos[i * 3 + 1] = y; pos[i * 3 + 2] = dy; };
  put(0, 0, h(0, 0, out), 0); info.push({ ...out, dx: 0, dy: 0 });
  for (let k = 0; k < nR; k++) {
    for (let j = 0; j < nSeg; j++) {
      const a = (j / nSeg) * TAU, Rr = shoreR(a) * TS[k], dx = Math.cos(a) * Rr, dy = Math.sin(a) * Rr;
      put(1 + k * nSeg + j, dx, h(dx, dy, out), dy);
      info.push({ ...out, dx, dy });
    }
  }
  const idx = [];
  for (let j = 0; j < nSeg; j++) idx.push(0, 1 + ((j + 1) % nSeg), 1 + j);
  for (let k = 0; k < nR - 1; k++) {
    for (let j = 0; j < nSeg; j++) {
      const a = 1 + k * nSeg + j, b = 1 + k * nSeg + ((j + 1) % nSeg), c = a + nSeg, d = b + nSeg;
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  paint(geo, info, st, rl);
  const m = new THREE.Mesh(geo, R.vcToon);
  m.position.set(wx(is.x), 0, wz(is.y));
  root.add(m);
  // Waterline ink: a thin dark band just outside the beach, the island's outline.
  const ink = [], inkIdx = [];
  for (let j = 0; j <= nSeg; j++) {
    const a = (j / nSeg) * TAU, Rr = shoreR(a);
    ink.push(Math.cos(a) * (Rr - 0.4), 0.66, Math.sin(a) * (Rr - 0.4), Math.cos(a) * (Rr + 1.9), 0.66, Math.sin(a) * (Rr + 1.9));
    if (j < nSeg) { const b = j * 2; inkIdx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
  }
  const ig = new THREE.BufferGeometry();
  ig.setAttribute('position', new THREE.Float32BufferAttribute(ink, 3));
  ig.setIndex(inkIdx);
  ig.computeVertexNormals();
  const im = new THREE.Mesh(ig, toon('#3a2414'));
  im.position.copy(m.position);
  root.add(im);
  // Shallows and surf round the shore.
  for (const [k, add, color, op, y] of [[1.55, 0, 0x9fe6f0, 0.45, 0.2], [1.25, 0, 0xcdf5f7, 0.6, 0.3], [1.06, 2.5, 0xffffff, 0.88, 0.42]]) {
    const ring = shoreRing(shoreR, nSeg, 0.97, k, add, y);
    const gm = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }));
    gm.position.copy(m.position);
    glass.add(gm);
  }
}
// A flat band from k0 to k1 times the shore radius (plus `add` units), at height y.
function shoreRing(shoreR, n, k0, k1, add, y) {
  const p = [], idx = [];
  for (let j = 0; j <= n; j++) {
    const a = (j / n) * TAU, Rr = shoreR(a);
    p.push(Math.cos(a) * Rr * k0, y, Math.sin(a) * Rr * k0, Math.cos(a) * (Rr * k1 + add), y, Math.sin(a) * (Rr * k1 + add));
    if (j < n) { const b = j * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Vertex colours from height, slope and what the ground is: sand, grass, high ground, rock (cliffs, steep
// slopes, mountain tops), packed earth under towns, dark ash in a crater.
const _c = new THREE.Color(), _d = new THREE.Color();
function paint(geo, info, st, rl) {
  const nor = geo.attributes.normal, pos = geo.attributes.position, n = pos.count;
  const col = new Float32Array(n * 3);
  const sand = C(st.sand), wet = C(st.sand).multiplyScalar(0.82), g0 = C(st.grass[0]), g1 = C(st.grass[1]), high = C(st.high), rock = C(st.rock), ash = C('#57493f');
  const top = rl.plateau + st.hill * 0.55;
  for (let i = 0; i < n; i++) {
    const f = info[i], y = pos.getY(i), ny = nor.getY(i);
    // Lush low ground, drier slopes, darker high ground: the height reads even where the light is flat.
    const nz = noise2(f.dx * 0.04 + rl.s1, f.dy * 0.04 + rl.s2);
    _c.copy(g0).lerp(g1, clamp(smooth(rl.plateau, top, y) * 0.75 + (nz - 0.5) * 0.6, 0, 1));
    _c.lerp(high, smooth(top * 0.9, top * 1.8, y) * 0.85);
    const inland = 1 - f.t, edge = f.s != null ? 1 - smooth(4, 14, f.s) : 1 - smooth(0.01, 0.05, inland);
    const rocky = Math.max(f.cliff * edge * smooth(1.5, 3, y), smooth(0.8, 0.6, ny), smooth(0.55, 0.75, f.peak));
    _c.lerp(rock, clamp(rocky * (1 - smooth(0, 0.25, f.pad)), 0, 1)); // a pad's banks stay green
    if (f.crater && f.peak > 0.8) _c.lerp(ash, smooth(0.8, 0.95, f.peak) * 0.85);
    const sandy = (1 - f.cliff) * (1 - smooth(st.beach * 0.65, st.beach * 1.1, inland));
    _c.lerp(sand, sandy);
    if (f.t > 1) _c.copy(f.cliff > 0.5 ? rock : wet);
    if (f.pad > 0.5 && f.padColor) _c.lerp(_d.set(f.padColor), smooth(0.5, 0.95, f.pad) * 0.5);
    col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

// ---------- Coast relief ----------
// A coast is a strip of ground along the map edge, parameterised by t along the edge (0-1) and s, map units in
// from the shore. Beaches in the coves, cliffs on the capes (and more of them in a rocky region), hills inland.
function coastRelief(G, co, ci, st, place) {
  const def = co.def, r = rng(Math.round(def.depth * 1000) + ci * 131 + 17);
  const a0 = place(...coastPoint(def, 0.5, 0)), a1 = place(...coastPoint(def, 0.5, 1));
  const across = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
  const e0 = place(...coastPoint(def, 0, 0)), e1 = place(...coastPoint(def, 1, 0));
  const ex = e1[0] - e0[0], ey = e1[1] - e0[1], eL2 = ex * ex + ey * ey;
  const depthAt = (t) => coastDepth(def, clamp(t, -0.08, 1.08));
  const point = (t, s) => place(...coastPoint(def, t, depthAt(t) - s / across));
  const s1 = r(0, TAU), s2 = r(0, TAU), s3 = r(0, TAU);
  const capes = def.capes || [], coves = def.coves || [];
  const cliffT = (t) => {
    let c = st.cliffs * clamp(0.5 + 0.9 * Math.sin(t * 9 + s1) * Math.sin(t * 4.3 + s2), 0, 1);
    for (const k of capes) c = Math.max(c, 0.85 * bumpT(t, k.at, k.width * 0.7));
    for (const k of coves) c *= 1 - bumpT(t, k.at, k.width * 1.1);
    return clamp(c, 0, 0.9);
  };
  const pads = [];
  const out = { t: 0, cliff: 0, peak: 0, pad: 0, padColor: null, s: 0 };
  // Hills: two octaves of noise about 150 units across, growing inland into a ridge of high ground.
  const ox = r(0, 100), oy = r(0, 100);
  function raw(t, s, info, mx, my) {
    const c = cliffT(t);
    if (mx == null) [mx, my] = point(t, s);
    const n = fbm(mx / 150 + ox, my / 150 + oy), n2 = noise2(mx / 60 + oy, my / 60 + ox);
    const ridge = smooth(90, 320, s) * (0.7 + 0.6 * noise2(t * 5 + ox, 3.7));
    const land = st.plateau + st.hill * (Math.pow(n, 1.6) * 2.4 * smooth(15, 80, s) + n2 * 0.35 * smooth(20, 60, s) + ridge * 1.5);
    const sandH = 0.45 + 2.3 * smooth(0, 13, s);
    let h = sandH + land * smooth(7, 34, s);
    if (c > 0) h = lerp(h, 0.45 + (5 + land * 1.15) * smooth(0, 4, s), c);
    if (s < 0) h = lerp(0.45, -3, clamp(-s / 2.5, 0, 1));
    if (info) { info.t = 1 - clamp(s / 120, 0, 1); info.cliff = c; info.peak = 0; info.crater = false; info.s = s; }
    return h;
  }
  function h(t, s, info, mx, my) {
    let y = raw(t, s, info, mx, my), pw = 0, pc = null;
    for (const p of pads) {
      const w = 1 - smooth(p.r * 0.85, p.r * 1.8, Math.hypot(mx - p.x, my - p.y));
      if (w <= 0) continue;
      y = lerp(y, p.h, w);
      if (w > pw) { pw = w; pc = p.color; }
    }
    if (info) { info.pad = pw; info.padColor = pc; }
    return y;
  }
  // Map point -> (t, s): t from the edge's direction, s straight in from the shore.
  const tsOf = (x, y) => [((x - e0[0]) * ex + (y - e0[1]) * ey) / eL2, -coastGap(co, x, y)];
  // Where forests grow (0-1): big patches of woodland with meadows between.
  const forest = (mx, my) => fbm(mx / 220 + oy * 1.3, my / 220 + ox * 0.7);
  return { co, def, h, raw, point, tsOf, pads, cliffT, out, rnd: r, s1, s2, plateau: st.plateau, across, forest };
}
const bumpT = (t, at, w) => { const k = clamp((w / 2 - Math.abs(t - at)) / (w / 4), 0, 1); return k * k * (3 - 2 * k); };

function coastMesh(cr, st, root, glass) {
  const SS = [-2.5, 0, 2.5, 6, 10.5, 16, 23, 32, 43, 57, 75, 98, 128, 168, 220, 290, 380, 520, 700];
  const T0 = -0.25, T1 = 1.25, NT = 160;
  const nS = SS.length, pos = new Float32Array((NT + 1) * nS * 3), info = [];
  for (let i = 0; i <= NT; i++) {
    const t = T0 + ((T1 - T0) * i) / NT;
    for (let k = 0; k < nS; k++) {
      const [mx, my] = cr.point(t, SS[k]), j = (i * nS + k) * 3;
      pos[j] = wx(mx); pos[j + 1] = cr.h(t, SS[k], cr.out, mx, my); pos[j + 2] = wz(my);
      info.push({ ...cr.out, dx: mx, dy: my });
    }
  }
  const idx = [];
  for (let i = 0; i < NT; i++) for (let k = 0; k < nS - 1; k++) {
    const a = i * nS + k, b = a + nS, c = a + 1, d = b + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // Fix the winding if this coast came out facing down (it depends on which edge it lies along).
  if (geo.attributes.normal.getY(Math.floor(nS / 2)) < 0) {
    for (let q = 0; q < idx.length; q += 3) { const tmp = idx[q + 1]; idx[q + 1] = idx[q + 2]; idx[q + 2] = tmp; }
    geo.setIndex(idx);
    geo.computeVertexNormals();
  }
  paint(geo, info, st, cr);
  root.add(new THREE.Mesh(geo, R.vcToon));
  // Waterline ink and the shallows: bands seaward of the shore.
  const band = (s0, s1, y) => {
    const p = [], ix = [];
    for (let i = 0; i <= NT; i++) {
      const t = T0 + ((T1 - T0) * i) / NT, [ax, ay] = cr.point(t, s0), [bx, by] = cr.point(t, s1);
      p.push(wx(ax), y, wz(ay), wx(bx), y, wz(by));
      if (i < NT) { const b = i * 2; ix.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setIndex(ix);
    g.computeVertexNormals();
    if (g.attributes.normal.getY(0) < 0) { for (let q = 0; q < ix.length; q += 3) { const tmp = ix[q + 1]; ix[q + 1] = ix[q + 2]; ix[q + 2] = tmp; } g.setIndex(ix); g.computeVertexNormals(); }
    return g;
  };
  root.add(new THREE.Mesh(band(0.4, -1.9, 0.66), toon('#3a2414')));
  for (const [s, color, op, y] of [[-34, 0x9fe6f0, 0.45, 0.2], [-17, 0xcdf5f7, 0.6, 0.3], [-7, 0xffffff, 0.88, 0.42]]) {
    glass.add(new THREE.Mesh(band(2, s, y), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false })));
  }
}

// ---------- Vegetation ----------
function pickTree(st, rnd) {
  let u = rnd(), last = 'bush';
  for (const [k, w] of Object.entries(st.trees)) { last = k; if ((u -= w) < 0) return k; }
  return last;
}
function plant(kind, parent, x, y, z, s, rnd, st, ctx) {
  switch (kind) {
    case 'palm': return palm(parent, x, y, z, s, rnd, ctx);
    case 'broad': return broadleaf(parent, x, y, z, s, rnd, st.canopy);
    case 'pine': return pine(parent, x, y, z, s, rnd, st.canopy);
    case 'cactus': return cactus(parent, x, y, z, s, rnd);
    case 'agave': return agave(parent, x, y, z, s, rnd);
    default: return bush(parent, x, y, z, s, rnd, st.canopy);
  }
}

// ---------- The build ----------
let lastBuild = null;

// Builds the land for battle G: returns the group to add to the scene (and remembers what syncLand animates).
export function buildLand(G) {
  const st = styleOf(G), place = placer(G);
  const root = new THREE.Group(), glass = new THREE.Group(), sway = [];
  const life = { chimneys: [], lamps: [], flags: [], birds: [], people: [], houses: [], plumes: [], glints: [], spin: [] };
  const swayCode = new Map();
  const reliefs = [];

  // Pads under landmarks, by host.
  const islandPads = G.islands.map((is) => (is.fort ? [{ x: 0, y: 0, r: 25, h: FORT_BASE_Y, color: null }] : []));
  const coastPads = (G.coasts || []).map(() => []);
  for (const o of G.landmarks || []) {
    const M = LANDMARKS[o.kind];
    if (!M || M.where !== 'land' || o.kind === 'peak' || o.kind === 'volcano' || !o.host) continue;
    if (o.kind === 'town' && o.host.island != null && G.islands[o.host.island].fort) continue; // a ring of houses, no pad
    const ext = M.extent(o, o.hostR), color = o.kind === 'town' || o.kind === 'church' ? st.pad : o.kind === 'ruin' || o.kind === 'castle' ? '#b5ab8e' : null;
    if (o.host.island != null) { const is = G.islands[o.host.island]; islandPads[o.host.island].push({ x: o.x - is.x, y: o.y - is.y, r: ext + 3, color }); }
    else if (o.host.coast != null) coastPads[o.host.coast].push({ x: o.x, y: o.y, r: ext + 3, color, t: o.host.t, s: o.host.inland });
  }
  G.islands.forEach((is, ii) => {
    const rl = islandRelief(G, is, ii, st, islandPads[ii]);
    reliefs.push({ kind: 'island', rl, is });
    islandMesh(rl, st, root, glass);
  });
  (G.coasts || []).forEach((co, ci) => {
    const cr = coastRelief(G, co, ci, st, place);
    for (const p of coastPads[ci]) cr.pads.push({ ...p, h: Math.max(3.4, cr.raw(p.t, p.s, null)) });
    reliefs.push({ kind: 'coast', cr });
    coastMesh(cr, st, root, glass);
  });

  // Ground height at a map point, for anything that stands on the land (0 at sea).
  const groundAt = (mx, my) => {
    for (const q of reliefs) {
      if (q.kind === 'island') { if (coreDist(q.is, mx, my) < q.is.r * 1.12) return Math.max(0, q.rl.h(mx - q.is.x, my - q.is.y, null)); }
      else { const [t, s] = q.cr.tsOf(mx, my); if (s > -3) return Math.max(0, q.cr.h(t, s, null, mx, my)); }
    }
    return 0;
  };
  const v3 = new THREE.Vector3();
  const toWorld = (g, x, y, z) => g.localToWorld(v3.set(x, y, z));
  const ctx = {
    st, G, rnd: Math.random,
    ground(g, x, z) { g.updateMatrixWorld(true); const p = toWorld(g, x, 0, z); return groundAt(p.x + G.W / 2, p.z + G.H / 2) - g.getWorldPosition(v3).y + 0; },
    chimney(g, x, y, z) { g.updateMatrixWorld(true); const p = toWorld(g, x, y, z); life.chimneys.push([p.x, p.y, p.z, Math.random() * 10]); },
    lamp(g, x, y, z) { g.updateMatrixWorld(true); const p = toWorld(g, x, y, z); life.lamps.push([p.x, p.y, p.z, Math.random() * 6]); },
    glint(g, x, y, z) { g.updateMatrixWorld(true); const p = toWorld(g, x, y, z); life.glints.push([p.x, p.y, p.z, Math.random() * 6]); },
    house(g, x, y, z) { g.updateMatrixWorld(true); const p = toWorld(g, x, y, z); if (ctx.town) ctx.town.push([p.x, p.y, p.z]); },
    flag(g, x, y, z, pattern) {
      g.updateMatrixWorld(true);
      const p = toWorld(g, x, y, z), f = flagCloth(pattern);
      f.position.copy(p);
      f.rotation.y = -G.wind.base;
      f.scale.setScalar(1);
      root.add(f);
      ctx.sway(f, 2 + Math.random() * 0.9);
    },
    gulls(g, x, y, z, n, r, alt) {
      g.updateMatrixWorld(true);
      const p = toWorld(g, x, y, z);
      for (let i = 0; i < n; i++) life.birds.push({ x: p.x, z: p.z, y: p.y + alt + Math.random() * 8, r: r * (0.8 + Math.random() * 0.5), w: (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.4), th: Math.random() * TAU, ph: Math.random() * TAU, parrot: 0 });
    },
    people(g, path, n, y) {
      g.updateMatrixWorld(true);
      for (let i = 0; i < n; i++) {
        const a = toWorld(g, path[0][0], 0, path[0][1]).clone(), b = toWorld(g, path[1][0], 0, path[1][1]).clone();
        const ya = y != null ? toWorld(g, 0, y, 0).y : groundAt(a.x + G.W / 2, a.z + G.H / 2), yb = y != null ? ya : groundAt(b.x + G.W / 2, b.z + G.H / 2);
        life.people.push({ ax: a.x, az: a.z, ay: ya, bx: b.x, bz: b.z, by: yb, ph: Math.random(), sp: 0.05 + Math.random() * 0.05, shirt: Math.floor(Math.random() * 6), pause: Math.random() * 3 });
      }
    },
    sway(obj, code) { obj.userData.sway = code; },
    spin(obj) { obj.userData.spin = true; },
    town: null,
  };

  // Landmarks.
  for (const o of G.landmarks || []) {
    const B = BUILD[o.kind];
    if (!B) continue;
    const g = new THREE.Group();
    const face = o.kind === 'windmill' ? G.wind.base + PI : o.face;
    let gx = o.x, gy = o.y;
    if (o.kind === 'town' && o.host && o.host.island != null && G.islands[o.host.island].fort) {
      const is = G.islands[o.host.island];
      o.ring = true; o.ringR = Math.hypot(o.x - is.x, o.y - is.y);
    }
    g.position.set(wx(gx), o.kind === 'wreck' && !o.host ? 0 : groundAt(gx, gy), wz(gy));
    g.rotation.y = -face;
    root.add(g);
    g.updateMatrixWorld(true);
    ctx.rnd = rng(Math.round(o.x * 7 + o.y * 13) + 3);
    ctx.town = o.kind === 'town' ? [] : null;
    B(g, o, ctx);
    if (o.kind === 'town') life.houses.push({ o, spots: ctx.town });
    if (o.kind === 'harbour' && o.rate > 0) buoys(root, wx(o.ax), wz(o.ay), o.r * 0.92, 6);
    if (o.kind === 'mangroves') mangroveFringe(G, o, reliefs, root, ctx);
    if (o.kind === 'volcano') {
      const is = G.islands[o.host.island];
      life.plumes.push([wx(o.x), groundAt(o.x, o.y) + 2, wz(o.y), o.height]);
      void is;
    }
  }

  // Plants: scattered over each island and along each coast, clear of pads, cliffs edges and peaks.
  const vegCtx = { ...ctx };
  reliefs.forEach((q, qi) => {
    const r = rng(9173 + qi * 71);
    vegCtx.rnd = r;
    if (q.kind === 'island') {
      const { is, rl } = q, area = PI * is.r * is.r + 4 * is.hl * is.r;
      const want = Math.round((area / 300) * st.density * (is.fort ? 0.5 : 1));
      const g = new THREE.Group();
      g.position.set(wx(is.x), 0, wz(is.y));
      root.add(g);
      const pads = islandPads[G.islands.indexOf(is)];
      let made = 0;
      for (let tries = 0; tries < want * 8 && made < want; tries++) {
        const a = r(0, TAU), t = Math.sqrt(r(0.01, 0.82)), Rr = rl.shoreR(a), dx = Math.cos(a) * Rr * t, dy = Math.sin(a) * Rr * t;
        if (pads.some((p) => Math.hypot(dx - p.x, dy - p.y) < p.r + 5)) continue;
        if (landmarkNear(G, is.x + dx, is.y + dy, 6)) continue;
        const y = rl.h(dx, dy, rl.out);
        if (rl.out.peak > 0.5 || (rl.out.cliff > 0.5 && t > 0.88)) continue;
        let kind = pickTree(st, r);
        if (kind === 'palm' && t < 0.35 && st.trees.broad) kind = 'broad';
        plant(kind, g, dx, y, dy, r(0.8, 1.15) * (kind === 'broad' && st.id === 'golden' ? 1.25 : 1), r, st, vegCtx);
        made++;
      }
      // Boulders at the water's edge.
      for (let k = 0; k < 2 + Math.round(is.r / 18); k++) {
        const a = r(0, TAU), Rr = rl.shoreR(a) * r(0.9, 0.97), dx = Math.cos(a) * Rr, dy = Math.sin(a) * Rr;
        if (landmarkNear(G, is.x + dx, is.y + dy, 4)) continue;
        bush(g, dx, rl.h(dx, dy, null) - 2.2, dy, r(0.6, 1.1), r, [st.rock]);
      }
    } else {
      const { cr } = q, g = new THREE.Group();
      root.add(g);
      const pads = cr.pads, clear = (mx, my, pad) => !pads.some((p) => Math.hypot(mx - p.x, my - p.y) < p.r + pad) && !landmarkNear(G, mx, my, pad + 3);
      const dens = st.density;
      // Behind the beach: palms and bushes. Inland: groves of round canopies, thickening away from the sea. Only
      // what the camera can reach (the map plus its margin) is planted.
      for (let t = -0.12; t < 1.12; t += r(0.02, 0.04) / dens) {
        const s = r(15, 40), [mx, my] = cr.point(t, s);
        if (cr.cliffT(t) > 0.5 || !clear(mx, my, 4)) continue;
        const kind = st.trees.palm && r() < 0.7 ? 'palm' : st.trees.cactus && r() < 0.4 ? 'cactus' : st.trees.pine && r() < 0.5 ? 'pine' : 'bush';
        plant(kind, g, wx(mx), cr.h(t, s, null, mx, my), wz(my), r(0.85, 1.15), r, st, vegCtx);
      }
      // Woods: canopies packed where the forest noise is high, a few lone trees in the meadows between.
      const conifer = !!st.trees.pine;
      for (let t = -0.12; t < 1.12; t += 0.011) {
        for (let s0 = 52; s0 < 330; s0 += 21) {
          const s = s0 + r(-7, 7), [mx, my] = cr.point(t + r(-0.004, 0.004), s);
          const f = cr.forest(mx, my), p = f > 0.52 ? 0.75 * dens : 0.05;
          if (r() > p || !clear(mx, my, 6)) continue;
          const y = cr.h(t, s, null, mx, my), big = f > 0.6 ? 1.25 : 1;
          if (conifer && r() < 0.55) pine(g, wx(mx), y, wz(my), r(1, 1.4) * big, r, st.canopy);
          else canopy(g, wx(mx), y, wz(my), r(1.05, 1.45) * big, r, st.canopy, s0 < 80 || f < 0.56);
        }
      }
    }
  });

  // Shoals and reefs (render/terrain.js) join the same bake.
  let seed = 7;
  for (const c of G.shoals || []) glass.add(buildShoal(c, rng(seed++ * 31 + Math.round(c.x + c.y))));
  for (const c of G.reefs || []) root.add(buildReef(c, rng(seed++ * 37 + Math.round(c.x * 3 + c.y))));
  root.add(glass);

  // Bake: everything static into three meshes; the swaying things into two more.
  root.updateMatrixWorld(true);
  const swayOf = (o) => { for (let p = o; p && p !== root; p = p.parent) if (p.userData.sway != null || p.userData.spin) return p; return null; };
  const pivot = new THREE.Vector3();
  const tagFor = (o) => {
    const p = swayOf(o);
    if (!p) return null;
    let t = swayCode.get(p);
    if (!t) {
      p.getWorldPosition(pivot);
      let code = p.userData.sway;
      if (p.userData.spin) { const d = new THREE.Vector3(1, 0, 0).transformDirection(p.matrixWorld); code = 10 + (((Math.atan2(d.z, d.x) % TAU) + TAU) % TAU); }
      t = [pivot.x, pivot.y, pivot.z, code];
      swayCode.set(p, t);
    }
    return t;
  };
  const still = bakeStatic(root, (o) => !!(o.userData.sway != null || o.userData.spin));
  const moving = bakeStatic(root, (o) => o.isMesh && !swayOf(o), null, tagFor);
  const keep = new Set([...sharedGeos(), ...sharedTerrainGeos()]);
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (!keep.has(o.geometry)) o.geometry.dispose();
    if (!o.material.userData.shared && o.material !== R.inkMat && o.material !== R.vcToon) o.material.dispose();
  });
  const out = new THREE.Group();
  out.userData.land = true;
  if (still.solid) out.add(new THREE.Mesh(still.solid, R.vcToon));
  if (still.ink) out.add(new THREE.Mesh(still.ink, R.inkMat));
  if (still.glass) {
    const m = new THREE.Mesh(still.glass, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
    m.renderOrder = 0.5; // under ship shadows and foam, over the sea
    out.add(m);
  }
  const mats = swayMaterials();
  if (moving.solid) out.add(new THREE.Mesh(moving.solid, mats.solid));
  if (moving.ink) out.add(new THREE.Mesh(moving.ink, mats.ink));
  const lee = leeMesh(G);
  if (lee) out.add(lee);
  const pools = lifePools();
  out.add(pools.birds, pools.people, pools.scorch);
  // Parrots in the jungle and on the pirate coast: they loop between the trees.
  if (st.id === 'golden' || st.id === 'pirate' || st.id === 'main') {
    reliefs.filter((q) => q.kind === 'island').slice(0, 3).forEach((q, k) => {
      for (let i = 0; i < 2; i++) life.birds.push({ x: wx(q.is.x), z: wz(q.is.y), y: 30 + q.rl.plateau + i * 6, r: q.is.r * 0.55, w: (k + i) % 2 ? 0.7 : -0.8, th: i * 2, ph: i * 3 + k, parrot: 1 + ((k + i) % 3) });
    });
  }
  lastBuild = { G, mats, life, pools, groundAt, lee };
  return out;
}

const landmarkNear = (G, x, y, pad) => (G.landmarks || []).some((o) => {
  const M = LANDMARKS[o.kind];
  if (!M || o.kind === 'peak' || o.kind === 'volcano' || o.kind === 'mangroves') return false;
  const e = o.kind === 'town' && o.ring ? RING + 4 : o.kind === 'harbour' ? 14 : o.kind === 'stacks' ? 22 : M.extent(o, o.hostR);
  return Math.hypot(x - o.x, y - o.y) < e + pad;
});

// Mangroves along an island's shore (span degrees round `at`) or a stretch of coast.
function mangroveFringe(G, o, reliefs, root, ctx) {
  const r = ctx.rnd;
  if (o.host.island != null) {
    const q = reliefs.find((x) => x.kind === 'island' && x.is === G.islands[o.host.island]), { is, rl } = q;
    const span = ((o.span || 90) * PI) / 180, R0 = is.r;
    const g = new THREE.Group();
    g.position.set(wx(is.x), 0, wz(is.y));
    root.add(g);
    const n = Math.max(3, Math.round((span * R0) / 8));
    for (let i = 0; i < n; i++) {
      const a = o.host.a + (i / (n - 1) - 0.5) * span + r(-0.04, 0.04), Rr = rl.shoreR(a) * r(0.86, 0.94), dx = Math.cos(a) * Rr, dy = Math.sin(a) * Rr;
      if (landmarkNear(G, is.x + dx, is.y + dy, 2) && !nearKind(G, is.x + dx, is.y + dy, 'mangroves')) continue;
      mangrove(g, dx, Math.max(0.6, rl.h(dx, dy, null)), dy, r(0.85, 1.15), r);
    }
  } else if (o.host.coast != null) {
    const q = reliefs.filter((x) => x.kind === 'coast')[o.host.coast], cr = q.cr, span = o.span || 0.3;
    const g = new THREE.Group();
    root.add(g);
    for (let t = o.host.t - span / 2; t < o.host.t + span / 2; t += r(0.012, 0.022)) {
      const s = r(1, 7), [mx, my] = cr.point(t, s);
      mangrove(g, wx(mx), Math.max(0.6, cr.h(t, s, null, mx, my)), wz(my), r(0.85, 1.2), r);
    }
  }
}
const nearKind = (G, x, y, kind) => (G.landmarks || []).some((o) => o.kind === kind && Math.hypot(x - o.x, y - o.y) < 200);

// ---------- Swaying things ----------
// Palms (code 0-1: a phase), flags (2-3) and windmill sails (10 + the axis's angle) move in the vertex shader;
// aTag.xyz is the pivot: a palm's foot, a flag's hoist, a windmill's hub.
const SWAY_VERT = `
attribute vec4 aTag;
uniform float uT, uAmp; uniform vec2 uWind;
vec3 swayMove(vec3 p) {
  float code = aTag.w; vec3 piv = aTag.xyz;
  if (code < 1.5) {
    float hr = clamp((p.y - piv.y) / 24.0, 0.0, 1.5);
    float s = 0.55 + 0.45 * sin(uT * 1.6 + code * 6.2832);
    p.xz += uWind * (uAmp * s * hr * hr);
    p.y += sin(uT * 3.3 + code * 40.0 + p.x * 0.35) * 0.35 * hr * hr;
  } else if (code < 4.0) {
    vec2 d = p.xz - piv.xz; float u = length(d);
    vec2 n = u > 0.01 ? vec2(-d.y, d.x) / u : vec2(0.0);
    p.xz += n * sin(uT * 7.5 - u * 0.75 + code * 9.0) * u * 0.11;
    p.y += sin(uT * 5.0 - u * 0.5 + code * 7.0) * u * 0.03;
  } else {
    float A = code - 10.0; vec3 k = vec3(cos(A), 0.0, sin(A)); float th = uT * 1.1;
    vec3 v = p - piv;
    v = v * cos(th) + cross(k, v) * sin(th) + k * dot(k, v) * (1.0 - cos(th));
    p = piv + v;
  }
  return p;
}
`;
// Made per battle: the scene disposes the land's materials when it's rebuilt.
function swayMaterials() {
  const uniforms = { uT: { value: 0 }, uAmp: { value: 1.6 }, uWind: { value: new THREE.Vector2(1, 0) } };
  const hook = (m) => {
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = SWAY_VERT + sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = swayMove(vec3(position));');
    };
    m.customProgramCacheKey = () => 'land-sway';
    return m;
  };
  return {
    solid: hook(toon('#ffffff', { vertexColors: true })),
    ink: hook(new THREE.MeshBasicMaterial({ color: R.inkMat.color, side: THREE.BackSide })),
    uniforms,
  };
}

// ---------- The lee of high land ----------
// Calm, glassy water downwind of each peak: a patch shaped like the sim's wind shadow (src/sim/land.js leeAt),
// turned with the wind in the vertex shader.
function leeMesh(G) {
  if (!G.lee || !G.lee.length) return null;
  const pos = [], loc = [], cen = [], alp = [], idx = [];
  const NU = 14, NV = 7;
  for (const c of G.lee) {
    const base = pos.length / 3;
    for (let i = 0; i <= NU; i++) {
      const along = -c.r + ((c.len + 2 * c.r) * i) / NU, w = c.r * (1 + 0.35 * Math.max(0, along) / c.len);
      for (let j = 0; j <= NV; j++) {
        const across = (j / NV - 0.5) * 2 * w * 1.3;
        const ka = 1 - smooth(w * 0.7, w * 1.3, Math.abs(across)), kl = 1 - smooth(c.len * 0.45, c.len + c.r, along);
        pos.push(0, 0.28, 0); loc.push(along, across); cen.push(wx(c.x), wz(c.y));
        alp.push(ka * kl * (1 - c.calm) * 2 * smooth(-c.r, -c.r * 0.2, along));
      }
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      const a = base + i * (NV + 1) + j, b = a + NV + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aLoc', new THREE.Float32BufferAttribute(loc, 2));
  g.setAttribute('aCen', new THREE.Float32BufferAttribute(cen, 2));
  g.setAttribute('aA', new THREE.Float32BufferAttribute(alp, 1));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
    uniforms: { uWind: { value: new THREE.Vector2(1, 0) }, uT: { value: 0 }, uCol: { value: new THREE.Color('#0d4a74') }, uLine: { value: new THREE.Color('#bfe6f5') } },
    vertexShader: `
      attribute vec2 aLoc, aCen; attribute float aA;
      uniform vec2 uWind;
      varying float vA; varying vec2 vL;
      void main(){
        vec2 p = aCen + uWind * aLoc.x + vec2(-uWind.y, uWind.x) * aLoc.y;
        vA = aA; vL = aLoc;
        gl_Position = projectionMatrix * viewMatrix * vec4(p.x, position.y, p.y, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uCol, uLine; uniform float uT;
      varying float vA; varying vec2 vL;
      void main(){
        // Glassy calm: a darker sheen with a few slow, faint streaks running downwind.
        float streak = smoothstep(0.92, 1.0, sin(vL.y * 0.32 + sin(vL.x * 0.02 + uT * 0.3) * 1.5)) * 0.5;
        vec3 c = mix(uCol, uLine, streak);
        gl_FragColor = vec4(c, clamp(vA, 0.0, 1.0) * (0.42 + streak * 0.3));
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  m.renderOrder = 0.6;
  m.frustumCulled = false;
  return m;
}

// ---------- Living details ----------
const BIRDS = 32, PEOPLE = 48, SCORCH = 40;
function lifePools() {
  const birds = new THREE.InstancedMesh(birdGeometry(), birdMaterial(), BIRDS);
  birds.geometry.setAttribute('aFlap', new THREE.InstancedBufferAttribute(new Float32Array(BIRDS), 1).setUsage(THREE.DynamicDrawUsage));
  birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  birds.setColorAt(0, new THREE.Color(1, 1, 1));
  birds.frustumCulled = false; birds.count = 0; birds.renderOrder = 3;
  const people = new THREE.InstancedMesh(personGeometry(), personMaterial(), PEOPLE);
  people.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  people.setColorAt(0, new THREE.Color(1, 1, 1));
  people.frustumCulled = false; people.count = 0;
  const scorch = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), toon('#2c231c', {}), SCORCH);
  scorch.frustumCulled = false; scorch.count = 0;
  return { birds, people, scorch };
}

// A cartoon bird: body and two wings that beat (aWing), with an ink rim drawn first underneath (aInk).
// aTint 1 marks what the instance colour paints (a parrot's plumage; gulls stay white).
function birdGeometry() {
  const pos = [], col = [], wing = [], tint = [];
  const tris = [];
  const W = [1, 1, 1], G = [0.82, 0.86, 0.9], K = [0.2, 0.2, 0.24];
  tris.push([[4, 0, 0], [0, 0, 1], [-3.6, 0, 0], W, 1], [[4, 0, 0], [-3.6, 0, 0], [0, 0, -1], W, 1], [[-3, 0, 0], [-5.8, 0, 1.4], [-5.8, 0, -1.4], G, 1]);
  for (const s of [1, -1]) {
    tris.push([[1.6, 0, 0.7 * s], [1.5, 0.6, 5 * s], [-1.4, 0, 0.7 * s], W, 1], [[1.5, 0.6, 5 * s], [-0.8, 0.6, 4.7 * s], [-1.4, 0, 0.7 * s], W, 1], [[1.5, 0.6, 5 * s], [-3, -0.2, 9.5 * s], [-0.8, 0.6, 4.7 * s], G, 0.6]);
  }
  tris.push([[4, 0.05, 0], [5.4, 0.05, 0.35], [5.4, 0.05, -0.35], [0.95, 0.7, 0.2], 0]);
  const ink = [0.23, 0.14, 0.08];
  for (const isInk of [true, false]) {
    for (const [a, b, c, cc, tt] of tris) {
      for (const p of [a, b, c]) {
        if (isInk) pos.push(p[0] * 1.2, p[1] - 0.4, p[2] * 1.15); else pos.push(p[0], p[1], p[2]);
        col.push(...(isInk ? ink : cc));
        wing.push(Math.abs(p[2]) / 9.5 * 4.5);
        tint.push(isInk ? 0 : tt);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 1));
  g.setAttribute('aTint', new THREE.Float32BufferAttribute(tint, 1));
  return g;
}
function birdMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: `
      attribute vec3 aCol; attribute float aWing, aTint, aFlap;
      varying vec3 vC;
      void main(){
        vec3 p = position; p.y += aFlap * aWing;
        vC = mix(aCol, aCol * instanceColor, aTint);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: 'varying vec3 vC; void main(){ gl_FragColor = vec4(vC, 1.0); }',
    side: THREE.DoubleSide,
  });
}
// A little person: a body (painted with the instance colour: shirts) and a head, inked by an inside-out copy.
function personGeometry() {
  const parts = [];
  const body = new THREE.CylinderGeometry(0.8, 1.05, 2.8, 6).translate(0, 1.4, 0), head = new THREE.IcosahedronGeometry(0.78, 0).translate(0, 3.35, 0);
  const hat = new THREE.CylinderGeometry(0.5, 1.05, 0.5, 6).translate(0, 4.05, 0);
  for (const [g, c, shirt] of [[body, [1, 1, 1], 1], [head, [0.93, 0.74, 0.58], 0], [hat, [0.3, 0.22, 0.16], 0]]) parts.push([g.toNonIndexed(), c, shirt]);
  const pos = [], col = [], sh = [];
  for (const ink of [true, false]) {
    for (const [g, c, shirt] of parts) {
      const p = g.attributes.position.array;
      for (let i = 0; i < p.length; i += 9) {
        const tri = ink ? [0, 6, 3] : [0, 3, 6];
        for (const o of tri) {
          if (ink) pos.push(p[i + o] * 1.32, (p[i + o + 1] - 2) * 1.12 + 2, p[i + o + 2] * 1.32); else pos.push(p[i + o], p[i + o + 1], p[i + o + 2]);
          col.push(...(ink ? [0.12, 0.07, 0.04] : c)); sh.push(ink ? 0 : shirt);
        }
      }
    }
  }
  for (const [g] of parts) g.dispose();
  body.dispose(); head.dispose(); hat.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('aShirt', new THREE.Float32BufferAttribute(sh, 1));
  g.computeVertexNormals();
  return g;
}
function personMaterial() {
  const m = toon('#ffffff', { vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute float aShirt;\n' + sh.vertexShader.replace('#include <color_vertex>', 'vColor = vec3(1.0); vColor *= color; vColor *= mix(vec3(1.0), instanceColor, aShirt);');
  };
  m.customProgramCacheKey = () => 'land-person';
  return m;
}

const SHIRTS = ['#c8302a', '#2f6fd6', '#f4efe4', '#d9a53a', '#3d7a52', '#7a3a6a'].map(C);
const PARROTS = [C('#e0402e'), C('#2f9ad6'), C('#3cbf4c'), C('#f2c232')];
const _E = new THREE.Euler(0, 0, 0, 'YXZ'), _Q = new THREE.Quaternion(), _P = new THREE.Vector3(), _S = new THREE.Vector3(), _M = new THREE.Matrix4(), _W = new THREE.Color(1, 1, 1);

// How much of the close-up detail shows: 0 zoomed out, 1 zoomed right in.
export function landDetail() {
  if (!cam.ready) return 0.5;
  const far = cam.dComfort * 1.15, near = cam.dClose;
  return clamp((far - cam.d) / Math.max(1, far - near), 0, 1);
}

// Animates the land every frame. np/ng are the next free puff and glow instances in the shared pools; returns
// them advanced (in out.np, out.ng) so scene.js can close the pools.
const OUT = { np: 0, ng: 0 };
const scorchY = new WeakMap(); // ground height under each scorch mark, worked out once
export function syncLand(G, clock, dt, np, ng) {
  OUT.np = np; OUT.ng = ng;
  const L = lastBuild;
  if (!L || L.G !== G) return OUT;
  const P = R.pools, C3 = R.C3, det = landDetail();
  const u = L.mats.uniforms;
  u.uT.value = clock;
  u.uWind.value.set(Math.cos(G.wind.dir), Math.sin(G.wind.dir));
  if (L.lee) { L.lee.material.uniforms.uWind.value.copy(u.uWind.value); L.lee.material.uniforms.uT.value = clock; }
  const life = L.life, wdx = Math.cos(G.wind.dir), wdz = Math.sin(G.wind.dir);

  // Chimney smoke: a few puffs rising and drifting downwind, more of them as you zoom in.
  const per = det > 0.15 ? 1 + Math.round(det * 2) : 0;
  for (const [x, y, z, ph] of life.chimneys) {
    for (let k = 0; k < per && np < 990; k++) {
      const t = (clock * 0.25 + ph + k / per) % 1, sz = (0.45 + t * 1.5) * (t < 0.15 ? t / 0.15 : 1) * (1 - t * t);
      setInst(P.puff, np, x + wdx * t * 14, y + t * 13, z + wdz * t * 14, sz, sz, sz, t * 3, ph, 0);
      P.puff.setColorAt(np++, C3.chimney || C3.shellSmoke);
    }
  }
  // Volcano plumes: a lazy column of grey cloud leaning downwind, always on.
  for (const [x, y, z, H] of life.plumes) {
    for (let k = 0; k < 10 && np < 990; k++) {
      const t = (clock * 0.06 + k / 10) % 1, sz = (2.2 + t * 12) * (t < 0.12 ? t / 0.12 : 1) * (t > 0.8 ? (1 - t) / 0.2 : 1);
      setInst(P.puff, np, x + wdx * t * t * 110 + Math.sin(k * 3.1) * 3 * t, y + 3 + t * 80, z + wdz * t * t * 110 + Math.cos(k * 2.3) * 3 * t, sz, sz * 0.8, sz, k, t, 0);
      P.puff.setColorAt(np++, t < 0.3 ? C3.soot : k % 3 ? C3.shellSmoke : C3.soot);
    }
    if (ng < 398) { const f = 0.75 + 0.25 * Math.sin(clock * 3.1); setInst(P.glow, ng, x, y - 0.5, z, 2.6 * f, 0.8, 2.6 * f); P.glow.setColorAt(ng++, C3.ember); }
  }
  // Lighthouse and castle lamps: a warm light that pulses slowly.
  for (const [x, y, z, ph] of life.lamps) {
    if (ng >= 399) break;
    const f = 2.6 + 0.6 * Math.sin(clock * 2.2 + ph);
    setInst(P.glow, ng, x, y, z, f, f * 1.1, f); P.glow.setColorAt(ng++, C3.flame);
  }
  // The golden idol on a ruin glints now and then.
  for (const [x, y, z, ph] of life.glints) {
    const gl = Math.sin(clock * 1.7 + ph);
    if (gl < 0.9 || ng >= 398) continue;
    const sz = 3 * (gl - 0.9) / 0.1;
    setInst(P.glow, ng, x, y, z, sz * 0.4, sz * 2, sz * 0.4); P.glow.setColorAt(ng++, C3.glint);
    setInst(P.glow, ng, x, y, z, sz * 2, sz * 0.4, sz * 0.4); P.glow.setColorAt(ng++, C3.glint);
  }
  // Towns under fire: flames and smoke from the houses hit, a pall of smoke once sacked.
  for (const { o, spots } of life.houses) {
    if (!(o.burn > 0.02 || o.sacked) || !spots.length) continue;
    const n = o.sacked ? spots.length : Math.ceil(spots.length * Math.min(1, o.burn));
    for (let i = 0; i < n; i++) {
      const [x, y, z] = spots[i];
      if (ng < 397) {
        const fl = 0.8 + 0.25 * Math.sin(clock * 11 + i * 2.3);
        setInst(P.glow, ng, x, y + 2, z, 3.2 * fl, 4.6 * fl, 3.2 * fl); P.glow.setColorAt(ng++, i % 2 ? C3.fire : C3.ember);
        setInst(P.glow, ng, x, y + 4.5 + ((clock * 2 + i * 0.3) % 1) * 4, z, 1.8 * fl, 3 * fl, 1.8 * fl); P.glow.setColorAt(ng++, C3.flame);
      }
      for (let k = 0; k < 4 && np < 990; k++) {
        const t = (clock * 0.45 + k / 4 + i * 0.17) % 1, sz = (2 + t * 6) * (t > 0.85 ? (1 - t) / 0.15 : 1);
        setInst(P.puff, np, x + wdx * t * 34, y + 5 + t * 30, z + wdz * t * 34, sz, sz, sz, k, i, 0);
        P.puff.setColorAt(np++, C3.soot);
      }
    }
  }

  // Birds: gulls circling the lighthouses, wharves and wrecks; parrots looping over the jungle.
  const bp = L.pools.birds, flap = bp.geometry.attributes.aFlap.array;
  let nb = 0;
  if (det > 0.1) {
    for (const q of life.birds) {
      if (nb >= BIRDS) break;
      q.th += q.w * dt * (q.parrot ? 1.3 : 1);
      const x = q.x + Math.cos(q.th) * q.r, z = q.z + Math.sin(q.th) * q.r * (q.parrot ? 0.6 : 1);
      const yaw = -(q.th + Math.sign(q.w) * PI / 2), beat = q.parrot ? 1 : clamp((Math.sin(clock * 0.6 + q.ph) - 0.3) * 3, 0, 1);
      _E.set(Math.sign(q.w) * 0.3, yaw, 0); _Q.setFromEuler(_E);
      const sc = (q.parrot ? 0.38 : 0.5) * (0.7 + 0.3 * det);
      bp.setMatrixAt(nb, _M.compose(_P.set(x, q.y + Math.sin(clock * 0.9 + q.ph) * 3, z), _Q, _S.setScalar(sc)));
      bp.setColorAt(nb, q.parrot ? PARROTS[q.parrot % PARROTS.length] : _W);
      flap[nb++] = Math.sin(clock * (q.parrot ? 16 : 10) + q.ph * 7) * beat + (1 - beat) * 0.1;
    }
  }
  bp.count = nb;
  if (nb) { bp.instanceMatrix.needsUpdate = true; bp.geometry.attributes.aFlap.needsUpdate = true; bp.instanceColor.needsUpdate = true; }

  // People: walk to and fro along their paths, pausing at each end; only when you're close enough to see them.
  const pp = L.pools.people;
  let nq = 0;
  if (det > 0.3) {
    for (const q of life.people) {
      if (nq >= PEOPLE) break;
      const len = Math.hypot(q.bx - q.ax, q.bz - q.az) || 1, cyc = 2 * len / 9 + 2 * q.pause;
      const t = ((clock + q.ph * cyc) % cyc) / cyc;
      const walk = (len / 9) / cyc;
      let k, dir;
      if (t < walk) { k = t / walk; dir = 1; } else if (t < walk + q.pause / cyc) { k = 1; dir = 0; } else if (t < 2 * walk + q.pause / cyc) { k = 1 - (t - walk - q.pause / cyc) / walk; dir = -1; } else { k = 0; dir = 0; }
      const x = lerp(q.ax, q.bx, k), z = lerp(q.az, q.bz, k), y = lerp(q.ay, q.by, k);
      const yaw = Math.atan2(q.bz - q.az, q.bx - q.ax) + (dir < 0 ? PI : 0);
      _E.set(0, -yaw, dir ? Math.sin(clock * 9 + q.ph * 20) * 0.08 : 0); _Q.setFromEuler(_E);
      const sc = 0.9 * clamp((det - 0.3) / 0.25, 0, 1);
      pp.setMatrixAt(nq, _M.compose(_P.set(x, y + (dir ? Math.abs(Math.sin(clock * 9 + q.ph * 20)) * 0.4 : 0), z), _Q, _S.setScalar(sc)));
      pp.setColorAt(nq++, SHIRTS[q.shirt]);
    }
  }
  pp.count = nq;
  if (nq) { pp.instanceMatrix.needsUpdate = true; pp.instanceColor.needsUpdate = true; }

  // Scorch marks where shot has come down on the land.
  const sp = L.pools.scorch, sc = G.scorch || [];
  let ns = 0;
  for (let i = 0; i < sc.length && ns < SCORCH; i++) {
    const [mx, my, t0] = sc[i], k = clamp((G.t - t0) * 6, 0, 1), r = (2.2 + ((i * 7) % 5) * 0.5) * k;
    if (r <= 0) continue;
    _E.set(0, i * 1.7, 0); _Q.setFromEuler(_E);
    let gy = scorchY.get(sc[i]);
    if (gy == null) { gy = L.groundAt(mx, my); scorchY.set(sc[i], gy); }
    sp.setMatrixAt(ns++, _M.compose(_P.set(wx(mx), gy + 0.1, wz(my)), _Q, _S.set(r, 0.35, r * 0.8)));
  }
  sp.count = ns;
  if (ns) sp.instanceMatrix.needsUpdate = true;
  OUT.np = np; OUT.ng = ng;
  return OUT;
}

const _E2 = new THREE.Euler(), _Q2 = new THREE.Quaternion();
function setInst(mesh, i, x, y, z, sx, sy, sz, rx, ry, rz) {
  _E2.set(rx || 0, ry || 0, rz || 0); _Q2.setFromEuler(_E2);
  _P.set(x, y, z); _S.set(sx, sy, sz);
  _M.compose(_P, _Q2, _S);
  mesh.setMatrixAt(i, _M);
}

// The ground height under a map point in the current battle's land (0 at sea), for the scene and tests.
export const landHeight = (mx, my) => (lastBuild ? lastBuild.groundAt(mx, my) : 0);
// For tests and the perf report: what the land has to animate.
export const landLife = () => (lastBuild ? { birds: lastBuild.life.birds.length, people: lastBuild.life.people.length, chimneys: lastBuild.life.chimneys.length, lamps: lastBuild.life.lamps.length, plumes: lastBuild.life.plumes.length } : null);
// What the living details are drawing right now (tests).
export const landStats = () => (lastBuild ? { birds: lastBuild.pools.birds.count, people: lastBuild.pools.people.count, scorch: lastBuild.pools.scorch.count, detail: +landDetail().toFixed(2) } : null);
