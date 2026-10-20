import * as THREE from 'three';
import { TAU, PI, clamp, lerp, angDiff } from '../util.js';
import { R, toon } from './gl.js';
import { wx, wz, cam } from './camera.js';
import { bakeStatic, FORT_BASE_Y } from './models.js';
import { coastDepth, coastPoint, coreDist, coastGap } from '../sim/terrain.js';
import { placer } from '../sim/battle.js';
import { LANDMARKS, RING, STYLE_FALLBACK } from '../sim/land.js';
import { battleDef } from '../config/endless.js';
import { weatherFor } from '../config/weather.js';
import { BUILD, flagCloth, buoys, sharedGeos, townLayout } from './landmarks.js';
import { broadleaf, crown, palm, pine, bush, scrub, cactus, agave, mangrove, olive, cypress, stonePine, floraGeos } from './flora.js';
import { buildShoal, buildReef, rng, sharedTerrainGeos } from './terrain.js';

// The land of a battle: islands and coasts with hills, cliffs, beaches and coves in the region's style
// (src/sim/land.js has the styles' ids and the landmarks), the plants and landmarks on them, and the shoals and
// reefs from render/terrain.js. Built once per battle and baked into a few meshes: toon land, its ink, the
// translucent flats (shallows, surf, the soft shadows under trees and houses), and the swaying things (palms,
// flags, windmill sails) with their ink, which move in the vertex shader. The living details are cheap extras,
// revealed as you zoom in: chimney smoke (into the shared puff pool), lamps (the glow pool), gulls and parrots,
// people on the wharves and in the squares, scorch marks where shot has landed, and calm water in the lee of
// high land (one draw call each).
//
// Art direction: a toy diorama in warm, soft colour. The ground steps gently from wet sand to dry sand, lush
// low grass, drier slopes and rock with strata on the cliffs; woods grow in groves with clearings, thickest
// inland and thinning to palms behind the beach; the shore is a soft band of turquoise shallows with a broken
// line of surf. The land stays a step quieter than the ships, which are the brightest things on the water.

