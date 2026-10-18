import * as THREE from 'three';
import { TYPES } from '../config/ships.js';
import { COL, TAU, lerp } from '../util.js';
import { R, toon, withOutline } from './gl.js';
import { hullShape, pearShape, liftedExtrude, sailGeometry, sailPatch, islandShape } from './shapes.js';

const PI = Math.PI;

// ---------- Static batching ----------
// BufferGeometryUtils isn't in three's core, so this is a small merge: walk a built hierarchy and bake every
// static mesh into at most three geometries: opaque toon parts (material colour moved into vertex colours),
// ink outlines (positions only) and translucent flats (vertex colour + alpha). Each becomes one draw call.
// tagFor(mesh) may return [x, y, z, code] for a part: it becomes a per-vertex aTag attribute that the ship
// shaders read to move baked parts (toppling masts, a broken topmast, oars). A part whose geometry carries a
// `bulge` attribute (a sail) writes that, carried into the baked space, into aTag.xyz instead.
const _bi = new THREE.Matrix4(), _bn = new THREE.Matrix3(), _bm = new THREE.Matrix3(), _bv = new THREE.Vector3();
export function bakeStatic(root, skip, uvFor, tagFor) {
  root.updateMatrixWorld(true);
  _bi.copy(root.matrixWorld).invert();
  const solid = [], ink = [], glass = [], temp = [];
  const walk = (o) => {
    if (o !== root && skip && skip(o)) return;
    if (o.isMesh) {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
      if (g !== o.geometry) temp.push(g);
      const part = {
        g, m: new THREE.Matrix4().multiplyMatrices(_bi, o.matrixWorld), mats: Array.isArray(o.material) ? o.material : [o.material],
        uv: uvFor ? uvFor(o) : null, tag: tagFor ? tagFor(o) : null,
      };
      (o.material === R.inkMat ? ink : part.mats[0].transparent ? glass : solid).push(part);
    }
    for (const c of o.children) walk(c);
  };
  walk(root);
  const out = { solid: solid.length ? mergeParts(solid, 3) : null, ink: ink.length ? mergeParts(ink, 0) : null, glass: glass.length ? mergeParts(glass, 4) : null };
  for (const g of temp) g.dispose();
  return out;
}

// colorSize: 0 = positions only, 3 = normals/uv/rgb, 4 = normals/uv/rgba (alpha from material opacity).
function mergeParts(parts, colorSize) {
  let n = 0;
  for (const p of parts) n += p.g.attributes.position.count;
  const full = colorSize > 0;
  const tagged = parts.some((p) => p.tag || p.g.attributes.bulge);
  const pos = new Float32Array(n * 3), nor = full ? new Float32Array(n * 3) : null;
  const uv = full ? new Float32Array(n * 2) : null, col = full ? new Float32Array(n * colorSize) : null;
  const tag = tagged ? new Float32Array(n * 4) : null;
  let o = 0;
  for (const p of parts) {
    const P = p.g.attributes.position, N = p.g.attributes.normal, U = p.g.attributes.uv, Bu = p.g.attributes.bulge, cnt = P.count;
    _bn.getNormalMatrix(p.m);
    _bm.setFromMatrix4(p.m);
    for (let i = 0; i < cnt; i++) {
      _bv.fromBufferAttribute(P, i).applyMatrix4(p.m).toArray(pos, (o + i) * 3);
      if (tagged) {
        const k = (o + i) * 4;
        if (Bu) _bv.fromBufferAttribute(Bu, i).applyMatrix3(_bm).toArray(tag, k);
        else if (p.tag) { tag[k] = p.tag[0]; tag[k + 1] = p.tag[1]; tag[k + 2] = p.tag[2]; }
        tag[k + 3] = p.tag ? p.tag[3] : 0;
      }
      if (!full) continue;
      if (N) _bv.fromBufferAttribute(N, i).applyMatrix3(_bn).normalize().toArray(nor, (o + i) * 3);
      if (p.uv) { uv[(o + i) * 2] = p.uv[0]; uv[(o + i) * 2 + 1] = p.uv[1]; }
      else if (U) { uv[(o + i) * 2] = U.getX(i); uv[(o + i) * 2 + 1] = U.getY(i); }
    }
    if (full) {
      // Material colours are already linear, which is what vertex colours expect.
      const groups = p.mats.length > 1 && p.g.groups.length ? p.g.groups : [{ start: 0, count: cnt, materialIndex: 0 }];
      for (const gr of groups) {
        const mt = p.mats[gr.materialIndex] || p.mats[0], c = mt.color;
        const end = Math.min(cnt, gr.start + gr.count);
        for (let i = gr.start; i < end; i++) {
          const k = (o + i) * colorSize;
          col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
          if (colorSize === 4) col[k + 3] = mt.opacity;
        }
      }
    }
    o += cnt;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (full) {
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(col, colorSize));
  }
  if (tagged) g.setAttribute('aTag', new THREE.BufferAttribute(tag, 4));
  g.computeBoundingSphere();
  return g;
}

// Replaces a group's static children with merged meshes; children matching skip stay as they are.
export function bakeChildren(group, mat, skip, uvFor, tagFor) {
  const b = bakeStatic(group, skip, uvFor, tagFor);
  for (const c of [...group.children]) if (!skip || !skip(c)) group.remove(c);
  const out = {};
  if (b.solid) { out.solid = new THREE.Mesh(b.solid, mat); group.add(out.solid); }
  if (b.ink) { out.ink = new THREE.Mesh(b.ink, R.inkMat); group.add(out.ink); }
  return out;
}

