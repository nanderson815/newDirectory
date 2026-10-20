import * as THREE from 'three';
import { TAU, PI } from '../util.js';
import { toon, withOutline } from './gl.js';
import { hullShape, liftedExtrude } from './shapes.js';
import { bush, palm, broadleaf, olive, cypress, scrub } from './flora.js';

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
// A door or window: a flat pane on a wall, facing +z (four vertices, where a box would take twenty-four).
const pane = (w, h) => new THREE.PlaneGeometry(w, h);
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
  } else if (MED_FLAG[pattern]) {
    // The Med's (the same flags the ships fly, render/models.js drawBanner): a field, then bands or devices.
    const F = MED_FLAG[pattern];
    bar(fw, fh, fw / 2, -fh / 2, 0, F.field);
    if (pattern === 'algiers') { bar(fw, fh / 3, fw / 2, -fh / 2, 0, '#e2b13a'); bar(fw, fh / 3, fw / 2, -fh * 5 / 6, 0, '#2f6a4a'); }
    if (pattern === 'knights') { bar(fw, 1.3, fw / 2, -fh / 2, 0, '#fbf6ea'); bar(1.3, fh, fw * 0.45, -fh / 2, 0, '#fbf6ea'); }
    if (pattern === 'venice') { bar(fw * 0.42, fh * 0.34, fw * 0.42, -fh * 0.56, 0, '#e2b13a'); bar(fw * 0.16, fh * 0.3, fw * 0.36, -fh * 0.3, 0.5, '#e2b13a'); }
    for (const [cx, cy, r] of F.moons || []) {
      const m = new THREE.RingGeometry(r * 0.62, r, 9, 1, PI * 0.38, PI * 1.24).translate(cx, cy, 0);
      for (const z of [0.2, -0.2]) add(g, twoSided(m), '#fbf6ea', 0, 0, z);
      m.dispose();
    }
  }
  return g;
}
// The Med's flags: field colour, crescents [x, y, r] in the cloth's frame.
const MED_FLAG = {
  algiers: { field: '#b8231c' }, tripoli: { field: '#2f6a4a', moons: [[4.2, -3, 2]] }, ottoman: { field: '#b8231c', moons: [[3.4, -1.6, 1.2], [3.4, -4.4, 1.2], [5.8, -3, 1.2]] },
  venice: { field: '#9c1c24' }, knights: { field: '#b8231c' },
};
const FLAG = {
  port: 'english', windward: 'pirate', main: 'spanish', golden: 'spanish', pirate: 'pirate', campeche: 'spanish', armada: 'spanish',
  // The Med: whose town it is, and (for your towns) whose your friends' are.
  straits: 'spanish', barbary: 'algiers', malta: 'knights', aegean: 'ottoman', candia: 'ottoman', dardanelles: 'ottoman',
};
const FRIEND_FLAG = { malta: 'knights', aegean: 'venice', candia: 'venice' };
const flagFor = (o, st) => (o.team === 'player' ? FRIEND_FLAG[st.id] || 'english' : o.look === 'shanty' ? 'pirate' : o.look === 'english' ? 'english'
  : st.id === 'barbary' && /Tunis|Tripoli/.test(o.name || '') ? 'tripoli' : FLAG[st.id] || 'spanish');
// A Med style (the Mediterranean's landmarks build in their own manner there).
export const MED = new Set(['straits', 'barbary', 'malta', 'aegean', 'candia', 'dardanelles']);
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
  shanty: { walls: ['#8b6a4a', '#9a7b58', '#7d5f42'], roofs: ['#b4a582', '#a39474', '#7a5a3e'], accent: '#8d4a36', foot: '#6b4f36', trim: '#3a2a1c', glass: '#2a2018' },
  village: { walls: ['#e2cfa8', '#d8c29a'], roofs: ['#caa458', '#bf9a4e', '#d0ac62'], foot: '#b8996a', trim: '#5a3d26', glass: '#3a2a1c' },
  // The Mediterranean: whitewashed cubes climbing a Barbary hill, Malta's honey limestone with its wooden
  // balconies, white Greek island houses, Candia's tall Venetian stucco and Turkish timber houses under tile.
  kasbah: { walls: ['#f7f2e6', '#f2ebdc', '#ece3cf', '#f5ecd8'], roofs: ['#e3d8bf'], foot: '#d7c49c', trim: '#2f6a4a', glass: '#2b3640', accent: '#7a4a2e' },
  maltese: { walls: ['#ebd29a', '#e4c78d', '#efdaa8'], roofs: ['#d9c08a'], foot: '#c9ad78', trim: '#3f6e4c', glass: '#2f3a42', accent: '#9a3a2a' },
  greek: { walls: ['#f8f5ee', '#f3efe4', '#eee8da'], roofs: ['#c4613a', '#bb5a39', '#e8e2d4'], foot: '#d6ccb2', trim: '#4f7a5c', glass: '#2f3e48', accent: '#7a5232' },
  venetian: { walls: ['#ebcd9e', '#e2b98a', '#d8a47a', '#f0dfbc', '#cf9a72'], roofs: ['#b85a38', '#c4673e', '#a8502f'], foot: '#c2a678', trim: '#5a3d26', glass: '#2f4652' },
  ottoman: { walls: ['#f2e8d2', '#ead2ac', '#e8c6ae', '#dcb990'], roofs: ['#b5583a', '#c0643f', '#a95536'], foot: '#bfa780', trim: '#5a3d26', glass: '#3a4a52' },
};
const pick = (list, rnd) => list[Math.floor(rnd(0, list.length)) % list.length];
// How big a house is, by look: w along the street (the ridge), d deep, h to the eaves.
function plan(look, rnd) {
  if (look === 'city' || look === 'venetian') return { w: rnd(8.4, 10.6), d: rnd(7.8, 9), h: rnd(9.5, 13) };
  if (look === 'kasbah') return { w: rnd(7, 9.2), d: rnd(7, 8.6), h: rnd(5.5, 9.5) };
  if (look === 'maltese') return { w: rnd(8, 10), d: rnd(7.6, 8.6), h: rnd(8, 11) };
  if (look === 'greek') return { w: rnd(7, 8.8), d: rnd(6.6, 7.6), h: rnd(5.2, 6.8) };
  if (look === 'ottoman') return { w: rnd(8, 10), d: rnd(7.4, 8.4), h: rnd(7.4, 9.2) };
  if (look === 'shanty') return { w: rnd(6.6, 8.4), d: rnd(5.8, 7), h: rnd(5, 6.2) };
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
  } else if (MED_HOUSE[look]) {
    top = MED_HOUSE[look](b, L, w, d, h, wall, rnd, ctx);
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
    add(b, pane(1.8, 3.1), '#4a3020', dx, 1.55, d / 2 + 0.06);
    const floors = h > 8 ? 2 : 1;
    for (let f = 0; f < floors; f++) {
      const wy = floors > 1 ? h * (f ? 0.74 : 0.36) : h * 0.6;
      for (const s of [-1, 1]) if (!(f === 0 && Math.abs(s * w * 0.3 - dx) < 1.8)) { add(b, pane(1.3, 1.5), L.glass, s * w * 0.3, wy, d / 2 + 0.06); ctx.window(b, s * w * 0.3, wy, d / 2 + 0.3); }
    }
    if (look === 'city' && floors > 1) add(b, box(w * 0.55, 0.35, 1.2), L.trim, 0, h * 0.58, d / 2 + 0.5);
  }
  ctx.house(b, 0, top * 0.8, 0);
  ctx.shadow(b, 0, 0, Math.max(w, d) * 0.62, top, 0.3);
  return b;
}

