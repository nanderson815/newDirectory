import * as THREE from 'three';
import { TAU, PI, rand, clamp } from '../util.js';
import { R, toon, withOutline } from './gl.js';
import { wx, wz } from './camera.js';
import { bakeStatic } from './models.js';
import { liftedExtrude } from './shapes.js';
import { capsuleRadius, coastDepth, coastPoint } from '../sim/terrain.js';
import { placer } from '../sim/battle.js';

// The battle's geography beyond plain islands (src/sim/terrain.js): pale shoals with a sandy rim, reefs of
// rock and surf, and coastlines with beaches, terraced jungle and palms. Everything is built once per battle and
// baked (bakeStatic) into one toon mesh, one ink-outline mesh and one translucent mesh: three draw calls in all.

// Which masts a ship loses as they go down (render/scene.js), aftmost first; the main mast, flying her flag, never.
const lostCache = {};
export function lostMasts(n, main) {
  const k = n * 4 + main;
  return lostCache[k] || (lostCache[k] = Array.from({ length: n }, (_, i) => n - 1 - i).filter((i) => i !== main));
}

// A seeded random so a battle's dressing doesn't change when the scene is rebuilt (rotating the phone).
function rng(seed) {
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
function buildShoal(c, r) {
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
const TREE = ['#3f9a3c', '#4aa13a', '#358a35', '#52ad40'];
let rockGeos = null;
function buildReef(c, r) {
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

// ---------- Coasts ----------
let palmGeos = null;
function palm(r) {
  palmGeos = palmGeos || { leaf: new THREE.SphereGeometry(1, 6, 4), nut: new THREE.SphereGeometry(1.4, 5, 4) };
  const s = r(0.85, 1.15), h = 24 * s;
  const g = new THREE.Group();
  g.rotation.y = r(0, TAU);
  const tilt = new THREE.Group();
  tilt.rotation.z = r(0.08, 0.28);
  g.add(tilt);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.1, h, 6), toon('#9a6a3a'));
  trunk.position.y = h / 2;
  withOutline(trunk, 0.2);
  tilt.add(trunk);
  for (let i = 0; i < 6; i++) {
    const arm = new THREE.Group();
    arm.rotation.y = (i / 6) * TAU + r(-0.2, 0.2);
    arm.position.y = h;
    const leaf = new THREE.Mesh(palmGeos.leaf, toon(i % 2 ? '#5cbf4c' : '#49a83d'));
    leaf.scale.set(9.5 * s, 1.3, 3.4 * s);
    leaf.position.set(7.5 * s, -2, 0);
    leaf.rotation.z = -0.35;
    withOutline(leaf, 0.1);
    arm.add(leaf);
    tilt.add(arm);
  }
  for (let i = 0; i < 3; i++) {
    const nut = new THREE.Mesh(palmGeos.nut, toon('#6b4220'));
    nut.position.set(Math.cos(i * 2.1) * 1.7, h - 1.5, Math.sin(i * 2.1) * 1.7);
    tilt.add(nut);
  }
  return g;
}

function buildCoast(G, co, r) {
  const g = new THREE.Group();
  const place = placer(G), def = co.def;
  // Map units across the coast's edge, to turn offsets in units into depth fractions.
  const a0 = place(...coastPoint(def, 0.5, 0)), a1 = place(...coastPoint(def, 0.5, 1));
  const across = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
  const T0 = -0.7, T1 = 1.7, N = 170;
  const ts = Array.from({ length: N + 1 }, (_, i) => T0 + ((T1 - T0) * i) / N);
  const depthAt = (t) => coastDepth(def, clamp(t, -0.08, 1.08));
  // The land seaward of the shore by `off` units (negative: inland), closed off far beyond the map edge.
  const shape = (off) => {
    const sh = new THREE.Shape();
    ts.forEach((t, i) => {
      const [x, y] = place(...coastPoint(def, t, depthAt(t) + off / across));
      if (i === 0) sh.moveTo(wx(x), -wz(y)); else sh.lineTo(wx(x), -wz(y));
    });
    for (const t of [T1, T0]) { const [x, y] = place(...coastPoint(def, t, -2)); sh.lineTo(wx(x), -wz(y)); }
    return sh;
  };
  const shore = (t, off) => { const [x, y] = place(...coastPoint(def, t, depthAt(t) - off / across)); return [wx(x), wz(y)]; };
  // Shallows and surf, as round an island.
  flat(g, shape(34), 0x9fe6f0, 0.45, 0.2);
  flat(g, shape(17), 0xcdf5f7, 0.6, 0.3);
  flat(g, shape(7), 0xffffff, 0.9, 0.4);
  // Beach, grass and a raised jungle terrace, each an extruded slab like an island's.
  // A slab this big can't take the usual scaled outline, so its ink rim is a slightly larger slab drawn
  // inside-out (the ink material renders back faces): it shows only where it pokes out past the edge.
  const slab = (off, h, bevel, y, color, ink) => {
    const m = new THREE.Mesh(liftedExtrude(shape(off), h, bevel, 0), toon(color));
    m.position.y = y;
    g.add(m);
    if (!ink) return;
    const o = new THREE.Mesh(liftedExtrude(shape(off + ink), h + 0.6, bevel, 0), R.inkMat);
    o.position.y = y - 0.3;
    g.add(o);
  };
  slab(-1, 5, 3.5, -1, '#f2d68f', 1.6);
  slab(-24, 5, 2.5, 5, '#7cc957', 0);
  slab(-66 - r(0, 10), 8, 3, 9, '#62b046', 1.2);
  // Dressing along the shore: palms behind the beach, bushes on the grass, rocks at the water's edge.
  const bushGeo = new THREE.SphereGeometry(1, 7, 5);
  for (let t = -0.06; t < 1.06; t += r(0.025, 0.05)) {
    const roll = r();
    if (roll < 0.55) {
      const [x, z] = shore(t, r(30, 48));
      const p = palm(r);
      p.position.set(x, 9, z);
      g.add(p);
    } else if (roll < 0.8) {
      const [x, z] = shore(t, r(32, 56)), s = r(6, 11);
      const bush = new THREE.Mesh(bushGeo, toon(roll < 0.68 ? '#58b443' : '#4aa13a'));
      bush.scale.set(s, s * 0.7, s);
      bush.position.set(x, 11, z);
      withOutline(bush, 0.07);
      g.add(bush);
    }
    if (r() < 0.22) {
      const [x, z] = shore(t, r(-14, -4)), s = r(3, 6.5);
      rockGeos = rockGeos || [new THREE.DodecahedronGeometry(1, 0), new THREE.IcosahedronGeometry(1, 0)];
      const rock = new THREE.Mesh(rockGeos[0], toon(ROCK[Math.floor(r(0, ROCK.length))]));
      rock.scale.setScalar(s);
      rock.position.set(x, 0.5, z);
      rock.rotation.set(r(0, TAU), r(0, TAU), 0);
      withOutline(rock, 0.12);
      g.add(rock);
    }
  }
  // Jungle on the terrace: clumps of round canopies, set back from the beach, thickening inland.
  for (let t = -0.06; t < 1.06; t += r(0.03, 0.06)) {
    for (let row = 0; row < 3; row++) {
      if (r() < 0.25 + row * 0.1) continue;
      const [x, z] = shore(t + r(-0.02, 0.02), 84 + row * 52 + r(-12, 12)), k = r(3, 5);
      for (let i = 0; i < k; i++) {
        const s = r(9, 16), a = r(0, TAU), d = r(0, 16);
        const tree = new THREE.Mesh(bushGeo, toon(TREE[Math.floor(r(0, TREE.length))]));
        tree.scale.set(s, s * 0.72, s);
        tree.position.set(x + Math.cos(a) * d, 17 + r(0, 4), z + Math.sin(a) * d);
        withOutline(tree, 0.06);
        g.add(tree);
      }
    }
  }
  return g;
}

// Builds the whole battle's extra geography; null when there is none.
export function buildTerrain(G) {
  const shoals = G.shoals || [], reefs = G.reefs || [], coasts = G.coasts || [];
  if (!shoals.length && !reefs.length && !coasts.length) return null;
  const root = new THREE.Group();
  let seed = 7;
  for (const c of shoals) root.add(buildShoal(c, rng(seed++ * 31 + Math.round(c.x + c.y))));
  for (const c of reefs) root.add(buildReef(c, rng(seed++ * 37 + Math.round(c.x * 3 + c.y))));
  for (const c of coasts) root.add(buildCoast(G, c, rng(seed++ * 41 + Math.round(c.def.depth * 1000))));
  const b = bakeStatic(root);
  const keep = new Set([...(rockGeos || []), ...(palmGeos ? [palmGeos.leaf, palmGeos.nut] : [])]);
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (!keep.has(o.geometry)) o.geometry.dispose();
    if (!o.material.userData.shared && o.material !== R.inkMat) o.material.dispose();
  });
  const out = new THREE.Group();
  if (b.solid) out.add(new THREE.Mesh(b.solid, R.vcToon));
  if (b.ink) out.add(new THREE.Mesh(b.ink, R.inkMat));
  if (b.glass) {
    // Under ship shadows and foam (renderOrder 1 and 2), over the sea.
    const m = new THREE.Mesh(b.glass, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
    m.renderOrder = 0.5;
    out.add(m);
  }
  return out;
}