// ---------- Looks ----------
// Paint, canvas and colours by allegiance. 'merchant' is an escorted friendly trader; the pirate looks fly
// black canvas with a skull and crossbones (the boss trimmed in red).
const LOOKS = {
  player: { sail: '#fbf3dc', side: '#a5672f', castle: '#c28145', rail: COL.blue, trim: COL.blue, flag: COL.blue },
  enemy: { sail: '#fbf3dc', side: '#7a3a28', castle: '#93483a', rail: COL.red, trim: '#c9a227', flag: COL.red },
  boss: { sail: '#a8262a', side: '#4a2622', castle: '#6b2f2a', rail: '#f2b632', trim: '#e2b13a', flag: '#f2b632' },
  pirate: { sail: '#332e33', side: '#3a2c28', castle: '#4c3934', rail: '#7a2620', trim: '#b8a888', flag: 'roger' },
  pirateBoss: { sail: '#241f25', side: '#2a1e1e', castle: '#402728', rail: '#c0302a', trim: '#d23c2c', flag: 'rogerBoss' },
  merchant: { sail: '#f7eed6', side: '#a8743f', castle: '#c4925a', rail: '#3d7a52', trim: '#3d7a52', flag: COL.blue },
};

// faction: the battle's faction, for enemy ships the sim didn't tag themselves.
export function shipLook(s, faction) {
  const side = s.origTeam || s.team;
  const pirate = s.faction === 'pirate' || (faction === 'pirate' && side === 'enemy');
  if (s.boss) return pirate ? 'pirateBoss' : 'boss';
  if (pirate) return 'pirate';
  if (s.escort || (side === 'player' && TYPES[s.type] && TYPES[s.type].merchant)) return 'merchant';
  return side === 'player' ? 'player' : 'enemy';
}

// ---------- Sails and flags ----------
const sailTex = {};
// One 128px canvas per look: seams, the look's device and an ink (or trim) border. torn = shot-through canvas
// with ragged, scorched holes, used below half hull (and always on fireships); the holes are alpha-tested out.
export function sailTexture(look, torn) {
  const key = look + (torn ? ':torn' : '');
  if (sailTex[key]) return sailTex[key];
  const Lk = LOOKS[look] || LOOKS.enemy;
  const dark = look === 'pirate' || look === 'pirateBoss';
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = Lk.sail; x.fillRect(0, 0, 128, 128);
  x.fillStyle = look === 'boss' ? 'rgba(60,10,10,0.25)' : dark ? 'rgba(255,255,255,0.07)' : 'rgba(200,180,130,0.35)';
  for (let i = 1; i < 4; i++) x.fillRect(i * 32 - 1, 0, 2, 128);
  // The yards sample the texel at (0.4, 0.15), about (51, 109) on the canvas, so devices stay clear of it.
  if (look === 'player') {
    x.fillStyle = COL.blue; x.fillRect(0, 50, 128, 26);
  } else if (look === 'merchant') {
    x.fillStyle = 'rgba(205,140,80,0.45)';
    for (const sx of [10, 74]) x.fillRect(sx, 0, 22, 128);
    x.fillStyle = '#3d7a52'; x.fillRect(0, 12, 128, 8);
  } else if (dark) {
    drawRoger(x, 64, 56, 1, '#efe6d2', Lk.sail);
  } else {
    x.strokeStyle = look === 'boss' ? '#f2b632' : COL.red; x.lineWidth = 14; x.lineCap = 'round';
    x.beginPath(); x.moveTo(26, 22); x.lineTo(102, 106); x.moveTo(102, 22); x.lineTo(26, 106); x.stroke();
  }
  x.strokeStyle = look === 'boss' ? '#f2b632' : look === 'pirateBoss' ? '#c0302a' : COL.ink;
  x.lineWidth = look === 'pirateBoss' ? 12 : 8; x.strokeRect(0, 0, 128, 128);
  if (torn) tearCanvas(x, dark);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  sailTex[key] = t;
  return t;
}

// Skull and crossbones centred on (cx, cy), about 60px wide at k = 1.
function drawRoger(x, cx, cy, k, bone, bg) {
  x.save(); x.translate(cx, cy); x.scale(k, k);
  x.strokeStyle = bone; x.fillStyle = bone; x.lineCap = 'round'; x.lineWidth = 7;
  x.beginPath(); x.moveTo(-25, 8); x.lineTo(25, 38); x.moveTo(25, 8); x.lineTo(-25, 38); x.stroke();
  for (const [bx, by] of [[-25, 8], [25, 38], [25, 8], [-25, 38]]) {
    for (const o of [-3.5, 3.5]) { x.beginPath(); x.arc(bx + o * Math.sign(by - 23) * Math.sign(bx), by + o, 4.4, 0, TAU); x.fill(); }
  }
  x.beginPath(); x.arc(0, -6, 17, 0, TAU); x.fill();
  x.fillRect(-10, 4, 20, 13);
  x.fillStyle = bg;
  for (const ex of [-6.5, 6.5]) { x.beginPath(); x.arc(ex, -6, 5, 0, TAU); x.fill(); }
  x.beginPath(); x.moveTo(0, 0); x.lineTo(-2.6, 5); x.lineTo(2.6, 5); x.closePath(); x.fill();
  for (const tx of [-6, -1, 4]) x.fillRect(tx, 11, 2, 6);
  x.restore();
}

function ragged(x, cx, cy, r) {
  x.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU, rr = r * (i % 2 ? 0.6 : 1) * (0.82 + 0.36 * (((i * 37) % 7) / 7));
    x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  x.closePath(); x.fill();
}

