import * as THREE from 'three';
import { TAU, PI } from '../util.js';
import { toon, withOutline } from './gl.js';
import { wx, wz } from './camera.js';
import { buildShoal, rng } from './terrain.js';
import { capsuleRadius, TIDE } from '../sim/terrain.js';

// The sea that moves (src/sim/flow.js), drawn once per battle and animated each frame:
//   currents   pale streaks drifting along the set of the water, thickest where it runs hardest
//   tide       tidal shoals (not baked with the rest of the land): the shallows pale and sandbars show as the
//              water falls, and fade into blue as it covers them
//   booms      a chain of floating logs across a harbour mouth that swings open when it breaks
// buildSeaMarks(G) returns a group for the scene (or null); syncSeaMarks(G, clock) animates it.

let last = null;
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- Currents ----------
function currentMesh(G) {
  if (!G.currents || !G.currents.length) return null;
  const pos = [], dir = [], fade = [], idx = [];
  for (const c of G.currents) {
    // A grid over the capsule in its own frame: along its axis, across it.
    const NU = c.hl ? 26 : 14, NV = 9, ux = Math.cos(c.ang), uy = Math.sin(c.ang), base = pos.length / 3;
    const half = c.hl + c.r;
    for (let i = 0; i <= NU; i++) {
      const a = -half + (2 * half * i) / NU;
      for (let j = 0; j <= NV; j++) {
        const b = -c.r + (2 * c.r * j) / NV;
        const x = c.x + ux * a - uy * b, y = c.y + uy * a + ux * b;
        // Strength: as the sim's (full along the core, nothing at the edge).
        const core = Math.max(0, Math.abs(a) - c.hl), d = Math.hypot(core, b);
        pos.push(wx(x), 0.34, wz(y));
        dir.push(c.fx, c.fy, c.speed);
        fade.push(smooth(0, 0.45, (c.r - d) / c.r));
      }
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
      const p = base + i * (NV + 1) + j, q = p + NV + 1;
      idx.push(p, q, p + 1, p + 1, q, q + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 3));
  g.setAttribute('aFade', new THREE.Float32BufferAttribute(fade, 1));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uCol: { value: new THREE.Color('#e9fbff') } },
    vertexShader: `
      attribute vec3 aDir; attribute float aFade;
      varying vec3 vDir; varying float vFade; varying vec2 vP;
      void main(){ vDir = aDir; vFade = aFade; vP = position.xz; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uT; uniform vec3 uCol;
      varying vec3 vDir; varying float vFade; varying vec2 vP;
      float hash(float n){ return fract(sin(n) * 43758.5453); }
      void main(){
        vec2 d = normalize(vDir.xy); vec2 n = vec2(-d.y, d.x);
        float along = dot(vP, d), across = dot(vP, n);
        // Lanes of streaks across the flow, each with its own length and phase, sliding downstream.
        float lane = floor(across / 11.0), r = hash(lane * 1.7 + 3.1);
        float inLane = 1.0 - smoothstep(0.08, 0.32, abs(fract(across / 11.0) - 0.5));
        float len = 38.0 + r * 46.0;
        float s = fract((along - uT * vDir.z * 1.1) / len + r * 7.0);
        float dash = smoothstep(0.0, 0.12, s) * (1.0 - smoothstep(0.32 + r * 0.2, 0.55 + r * 0.2, s));
        float a = dash * inLane * vFade * (0.22 + 0.16 * step(0.55, r));
        if (a < 0.01) discard;
        gl_FragColor = vec4(uCol, a);
      }`,
    transparent: true, depthWrite: false,
  }));
  m.renderOrder = 0.7;
  m.frustumCulled = false;
  return m;
}

