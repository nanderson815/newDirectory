import * as THREE from 'three';
import { TAU, PI, clamp, lerp } from '../util.js';
import { toon, withOutline, R } from './gl.js';
import { hullShape, liftedExtrude } from './shapes.js';
import { RING } from '../sim/land.js';

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
let blobGeo = null, leafGeo = null, coneGeo = null;
export const sharedGeos = () => [blobGeo, leafGeo, coneGeo].filter(Boolean);
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

// ---------- Plants ----------
// Each takes the parent group and a local spot on the ground (x, y, z); s scales it.
export function palm(parent, x, y, z, s, rnd, ctx) {
  // A frond is a stretched octahedron: a diamond with a ridge, eight faces.
  leafGeo = leafGeo || new THREE.OctahedronGeometry(1, 0);
  const g = new THREE.Group();
  g.position.set(x, y - 0.5, z);
  g.rotation.y = rnd(0, TAU);
  s *= 0.8;
  const h = 23 * s;
  const tilt = new THREE.Group();
  tilt.rotation.z = rnd(0.06, 0.3);
  g.add(tilt);
  const trunk = add(tilt, cyl(1.1 * s, 1.9 * s, h, 5, true), '#9a6a3a', 0, h / 2, 0, 0.22);
  for (let i = 0; i < 6; i++) {
    const arm = new THREE.Group();
    arm.rotation.y = (i / 6) * TAU + rnd(-0.2, 0.2);
    arm.position.y = h;
    const leaf = add(arm, leafGeo, i % 2 ? '#5cbf4c' : '#49a83d', 7.4 * s, -1.8, 0, 0.1);
    leaf.scale.set(8.5 * s, 1.1, 2.8 * s);
    leaf.rotation.z = -0.38;
    tilt.add(arm);
  }
  add(tilt, blob(), '#6b4220', 0, h - 1.4, 0).scale.setScalar(1.7 * s);
  parent.add(g);
  ctx.sway(g, rnd(0, 0.999));
  return g;
}
export function broadleaf(parent, x, y, z, s, rnd, colors, ink = true) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  add(g, cyl(0.9 * s, 1.4 * s, 7 * s, 5, true), '#7a5232', 0, 3.2 * s, 0);
  const n = rnd() < 0.5 ? 2 : 3;
  for (let i = 0; i < n; i++) {
    const k = s * rnd(0.75, 1.05), a = rnd(0, TAU), d = i ? 4.5 * s : 0;
    const b = add(g, blob(), colors[Math.floor(rnd(0, colors.length))], Math.cos(a) * d, (i ? 9.5 : 11.5) * s, Math.sin(a) * d, i || !ink ? 0 : 0.07);
    b.scale.set(8 * k, 6.6 * k, 8 * k);
    b.rotation.set(rnd(0, TAU), rnd(0, TAU), 0);
  }
  parent.add(g);
  return g;
}
export function pine(parent, x, y, z, s, rnd, colors) {
  coneGeo = coneGeo || new THREE.ConeGeometry(1, 1, 6, 1);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  add(g, cyl(0.7 * s, 1 * s, 6 * s, 5, true), '#6e4a2c', 0, 3 * s, 0);
  const c = colors[Math.floor(rnd(0, colors.length))];
  for (let i = 0; i < 3; i++) {
    const m = add(g, coneGeo, c, 0, (6 + i * 4.6) * s, 0, i === 0 ? 0.08 : 0);
    m.scale.set((6.4 - i * 1.7) * s, 8 * s, (6.4 - i * 1.7) * s);
  }
  parent.add(g);
  return g;
}
export function cactus(parent, x, y, z, s, rnd) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rnd(0, TAU);
  const c = '#5f9a63';
  add(g, cyl(1.5 * s, 1.7 * s, 11 * s, 6), c, 0, 5.5 * s, 0, 0.1);
  for (const sd of [-1, 1]) {
    if (rnd() < 0.25) continue;
    const hy = rnd(4, 7) * s;
    add(g, cyl(0.9 * s, 0.9 * s, 3 * s, 6), c, sd * 2.4 * s, hy, 0).rotation.z = PI / 2;
    add(g, cyl(0.9 * s, 0.9 * s, 5 * s, 6), c, sd * 3.6 * s, hy + 2.2 * s, 0);
  }
  parent.add(g);
  return g;
}
export function agave(parent, x, y, z, s, rnd) {
  coneGeo = coneGeo || new THREE.ConeGeometry(1, 1, 6, 1);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  for (let i = 0; i < 5; i++) {
    const m = add(g, coneGeo, i % 2 ? '#7fae84' : '#6c9c72', 0, 2.2 * s, 0);
    m.scale.set(0.9 * s, 6 * s, 0.9 * s);
    m.rotation.set(0.7, (i / 5) * TAU, 0, 'YXZ');
  }
  parent.add(g);
  return g;
}
// A grove canopy seen from above: one blob, no trunk (it's hidden under its neighbours anyway).
export function canopy(parent, x, y, z, s, rnd, colors, ink) {
  const b = add(parent, blob(), colors[Math.floor(rnd(0, colors.length))], x, y + 8 * s, z, ink ? 0.06 : 0);
  b.scale.set(9 * s, 6.5 * s, 9 * s);
  b.rotation.set(rnd(0, TAU), rnd(0, TAU), 0);
  return b;
}
export function bush(parent, x, y, z, s, rnd, colors) {
  const b = add(parent, blob(), colors[Math.floor(rnd(0, colors.length))], x, y + 2.2 * s, z, 0.08);
  b.scale.set(5 * s, 3.8 * s, 5 * s);
  b.rotation.y = rnd(0, TAU);
  return b;
}
// A mangrove: a dark round crown on a cage of arching stilt roots that reach down into the water.
export function mangrove(parent, x, y, z, s, rnd) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const crown = add(g, blob(), rnd() < 0.5 ? '#3c7d3b' : '#326f36', 0, 8.5 * s, 0, 0.07);
  crown.scale.set(7.5 * s, 4.2 * s, 7.5 * s);
  crown.rotation.y = rnd(0, TAU);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + rnd(-0.3, 0.3), out = 4.2 * s;
    const root = add(g, cyl(0.35 * s, 0.5 * s, 8.5 * s, 4, true), '#5b4330', Math.cos(a) * out * 0.5, 3.6 * s - y * 0.5, Math.sin(a) * out * 0.5);
    root.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
  }
  parent.add(g);
  return g;
}

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
const LOOK = {
  english: { walls: ['#f1e6cc', '#e9dcc0', '#b5563f', '#c9a27a'], roofs: ['#5d5a63', '#6a5048', '#9c4a35', '#c9a25a'], foot: '#a39783' },
  spanish: { walls: ['#f6f1e6', '#f2ead8', '#efe2c8'], roofs: ['#c8643c', '#b85a36', '#d27448'], foot: '#c9b48c' },
  city: { walls: ['#f2c6c2', '#f4e1a1', '#a9d6e5', '#f7f1e3', '#c9e4b4', '#f0b98d'], roofs: ['#c8643c', '#b85a36', '#d27448'], foot: '#c9b48c' },
  shanty: { walls: ['#8b6a4a', '#a08060', '#7a5d40'], roofs: ['#c9b48a', '#9a8466', '#7f3b2e', '#5f6b5a'], foot: '#6b4f36' },
  village: { walls: ['#e2cfa8', '#d8c29a'], roofs: ['#c9a254', '#b8914a', '#d1ad62'], foot: '#b8996a' },
};
const pick = (list, rnd) => list[Math.floor(rnd(0, list.length))];