function tearCanvas(x, dark) {
  const holes = [[38, 36, 14], [92, 44, 12], [74, 84, 10], [22, 78, 8], [62, 16, 7]];
  x.fillStyle = dark ? 'rgba(10,8,8,0.7)' : 'rgba(58,34,16,0.62)';
  for (const [hx, hy, r] of holes) ragged(x, hx, hy, r + 5);
  x.fillStyle = 'rgba(40,30,24,0.22)';
  ragged(x, 100, 92, 16); ragged(x, 30, 20, 12);
  x.globalCompositeOperation = 'destination-out';
  x.fillStyle = '#000';
  for (const [hx, hy, r] of holes) ragged(x, hx, hy, r);
  // A ragged foot, clear of the yard texel.
  x.beginPath(); x.moveTo(66, 129);
  for (let i = 0; i <= 10; i++) x.lineTo(66 + i * 6.4, 128 - (i % 2 ? 13 : 3));
  x.lineTo(129, 129); x.closePath(); x.fill();
  x.globalCompositeOperation = 'source-over';
}

const flagTex = {};
function flagTexture(kind) {
  if (flagTex[kind]) return flagTex[kind];
  const c = document.createElement('canvas'); c.width = 128; c.height = 72;
  const x = c.getContext('2d');
  x.fillStyle = '#17141a'; x.fillRect(0, 0, 128, 72);
  drawRoger(x, 64, 26, 0.95, '#f4ecdc', '#17141a');
  if (kind === 'rogerBoss') { x.strokeStyle = '#d23c2c'; x.lineWidth = 10; x.strokeRect(0, 0, 128, 72); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  flagTex[kind] = t;
  return t;
}

// ---------- Ship shaders ----------
// Every ship's static parts stay baked (one hull draw, one outline draw, one per mast's rig). Per ship, three
// cloned materials share a few uniforms so the baked meshes can still move:
//   uFade  0..1 screen-door dissolve (fog, escaping), so a fading ship never goes transparent or re-sorts.
//   uMast  xyz = how far masts 0..2 have toppled (sinking), w = the mast whose topmast is shot away (-1 none).
//   uMastH xyz = the height each topmast breaks at, w = the oar stroke phase.
//   uSail  x = square-sail draw, y = fore-and-aft draw (signed: which side the belly sits), z = clock, w = the
//          broken mast; a draw above 1.5 means luffing.
// aTag (from bakeStatic): body parts carry [base x, y, z, code] with code 1..3 = mast 0..2, 10/11 = port/
// starboard oar; rig parts carry [belly xyz, mast + 4 * topsail + 8 * fore-and-aft].
const DITHER = `uniform float uFade;
void main() {
  if (uFade < 0.999) {
    float dz = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715))));
    if (dz > uFade) discard;
  }`;
const BODY_VERT = `attribute vec4 aTag;
uniform vec4 uMast, uMastH;
vec3 rotX(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x, v.y * c - v.z * s, v.y * s + v.z * c); }
vec3 rotY(vec3 v, float a) { float c = cos(a), s = sin(a); return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c); }
vec3 shipXf(vec3 v, bool pt) {
  float code = floor(aTag.w + 0.5);
  if (code > 0.5 && code < 3.5) {
    float mi = code - 1.0;
    vec3 b = aTag.xyz;
    float bh = mi < 0.5 ? uMastH.x : mi < 1.5 ? uMastH.y : uMastH.z;
    if (abs(mi - uMast.w) < 0.1 && position.y > bh) {
      vec3 h = vec3(b.x, bh, b.z);
      v = pt ? h + rotX(v - h, 2.25) : rotX(v, 2.25);
    }
    float t = mi < 0.5 ? uMast.x : mi < 1.5 ? uMast.y : uMast.z;
    v = pt ? b + rotX(v - b, t) : rotX(v, t);
  } else if (code > 9.5) {
    float side = code > 10.5 ? 1.0 : -1.0;
    float a = -sin(uMastH.w) * 0.42 * side;
    if (pt) {
      vec3 q = rotY(v - aTag.xyz, a);
      q.y += max(0.0, cos(uMastH.w)) * abs(q.z) * 0.2;
      v = aTag.xyz + q;
    } else v = rotY(v, a);
  }
  return v;
}
void main() {`;
const RIG_VERT = `attribute vec4 aTag;
uniform vec4 uSail;
void main() {`;
const RIG_MOVE = `#include <begin_vertex>
  float rc = floor(aTag.w + 0.5), mi = mod(rc, 4.0);
  float fill = rc > 7.5 ? uSail.y : uSail.x;
  if (abs(fill) > 1.5) fill = 0.14 * sin(uSail.z * 14.0 + mi * 1.7);
  transformed -= aTag.xyz * (1.0 - fill);
  if (mod(floor(rc / 4.0), 2.0) > 0.5 && abs(mi - uSail.w) < 0.1) transformed = vec3(0.0);`;

function bodyShader(sh) {
  const u = this.userData.shipU;
  Object.assign(sh.uniforms, { uFade: u.uFade, uMast: u.uMast, uMastH: u.uMastH });
  sh.vertexShader = sh.vertexShader.replace('void main() {', BODY_VERT)
    .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n\tobjectNormal = shipXf(objectNormal, false);')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed = shipXf(transformed, true);');
  sh.fragmentShader = sh.fragmentShader.replace('void main() {', DITHER);
}
function rigShader(sh) {
  const u = this.userData.shipU;
  Object.assign(sh.uniforms, { uFade: u.uFade, uSail: u.uSail });
  sh.vertexShader = sh.vertexShader.replace('void main() {', RIG_VERT).replace('#include <begin_vertex>', RIG_MOVE);
  sh.fragmentShader = sh.fragmentShader.replace('void main() {', DITHER);
}
function shipMaterial(src, u, obc) {
  const m = src.clone();
  m.userData = { shipU: u };
  m.onBeforeCompile = obc;
  return m;
}