// The Med's houses: (b, the look's palette, w, d, h, the wall colour, rnd, ctx) -> the height of the top. Front
// (door, windows) to local +z.
const parapet = (b, w, d, h, wall, roof) => {
  add(b, box(w + 0.4, 1, d + 0.4), wall, 0, h + 0.4, 0, 0.03);
  add(b, box(w - 0.7, 0.3, d - 0.7), roof, 0, h + 0.82, 0);
};
const front = (b, L, w, d, h, rnd, opt = {}, ctx) => {
  const dx = rnd(-0.2, 0.2) * w;
  add(b, pane(1.8, opt.arch ? 2.8 : 3.1), opt.door || '#4a3020', dx, 1.45, d / 2 + 0.06);
  const floors = h > 8 ? 2 : 1;
  for (let f = 0; f < floors; f++) {
    const wy = floors > 1 ? h * (f ? 0.74 : 0.38) : h * 0.62;
    for (const sd of opt.one ? [rnd() < 0.5 ? -1 : 1] : [-1, 1]) {
      if (f === 0 && Math.abs(sd * w * 0.3 - dx) < 1.8) continue;
      add(b, pane(opt.small ? 0.9 : 1.3, opt.small ? 1.1 : 1.5), L.glass, sd * w * 0.3, wy, d / 2 + 0.06);
      if (ctx && rnd() < 0.6) ctx.window(b, sd * w * 0.3, wy, d / 2 + 0.3);
    }
  }
};
const MED_HOUSE = {
  // Barbary: a whitewashed cube, a flat roof behind a parapet, a door and a small window; now and then a little
  // dome or a stair-house on the roof.
  kasbah(b, L, w, d, h, wall, rnd, ctx) {
    footing(b, w, d, L.foot);
    add(b, box(w, h, d), wall, 0, h / 2, 0, 0.035);
    parapet(b, w, d, h, wall, L.roofs[0]);
    front(b, L, w, d, h, rnd, { door: rnd() < 0.5 ? L.trim : L.accent, one: true, small: true }, ctx);
    let top = h + 1;
    const u = rnd();
    if (u < 0.22) { add(b, new THREE.SphereGeometry(2.4, 8, 4, 0, TAU, 0, PI / 2), wall, rnd(-1, 1), h + 0.9, rnd(-1, 1), 0.06); top = h + 3.3; }
    else if (u < 0.5) { const sx = (rnd() < 0.5 ? -1 : 1) * (w / 2 - 1.8); add(b, box(3, 2.6, 3), wall, sx, h + 2, -d / 2 + 1.8, 0.04); top = h + 3.3; }
    return top;
  },
  // Malta: honey limestone, a flat roof, and a closed wooden balcony (a gallarija) painted green or red.
  maltese(b, L, w, d, h, wall, rnd, ctx) {
    footing(b, w, d, L.foot);
    add(b, box(w, h, d), wall, 0, h / 2, 0, 0.035);
    parapet(b, w, d, h, wall, L.roofs[0]);
    front(b, L, w, d, h, rnd, { door: L.trim }, ctx);
    add(b, box(w * 0.42, 2.6, 1.6), rnd() < 0.6 ? L.trim : L.accent, rnd(-0.15, 0.15) * w, h * 0.7, d / 2 + 0.8, 0.04);
    if (rnd() < 0.3) { add(b, box(1.2, 2.4, 1.2), wall, w * 0.3, h + 1.8, -d * 0.25); ctx.chimney(b, w * 0.3, h + 3.2, -d * 0.25); }
    return h + 1;
  },
  // The Greek isles: a white cube with a coloured door, flat-roofed or under a low tiled roof.
  greek(b, L, w, d, h, wall, rnd, ctx) {
    footing(b, w, d, L.foot);
    add(b, box(w, h, d), wall, 0, h / 2, 0, 0.035);
    front(b, L, w, d, h, rnd, { door: rnd() < 0.6 ? L.trim : L.accent, one: true }, ctx);
    if (rnd() < 0.55) { parapet(b, w, d, h, wall, L.roofs[2]); return h + 1; }
    const rh = d * 0.32;
    add(b, gable(w, d, rh, 0.5), pick(L.roofs.slice(0, 2), rnd), 0, h, 0, 0.03);
    if (rnd() < 0.4) { add(b, box(1.2, 2.6, 1.2), wall, -w * 0.3, h + rh * 0.6, -d * 0.2); ctx.chimney(b, -w * 0.3, h + rh * 0.6 + 1.4, -d * 0.2); }
    return h + rh;
  },
  // Candia: tall Venetian stucco in ochre and sienna under terracotta, with the funnel chimneys of Venice.
  venetian(b, L, w, d, h, wall, rnd, ctx) {
    footing(b, w, d, L.foot);
    add(b, box(w, h, d), wall, 0, h / 2, 0, 0.035);
    front(b, L, w, d, h, rnd, {}, ctx);
    const rh = Math.min(w, d) * 0.42;
    if (rnd() < 0.5) add(b, gable(w, d, rh, 0.7), pick(L.roofs, rnd), 0, h, 0, 0.03); else add(b, hip(w, d, rh), pick(L.roofs, rnd), 0, h, 0, 0.03);
    if (rnd() < 0.6) {
      const cx = rnd(-w / 4, w / 4);
      add(b, box(1.1, 3.4, 1.1), wall, cx, h + rh * 0.6, -d * 0.18);
      add(b, cyl(1.4, 0.6, 1.6, 6), wall, cx, h + rh * 0.6 + 2.4, -d * 0.18, 0.08);
      ctx.chimney(b, cx, h + rh * 0.6 + 3.3, -d * 0.18);
    }
    return h + rh;
  },
  // The Dardanelles: a Turkish timber house, its upper storey jutting out over the street, under a hipped roof
  // with deep eaves.
  ottoman(b, L, w, d, h, wall, rnd, ctx) {
    footing(b, w, d, L.foot);
    const lo = h * 0.48;
    add(b, box(w, lo, d), L.walls[0], 0, lo / 2, 0, 0.035);
    add(b, box(w + 1.6, h - lo, d + 1.6), wall, 0, lo + (h - lo) / 2, 0, 0.035);
    add(b, box(w + 1.7, 0.45, d + 1.7), L.trim, 0, lo + 0.2, 0);
    add(b, pane(1.8, 3), '#4a3020', rnd(-0.2, 0.2) * w, 1.5, d / 2 + 0.06);
    for (const sd of [-1, 0, 1]) { add(b, pane(1.1, 1.5), L.glass, sd * w * 0.32, lo + (h - lo) * 0.55, d / 2 + 0.86); if (rnd() < 0.4) ctx.window(b, sd * w * 0.32, lo + (h - lo) * 0.55, d / 2 + 1.1); }
    const rh = Math.min(w, d) * 0.4;
    add(b, hip(w + 2.2, d + 2.2, rh), pick(L.roofs, rnd), 0, h, 0, 0.03);
    if (rnd() < 0.4) { add(b, box(1.1, 2.6, 1.1), '#b5a48a', w * 0.25, h + rh * 0.55, 0); ctx.chimney(b, w * 0.25, h + rh * 0.55 + 1.4, 0); }
    return h + rh;
  },
};

