import * as THREE from 'three';
import { TAU, PI } from '../util.js';
import { R, toon } from './gl.js';

// The plants of render/land.js: a few crafted archetypes, built from shared smooth shapes so they shade softly
// in the toon light, with a darker underside baked into their vertex colours (the light that doesn't reach under
// a crown) and an ink outline of an even width whatever their size. Every builder takes the parent group, a spot
// on the ground (x, y, z) in its frame, a scale s (about 1), a seeded random and the region's flora palette
// (FLORA in land.js); opts.ink = false leaves the outline off (a tree inside a grove: its neighbours hide it).
//
//   broadleaf  a rounded crown of three clumps on a short trunk (Port Royal, the jungle, Havana)
//   crown      a grove tree seen from above: one or two clumps, no trunk
//   palm       a curved trunk under arching, drooping fronds; it sways (ctx.sway)
//   pine       three drooping tiers on a stub of trunk (the Windward cliffs)
//   bush       a low clump; scrub is its dry, flat cousin
//   cactus     a saguaro column with an arm or two; agave a rosette of spikes (the Main)
//   mangrove   a dark flat crown on arching stilt roots

// ---------- Shared shapes ----------
function finish(pos, col, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

let G = null;
// The shared shapes (kept when a battle's land is disposed).
export const floraGeos = () => (G ? Object.values(G) : []);
function geos() {
  if (G) return G;
  G = {
    puff: ball(10, [0.66, 1.3, 2.12], 0.5), // a hero clump: lone trees, grove edges, bushes
    puffLo: ball(7, [0.86, 1.75], 0.52), // inside a grove
    tier: tier(8),
    trunk: new THREE.CylinderGeometry(0.75, 1, 1, 5, 1, true).translate(0, 0.5, 0),
    stem: new THREE.CylinderGeometry(1, 1, 1, 7, 1, true).translate(0, 0.5, 0),
    frond: frond(),
    spike: spike(),
  };
  shadeY(G.trunk, 0, 1, 0.7, 1);
  return G;
}

// A smooth ball (a dome closed underneath): rings at polar angles phis, staggered.
function ball(seg, phis, under) {
  const pos = [0, 1, 0], col = [1, 1, 1], idx = [];
  phis.forEach((ph, k) => {
    const off = (k % 2) * (PI / seg);
    const y = Math.cos(ph) * (ph > PI / 2 ? 0.7 : 1), r = Math.sin(ph) * (ph > PI / 2 ? 0.94 : 1);
    const t = Math.min(1, (1 - Math.cos(ph)) / 1.7), shade = 1 - (1 - under) * t * t * (3 - 2 * t);
    for (let j = 0; j < seg; j++) { const a = (j / seg) * TAU + off; pos.push(Math.cos(a) * r, y, Math.sin(a) * r); col.push(shade, shade, shade); }
  });
  const bot = pos.length / 3;
  pos.push(0, -0.72, 0); col.push(under, under, under);
  const at = (k, j) => 1 + k * seg + (((j % seg) + seg) % seg);
  for (let j = 0; j < seg; j++) idx.push(0, at(0, j + 1), at(0, j));
  for (let k = 0; k < phis.length - 1; k++) {
    for (let j = 0; j < seg; j++) {
      // Ring k+1 is turned half a segment from ring k (one way on even k, back on odd).
      if (k % 2 === 0) { idx.push(at(k, j), at(k, j + 1), at(k + 1, j)); idx.push(at(k, j + 1), at(k + 1, j + 1), at(k + 1, j)); }
      else { idx.push(at(k, j), at(k, j + 1), at(k + 1, j + 1)); idx.push(at(k, j), at(k + 1, j + 1), at(k + 1, j)); }
    }
  }
  const last = phis.length - 1;
  for (let j = 0; j < seg; j++) idx.push(bot, at(last, j), at(last, j + 1));
  return finish(pos, col, idx);
}
// A pine tier: a cone whose skirt droops, hollow underneath.
function tier(seg) {
  const pos = [0, 1, 0], col = [1.05, 1.05, 1.05], idx = [];
  for (let j = 0; j < seg; j++) { const a = (j / seg) * TAU, r = 1 + 0.08 * (j % 2); pos.push(Math.cos(a) * r, j % 2 ? -0.06 : 0, Math.sin(a) * r); col.push(0.72, 0.72, 0.72); }
  pos.push(0, 0.28, 0); col.push(0.45, 0.45, 0.45);
  const b = seg + 1;
  for (let j = 0; j < seg; j++) { idx.push(0, 1 + ((j + 1) % seg), 1 + j); idx.push(b, 1 + j, 1 + ((j + 1) % seg)); }
  return finish(pos, col, idx);
}
// A palm frond along +x, unit long: it rises from the crown, arches and droops to a point, folded along its
// midrib. Closed underneath so its ink outline has something to hang on.
function frond() {
  const S = [[0, 0, 0.05], [0.36, 0.13, 0.21], [0.72, 0.03, 0.16]], tip = [1, -0.28];
  const pos = [], col = [], idx = [];
  for (const [x, y, w] of S) {
    pos.push(x, y - 0.035, -w, x, y + 0.025, 0, x, y - 0.035, w);
    col.push(0.82, 0.82, 0.82, 1.08, 1.08, 1.08, 0.82, 0.82, 0.82);
  }
  pos.push(tip[0], tip[1], 0); col.push(0.85, 0.85, 0.85);
  const T = S.length * 3;
  for (let i = 0; i < S.length - 1; i++) {
    const l = i * 3, m = l + 1, r = l + 2, L = l + 3, M = l + 4, Rr = l + 5;
    idx.push(l, m, M, l, M, L, m, Rr, M, m, r, Rr); // the two sides of the fold, on top
    idx.push(l, Rr, r, l, L, Rr); // underneath
  }
  const l = T - 3;
  idx.push(l, l + 1, T, l + 1, l + 2, T, l, T, l + 2);
  return finish(pos, col, idx);
}
// An agave leaf: a thin three-sided spike, unit tall.
function spike() {
  const pos = [0, 1, 0, -0.5, 0, -0.29, 0.5, 0, -0.29, 0, 0, 0.58], col = [1.05, 1.05, 1.05, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7];
  return finish(pos, col, [0, 2, 1, 0, 3, 2, 0, 1, 3]);
}
function shadeY(g, y0, y1, lo, hi) {
  const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const k = lo + (hi - lo) * Math.min(1, Math.max(0, (p.getY(i) - y0) / (y1 - y0))); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
}

// ---------- Helpers ----------
function part(parent, geo, color, x, y, z, sx, sy, sz) {
  const m = new THREE.Mesh(geo, toon(color));
  m.position.set(x, y, z);
  m.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz);
  parent.add(m);
  return m;
}
// An ink outline w map units wide all round (the part is centred on its origin).
export function ink(m, w, drop = 0.3) {
  const o = new THREE.Mesh(m.geometry, R.inkMat), s = m.scale;
  o.scale.set(1 + w / s.x, 1 + w / s.y, 1 + w / s.z);
  o.position.y = -(w * drop) / s.y;
  m.add(o);
  return m;
}
const pick = (list, rnd) => list[Math.floor(rnd(0, list.length)) % list.length];
const INK = 0.55;