// ---------- Ships ----------
// Per-class build notes. depth = hull depth / beam; castle = [length / L, height / depth, width / B];
// sprit = bowsprit length / L; masts: x and height as fractions of L, rig 'square' (default) | 'gaff' | 'lateen'.
const SPEC = {
  schooner: {
    depth: 0.46, castle: [0.14, 0.45, 0.62], sprit: 0.42, jib: true,
    masts: [{ x: 0.17, h: 0.76, rig: 'gaff', boom: 0.24 }, { x: -0.13, h: 0.86, rig: 'gaff', boom: 0.34, main: true }],
  },
  xebec: {
    depth: 0.4, castle: [0.13, 0.42, 0.6], sprit: 0.26, beak: true, oars: 7,
    masts: [{ x: 0.31, h: 0.48, rig: 'lateen', yard: 0.44 }, { x: 0.03, h: 0.56, rig: 'lateen', yard: 0.54, main: true }, { x: -0.28, h: 0.42, rig: 'lateen', yard: 0.38 }],
  },
  bomb: {
    depth: 0.64, castle: [0.22, 0.62, 0.78], sprit: 0.24,
    masts: [{ x: -0.06, h: 0.62, main: true }, { x: -0.34, h: 0.46, rig: 'gaff', boom: 0.2 }], mortarX: 0.21,
  },
  fireship: { tar: true, faggots: true, torn: true },
  merchant: {
    pear: true, depth: 0.56, castle: [0.25, 1.3, 0.52], cargo: true,
    masts: [{ x: 0.29, h: 0.5 }, { x: 0.04, h: 0.6, main: true }, { x: -0.21, h: 0.46 }],
  },
};
const defaultMasts = (T) => (T.masts === 3
  ? [{ x: 0.27, h: 0.54 }, { x: 0.02, h: 0.66, main: true }, { x: -0.25, h: 0.54 }]
  : [{ x: 0.15, h: 0.66, main: true }, { x: -0.18, h: 0.54 }]);

// A cylinder of radius r from a to b (points in the x-y plane).
function spar(a, b, r, mat) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 5), mat);
  m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0);
  m.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]) - PI / 2;
  return m;
}
// Both faces of a flat sail, for materials that only draw front faces.
function twoSided(geo) {
  const back = geo.clone();
  const ix = back.index.array;
  for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 1]; ix[i + 1] = t; }
  back.computeVertexNormals();
  return [geo, back];
}

