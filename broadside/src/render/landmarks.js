import * as THREE from 'three';
import { TAU, PI } from '../util.js';
import { toon, withOutline } from './gl.js';
import { hullShape, liftedExtrude } from './shapes.js';
import { bush, palm, broadleaf } from './flora.js';

// Landmark and plant models for render/land.js. Every builder works in the landmark's own frame: the group sits
// on the ground at its spot with +x facing out to sea (or into the wind, for a windmill). Builders register
// the living details (chimney smoke, lamps, flags, gulls, people) with ctx; land.js animates them. Geometry is
// throwaway: the whole land is baked into a few meshes once per battle.
//
// ctx: { rnd(lo, hi), st (the style palette), G, ground(g, x, z) (the terrain height under a local point, in the
// group's frame), chimney(g, x, y, z), lamp(g, x, y, z), flag(g, x, y, z, pattern), gulls(g, x, y, z, n, r, alt),
// people(g, [[x0, z0], [x1, z1]], n), house(g, x, z) (a building fire can take), plume(g, x, y, z), sway(obj, code) }

// ---------- Small helpers ----------
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0, r1, h, n = 7, open = false) => new THREE.CylinderGeometry(r0, r1, h, n, 1, open);
let blobGeo = null;
export const sharedGeos = () => [blobGeo].filter(Boolean);
const blob = () => (blobGeo = blobGeo || new THREE.IcosahedronGeometry(1, 0));
function add(parent, geo, color, x, y, z, ink) {
  const m = new THREE.Mesh(geo, toon(color));
  m.position.set(x, y, z);
  parent.add(m);
  if (ink) withOutline(m, ink);
  return m;
}
// A gable roof over a w x d plan (ridge along x), h high, overhanging by o; flat-shaded.
function gable(w, d, h, o = 1) {
  const x = w / 2 + o, z = d / 2 + o;
  const p = [-x, 0, -z, x, 0, -z, x, 0, z, -x, 0, z, -x, h, 0, x, h, 0];
  const idx = [0, 4, 5, 0, 5, 1, 2, 5, 4, 2, 4, 3, 1, 5, 2, 3, 4, 0, 0, 1, 2, 0, 2, 3];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setIndex(idx);
  const f = g.toNonIndexed(); g.dispose();
  f.computeVertexNormals();
  return f;
}
// A hipped roof: a four-sided pyramid squashed to the plan.
function hip(w, d, h) {
  const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(PI / 4);
  g.scale(w + 1.6, h, d + 1.6).translate(0, h / 2, 0);
  const f = g.toNonIndexed(); g.dispose();
  f.computeVertexNormals();
  return f;
}
// Flat things (flags) need both faces for the one-sided toon material.
export function twoSided(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const p = g.attributes.position.array, n = p.length / 9, out = new Float32Array(p.length * 2);
  out.set(p);
  for (let i = 0; i < n; i++) {
    const s = i * 9, d = p.length + s;
    out.set(p.subarray(s, s + 3), d); out.set(p.subarray(s + 6, s + 9), d + 3); out.set(p.subarray(s + 3, s + 6), d + 6);
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.BufferAttribute(out, 3));
  r.computeVertexNormals();
  g.dispose();
  return r;
}
// A foundation that runs down into the slope so a building never floats.
const footing = (g, w, d, color) => add(g, box(w + 0.8, 6, d + 0.8), color, 0, -2.6, 0);

// ---------- Flags ----------
// The cloth hangs from the hoist (the group's origin) and flies along +x; land.js turns it downwind and the
// sway shader makes it ripple. pattern: english (St George), spanish (the cross of Burgundy), pirate (skull).
export function flagCloth(pattern) {
  const g = new THREE.Group();
  const fw = 9, fh = 6;
  const base = new THREE.PlaneGeometry(fw, fh, 4, 2).translate(fw / 2, -fh / 2, 0);
  add(g, twoSided(base), pattern === 'pirate' ? '#1f1b1e' : '#f7f2e4', 0, 0, 0);
  base.dispose();
  const bar = (w, h, x, y, rot, color) => {
    const p = new THREE.PlaneGeometry(w, h).rotateZ(rot).translate(x, y, 0);
    for (const z of [0.12, -0.12]) add(g, twoSided(p), color, 0, 0, z);
    p.dispose();
  };
  if (pattern === 'english') { bar(fw, 1.3, fw / 2, -fh / 2, 0, '#c8302a'); bar(1.3, fh, fw * 0.42, -fh / 2, 0, '#c8302a'); }
  else if (pattern === 'spanish') { const L = Math.hypot(fw, fh) * 0.86, a = Math.atan2(fh, fw); bar(L, 0.9, fw / 2, -fh / 2, a, '#b8322b'); bar(L, 0.9, fw / 2, -fh / 2, -a, '#b8322b'); }
  else if (pattern === 'pirate') {
    bar(5, 0.7, fw / 2, -fh * 0.62, 0.6, '#efe6d2'); bar(5, 0.7, fw / 2, -fh * 0.62, -0.6, '#efe6d2');
    const head = new THREE.CircleGeometry(1.5, 7).translate(fw / 2, -fh * 0.4, 0);
    for (const z of [0.14, -0.14]) add(g, twoSided(head), '#efe6d2', 0, 0, z);
    head.dispose();
  }
  return g;
}
const FLAG = { port: 'english', windward: 'pirate', main: 'spanish', golden: 'spanish', pirate: 'pirate', campeche: 'spanish', armada: 'spanish' };
const flagFor = (o, st) => (o.team === 'player' ? 'english' : o.look === 'shanty' ? 'pirate' : o.look === 'english' ? 'english' : FLAG[st.id] || 'spanish');
function pole(g, x, z, h, ctx, pattern) {
  const y = ctx.ground(g, x, z);
  add(g, cyl(0.35, 0.45, h, 5), '#6b4a2a', x, y + h / 2, z);
  ctx.flag(g, x, y + h - 0.3, z, pattern);
}