// ---------- Styles ----------
// Colours are sRGB hex. hill/plateau in map units; beach is the share of an island's radius that is sand;
// cliffs the share of shore that is cliff on an average island; density per area; veg: the plant mix: grove
// (broad, pine: what the woods are made of), palms (share of the strip behind the beach), forest (how much of
// the land is wooded, about 1), dry (cactus, agave and scrub in the meadows). Ground colours run wet sand ->
// sand -> grass (low, then higher) with meadow patches, a darker floor under the woods, then high ground and rock
// banded with strata. F is the plants' palette (render/flora.js).
const FLORA = {
  canopy: ['#4f8e41', '#5a9946', '#46833d'], bush: ['#5b9747', '#4e8a41'], scrub: ['#8c9b54', '#7b8d4c'],
  trunk: '#6f5034', palmTrunk: '#a07e58', frond: ['#64a94b', '#4f9541'], nut: '#6b4a2a',
  pine: ['#3f6f4b', '#477a51', '#3a6646'], cactus: '#6b9a62', agave: ['#82a98b', '#6c977b'],
  mangrove: ['#3f7236', '#36683a'], root: '#5e4632',
  // The Mediterranean's trees.
  olive: ['#6e8252', '#7a8c5a', '#67794c'], oliveTrunk: '#6d5c48', cypress: ['#2f5238', '#365a3c', '#2b4b35'],
  stone: ['#4f7044', '#5a7a49'], pineTrunk: '#8a6446', dateTrunk: '#a3845a', dateFrond: ['#7d9e62', '#6e9158'], dates: '#b0602a',
};
const STYLES = {
  port: {
    sand: '#efdcab', wet: '#cdb37f', grass: ['#88ae5b', '#749b51'], meadow: '#a6bd6c', high: '#628c47', forest: '#4c733a',
    rock: '#a39b8c', strata: '#847a6b', pad: '#d9c79c',
    cliffs: 0.12, hill: 19, plateau: 5, beach: 0.17, density: 1, veg: { grove: 'broad', palms: 0.45, forest: 1 },
  },
  windward: {
    sand: '#e5d6aa', wet: '#c4b384', grass: ['#95aa66', '#7f9559'], meadow: '#a9b276', high: '#728d51', forest: '#4a673f',
    rock: '#948e86', strata: '#6e6962', pad: '#cbbd95',
    cliffs: 0.45, hill: 28, plateau: 8, beach: 0.09, density: 0.75, veg: { grove: 'pine', palms: 0.2, forest: 0.85 },
    F: { canopy: ['#4c7f45', '#56894b'], bush: ['#5b8a4c', '#64924f'] },
  },
  main: {
    sand: '#ecd9ae', wet: '#cbb07e', grass: ['#8db866', '#7aa75c'], meadow: '#bcbd78', high: '#7d9156', forest: '#5a7340',
    rock: '#c6a378', strata: '#a2805c', pad: '#dec8a0',
    cliffs: 0.22, hill: 16, plateau: 5, beach: 0.15, density: 0.85, veg: { grove: 'broad', palms: 0.34, forest: 0.5, dry: true },
    F: { canopy: ['#6b9045', '#77994b', '#61853f'], bush: ['#7c9548', '#6f8a44'] },
  },
  golden: {
    sand: '#e8d7a3', wet: '#c4ad78', grass: ['#5c994b', '#4b8943'], meadow: '#76aa55', high: '#448541', forest: '#2c6133',
    rock: '#7e8a72', strata: '#606c58', pad: '#c9bb90',
    cliffs: 0.18, hill: 32, plateau: 6, beach: 0.13, density: 1.6, veg: { grove: 'broad', palms: 0.3, forest: 1.35 },
    F: { canopy: ['#2f7d3a', '#378a3f', '#2b7035', '#3f9243'], broadScale: 1.12 },
  },
  pirate: {
    sand: '#f2e2b2', wet: '#d2bd88', grass: ['#85b158', '#70a04e'], meadow: '#9fbd66', high: '#5e9645', forest: '#45793a',
    rock: '#7d736b', strata: '#625951', pad: '#d9c393',
    cliffs: 0.15, hill: 17, plateau: 4, beach: 0.2, density: 1.1, veg: { grove: 'broad', palms: 0.75, forest: 0.85 },
  },
  campeche: {
    sand: '#ead9ad', wet: '#c9b583', grass: ['#93b062', '#7e9e57'], meadow: '#b1c473', high: '#6e9450', forest: '#4d773f',
    rock: '#9c917e', strata: '#7e745f', pad: '#d6c399',
    cliffs: 0, hill: 4, plateau: 2.5, beach: 0.22, density: 1.1, veg: { grove: 'broad', palms: 0.55, forest: 0.75 },
    F: { canopy: ['#3f7c3a', '#488640', '#538f45'] },
  },
  armada: {
    sand: '#ecd8a8', wet: '#c9b27f', grass: ['#85aa5a', '#70974f'], meadow: '#9cb469', high: '#5f8c47', forest: '#446e39',
    rock: '#cbb68c', strata: '#a8936a', pad: '#d9c69d',
    cliffs: 0.35, hill: 17, plateau: 6, beach: 0.12, density: 1, veg: { grove: 'broad', palms: 0.4, forest: 0.85 },
  },
  // ---------- The Mediterranean ----------
  // Drier and paler than the Indies: straw and olive grass, pale limestone and ochre rock, scrub (maquis) for
  // bushes, and its own trees: olives in orchard rows (orchard: on a grid, not in woods), cypresses (the share
  // of lone trees), umbrella pines ('stone' groves), date palms (palms: 'date'). terraces: the hillsides stepped
  // into fields, banded by height.
  // The Straits: Gibraltar's pale limestone, dry golden scrub, cork and umbrella pine.
  straits: {
    sand: '#ecd8a8', wet: '#c6ad7c', grass: ['#a9a866', '#939a58'], meadow: '#cbb877', high: '#7d8a52', forest: '#55653c',
    rock: '#cfc6b2', strata: '#a9a08c', pad: '#dfcca2',
    cliffs: 0.4, hill: 22, plateau: 6, beach: 0.12, density: 0.7, veg: { grove: 'stone', palms: 0, forest: 0.6, dry: 'maquis', cypress: 0.15 },
    F: { canopy: ['#5f7a45', '#6b8449'], bush: ['#7d8a4f', '#8a9455'], scrub: ['#9a9a5a', '#8a8d52'], stone: ['#4f7044', '#5a7a49'] },
  },
  // The Barbary coast: ochre hills, red rock, date palms behind the beaches, olives inland.
  barbary: {
    sand: '#f1dcaa', wet: '#ccad79', grass: ['#b8a462', '#a39256'], meadow: '#d2b56e', high: '#a8835a', forest: '#6a7342',
    rock: '#cf9466', strata: '#a86e4a', pad: '#ece0c4',
    cliffs: 0.25, hill: 18, plateau: 5, beach: 0.16, density: 0.6, veg: { grove: 'olive', orchard: true, palms: 0.55, date: true, forest: 0.4, dry: 'maquis' },
    F: { bush: ['#5f7342', '#6a7a46'], scrub: ['#7f8248', '#8a8a4e'], olive: ['#6c8050', '#778a58', '#65784a'] },
  },
  // Malta: honey-coloured limestone, cliffs to the sea, small fields stepped down the slopes.
  malta: {
    sand: '#efdcaa', wet: '#cbb27d', grass: ['#b2ad68', '#9c9c5c'], meadow: '#cfbd78', high: '#8a8a50', forest: '#5f6c3c',
    rock: '#ddc28c', strata: '#bf9f68', pad: '#e8d29e',
    cliffs: 0.5, hill: 12, plateau: 6, beach: 0.07, density: 0.5, veg: { grove: 'olive', orchard: true, palms: 0.06, forest: 0.32, dry: 'maquis', cypress: 0.1 },
    terraces: true, fields: ['#dcc474', '#8ea456', '#bc8c5c'],
    F: { bush: ['#61753f', '#6d7e46'], scrub: ['#86884c', '#7c8046'], olive: ['#6c8050', '#778a58', '#65784a'] },
  },
  // The Morea and the Ionian isles: grey limestone and marble, olive groves, cypresses, steep rocky islands.
  aegean: {
    sand: '#ecdfb8', wet: '#c9b688', grass: ['#a3b06e', '#8d9d60'], meadow: '#bdba7e', high: '#7d8f59', forest: '#57703f',
    rock: '#bdb4a3', strata: '#9a9180', pad: '#e8ddc3',
    cliffs: 0.42, hill: 24, plateau: 6, beach: 0.1, density: 0.75, veg: { grove: 'olive', orchard: true, palms: 0, forest: 0.6, dry: 'maquis', cypress: 0.35 },
    terraces: true, fields: ['#d2c47c', '#8fa65a', '#b8946a'],
    F: { bush: ['#5c7442', '#68804a'], scrub: ['#828a52', '#78834c'], olive: ['#6a8052', '#758b5a', '#62784c'] },
  },
  // Crete before Candia: dry slopes under bare mountains, olives and cypresses, earth churned by the siege.
  candia: {
    sand: '#ead6a6', wet: '#c6ad7a', grass: ['#b0a862', '#9a9858'], meadow: '#cbb574', high: '#868650', forest: '#56653a',
    rock: '#c8b089', strata: '#a58e69', pad: '#dcc59a',
    cliffs: 0.32, hill: 22, plateau: 6, beach: 0.1, density: 0.6, veg: { grove: 'olive', orchard: true, palms: 0.04, forest: 0.45, dry: 'maquis', cypress: 0.3 },
    F: { bush: ['#5f7240', '#6b7c46'], scrub: ['#82844a', '#78804a'], olive: ['#6c8050', '#778a58', '#65784a'] },
  },
  // The Dardanelles: green rolling hills, oak and pine woods, cypresses by the towns.
  dardanelles: {
    sand: '#e6d8ae', wet: '#c4b385', grass: ['#93ae60', '#7e9c55'], meadow: '#acb970', high: '#698f4c', forest: '#4b7041',
    rock: '#a8a08e', strata: '#867e6d', pad: '#ddd0aa',
    cliffs: 0.18, hill: 20, plateau: 6, beach: 0.1, density: 0.9, veg: { grove: 'mixed', palms: 0, forest: 0.85, cypress: 0.3 },
    F: { canopy: ['#557e43', '#5e8848', '#4c7440'], stone: ['#4a6e44', '#557a49'] },
  },
};
for (const [id, s] of Object.entries(STYLES)) { s.id = id; s.F = { ...FLORA, ...(s.F || {}) }; }
// A style with no look of its own yet (a new world's, until its art pass) borrows one (STYLE_FALLBACK).
export const styleOf = (G) => STYLES[G.style] || STYLES[STYLE_FALLBACK[G.style]] || STYLES.port;
// Fort stone by region: grey English ragstone, honey-coloured Spanish limestone, mossy jungle stone.
const FORT_LOOK = {
  main: { stone: '#e2cfa2', dark: '#b39d6e' }, armada: { stone: '#dcc48e', dark: '#ae9563' },
  golden: { stone: '#bdb8a0', dark: '#8a8a72' }, campeche: { stone: '#d9cba8', dark: '#a8987a' },
  // The Med: Tangier's grey, whitewashed Barbary towers, Malta's honey, Aegean marble, Candia's Venetian ashlar.
  straits: { stone: '#d6cfbd', dark: '#a7a08f' }, barbary: { stone: '#eee4cc', dark: '#c4a67a' }, malta: { stone: '#e6cb93', dark: '#bf9f68' },
  aegean: { stone: '#e2dccd', dark: '#aaa293' }, candia: { stone: '#dcc595', dark: '#b39a6c' }, dardanelles: { stone: '#d2cab6', dark: '#9e9684' },
};
export const fortLook = (G) => FORT_LOOK[G.style] || FORT_LOOK[STYLE_FALLBACK[G.style]] || null;
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
// Where the woods are (0-1, a grove above 0.5): big patches from the forest noise, more of them inland.
const groveOf = (f, inland, V) => clamp(f * 1.2 + inland * 0.75 - 0.86 + 0.16 * (V.forest - 1), 0, 1);

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
  const cliffW = (a) => (cl <= 0.02 ? 0 : 1 - smooth(cl * PI - 0.12, cl * PI + 0.3, Math.abs(angDiff(a, cAt))));
  // Rolling hills along the island (a long one gets them strung down its ridge).
  const bumps = [], nb = Math.round(r(1, 2.6) * (1 + (is.hl / is.r) * 0.6));
  for (let k = 0; k < nb; k++) {
    const along = is.hl ? r(-0.8, 0.8) * is.hl : 0, a = r(0, TAU), d = r(0, 0.32) * is.r;
    bumps.push([Math.cos(is.ang) * along + Math.cos(a) * d, Math.sin(is.ang) * along + Math.sin(a) * d, is.r * r(0.28, 0.42), st.hill * hk * r(0.5, 1)]);
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
      // A rounded mountain (a dome that steepens, then flares out at its foot), lobed so it isn't a cone.
      const w = Math.pow(1 - d * d, 1.8) * (1 - 0.14 * Math.cos(Math.atan2(dy - p.y, dx - p.x) * 3 + s1));
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
  // The woods: a grove value (0-1) at a local spot t of the way out to the shore.
  const fo1 = r(0, 50), fo2 = r(0, 50);
  // An island is small: wooded wherever there is room, with a clearing or two, thinning to the beach.
  const grove = (dx, dy, t) => clamp(fbm((is.x + dx) / 50 + fo1, (is.y + dy) / 50 + fo2) * 1.2 + 0.05 + (1 - t) * 0.5 + 0.12 * (st.veg.forest - 1), 0, 1) * (1 - smooth(0.8, 0.9, t));
  return { is, h, raw, shoreR, cliffW, out, rnd: r, s1, s2, plateau, cove, grove };
}

