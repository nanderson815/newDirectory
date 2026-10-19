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
function ring(c, k0, k1, wob) {
  const sh = capsulePath(c, k1, wob);
  sh.holes.push(capsulePath(c, k0, wob, new THREE.Path(), true));
  return sh;
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
  flat(g, capsulePath(c, 1.28, wob), 0x8fdde6, 0.32, 0.1);    // soft halo where the bottom shelves up
  flat(g, capsulePath(c, 1.0, wob), 0xa9efe4, 0.62, 0.14);    // the shallows proper: light turquoise
  flat(g, capsulePath(c, 0.72, wob), 0xd2f6e6, 0.5, 0.18);    // paler toward the middle
  flat(g, ring(c, 0.95, 1.04, wob), 0xf1dca0, 0.75, 0.22);    // the sandy fringe
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
  flat(g, capsulePath(c, 1.6, wob), 0x8fe3dc, 0.5, 0.1);     // pale water over the coral round it
  flat(g, capsulePath(c, 1.0, wob), 0x2e6f72, 0.55, 0.13);    // dark rock just under the surface
  // Breakers: a broken white ring of surf along the edge, and a second fainter one outside it.
  flat(g, ring(c, 1.0, 1.16, [wob[0] * 2, wob[1], wob[2] * 2, wob[3]]), 0xffffff, 0.8, 0.3);
  flat(g, ring(c, 1.28, 1.36, [wob[0], wob[1] + 1, wob[2], wob[3] + 2]), 0xffffff, 0.45, 0.28);
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
    const foam = flat(g, capsulePath({ x: 0, y: 0, r: s * 1.8, hl: 0, ang: 0 }, 1, [0.14, r(0, TAU), 0.08, r(0, TAU)]), 0xffffff, 0.7, 0.32);
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