// One model per class, look, gun count and fit-out, built once and cloned per ship
// (geometry is shared; materials are per ship so it can flash, scorch, tear and fade on its own).
const templates = new Map();
export function shipTemplate(s, faction) {
  const look = shipLook(s, faction);
  const T = TYPES[s.type] || TYPES.brig;
  const sp = SPEC[s.type] || {};
  const ab = (k) => (s.abilities && s.abilities[k]) || (T.abilities && T.abilities[k]) || s[k] || T[k];
  const mortar = !!ab('mortar');
  const key = [s.type, look, s.guns, s.chasers, mortar ? 1 : 0].join(':');
  if (templates.has(key)) return templates.get(key);
  const Lk = LOOKS[look];
  const L = T.L, B = T.B, d = B * (sp.depth || 0.5);
  const boss = look === 'boss' || look === 'pirateBoss';
  const root = new THREE.Group();
  const body = new THREE.Group(); body.name = 'body';
  root.add(body);
  const base = -d * 0.32;
  const shape = (k) => (sp.pear ? pearShape(L * k, B * (k > 1 ? 1.06 : 1)) : hullShape(L * k, B * (k > 1 ? 1.06 : 1)));
  const sideC = sp.tar ? '#2b2422' : Lk.side, deckC = sp.tar ? '#5c4734' : '#e0ad6b';
  const castleC = sp.tar ? '#382c27' : Lk.castle, trim = sp.tar ? '#5a4a3a' : Lk.trim;
  const hull = new THREE.Mesh(liftedExtrude(shape(1), d, 1.4, sp.pear ? 0.6 : 0.72), [toon(deckC), toon(sideC)]);
  hull.position.y = base;
  withOutline(hull, 0.05);
  body.add(hull);
  const wale = new THREE.Mesh(liftedExtrude(shape(1.025), 2.2, 0, 0), toon(trim));
  wale.position.y = base + d * 0.55;
  body.add(wale);
  const deckY = base + d + 1.4;
  const [cl, ch, cw] = sp.castle || [0.2, 0.75, 0.74];
  const cx = -L * (0.49 - cl / 2);
  const castle = new THREE.Mesh(new THREE.BoxGeometry(L * cl, d * ch, B * cw), toon(castleC));
  castle.position.set(cx, deckY + d * ch * 0.4, 0);
  withOutline(castle, 0.08);
  body.add(castle);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(L * (cl + 0.01), 1.6, B * (cw + 0.04)), toon(sp.tar ? '#4a3a30' : Lk.rail));
  rail.position.set(cx, deckY + d * ch * 0.93, 0);
  body.add(rail);
  // Stern lantern
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), toon('#ffd65a'));
  lantern.position.set(-L * 0.5, deckY + d * ch * 1.2, 0);
  withOutline(lantern, 0.15);
  body.add(lantern);
  const gunGeo = new THREE.CylinderGeometry(1.5, 1.9, 6, 8).rotateX(PI / 2);
  const gunMat = toon('#2a2522');
  for (let i = 0; i < s.guns; i++) {
    const ax = s.guns === 1 ? 0 : lerp(-L * 0.3, L * 0.3, i / (s.guns - 1));
    for (const side of [-1, 1]) {
      const gun = new THREE.Mesh(gunGeo, gunMat);
      gun.position.set(ax, deckY - d * 0.35, side * (B / 2 + 0.5));
      body.add(gun);
    }
  }
  // Bow chasers: long guns poking forward over the bow.
  for (let i = 0; i < s.chasers; i++) {
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.9, 9, 8).rotateZ(-PI / 2), gunMat);
    gun.position.set(L * 0.42, deckY + 0.6, s.chasers === 1 ? 0 : (i ? 1 : -1) * B * 0.18);
    withOutline(gun, 0.12);
    body.add(gun);
  }
  const wood = toon('#7a4a22');
  const spritLen = L * (sp.sprit || 0.3);
  const spritButt = [L * 0.44, deckY + 1.5], spritDir = [Math.cos(0.28), Math.sin(0.28)];
  const spritTip = [spritButt[0] + spritDir[0] * spritLen, spritButt[1] + spritDir[1] * spritLen];
  const sprit = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, spritLen, 6), wood);
  sprit.rotation.z = -PI / 2 + 0.28;
  sprit.position.set((spritButt[0] + spritTip[0]) / 2, (spritButt[1] + spritTip[1]) / 2 + 1, 0);
  body.add(sprit);

  if (sp.beak) {
    // A xebec's long, low beak and an overhanging stern platform.
    const beak = new THREE.Mesh(new THREE.ConeGeometry(B * 0.16, L * 0.2, 6).rotateZ(-PI / 2), toon(sideC));
    beak.scale.z = 0.7;
    beak.position.set(L * 0.56, base + d * 0.75, 0);
    withOutline(beak, 0.08);
    body.add(beak);
    const plat = new THREE.Mesh(new THREE.BoxGeometry(L * 0.1, 1.4, B * 0.56), toon(deckC));
    plat.position.set(-L * 0.53, deckY + 0.2, 0);
    withOutline(plat, 0.08);
    body.add(plat);
  }
  if (sp.oars) {
    const n = sp.oars, Lo = B * 0.95, oarMat = toon('#b8894e'), bladeMat = toon('#d9b47a');
    const shaft = new THREE.CylinderGeometry(0.42, 0.42, Lo, 5).rotateX(PI / 2);
    for (let i = 0; i < n; i++) {
      const ax = lerp(-L * 0.27, L * 0.25, i / (n - 1));
      for (const side of [-1, 1]) {
        const og = new THREE.Group();
        og.position.set(ax, deckY - 0.9, side * (B / 2 + 0.2));
        og.rotation.x = side * 0.42;
        og.userData.tag = [ax, deckY - 0.9, side * (B / 2 + 0.2), side > 0 ? 11 : 10];
        const oar = new THREE.Mesh(shaft, oarMat);
        oar.position.z = side * Lo / 2;
        const blade = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 4.2), bladeMat);
        blade.position.z = side * (Lo - 1.8);
        og.add(oar, blade);
        body.add(og);
      }
    }
  }
  if (mortar) {
    // A squat iron mortar on a round bed, cocked up toward the bow, with a few shells beside it.
    const mx = L * (sp.mortarX || 0.145), r = Math.min(B * 0.2, 6.5);
    const bed = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.45, r * 1.6, 3, 12), toon('#6b4424'));
    bed.position.set(mx, deckY + 1.5, 0);
    withOutline(bed, 0.06);
    body.add(bed);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 0.9, r * 1.7, 12), toon('#34302e'));
    barrel.position.set(mx + r * 0.25, deckY + 3 + r * 0.7, 0);
    barrel.rotation.z = -0.5;
    withOutline(barrel, 0.08);
    body.add(barrel);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.12, r * 1.12, r * 0.3, 12), toon('#b08a3a'));
    band.position.copy(barrel.position); band.rotation.z = -0.5;
    body.add(band);
    const bore = new THREE.Mesh(new THREE.CircleGeometry(r * 0.72, 12).rotateX(-PI / 2), toon('#0f0d0c'));
    bore.position.set(mx + r * 0.25 + Math.sin(0.5) * r * 0.86, deckY + 3 + r * 0.7 + Math.cos(0.5) * r * 0.86 + 0.05, 0);
    bore.rotation.z = -0.5;
    body.add(bore);
    for (let k = 0; k < 3; k++) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(1.7, 8, 6), gunMat);
      ball.position.set(mx - r * 1.9, deckY + 1.6 + (k === 2 ? 2.4 : 0), (k === 2 ? 0 : k ? 1.8 : -1.8) + B * 0.18);
      body.add(ball);
    }
  }
  if (sp.faggots) {
    // Fireship: the deck is heaped with brushwood bundles and tar barrels.
    const fg = new THREE.CylinderGeometry(1.5, 1.5, B * 0.5, 6).rotateX(PI / 2);
    for (let r = 0; r < 6; r++) {
      for (let k = 0; k < 2; k++) {
        const f = new THREE.Mesh(fg, toon((r + k) % 2 ? '#a8813f' : '#8d6a33'));
        f.position.set(lerp(-L * 0.24, L * 0.3, r / 5) + k * L * 0.045, deckY + 1.5 + k * 2.6, (k ? 1 : -1) * B * 0.04);
        f.rotation.y = (r % 2 ? 0.12 : -0.1) + k * 0.2;
        withOutline(f, 0.12);
        body.add(f);
      }
    }
    for (const z of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 4.4, 8), toon('#1d1917'));
      bar.position.set(-L * 0.3, deckY + 2.2, z * B * 0.2);
      withOutline(bar, 0.12);
      body.add(bar);
    }
  }
  if (sp.cargo) {
    // Merchantman: a hatch, crates and barrels amidships and a carved stern gallery on her high stern.
    const hatch = new THREE.Mesh(new THREE.BoxGeometry(L * 0.12, 0.8, B * 0.36), toon('#5a3a1e'));
    hatch.position.set(L * 0.17, deckY + 0.4, 0);
    body.add(hatch);
    const crateGeo = new THREE.BoxGeometry(5.5, 4.6, 5.5);
    [[0.15, -0.2, 0], [0.19, 0.2, 0], [0.15, 0.2, 1], [-0.1, -0.2, 0], [-0.07, 0.04, 0]].forEach(([fx, fz, up], i) => {
      const c = new THREE.Mesh(crateGeo, toon(i % 2 ? '#c99a5a' : '#b5864c'));
      c.position.set(L * fx, deckY + 2.3 + up * 4.6, B * fz);
      c.rotation.y = i * 0.35;
      withOutline(c, 0.08);
      body.add(c);
    });
    for (const [fx, fz] of [[-0.13, 0.22], [-0.17, 0.12], [0.31, -0.18]]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 4.2, 8), toon('#8a5a2e'));
      b.position.set(L * fx, deckY + 2.1, B * fz);
      withOutline(b, 0.1);
      body.add(b);
    }
    const gallery = new THREE.Mesh(new THREE.BoxGeometry(1.4, d * ch * 0.45, B * cw * 0.8), toon('#e2b13a'));
    gallery.position.set(-L * 0.495, deckY + d * ch * 0.45, 0);
    body.add(gallery);
  }

  const masts = sp.masts || defaultMasts(T);
  const rigTex = sailTexture(look, !!sp.torn);
  const sailMat = toon('#ffffff', { map: rigTex, side: THREE.DoubleSide });
  const breakH = new THREE.Vector4(1e4, 1e4, 1e4, 0);
  let top = 0, mainIdx = 0, flagX = 0;
  masts.forEach((M, mi) => {
    const rig = M.rig || 'square', fa = rig !== 'square' ? 1 : 0;
    const mh = L * M.h, mx = L * M.x;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.7, mh, 7, 3), wood);
    mast.position.set(mx, deckY + mh / 2, 0);
    mast.userData.tag = [mx, deckY, 0, mi + 1];
    withOutline(mast, 0.25);
    body.add(mast);
    breakH.setComponent(mi, deckY + mh * 0.72);
    const pivot = new THREE.Group();
    pivot.name = 'pivot';
    pivot.userData = { mast: mi, fa };
    pivot.position.set(mx, deckY, 0);
    body.add(pivot);
    const code = (top) => mi + 4 * top + 8 * fa;
    const add = (mesh, tp) => { mesh.userData.code = code(tp); pivot.add(mesh); return mesh; };
    if (rig === 'square') {
      const w = B * (M.main ? 1.55 : 1.35);
      [{ w, h: mh * 0.4, y: mh * 0.33 }, { w: w * 0.78, h: mh * 0.3, y: mh * 0.7 }].forEach((t, k) => {
        const sail = add(new THREE.Mesh(sailGeometry(t.w, t.h), sailMat), k);
        sail.position.set(0.8, t.y, 0);
        const yard = add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, t.w * 1.08, 5).rotateX(PI / 2), wood), k);
        yard.position.set(0.6, t.y + t.h / 2, 0);
      });
    } else if (rig === 'gaff') {
      // Gaff sail abaft the mast between boom and gaff; the main carries a little gaff topsail above it.
      const Lb = L * M.boom, y0 = 5, y1 = mh * 0.7, peak = [-Lb * 0.9, mh * 0.9];
      add(new THREE.Mesh(sailPatch([-1.3, y0], [-Lb, y0 + 1], [-1.3, y1], peak, Lb * 0.16), sailMat), 0);
      add(spar([0, y0 - 0.6], [-Lb * 1.03, y0 + 0.5], 0.75, wood), 0);
      add(spar([-0.8, y1 + 0.6], [peak[0] * 1.04, peak[1] + 0.8], 0.65, wood), 0);
      if (M.main) add(new THREE.Mesh(sailPatch([-1.3, y1 + 1.5], [peak[0] * 0.92, peak[1] + 1], [-1.3, mh * 1.02], [-1.3, mh * 1.02], Lb * 0.06, 4, 3), sailMat), 1);
    } else {
      // Lateen: a long yard slung across the mast, low forward and high aft, with the sail laced beneath it.
      const Ly = L * M.yard, A = [Ly * 0.42, mh * 0.26], P = [-Ly * 0.58, mh * 1.14], C = [-Ly * 0.34, 4.5];
      add(new THREE.Mesh(sailPatch(A, C, P, P, Ly * 0.13), sailMat), 0);
      add(spar([A[0] * 1.06, A[1] - 0.6], [P[0] * 1.04, P[1] + 0.8], 0.7, wood), 0);
    }
    if (M.main) {
      mainIdx = mi; flagX = mx;
      if (rig === 'square') {
        const nest = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 2.6, 2.6, 10), wood);
        nest.position.set(mx, deckY + mh * 0.86, 0);
        nest.userData.tag = mast.userData.tag;
        withOutline(nest, 0.12);
        body.add(nest);
      }
      top = deckY + mh;
      const flagPivot = new THREE.Group();
      flagPivot.name = 'flag';
      flagPivot.position.set(mx, top - 1, 0);
      const fk = Lk.flag, roger = fk === 'roger' || fk === 'rogerBoss';
      const flagMat = roger ? toon('#ffffff', { map: flagTexture(fk), side: THREE.DoubleSide }) : toon(fk, { side: THREE.DoubleSide });
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(14, 8, 4, 1).translate(7, 0, 0), flagMat);
      if (boss) flag.scale.setScalar(1.6); // a boss flies a long command pennant
      else if (roger) flag.scale.setScalar(1.25);
      flagPivot.add(flag);
      body.add(flagPivot);
    }
  });
  if (sp.jib) {
    // Schooner headsail: a fixed jib from the bowsprit to the foremast head (it stays with the hull bake).
    const fm = masts[0], head = [L * fm.x + 1.5, deckY + L * fm.h * 0.94];
    const tack = [spritTip[0] * 0.97, spritTip[1] + 1.5], clew = [L * 0.27, deckY + 6];
    for (const g of twoSided(sailPatch(tack, clew, head, head, 2.2, 4, 3))) body.add(new THREE.Mesh(g, toon(Lk.sail)));
    body.add(spar([spritTip[0] * 0.97, spritTip[1] + 1], head, 0.35, toon(COL.ink)));
  }
  // Bake: the static body becomes one toon mesh + one outline; each mast's sails and spars become one mesh.
  const animated = (o) => o.name === 'pivot' || o.name === 'flag';
  const tagUp = (o) => { for (let p = o; p && p !== body; p = p.parent) if (p.userData.tag) return p.userData.tag; return null; };
  const baked = bakeChildren(body, toon('#ffffff', { vertexColors: true }), animated, null, tagUp);
  baked.solid.name = 'hullBody';
  if (baked.ink) baked.ink.name = 'hullInk';
  const rigMat = toon('#ffffff', { map: rigTex, side: THREE.DoubleSide, vertexColors: true, alphaTest: 0.5 });
  const rigTag = (o) => [0, 0, 0, o.userData.code || 0];
  for (const pv of body.children.filter((c) => c.name === 'pivot')) {
    // Spars sample a plain texel of the sail texture so the wood colour shows through.
    bakeChildren(pv, rigMat, null, (m) => (m.material === wood ? [0.4, 0.15] : null), rigTag).solid.name = 'rig';
  }
  sailMat.dispose(); // only used while building; the baked rig has its own material
  const tpl = { root, top, deckY, breakH, mainIdx, flagY: top - 1, brokenFlagY: breakH.getComponent(mainIdx) - 1, look, torn: !!sp.torn, oars: !!sp.oars };
  templates.set(key, tpl);
  return tpl;
}