// One building at (x, z) in g's frame, facing yaw; registers its chimney and fire spot.
function building(g, look, x, z, yaw, rnd, ctx, big) {
  const L = LOOK[look] || LOOK.english, y = ctx.ground(g, x, z);
  const b = new THREE.Group();
  b.position.set(x, y, z); b.rotation.y = yaw;
  g.add(b);
  const wall = pick(L.walls, rnd), roof = pick(L.roofs, rnd);
  if (look === 'village') {
    const r = rnd(4, 5.2);
    add(b, cyl(r, r, 5, 8), wall, 0, 2.5, 0, 0.05);
    const thatch = add(b, new THREE.ConeGeometry(r + 1.6, 6, 9), roof, 0, 7.6, 0, 0.05);
    thatch.rotation.y = rnd(0, 1);
    add(b, new THREE.ConeGeometry(1.2, 2.2, 5), '#8a6a3a', 0, 11.2, 0);
    add(b, box(0.6, 3.2, 1.8), '#5a3d26', r - 0.1, 1.6, 0);
    ctx.house(b, 0, 6, 0);
    return b;
  }
  if (look === 'shanty') {
    // On stilts, the deck a little above the ground, with a lean-to roof of old sailcloth.
    const w = rnd(8, 11), d = rnd(6.5, 8), h = rnd(5, 6.5);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(b, cyl(0.45, 0.45, 7, 4, true), '#5b4330', sx * (w / 2 - 0.5), 0.5, sz * (d / 2 - 0.5));
    add(b, box(w + 1.4, 0.8, d + 1.2), '#7a5d40', 0, 3.6, 0.6);
    add(b, box(w, h, d), wall, 0, 4 + h / 2, 0, 0.04);
    const r = add(b, box(w + 1.6, 0.7, d + 2.2), roof, 0, 4 + h + 0.5, 0);
    r.rotation.x = rnd(-0.22, 0.22);
    add(b, box(0.4, 3, 1.8), '#3a2a1c', w / 2 + 0.05, 5.7, 0);
    ctx.house(b, 0, 6 + h, 0);
    return b;
  }
  const w = (big ? 1.4 : 1) * rnd(8.5, 11.5), d = rnd(6.5, 8.5), h = (big ? 1.5 : 1) * rnd(5.5, 7.5);
  footing(b, w, d, L.foot);
  add(b, box(w, h, d), wall, 0, h / 2, 0, 0.035);
  if (look === 'english') {
    add(b, gable(w, d, rnd(4.5, 6), 0.9), roof, 0, h, 0, 0.03);
    // Timber framing on the pale ones: dark beams across the front.
    if (wall === '#f1e6cc' || wall === '#e9dcc0') for (const yy of [0.4, h - 0.4]) add(b, box(w + 0.1, 0.5, d + 0.1), '#5a3d26', 0, yy, 0);
    const cx = rnd(-w / 3, w / 3);
    add(b, box(1.6, 5, 1.6), '#8a5a44', cx, h + 3, -d * 0.2);
    ctx.chimney(b, cx, h + 5.8, -d * 0.2);
  } else {
    if (rnd() < 0.7) add(b, hip(w, d, rnd(2.6, 3.6)), roof, 0, h, 0, 0.03);
    else { add(b, box(w + 0.6, 0.9, d + 0.6), L.walls[0], 0, h + 0.4, 0); add(b, box(w * 0.4, 2.2, d * 0.5), wall, w * 0.2, h + 1.5, 0); }
    if (rnd() < 0.45) { const cx = rnd(-w / 4, w / 4); add(b, box(1.3, 3.5, 1.3), L.walls[0], cx, h + 2.2, d * 0.2); ctx.chimney(b, cx, h + 4.3, d * 0.2); }
  }
  // Door and windows on the front (+x after yaw: the face toward the square or the sea).
  add(b, box(0.4, 3.2, 1.8), '#4a3020', w / 2, 1.6, 0);
  for (const s of [-1, 1]) add(b, box(0.4, 1.4, 1.3), look === 'english' ? '#3b4a5a' : '#2f5e7a', w / 2, h * 0.62, s * d * 0.3);
  ctx.house(b, 0, h, 0);
  return b;
}