// ---------- Tidal shoals ----------
// Each tidal shoal is drawn like any other (render/terrain.js) on materials of its own, whose opacity follows
// the tide, plus a patch of dry sand that shows as it uncovers.
function tidalShoals(G) {
  const list = (G.shoals || []).filter((c) => c.tidal);
  if (!list.length) return null;
  const grp = new THREE.Group(), mats = [], sand = [];
  list.forEach((c, i) => {
    const g = buildShoal(c, rng(311 + i * 17 + Math.round(c.x)));
    g.traverse((o) => {
      if (!o.isMesh) return;
      const old = o.material;
      o.material = old.clone();
      if (!old.userData.shared) old.dispose();
      o.material.userData = { base: o.material.opacity };
      mats.push(o.material);
    });
    grp.add(g);
    // Dry sand: the bar as it stands out of the water at low tide.
    const sh = new THREE.Shape(), n = c.hl ? 40 : 28;
    for (let k = 0; k <= n; k++) {
      const a = (k / n) * TAU, r = capsuleRadius(c, a) * (0.8 + 0.06 * Math.sin(a * 3 + i));
      if (k === 0) sh.moveTo(Math.cos(a) * r, -Math.sin(a) * r); else sh.lineTo(Math.cos(a) * r, -Math.sin(a) * r);
    }
    const dry = new THREE.Mesh(new THREE.ShapeGeometry(sh, 8).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: '#efd9a0', transparent: true, opacity: 0, depthWrite: false }));
    dry.position.set(wx(c.x), 0.26, wz(c.y));
    dry.renderOrder = 0.55;
    grp.add(dry);
    sand.push(dry.material);
  });
  return { grp, mats, sand };
}

// ---------- Booms ----------
const LOG = '#7a5634', IRON = '#3a3633';
let logGeo = null, linkGeo = null; // made fresh each battle: the scene disposes what it drops
function boomMesh(b) {
  logGeo = new THREE.CylinderGeometry(2.6, 2.6, 13, 7).rotateZ(PI / 2);
  linkGeo = new THREE.TorusGeometry(1.7, 0.55, 5, 8);
  // Two halves pivoting on their shore ends, so the boom can swing open from the middle.
  const root = new THREE.Group();
  root.position.set(wx(b.x), 0, wz(b.y));
  root.rotation.y = -b.ang;
  const halves = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.x = side * b.hl;
    root.add(pivot);
    const n = Math.max(2, Math.round(b.hl / 15));
    for (let k = 0; k < n; k++) {
      const x = -side * (8 + k * 15);
      const log = new THREE.Mesh(logGeo, toon(LOG));
      log.position.set(x, 1.1, 0);
      log.rotation.x = (k % 3) * 0.7;
      withOutline(log, 0.12);
      pivot.add(log);
      const link = new THREE.Mesh(linkGeo, toon(IRON));
      link.position.set(x - side * 7.5, 1.6, 0);
      link.rotation.y = PI / 2;
      pivot.add(link);
    }
    // A mooring post on the shore end.
    const post = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 12, 6), toon('#5d4330'));
    post.position.set(0, 4, 0);
    withOutline(post, 0.1);
    pivot.add(post);
    halves.push({ g: pivot, side });
  }
  return { root, halves, b };
}

export function buildSeaMarks(G) {
  const out = new THREE.Group();
  const cur = currentMesh(G);
  if (cur) out.add(cur);
  const tide = tidalShoals(G);
  if (tide) out.add(tide.grp);
  const booms = (G.booms || []).map(boomMesh);
  for (const m of booms) out.add(m.root);
  last = { G, cur, tide, booms };
  if (!cur && !tide && !booms.length) { last = null; return null; }
  return out;
}

export function syncSeaMarks(G, clock) {
  const L = last;
  if (!L || L.G !== G) return;
  if (L.cur) L.cur.material.uniforms.uT.value = clock;
  if (L.tide && G.tide) {
    const lv = G.tide.level;
    // High water hides the bar (a faint paler patch), half tide shows it as a shoal, low water dries it.
    const water = 0.18 + 0.82 * (1 - smooth(TIDE.dry, TIDE.covered + 0.15, lv)) + 0 * lv;
    for (const m of L.tide.mats) m.opacity = m.userData.base * Math.min(1, water + 0.12);
    const dry = 1 - smooth(TIDE.dry - 0.12, TIDE.dry + 0.1, lv);
    for (const m of L.tide.sand) m.opacity = 0.85 * dry;
  }
  for (const m of L.booms) {
    const b = m.b;
    const t = b.open ? Math.min(1, (G.t - (b.openAt || G.t)) / 2.4) : 0;
    const swing = (1 - (1 - t) * (1 - t)) * 1.0;
    for (const h of m.halves) {
      // Swing toward the harbour side (down-chart for the defenders) and settle low in the water.
      h.g.rotation.y = h.side * swing * 0.9;
      h.g.position.y = -t * 2.4 + Math.sin(clock * 1.3 + h.side) * 0.5;
    }
  }
}