export function buildShipMesh(s, faction) {
  const tpl = shipTemplate(s, faction);
  const g = tpl.root.clone(true);
  const u = {
    uFade: { value: 1 }, uMast: { value: new THREE.Vector4(0, 0, 0, -1) },
    uMastH: { value: tpl.breakH.clone() }, uSail: { value: new THREE.Vector4(1, 1, 0, -1) },
  };
  const ref = {
    g, u, tpl, rigs: [], pivots: [], body: null, flagPivot: null, hullMat: null, rigMat: null, inkMat: null,
    top: tpl.top, vis: 1, boom: 0, oar: 0, torn: tpl.torn, mats: [],
  };
  g.traverse((o) => {
    if (o.name === 'body') ref.body = o;
    else if (o.name === 'rig') {
      if (!ref.rigMat) ref.rigMat = shipMaterial(o.material, u, rigShader);
      o.material = ref.rigMat;
      ref.rigs.push(o);
    } else if (o.name === 'pivot') ref.pivots.push(o);
    else if (o.name === 'flag') ref.flagPivot = o;
    else if (o.name === 'hullBody') o.material = ref.hullMat = shipMaterial(o.material, u, bodyShader);
    else if (o.name === 'hullInk') o.material = ref.inkMat = shipMaterial(o.material, u, bodyShader);
  });
  ref.mats = [ref.hullMat, ref.rigMat, ref.inkMat].filter(Boolean);
  return ref;
}