// The focal building a town gathers round, its front to local +x: a Spanish chapel with a bell tower, an
// English church with a slate spire, a pirate tavern with its lantern and flag; in the Med, a mosque, Malta's
// domed church, a white chapel, a church with a Venetian campanile.
function focal(g, look, x, z, rnd, ctx, o) {
  const y = ctx.ground(g, x, z), b = new THREE.Group();
  b.position.set(x, y, z);
  g.add(b);
  if (look === 'kasbah') { mosque(b, 'maghrebi', ctx, 0.85); return; }
  if (look === 'ottoman') { mosque(b, 'ottoman', ctx, 0.85); return; }
  if (look === 'maltese') { domeChurch(b, ctx, 0.8); return; }
  if (look === 'greek') { chapel(b, ctx, 1); return; }
  if (look === 'venetian') { campanileChurch(b, ctx, 0.85); return; }
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
const DENSE = { city: 0.5, kasbah: 1, venetian: 0.6, maltese: 0.5 };
export function townLayout(o) {
  const ext = 6 + 4.5 * Math.sqrt(o.houses), bend = o.bend || 0;
  const half = bend ? Math.min(ext * 1.3, bend * 0.9) : ext * 1.3;
  const at = (off, along) => {
    if (!bend) return [off, along, 0];
    const a = along / bend, R = bend + off;
    return [-bend + Math.cos(a) * R, Math.sin(a) * R, -a];
  };
  // A city (and the Med's close-built towns: a kasbah, Valletta, Candia) fills out its rows and its back lane.
  const dense = DENSE[o.look] || 0;
  const back = o.look !== 'village' && o.look !== 'greek' && (o.houses >= 6 || dense > 0) && (!bend || bend >= 48);
  const count = o.houses + Math.round(o.houses * (dense || (back ? 0.3 : 0)));
  return { half, ext, at, back, count };
}

// ---------- The Med's buildings ----------
// A mosque, its front to local +x. maghrebi: a white prayer hall under green-tiled roofs and a square minaret with
// a lantern on top (the Barbary coast, Tangier); ottoman: a hall under a lead dome with half-domes, and a slender
// pencil minaret with a balcony and a conical lead cap (the Sultan's lands).
function mosque(b, kind, ctx, k = 1) {
  const g = new THREE.Group();
  g.scale.setScalar(k);
  b.add(g);
  const white = '#f6f1e4', lead = '#8e959b';
  ctx.shadow(g, -2, 0, 11, 20, 0.32);
  footing(g, 14, 12, '#d7c49c');
  if (kind === 'maghrebi') {
    add(g, box(14, 7, 12), white, 0, 3.5, 0, 0.035);
    for (const zz of [-3, 3]) add(g, hip(14, 5, 2.6), '#3f7a52', 0, 7, zz, 0.03);
    add(g, box(0.4, 3.6, 2.4), '#2f6a4a', 7.05, 1.8, 0);
    // The minaret: a square tower banded in green tile, a crenellated gallery, a small lantern and gilt finial.
    const mx = -5, mz = -5.4;
    add(g, box(4.4, 22, 4.4), white, mx, 11, mz, 0.04);
    for (const yy of [8, 15]) add(g, box(4.6, 0.8, 4.6), '#3f7a52', mx, yy, mz);
    for (const [dx, dz] of [[1.6, 1.6], [-1.6, 1.6], [1.6, -1.6], [-1.6, -1.6]]) add(g, box(1, 1.2, 1), white, mx + dx, 22.6, mz + dz);
    add(g, box(2.2, 3.2, 2.2), white, mx, 23.6, mz, 0.06);
    add(g, hip(2.2, 2.2, 1.6), '#3f7a52', mx, 25.2, mz, 0.06);
    for (const yy of [27.3, 28.4]) add(g, new THREE.SphereGeometry(0.42, 6, 4), '#e2b13a', mx, yy, mz);
    ctx.window(g, mx, 24, mz);
  } else {
    add(g, box(12, 7, 12), white, 0, 3.5, 0, 0.035);
    add(g, cyl(5.6, 6, 2, 12), white, 0, 7.8, 0, 0.04);
    add(g, new THREE.SphereGeometry(5.6, 12, 6, 0, TAU, 0, PI / 2), lead, 0, 8.8, 0, 0.04);
    for (const [dx, dz] of [[6, 0], [-6, 0]]) add(g, new THREE.SphereGeometry(3.2, 10, 4, 0, TAU, 0, PI / 2), lead, dx * 0.92, 6.8, dz, 0.05);
    add(g, cyl(0.25, 0.25, 2, 4), '#e2b13a', 0, 15.2, 0);
    add(g, new THREE.TorusGeometry(0.5, 0.15, 4, 8, PI * 1.3).rotateZ(PI * 0.35), '#e2b13a', 0, 16.5, 0);
    add(g, box(0.4, 3.4, 2.2), '#4a3020', 6.05, 1.7, 0);
    // The pencil minaret.
    const mx = -4.6, mz = -7.6;
    add(g, cyl(1.5, 1.7, 4, 8), white, mx, 2, mz, 0.05);
    add(g, cyl(1.15, 1.35, 22, 10), white, mx, 14, mz, 0.06);
    add(g, cyl(1.9, 1.5, 0.9, 10), white, mx, 20, mz, 0.06);
    add(g, new THREE.ConeGeometry(1.25, 6.5, 10), lead, mx, 28.2, mz, 0.06);
    add(g, cyl(0.15, 0.15, 1.6, 4), '#e2b13a', mx, 32, mz);
    ctx.window(g, mx, 20.6, mz);
  }
}
// Malta's: a honey-stone church with a great dome on a drum and twin bell towers at its front (+x).
function domeChurch(b, ctx, k = 1) {
  const g = new THREE.Group();
  g.scale.setScalar(k);
  b.add(g);
  const stone = '#e8cc92', dark = '#c9aa70';
  ctx.shadow(g, -2, 0, 12, 22, 0.32);
  footing(g, 18, 12, dark);
  add(g, box(18, 9, 9), stone, -1, 4.5, 0, 0.035);
  add(g, box(9, 9, 15), stone, -3, 4.5, 0, 0.035);
  add(g, box(18.4, 0.8, 9.4), dark, -1, 9.2, 0);
  add(g, cyl(4.2, 4.4, 4, 12), stone, -3, 11, 0, 0.04);
  add(g, new THREE.SphereGeometry(4.5, 12, 6, 0, TAU, 0, PI / 2), '#b5533a', -3, 13, 0, 0.04);
  add(g, cyl(0.9, 1, 2.6, 8), stone, -3, 18.6, 0, 0.06);
  add(g, new THREE.ConeGeometry(1.1, 1.6, 8), '#b5533a', -3, 20.6, 0);
  for (const z of [-3.6, 3.6]) {
    add(g, box(3.4, 14, 3.4), stone, 6.6, 7, z, 0.04);
    add(g, new THREE.SphereGeometry(1.8, 8, 4, 0, TAU, 0, PI / 2), dark, 6.6, 14, z, 0.06);
  }
  add(g, box(0.5, 4, 2.6), '#4a3020', 8.05, 2, 0);
  add(g, box(0.5, 1.8, 1.8), '#2f3a42', 8.05, 6.8, 0);
}
// The Greek isles': a little whitewashed chapel, a vaulted roof, a dome on a drum and a bell-gable.
function chapel(b, ctx, k = 1) {
  const g = new THREE.Group();
  g.scale.setScalar(k);
  b.add(g);
  const white = '#f8f5ee';
  ctx.shadow(g, 0, 0, 7.5, 12, 0.3);
  footing(g, 10, 6.5, '#d6ccb2');
  add(g, box(10, 5.5, 6.5), white, 0, 2.75, 0, 0.035);
  add(g, new THREE.CylinderGeometry(3.25, 3.25, 10, 10, 1, false, 0, PI).rotateZ(PI / 2), white, 0, 5.5, 0, 0.04);
  add(g, cyl(2, 2.1, 2.2, 10), white, -1, 8.4, 0, 0.05);
  add(g, new THREE.SphereGeometry(2.2, 10, 5, 0, TAU, 0, PI / 2), white, -1, 9.5, 0, 0.05);
  add(g, box(0.3, 1.6, 0.3), '#7a5232', -1, 12.3, 0);
  add(g, box(0.3, 0.3, 1.2), '#7a5232', -1, 12.6, 0);
  // The bell-gable over the door, with its arch.
  add(g, box(1, 4.4, 4.4), white, 5.3, 7, 0, 0.05);
  add(g, box(1.1, 1.8, 1.4), '#3a3430', 5.3, 7.3, 0);
  add(g, pane(1.6, 2.8).rotateY(PI / 2), '#4f7a5c', 5.06, 1.4, 0);
}
// Candia's: a stuccoed church with a tall brick campanile under a pyramid cap.
function campanileChurch(b, ctx, k = 1) {
  const g = new THREE.Group();
  g.scale.setScalar(k);
  b.add(g);
  ctx.shadow(g, -2, 0, 10, 26, 0.32);
  footing(g, 15, 8, '#c2a678');
  add(g, box(15, 9, 8), '#ead2a6', -1, 4.5, 0, 0.035);
  add(g, gable(15, 8, 4, 0.6), '#b85a38', -1, 9, 0, 0.03);
  add(g, box(0.5, 4, 2.6), '#4a3020', 6.55, 2, 0);
  add(g, cyl(1.3, 1.3, 0.4, 10).rotateZ(PI / 2), '#2f4652', 6.6, 7.4, 0);
  add(g, box(4.6, 24, 4.6), '#b86a48', -6, 12, -5.2, 0.04);
  add(g, box(5, 4, 5), '#e8d2a8', -6, 21, -5.2, 0.04);
  for (const [dx, dz] of [[2.55, 0], [0, 2.55], [-2.55, 0], [0, -2.55]]) add(g, box(dx ? 0.3 : 2, 2.6, dz ? 0.3 : 2), '#3a2c22', -6 + dx, 21, -5.2 + dz);
  add(g, hip(4.6, 4.6, 5), '#b85a38', -6, 23, -5.2, 0.05);
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
        // In the Med: date palms by a Barbary square, a cypress and an olive by a Christian or a Turkish one.
        if (look === 'kasbah') palm(g, px, py, pz, 0.78, rnd, ctx.st.F, ctx, null, true);
        else if (MED.has(ctx.st.id) && look !== 'english' && look !== 'spanish') { if (sd > 0) cypress(g, px, py, pz, 0.8, rnd, ctx.st.F); else olive(g, px, py, pz, 0.75, rnd, ctx.st.F); }
        else if (look === 'english') { if (sd > 0) broadleaf(g, px, py, pz, 0.72, rnd, ctx.st.F); } else if (look !== 'shanty' || sd > 0) palm(g, px, py, pz, 0.78, rnd, ctx.st.F, ctx);
      }
    }
    // Gardens: a tree at the end of a row now and then, so the town settles into the land round it.
    for (const row of rows) for (const sgn of [-1, 1]) {
      if (!row.used.length || rnd() < 0.4) continue;
      const zEnd = sgn > 0 ? Math.max(...row.used.map((u) => u[1])) + 4.6 : Math.min(...row.used.map((u) => u[0])) - 4.6;
      if (Math.abs(zEnd) > half * 1.12) continue;
      const [x, z] = L.at(row.off - row.dir * 4, zEnd);
      if (MED.has(ctx.st.id)) { if (look === 'kasbah') palm(g, x, ctx.ground(g, x, z), z, 0.72, rnd, ctx.st.F, ctx, null, true); else if (rnd() < 0.5) cypress(g, x, ctx.ground(g, x, z), z, 0.75, rnd, ctx.st.F); else olive(g, x, ctx.ground(g, x, z), z, 0.72, rnd, ctx.st.F); }
      else broadleaf(g, x, ctx.ground(g, x, z), z, 0.7, rnd, ctx.st.F);
    }
    // The street and the square, packed earth (paler dust in the Med).
    const pts = [], dirt = MED.has(ctx.st.id) ? '#cdb487' : '#b49a6c';
    for (let i = 0; i <= 10; i++) { const [x, z] = L.at(0, -half + (2 * half * i) / 10); pts.push([x, z]); }
    ctx.flat(g, pts, 4.6, dirt, 0.5);
    if (hasFocal) ctx.flat(g, [L.at(1.5, 0)], 6, dirt, 0.45);
    if (look !== 'shanty') { const [x, z] = hasFocal ? L.at(4.5, 0) : L.at(1.2, half * 0.55); pole(g, x, z, 14, ctx, flagFor(o, ctx.st)); }
    { const [x, z] = L.at(1.5, half * 0.86); goods(g, x, z, rnd, ctx); }
    // Rowing boats drawn up on the beach below the town, where there is a beach.
    for (const along of [half * 0.35, -half * 0.5]) {
      let off = 14;
      while (off < 70 && g.position.y + ctx.ground(g, ...L.at(off, along).slice(0, 2)) > 1.3) off += 2; // (ground is relative to the town)
      if (off >= 70 || rnd() < 0.3) continue;
      const [x, z, yaw] = L.at(off - 5, along), y = ctx.ground(g, x, z);
      const b = rowboat(look === 'shanty' ? '#6b4f36' : '#a5672f');
      b.position.set(x, y + 0.2, z); b.rotation.set(0, yaw + rnd(-0.4, 0.4), 0.12);
      g.add(b);
    }
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
    if (MED.has(ctx.st.id)) { lanterna(g, o, ctx); return; }
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
    if (MED.has(ctx.st.id)) { medWindmill(g, ctx); return; }
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
    // The Med's church is the region's own: Malta's dome, an island chapel, Candia's campanile, a mosque on
    // Muslim shores.
    const med = { malta: 'dome', aegean: 'chapel', candia: 'campanile', barbary: 'mosque', dardanelles: 'mosque' }[ctx.st.id];
    if (med === 'dome') { domeChurch(g, ctx, 1.15); return; }
    if (med === 'chapel') { chapel(g, ctx, 1.3); return; }
    if (med === 'campanile') { campanileChurch(g, ctx, 1.1); return; }
    if (med === 'mosque') { mosque(g, ctx.st.id === 'barbary' ? 'maghrebi' : 'ottoman', ctx, 1.05); return; }
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
    if (MED.has(ctx.st.id)) { classicalRuin(g, o, ctx); return; }
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
    // A bastioned trace: the walls angle out into arrow-head bastions toward the sea. In the Med its stone is the
    // region's and it flies the colours of whoever holds that shore (o.flag overrides).
    const med = MED_STONE[ctx.st.id];
    const stone = med ? med[0] : '#d8c08a', top = med ? med[1] : '#c2a86f';
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
    pole(g, 2, -4, 9, { ...ctx, ground: () => 10 }, o.flag || (med ? CASTLE_FLAG[ctx.st.id] : 'spanish'));
    ctx.people(g, [[-8, 6], [6, 6]], 2, 10.3);
  },
  // ---------- The Mediterranean's ----------
  mosque(g, o, ctx) { mosque(g, o.look || (ctx.st.id === 'barbary' || ctx.st.id === 'straits' ? 'maghrebi' : 'ottoman'), ctx, 1.15); },
  chapel(g, o, ctx) { chapel(g, ctx, 1.25); if (o.cypress !== 0) for (const z of [-6, 6]) cypress(g, -3, ctx.ground(g, -3, z * 1.4), z * 1.4, 0.9, ctx.rnd, ctx.st.F); },
  kasbah(g, o, ctx) {
    // A walled citadel on its hill: crenellated walls round a square, a tower at each corner, the gate to the sea,
    // white buildings inside under a square minaret.
    const { rnd } = ctx, wall = '#e9dcc0', dark = '#c9b48c', W = 30;
    g.scale.setScalar(1.05);
    ctx.shadow(g, 0, 0, 20, 14, 0.3);
    footing(g, W, W, dark);
    for (const [x, z, rx] of [[W / 2, 0, 0], [-W / 2, 0, 0], [0, W / 2, 1], [0, -W / 2, 1]]) {
      const seg = add(g, box(rx ? W : 2, 8, rx ? 2 : W), wall, x, 4, z, 0.04);
      void seg;
      for (let i = -3; i <= 3; i++) add(g, box(1.3, 1.4, 1.3), wall, x + (rx ? i * W / 7 : 0), 8.7, z + (rx ? 0 : i * W / 7));
    }
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      add(g, box(5, 11, 5), wall, x * W / 2, 5.5, z * W / 2, 0.04);
      for (const [dx, dz] of [[1.8, 1.8], [-1.8, 1.8], [1.8, -1.8], [-1.8, -1.8]]) add(g, box(1.2, 1.4, 1.2), wall, x * W / 2 + dx, 11.7, z * W / 2 + dz);
    }
    add(g, box(0.5, 4.4, 3.2), '#4a3020', W / 2 + 1.05, 2.2, 0);
    for (let i = 0; i < 5; i++) {
      const p = { w: rnd(6, 8), d: rnd(6, 8), h: rnd(6, 10) };
      house(g, 'kasbah', rnd(-9, 9), rnd(-9, 9), (i % 2) * PI / 2, rnd, ctx, p);
    }
    const mg = new THREE.Group(); mg.position.set(-6, 0, -6); g.add(mg);
    mosque(mg, 'maghrebi', ctx, 0.75);
    pole(g, W / 2 - 2, W / 2 - 2, 12, { ...ctx, ground: () => 11 }, CASTLE_FLAG[ctx.st.id] || 'algiers');
    ctx.people(g, [[W / 2 + 3, -6], [W / 2 + 3, 6]], 2);
  },
  walls(g, o, ctx) {
    // A bastioned front along the shore (local z), its arrow-head bastions out to sea (+x): Valletta's and Candia's
    // great walls. length: how far it runs.
    const med = MED_STONE[ctx.st.id] || ['#d8c08a', '#c2a86f'], stone = med[0], top = med[1], len = o.length, H = 11;
    if (o.landward) g.rotation.y += PI;
    const n = Math.max(2, Math.round(len / 46));
    ctx.shadow(g, 0, 0, len * 0.42, 12, 0.22);
    add(g, box(6, H + 6, len), stone, -2, H / 2 - 3, 0, 0.02);
    add(g, box(6.4, 1, len), top, -2, H + 0.4, 0);
    for (let i = 0; i < n; i++) {
      const z = (i / (n - 1) - 0.5) * (len - 16), sh = new THREE.Shape();
      sh.moveTo(0, -8); sh.lineTo(13, -5); sh.lineTo(17, 0); sh.lineTo(13, 5); sh.lineTo(0, 8); sh.closePath();
      const bs = new THREE.Mesh(liftedExtrude(sh, H + 5, 0.6, 0), toon(stone));
      bs.position.set(0, -5, z);
      withOutline(bs, 0.025);
      g.add(bs);
      const tp = new THREE.Shape(); tp.moveTo(0, -6.4); tp.lineTo(11.4, -4); tp.lineTo(14.8, 0); tp.lineTo(11.4, 4); tp.lineTo(0, 6.4); tp.closePath();
      const ter = new THREE.Mesh(liftedExtrude(tp, 0.6, 0, 0), toon(top));
      ter.position.set(0, H + 0.2, z);
      g.add(ter);
      for (const dz of [-2.4, 2.4]) add(g, cyl(0.55, 0.7, 3.6, 6), '#2a2522', 13.6, H + 1.4, z + dz).rotation.z = PI / 2;
      // A sentry box (guardiola) at the bastion's point.
      add(g, cyl(1.3, 1.3, 3, 6), stone, 16, H + 1.6, z, 0.08);
      add(g, new THREE.ConeGeometry(1.6, 2, 6), top, 16, H + 4.1, z);
    }
    if (o.gate !== 0) add(g, box(1, 6, 4.4), '#4a3020', 1.1, 3, (n > 2 ? 0.5 / (n - 1) : 0.25) * (len - 16));
    pole(g, -2, -len / 2 + 4, 12, { ...ctx, ground: () => H }, o.flag || CASTLE_FLAG[ctx.st.id] || 'spanish');
    ctx.people(g, [[-2, -len * 0.3], [-2, len * 0.3]], 2, H + 0.5);
  },
  cypresses(g, o, ctx) {
    // A row of cypresses along a road or round a graveyard.
    const n = o.count;
    for (let i = 0; i < n; i++) {
      const z = (i - (n - 1) / 2) * 6.5, x = ctx.rnd(-1, 1);
      cypress(g, x, ctx.ground(g, x, z), z, ctx.rnd(0.85, 1.1), ctx.rnd, ctx.st.F);
      ctx.shadow(g, x, z, 3, 18, 0.25);
    }
  },
  siegeworks(g, o, ctx) {
    // The Turkish lines before Candia: zig-zag trenches cut in the earth, a battery behind gabions with its guns
    // trained on the walls (+x), and the camp's tents behind, the Pasha's red one among them.
    const { rnd } = ctx;
    const zig = [];
    for (let i = 0; i <= 6; i++) zig.push([10 - i * 4 + (i % 2 ? 5 : -5), (i - 3) * 9]);
    ctx.flat(g, zig, 3.4, '#6b5236', 0.6);
    ctx.flat(g, [[16, -24], [16, 24]], 3.2, '#6b5236', 0.55);
    for (let i = -3; i <= 3; i++) {
      const z = i * 6.5;
      add(g, cyl(1.5, 1.6, 2.6, 7), '#9a7c52', 19, ctx.ground(g, 19, z) + 1.3, z, 0.08);
      if (i % 2 === 0) add(g, cyl(0.7, 0.85, 7, 6), '#2a2522', 17, ctx.ground(g, 17, z + 3.2) + 1.6, z + 3.2, 0.1).rotation.z = PI / 2 - 0.2;
    }
    for (let i = 0; i < o.tents; i++) {
      const x = -16 - (i % 3) * 8 + rnd(-2, 2), z = (Math.floor(i / 3) - (o.tents / 6 - 0.5)) * 10 + rnd(-2, 2);
      const big = i === 1, col = big ? '#a8262a' : i % 2 ? '#f2ead6' : '#e6d6b2';
      add(g, new THREE.ConeGeometry(big ? 5 : 3.4, big ? 6.4 : 4.6, 8), col, x, ctx.ground(g, x, z) + (big ? 3.2 : 2.3), z, 0.06);
      add(g, cyl(0.15, 0.15, big ? 8.6 : 6, 4), '#5a3d26', x, ctx.ground(g, x, z) + (big ? 4.3 : 3), z);
      ctx.shadow(g, x, z, big ? 5 : 3.6, 6, 0.25);
    }
    pole(g, -22, 0, 14, ctx, 'ottoman');
    ctx.chimney(g, -30, ctx.ground(g, -30, 6) + 1, 6);
    ctx.people(g, [[12, -14], [12, 14]], 3);
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
      bush(g, x, y + h - 1.2, z, r * 0.25, rnd, st.F, [st.grass[1], st.high]); // a grassy cap
      if (rnd() < 0.5) ctx.gulls(g, x, y + h, z, 1, 9, 14);
    }
  },
  mangroves(g, o, ctx) {
    // Built along the shore by land.js (it knows the outline); nothing at the spot itself.
  },
  peak() {}, // part of the terrain itself (land.js)
  volcano() {}, // the terrain plus a plume (land.js)
};

