import * as THREE from 'three';
import { TYPES } from '../config/ships.js';
import { COL, TAU, lerp } from '../util.js';
import { R, toon, withOutline } from './gl.js';
import { hullShape, liftedExtrude, sailGeometry, islandShape } from './shapes.js';

const PI = Math.PI;

// ---------- Static batching ----------
// BufferGeometryUtils isn't in three's core, so this is a small merge: walk a built hierarchy and bake every
// static mesh into at most three geometries: opaque toon parts (material colour moved into vertex colours),
// ink outlines (positions only) and translucent flats (vertex colour + alpha). Each becomes one draw call.
const _bi = new THREE.Matrix4(), _bn = new THREE.Matrix3(), _bv = new THREE.Vector3();
export function bakeStatic(root, skip, uvFor) {
  root.updateMatrixWorld(true);
  _bi.copy(root.matrixWorld).invert();
  const solid = [], ink = [], glass = [], temp = [];
  const walk = (o) => {
    if (o !== root && skip && skip(o)) return;
    if (o.isMesh) {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
      if (g !== o.geometry) temp.push(g);
      const part = { g, m: new THREE.Matrix4().multiplyMatrices(_bi, o.matrixWorld), mats: Array.isArray(o.material) ? o.material : [o.material], uv: uvFor ? uvFor(o) : null };
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
  const pos = new Float32Array(n * 3), nor = full ? new Float32Array(n * 3) : null;
  const uv = full ? new Float32Array(n * 2) : null, col = full ? new Float32Array(n * colorSize) : null;
  let o = 0;
  for (const p of parts) {
    const P = p.g.attributes.position, N = p.g.attributes.normal, U = p.g.attributes.uv, cnt = P.count;
    _bn.getNormalMatrix(p.m);
    for (let i = 0; i < cnt; i++) {
      _bv.fromBufferAttribute(P, i).applyMatrix4(p.m).toArray(pos, (o + i) * 3);
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
  g.computeBoundingSphere();
  return g;
}

// Replaces a group's static children with merged meshes; children matching skip stay as they are.
export function bakeChildren(group, mat, skip, uvFor) {
  const b = bakeStatic(group, skip, uvFor);
  for (const c of [...group.children]) if (!skip || !skip(c)) group.remove(c);
  const out = {};
  if (b.solid) { out.solid = new THREE.Mesh(b.solid, mat); group.add(out.solid); }
  if (b.ink) { out.ink = new THREE.Mesh(b.ink, R.inkMat); group.add(out.ink); }
  return out;
}

// ---------- Sails ----------
const sailTex = {};
// look: 'player' (cream, blue band), 'enemy' (cream, red Burgundy saltire) or 'boss' (crimson, gold saltire).
function sailTexture(look) {
  if (sailTex[look]) return sailTex[look];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = look === 'boss' ? '#a8262a' : '#fbf3dc'; x.fillRect(0, 0, 128, 128);
  x.fillStyle = look === 'boss' ? 'rgba(60,10,10,0.25)' : 'rgba(200,180,130,0.35)';
  for (let i = 1; i < 4; i++) x.fillRect(i * 32 - 1, 0, 2, 128);
  if (look === 'player') {
    x.fillStyle = COL.blue; x.fillRect(0, 50, 128, 26);
  } else {
    x.strokeStyle = look === 'boss' ? '#f2b632' : COL.red; x.lineWidth = 14; x.lineCap = 'round';
    x.beginPath(); x.moveTo(26, 22); x.lineTo(102, 106); x.moveTo(102, 22); x.lineTo(26, 106); x.stroke();
  }
  x.strokeStyle = look === 'boss' ? '#f2b632' : COL.ink; x.lineWidth = 8; x.strokeRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  sailTex[look] = t;
  return t;
}

// ---------- Ships ----------
// One model per class, flag, gun count and fit-out, built once and cloned per ship
// (geometry is shared; the body material is per ship so it can flash when hit).
const templates = new Map();
export function shipTemplate(s) {
  const look = s.boss ? 'boss' : s.team;
  const key = [s.type, look, s.guns, s.chasers].join(':');
  if (templates.has(key)) return templates.get(key);
  const T = TYPES[s.type];
  const L = T.L, B = T.B, d = B * 0.5;
  const isP = look === 'player', isBoss = look === 'boss';
  const trim = isP ? COL.blue : isBoss ? '#e2b13a' : '#c9a227';
  const root = new THREE.Group();
  const body = new THREE.Group(); body.name = 'body';
  root.add(body);
  const base = -d * 0.32;
  const hull = new THREE.Mesh(liftedExtrude(hullShape(L, B), d, 1.4, 0.72), [toon('#e0ad6b'), toon(isP ? '#a5672f' : isBoss ? '#4a2622' : '#7a3a28')]);
  hull.position.y = base;
  withOutline(hull, 0.05);
  body.add(hull);
  const wale = new THREE.Mesh(liftedExtrude(hullShape(L * 1.025, B * 1.06), 2.2, 0, 0), toon(trim));
  wale.position.y = base + d * 0.55;
  body.add(wale);
  const deckY = base + d + 1.4;
  const castle = new THREE.Mesh(new THREE.BoxGeometry(L * 0.2, d * 0.75, B * 0.74), toon(isP ? '#c28145' : isBoss ? '#6b2f2a' : '#93483a'));
  castle.position.set(-L * 0.39, deckY + d * 0.3, 0);
  withOutline(castle, 0.08);
  body.add(castle);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(L * 0.21, 1.6, B * 0.78), toon(isP ? COL.blue : isBoss ? '#f2b632' : COL.red));
  rail.position.set(-L * 0.39, deckY + d * 0.7, 0);
  body.add(rail);
  // Stern lantern
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), toon('#ffd65a'));
  lantern.position.set(-L * 0.5, deckY + d * 0.9, 0);
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
  const sprit = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, L * 0.3, 6), wood);
  sprit.rotation.z = -PI / 2 + 0.28;
  sprit.position.set(L * 0.58, deckY + 4, 0);
  body.add(sprit);
  const mastXs = T.masts === 3 ? [0.27, 0.02, -0.25] : [0.15, -0.18];
  const sailMat = toon('#ffffff', { map: sailTexture(look), side: THREE.DoubleSide });
  let top = 0;
  mastXs.forEach((mxk, mi) => {
    const main = T.masts === 3 ? mi === 1 : mi === 0;
    const mh = L * (main ? 0.66 : 0.54);
    const mx = mxk * L;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.7, mh, 7), wood);
    mast.position.set(mx, deckY + mh / 2, 0);
    withOutline(mast, 0.25);
    body.add(mast);
    const pivot = new THREE.Group();
    pivot.name = 'pivot';
    pivot.position.set(mx, deckY, 0);
    body.add(pivot);
    const w = B * (main ? 1.55 : 1.35);
    for (const t of [{ w, h: mh * 0.4, y: mh * 0.33 }, { w: w * 0.78, h: mh * 0.3, y: mh * 0.7 }]) {
      const sail = new THREE.Mesh(sailGeometry(t.w, t.h), sailMat);
      sail.position.set(0.8, t.y, 0);
      pivot.add(sail);
      const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, t.w * 1.08, 5).rotateX(PI / 2), wood);
      yard.position.set(0.6, t.y + t.h / 2, 0);
      pivot.add(yard);
    }
    if (main) {
      const nest = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 2.6, 2.6, 10), wood);
      nest.position.set(mx, deckY + mh * 0.86, 0);
      withOutline(nest, 0.12);
      body.add(nest);
      top = deckY + mh;
      const flagPivot = new THREE.Group();
      flagPivot.name = 'flag';
      flagPivot.position.set(mx, top - 1, 0);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(14, 8, 4, 1).translate(7, 0, 0), toon(isP ? COL.blue : isBoss ? '#f2b632' : COL.red, { side: THREE.DoubleSide }));
      if (isBoss) flag.scale.setScalar(1.6); // a boss flies a long command pennant
      flagPivot.add(flag);
      body.add(flagPivot);
    }
  });
  // Bake: the static body becomes one toon mesh + one outline; each mast's sails and yards become one mesh.
  const animated = (o) => o.name === 'pivot' || o.name === 'flag';
  const baked = bakeChildren(body, toon('#ffffff', { vertexColors: true }), animated);
  baked.solid.name = 'hullBody';
  const rigMat = toon('#ffffff', { map: sailTexture(look), side: THREE.DoubleSide, vertexColors: true });
  for (const pv of body.children.filter((c) => c.name === 'pivot')) {
    // Yards sample a plain texel of the sail texture so the wood colour shows through.
    bakeChildren(pv, rigMat, null, (m) => (m.material === wood ? [0.4, 0.15] : null)).solid.name = 'rig';
  }
  sailMat.dispose(); // only used while building; the baked rig has its own material
  const tpl = { root, top };
  templates.set(key, tpl);
  return tpl;
}

export function buildShipMesh(s) {
  const tpl = shipTemplate(s);
  const g = tpl.root.clone(true);
  const ref = { g, rigs: [], pivots: [], body: null, flagPivot: null, hullMat: null, top: tpl.top };
  g.traverse((o) => {
    if (o.name === 'body') ref.body = o;
    else if (o.name === 'rig') ref.rigs.push(o);
    else if (o.name === 'pivot') ref.pivots.push(o);
    else if (o.name === 'flag') ref.flagPivot = o;
    else if (o.name === 'hullBody') {
      ref.hullMat = o.material.clone();
      o.material = ref.hullMat;
    }
  });
  return ref;
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