// ---------- Buildings ----------
// Each region builds in one manner, so a town reads as a place rather than a pile of boxes: English cottages
// under steep slate gables, Spanish whitewash under low terracotta roofs, Havana's pastel fronts two and three
// storeys tall, pirate plank shacks on stilts under patched sailcloth, palm-thatched fishing huts.
const LOOK = {
  english: { walls: ['#f1e7d0', '#e8dcc2', '#dccbab'], roofs: ['#5c5e69', '#656370', '#596069'], accent: '#9a5038', foot: '#a39783', trim: '#5a3d26', glass: '#3b4a5a' },
  spanish: { walls: ['#f7f2e8', '#f2eadb', '#ece1cb'], roofs: ['#c4613a', '#bb5a39', '#cc6c44'], foot: '#c9b48c', trim: '#7a5232', glass: '#2f5e7a' },
  city: { walls: ['#f2c6c2', '#f4e1a1', '#a9d6e5', '#f7f1e3', '#c9e4b4', '#f0b98d'], roofs: ['#c4613a', '#bb5a39', '#cc6c44'], foot: '#c9b48c', trim: '#7a5232', glass: '#2f5e7a' },
  shanty: { walls: ['#8b6a4a', '#9a7b58', '#7d5f42'], roofs: ['#d8caa2', '#cbbb93', '#bfae86'], accent: '#8d4a36', foot: '#6b4f36', trim: '#3a2a1c', glass: '#2a2018' },
  village: { walls: ['#e2cfa8', '#d8c29a'], roofs: ['#caa458', '#bf9a4e', '#d0ac62'], foot: '#b8996a', trim: '#5a3d26', glass: '#3a2a1c' },
};
const pick = (list, rnd) => list[Math.floor(rnd(0, list.length)) % list.length];
// How big a house is, by look: w along the street (the ridge), d deep, h to the eaves.
function plan(look, rnd) {
  if (look === 'city') return { w: rnd(8.4, 10.6), d: rnd(7.8, 9), h: rnd(9.5, 13) };
  if (look === 'shanty') return { w: rnd(8.4, 10.6), d: rnd(6.7, 7.8), h: rnd(5.4, 6.5) };
  if (look === 'village') return { w: 9, d: 9, h: 5 };
  return { w: rnd(8.4, 10.6), d: rnd(7.3, 8.4), h: look === 'english' ? rnd(6.2, 7.3) : rnd(5.8, 7.2) };
}