// ---------- Treasure chest ----------
// A small iron-banded chest, baked to one toon geometry and one outline for the instanced chest pools.
export function chestGeometries() {
  const g = new THREE.Group();
  const wood = toon('#8a5a2e'), lidC = toon('#a0683a'), gold = toon('#f2c440');
  const box = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 6), wood);
  box.position.y = 2.5; withOutline(box, 0.1); g.add(box);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 9, 10, 1, false, 0, PI).rotateZ(PI / 2), lidC);
  lid.position.y = 5; withOutline(lid, 0.1); g.add(lid);
  for (const x of [-3, 3]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(1, 5.3, 6.3), gold); band.position.set(x, 2.55, 0); g.add(band);
    const arc = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 1, 10, 1, false, 0, PI).rotateZ(PI / 2), gold); arc.position.set(x, 5, 0); g.add(arc);
  }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, 0.8), gold); lock.position.set(0, 4.6, 3.1); g.add(lock);
  const b = bakeStatic(g);
  g.traverse((o) => { if (o.isMesh && o.material !== R.inkMat) o.geometry.dispose(); });
  return b;
}

// ---------- Islands ----------
export function buildIsland(is, wx, wz) {
  const g = new THREE.Group();
  g.position.set(wx(is.x), 0, wz(is.y));
  const flat = (k, color, op, y) => {
    const m = new THREE.Mesh(new THREE.ShapeGeometry(islandShape(is, k), 24).rotateX(-PI / 2),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }));
    m.position.y = y; m.renderOrder = 1;
    g.add(m);
  };
  flat(1.55, 0x9fe6f0, 0.45, 0.2);
  flat(1.25, 0xcdf5f7, 0.6, 0.3);
  flat(1.1, 0xffffff, 0.9, 0.4); // cartoon surf line hugging the beach
  const sand = new THREE.Mesh(liftedExtrude(islandShape(is, 0.94), 5, 3.5, 0), toon('#f2d68f'));
  sand.position.y = -1;
  withOutline(sand, 0.04);
  g.add(sand);
  const grass = new THREE.Mesh(liftedExtrude(islandShape(is, 0.6), 4 + is.r * 0.08, 2.5, 0), toon('#7cc957'));
  grass.position.y = 5;
  g.add(grass);
  if (is.r > 40 && !is.fort) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(is.r * 0.32, 12, 8), toon('#68b84a'));
    hill.scale.y = 0.55; hill.position.set(is.r * 0.12, 9, is.r * 0.1);
    withOutline(hill, 0.05);
    g.add(hill);
  }
  for (const r of is.rocks) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r.s, 0), toon('#8b8f96'));
    rock.position.set(Math.cos(r.a) * r.d, 0.5, -Math.sin(r.a) * r.d);
    rock.rotation.set(r.a, r.a * 2, 0);
    withOutline(rock, 0.12);
    g.add(rock);
  }
  for (const p of is.palms) g.add(buildPalm(p));
  return g;
}