// ---------- Landmarks ----------
export const BUILD = {
  town(g, o, ctx) {
    const { rnd } = ctx, look = o.look, n = o.houses;
    if (o.ring) {
      // Strung round a fort: one row of houses along an arc of the island, backs to the fort.
      const r0 = o.ringR, span = Math.min(PI * 0.9, (n * 13) / r0);
      for (let i = 0; i < n; i++) {
        const a = (i / Math.max(1, n - 1) - 0.5) * span, x = Math.cos(a) * r0 - r0, z = Math.sin(a) * r0;
        building(g, look, x + rnd(-1, 1), z, -a + rnd(-0.15, 0.15), rnd, ctx, i === Math.floor(n / 2) && look !== 'shanty' && look !== 'village');
      }
      pole(g, -r0 + Math.cos(span / 2 + 0.2) * r0, Math.sin(span / 2 + 0.2) * r0, 13, ctx, flagFor(o, ctx.st));
      ctx.people(g, [[0, -r0 * Math.sin(span * 0.3)], [0, r0 * Math.sin(span * 0.3)]], 2);
      return;
    }
    // A cluster round a little square, the biggest house (a church, an inn, a counting-house) facing the sea.
    const ext = 6 + 4.5 * Math.sqrt(n), slots = [];
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996 + rnd(-0.2, 0.2), d = 7.5 + (ext - 9) * Math.sqrt((i + 0.5) / n);
      slots.push([Math.cos(a) * d, Math.sin(a) * d, a]);
    }
    slots.forEach(([x, z, a], i) => building(g, look, x, z, PI - a + rnd(-0.25, 0.25) + (look === 'english' && rnd() < 0.5 ? PI / 2 : 0), rnd, ctx, i === 0 && (look === 'city' || look === 'spanish')));
    if (look !== 'village') pole(g, 0, 0, 14, ctx, flagFor(o, ctx.st));
    else {
      // Fishing village: canoes drawn up, a net drying on poles.
      for (let i = 0; i < 2; i++) canoe(g, ext * 0.75 + i * 2, rnd(-6, 6), rnd, ctx);
      const nx = -ext * 0.3, y = ctx.ground(g, nx, ext * 0.5);
      for (const s of [-1, 1]) add(g, cyl(0.3, 0.3, 6, 4), '#6b4a2a', nx + s * 4, y + 3, ext * 0.5);
      add(g, box(8, 3.6, 0.2), '#7b6a55', nx, y + 4, ext * 0.5);
    }
    ctx.people(g, [[-4, -3], [5, 2]], look === 'city' ? 3 : 2);
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
  lighthouse(g, o, ctx) {
    const y = 0;
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
    if (!spanish) {
      footing(g, 15, 8, '#a39783');
      add(g, box(15, 8, 8), '#cfc6b3', -1, 4, 0, 0.035);
      add(g, gable(15, 8, 5.5, 0.6), '#5d5a63', -1, 8, 0, 0.03);
      add(g, box(6, 15, 6), '#c4bba6', 7.5, 7.5, 0, 0.04);
      add(g, hip(4.6, 4.6, 11), '#4f4c55', 7.5, 15, 0, 0.04);
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
    add(g, box(5, 18, 5), '#f6f1e6', -7, 9, 4, 0.04);
    for (const [dx, dz] of [[2.55, 0], [0, 2.55], [-2.55, 0], [0, -2.55]]) add(g, box(dx ? 0.3 : 2, 3, dz ? 0.3 : 2), '#3a2c22', -7 + dx, 14.5, 4 + dz);
    add(g, hip(5, 5, 3.4), '#c8643c', -7, 18, 4, 0.04);
    add(g, blob(), '#d9a53a', -7, 14, 4).scale.setScalar(1.1);
    add(g, box(0.5, 3.4, 0.5), '#5a3d26', 6.8, 16, 0);
    add(g, box(0.5, 0.5, 2.2), '#5a3d26', 6.8, 16.8, 0);
  },
  ruin(g, o, ctx) {
    const { rnd } = ctx, stone = '#b4ad97', moss = '#7f9a5a';
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
      const a = (i / 4) * TAU + PI / 4, v = add(g, blob(), '#4a9a3f', Math.cos(a) * 10, 3.5, Math.sin(a) * 10);
      v.scale.set(3.5, 3, 3.5);
    }
    // The golden idol on top: it catches the light now and then (land.js adds the glint).
    add(g, cyl(0.9, 1.3, 2.6, 6), '#e2b13a', 0, 10.3, 0, 0.1);
    add(g, blob(), '#f2c94a', 0, 12.3, 0).scale.setScalar(1.2);
    ctx.glint(g, 0, 13, 0);
  },
  castle(g, o, ctx) {
    // A bastioned trace: the walls angle out into arrow-head bastions toward the sea.
    const stone = '#d8c08a', top = '#c2a86f';
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
export { RING };