// One house at (x, z) in g's frame, turned yaw: its ridge runs along local x and its front (door, windows)
// faces local +z. Registers its chimney, its fire spot and its soft shadow.
function house(g, look, x, z, yaw, rnd, ctx, p) {
  const L = LOOK[look] || LOOK.english, y = ctx.ground(g, x, z), { w, d, h } = p;
  const b = new THREE.Group();
  b.position.set(x, y, z); b.rotation.y = yaw;
  g.add(b);
  const wall = pick(L.walls, rnd);
  let top = h;
  if (look === 'village') {
    // A round hut of wattle under a tall palm-thatch cone.
    const r = 4.4;
    add(b, cyl(r, r, h, 9), wall, 0, h / 2, 0, 0.05);
    add(b, new THREE.ConeGeometry(r + 1.7, 6.2, 10), pick(L.roofs, rnd), 0, h + 2.8, 0, 0.05).rotation.y = rnd(0, 1);
    add(b, new THREE.ConeGeometry(1.1, 2, 5), '#8a6a3a', 0, h + 6.4, 0);
    add(b, box(1.8, 3, 0.6), L.trim, 0, 1.5, r - 0.1);
    top = h + 7;
  } else if (look === 'shanty') {
    // On stilts, the deck a little above the ground, with a lean-to roof of old sailcloth.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(b, cyl(0.45, 0.45, 7, 4, true), L.foot, sx * (w / 2 - 0.5), 0.5, sz * (d / 2 - 0.5));
    add(b, box(w + 1.2, 0.8, d + 2.2), '#7a5d40', 0, 3.6, 0.6, 0.03);
    add(b, box(w, h, d), wall, 0, 4 + h / 2, 0, 0.04);
    const roof = add(b, box(w + 1.6, 0.7, d + 2.2), rnd() < 0.2 ? L.accent : pick(L.roofs, rnd), 0, 4 + h + 0.6, 0, 0.03);
    roof.rotation.x = 0.2;
    add(b, box(1.8, 3, 0.4), L.trim, rnd(-1.5, 1.5), 5.5, d / 2 + 0.05);
    add(b, box(1.4, 1.2, 0.4), L.glass, w * 0.28, 4 + h * 0.6, d / 2 + 0.05);
    top = 5 + h;
  } else {
    footing(b, w, d, L.foot);
    add(b, box(w, h, d), wall, 0, h / 2, 0, 0.035);
    if (look === 'english') {
      const rh = d * 0.62;
      add(b, gable(w, d, rh, 0.8), rnd() < 0.15 ? L.accent : pick(L.roofs, rnd), 0, h, 0, 0.03);
      // Timber framing on the pale ones: dark beams at sill and eaves.
      if (wall !== L.walls[2]) for (const yy of [0.35, h - 0.35]) add(b, box(w + 0.1, 0.45, d + 0.1), L.trim, 0, yy, 0);
      const cx = (rnd() < 0.5 ? -1 : 1) * (w / 2 - 1.2);
      add(b, box(1.5, 4.6, 1.5), '#8a5a44', cx, h + rh * 0.55, -0.6);
      ctx.chimney(b, cx, h + rh * 0.55 + 2.6, -0.6);
      top = h + rh;
    } else if (look === 'city' && rnd() < 0.4) {
      // A flat roof behind a parapet (an azotea).
      add(b, box(w + 0.5, 1.1, d + 0.5), wall, 0, h + 0.5, 0, 0.03);
      add(b, box(w - 0.6, 0.3, d - 0.6), '#cbbd9f', 0, h + 0.95, 0);
      top = h + 1.1;
    } else if (rnd() < 0.5) {
      // A tiled gable along the street: from above, a clean ridge between a sunlit slope and a shaded one.
      const rh = d * 0.42;
      add(b, gable(w, d, rh, 0.7), pick(L.roofs, rnd), 0, h, 0, 0.03);
      top = h + rh;
    } else {
      const rh = Math.min(w, d) * 0.5;
      add(b, hip(w, d, rh), pick(L.roofs, rnd), 0, h, 0, 0.03);
      top = h + rh;
      if (rnd() < 0.35) { const cx = rnd(-w / 4, w / 4); add(b, box(1.2, 3, 1.2), L.walls[0], cx, h + rh * 0.6, -d * 0.2); ctx.chimney(b, cx, h + rh * 0.6 + 1.6, -d * 0.2); }
    }
    // The front: a door, windows (shuttered in Spanish towns), a balcony on the tall city houses.
    const dx = rnd(-0.2, 0.2) * w;
    add(b, box(1.8, 3.1, 0.4), '#4a3020', dx, 1.55, d / 2);
    const floors = h > 8 ? 2 : 1;
    for (let f = 0; f < floors; f++) {
      const wy = floors > 1 ? h * (f ? 0.74 : 0.36) : h * 0.6;
      for (const s of [-1, 1]) if (!(f === 0 && Math.abs(s * w * 0.3 - dx) < 1.8)) add(b, box(1.3, 1.5, 0.4), L.glass, s * w * 0.3, wy, d / 2);
    }
    if (look === 'city' && floors > 1) add(b, box(w * 0.55, 0.35, 1.2), L.trim, 0, h * 0.58, d / 2 + 0.5);
  }
  ctx.house(b, 0, top * 0.8, 0);
  ctx.shadow(b, 0, 0, Math.max(w, d) * 0.62, top, 0.3);
  return b;
}

// The focal building a town gathers round, its front to local +x: a Spanish chapel with a bell tower, an
// English church with a slate spire, a pirate tavern with its lantern and flag.
function focal(g, look, x, z, rnd, ctx, o) {
  const y = ctx.ground(g, x, z), b = new THREE.Group();
  b.position.set(x, y, z);
  g.add(b);
  if (look === 'shanty') {
    house(b, 'shanty', 0, 0, PI / 2, rnd, ctx, { w: 12, d: 9, h: 8.5 });
    ctx.lamp(b, 5.6, 9.5, 0);
    pole(b, 3.5, 6.5, 16, ctx, 'pirate');
    return;
  }
  if (look === 'english') {
    footing(b, 12, 7, '#a39783');
    add(b, box(12, 7, 7), '#d8cfba', 0, 3.5, 0, 0.035);
    add(b, gable(12, 7, 4.6, 0.6), '#5c5e69', 0, 7, 0, 0.03);
    add(b, box(5, 13, 5), '#cfc5ae', -6.5, 6.5, 0, 0.04);
    add(b, hip(3.4, 3.4, 10), '#4f4c58', -6.5, 13, 0, 0.04);
    add(b, box(0.4, 3.2, 2), '#4a3020', 6.05, 1.6, 0);
    for (const zz of [-2.2, 2.2]) add(b, box(1.2, 2.4, 0.4), '#3b4a5a', 0, 4.4, zz * 1.6);
    ctx.shadow(b, -2, 0, 9, 16, 0.32);
    return;
  }
  // A mission chapel: whitewashed nave, curved gable front, a bell tower with arched openings and a cross.
  const white = look === 'city' ? '#f0dfb4' : '#f7f2e8', roof = '#c4613a';
  footing(b, 12, 7.5, '#c9b48c');
  add(b, box(12, 8, 7.5), white, -1, 4, 0, 0.035);
  add(b, hip(12, 7.5, 2.6), roof, -1, 8, 0, 0.03);
  const front = new THREE.Shape();
  front.moveTo(-4.2, 0); front.lineTo(4.2, 0); front.lineTo(4.2, 9); front.quadraticCurveTo(3, 12.4, 0, 13); front.quadraticCurveTo(-3, 12.4, -4.2, 9); front.lineTo(-4.2, 0);
  add(b, new THREE.ExtrudeGeometry(front, { depth: 1.1, bevelEnabled: false }).rotateY(PI / 2), white, 5, 0, 0, 0.04);
  add(b, box(0.5, 3.8, 2.4), '#4a3020', 6.15, 1.9, 0);
  add(b, box(0.5, 1.6, 1.6), '#2f5e7a', 6.15, 7.4, 0);
  add(b, box(0.5, 3.2, 0.5), '#5a3d26', 5.6, 14.4, 0);
  add(b, box(0.5, 0.5, 2), '#5a3d26', 5.6, 15.1, 0);
  // The tower: tall enough to read from a distance.
  const tz = -3.6;
  add(b, box(4.6, 21, 4.6), white, -5.2, 10.5, tz, 0.04);
  for (const [dx, dz] of [[2.35, 0], [0, 2.35], [-2.35, 0], [0, -2.35]]) add(b, box(dx ? 0.3 : 1.8, 3, dz ? 0.3 : 1.8), '#3a2c22', -5.2 + dx, 18.2, tz + dz);
  add(b, hip(4.6, 4.6, 3.8), roof, -5.2, 21, tz, 0.04);
  add(b, blob(), '#d9a53a', -5.2, 17.8, tz).scale.setScalar(1);
  ctx.shadow(b, -2, -1, 9, 18, 0.32);
  void o;
}