let leafGeo = null, nutGeo = null;
export const sharedIslandGeos = () => [leafGeo, nutGeo];
function buildPalm(p) {
  leafGeo = leafGeo || new THREE.SphereGeometry(1, 8, 6);
  nutGeo = nutGeo || new THREE.SphereGeometry(1.5, 6, 5);
  const g = new THREE.Group();
  g.position.set(p.x, 8, p.y);
  g.rotation.y = p.rot;
  const h = 26 * p.s;
  const tilt = new THREE.Group();
  tilt.rotation.z = p.lean;
  g.add(tilt);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 2.2, h, 6), toon('#9a6a3a'));
  trunk.position.y = h / 2;
  withOutline(trunk, 0.2);
  tilt.add(trunk);
  const crown = new THREE.Group();
  crown.position.y = h;
  tilt.add(crown);
  for (let i = 0; i < 6; i++) {
    const arm = new THREE.Group();
    arm.rotation.y = (i / 6) * TAU;
    const leaf = new THREE.Mesh(leafGeo, toon(i % 2 ? '#5cbf4c' : '#49a83d'));
    leaf.scale.set(10 * p.s, 1.4, 3.6 * p.s);
    leaf.position.set(8 * p.s, -2, 0);
    leaf.rotation.z = -0.35;
    withOutline(leaf, 0.1);
    arm.add(leaf);
    crown.add(arm);
  }
  for (let i = 0; i < 3; i++) {
    const nut = new THREE.Mesh(nutGeo, toon('#6b4220'));
    nut.position.set(Math.cos(i * 2.1) * 1.8, -1.5, Math.sin(i * 2.1) * 1.8);
    crown.add(nut);
  }
  return g;
}

// ---------- Forts ----------
// A round stone tower with crenellations, a swivelling gun on top and a flag for whoever holds it.
export const FORT_BASE_Y = 12;
export const FORT_SCALE = 1.35; // towers read as landmarks next to the ships
export function buildFortMesh(f, wx, wz) {
  const g = new THREE.Group();
  g.position.set(wx(f.x), FORT_BASE_Y, wz(f.y));
  g.scale.setScalar(FORT_SCALE);
  const body = new THREE.Group();
  g.add(body);
  const stone = toon('#cfc6b3'), dark = toon('#968d80');
  const base = new THREE.Mesh(new THREE.CylinderGeometry(15, 17.5, 6, 14), dark);
  base.position.y = 3; withOutline(base, 0.05); body.add(base);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(11, 13, 20, 14), stone);
  tower.position.y = 16; withOutline(tower, 0.06); body.add(tower);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(12.6, 12.6, 2, 14), dark);
  band.position.y = 25; body.add(band);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const m = new THREE.Mesh(new THREE.BoxGeometry(4.5, 4, 4.5), stone);
    m.position.set(Math.cos(a) * 10.8, 28, Math.sin(a) * 10.8);
    m.rotation.y = -a;
    withOutline(m, 0.1);
    body.add(m);
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(2, 8, 5.5), toon('#4a3020'));
  door.position.set(12.6, 10, 0); body.add(door);
  const mat = toon('#ffffff', { vertexColors: true });
  bakeChildren(body, mat);
  const turret = new THREE.Group();
  turret.position.y = 26;
  const gun = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.4, 15, 8).rotateZ(-PI / 2), toon('#2a2522'));
  gun.position.set(8, 1.5, 0);
  withOutline(gun, 0.12);
  turret.add(gun);
  g.add(turret);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 18, 5), toon('#7a4a22'));
  pole.position.set(-6, 35, 0);
  g.add(pole);
  const flagMat = toon('#ffffff', { side: THREE.DoubleSide });
  const flagPivot = new THREE.Group();
  flagPivot.position.set(-6, 42, 0);
  flagPivot.add(new THREE.Mesh(new THREE.PlaneGeometry(14, 8, 3, 1).translate(7, 0, 0), flagMat));
  g.add(flagPivot);
  return { g, body, turret, flagPivot, flagMat, mat, pole, team: null };
}
