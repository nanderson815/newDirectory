import * as THREE from 'three';
import { TAU, PI, rand, clamp } from '../util.js';
import { toon, withOutline } from './gl.js';
import { wx, wz } from './camera.js';
import { capsuleRadius } from '../sim/terrain.js';

// The sea's hazards (src/sim/terrain.js): pale shoals with a sandy rim, and reefs of rock and surf. render/land.js
// builds them with the islands and coasts, once per battle, and bakes them all together.

// Which masts a ship loses as they go down (render/scene.js), aftmost first; the main mast, flying her flag, never.
const lostCache = {};
export function lostMasts(n, main) {
  const k = n * 4 + main;
  return lostCache[k] || (lostCache[k] = Array.from({ length: n }, (_, i) => n - 1 - i).filter((i) => i !== main));
}

// A seeded random so a battle's dressing doesn't change when the scene is rebuilt (rotating the phone).
export function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return (lo = 0, hi = 1) => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return lo + (((t ^ (t >>> 14)) >>> 0) / 4294967296) * (hi - lo); };
}

// Flat shapes lie in three's x/z plane: a map offset (dx, dy) is shape point (dx, -dy) before rotateX(-PI/2).
const flatMat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
function flat(group, shape, color, opacity, y) {
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 12).rotateX(-PI / 2), flatMat(color, opacity));
  m.position.y = y;
  group.add(m);
  return m;
}
// A capsule outline round its centre, k times its size, with a gentle wobble so it reads as natural.
function capsulePath(c, k, wob, path = new THREE.Shape(), reverse = false) {
  const n = c.hl ? 48 : 36;
  for (let j = 0; j <= n; j++) {
    const i = reverse ? n - j : j, a = (i / n) * TAU;
    const w = 1 + wob[0] * Math.sin(3 * a + wob[1]) + wob[2] * Math.sin(5 * a + wob[3]);
    const r = capsuleRadius(c, a) * k * w, x = Math.cos(a) * r, y = -Math.sin(a) * r;
    if (j === 0) path.moveTo(x, y); else path.lineTo(x, y);
  }
  return path;
}
// Soft rings: rows [k, colour, alpha] from the middle out (k times the capsule's wobbled radius), the colour and
// alpha blending smoothly between rows, so the water deepens gradually instead of in hard steps. brk(a) (0-1)
// can break a row's alpha up round the outline (surf).
let softMat = null;
function soft(group, c, rows, wob, y, brk, segs) {
  const n = segs || (c.hl ? 64 : 48), pos = [], col = [], idx = [], m = rows.length;
  const cols = rows.map(([, hex]) => new THREE.Color(hex));
  for (let j = 0; j <= n; j++) {
    const a = (j / n) * TAU, w = 1 + wob[0] * Math.sin(3 * a + wob[1]) + wob[2] * Math.sin(5 * a + wob[3]), R = capsuleRadius(c, a) * w;
    rows.forEach(([k, , al, broken], i) => { pos.push(Math.cos(a) * R * k, y, Math.sin(a) * R * k); col.push(cols[i].r, cols[i].g, cols[i].b, al * (broken && brk ? brk(a) : 1)); });
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < m - 1; i++) { const p = j * m + i, q = p + m; idx.push(p, q, p + 1, p + 1, q, q + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  softMat = softMat || Object.assign(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }), { userData: { shared: true } });
  const mesh = new THREE.Mesh(g, softMat);
  group.add(mesh);
  return mesh;
}
// A random point inside a capsule (map offset from its centre), within `k` of its radius.
function inside(c, k, r) {
  const t = c.hl ? r(-c.hl, c.hl) : 0, a = r(0, TAU), d = Math.sqrt(r(0, 1)) * c.r * k;
  return [Math.cos(c.ang) * t + Math.cos(a) * d, Math.sin(c.ang) * t + Math.sin(a) * d];
}