// Builds an island's ground mesh (polar grid) with vertex colours, and its shore: shallows, surf, wet edge.
function islandMesh(rl, st, root, glass, sea, cover) {
  const { is, h, shoreR, out } = rl;
  const TS = [0, 0.12, 0.24, 0.36, 0.47, 0.57, 0.66, 0.74, 0.8, 0.85, 0.89, 0.92, 0.945, 0.963, 0.978, 0.989, 0.996, 1.0, 1.035];
  const nSeg = clamp(Math.round((TAU * is.r + 4 * is.hl) / 4.6), 48, 128);
  const nR = TS.length, pos = new Float32Array((1 + nR * nSeg) * 3), info = [];
  const put = (i, dx, y, dy) => { pos[i * 3] = dx; pos[i * 3 + 1] = y; pos[i * 3 + 2] = dy; };
  const note = (dx, dy) => info.push({ ...out, dx, dy, grove: cover(is.x + dx, is.y + dy), fx: is.x + dx, fy: is.y + dy });
  put(0, 0, h(0, 0, out), 0); note(0, 0);
  for (let k = 0; k < nR; k++) {
    for (let j = 0; j < nSeg; j++) {
      const a = (j / nSeg) * TAU, Rr = shoreR(a) * TS[k], dx = Math.cos(a) * Rr, dy = Math.sin(a) * Rr;
      put(1 + k * nSeg + j, dx, h(dx, dy, out), dy);
      note(dx, dy);
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
  const g = new THREE.Group();
  g.position.copy(m.position);
  glass.add(g);
  const edge = (u, off) => { const a = u * TAU, Rr = shoreR(a) + off; return [Math.cos(a) * Rr, Math.sin(a) * Rr]; };
  shoreline(g, edge, Math.max(96, Math.round(nSeg * 1.4)), (u) => rl.cliffW(u * TAU), sea, is.seed || is.r);
}

// The shore, seaward of the waterline, as soft translucent bands that follow it (edge(u, off): the point u of
// the way along the shore, off map units out to sea): turquoise shallows fading to the sea, a darker wet edge
// (heavier under cliffs, where it reads as the rock's foot), a broken line of surf and a fainter swell beyond.
function shoreline(parent, edge, n, cliffAt, sea, seed) {
  const pos = [], col = [], idx = [];
  const ph = (seed * 0.137) % 7;
  const wave = (u, k, o) => 0.5 + 0.5 * Math.sin(u * k + o + ph) * Math.cos(u * k * 0.53 + o * 1.7 + ph * 2.1);
  const band = (rows, y, color) => {
    // rows: [[off(u, cliff), alpha(u, cliff)], ...] from inside out.
    const base = pos.length / 3, nr = rows.length;
    for (let j = 0; j <= n; j++) {
      const u = j / n, cl = cliffAt(u);
      for (const [off, al] of rows) {
        const [x, z] = edge(u, off(u, cl));
        pos.push(x, y, z); col.push(color.r, color.g, color.b, clamp(al(u, cl), 0, 1));
      }
    }
    for (let j = 0; j < n; j++) for (let k = 0; k < nr - 1; k++) {
      const a = base + j * nr + k, b = a + nr;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  };
  const S = sea.shallow, W = sea.surf, K = sea.rim;
  // Shallows: narrow under cliffs (deep water close in), wide off a beach, wider still in clear water.
  const wide = (cl) => (1 - 0.55 * cl) * (sea.clear || 1);
  band([
    [() => -0.4, () => 0.6], [(u, c) => 6 * wide(c), () => 0.42], [(u, c) => (17 + 4 * wave(u, 9, 1)) * wide(c), () => 0.17],
    [(u, c) => (36 + 8 * wave(u, 5, 2)) * wide(c), () => 0],
  ], 0.2, S);
  // The wet edge where the water laps the land: barely there on a beach, the dark foot of a cliff.
  band([[() => -0.9, () => 0], [() => 0.1, (u, c) => 0.14 + 0.42 * c], [() => 1.8, () => 0]], 0.64, K);
  // Surf: a bright line just off the sand, its width and strength wandering, with gaps here and there.
  band([
    [() => 0.4, () => 0],
    [() => 0.8, (u, c) => (0.95 - 0.35 * c) * smooth(0.12, 0.4, wave(u, 23, 0.4))],
    [(u) => 1.5 + 1.4 * wave(u, 31, 3), (u, c) => (0.8 - 0.3 * c) * smooth(0.12, 0.4, wave(u, 23, 0.4))],
    [(u) => 2.6 + 2 * wave(u, 31, 3), () => 0],
  ], 0.4, W);
  // A fainter swell line further out, broken into long dashes.
  band([
    [(u) => 6 + 2 * wave(u, 7, 5), () => 0],
    [(u) => 6.8 + 2 * wave(u, 7, 5), (u, c) => 0.34 * smooth(0.45, 0.7, wave(u, 17, 1.2)) * (1 - 0.5 * c)],
    [(u) => 7.8 + 2.3 * wave(u, 7, 5), () => 0],
  ], 0.36, W);
  // Face up whichever way round the shore runs (the sum of the triangles' upward areas).
  let up = 0;
  for (let q = 0; q < idx.length; q += 3) {
    const a = idx[q] * 3, b = idx[q + 1] * 3, c = idx[q + 2] * 3;
    up += (pos[b + 2] - pos[a + 2]) * (pos[c] - pos[a]) - (pos[b] - pos[a]) * (pos[c + 2] - pos[a + 2]);
  }
  if (up < 0) for (let q = 0; q < idx.length; q += 3) { const tmp = idx[q + 1]; idx[q + 1] = idx[q + 2]; idx[q + 2] = tmp; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  parent.add(new THREE.Mesh(geo, flatMat()));
}
// White, fully opaque: the bake takes colour and alpha from the vertices.
let flatM = null;
const flatMat = () => (flatM = flatM || Object.assign(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }), { userData: { shared: true } }));

// Vertex colours from height, slope and what the ground is: wet and dry sand, grass (lush low, drier high, with
// meadow patches), the darker floor of the woods, rock (cliffs, steep slopes, mountain tops) banded with strata,
// packed earth under towns, dark ash in a crater.
const _c = new THREE.Color(), _d = new THREE.Color();
function paint(geo, info, st, rl) {
  const nor = geo.attributes.normal, pos = geo.attributes.position, n = pos.count;
  const col = new Float32Array(n * 3);
  const sand = C(st.sand), wet = C(st.wet), g0 = C(st.grass[0]), g1 = C(st.grass[1]), meadow = C(st.meadow), high = C(st.high);
  const floor = C(st.forest), rock = C(st.rock), strata = C(st.strata), ash = C('#57493f');
  const fieldA = C(st.fields ? st.fields[0] : st.meadow), fieldB = C(st.fields ? st.fields[1] : st.grass[0]), fieldC = C(st.fields ? st.fields[2] : st.high);
  const top = rl.plateau + st.hill * 0.55;
  for (let i = 0; i < n; i++) {
    const f = info[i], y = pos.getY(i), ny = nor.getY(i);
    // Lush low ground, drier slopes, darker high ground: the height reads even where the light is flat.
    const nz = noise2(f.fx * 0.035 + rl.s1, f.fy * 0.035 + rl.s2);
    _c.copy(g0).lerp(g1, clamp(smooth(rl.plateau, top, y) * 0.8 + (nz - 0.5) * 0.7, 0, 1));
    // Meadows: sunlit patches of paler, drier grass in the open, away from the woods.
    _c.lerp(meadow, smooth(0.54, 0.7, noise2(f.fx * 0.016 + 7.7, f.fy * 0.016 + rl.s1)) * 0.7 * (1 - smooth(0.25, 0.55, f.grove)));
    _c.lerp(high, smooth(top * 0.95, top * 1.9, y) * 0.75);
    // Small fields (terraces): a patchwork of green, stubble and ploughed earth over the open ground.
    if (st.terraces) {
      const fi = Math.floor(f.fx / 26 + 0.5 * Math.floor(f.fy / 18)), fj = Math.floor(f.fy / 18), h = hash2(fi + 3.1, fj + rl.s1);
      _c.lerp(h < 0.34 ? fieldA : h < 0.67 ? fieldB : fieldC, 0.68 * (1 - smooth(0.3, 0.6, f.grove)));
    }
    // Broad, soft swells of light and shade across the land, so a wide stretch of grass is never one flat colour.
    _c.multiplyScalar(0.9 + 0.2 * noise2(f.fx * 0.0085 + rl.s2, f.fy * 0.0085 + 3.3));
    // The floor of the woods, darker where the crowns are thickest, and a little shade round their edges.
    _c.lerp(floor, smooth(0.3, 0.6, f.grove) * 0.8);
    const inland = 1 - f.t, edge = f.s != null ? 1 - smooth(4, 14, f.s) : 1 - smooth(0.01, 0.05, inland);
    // Banks: sloping ground a shade deeper green. Only really steep ground shows rock, except on a mountain's
    // lower flanks, which stay green up to the bare top.
    _c.lerp(high, smooth(0.88, 0.62, ny) * 0.5 * (1 - smooth(0.4, 0.8, f.grove)));
    const steep = smooth(0.62, 0.44, ny) * (f.peak > 0.05 ? smooth(0.6, 0.8, f.peak) : 1);
    const rocky = clamp(Math.max(f.cliff * edge * smooth(1.2, 2.6, y), steep, smooth(0.66, 0.86, f.peak)) * (1 - smooth(0, 0.25, f.pad)), 0, 1); // a pad's banks stay green
    if (rocky > 0) {
      // Strata: soft bands of lighter and darker stone, darkest at the foot where the sea has worn it.
      const band = smooth(-0.2, 0.6, Math.sin(y * 1.15 + nz * 2.4));
      _d.copy(rock).lerp(strata, band * 0.75).lerp(strata, smooth(2.5, 0.6, y) * 0.6);
      _c.lerp(_d, rocky);
    }
    if (f.crater && f.peak > 0.8) _c.lerp(ash, smooth(0.8, 0.95, f.peak) * 0.85);
    // Sand: a soft, uneven edge to the grass, then wet sand where the water reaches.
    const sandy = (1 - f.cliff) * (1 - smooth(st.beach * 0.55, st.beach * 1.15, inland + (nz - 0.5) * 0.05));
    _c.lerp(sand, sandy);
    _c.lerp(wet, (1 - f.cliff) * smooth(1.25, 0.5, y));
    if (f.t > 1) _c.copy(f.cliff > 0.5 ? strata : wet);
    if (f.pad > 0.5 && f.padColor) _c.lerp(_d.set(f.padColor), smooth(0.5, 0.95, f.pad) * 0.3);
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
  const s1 = r(0, TAU), s2 = r(0, TAU);
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
  const forest = (mx, my) => noise2(mx / 210 + oy * 1.3, my / 210 + ox * 0.7) * 0.8 + noise2(mx / 90 + 5.1, my / 90 + oy) * 0.2;
  const grove = (mx, my, s) => groveOf(forest(mx, my), smooth(10, 130, s), st.veg) * smooth(14, 30, s);
  return { co, def, h, raw, point, tsOf, pads, cliffT, out, rnd: r, s1, s2, plateau: st.plateau, across, forest, grove, len: Math.sqrt(eL2) };
}
const bumpT = (t, at, w) => { const k = clamp((w / 2 - Math.abs(t - at)) / (w / 4), 0, 1); return k * k * (3 - 2 * k); };

const COAST_T0 = -0.25, COAST_T1 = 1.25;
function coastMesh(cr, st, root, glass, sea, cover) {
  const SS = [-2.5, -0.8, 0, 1.2, 2.5, 4, 6, 8, 10.5, 13, 16, 19.5, 23, 27, 32, 37, 43, 50, 57, 66, 75, 86, 98, 112, 128, 147, 168, 192, 220, 252, 290, 380, 520, 700];
  const T0 = COAST_T0, T1 = COAST_T1, NT = 176;
  const nS = SS.length, pos = new Float32Array((NT + 1) * nS * 3), info = [];
  for (let i = 0; i <= NT; i++) {
    const t = T0 + ((T1 - T0) * i) / NT;
    for (let k = 0; k < nS; k++) {
      const [mx, my] = cr.point(t, SS[k]), j = (i * nS + k) * 3;
      pos[j] = wx(mx); pos[j + 1] = cr.h(t, SS[k], cr.out, mx, my); pos[j + 2] = wz(my);
      info.push({ ...cr.out, dx: mx, dy: my, fx: mx, fy: my, grove: cover(mx, my) });
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
  const edge = (u, off) => { const [mx, my] = cr.point(T0 + (T1 - T0) * u, -off); return [wx(mx), wz(my)]; };
  shoreline(glass, edge, 330, (u) => cr.cliffT(T0 + (T1 - T0) * u), sea, cr.len);
}

// ---------- Vegetation ----------
// Plants go where they would grow: groves with clearings, thickest inland, the trees inside a grove close
// packed and the ones round its edge outlined so the wood reads as one mass; palms in little clumps behind the
// beach, leaning out over the sand; a few lone trees, bushes (or, on the dry Main, cactus, agave and scrub) in
// the meadows. Each region has its own mix (STYLES veg). shade(x, z, r, h) asks for a soft shadow under a
// plant, in world units.
// How many of each plant the last build made (tests and the perf report).
const PLANTS = { grove: 0, edge: 0, palm: 0, lone: 0, small: 0 };
function planter(st, ctx, shade, crownAt) {
  const F = st.F, V = st.veg, n = PLANTS;
  for (const k of Object.keys(n)) n[k] = 0;
  return {
    grove(g, x, y, z, s, r, edge, wpos) {
      n[edge ? 'edge' : 'grove']++;
      // An olive orchard: every tree outlined and shaded, in its row (the orchard reads as rows, not a wood).
      if (V.grove === 'olive') { olive(g, x, y, z, s * 0.66, r, F); shade(wpos[0], wpos[1], 3.6 * s, 5 * s, 0.3); crownAt(wpos[0], wpos[1], 4 * s); return; }
      if (V.grove === 'pine') pine(g, x, y, z, s * (edge ? 0.92 : 1.02), r, F, { ink: edge });
      else if (V.grove === 'stone' || (V.grove === 'mixed' && r() < 0.3)) stonePine(g, x, y, z, s * (edge ? 0.92 : 1), r, F, { ink: edge });
      else crown(g, x, y, z, s * (edge ? 0.94 : 1.04), r, F, { lo: !edge, ink: edge, two: edge && r() < 0.25 });
      if (edge) shade(wpos[0], wpos[1], 6.2 * s, 9 * s, 0.3);
      crownAt(wpos[0], wpos[1], 7.5 * s);
    },
    palm(g, x, y, z, s, r, lean, wpos) { n.palm++; palm(g, x, y, z, s, r, F, ctx, lean, !!V.date); shade(wpos[0], wpos[1], 5 * s, 16 * s, 0.22); crownAt(wpos[0], wpos[1], 3.5 * s); },
    lone(g, x, y, z, s, r, wpos) {
      n.lone++;
      crownAt(wpos[0], wpos[1], 6 * s);
      if (V.cypress && r() < V.cypress) { cypress(g, x, y, z, s, r, F); shade(wpos[0], wpos[1], 3 * s, 18 * s, 0.26); return; }
      if (V.grove === 'pine' && r() < 0.7) { pine(g, x, y, z, s, r, F); shade(wpos[0], wpos[1], 5.4 * s, 10 * s, 0.26); return; }
      if (V.grove === 'olive') { olive(g, x, y, z, s, r, F); shade(wpos[0], wpos[1], 5.4 * s, 7 * s, 0.28); return; }
      if (V.grove === 'stone' || (V.grove === 'mixed' && r() < 0.4)) { stonePine(g, x, y, z, s, r, F); shade(wpos[0], wpos[1], 7 * s, 13 * s, 0.28); return; }
      broadleaf(g, x, y, z, s, r, F);
      shade(wpos[0], wpos[1], 6.8 * s, 10 * s, 0.32);
    },
    small(g, x, y, z, s, r, wpos) {
      n.small++;
      const u = r();
      // The maquis: low dry scrub and darker bushes, no cactus.
      if (V.dry === 'maquis') { if (u < 0.55) scrub(g, x, y, z, s, r, F); else bush(g, x, y, z, s * 0.85, r, F); }
      else if (V.dry) {
        if (u < 0.18) cactus(g, x, y, z, s, r, F); else if (u < 0.55) agave(g, x, y, z, s, r, F); else scrub(g, x, y, z, s, r, F);
      } else bush(g, x, y, z, s, r, F);
      shade(wpos[0], wpos[1], 3.6 * s, 3 * s, 0.22);
    },
  };
}

// How thickly the crowns stand over a map point (0 open ground, 1 under the woods), from where they were
// planted: a spatial hash of soft discs.
function coverMap(list) {
  const CELL = 24, hash = new Map(), key = (i, j) => i * 73856 + j;
  for (const c of list) { const k = key(Math.floor(c[0] / CELL), Math.floor(c[1] / CELL)); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(c); }
  return (mx, my) => {
    const i0 = Math.floor(mx / CELL), j0 = Math.floor(my / CELL);
    let v = 0;
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
      const b = hash.get(key(i, j));
      if (!b) continue;
      for (const [x, y, r] of b) { const q = ((mx - x) ** 2 + (my - y) ** 2) / (r * r * 2.2); if (q < 1) v += (1 - q) * (1 - q); }
    }
    return Math.min(1, v * 0.8);
  };
}

// A jittered grid of candidate spots: one per cell, so plants never pile up or leave holes by chance.
function grid(nx, ny, cell, r) {
  const out = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) out.push([i, j, (i + 0.5 + r(-0.36, 0.36)) * cell, (j + 0.5 + r(-0.36, 0.36)) * cell]);
  return out;
}

function plantIsland(G, q, ii, st, pads, root, P, r) {
  const { is, rl } = q, V = st.veg;
  const g = new THREE.Group();
  g.position.set(wx(is.x), 0, wz(is.y));
  root.add(g);
  const cell = 8.2, ext = is.r + is.hl + 4, n = Math.ceil((2 * ext) / cell);
  const cells = grid(n, n, cell, r).map(([i, j, u, v]) => {
    const dx = u - ext, dy = v - ext, a = Math.atan2(dy, dx), t = Math.hypot(dx, dy) / rl.shoreR(a);
    const c = { i, j, dx, dy, a, t, ok: false, y: 0, gv: 0 };
    if (t > 0.94 || pads.some((p) => Math.hypot(dx - p.x, dy - p.y) < p.r + 2.5) || landmarkNear(G, is.x + dx, is.y + dy, 3)) return c;
    c.y = rl.h(dx, dy, rl.out);
    if (rl.out.peak > 0.55 || (rl.out.cliff > 0.5 && t > 0.84) || rl.out.pad > 0.8) return c;
    c.ok = true; c.gv = rl.grove(dx, dy, t);
    return c;
  });
  const at = (i, j) => (i < 0 || j < 0 || i >= n || j >= n ? null : cells[i * n + j]);
  const inGrove = (c) => c && c.ok && c.gv > 0.5 && c.t < 0.9;
  const want = st.density * (is.fort ? 0.6 : 1);
  for (const c of cells) {
    if (!c.ok) continue;
    const wp = [wx(is.x) + c.dx, wz(is.y) + c.dy], s = r(0.92, 1.08);
    if (inGrove(c)) {
      if (r() > Math.min(1, 0.55 + want * 0.45)) continue; // a few gaps, so light gets in
      const edge = ![at(c.i - 1, c.j), at(c.i + 1, c.j), at(c.i, c.j - 1), at(c.i, c.j + 1)].every(inGrove);
      if (V.orchard) {
        // An orchard stands in rows: the cell's own centre, not a jittered spot.
        const ox = (c.i + 0.5) * cell - ext, oz = (c.j + 0.5) * cell - ext;
        P.grove(g, ox, rl.h(ox, oz, null), oz, 1, r, edge, [wx(is.x) + ox, wz(is.y) + oz]);
        continue;
      }
      P.grove(g, c.dx, c.y, c.dy, s, r, edge, wp);
      continue;
    }
    if (c.t > 0.88 - st.beach * 0.9) {
      // Behind the beach: palms in clumps, leaning out to sea.
      const clump = noise2((is.x + c.dx) / 24 + 3.1, (is.y + c.dy) / 24 + ii);
      if (V.palms && clump > 0.52 - V.palms * 0.2 && r() < 0.5 + V.palms * 0.4) P.palm(g, c.dx, c.y, c.dy, s, r, -c.a, wp);
      else if (r() < 0.07 * want) P.small(g, c.dx, c.y, c.dy, s, r, wp);
      continue;
    }
    // The meadows: a lone tree now and then; bushes (or scrub and cactus) gathered in patches.
    const u = r(), patch = noise2((is.x + c.dx) / 34 + 9.3, (is.y + c.dy) / 34 + ii * 2);
    if (u < 0.05 * want) P.lone(g, c.dx, c.y, c.dy, s, r, wp);
    else if (patch > 0.58 && u < (V.dry ? 0.3 : 0.24)) P.small(g, c.dx, c.y, c.dy, s, r, wp);
    else if (V.palms && u < 0.08 * want) P.palm(g, c.dx, c.y, c.dy, s, r, null, wp);
  }
  // Boulders at the water's edge.
  for (let k = 0; k < 2 + Math.round(is.r / 18); k++) {
    const a = r(0, TAU), Rr = rl.shoreR(a) * r(0.9, 0.96), dx = Math.cos(a) * Rr, dy = Math.sin(a) * Rr;
    if (landmarkNear(G, is.x + dx, is.y + dy, 4)) continue;
    bush(g, dx, rl.h(dx, dy, null) - 1.8, dy, r(0.55, 1), r, st.F, [st.rock, st.strata]);
  }
}

function plantCoast(G, q, st, root, P, r) {
  const { cr } = q, V = st.veg, g = new THREE.Group();
  root.add(g);
  const pads = cr.pads, clear = (mx, my, pad) => !pads.some((p) => Math.hypot(mx - p.x, my - p.y) < p.r + pad) && !landmarkNear(G, mx, my, pad + 3);
  // Only what the camera can reach (the map plus its margin) is planted; far inland the trees grow bigger
  // and sparser (nobody looks closely there).
  for (const [s0, s1, cell, k] of [[12, 150, 13, 1.28], [150, 330, 21, 1.9]]) {
    const dt = cell / cr.len, nt = Math.ceil(1.24 / dt), ns = Math.ceil((s1 - s0) / cell), near = s0 < 150;
    const cells = grid(nt, ns, cell, r).map(([i, j, u, v]) => {
      const t = -0.12 + u / cr.len, s = s0 + v, c = { i, j, t, s, ok: false };
      const sMax = Math.min(330, coastDepth(cr.def, clamp(t, -0.08, 1.08)) * cr.across + 65);
      if (s > sMax) return c;
      const [mx, my] = cr.point(t, s);
      c.mx = mx; c.my = my;
      const cl = cr.cliffT(t);
      if ((cl > 0.5 && s < 16) || !clear(mx, my, 6)) return c;
      c.y = cr.h(t, s, cr.out, mx, my);
      if (cr.out.pad > 0.8) return c;
      c.ok = true; c.gv = cr.grove(mx, my, s); c.cl = cl;
      return c;
    });
    const at = (i, j) => (i < 0 || j < 0 || i >= nt || j >= ns ? null : cells[i * ns + j]);
    const inGrove = (c) => c && c.ok && c.gv > 0.5;
    for (const c of cells) {
      if (!c.ok) continue;
      const x = wx(c.mx), z = wz(c.my), wp = [x, z], s = r(0.92, 1.08) * k;
      if (inGrove(c)) {
        if (r() > Math.min(1, 0.55 + st.density * 0.45)) continue;
        // Past the near band's far side counts as more wood, so no seam of outlines runs along it.
        const nb = [at(c.i - 1, c.j), at(c.i + 1, c.j), at(c.i, c.j - 1), at(c.i, c.j + 1)].map((q2, w) => (!q2 && ((w === 3 && near) || (w === 2 && !near)) ? { ok: true, gv: 1 } : q2));
        // Far inland (past the first band) every crown is the plain kind: nobody looks closely at the edge of the chart.
        if (V.orchard) {
          // Rows of olives along the shore: each tree at its cell's centre.
          const ot = -0.12 + ((c.i + 0.5) * cell) / cr.len, os = s0 + (c.j + 0.5) * cell, [mx, my] = cr.point(ot, os);
          P.grove(g, wx(mx), cr.h(ot, os, null, mx, my), wz(my), k * 0.72, r, true, [wx(mx), wz(my)]);
          continue;
        }
        P.grove(g, x, c.y, z, s, r, near && !nb.every(inGrove), wp);
        continue;
      }
      if (c.s < 36 && c.cl < 0.5) {
        // Behind the beach: palms in clumps, leaning out over the sand.
        const clump = noise2(c.mx / 44 + 1.7, c.my / 44 + 4.2);
        if (V.palms && clump > 0.6 - V.palms * 0.16 && r() < 0.5 + V.palms * 0.25) {
          const [sx, sy] = cr.point(c.t, c.s - 10);
          P.palm(g, x, c.y, z, s, r, Math.atan2(-(sy - c.my), sx - c.mx), wp);
          continue;
        }
        if (r() < 0.05) P.small(g, x, c.y, z, s, r, wp);
        continue;
      }
      // The meadows stay open: a copse of lone trees here and there, bushes (or scrub) gathered in patches.
      const u = r(), patch = noise2(c.mx / 40 + 9.3, c.my / 40 + 2.1), copse = noise2(c.mx / 70 - 3.3, c.my / 70 + 6.1);
      if (copse > 0.68 && u < 0.2) { if (c.s < 70) P.lone(g, x, c.y, z, s, r, wp); else P.grove(g, x, c.y, z, s, r, true, wp); }
      else if (patch > 0.66 && u < (V.dry ? 0.22 : 0.16)) P.small(g, x, c.y, z, s, r, wp);
    }
  }
}

// ---------- Ground flats: streets and soft shadows ----------
// Packed-earth streets and squares (ctx.flat), then a soft dark pool under each tree, house and landmark,
// shifted the way the sun throws shadows (the weather's lift, as for the ships' shadows). Both follow the
// ground just above it, with soft edges, and all of them are one translucent bake.
function groundFlats(shadows, flats, groundAt, G, sea) {
  if (!shadows.length && !flats.length) return null;
  const pos = [], col = [], idx = [], N = 8;
  const gy = (x, z) => groundAt(x + G.W / 2, z + G.H / 2);
  const at = (x, z, c, a, y) => { pos.push(x, (y == null ? gy(x, z) : y) + 0.5, z); col.push(c.r, c.g, c.b, a); return pos.length / 3 - 1; };
  for (const { pts, w, c, a } of flats) {
    if (pts.length === 1) {
      // A square: a disc with a soft rim.
      const [cx, cz] = pts[0], o = at(cx, cz, c, a);
      for (let j = 0; j < N; j++) {
        const th = (j / N) * TAU;
        at(cx + Math.cos(th) * w * 0.8, cz + Math.sin(th) * w * 0.8, c, a);
        at(cx + Math.cos(th) * w * 1.15, cz + Math.sin(th) * w * 1.15, c, 0);
      }
      for (let j = 0; j < N; j++) {
        const i0 = o + 1 + j * 2, i1 = o + 1 + ((j + 1) % N) * 2;
        idx.push(o, i1, i0, i0, i1, i1 + 1, i0, i1 + 1, i0 + 1);
      }
      continue;
    }
    // A street: four rows (soft edge, full, full, soft edge) along the points.
    const base = pos.length / 3;
    pts.forEach(([x, z], i) => {
      const [ax, az] = pts[Math.max(0, i - 1)], [bx, bz] = pts[Math.min(pts.length - 1, i + 1)];
      const L = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / L, nz = (bx - ax) / L;
      for (const [d, k] of [[-w / 2 - 1.2, 0], [-w / 2 + 0.6, a], [w / 2 - 0.6, a], [w / 2 + 1.2, 0]]) at(x + nx * d, z + nz * d, c, k);
    });
    for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 3; k++) {
      const p = base + i * 4 + k, q = p + 4;
      idx.push(p, q, p + 1, p + 1, q, q + 1);
    }
  }
  const s = sea.shadow, [lx, lz] = sea.lift;
  for (const [x, z, rad, h, a] of shadows) {
    // A shadow is small: one height for it (the highest of three samples, so a slope never cuts into it).
    const cx = x + lx * h * 0.8, cz = z + lz * h * 0.8, ll = Math.hypot(lx, lz) || 1, ux = (lx / ll) * rad, uz = (lz / ll) * rad;
    const y = Math.max(gy(cx, cz), gy(cx + ux, cz + uz), gy(cx - ux, cz - uz)), o = at(cx, cz, s, a, y);
    for (let j = 0; j < N; j++) {
      const th = (j / N) * TAU;
      at(cx + Math.cos(th) * rad * 1.25, cz + Math.sin(th) * rad * 1.25, s, 0, y);
      idx.push(o, o + 1 + ((j + 1) % N), o + 1 + j);
    }
  }
  // Face every triangle up (the streets' run either way).
  for (let q = 0; q < idx.length; q += 3) {
    const a = idx[q] * 3, b = idx[q + 1] * 3, c = idx[q + 2] * 3;
    if ((pos[b + 2] - pos[a + 2]) * (pos[c] - pos[a]) - (pos[b] - pos[a]) * (pos[c + 2] - pos[a + 2]) < 0) { const t = idx[q + 1]; idx[q + 1] = idx[q + 2]; idx[q + 2] = t; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  const nor = new Float32Array(pos.length);
  for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setIndex(idx);
  return new THREE.Mesh(geo, flatMat());
}

// Desaturates (sat, 0-1) and tints (tint, sRGB hex) baked colours in place, in linear light.
function gradeColors(attr, { sat = 1, tint = '#ffffff' }) {
  const a = attr.array, k = attr.itemSize, t = C(tint);
  for (let i = 0; i < a.length; i += k) {
    const l = a[i] * 0.2126 + a[i + 1] * 0.7152 + a[i + 2] * 0.0722;
    a[i] = (l + (a[i] - l) * sat) * t.r; a[i + 1] = (l + (a[i + 1] - l) * sat) * t.g; a[i + 2] = (l + (a[i + 2] - l) * sat) * t.b;
  }
  attr.needsUpdate = true;
}

// The sea's colours at the shore, from the battle's weather.
function seaLook(G) {
  const w = weatherFor(battleDef(G.battle)), wa = w.water;
  return {
    shallow: C(wa.shallow || wa.light), surf: C(wa.foam), rim: C(wa.rim || wa.deep),
    shadow: C(w.shadow.color), lift: w.shadow.lift, land: w.land || null, clear: wa.clear || 1, night: !!w.night,
  };
}

// ---------- The build ----------
let lastBuild = null;
// The land's own ink: a softer, warmer dark than the ships' outlines, so the ships stay the boldest things.
const LAND_INK = '#2f2a1d';
// The land's toon light in four steps rather than the ships' three: full sun only on ground that faces it, so
// roof slopes and hillsides turned from the sun read as their own shade.
let ramp = null;
function landRamp() {
  if (ramp) return ramp;
  ramp = new THREE.DataTexture(new Uint8Array([112, 112, 112, 255, 158, 158, 158, 255, 206, 206, 206, 255, 255, 255, 255, 255]), 4, 1);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  return ramp;
}

// Builds the land for battle G: returns the group to add to the scene (and remembers what syncLand animates).
export function buildLand(G) {
  const st = styleOf(G), place = placer(G), sea = seaLook(G);
  const root = new THREE.Group(), glass = new THREE.Group();
  const life = { chimneys: [], lamps: [], flags: [], birds: [], people: [], houses: [], plumes: [], glints: [], spin: [], windows: [] };
  const swayCode = new Map();
  const reliefs = [], shadows = [], flats = [];
  const shade = (x, z, rad, h, a) => shadows.push([x, z, rad, h, a]);

  // Pads under landmarks, by host.
  const islandPads = G.islands.map((is) => (is.fort ? [{ x: 0, y: 0, r: 25, h: FORT_BASE_Y, color: null }] : []));
  const coastPads = (G.coasts || []).map(() => []);
  for (const o of G.landmarks || []) {
    const M = LANDMARKS[o.kind];
    // A town on an island bends its street round the island's curve (radius: the town's distance from the centre).
    if (o.kind === 'town') { const is = o.host && o.host.island != null ? G.islands[o.host.island] : null; o.bend = is ? Math.max(20, Math.hypot(o.x - is.x, o.y - is.y)) : 0; }
    if (!M || M.where !== 'land' || o.kind === 'peak' || o.kind === 'volcano' || !o.host) continue;
    if (o.kind === 'town' && o.host.island != null && G.islands[o.host.island].fort) continue; // a ring of houses, no pad
    const ext = M.extent(o, o.hostR), color = o.kind === 'town' || o.kind === 'church' || o.kind === 'mosque' || o.kind === 'chapel' ? st.pad
      : o.kind === 'ruin' || o.kind === 'castle' || o.kind === 'kasbah' || o.kind === 'walls' ? '#b5ab8e' : o.kind === 'siegeworks' ? '#a08a66' : null;
    const spots = o.kind === 'town' ? townCircles(o) : o.kind === 'walls' ? wallCircles(o) : [{ x: o.x, y: o.y, r: ext + 3 }];
    for (const p of spots) {
      if (o.host.island != null) { const is = G.islands[o.host.island]; islandPads[o.host.island].push({ x: p.x - is.x, y: p.y - is.y, r: p.r, color }); }
      else if (o.host.coast != null) coastPads[o.host.coast].push({ x: p.x, y: p.y, r: p.r, color });
    }
  }
  G.islands.forEach((is, ii) => reliefs.push({ kind: 'island', rl: islandRelief(G, is, ii, st, islandPads[ii]), is }));
  (G.coasts || []).forEach((co, ci) => {
    const cr = coastRelief(G, co, ci, st, place);
    for (const p of coastPads[ci]) { const [t, s] = cr.tsOf(p.x, p.y); cr.pads.push({ ...p, h: Math.max(3.4, cr.raw(t, s, null, p.x, p.y)) }); }
    reliefs.push({ kind: 'coast', cr });
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
    // A window that is lit at night (a little proud of the wall, at x, y, z in g's frame).
    window(g, x, y, z) { if (life.windows.length >= 90) return; g.updateMatrixWorld(true); const p = toWorld(g, x, y, z); life.windows.push([p.x, p.y, p.z, Math.random()]); },
    house(g, x, y, z) { g.updateMatrixWorld(true); const p = toWorld(g, x, y, z); if (ctx.town) ctx.town.push([p.x, p.y, p.z]); },
    // A soft shadow under something standing at (x, z) in g's frame: r across, h tall.
    shadow(g, x, z, r, h, a = 0.3) { g.updateMatrixWorld(true); const p = toWorld(g, x, 0, z); shade(p.x, p.z, r, h, a); },
    // A packed-earth street through pts ([x, z] in g's frame), w wide; one point makes a round square w across.
    flat(g, pts, w, color, a) { g.updateMatrixWorld(true); flats.push({ pts: pts.map(([x, z]) => { const p = toWorld(g, x, 0, z); return [p.x, p.z]; }), w, c: C(color), a }); },
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
    const face = o.kind === 'windmill' ? G.wind.base + PI : o.kind === 'skull' ? Math.atan2(-cam.fy, -cam.fx) : o.face;
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
    if (o.kind === 'mangroves') mangroveFringe(G, o, reliefs, root, ctx, st);
    if (o.kind === 'volcano') life.plumes.push([wx(o.x), groundAt(o.x, o.y) + 2, wz(o.y), o.height]);
  }

  // Plants: over each island and along each coast, clear of pads, cliff edges and peaks. Where the crowns stand
  // is remembered, so the ground can darken under them.
  const vegCtx = { ...ctx }, crowns = [];
  const P = planter(st, vegCtx, shade, (x, z, rad) => crowns.push([x + G.W / 2, z + G.H / 2, rad]));
  reliefs.forEach((q, qi) => {
    const r = rng(9173 + qi * 71);
    vegCtx.rnd = r;
    if (q.kind === 'island') plantIsland(G, q, G.islands.indexOf(q.is), st, islandPads[G.islands.indexOf(q.is)], root, P, r);
    else plantCoast(G, q, st, root, P, r);
  });
  // The ground itself, now that it knows where the woods are.
  const cover = coverMap(crowns);
  for (const q of reliefs) {
    if (q.kind === 'island') islandMesh(q.rl, st, root, glass, sea, cover);
    else coastMesh(q.cr, st, root, glass, sea, cover);
  }
  const sh = groundFlats(shadows, flats, groundAt, G, sea);
  if (sh) glass.add(sh);

  // Shoals and reefs (render/terrain.js) join the same bake.
  let seed = 7;
  for (const c of G.shoals || []) if (!c.tidal) glass.add(buildShoal(c, rng(seed++ * 31 + Math.round(c.x + c.y)))); // tidal ones: render/flow.js
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
  const IDX = { indexed: true };
  const still = bakeStatic(root, (o) => !!(o.userData.sway != null || o.userData.spin), null, null, IDX);
  const moving = bakeStatic(root, (o) => o.isMesh && !swayOf(o), null, tagFor, IDX);
  const keep = new Set([...sharedGeos(), ...sharedTerrainGeos(), ...floraGeos()]);
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (!keep.has(o.geometry)) o.geometry.dispose();
    if (!o.material.userData.shared && o.material !== R.inkMat && o.material !== R.vcToon) o.material.dispose();
  });
  const inkMat = new THREE.MeshBasicMaterial({ color: LAND_INK, side: THREE.BackSide });
  const out = new THREE.Group();
  out.userData.land = true;
  // The weather's grade on the land: a storm greys and cools it, fog washes it out, a sunset warms it.
  if (sea.land) for (const g of [still.solid, moving.solid]) if (g) gradeColors(g.attributes.color, sea.land);
  if (still.solid) out.add(new THREE.Mesh(still.solid, toon('#ffffff', { vertexColors: true, gradientMap: landRamp() })));
  if (still.ink) out.add(new THREE.Mesh(still.ink, inkMat));
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
  lastBuild = { G, mats, life, pools, groundAt, lee, night: sea.night };
  return out;
}

// The ground a town covers, as circles in map units: along its street (render/landmarks.js townLayout), or
// round the middle of a fishing village.
const circles = new WeakMap();
function townCircles(o) {
  let out = circles.get(o);
  if (out && out.x === o.x && out.y === o.y && out.bend === o.bend) return out;
  const L = townLayout(o), c = Math.cos(o.face), s = Math.sin(o.face);
  if (o.look === 'village') out = [{ x: o.x, y: o.y, r: L.ext + 3 }];
  else {
    out = [];
    const n = Math.max(2, Math.ceil(L.half / 9));
    for (let i = -n; i <= n; i++) {
      for (const off of L.back ? [-1.5, -21] : [-1.5]) {
        if (off < -2 && Math.abs(i / n) > 0.85) continue;
        const [x, z] = L.at(off, (L.half * i) / n);
        out.push({ x: o.x + c * x - s * z, y: o.y + s * x + c * z, r: 14.5 });
      }
    }
  }
  Object.assign(out, { x: o.x, y: o.y, bend: o.bend });
  circles.set(o, out);
  return out;
}

// The ground a bastioned wall covers: circles along its length (local z), a little to seaward.
function wallCircles(o) {
  const ax = Math.cos(o.face + PI / 2), ay = Math.sin(o.face + PI / 2), sx = Math.cos(o.face) * 4, sy = Math.sin(o.face) * 4;
  const n = Math.max(2, Math.ceil(o.length / 18));
  return Array.from({ length: n + 1 }, (_, i) => { const t = (i / n - 0.5) * o.length; return { x: o.x + ax * t + sx, y: o.y + ay * t + sy, r: 15 }; });
}

const landmarkNear = (G, x, y, pad) => (G.landmarks || []).some((o) => {
  const M = LANDMARKS[o.kind];
  if (!M || o.kind === 'peak' || o.kind === 'volcano' || o.kind === 'mangroves') return false;
  if (o.kind === 'walls') return wallCircles(o).some((q) => Math.hypot(x - q.x, y - q.y) < q.r + pad);
  if (o.kind === 'town' && !o.ring) return townCircles(o).some((q) => Math.hypot(x - q.x, y - q.y) < q.r + pad);
  if (o.kind === 'town' && o.ring) {
    // Strung round a fort: the band of the island its arc of houses covers.
    const is = G.islands[o.host.island], d = Math.hypot(x - is.x, y - is.y), span = Math.min(PI * 0.9, (o.houses * 11) / o.ringR);
    return Math.abs(d - o.ringR) < RING + 3 + pad && Math.abs(angDiff(Math.atan2(y - is.y, x - is.x), o.host.a)) < span / 2 + (8 + pad) / o.ringR;
  }
  const e = o.kind === 'town' && o.ring ? RING + 4 : o.kind === 'harbour' ? 14 : o.kind === 'stacks' ? 22 : M.extent(o, o.hostR);
  return Math.hypot(x - o.x, y - o.y) < e + pad;
});

// Mangroves along an island's shore (span degrees round `at`) or a stretch of coast.
function mangroveFringe(G, o, reliefs, root, ctx, st) {
  const r = ctx.rnd;
  if (o.host.island != null) {
    const q = reliefs.find((x) => x.kind === 'island' && x.is === G.islands[o.host.island]), { is, rl } = q;
    const span = ((o.span || 90) * PI) / 180, R0 = is.r;
    const g = new THREE.Group();
    g.position.set(wx(is.x), 0, wz(is.y));
    root.add(g);
    const n = Math.max(3, Math.round((span * R0) / 7.5));
    for (let i = 0; i < n; i++) {
      const a = o.host.a + (i / (n - 1) - 0.5) * span + r(-0.04, 0.04), Rr = rl.shoreR(a) * r(0.87, 0.95), dx = Math.cos(a) * Rr, dy = Math.sin(a) * Rr;
      if (landmarkNear(G, is.x + dx, is.y + dy, 2) && !nearKind(G, is.x + dx, is.y + dy, 'mangroves')) continue;
      mangrove(g, dx, Math.max(0.6, rl.h(dx, dy, null)), dy, r(0.85, 1.1), r, st.F);
    }
  } else if (o.host.coast != null) {
    const q = reliefs.filter((x) => x.kind === 'coast')[o.host.coast], cr = q.cr, span = o.span || 0.3;
    const g = new THREE.Group();
    root.add(g);
    for (let t = o.host.t - span / 2; t < o.host.t + span / 2; t += r(0.012, 0.02)) {
      const s = r(1, 7), [mx, my] = cr.point(t, s);
      mangrove(g, wx(mx), Math.max(0.6, cr.h(t, s, null, mx, my)), wz(my), r(0.85, 1.15), r, st.F);
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
    solid: hook(toon('#ffffff', { vertexColors: true, gradientMap: landRamp() })),
    ink: hook(new THREE.MeshBasicMaterial({ color: LAND_INK, side: THREE.BackSide })),
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
  birds.frustumCulled = false; birds.count = 0; birds.renderOrder = 3; birds.visible = false;
  const people = new THREE.InstancedMesh(personGeometry(), personMaterial(), PEOPLE);
  people.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  people.setColorAt(0, new THREE.Color(1, 1, 1));
  people.frustumCulled = false; people.count = 0; people.visible = false;
  const scorch = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), toon('#2c231c', {}), SCORCH);
  scorch.frustumCulled = false; scorch.count = 0; scorch.visible = false;
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
    for (let k = 0; k < 12 && np < 990; k++) {
      const t = (clock * 0.06 + k / 12) % 1, sz = (1.8 + t * 8.5) * (t < 0.12 ? t / 0.12 : 1) * (t > 0.8 ? (1 - t) / 0.2 : 1);
      setInst(P.puff, np, x + wdx * t * t * 110 + Math.sin(k * 3.1) * 3 * t, y + 3 + t * 80, z + wdz * t * t * 110 + Math.cos(k * 2.3) * 3 * t, sz, sz * 0.8, sz, k, t, 0);
      P.puff.setColorAt(np++, t < 0.22 || k % 4 === 0 ? C3.soot : C3.shellSmoke);
    }
    if (ng < 398) { const f = 0.75 + 0.25 * Math.sin(clock * 3.1); setInst(P.glow, ng, x, y - 0.5, z, 2.6 * f, 0.8, 2.6 * f); P.glow.setColorAt(ng++, C3.ember); }
  }
  // Lighthouse and castle lamps: a warm light that pulses slowly.
  for (const [x, y, z, ph] of life.lamps) {
    if (ng >= 399) break;
    const f = 2.6 + 0.6 * Math.sin(clock * 2.2 + ph);
    setInst(P.glow, ng, x, y, z, f, f * 1.1, f); P.glow.setColorAt(ng++, C3.flame);
  }
  // Night: the town's windows are lit, a warm point each, flickering now and then.
  if (L.night) {
    for (const [x, y, z, ph] of life.windows) {
      if (ng >= 396) break;
      const f = 0.9 + 0.1 * Math.sin(clock * 3 + ph * 40) * (ph > 0.8 ? 1 : 0);
      setInst(P.glow, ng, x, y, z, 1.25 * f, 1.5 * f, 1.25 * f); P.glow.setColorAt(ng++, C3.flash);
    }
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

  // Carpenters at work on a ship in a harbour: hammers glinting on her deck.
  for (const sh of G.ships) {
    if (sh.yardAt == null || G.t - sh.yardAt > 0.25 || ng > 396) continue;
    for (let k = 0; k < 2; k++) {
      const ph = clock * 6 + k * 2.1 + sh.id, a = (k ? 0.25 : -0.2) * sh.L;
      if (Math.sin(ph) < 0.6) continue;
      setInst(P.glow, ng, wx(sh.x + Math.cos(sh.h) * a), 10 + Math.sin(ph) * 2, wz(sh.y + Math.sin(sh.h) * a), 1.4, 1.4, 1.4); P.glow.setColorAt(ng++, C3.glint);
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
  // Hidden while empty: nothing to draw, and their shaders needn't compile until they're wanted.
  bp.count = nb; bp.visible = nb > 0;
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
  pp.count = nq; pp.visible = nq > 0;
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
    if (gy < 0.3) continue; // came down at the water's edge: no mark on the sea
    sp.setMatrixAt(ns++, _M.compose(_P.set(wx(mx), gy + 0.1, wz(my)), _Q, _S.set(r, 0.35, r * 0.8)));
  }
  sp.count = ns; sp.visible = ns > 0;
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
export const landLife = () => (lastBuild ? { birds: lastBuild.life.birds.length, people: lastBuild.life.people.length, chimneys: lastBuild.life.chimneys.length, lamps: lastBuild.life.lamps.length, plumes: lastBuild.life.plumes.length, plants: { ...PLANTS } } : null);
// What the living details are drawing right now (tests).
export const landStats = () => (lastBuild ? { birds: lastBuild.pools.birds.count, people: lastBuild.pools.people.count, scorch: lastBuild.pools.scorch.count, detail: +landDetail().toFixed(2) } : null);