// Stone and colours for the Med's castles and walls: [stone, the walkway's top].
const MED_STONE = {
  straits: ['#d6cfbd', '#b8b09c'], barbary: ['#e9dcc0', '#cdb98f'], malta: ['#e6cb93', '#c9aa70'],
  aegean: ['#ddd6c6', '#bdb5a3'], candia: ['#dcc595', '#bfa673'], dardanelles: ['#d2cab6', '#b0a892'],
};
const CASTLE_FLAG = { straits: 'spanish', barbary: 'algiers', malta: 'knights', aegean: 'ottoman', candia: 'venice', dardanelles: 'ottoman' };

// The Med's windmill: a white tower under a thatched cone, its sails eight triangles of cloth on spars (the
// Cyclades, Malta, Crete, the Dardanelles).
function medWindmill(g, ctx) {
  g.scale.setScalar(1.3);
  ctx.shadow(g, 0, 0, 6, 18, 0.3);
  add(g, cyl(4.4, 4.8, 13, 10), '#f6f2e8', 0, 6.5, 0, 0.05);
  add(g, new THREE.ConeGeometry(5, 4.4, 10), '#b89a62', 0, 15.2, 0, 0.06);
  add(g, box(0.4, 3.2, 1.8), '#4f7a5c', 4.7, 1.6, 0);
  add(g, box(0.4, 1.2, 1), '#2f3e48', 4.5, 9, 0);
  const hub = new THREE.Group();
  hub.position.set(5, 12.5, 0);
  g.add(hub);
  add(hub, cyl(0.7, 0.7, 2, 6), '#5a3d26', 0, 0, 0).rotation.z = PI / 2;
  for (let i = 0; i < 8; i++) {
    const arm = new THREE.Group();
    arm.rotation.x = (i / 8) * TAU;
    hub.add(arm);
    add(arm, box(0.3, 11, 0.3), '#5a3d26', 0.6, 5.5, 0);
    const sail = new THREE.Shape(); sail.moveTo(0, 2); sail.lineTo(0, 10.5); sail.lineTo(3.2, 4); sail.closePath();
    add(arm, twoSided(new THREE.ShapeGeometry(sail).rotateY(PI / 2)), '#f4ecd8', 0.7, 0, 0);
  }
  ctx.spin(hub);
}
// The Med's light: a round stone tower (a lanterna) with a gallery and a lantern under a lead cap.
function lanterna(g, o, ctx) {
  const st = MED_STONE[ctx.st.id] || ['#d8cfbd', '#b8b09c'];
  g.scale.setScalar(1.35);
  ctx.shadow(g, 0, 0, 6.5, 30, 0.32);
  add(g, cyl(6, 6.8, 3, 10), st[1], 0, 1.2, 0, 0.05);
  add(g, cyl(3.6, 4.6, 20, 10), st[0], 0, 12, 0, 0.05);
  add(g, cyl(5, 4.2, 1.6, 10), st[1], 0, 22.6, 0, 0.05);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; add(g, box(1, 1.2, 1), st[0], Math.cos(a) * 4.4, 24, Math.sin(a) * 4.4); }
  add(g, cyl(2.3, 2.3, 3.4, 8), '#fff1b0', 0, 25.4, 0);
  add(g, new THREE.SphereGeometry(2.8, 8, 4, 0, TAU, 0, PI / 2), '#8e959b', 0, 27.1, 0, 0.06);
  add(g, box(0.4, 3, 1.6), '#4a3020', 4.3, 3.6, 0);
  ctx.lamp(g, 0, 25.4, 0);
  ctx.gulls(g, 0, 28, 0, o.sight > 0 ? 2 : 3, 22, 18);
}
// A classical ruin (Carthage, Troy, the Roman stones of the Barbary coast): a stepped platform, a row of standing
// columns, a scrap of architrave over two of them, fallen drums, scrub growing through.
function classicalRuin(g, o, ctx) {
  const { rnd } = ctx, marble = '#e6dfcf', worn = '#cfc6b2';
  g.scale.setScalar(1.15);
  ctx.shadow(g, 0, 0, 14, 10, 0.26);
  footing(g, 26, 16, '#bdb39c');
  add(g, box(26, 1.6, 16), worn, 0, 0.8, 0, 0.03);
  add(g, box(23, 1.4, 13), marble, 0, 2.3, 0, 0.03);
  const cols = [];
  for (let i = 0; i < 6; i++) for (const z of [-5, 5]) cols.push([-9.5 + i * 3.8, z]);
  cols.forEach(([x, z], i) => {
    const h = i === 2 || i === 4 ? 13 : rnd() < 0.4 ? rnd(2, 6) : rnd() < 0.5 ? 13 : 0;
    if (h <= 0) return;
    add(g, cyl(0.95, 1.1, h, 8), marble, x, 3 + h / 2, z, 0.08);
    if (h > 12) add(g, box(2.6, 0.8, 2.6), marble, x, 3 + h + 0.4, z);
  });
  add(g, box(4.8, 1.6, 2.4), marble, -1.9, 17.6, -5, 0.06);
  for (let i = 0; i < 4; i++) {
    const a = rnd(0, TAU), d = rnd(10, 15), x = Math.cos(a) * d, z = Math.sin(a) * d * 0.7;
    add(g, cyl(1, 1, rnd(2.4, 4), 8), marble, x, ctx.ground(g, x, z) + 1, z).rotation.set(PI / 2, 0, rnd(0, TAU));
  }
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.6; scrub(g, Math.cos(a) * 12, ctx.ground(g, Math.cos(a) * 12, Math.sin(a) * 8), Math.sin(a) * 8, 0.8, rnd, ctx.st.F); }
}

// A small rowing boat, bow along +x (in a town's frame: drawn up the beach, bow to the sea), with a thwart.
function rowboat(color) {
  const b = new THREE.Group(), m = new THREE.Mesh(liftedExtrude(hullShape(8, 3.4), 1.6, 0.6, 0.55), toon(color));
  withOutline(m, 0.07);
  b.add(m);
  add(b, box(0.7, 0.3, 2.6), '#5e4029', 0, 1.2, 0);
  return b;
}
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