// Barrels and a crate or two, stacked by a door or at the end of a quay.
function goods(g, x, z, rnd, ctx) {
  const y = ctx.ground(g, x, z);
  for (let i = 0; i < 3; i++) {
    const a = rnd(0, TAU), r = i ? 1.9 : 0;
    if (i === 2) add(g, box(2, 1.8, 2), '#b08250', x + Math.cos(a) * 2.2, y + 0.9, z + Math.sin(a) * 2.2, 0.06).rotation.y = rnd(0, 1);
    else add(g, cyl(0.9, 0.9, 2.1, 7), '#7a4f2c', x + Math.cos(a) * r, y + 1.05, z + Math.sin(a) * r, 0.07);
  }
}

// Where a street town's houses go, in its own frame (+x out to sea): the street runs along local z, following
// the island's curve on an island (o.bend: the town's distance from the island's centre, set by land.js) and
// straight on a coast, reaching a little past the sim's extent along the shore (never out toward the sea).
// at(off, along) -> [x, z, yaw]: a spot `off` map units seaward of the street, `along` it; yaw turns the
// street's direction (local z, at yaw 0) to its direction there.
// A bigger town (and any city) has a back lane with a third row of houses behind the landward one, if there's
// room inland; a city fills out its rows with more houses than its sim count.
export function townLayout(o) {
  const ext = 6 + 4.5 * Math.sqrt(o.houses), bend = o.bend || 0;
  const half = bend ? Math.min(ext * 1.3, bend * 0.9) : ext * 1.3;
  const at = (off, along) => {
    if (!bend) return [off, along, 0];
    const a = along / bend, R = bend + off;
    return [-bend + Math.cos(a) * R, Math.sin(a) * R, -a];
  };
  const back = o.look !== 'village' && o.look !== 'shanty' && (o.houses >= 6 || o.look === 'city') && (!bend || bend >= 48);
  const count = o.houses + Math.round(o.houses * (o.look === 'city' ? 0.7 : back ? 0.35 : 0));
  return { half, ext, at, back, count };
}