// ---------- Shoals ----------
export function buildShoal(c, r) {
  const g = new THREE.Group();
  g.position.set(wx(c.x), 0, wz(c.y));
  const wob = [r(0.04, 0.08), r(0, TAU), r(0.02, 0.05), r(0, TAU)];
  // The shallows: turquoise over the sand, paler toward the middle, fading out where the bottom shelves away;
  // a soft sandy rim marks the edge to keep off.
  soft(g, c, [[0, '#d6f6e8', 0.55], [0.7, '#b9f0e3', 0.55], [1, '#9fe6dd', 0.5], [1.18, '#8fdde6', 0.22], [1.42, '#8fdde6', 0]], wob, 0.12);
  soft(g, c, [[0.88, '#f1dca0', 0], [0.99, '#f1dca0', 0.62], [1.09, '#f1dca0', 0]], wob, 0.2);
  // A few sandbars just awash.
  const bars = Math.round(2 + (c.r + c.hl) / 30);
  for (let i = 0; i < bars; i++) {
    const [x, y] = inside(c, 0.55, r), bar = { x: 0, y: 0, r: r(5, 10), hl: r(4, 14), ang: r(0, TAU) };
    const m = flat(g, capsulePath(bar, 1, [0.1, r(0, TAU), 0.05, r(0, TAU)]), 0xf4e2ad, 0.85, 0.24);
    m.position.x = x; m.position.z = y;
  }
  return g;
}

// ---------- Reefs ----------
const ROCK = ['#7d7468', '#8b8f96', '#6f6a63', '#9a9187'];
const CORAL = ['#e3826a', '#f0a35e', '#d9677a'];
let rockGeos = null;
export function buildReef(c, r) {
  const g = new THREE.Group();
  g.position.set(wx(c.x), 0, wz(c.y));
  const wob = [r(0.05, 0.1), r(0, TAU), r(0.03, 0.06), r(0, TAU)];
  // Dark rock just under the surface, pale water over the coral round it fading into the sea.
  soft(g, c, [[0, '#2e6f72', 0.5], [0.92, '#2e6f72', 0.5], [1.12, '#8fe3dc', 0.45], [1.7, '#8fe3dc', 0]], wob, 0.1);
  // Breakers: a white ring of surf along the edge, thick and thin by turns, and a fainter broken one outside it.
  const ph = r(0, TAU), brk = (a) => 0.55 + 0.45 * Math.sin(a * 5 + ph) * Math.sin(a * 3 - ph);
  soft(g, c, [[0.95, '#ffffff', 0], [1.05, '#ffffff', 0.9, true], [1.2, '#ffffff', 0]], [wob[0] * 2, wob[1], wob[2] * 2, wob[3]], 0.3, brk);
  soft(g, c, [[1.24, '#ffffff', 0], [1.31, '#ffffff', 0.55, true], [1.39, '#ffffff', 0]], [wob[0], wob[1] + 1, wob[2], wob[3] + 2], 0.28, (a) => Math.max(0, Math.sin(a * 6 + ph * 2)));
  rockGeos = rockGeos || [new THREE.DodecahedronGeometry(1, 0), new THREE.IcosahedronGeometry(1, 0)];
  const n = Math.round(5 + (c.r * (c.r + 2 * c.hl)) / 90);
  for (let i = 0; i < n; i++) {
    const [x, y] = inside(c, 0.9, r), s = r(3.5, 8.5);
    const rock = new THREE.Mesh(rockGeos[i % 2], toon(ROCK[i % ROCK.length]));
    rock.scale.set(s * r(0.9, 1.4), s * r(0.7, 1.1), s * r(0.9, 1.3));
    rock.position.set(x, s * 0.3, y);
    rock.rotation.set(r(0, TAU), r(0, TAU), 0);
    withOutline(rock, 0.14);
    g.add(rock);
    // White water round each rock.
    const foam = soft(g, { x: 0, y: 0, r: s * 1.8, hl: 0, ang: 0 }, [[0, '#ffffff', 0.75], [0.7, '#ffffff', 0.6], [1.1, '#ffffff', 0]], [0.14, r(0, TAU), 0.08, r(0, TAU)], 0.32, null, 16);
    foam.position.x = x; foam.position.z = y;
    if (r() < 0.5) {
      const [cx, cy] = inside(c, 1.1, r), cs = r(1.8, 3.2);
      const coral = new THREE.Mesh(rockGeos[0], toon(CORAL[i % CORAL.length]));
      coral.scale.set(cs, cs * 0.55, cs);
      coral.position.set(cx, 0.3, cy);
      g.add(coral);
    }
  }
  return g;
}

// Geometry the reefs share across battles (kept when the land is disposed).
export const sharedTerrainGeos = () => rockGeos || [];