// ---------- The archetypes ----------
export function broadleaf(parent, x, y, z, s, rnd, F, opts = {}) {
  const g = geos(), t = new THREE.Group();
  t.position.set(x, y, z);
  t.rotation.y = rnd(0, TAU);
  parent.add(t);
  const k = s * (F.broadScale || 1), c = pick(F.canopy, rnd), w = opts.ink === false ? 0 : INK;
  part(t, g.trunk, F.trunk, 0, -0.5, 0, 1.05 * k, 6.5 * k, 1.05 * k);
  const top = part(t, g.puff, c, 0, 9.6 * k, 0, 6.6 * k, 5.4 * k, 6.6 * k);
  if (w) ink(top, w);
  for (const a of [0.5, 3.4]) {
    const m = part(t, g.puffLo, c, Math.cos(a) * 4 * k, 7.4 * k, Math.sin(a) * 4 * k, 4.6 * k, 3.9 * k, 4.6 * k);
    if (w) ink(m, w);
  }
  return t;
}
// A tree inside a grove, from above: a crown of one or two clumps (lo: the cheaper shape).
export function crown(parent, x, y, z, s, rnd, F, opts = {}) {
  const g = geos(), geo = opts.lo ? g.puffLo : g.puff, k = s * (F.broadScale || 1), c = pick(F.canopy, rnd);
  const h = (opts.h || 8.4) * k;
  const m = part(parent, geo, c, x, y + h, z, 6.9 * k, 5.6 * k, 6.9 * k);
  m.rotation.y = rnd(0, TAU);
  if (opts.ink !== false) ink(m, INK);
  if (opts.two) {
    const a = rnd(0, TAU), m2 = part(parent, geo, c, x + Math.cos(a) * 3.6 * k, y + h - 1.6 * k, z + Math.sin(a) * 3.6 * k, 4.8 * k, 4 * k, 4.8 * k);
    if (opts.ink !== false) ink(m2, INK);
  }
  return m;
}
export function bush(parent, x, y, z, s, rnd, F, colors) {
  const g = geos(), c = pick(colors || F.bush, rnd);
  const m = part(parent, g.puff, c, x, y + 1.7 * s, z, 4 * s, 2.9 * s, 4 * s);
  m.rotation.y = rnd(0, TAU);
  return ink(m, 0.45);
}
// Dry scrub: a low, flat, olive clump with a smaller one beside it.
export function scrub(parent, x, y, z, s, rnd, F) {
  const g = geos(), c = pick(F.scrub || F.bush, rnd);
  ink(part(parent, g.puffLo, c, x, y + 1.1 * s, z, 3.4 * s, 1.9 * s, 3.4 * s), 0.4);
  const a = rnd(0, TAU);
  ink(part(parent, g.puffLo, c, x + Math.cos(a) * 3 * s, y + 0.8 * s, z + Math.sin(a) * 3 * s, 2.2 * s, 1.4 * s, 2.2 * s), 0.35);
}
// lean: which way the trunk leans (radians in the group's frame; palms lean out over the beach), else random.
export function palm(parent, x, y, z, s, rnd, F, ctx, lean) {
  const g = geos(), p = new THREE.Group();
  p.position.set(x, y - 0.4, z);
  parent.add(p);
  s *= 0.95;
  const h = 19 * s * rnd(0.9, 1.1), bend = rnd(0.18, 0.42), dir = lean == null ? rnd(0, TAU) : lean + rnd(-0.5, 0.5);
  // The trunk: a tapering curve, banded light and dark.
  const N = 3, pts = [];
  for (let i = 0; i <= N; i++) { const u = i / N, off = Math.pow(u, 1.7) * bend * h; pts.push([Math.cos(dir) * off, u * h, -Math.sin(dir) * off]); }
  p.add(new THREE.Mesh(trunkGeo(pts, 1.25 * s, 0.7 * s), toon(F.palmTrunk)));
  p.add(new THREE.Mesh(trunkGeo(pts, 1.25 * s + 0.35, 0.7 * s + 0.35), R.inkMat));
  const top = pts[N];
  const head = new THREE.Group();
  head.position.set(top[0], top[1], top[2]);
  p.add(head);
  const n = 6, a0 = rnd(0, TAU);
  for (let i = 0; i < n; i++) {
    const arm = new THREE.Group();
    arm.rotation.set(0, a0 + (i / n) * TAU + rnd(-0.18, 0.18), rnd(-0.12, 0.2), 'YXZ');
    head.add(arm);
    const L = 10.5 * s * rnd(0.88, 1.08);
    const f = part(arm, g.frond, i % 2 ? F.frond[0] : F.frond[1], 0, 0, 0, L, L * 0.75, 3.4 * s);
    ink(f, 0.42, 0.6);
  }
  ctx.sway(p, rnd(0, 0.999));
  return p;
}
// A tube along pts tapering from r0 to r1, five-sided, banded by vertex colour.
function trunkGeo(pts, r0, r1) {
  const seg = 5, pos = [], col = [], idx = [];
  pts.forEach((q, i) => {
    const u = i / (pts.length - 1), r = r0 + (r1 - r0) * u, band = i % 2 ? 0.86 : 1;
    for (let j = 0; j <= seg; j++) { const a = (j / seg) * TAU; pos.push(q[0] + Math.cos(a) * r, q[1], q[2] + Math.sin(a) * r); col.push(band, band, band); }
  });
  for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + seg + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return finish(pos, col, idx);
}
export function pine(parent, x, y, z, s, rnd, F, opts = {}) {
  const g = geos(), t = new THREE.Group();
  t.position.set(x, y, z);
  t.rotation.y = rnd(0, TAU);
  parent.add(t);
  const c = pick(F.pine, rnd), k = s * rnd(0.92, 1.08);
  part(t, g.trunk, F.trunk, 0, -0.5, 0, 0.9 * k, 4.5 * k, 0.9 * k);
  for (const [r, h, yy] of [[5.8, 6.4, 3.4], [4.4, 5.6, 7.4], [2.9, 5, 11]]) {
    const m = part(t, g.tier, c, 0, yy * k, 0, r * k, h * k, r * k);
    if (opts.ink !== false || r > 5) ink(m, 0.5, 0.15); // inside a wood only the skirt is outlined
  }
  return t;
}
export function cactus(parent, x, y, z, s, rnd, F) {
  const g = geos(), t = new THREE.Group();
  t.position.set(x, y - 0.3, z);
  t.rotation.y = rnd(0, TAU);
  parent.add(t);
  const c = F.cactus, H = 8.5 * s * rnd(0.85, 1.15), r = 1.8 * s;
  const col = (px, py, pz, h, rr) => {
    ink(part(t, g.stem, c, px, py, pz, rr, h, rr), 0.35, 0);
    part(t, g.puffLo, c, px, py + h, pz, rr, rr * 0.8, rr);
  };
  col(0, 0, 0, H, r);
  for (const sd of [-1, 1]) {
    if (rnd() < 0.3) continue;
    const hy = H * rnd(0.35, 0.55), ax = sd * 2.6 * s;
    const el = part(t, g.stem, c, 0, hy, 0, r * 0.7, 2.6 * s, r * 0.7);
    el.rotation.z = -sd * PI / 2;
    col(ax, hy - 0.6 * s, 0, H * rnd(0.3, 0.45), r * 0.72);
  }
  return t;
}
export function agave(parent, x, y, z, s, rnd, F) {
  const g = geos(), t = new THREE.Group();
  t.position.set(x, y - 0.2, z);
  parent.add(t);
  const n = 7, a0 = rnd(0, TAU);
  for (let i = 0; i < n; i++) {
    const m = part(t, g.spike, i % 2 ? F.agave[0] : F.agave[1], 0, 0, 0, 0.9 * s, 5.2 * s * rnd(0.85, 1.1), 0.9 * s);
    m.rotation.set(0.75 + (i % 3) * 0.12, a0 + (i / n) * TAU, 0, 'YXZ');
  }
  part(t, g.spike, F.agave[0], 0, 0, 0, 0.8 * s, 5.8 * s, 0.8 * s);
  return t;
}
export function mangrove(parent, x, y, z, s, rnd, F) {
  const g = geos(), t = new THREE.Group();
  t.position.set(x, y, z);
  t.rotation.y = rnd(0, TAU);
  parent.add(t);
  const c = pick(F.mangrove, rnd);
  ink(part(t, g.puff, c, 0, 8.2 * s, 0, 7 * s, 3.6 * s, 7 * s), INK);
  ink(part(t, g.puff, c, 3.4 * s, 7 * s, 1.5 * s, 4.4 * s, 2.6 * s, 4.4 * s), INK);
  // Stilt roots arching from under the crown down into the water.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + rnd(-0.3, 0.3), out = 3.4 * s;
    const root = part(t, g.trunk, F.root, Math.cos(a) * out, -1.2 - y, Math.sin(a) * out, 0.38 * s, 7.6 * s + y, 0.38 * s);
    root.rotation.set(-Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5); // feet out, tops in under the crown
  }
  return t;
}