// ---------- Landmarks ----------
export const BUILD = {
  town(g, o, ctx) {
    const { rnd } = ctx, look = o.look, n = o.houses;
    if (o.ring) {
      // Strung round a fort: one row of houses along an arc of the island, backs to the fort, ridges along the arc.
      const r0 = o.ringR, span = Math.min(PI * 0.9, (n * 11) / r0);
      for (let i = 0; i < n; i++) {
        const a = (i / Math.max(1, n - 1) - 0.5) * span, x = Math.cos(a) * r0 - r0, z = Math.sin(a) * r0;
        const p = plan(look, rnd);
        p.d = Math.min(p.d, 7);
        house(g, look, x, z, PI / 2 - a, rnd, ctx, p);
      }
      pole(g, -r0 + Math.cos(span / 2 + 0.22) * r0, Math.sin(span / 2 + 0.22) * r0, 13, ctx, flagFor(o, ctx.st));
      ctx.people(g, [[0, -r0 * Math.sin(span * 0.3)], [0, r0 * Math.sin(span * 0.3)]], 2);
      return;
    }
    const ext = 6 + 4.5 * Math.sqrt(n);
    if (look === 'village') {
      // A fishing village: round huts in an arc open to the sea, a net drying in the middle, canoes on the sand.
      const rr = ext * 0.62;
      for (let i = 0; i < n; i++) {
        const a = PI + (n > 1 ? (i / (n - 1) - 0.5) * PI * 1.2 : 0), x = Math.cos(a) * rr, z = Math.sin(a) * rr;
        house(g, 'village', x, z, 0, rnd, ctx, plan('village', rnd));
      }
      const y = ctx.ground(g, 1, 0);
      for (const s of [-1, 1]) add(g, cyl(0.3, 0.3, 6, 4), '#6b4a2a', 1, y + 3, s * 4);
      add(g, box(0.2, 3.4, 8), '#7b6a55', 1, y + 4, 0);
      for (let i = 0; i < 2; i++) canoe(g, ext * 0.7, (i - 0.5) * 7, rnd, ctx);
      ctx.flat(g, [[-rr * 0.3, 0]], 6.5, '#b49a6c', 0.4);
      ctx.people(g, [[-3, -4], [ext * 0.55, 3]], 2);
      return;
    }
    // A street along the shore, a row of houses either side with their ridges along it, following the island's
    // curve; the focal building faces the sea across a little square left open in the front row.
    const L = townLayout(o), half = L.half;
    const hasFocal = n >= 5;
    // Rows: off = where the fronts are (seaward of the street); dir = which way they face (+1 out to sea).
    const rows = [{ off: 4, dir: -1, used: hasFocal ? [[-5.5, 5.5]] : [] }, { off: -4, dir: 1, used: hasFocal ? [[-5.4, 5.4]] : [] }];
    if (L.back) rows.push({ off: -19.5, dir: 1, used: [], end: 0.82 });
    let left = (hasFocal ? L.count - 1 : L.count), k = 0, stuck = 0;
    const tryPut = (row, sgn) => {
      const p = plan(look, rnd), gap = rnd(0.5, 1.3);
      const edgeZ = row.used.length ? (sgn > 0 ? Math.max(...row.used.map((u) => u[1])) : Math.min(...row.used.map((u) => u[0]))) : -sgn * (p.w / 2 + gap / 2);
      const z0 = edgeZ + sgn * gap, zc = z0 + sgn * p.w / 2;
      if (Math.abs(zc) + p.w / 2 > half * (row.end || 1)) return false;
      row.used.push(sgn > 0 ? [z0, z0 + p.w] : [z0 - p.w, z0]);
      // The fronts line the street (a deeper house stands further back).
      const [x, z, yaw] = L.at(row.off - row.dir * (p.d / 2 + rnd(-0.25, 0.25)), zc);
      house(g, look, x, z, yaw + (row.dir < 0 ? -PI / 2 : PI / 2) + rnd(-0.03, 0.03), rnd, ctx, p);
      return true;
    };
    while (left > 0 && stuck < rows.length * 4) {
      const row = rows[k % rows.length], sgn = Math.floor(k / rows.length) % 2 ? -1 : 1;
      k++;
      if (tryPut(row, sgn)) { left--; stuck = 0; } else stuck++;
    }
    if (L.back) { const pts = []; for (let i = 0; i <= 8; i++) { const [x, z] = L.at(-17.5, -half * 0.8 + (1.6 * half * i) / 8); pts.push([x, z]); } ctx.flat(g, pts, 3.2, '#b49a6c', 0.35); }
    if (hasFocal) {
      const [x, z] = L.at(-10.5, 0);
      focal(g, look, x, z, rnd, ctx, o);
      // The square: a fountain (a well in an English town) under a pair of palms or a shade tree.
      const [fx, fz] = L.at(1, 0), fy = ctx.ground(g, fx, fz), stone = look === 'english' ? '#b9b2a2' : '#d8ccae';
      add(g, cyl(2.1, 2.3, 1, 10), stone, fx, fy + 0.5, fz, 0.06);
      add(g, cyl(0.45, 0.6, look === 'english' ? 3.4 : 2.4, 6), stone, fx, fy + 1.4, fz);
      for (const sd of [-1, 1]) {
        const [px, pz] = L.at(2.2, sd * 4.3), py = ctx.ground(g, px, pz);
        if (look === 'english') { if (sd > 0) broadleaf(g, px, py, pz, 0.72, rnd, ctx.st.F); } else palm(g, px, py, pz, 0.78, rnd, ctx.st.F, ctx);
      }
    }
    // Gardens: a tree at the end of a row now and then, so the town settles into the land round it.
    for (const row of rows) for (const sgn of [-1, 1]) {
      if (!row.used.length || rnd() < 0.4) continue;
      const zEnd = sgn > 0 ? Math.max(...row.used.map((u) => u[1])) + 4.6 : Math.min(...row.used.map((u) => u[0])) - 4.6;
      if (Math.abs(zEnd) > half * 1.12) continue;
      const [x, z] = L.at(row.off - row.dir * 4, zEnd);
      broadleaf(g, x, ctx.ground(g, x, z), z, 0.7, rnd, ctx.st.F);
    }
    // The street and the square, packed earth.
    const pts = [];
    for (let i = 0; i <= 10; i++) { const [x, z] = L.at(0, -half + (2 * half * i) / 10); pts.push([x, z]); }
    ctx.flat(g, pts, 4.6, '#b49a6c', 0.5);
    if (hasFocal) ctx.flat(g, [L.at(1.5, 0)], 6, '#b49a6c', 0.45);
    if (look !== 'shanty') { const [x, z] = hasFocal ? L.at(4.5, 0) : L.at(1.2, half * 0.55); pole(g, x, z, 14, ctx, flagFor(o, ctx.st)); }
    { const [x, z] = L.at(1.5, half * 0.86); goods(g, x, z, rnd, ctx); }
    ctx.people(g, [L.at(0, -half * 0.7), L.at(0, half * 0.7)], look === 'city' ? 3 : 2);
  },
  harbour(g, o, ctx) {
    // A wharf from the beach out over the shallows, with crates, barrels and boats alongside.
    const len = 22, x0 = -10, y = 2.4, wood = '#8a5f38', dark = '#5e4029';
    const deck = add(g, box(len, 1, 6.5), wood, x0 + len / 2, y, 0, 0.04);
    deck.userData.noGround = true;
    for (let x = x0 + 3; x <= x0 + len; x += 5) for (const s of [-1, 1]) add(g, cyl(0.55, 0.55, 7, 5, true), dark, x, y - 3.6, s * 3);
    for (const [cx, cz] of [[x0 + 4, 1.6], [x0 + 5.5, -1.4], [x0 + 12, 1.8]]) add(g, box(2.2, 2, 2.2), '#b08250', cx, y + 1.5, cz, 0.06);
    for (const [cx, cz] of [[x0 + 7, -1.8], [x0 + 15, -1.9]]) add(g, cyl(1, 1, 2.4, 7), '#7a4f2c', cx, y + 1.7, cz, 0.06);
    for (const s of [-1, 1]) add(g, cyl(0.5, 0.6, 1.2, 6), '#3a2a1c', x0 + len - 1.5, y + 1.1, s * 2.6);
    // Moored alongside: a little sloop on one side, a rowing boat on the other.
    const hull = (L, B, H, color) => {
      const geo = liftedExtrude(hullShape(L, B), H, 0.6, 0.55);
      const m = new THREE.Mesh(geo, toon(color));
      withOutline(m, 0.06);
      return m;
    };
    const boat = new THREE.Group();
    boat.position.set(x0 + len - 7, 0, 7.5);
    g.add(boat);
    const h1 = hull(17, 6.5, 3, '#a5672f'); h1.position.y = -0.6; boat.add(h1);
    add(boat, cyl(0.35, 0.4, 15, 5), '#6b4a2a', 1, 9, 0);
    add(boat, cyl(0.7, 0.7, 8, 6), '#efe6cf', -2.5, 4.4, 0).rotation.z = PI / 2 - 0.08;
    const row = new THREE.Group();
    row.position.set(x0 + len - 6, 0, -6.5);
    row.rotation.y = 0.3;
    g.add(row);
    const h2 = hull(8, 3.4, 1.6, '#c28145'); h2.position.y = -0.3; row.add(h2);
    ctx.people(g, [[x0 + 2, 0], [x0 + len - 2, 0]], 2, y + 0.5);
    ctx.gulls(g, x0 + len, 0, 0, 2, 16, 26);
  },
  // The landmarks stand a little larger than life, so each reads as a silhouette at the comfort zoom.
  lighthouse(g, o, ctx) {
    const y = 0;
    g.scale.setScalar(1.4);
    ctx.shadow(g, 0, 0, 6.5, 30, 0.32);
    add(g, cyl(6, 6.8, 3, 8), '#b9b2a2', 0, y + 1.2, 0, 0.05);
    add(g, cyl(3.1, 4.3, 24, 10), '#f4f0e6', 0, y + 14, 0, 0.05);
    for (const by of [8, 17]) add(g, cyl(3.92 - (by - 2) * 0.05, 4.05 - (by - 2) * 0.05, 3.4, 10), '#c8302a', 0, y + by, 0);
    add(g, cyl(4.2, 4.2, 1, 10), '#3a3430', 0, y + 26.4, 0);
    add(g, cyl(2.3, 2.3, 3.4, 8), '#fff1b0', 0, y + 28.6, 0);
    add(g, new THREE.ConeGeometry(3, 3.2, 8), '#c8302a', 0, y + 31.9, 0, 0.06);
    add(g, box(0.4, 3, 1.6), '#4a3020', 4.1, y + 4, 0);
    ctx.lamp(g, 0, y + 28.6, 0);
    ctx.gulls(g, 0, y + 30, 0, o.sight > 0 ? 2 : 3, 22, 18);
  },
  windmill(g, o, ctx) {
    g.scale.setScalar(1.3);
    ctx.shadow(g, 0, 0, 6, 18, 0.3);
    add(g, cyl(3.6, 5, 16, 8), '#e2d6bb', 0, 8, 0, 0.05);
    add(g, new THREE.ConeGeometry(4.4, 5, 8), '#7a4a2e', 0, 18.4, 0, 0.06);
    add(g, box(0.4, 3.2, 1.8), '#4a3020', 4.9, 1.6, 0);
    add(g, box(0.4, 1.4, 1.2), '#3b4a5a', 4.1, 9, 0);
    const hub = new THREE.Group();
    hub.position.set(4.6, 15.5, 0);
    g.add(hub);
    add(hub, cyl(0.8, 0.8, 1.6, 6), '#5a3d26', 0, 0, 0).rotation.z = PI / 2;
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      arm.rotation.x = (i / 4) * TAU + 0.4;
      hub.add(arm);
      add(arm, box(0.4, 14, 0.5), '#5a3d26', 0.5, 7, 0);
      add(arm, box(0.15, 10, 3), '#efe6cf', 0.7, 8.5, 1.6, 0.05);
    }
    ctx.spin(hub);
  },
  church(g, o, ctx) {
    const spanish = ctx.st.id !== 'port' && o.look !== 'english';
    g.scale.setScalar(1.2);
    ctx.shadow(g, 0, 0, 10, 20, 0.32);
    if (!spanish) {
      footing(g, 15, 8, '#a39783');
      add(g, box(15, 8, 8), '#cfc6b3', -1, 4, 0, 0.035);
      add(g, gable(15, 8, 5.5, 0.6), '#5d5a63', -1, 8, 0, 0.03);
      add(g, box(6, 17, 6), '#c4bba6', 7.5, 8.5, 0, 0.04);
      add(g, hip(4.6, 4.6, 13), '#4f4c55', 7.5, 17, 0, 0.04);
      add(g, box(0.4, 3.4, 2), '#4a3020', 10.6, 1.7, 0);
      for (const z of [-2.5, 2.5]) add(g, box(0.4, 2.6, 1), '#3b4a5a', -1, 5, z * 1.6).rotation.y = PI / 2;
      return;
    }
    // A mission: whitewashed nave, a bell tower with arched openings and a terracotta cap, a cross.
    footing(g, 16, 8.5, '#c9b48c');
    add(g, box(16, 9, 8.5), '#f6f1e6', -1.5, 4.5, 0, 0.035);
    add(g, hip(16, 8.5, 3), '#c8643c', -1.5, 9, 0, 0.03);
    const front = new THREE.Shape();
    front.moveTo(-4.8, 0); front.lineTo(4.8, 0); front.lineTo(4.8, 10); front.quadraticCurveTo(3.4, 13.8, 0, 14.4); front.quadraticCurveTo(-3.4, 13.8, -4.8, 10); front.lineTo(-4.8, 0);
    const fg = new THREE.ExtrudeGeometry(front, { depth: 1.2, bevelEnabled: false }).rotateY(PI / 2);
    add(g, fg, '#f2ead8', 6.8, 0, 0, 0.04);
    add(g, box(0.5, 4, 2.6), '#4a3020', 8.1, 2, 0);
    add(g, box(5, 22, 5), '#f6f1e6', -7, 11, 4, 0.04);
    for (const [dx, dz] of [[2.55, 0], [0, 2.55], [-2.55, 0], [0, -2.55]]) add(g, box(dx ? 0.3 : 2, 3.2, dz ? 0.3 : 2), '#3a2c22', -7 + dx, 18.4, 4 + dz);
    add(g, hip(5, 5, 4), '#c8643c', -7, 22, 4, 0.04);
    add(g, blob(), '#d9a53a', -7, 18, 4).scale.setScalar(1.1);
    add(g, box(0.5, 3.4, 0.5), '#5a3d26', 6.8, 16, 0);
    add(g, box(0.5, 0.5, 2.2), '#5a3d26', 6.8, 16.8, 0);
  },
  ruin(g, o, ctx) {
    const { rnd } = ctx, stone = '#b4ad97', moss = '#7f9a5a';
    g.scale.setScalar(1.15);
    ctx.shadow(g, 0, 0, 13, 12, 0.28);
    footing(g, 22, 22, '#9e977f');
    add(g, box(22, 3, 22), stone, 0, 1.5, 0, 0.03);
    add(g, box(16, 3, 16), moss, 0, 4.5, 0, 0.03);
    add(g, box(10, 3, 10), stone, 0, 7.5, 0, 0.04);
    add(g, box(5, 3.2, 1.8), '#8f8873', 3.5, 10.6, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3, h = rnd(2.5, 9);
      add(g, cyl(1.2, 1.3, h, 7), '#cbc4ad', Math.cos(a) * 9.4, 6 + h / 2, Math.sin(a) * 9.4, 0.08);
    }
    // Fallen drums and blocks, and vines over the steps.
    for (let i = 0; i < 3; i++) {
      const a = rnd(0, TAU), d = rnd(12, 15), x = Math.cos(a) * d, z = Math.sin(a) * d;
      add(g, cyl(1.2, 1.2, rnd(4, 7), 7), '#cbc4ad', x, ctx.ground(g, x, z) + 1.2, z).rotation.set(PI / 2, 0, rnd(0, TAU));
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + PI / 4;
      bush(g, Math.cos(a) * 10.5, 1.5, Math.sin(a) * 10.5, 0.85, rnd, ctx.st.F, ['#4a8f3d', '#3f8238']);
    }
    // The golden idol on top: it catches the light now and then (land.js adds the glint).
    add(g, cyl(0.9, 1.3, 2.6, 6), '#e2b13a', 0, 10.3, 0, 0.1);
    add(g, blob(), '#f2c94a', 0, 12.3, 0).scale.setScalar(1.2);
    ctx.glint(g, 0, 13, 0);
  },
  castle(g, o, ctx) {
    // A bastioned trace: the walls angle out into arrow-head bastions toward the sea.
    const stone = '#d8c08a', top = '#c2a86f';
    g.scale.setScalar(1.12);
    ctx.shadow(g, 0, 0, 15, 14, 0.3);
    const sh = new THREE.Shape(), pts = [[12, 0], [6, 7], [8, 13], [-2, 11], [-10, 14], [-12, 4], [-12, -4], [-10, -14], [-2, -11], [8, -13], [6, -7]];
    pts.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z)));
    footing(g, 22, 22, '#b9a070');
    const wall = new THREE.Mesh(liftedExtrude(sh, 9, 0.8, 0), toon(stone));
    withOutline(wall, 0.025);
    g.add(wall);
    const inner = new THREE.Shape();
    pts.forEach(([x, z], i) => (i ? inner.lineTo(x * 0.78, -z * 0.78) : inner.moveTo(x * 0.78, -z * 0.78)));
    const yard = new THREE.Mesh(liftedExtrude(inner, 1, 0.3, 0), toon(top));
    yard.position.y = 9.2;
    g.add(yard);
    for (const [x, z] of [[12, 0], [8, 13], [8, -13], [-10, 14], [-10, -14]]) add(g, box(2, 2, 2), stone, x * 0.96, 10.6, z * 0.96);
    for (const z of [-4, 0, 4]) add(g, cyl(0.6, 0.75, 4, 6), '#2a2522', 10.5, 7.4, z).rotation.z = PI / 2;
    add(g, cyl(3.6, 4.2, 14, 10), stone, -5, 16, 0, 0.05);
    add(g, cyl(4.3, 4.3, 1.2, 10), top, -5, 23.4, 0);
    add(g, cyl(2, 2, 2.6, 8), '#fff1b0', -5, 25.3, 0);
    add(g, new THREE.ConeGeometry(2.6, 2.6, 8), '#7a4a2e', -5, 27.9, 0, 0.06);
    ctx.lamp(g, -5, 25.3, 0);
    pole(g, 2, -4, 9, { ...ctx, ground: () => 10 }, 'spanish');
    ctx.people(g, [[-8, 6], [6, 6]], 2, 10.3);
  },
  skull(g, o, ctx) {
    const bone = '#e6e0d2';
    add(g, blob(), '#8c837a', 0, 1.5, 0, 0.06).scale.set(10, 4, 10);
    // Turned to the camera and tipped back a little, so its hollow eyes look up at you.
    const tip = new THREE.Group();
    tip.rotation.z = 0.45;
    tip.position.y = 2;
    g.add(tip);
    g = tip;
    const head = add(g, new THREE.SphereGeometry(1, 12, 9), bone, 0, 10, 0, 0.035);
    head.scale.set(8.5, 8, 9);
    const jaw = add(g, box(9, 5, 9), '#d8d0bf', 2.5, 4.4, 0, 0.04);
    jaw.rotation.z = -0.12;
    for (const z of [-3.2, 3.2]) { const e = add(g, new THREE.SphereGeometry(1, 8, 6), '#1e1a18', 6.6, 10.6, z); e.scale.set(1.4, 2.5, 2.2); }
    add(g, new THREE.ConeGeometry(1.1, 2.4, 4), '#1e1a18', 7.9, 7.6, 0).rotation.z = PI;
    for (let i = 0; i < 5; i++) add(g, box(1.2, 1.6, 1.1), '#f4efe4', 7.1, 5.6, (i - 2) * 1.5);
  },
  wreck(g, o, ctx) {
    const { rnd } = ctx, wet = o.host == null;
    // On a beach she lies along the shore, smaller; on a reef she lies where she struck.
    g.scale.setScalar(wet ? 0.85 : 0.62);
    const hullG = new THREE.Group();
    hullG.rotation.set(rnd(0.35, 0.55), wet ? rnd(0, TAU) : PI / 2 + rnd(-0.3, 0.3), wet ? 0.12 : 0.05, 'YXZ');
    hullG.position.y = wet ? -3.2 : -1.8;
    g.add(hullG);
    const sh = hullShape(40, 13);
    const hull = new THREE.Mesh(liftedExtrude(sh, 6, 0.6, 0.55), toon('#6b4a2e'));
    withOutline(hull, 0.03);
    hull.position.x = -5;
    hullG.add(hull);
    // Ribs where her stern has broken away, a stump of mast and a fallen one.
    for (let i = 0; i < 5; i++) {
      const rib = add(hullG, new THREE.TorusGeometry(5.6, 0.45, 4, 8, PI), '#5a3d26', 15 + i * 2.6, 3.2, 0);
      rib.rotation.set(0, PI / 2, PI);
    }
    add(hullG, cyl(0.9, 1.1, 9, 6), '#5a3d26', -3, 9.5, 0);
    const mast = add(g, cyl(0.7, 0.9, 22, 6), '#6b4a2e', rnd(-6, 6), wet ? 1.2 : ctx.ground(g, 6, 10) + 1, 10);
    mast.rotation.set(PI / 2, 0, rnd(-0.6, 0.6));
    ctx.gulls(g, 0, 8, 0, 2, 14, 22);
  },
  stacks(g, o, ctx) {
    const { rnd, st } = ctx, n = o.count;
    for (let i = 0; i < n; i++) {
      const lat = (i - (n - 1) / 2) * 13 + rnd(-3, 3), x = rnd(-5, 1) - Math.abs(lat) * 0.18, z = lat;
      const h = rnd(18, 34), r = rnd(3.4, 5.6);
      const y = Math.max(-1, ctx.ground(g, x, z) - 1);
      const p = add(g, cyl(r * 0.78, r, h, 7), st.rock, x, y + h / 2, z, 0.05);
      p.rotation.y = rnd(0, TAU);
      add(g, blob(), st.grass[1], x, y + h + 0.8, z).scale.set(r * 0.95, 1.8, r * 0.95);
      if (rnd() < 0.5) ctx.gulls(g, x, y + h, z, 1, 9, 14);
    }
  },
  mangroves(g, o, ctx) {
    // Built along the shore by land.js (it knows the outline); nothing at the spot itself.
  },
  peak() {}, // part of the terrain itself (land.js)
  volcano() {}, // the terrain plus a plume (land.js)
};

function canoe(g, x, z, rnd, ctx) {
  const c = add(g, new THREE.CapsuleGeometry(1.2, 7, 2, 6), '#7a4f2c', x, ctx.ground(g, x, z) + 0.8, z, 0.08);
  c.rotation.set(0, rnd(0, PI), PI / 2);
  c.scale.set(1, 1, 0.6);
}

// Buoys round an anchorage, in world space.
export function buoys(root, x, z, r, n) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const b = new THREE.Group();
    b.position.set(x + Math.cos(a) * r, 0, z + Math.sin(a) * r);
    root.add(b);
    b.scale.setScalar(1.7);
    add(b, cyl(1.1, 1.4, 2.2, 6), i % 2 ? '#f4efe4' : '#c8302a', 0, 0.8, 0, 0.12);
    add(b, new THREE.ConeGeometry(0.9, 1.6, 6), '#c8302a', 0, 2.6, 0);
  }
}
