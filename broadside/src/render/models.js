import * as THREE from 'three';
import { TYPES } from '../config/ships.js';
import { GUNS } from '../config/guns.js';
import { COL, TAU, lerp, clamp } from '../util.js';
import { PAINTS, CLOTHS, LOOK_DEFAULT, ALLY_LOOKS, cleanLook, enemyLook } from '../config/looks.js';
import { R, toon, withOutline } from './gl.js';
import { hullShape, pearShape, liftedExtrude, sailGeometry, sailPatch } from './shapes.js';

const PI = Math.PI;

// ---------- Static batching ----------
// BufferGeometryUtils isn't in three's core, so this is a small merge: walk a built hierarchy and bake every
// static mesh into at most three geometries: opaque toon parts (material colour moved into vertex colours),
// ink outlines (positions only) and translucent flats (vertex colour + alpha). Each becomes one draw call.
// tagFor(mesh) may return [x, y, z, code] for a part: it becomes a per-vertex aTag attribute that the ship
// shaders read to move baked parts (toppling masts, a broken topmast, oars). A part whose geometry carries a
// `bulge` attribute (a sail) writes that, carried into the baked space, into aTag.xyz instead.
// opts.indexed keeps each part's index (smooth shapes share their vertices), so the bake comes out indexed. A
// geometry's own vertex colours tint the material colour; rgba ones (soft-edged flats) tint its opacity too.
// opts.partFor(mesh) may return a number for each part: it becomes a per-vertex aPart attribute (the 3D yard
// lights up the part you tap with it).
const _bi = new THREE.Matrix4(), _bn = new THREE.Matrix3(), _bm = new THREE.Matrix3(), _bv = new THREE.Vector3();
export function bakeStatic(root, skip, uvFor, tagFor, opts) {
  root.updateMatrixWorld(true);
  _bi.copy(root.matrixWorld).invert();
  const indexed = !!(opts && opts.indexed);
  const solid = [], ink = [], glass = [], temp = [];
  const walk = (o) => {
    if (o !== root && skip && skip(o)) return;
    if (o.isMesh) {
      const g = o.geometry.index && !indexed ? o.geometry.toNonIndexed() : o.geometry;
      if (g !== o.geometry) temp.push(g);
      const part = {
        g, m: new THREE.Matrix4().multiplyMatrices(_bi, o.matrixWorld), mats: Array.isArray(o.material) ? o.material : [o.material],
        uv: uvFor ? uvFor(o) : null, tag: tagFor ? tagFor(o) : null, part: opts && opts.partFor ? opts.partFor(o) : null,
      };
      (o.material === R.inkMat ? ink : part.mats[0].transparent ? glass : solid).push(part);
    }
    for (const c of o.children) walk(c);
  };
  walk(root);
  const out = { solid: solid.length ? mergeParts(solid, 3, indexed) : null, ink: ink.length ? mergeParts(ink, 0, indexed) : null, glass: glass.length ? mergeParts(glass, 4, indexed) : null };
  for (const g of temp) g.dispose();
  return out;
}

// colorSize: 0 = positions only, 3 = normals/uv/rgb, 4 = normals/uv/rgba (alpha from material opacity).
function mergeParts(parts, colorSize, indexed) {
  let n = 0, ni = 0;
  for (const p of parts) { n += p.g.attributes.position.count; ni += p.g.index ? p.g.index.count : p.g.attributes.position.count; }
  const full = colorSize > 0;
  const tagged = parts.some((p) => p.tag || p.g.attributes.bulge);
  const parted = parts.some((p) => p.part != null), part = parted ? new Float32Array(n) : null;
  const pos = new Float32Array(n * 3), nor = full ? new Float32Array(n * 3) : null;
  const uv = full ? new Float32Array(n * 2) : null, col = full ? new Float32Array(n * colorSize) : null;
  const tag = tagged ? new Float32Array(n * 4) : null;
  const index = indexed ? (n > 65535 ? new Uint32Array(ni) : new Uint16Array(ni)) : null;
  let o = 0, oi = 0;
  for (const p of parts) {
    const P = p.g.attributes.position, N = p.g.attributes.normal, U = p.g.attributes.uv, Bu = p.g.attributes.bulge, I = p.g.index, cnt = P.count;
    _bn.getNormalMatrix(p.m);
    _bm.setFromMatrix4(p.m);
    if (index) {
      // A mirrored part (negative scale) would turn inside out: wind its triangles back.
      const m = I ? I.count : cnt, flip = p.m.determinant() < 0;
      for (let i = 0; i < m; i += 3) {
        const a = I ? I.getX(i) : i, b = I ? I.getX(i + 1) : i + 1, c = I ? I.getX(i + 2) : i + 2;
        index[oi + i] = o + a; index[oi + i + 1] = o + (flip ? c : b); index[oi + i + 2] = o + (flip ? b : c);
      }
      oi += m;
    }
    if (parted) part.fill(p.part || 0, o, o + cnt);
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
      // A geometry's own vertex colours (terrain shaded by height, render/land.js) tint the material colour.
      // Groups count indices in an indexed geometry, vertices otherwise.
      const multi = p.mats.length > 1 && p.g.groups.length;
      const groups = multi ? p.g.groups : [{ start: 0, count: cnt, materialIndex: 0 }];
      const vc = p.g.attributes.color, rgba = vc && vc.itemSize === 4, viaIndex = multi && I;
      for (const gr of groups) {
        const mt = p.mats[gr.materialIndex] || p.mats[0], c = mt.color;
        const end = Math.min(viaIndex ? I.count : cnt, gr.start + gr.count);
        for (let j = gr.start; j < end; j++) {
          const i = viaIndex ? I.getX(j) : j, k = (o + i) * colorSize;
          col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
          if (vc) { col[k] *= vc.getX(i); col[k + 1] *= vc.getY(i); col[k + 2] *= vc.getZ(i); }
          if (colorSize === 4) col[k + 3] = mt.opacity * (rgba ? vc.getW(i) : 1);
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
  if (parted) g.setAttribute('aPart', new THREE.BufferAttribute(part, 1));
  if (index) g.setIndex(new THREE.BufferAttribute(index, 1));
  g.computeBoundingSphere();
  return g;
}

// Replaces a group's static children with merged meshes; children matching skip stay as they are.
export function bakeChildren(group, mat, skip, uvFor, tagFor, opts) {
  const b = bakeStatic(group, skip, uvFor, tagFor, opts);
  for (const c of [...group.children]) if (!skip || !skip(c)) group.remove(c);
  const out = {};
  if (b.solid) { out.solid = new THREE.Mesh(b.solid, mat); group.add(out.solid); }
  if (b.ink) { out.ink = new THREE.Mesh(b.ink, R.inkMat); group.add(out.ink); }
  return out;
}

// ---------- Looks ----------
// Allegiance first: a ship's side fixes the colours that say whose she is (her rail, the flag at the main, the
// edge of her canvas), whatever she wears. 'merchant' is an escorted friendly trader; the pirate looks fly black
// colours (the boss trimmed in red). Her cosmetics (src/config/looks.js) set everything else: paint, cloth, the
// device on her courses, figurehead, colours, lanterns and gilding.
const LOOKS = {
  player: { rail: COL.blue, flag: COL.blue, edge: COL.blue },
  enemy: { rail: COL.red, flag: COL.red, edge: COL.red },
  boss: { rail: '#f2b632', flag: '#f2b632', edge: '#f2b632' },
  pirate: { rail: '#7a2620', flag: 'roger', edge: null },
  pirateBoss: { rail: '#c0302a', flag: 'rogerBoss', edge: '#c0302a' },
  merchant: { rail: '#3d7a52', flag: COL.blue, edge: '#3d7a52' },
  // An allied captain (the Knights, Venice): a friend's blue rail and canvas edge, his own nation's colours.
  ally: { rail: COL.blue, flag: '#9c1c24', edge: COL.blue },
};
const MERCHANT_LOOK = { paint: 'merchant', cloth: 'merchant', emblem: 'merchant', figurehead: 'scroll', flag: 'colours', lanterns: 1, gilding: 'plain' };
// The tents over a galley's poop, striped in her nation's colours.
const AWNING = {
  english: ['#2f5d9a', '#f2ead2'], spain: ['#a8262a', '#f2d48c'], pirate: ['#2a2630', '#8f8471'], barbary: ['#2f6a4a', '#f2ead2'],
  ottoman: ['#a8262a', '#f2ead2'], venice: ['#8a1f2b', '#e2b13a'], knights: ['#a8262a', '#f4efe2'],
};
// Each nation's colours at the main. A Barbary ship flies one of the coast's (seeded by her name): the Algerine
// stripes of red, gold and green, the green and crescent of Tunis and Tripoli, or the red with Ali's two-bladed
// sword, Zulfiqar; the Sultan's ships the red with three crescents. A flagship's is edged in gilt.
const BANNERS = { barbary: ['algiers', 'tripoli', 'zulfiqar'], ottoman: ['ottoman'], venice: ['venice'], knights: ['knights'] };
// Allies wear their nation's dress (src/config/looks.js ALLY_LOOKS).
export const ALLY_NATIONS = ['venice', 'knights'];

// faction: the battle's faction, for enemy ships the sim didn't tag themselves.
export function shipLook(s, faction) {
  const side = s.origTeam || s.team;
  const pirate = s.faction === 'pirate' || (faction === 'pirate' && side === 'enemy');
  if (s.boss) return pirate ? 'pirateBoss' : 'boss';
  if (pirate) return 'pirate';
  if (s.escort || (side === 'player' && TYPES[s.type] && TYPES[s.type].merchant)) return 'merchant';
  if (side === 'player' && s.ally && ALLY_NATIONS.includes(s.faction)) return 'ally';
  return side === 'player' ? 'player' : 'enemy';
}

// Everything the model needs to dress a ship: her allegiance, the look entries she wears and their colours.
// `key` names it for the template cache, `sailKey` for her canvas.
export function shipDress(s, faction) {
  const base = shipLook(s, faction);
  const T = TYPES[s.type] || {};
  const fac = base === 'pirate' || base === 'pirateBoss' ? 'pirate' : base === 'player' || base === 'merchant' ? 'english' : s.faction || T.faction || faction || 'spain';
  let ids;
  if (base === 'merchant') ids = { ...MERCHANT_LOOK };
  else if (base === 'player') ids = { ...LOOK_DEFAULT, ...cleanLook(s.look) };
  else if (base === 'ally') ids = { ...LOOK_DEFAULT, ...ALLY_LOOKS[fac], ...cleanLook(s.look, { foe: true }) };
  else ids = { ...LOOK_DEFAULT, ...enemyLook(s, fac), ...cleanLook(s.look, { foe: true }) };
  const Lk = LOOKS[base];
  const paint = PAINTS[ids.paint], cloth = CLOTHS[ids.cloth];
  // The colours at her main (a nation's own flag for the Med's sides; else her side's colour, see flagTexture).
  const list = BANNERS[fac], banner = list && base !== 'player' && base !== 'merchant' ? list[bannerSeed(s) % list.length] : null;
  const sailKey = [base, ids.cloth, ids.emblem, fac].join('|');
  return {
    base, fac, ids, Lk, paint, cloth, sailKey, banner,
    key: [sailKey, ids.paint, ids.figurehead, ids.flag, ids.lanterns, ids.gilding, banner || ''].join('|'),
    dark: luma(cloth.color) < 0.35,
  };
}
const bannerSeed = (s) => { let h = 7; for (const ch of String(s.name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
const luma = (hex) => { const c = new THREE.Color(hex); return 0.3 * c.r + 0.59 * c.g + 0.11 * c.b; };

// ---------- Sails and flags ----------
const sailTex = {};
// One canvas per canvas look: the cloth (striped or plain) with its seams, her device, a row of reef points and
// an edge in her side's colour inside an ink line (an ink edge alone with the squadron's band). torn = shot-through canvas with ragged, scorched holes, used
// below half hull (and always on fireships); the holes are alpha-tested out. hd = a 256px canvas for the yard.
// The spars sample the texel at (0.4, 0.15), about (51, 109) on a 128px canvas: a reef point sits on it, so it is
// plain white whatever the cloth and the wood keeps its own colour.
export function sailTexture(dress, torn, hd) {
  const key = dress.sailKey + (torn ? ':torn' : '') + (hd ? ':hd' : '');
  if (sailTex[key]) return sailTex[key];
  const { cloth, ids, Lk, dark, base } = dress;
  const n = hd ? 256 : 128;
  const c = document.createElement('canvas'); c.width = c.height = n;
  const x = c.getContext('2d');
  x.scale(n / 128, n / 128);
  x.fillStyle = cloth.color; x.fillRect(0, 0, 128, 128);
  if (cloth.stripe) { const w = cloth.stripeW || 16; x.fillStyle = cloth.stripe; for (let i = 1; i < 8; i += 2) x.fillRect(i * 16 + (16 - w) / 2, 0, w, 128); }
  x.fillStyle = dark ? 'rgba(255,255,255,0.07)' : 'rgba(150,120,70,0.28)';
  for (let i = 1; i < 8; i++) x.fillRect(i * 16 - 0.5, 0, 1, 128);
  drawEmblem(x, ids.emblem, dress);
  // Reef points across the lower sail (the spars' texel is one of them).
  x.fillStyle = dark ? '#d8d0c0' : 'rgba(120,96,60,0.55)';
  for (let px = 3; px < 128; px += 12) { x.beginPath(); x.arc(px + 0.2, 108.8, 1.5, 0, TAU); x.fill(); }
  x.fillStyle = '#ffffff'; x.fillRect(49.2, 106.8, 4, 4);
  // The edge: her side's colour inside an ink line (bosses keep a broad gilt or red edge).
  const boss = base === 'boss' || base === 'pirateBoss';
  // (The squadron's band already says whose she is: her canvas keeps the plain ink edge with it.)
  const edge = ids.emblem === 'band' ? null : Lk.edge;
  if (edge) { x.strokeStyle = edge; x.lineWidth = boss ? 14 : 12; x.strokeRect(0, 0, 128, 128); }
  x.strokeStyle = COL.ink; x.lineWidth = edge ? 4 : 8; x.strokeRect(0, 0, 128, 128);
  if (torn) tearCanvas(x, dark);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  sailTex[key] = t;
  return t;
}

const GILT = '#e2b13a', GILT_DEEP = '#b8862b', INK_DOT = '#1d1714';
// The device on her courses, centred about (64, 56) of the 128px sail.
function drawEmblem(x, id, dress) {
  const ink = dress.dark ? '#efe6d2' : COL.ink, team = dress.Lk.edge || COL.ink;
  const boss = dress.base === 'boss';
  const outline = (w = 1.6) => { x.strokeStyle = 'rgba(33,26,20,0.75)'; x.lineWidth = w; x.stroke(); };
  x.save();
  switch (id) {
    case 'band': x.fillStyle = team; x.fillRect(0, 50, 128, 26); break;
    case 'george': x.fillStyle = '#c0302a'; x.fillRect(53, 0, 22, 128); x.fillRect(0, 46, 128, 22); break;
    case 'saltire': {
      x.strokeStyle = boss ? '#f2b632' : dress.dark ? '#c0302a' : COL.red; x.lineWidth = 14; x.lineCap = 'round';
      x.beginPath(); x.moveTo(26, 22); x.lineTo(102, 100); x.moveTo(102, 22); x.lineTo(26, 100); x.stroke();
      break;
    }
    case 'santiago': {
      x.fillStyle = '#b8231c';
      x.beginPath(); x.moveTo(58, 26); x.lineTo(70, 26); x.lineTo(69, 88); x.lineTo(64, 104); x.lineTo(59, 88); x.closePath(); x.fill();
      x.fillRect(36, 42, 56, 9);
      for (const [cx, cy] of [[64, 22], [34, 46.5], [94, 46.5]]) { x.beginPath(); x.arc(cx, cy, 7, 0, TAU); x.fill(); }
      break;
    }
    case 'rose': {
      x.translate(64, 56);
      x.fillStyle = '#3f7a43';
      for (let i = 0; i < 5; i++) { x.save(); x.rotate((i + 0.5) * TAU / 5); x.beginPath(); x.moveTo(-5, -14); x.lineTo(0, -31); x.lineTo(5, -14); x.fill(); x.restore(); }
      x.fillStyle = '#c0302a';
      for (let i = 0; i < 5; i++) { const a = i * TAU / 5 - PI / 2; x.beginPath(); x.arc(Math.cos(a) * 15, Math.sin(a) * 15, 13, 0, TAU); x.fill(); outline(); }
      x.fillStyle = '#fbf6ea';
      for (let i = 0; i < 5; i++) { const a = (i + 0.5) * TAU / 5 - PI / 2; x.beginPath(); x.arc(Math.cos(a) * 8, Math.sin(a) * 8, 8, 0, TAU); x.fill(); outline(1.2); }
      x.fillStyle = GILT; x.beginPath(); x.arc(0, 0, 6, 0, TAU); x.fill(); outline(1.2);
      break;
    }
    case 'lion': {
      x.translate(64, 56);
      x.fillStyle = GILT_DEEP; x.beginPath();
      for (let i = 0; i < 24; i++) { const a = i * TAU / 24, r = i % 2 ? 24 : 33; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      x.closePath(); x.fill(); outline();
      x.fillStyle = GILT; x.beginPath(); x.arc(0, 2, 18, 0, TAU); x.fill(); outline();
      for (const ex of [-15, 15]) { x.beginPath(); x.arc(ex, -14, 5, 0, TAU); x.fill(); outline(1.2); }
      x.fillStyle = COL.ink;
      for (const ex of [-7, 7]) { x.beginPath(); x.arc(ex, -2, 2.6, 0, TAU); x.fill(); }
      x.beginPath(); x.moveTo(-5, 6); x.lineTo(5, 6); x.lineTo(0, 11); x.closePath(); x.fill();
      x.strokeStyle = COL.ink; x.lineWidth = 1.8; x.beginPath(); x.moveTo(0, 11); x.lineTo(0, 14); x.moveTo(-7, 16); x.quadraticCurveTo(0, 20, 7, 16); x.stroke();
      break;
    }
    case 'sun': {
      x.translate(64, 56);
      x.fillStyle = GILT;
      for (let i = 0; i < 16; i++) { x.save(); x.rotate(i * TAU / 16); x.beginPath(); x.moveTo(-5, -20); x.lineTo(0, i % 2 ? -32 : -38); x.lineTo(5, -20); x.fill(); x.restore(); }
      x.fillStyle = '#f2c440'; x.beginPath(); x.arc(0, 0, 21, 0, TAU); x.fill(); outline();
      x.fillStyle = COL.ink;
      for (const ex of [-7, 7]) { x.beginPath(); x.arc(ex, -4, 2.4, 0, TAU); x.fill(); }
      x.strokeStyle = COL.ink; x.lineWidth = 1.8; x.beginPath(); x.moveTo(-8, 7); x.quadraticCurveTo(0, 13, 8, 7); x.stroke();
      break;
    }
    case 'anchor': {
      x.translate(64, 56);
      x.strokeStyle = dress.dark ? '#efe6d2' : dress.base === 'player' ? COL.blue : COL.ink; x.lineCap = 'round';
      x.lineWidth = 7; x.beginPath(); x.moveTo(0, -24); x.lineTo(0, 30); x.moveTo(-16, -16); x.lineTo(16, -16); x.stroke();
      x.beginPath(); x.arc(0, 4, 26, 0.25 * PI, 0.75 * PI); x.stroke();
      x.lineWidth = 4; x.beginPath(); x.arc(0, -31, 6, 0, TAU); x.stroke();
      x.fillStyle = x.strokeStyle;
      for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 18, 22); x.lineTo(s * 25, 10); x.lineTo(s * 26, 26); x.closePath(); x.fill(); }
      x.strokeStyle = GILT_DEEP; x.lineWidth = 2.4; x.beginPath(); x.moveTo(-6, -31);
      x.bezierCurveTo(-26, -20, 20, -6, -8, 6); x.bezierCurveTo(-24, 16, 10, 22, 22, 18); x.stroke();
      break;
    }
    case 'skull': drawRoger(x, 64, 54, 1, ink, dress.cloth.color); break;
    case 'crown': {
      x.translate(64, 60);
      x.fillStyle = GILT; x.beginPath(); x.moveTo(-30, 14); x.lineTo(-32, -14); x.lineTo(-16, 0); x.lineTo(0, -22); x.lineTo(16, 0); x.lineTo(32, -14); x.lineTo(30, 14); x.closePath(); x.fill(); outline(1.8);
      x.fillRect(-30, 12, 60, 9); x.beginPath(); x.rect(-30, 12, 60, 9); outline(1.6);
      for (const [cx, cy] of [[-32, -17], [0, -26], [32, -17]]) { x.beginPath(); x.arc(cx, cy, 4, 0, TAU); x.fill(); outline(1.2); }
      x.fillStyle = '#c0302a'; for (const cx of [-17, 0, 17]) { x.beginPath(); x.arc(cx, 16.5, 3, 0, TAU); x.fill(); }
      break;
    }
    case 'swords': {
      x.translate(64, 56); x.lineCap = 'round';
      for (const s of [-1, 1]) {
        x.save(); x.scale(s, 1);
        x.strokeStyle = ink; x.lineWidth = 6; x.beginPath(); x.moveTo(-26, 28); x.quadraticCurveTo(-4, 4, 26, -30); x.stroke();
        x.strokeStyle = GILT; x.lineWidth = 5; x.beginPath(); x.moveTo(-30, 18); x.lineTo(-16, 32); x.stroke();
        x.restore();
      }
      break;
    }
    case 'hourglass': {
      x.translate(64, 56); x.fillStyle = ink;
      x.fillRect(-20, -32, 40, 6); x.fillRect(-20, 26, 40, 6);
      x.beginPath(); x.moveTo(-15, -26); x.lineTo(15, -26); x.lineTo(2, 0); x.lineTo(15, 26); x.lineTo(-15, 26); x.lineTo(-2, 0); x.closePath(); x.fill();
      break;
    }
    case 'crescent': {
      x.translate(60, 56); x.fillStyle = dress.cloth.color === '#a8262a' ? '#fbf3dc' : '#b8231c';
      x.beginPath(); x.arc(0, 0, 28, 0, TAU); x.arc(9, -2, 23, 0, TAU, true); x.fill('evenodd');
      x.beginPath();
      for (let i = 0; i < 10; i++) { const a = i * TAU / 10 - PI / 2, r = i % 2 ? 4 : 10; x.lineTo(24 + Math.cos(a) * r, Math.sin(a) * r); }
      x.closePath(); x.fill();
      break;
    }
    case 'zulfiqar': {
      // Ali's two-bladed sword, point up the sail.
      x.fillStyle = dress.dark || dress.cloth.color === '#a8262a' ? '#fbf3dc' : '#b8231c';
      x.translate(64, 104); x.rotate(-PI / 2 + 0.18);
      zulfiqar(x, 0, 0, 92, 1.05);
      break;
    }
    case 'crescents': {
      // The Sultan's three crescents.
      x.fillStyle = dress.dark || dress.cloth.color === '#a8262a' ? '#fbf3dc' : '#b8231c';
      for (const [cx, cy] of [[46, 34], [82, 34], [64, 72]]) crescent(x, cx, cy, 16, -PI / 2);
      break;
    }
    case 'maltese': {
      // The Order's eight-pointed cross: four arms, each widening to a notched end.
      x.translate(64, 56); x.fillStyle = '#c0302a';
      for (let i = 0; i < 4; i++) {
        x.save(); x.rotate(i * PI / 2);
        x.beginPath(); x.moveTo(0, -3); x.lineTo(-17, -36); x.lineTo(0, -27); x.lineTo(17, -36); x.closePath(); x.fill(); outline(1.4);
        x.restore();
      }
      break;
    }
    case 'markLion': {
      // A red roundel bearing the winged lion of St Mark in gold.
      x.translate(64, 56);
      x.fillStyle = '#9c1c24'; x.beginPath(); x.arc(0, 0, 36, 0, TAU); x.fill(); outline(2);
      x.strokeStyle = GILT; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 32, 0, TAU); x.stroke();
      x.scale(0.82, 0.82); x.translate(-60, -42);
      drawBanner(x, 'lionOnly');
      break;
    }
    case 'merchant': {
      x.fillStyle = 'rgba(205,140,80,0.45)'; for (const sx of [10, 74]) x.fillRect(sx, 0, 22, 128);
      x.fillStyle = '#3d7a52'; x.fillRect(0, 12, 128, 8);
      break;
    }
    default: break;
  }
  x.restore();
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

// The flag at the main: 'roger'/'rogerBoss' (black, skull and crossbones), 'pennant'/'pennantRoger' and 'admiral'
// (in the side's colour, the English ones with a St George canton), 'banner' (a nation's own flag: nat is its id in
// BANNERS, color gilt for a flagship's border), keyed by kind, colour and nation. nat on a pennant or an admiral's
// flag gives it that side's device (a crescent at the hoist; the Kapudan's sword and crescents).
const flagTex = {};
function flagTexture(kind, color, nat) {
  const key = kind + (color || '') + (nat || '');
  if (flagTex[key]) return flagTex[key];
  const pen = kind === 'pennant' || kind === 'pennantRoger';
  const c = document.createElement('canvas'); c.width = pen ? 256 : 128; c.height = pen ? 32 : 80;
  const x = c.getContext('2d');
  const english = color === COL.blue;
  if (kind === 'banner') {
    drawBanner(x, nat);
    if (color) { x.strokeStyle = color; x.lineWidth = 9; x.strokeRect(0, 0, 128, 80); }
    x.strokeStyle = 'rgba(33,26,20,0.55)'; x.lineWidth = 3; x.strokeRect(0, 0, 128, 80);
  } else if (pen && nat && kind === 'pennant') {
    // A crescent at the hoist (the Med's Muslim sides), a white cross (the Knights), a gilt stripe (Venice).
    x.fillStyle = nat === 'barbary' ? '#2f6a4a' : color; x.fillRect(0, 0, 256, 32);
    if (nat === 'knights') { x.fillStyle = '#fbf6ea'; x.fillRect(14, 0, 9, 32); x.fillRect(0, 11.5, 40, 9); }
    else if (nat === 'venice') { x.fillStyle = GILT; x.fillRect(0, 13, 256, 6); }
    else { x.fillStyle = '#fbf6ea'; crescent(x, 20, 16, 11, 0); x.fillStyle = nat === 'barbary' ? '#b8231c' : 'rgba(255,240,200,0.8)'; x.fillRect(40, 13, 216, 6); }
  } else if (kind === 'admiral' && (nat === 'ottoman' || nat === 'barbary')) {
    // The Kapudan Pasha's: crimson, Zulfiqar in gilt between three gilt crescents, a gilt border.
    x.fillStyle = '#9c1c1c'; x.fillRect(0, 0, 128, 80);
    x.fillStyle = GILT; zulfiqar(x, 18, 40, 70, 1.15);
    for (const [cx, cy] of [[100, 18], [100, 62], [114, 40]]) crescent(x, cx, cy, 9, 0);
    x.strokeStyle = GILT; x.lineWidth = 8; x.strokeRect(0, 0, 128, 80);
    x.strokeStyle = 'rgba(33,26,20,0.6)'; x.lineWidth = 3; x.strokeRect(0, 0, 128, 80);
  } else if (kind === 'roger' || kind === 'rogerBoss') {
    x.fillStyle = '#17141a'; x.fillRect(0, 0, 128, 80);
    drawRoger(x, 64, 30, 1, '#f4ecdc', '#17141a');
    if (kind === 'rogerBoss') { x.strokeStyle = '#d23c2c'; x.lineWidth = 10; x.strokeRect(0, 0, 128, 80); }
  } else if (pen) {
    x.fillStyle = kind === 'pennantRoger' ? '#17141a' : color; x.fillRect(0, 0, 256, 32);
    if (english) { x.fillStyle = '#fbf6ea'; x.fillRect(0, 0, 40, 32); x.fillStyle = '#c0302a'; x.fillRect(15, 0, 10, 32); x.fillRect(0, 11, 40, 10); }
    else if (kind === 'pennantRoger') { drawRoger(x, 22, 9, 0.32, '#f4ecdc', '#17141a'); }
    else { x.fillStyle = 'rgba(255,240,200,0.85)'; x.fillRect(0, 13, 256, 6); }
  } else {
    // An admiral's flag: a field in her colour, a gilt fouled anchor (a gilt saltire for the enemy).
    x.fillStyle = color; x.fillRect(0, 0, 128, 80);
    if (english) {
      x.fillStyle = '#fbf6ea'; x.fillRect(0, 0, 46, 32); x.fillStyle = '#c0302a'; x.fillRect(18, 0, 10, 32); x.fillRect(0, 11, 46, 10);
      x.strokeStyle = GILT; x.lineWidth = 6; x.lineCap = 'round';
      x.beginPath(); x.moveTo(84, 18); x.lineTo(84, 66); x.moveTo(72, 26); x.lineTo(96, 26); x.stroke();
      x.beginPath(); x.arc(84, 46, 20, 0.2 * PI, 0.8 * PI); x.stroke();
    } else {
      x.strokeStyle = color === '#f2b632' ? '#c0302a' : GILT; x.lineWidth = 10; x.lineCap = 'round';
      x.beginPath(); x.moveTo(24, 14); x.lineTo(104, 66); x.moveTo(104, 14); x.lineTo(24, 66); x.stroke();
    }
    x.strokeStyle = 'rgba(33,26,20,0.6)'; x.lineWidth = 3; x.strokeRect(0, 0, 128, 80);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  flagTex[key] = t;
  return t;
}
// A crescent (horns toward +x, turned by rot) centred on (cx, cy), r across, in the current fill.
function crescent(x, cx, cy, r, rot) {
  x.save(); x.translate(cx, cy); x.rotate(rot || 0);
  x.beginPath(); x.arc(0, 0, r, 0, TAU); x.arc(r * 0.36, 0, r * 0.8, 0, TAU, true); x.fill('evenodd');
  x.restore();
}
// Zulfiqar, Ali's two-bladed sword, lying along +x from its pommel at (px, py), len long, in the current fill.
function zulfiqar(x, px, py, len, k = 1) {
  x.save(); x.translate(px, py); x.scale(k, k);
  x.beginPath(); x.arc(0, 0, 3.4, 0, TAU); x.fill();
  x.fillRect(2, -2, 12, 4);
  x.fillRect(13, -9, 4, 18);
  x.beginPath(); x.moveTo(17, -4); x.lineTo(len * 0.62, -4.5); x.lineTo(len, -9); x.lineTo(len * 0.7, -0.5);
  x.lineTo(len, 9); x.lineTo(len * 0.62, 4.5); x.lineTo(17, 4); x.closePath(); x.fill();
  x.restore();
}
// A nation's flag on a 128 x 80 canvas (hoist at the left).
function drawBanner(x, id) {
  switch (id) {
    case 'algiers':
      // Algiers: three bands, red, gold and green.
      x.fillStyle = '#b8231c'; x.fillRect(0, 0, 128, 27);
      x.fillStyle = '#e2b13a'; x.fillRect(0, 27, 128, 26);
      x.fillStyle = '#2f6a4a'; x.fillRect(0, 53, 128, 27);
      break;
    case 'tripoli':
      x.fillStyle = '#2f6a4a'; x.fillRect(0, 0, 128, 80);
      x.fillStyle = '#fbf6ea'; crescent(x, 58, 40, 24, 0);
      break;
    case 'zulfiqar':
      x.fillStyle = '#b8231c'; x.fillRect(0, 0, 128, 80);
      x.fillStyle = '#fbf6ea'; zulfiqar(x, 18, 40, 92);
      break;
    case 'ottoman':
      // The Sultan's ships: crimson with three white crescents.
      x.fillStyle = '#b8231c'; x.fillRect(0, 0, 128, 80);
      x.fillStyle = '#fbf6ea';
      for (const [cx, cy] of [[44, 22], [44, 58], [80, 40]]) crescent(x, cx, cy, 14, 0);
      break;
    case 'lionOnly':
    case 'venice': {
      // The banner of St Mark: crimson, the winged lion in gold, a gilt fringe at the fly.
      if (id === 'venice') { x.fillStyle = '#9c1c24'; x.fillRect(0, 0, 128, 80); }
      x.save(); x.translate(56, 46); x.fillStyle = GILT;
      x.beginPath(); x.ellipse(0, 0, 22, 10, 0, 0, TAU); x.fill(); // body
      x.beginPath(); x.arc(22, -10, 10, 0, TAU); x.fill(); // head and mane
      for (const lx of [-16, -8, 10, 18]) x.fillRect(lx, 4, 4, 18); // legs
      x.beginPath(); x.moveTo(-6, -6); x.lineTo(-24, -34); x.lineTo(-14, -30); x.lineTo(-12, -38); x.lineTo(-2, -30); x.lineTo(2, -36); x.lineTo(8, -8); x.closePath(); x.fill(); // wing
      x.lineWidth = 3; x.strokeStyle = GILT; x.beginPath(); x.moveTo(-21, -2); x.quadraticCurveTo(-34, -14, -28, -24); x.stroke(); // tail
      x.fillStyle = '#fbf6ea'; x.fillRect(30, -2, 12, 14); // the book
      x.strokeStyle = '#9c1c24'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(36, -2); x.lineTo(36, 12); x.stroke();
      x.restore();
      if (id === 'venice') { x.fillStyle = GILT; for (let i = 0; i < 8; i++) x.fillRect(118, i * 10 + 1, 10, 6); }
      break;
    }
    case 'knights':
      // The Order of St John: red with a white cross.
      x.fillStyle = '#b8231c'; x.fillRect(0, 0, 128, 80);
      x.fillStyle = '#fbf6ea'; x.fillRect(53, 0, 22, 80); x.fillRect(0, 29, 128, 22);
      break;
    default:
      x.fillStyle = COL.red; x.fillRect(0, 0, 128, 80);
  }
}

// A long swallow-tailed pennant, hoist at the origin, streaming along +x.
function pennantGeometry(len, h) {
  const sh = new THREE.Shape();
  sh.moveTo(0, h / 2); sh.lineTo(len, h * 0.18); sh.lineTo(len * 0.9, 0); sh.lineTo(len, -h * 0.18); sh.lineTo(0, -h / 2); sh.closePath();
  const g = new THREE.ShapeGeometry(sh);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / len, (p.getY(i) + h / 2) / h);
  return g;
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
// The dissolve's discard only compiles in while a ship is fading (SHIP_FADE), since a shader that can discard
// costs tile-based mobile GPUs their hidden-surface removal; likewise the sails alpha-test only once torn.
const DITHER = `uniform float uFade;
void main() {
#ifdef SHIP_FADE
  float dz = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715))));
  if (dz > uFade) discard;
#endif`;
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
  // ---------- The Mediterranean (src/config/ships-med.js) ----------
  // galley: long and low, the rowing frame (telaro) outboard of her sides with the oars on it, a fighting platform
  //   at the bow over her bow battery, the spur (ram) ahead, a striped awning over the poop, a great lantern aft.
  //   oars: a side; oarLen: in beams; oarY: below the deck, in hull depths; railGuns: her broadside is a swivel or
  //   two on the rail. ram: spur length / L. awning: the poop's tent. fore: [length, height, width] of a forecastle
  //   (round: a galleass's round gun-castle). kiosk: an Ottoman pavilion on the poop. gallery: a stern walk.
  galley: {
    galley: true, depth: 0.36, castle: [0.09, 0.32, 0.5], noSprit: true, ram: 0.2, oars: 13, oarLen: 1.3, awning: true,
    rambade: true, railGuns: true, lanternPost: true,
    masts: [{ x: 0.3, h: 0.42, rig: 'lateen', yard: 0.46 }, { x: 0.05, h: 0.58, rig: 'lateen', yard: 0.74, main: true }],
  },
  firegalley: {
    galley: true, depth: 0.36, castle: [0.09, 0.32, 0.5], noSprit: true, ram: 0.14, oars: 10, oarLen: 1.2, railGuns: true,
    tar: true, faggots: true, torn: true,
    masts: [{ x: 0.28, h: 0.4, rig: 'lateen', yard: 0.44 }, { x: 0.02, h: 0.54, rig: 'lateen', yard: 0.66, main: true }],
  },
  galleass: {
    galley: true, depth: 0.5, castle: [0.2, 0.95, 0.78], fore: [0.15, 0.85, 0.84, 'round'], noSprit: true, ram: 0.1, oars: 12, oarLen: 1.05,
    oarY: 0.62, gunY: 0.12, bowGunX: 0.47, bowGunY: 0.5, lanternPost: true,
    masts: [{ x: 0.3, h: 0.5, rig: 'lateen', yard: 0.46 }, { x: 0.03, h: 0.62, rig: 'lateen', yard: 0.64, main: true }, { x: -0.25, h: 0.46, rig: 'lateen', yard: 0.4 }],
  },
  // polacre: square courses on a pole mainmast (no top), lateens fore and mizzen, a jib.
  polacre: {
    depth: 0.46, castle: [0.14, 0.5, 0.62], sprit: 0.34, jib: true, sheer: true,
    masts: [{ x: 0.3, h: 0.5, rig: 'lateen', yard: 0.5 }, { x: 0.02, h: 0.74, main: true, pole: true }, { x: -0.28, h: 0.46, rig: 'lateen', yard: 0.38 }],
  },
  // tartane: one great lateen, a jib and a scrap of a mizzen right aft.
  tartane: {
    depth: 0.48, castle: [0.12, 0.45, 0.6], sprit: 0.36, jib: true, sheer: true,
    masts: [{ x: 0.08, h: 0.66, rig: 'lateen', yard: 0.78, main: true }, { x: -0.38, h: 0.3, rig: 'lateen', yard: 0.24 }],
  },
  // felucca: two lateens raked forward, a few sweeps, almost no freeboard.
  felucca: {
    depth: 0.38, castle: [0.1, 0.3, 0.5], sprit: 0.16, oars: 6, oarLen: 1.1, sheer: true,
    masts: [{ x: 0.24, h: 0.5, rig: 'lateen', yard: 0.6 }, { x: -0.06, h: 0.48, rig: 'lateen', yard: 0.56, main: true }],
  },
  // The Ottoman line: high-charged, a lateen mizzen, a forecastle, a pavilion on the poop.
  kalyon: {
    depth: 0.56, castle: [0.26, 1.15, 0.8], fore: [0.14, 0.5, 0.66], sprit: 0.3, kiosk: true,
    masts: [{ x: 0.27, h: 0.56 }, { x: 0.02, h: 0.68, main: true }, { x: -0.25, h: 0.5, rig: 'lateen', yard: 0.4 }],
  },
  sultana: {
    depth: 0.56, castle: [0.28, 1.28, 0.82], fore: [0.14, 0.55, 0.68], sprit: 0.3, kiosk: true, gallery: true,
    masts: [{ x: 0.28, h: 0.58 }, { x: 0.03, h: 0.72, main: true }, { x: -0.24, h: 0.52, rig: 'lateen', yard: 0.42 }],
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

// Ships are drawn at their old art size (before the fleet pass cut every hull to 3/4, src/config/ships.js) and
// scaled down as a whole, so masts, guns, lanterns and rails shrink with the hull instead of growing chunky on it.
// A model's length on the water is still exactly its class's L.
export const MODEL_SCALE = 0.75;

// Half her breadth at x along her length, at the top of her sides, for a hull drawn on hullShape/pearShape.
const halfCache = new Map();
function hullHalf(L, B, pear) {
  const key = `${L}:${B}:${pear ? 1 : 0}`;
  if (halfCache.has(key)) return halfCache.get(key);
  const pts = (pear ? pearShape(L, B) : hullShape(L, B)).getPoints(24);
  const f = (x) => {
    let best = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (a.x !== b.x && (a.x - x) * (b.x - x) <= 0) best = Math.max(best, Math.abs(lerp(a.y, b.y, (x - a.x) / (b.x - a.x))));
    }
    return best;
  };
  halfCache.set(key, f);
  return f;
}

// ---------- Figureheads ----------
// A carving at the stem head, in its own frame: x forward, y up, base at the origin, k = her scale (about a
// sixth of her beam). gilded: the Almirante's gold leaf over everything.
function figurehead(kind, k, gilded, hd) {
  const g = new THREE.Group();
  const c = (col) => toon(gilded && col !== INK_DOT ? GILT : col);
  const add = (geo, col, x, y, z, rot, sc, ink = 0.1) => {
    const m = new THREE.Mesh(geo, c(col));
    m.position.set(x * k, y * k, z * k);
    if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
    if (sc) m.scale.set(sc[0], sc[1], sc[2]);
    if (ink) withOutline(m, ink);
    g.add(m);
    return m;
  };
  // At sea the carving is a few pixels high: fewer facets there than in the yard.
  const ball = (r) => new THREE.SphereGeometry(r * k, hd ? 12 : 7, hd ? 9 : 5);
  const rod = (r0, r1, len) => new THREE.CylinderGeometry(r0 * k, r1 * k, len * k, hd ? 8 : 5);
  const eyes = (x, y, dz, r = 0.055) => { for (const z of [-dz, dz]) add(ball(r), INK_DOT, x, y, z, null, null, 0); };
  switch (kind) {
    case 'markLion':
    case 'lion': {
      // Crouched to spring off the stem: haunch, chest, a ruff of mane round a snouted head, forepaws out.
      add(ball(0.42), GILT, -0.42, 0.02, 0, null, [1.1, 0.95, 0.9]);
      add(ball(0.5), GILT, 0.18, 0.12, 0, null, [1.35, 0.85, 0.82]);
      add(ball(0.5), GILT_DEEP, 0.78, 0.5, 0, null, [0.75, 1, 1]);
      for (let i = 0; i < 10; i++) {
        const a = i * TAU / 10;
        add(new THREE.ConeGeometry(0.15 * k, 0.5 * k, 5), GILT_DEEP, 0.72, 0.5 + Math.cos(a) * 0.42, Math.sin(a) * 0.42, [a, 0, 0], null, 0.08);
      }
      add(ball(0.33), GILT, 1.02, 0.52, 0);
      add(new THREE.BoxGeometry(0.34 * k, 0.24 * k, 0.32 * k), '#f0c860', 1.3, 0.42, 0, null, null, 0.1);
      add(ball(0.07), INK_DOT, 1.48, 0.5, 0, null, null, 0);
      eyes(1.24, 0.62, 0.13);
      for (const z of [-0.2, 0.2]) add(new THREE.ConeGeometry(0.1 * k, 0.2 * k, 5), GILT, 0.96, 0.84, z, null, null, 0.1);
      for (const z of [-0.24, 0.24]) {
        add(rod(0.11, 0.13, 0.8), GILT, 0.78, -0.18, z, [0, 0, 1.0]);
        add(ball(0.15), GILT, 1.12, -0.42, z, null, [1.3, 0.8, 1]);
      }
      add(new THREE.TorusGeometry(0.32 * k, 0.07 * k, 5, 10, PI * 1.2), GILT, -0.86, 0.32, 0, [0, 0, 0.9], null, 0.12);
      if (kind === 'markLion') {
        // St Mark's: wings raised over his back and the open book under a forepaw.
        for (const z of [-1, 1]) {
          for (let f = 0; f < 3; f++) add(new THREE.BoxGeometry((0.9 - f * 0.16) * k, 0.07 * k, 0.3 * k), f === 2 ? '#f0c860' : GILT, -0.1 + f * 0.05, 0.62 + f * 0.16, z * (0.36 + f * 0.14), [z * (0.7 + f * 0.15), 0, 0.5 + f * 0.1], null, 0.12);
        }
        add(new THREE.BoxGeometry(0.5 * k, 0.1 * k, 0.62 * k), '#f6efdc', 1.3, -0.5, 0, [0, 0, -0.2], null, 0.1);
        add(new THREE.BoxGeometry(0.06 * k, 0.12 * k, 0.6 * k), '#9c1c24', 1.3, -0.46, 0, [0, 0, -0.2], null, 0);
      }
      break;
    }
    case 'unicorn': {
      // Rearing: body, an arched neck and long head, the gilt horn, a mane of tufts, forelegs tucked.
      add(ball(0.46), '#f3eee2', 0.05, 0.06, 0, null, [1.45, 0.8, 0.72]);
      add(rod(0.2, 0.3, 0.9), '#f3eee2', 0.68, 0.48, 0, [0, 0, -0.75]);
      add(new THREE.BoxGeometry(0.62 * k, 0.28 * k, 0.28 * k), '#f3eee2', 1.15, 0.86, 0, [0, 0, -0.45], null, 0.1);
      add(ball(0.17), '#f3eee2', 1.42, 0.7, 0);
      add(new THREE.ConeGeometry(0.07 * k, 0.8 * k, 6), GILT, 1.12, 1.28, 0, [0, 0, -0.75], null, 0.2);
      eyes(1.18, 0.95, 0.13);
      for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(0.09 * k, 0.32 * k, 4), GILT, 0.42 + i * 0.13, 0.62 + i * 0.12, 0, [0, 0, 0.7], null, 0.1);
      for (const z of [-0.2, 0.2]) {
        add(rod(0.08, 0.1, 0.55), '#f3eee2', 0.68, -0.12, z, [0, 0, 0.6]);
        add(rod(0.08, 0.08, 0.42), '#f3eee2', 0.98, -0.22, z, [0, 0, -0.6]);
        add(ball(0.09), GILT, 1.12, -0.36, z, null, null, 0.1);
      }
      break;
    }
    case 'mermaid': {
      // She leans out ahead, one arm forward, her hair streaming back and her tail curling down the stem.
      add(rod(0.26, 0.2, 0.75), '#3e8a74', -0.25, 0.12, 0, [0, 0, 1.25]);
      add(rod(0.2, 0.08, 0.7), '#3e8a74', -0.72, -0.14, 0, [0, 0, 2.0]);
      add(new THREE.BoxGeometry(0.12 * k, 0.5 * k, 0.6 * k), '#3e8a74', -0.98, -0.4, 0, [0, 0, 0.4]);
      add(rod(0.2, 0.25, 0.72), '#e9b88f', 0.4, 0.42, 0, [0, 0, -0.75]);
      add(ball(0.21), '#e9b88f', 0.78, 0.86, 0);
      eyes(0.97, 0.9, 0.08, 0.04);
      add(ball(0.24), '#c4622d', 0.68, 0.94, 0, null, [1, 1, 1.05], 0.08);
      for (let i = 0; i < 4; i++) add(ball(0.15 - i * 0.02), '#c4622d', 0.48 - i * 0.2, 0.86 - i * 0.12, 0, null, [1.3, 1, 0.9], 0.1);
      add(rod(0.07, 0.07, 0.75), '#e9b88f', 0.86, 0.56, 0.2, [0, 0, -1.25]);
      add(rod(0.07, 0.07, 0.55), '#e9b88f', 0.54, 0.24, -0.2, [0, 0, -0.3]);
      add(ball(0.08), GILT, 0.42, 0.62, 0.21, null, null, 0);
      break;
    }
    case 'eagle': {
      // Wings spread up and back, white head and a hooked gilt beak.
      add(ball(0.42), '#5a3c22', 0.25, 0.12, 0, null, [1.4, 0.82, 0.75]);
      add(ball(0.24), '#f1ece0', 0.86, 0.48, 0);
      add(new THREE.ConeGeometry(0.1 * k, 0.32 * k, 6), GILT, 1.12, 0.42, 0, [0, 0, -2.0], null, 0.18);
      eyes(0.95, 0.56, 0.14, 0.045);
      for (const z of [-1, 1]) {
        for (let f = 0; f < 4; f++) {
          add(new THREE.BoxGeometry((0.95 - f * 0.12) * k, 0.07 * k, 0.32 * k), f === 3 ? GILT : '#4a3220', 0.3 + f * 0.04, 0.55 + f * 0.17, z * (0.42 + f * 0.17), [z * (0.5 + f * 0.12), 0, 0.2 + f * 0.08], null, 0.12);
        }
      }
      add(new THREE.BoxGeometry(0.42 * k, 0.08 * k, 0.4 * k), '#f1ece0', -0.48, 0.0, 0, [0, 0, 0.3], null, 0.12);
      break;
    }
    case 'ejder':
    case 'wyvern': {
      // A black wyvern: a long neck, a horned head with a red eye, ribbed wings half open. The Kara Ejder's
      // black dragon wears gilt horns, a gilt crest and gilt-edged wings.
      const dragon = kind === 'ejder', hide = dragon ? '#1f1c22' : '#2a2f2a', vane = dragon ? '#2c2830' : '#3a4a3a', horn = dragon ? GILT : '#efe6d2';
      add(ball(0.42), hide, 0.1, 0.1, 0, null, [1.45, 0.75, 0.72]);
      add(rod(0.13, 0.22, 1.0), hide, 0.72, 0.56, 0, [0, 0, -0.75]);
      add(new THREE.BoxGeometry(0.62 * k, 0.24 * k, 0.28 * k), hide, 1.3, 0.98, 0, [0, 0, -0.2], null, 0.1);
      add(new THREE.BoxGeometry(0.48 * k, 0.1 * k, 0.22 * k), dragon ? '#c0302a' : hide, 1.36, 0.82, 0, [0, 0, -0.42], null, 0.1);
      for (const z of [-0.1, 0.1]) add(new THREE.ConeGeometry(0.05 * k, 0.32 * k, 4), horn, 1.08, 1.2, z, [0, 0, 0.9], null, 0.12);
      for (const z of [-0.15, 0.15]) add(ball(0.065), dragon ? '#ffd65a' : '#e0573c', 1.42, 1.06, z, null, null, 0);
      for (const z of [-1, 1]) {
        for (let f = 0; f < 3; f++) add(new THREE.BoxGeometry((1.0 - f * 0.18) * k, 0.06 * k, 0.24 * k), dragon && f === 2 ? GILT : vane, 0.25 + f * 0.02, 0.62 + f * 0.1, z * (0.45 + f * 0.2), [z * (0.85 - f * 0.1), 0, 0.3 + f * 0.2], null, 0.12);
      }
      if (dragon) for (let i = 0; i < 4; i++) add(new THREE.ConeGeometry(0.07 * k, 0.24 * k, 4), GILT, 0.5 + i * 0.16, 0.58 + i * 0.16, 0, [0, 0, 0.5], null, 0);
      add(new THREE.TorusGeometry(0.34 * k, 0.07 * k, 5, 10, PI * 1.1), hide, -0.66, -0.04, 0, [0, 0, 1.6], null, 0.12);
      break;
    }
    case 'saint':
      add(new THREE.ConeGeometry(0.38 * k, 1.4 * k, 8), '#3b4e86', 0.35, 0.6, 0, [0, 0, -0.35]);
      add(ball(0.22), '#e9b88f', 0.62, 1.36, 0);
      eyes(0.82, 1.4, 0.08, 0.04);
      add(new THREE.TorusGeometry(0.3 * k, 0.05 * k, 6, 16), GILT, 0.5, 1.42, 0, [0, PI / 2, 0], null, 0);
      add(rod(0.06, 0.06, 0.6), '#e9b88f', 0.7, 0.9, 0.18, [0, 0, -1.1]);
      break;
    default: // the plain scroll
      add(new THREE.TorusGeometry(0.5 * k, 0.2 * k, 6, 14, PI * 1.5), gilded ? GILT : '#c79a52', 0.45, 0.5, 0, [0, 0, -0.6]);
      break;
  }
  return g;
}

// ---------- The great ensign ----------
// A flag on the stern staff, in her side's colours, hoist at the origin and flying aft (-x); thin boxes, so it
// bakes with the hull and shows from both sides.
function ensign(dress, w, h) {
  const g = new THREE.Group();
  const box = (bw, bh, depth, col, x, y, rz = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, depth), toon(col));
    m.position.set(x, y, 0); m.rotation.z = rz; g.add(m); return m;
  };
  const { base, fac } = dress;
  const english = base === 'player' || base === 'merchant';
  if (english) {
    box(w, h, 0.3, COL.blue, -w / 2, -h / 2);
    box(w * 0.42, h * 0.5, 0.42, '#fbf6ea', -w * 0.21, -h * 0.25);
    box(w * 0.42, h * 0.11, 0.56, '#c0302a', -w * 0.21, -h * 0.25);
    box(w * 0.09, h * 0.5, 0.56, '#c0302a', -w * 0.21, -h * 0.25);
  } else if (fac === 'pirate') {
    box(w, h, 0.3, '#17141a', -w / 2, -h / 2);
    const a = Math.atan2(h * 0.5, w * 0.5);
    for (const s of [-1, 1]) box(w * 0.55, h * 0.08, 0.44, '#efe6d2', -w / 2, -h * 0.58, s * a);
    const sk = new THREE.Mesh(new THREE.SphereGeometry(h * 0.16, 8, 6), toon('#efe6d2'));
    sk.position.set(-w / 2, -h * 0.4, 0); g.add(sk);
  } else if (dress.banner) {
    // The Med's nations: the same flags as at the main (see drawBanner), in boxes.
    const cres = (r, x, y, col = '#fbf6ea') => {
      const cr = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.3, 4, 12, PI * 1.25), toon(col));
      cr.position.set(x, y, 0); cr.rotation.z = PI * 0.37 + PI; g.add(cr);
    };
    const field = { algiers: '#b8231c', tripoli: '#2f6a4a', zulfiqar: '#b8231c', ottoman: '#b8231c', venice: '#9c1c24', knights: '#b8231c' }[dress.banner] || COL.red;
    box(w, h, 0.3, field, -w / 2, -h / 2);
    switch (dress.banner) {
      case 'algiers': box(w, h / 3, 0.44, '#e2b13a', -w / 2, -h / 2); box(w, h / 3, 0.44, '#2f6a4a', -w / 2, -h * 5 / 6); break;
      case 'tripoli': cres(h * 0.26, -w * 0.45, -h / 2); break;
      case 'zulfiqar':
        box(w * 0.55, h * 0.12, 0.44, '#fbf6ea', -w * 0.48, -h / 2);
        box(w * 0.05, h * 0.42, 0.44, '#fbf6ea', -w * 0.2, -h / 2);
        for (const sgn of [-1, 1]) box(w * 0.2, h * 0.08, 0.44, '#fbf6ea', -w * 0.82, -h / 2 + sgn * h * 0.08, sgn * 0.35);
        break;
      case 'ottoman': cres(h * 0.15, -w * 0.32, -h * 0.27); cres(h * 0.15, -w * 0.32, -h * 0.73); cres(h * 0.15, -w * 0.62, -h / 2); break;
      case 'venice': {
        const lion = new THREE.Mesh(new THREE.SphereGeometry(h * 0.22, 8, 6), toon(GILT));
        lion.position.set(-w * 0.45, -h * 0.55, 0); lion.scale.set(1.6, 0.9, 0.5); g.add(lion);
        box(w * 0.18, h * 0.32, 0.44, GILT, -w * 0.38, -h * 0.3, 0.5);
        break;
      }
      case 'knights': box(w, h * 0.24, 0.44, '#fbf6ea', -w / 2, -h / 2); box(w * 0.16, h, 0.44, '#fbf6ea', -w * 0.42, -h / 2); break;
      default: break;
    }
  } else if (fac === 'barbary' || fac === 'ottoman') {
    box(w, h, 0.3, COL.red, -w / 2, -h / 2);
    const cr = new THREE.Mesh(new THREE.TorusGeometry(h * 0.24, h * 0.07, 5, 14, PI * 1.3), toon('#fbf6ea'));
    cr.position.set(-w * 0.45, -h / 2, 0); cr.rotation.z = 1.2; g.add(cr);
  } else {
    // The Cross of Burgundy: a red saltire on white (on gold for a boss).
    box(w, h, 0.3, base === 'boss' ? '#f2b632' : '#f4efe2', -w / 2, -h / 2);
    const a = Math.atan2(h, w), len = Math.hypot(w, h) * 0.92;
    for (const s of [-1, 1]) box(len, h * 0.15, 0.44, COL.red, -w / 2, -h / 2, s * a);
  }
  return g;
}

// One model per class, look, gun count and fit-out, built once and cloned per ship
// (geometry is shared; materials are per ship so it can flash, scorch, tear and fade on its own).
// opts.parts builds the 3D yard's model: every part tagged for picking and lighting up (aPart, tpl.partCodes),
// its bounds kept (tpl.anchors), and 256px canvas. The yard drops these when it closes (dropTemplates).
const templates = new Map();
export function shipTemplate(s, faction, opts = {}) {
  const dress = shipDress(s, faction);
  const look = dress.base, ids = dress.ids, paint = dress.paint, Lk = dress.Lk;
  const T = TYPES[s.type] || TYPES.brig;
  const sp = SPEC[s.type] || {};
  const ab = (k) => (s.abilities && s.abilities[k]) || (T.abilities && T.abilities[k]) || s[k] || T[k];
  const mortar = !!ab('mortar');
  const parts = !!opts.parts;
  // Her guns as built from her batteries (src/sim/guns.js): kind and count per slot.
  const guns = s.batteries ? s.batteries.map((b) => `${b.slot}=${b.gun}${b.count}`).join(',') : `${s.guns}/${s.chasers}`;
  // Her look is in the key, so each look bakes once (and still draws as one hull, one outline, a rig a mast).
  const key = [s.type, dress.key, guns, mortar ? 1 : 0].join(':') + (parts ? ':yard' : '');
  if (templates.has(key)) return templates.get(key);
  const L = T.L / MODEL_SCALE, B = T.B / MODEL_SCALE, d = B * (sp.depth || 0.5);
  const boss = look === 'boss' || look === 'pirateBoss';
  const gilt = ids.gilding !== 'plain', almirante = ids.gilding === 'almirante', kapudan = ids.gilding === 'kapudan';
  const PARTS = ['', 'hull', 'stern', 'figurehead', 'flags', 'sails', ...(s.batteries || []).map((b) => 'slot:' + b.slot)];
  const part = (m, p) => { m.userData.part = p; return m; };
  const root = new THREE.Group();
  const body = new THREE.Group(); body.name = 'body';
  root.add(body);
  const base = -d * 0.32;
  const shape = (k) => (sp.pear ? pearShape(L * k, B * (k > 1 ? 1.06 : 1)) : hullShape(L * k, B * (k > 1 ? 1.06 : 1)));
  // The deck: a paint may carry its own (the Med's sides scrub theirs a darker, redder wood); a galley's is the
  // dark of her rowing benches.
  const sideC = sp.tar ? '#2b2422' : paint.side, deckC = sp.tar ? '#5c4734' : sp.galley ? '#a8774a' : paint.deck || '#e0ad6b';
  const castleC = sp.tar ? '#382c27' : paint.castle, trim = sp.tar ? '#5a4a3a' : paint.wale;
  const hull = part(new THREE.Mesh(liftedExtrude(shape(1), d, 1.4, sp.pear ? 0.6 : 0.72), [toon(deckC), toon(sideC)]), 'hull');
  hull.position.y = base;
  withOutline(hull, 0.05);
  body.add(hull);
  const wale = part(new THREE.Mesh(liftedExtrude(shape(1.025), 2.2, 0, 0), toon(trim)), 'hull');
  wale.position.y = base + d * 0.55;
  body.add(wale);
  const deckY = base + d + 1.4;
  // A painted band along her upper strake (the corsairs' and the Sultan's bright sides).
  if (paint.band && !sp.tar) {
    const band = part(new THREE.Mesh(liftedExtrude(shape(1.022), 1.3, 0, 0), toon(paint.band)), 'hull');
    band.position.y = deckY - 2.6;
    body.add(band);
  }
  if (almirante && !sp.tar) {
    // A gilt moulding along her sheer.
    const sheer = part(new THREE.Mesh(liftedExtrude(shape(1.03), 0.9, 0, 0), toon(GILT)), 'hull');
    sheer.position.y = deckY - 2.2;
    body.add(sheer);
  }
  const [cl, ch, cw] = sp.castle || [0.2, 0.75, 0.74];
  const cx = -L * (0.49 - cl / 2);
  const castle = part(new THREE.Mesh(new THREE.BoxGeometry(L * cl, d * ch, B * cw), toon(castleC)), 'stern');
  castle.position.set(cx, deckY + d * ch * 0.4, 0);
  withOutline(castle, 0.08);
  body.add(castle);
  // The rail is her side's colour, whatever her paint (blue English, red enemy, gilt boss).
  const rail = part(new THREE.Mesh(new THREE.BoxGeometry(L * (cl + 0.01), 1.6, B * (cw + 0.04)), toon(sp.tar ? '#4a3a30' : Lk.rail)), 'stern');
  rail.position.set(cx, deckY + d * ch * 0.93, 0);
  body.add(rail);
  // The stern: windows, then the gilding she wears (a gilt band, quarter-badges, a taffrail arch and a name board;
  // the Almirante's adds a gallery).
  const sternX = -L * 0.49, cW = B * cw, cH = d * ch;
  const put = (geo, col, x, y, z, p, ink) => { const m = part(new THREE.Mesh(geo, toon(col)), p); m.position.set(x, y, z); if (ink) withOutline(m, ink); body.add(m); return m; };
  const stern = (geo, col, x, y, z, ink) => put(geo, col, x, y, z, 'stern', ink);
  if (!sp.tar) {
    const nWin = B > 26 ? 3 : 2;
    for (let i = 0; i < nWin; i++) stern(new THREE.BoxGeometry(0.9, cH * 0.22, cW * 0.13), '#2b3440', sternX - 0.2, deckY + cH * 0.42, (i - (nWin - 1) / 2) * cW * 0.26);
  }
  if (gilt && !sp.tar) {
    stern(new THREE.BoxGeometry(L * cl + 0.4, Math.max(0.9, cH * 0.07), cW + 0.4), GILT, cx, deckY + cH * 0.8, 0);
    for (const z of [-1, 1]) stern(new THREE.BoxGeometry(L * cl * 0.3, cH * 0.62, 1.2), GILT, cx - L * cl * 0.28, deckY + cH * 0.38, z * (cW / 2 + 0.3), 0.08);
    stern(new THREE.TorusGeometry(cW * 0.3, Math.max(0.6, B * 0.02), 5, 12, PI).rotateY(PI / 2), GILT, sternX - 0.3, deckY + cH * 0.93, 0, 0.12);
    stern(new THREE.BoxGeometry(1.2, cH * 0.2, cW * 0.78), GILT, sternX - 0.25, deckY + cH * 0.12, 0);
    stern(new THREE.BoxGeometry(1.0, cH * 0.13, cW * 0.68), '#3a281c', sternX - 0.6, deckY + cH * 0.12, 0);
    if (almirante || kapudan || (sp.gallery && boss)) {
      // A stern walk: a gilt gallery with its balusters across the great cabin's windows.
      stern(new THREE.BoxGeometry(2.4, cH * 0.08, cW * 0.92), GILT, sternX - 1.2, deckY + cH * 0.27, 0, 0.06);
      for (let i = -3; i <= 3; i++) stern(new THREE.BoxGeometry(0.5, cH * 0.12, 0.5), GILT, sternX - 2.1, deckY + cH * 0.34, i * cW * 0.13);
      stern(new THREE.BoxGeometry(2.4, cH * 0.05, cW * 0.92), GILT, sternX - 1.2, deckY + cH * 0.41, 0);
    }
    if (kapudan) {
      // The Kapudan's: a second gallery above the first, the quarter-badges carried up into turrets, gilt from
      // the wale to the taffrail.
      stern(new THREE.BoxGeometry(2, cH * 0.07, cW * 0.86), GILT, sternX - 1, deckY + cH * 0.58, 0, 0.06);
      for (let i = -2; i <= 2; i++) stern(new THREE.BoxGeometry(0.5, cH * 0.1, 0.5), GILT, sternX - 1.8, deckY + cH * 0.64, i * cW * 0.16);
      for (const z of [-1, 1]) {
        stern(new THREE.CylinderGeometry(1.5, 1.8, cH * 0.5, 8), GILT, sternX + 1.2, deckY + cH * 0.72, z * (cW / 2 + 0.2), 0.08);
        stern(new THREE.ConeGeometry(2, 2.6, 8), '#7e2420', sternX + 1.2, deckY + cH * 1.1, z * (cW / 2 + 0.2), 0.08);
      }
      stern(new THREE.BoxGeometry(L * cl * 0.9, 0.9, cW + 0.5), GILT, cx, deckY - d * 0.15, 0);
    }
  }
  if (sp.awning) {
    // The poop's tent (the carrosse): hoops over the stern deck, cloth in stripes.
    const aw = AWNING[dress.fac] || AWNING.english, aL = L * 0.16, aR = B * 0.38, ax = -L * 0.4, n = 6;
    for (let i = 0; i < n; i++) {
      const g = new THREE.CylinderGeometry(aR, aR, aL, 3, 1, true, (i / n) * PI, PI / n).rotateZ(PI / 2);
      stern(g, boss && i % 2 ? GILT : aw[i % 2], ax, deckY + 0.6, 0);
    }
    stern(new THREE.CylinderGeometry(aR + 0.35, aR + 0.35, 0.8, 10, 1, true, 0, PI).rotateZ(PI / 2), INK_DOT, ax + aL / 2, deckY + 0.6, 0);
    stern(new THREE.CylinderGeometry(aR + 0.35, aR + 0.35, 0.8, 10, 1, true, 0, PI).rotateZ(PI / 2), INK_DOT, ax - aL / 2, deckY + 0.6, 0);
  }
  if (sp.kiosk && !sp.tar) {
    // The poop's pavilion (köşk): pillars under a tented roof, gilt for a flagship.
    const kx = cx - L * cl * 0.12, ky = deckY + cH * 0.86, kw = cW * 0.42;
    for (const [px, pz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) stern(new THREE.BoxGeometry(0.7, 4.4, 0.7), gilt ? GILT : castleC, kx + px * kw * 0.5, ky + 2.2, pz * kw * 0.5);
    stern(new THREE.ConeGeometry(kw * 0.9, 4.2, 4).rotateY(PI / 4), gilt ? GILT : '#7e2420', kx, ky + 6.4, 0, 0.08);
    stern(new THREE.SphereGeometry(0.7, 6, 4), GILT, kx, ky + 8.7, 0);
  }
  if (sp.fore) {
    // A forecastle: a raised deck over the bow (round, for a galleass's gun-castle).
    const [fl, fh, fw, round] = sp.fore, fx = L * (0.47 - fl / 2), fH = d * fh;
    const geo = round ? new THREE.CylinderGeometry(B * fw * 0.5, B * fw * 0.48, fH, 12) : new THREE.BoxGeometry(L * fl, fH, B * fw);
    const fc = part(new THREE.Mesh(geo, toon(castleC)), 'hull');
    if (round) fc.scale.set(L * fl / (B * fw), 1, 1);
    fc.position.set(fx, deckY + fH * 0.4, 0);
    withOutline(fc, 0.06);
    body.add(fc);
    const fr = part(new THREE.Mesh(round ? new THREE.CylinderGeometry(B * fw * 0.52, B * fw * 0.52, 1.4, 12) : new THREE.BoxGeometry(L * fl + 0.6, 1.4, B * fw + 0.6), toon(Lk.rail)), 'hull');
    if (round) fr.scale.copy(fc.scale);
    fr.position.set(fx, deckY + fH * 0.92, 0);
    body.add(fr);
  }
  if (sp.galley) {
    // The rowing frame (telaro) outboard of her sides, the gangway down the middle and, forward, the fighting
    // platform over the bow guns; ahead of it all, the spur.
    const tl = L * 0.64, tx = -L * 0.03, tz = B / 2 + 1.5, ty = deckY - 0.5 - (sp.oarY != null ? d * sp.oarY - 0.9 : 0);
    for (const z of [-1, 1]) {
      const fr = part(new THREE.Mesh(new THREE.BoxGeometry(tl, 1.1, 2.6), toon(trim)), 'hull');
      fr.position.set(tx, ty, z * tz);
      withOutline(fr, 0.06);
      body.add(fr);
    }
    // The gangway (corsia) down her middle between the rowing benches, a bench to each oar.
    put(new THREE.BoxGeometry(L * 0.62, 1.1, B * 0.17), sp.tar ? '#4a3a30' : '#d9b07a', L * 0.0, deckY + 0.5, 0, 'hull');
    const nb = sp.oars || 0;
    for (let i = 0; i < nb; i++) {
      const bx = lerp(-L * 0.32, L * 0.28, i / Math.max(1, nb - 1));
      for (const z of [-1, 1]) put(new THREE.BoxGeometry(1.3, 0.8, B * 0.36), sp.tar ? '#3a2c22' : '#e2bd86', bx, deckY + 0.35, z * B * 0.28, 'hull');
    }
    if (sp.rambade) {
      const rb = part(new THREE.Mesh(new THREE.BoxGeometry(L * 0.09, 1.6, B * 0.86), toon(castleC)), 'hull');
      rb.position.set(L * 0.4, deckY + 2.6, 0);
      withOutline(rb, 0.08);
      body.add(rb);
      for (const z of [-1, 1]) put(new THREE.BoxGeometry(L * 0.09, 1.1, 0.6), Lk.rail, L * 0.4, deckY + 3.8, z * B * 0.42, 'hull');
    }
  }
  if (sp.ram) {
    const rl = L * sp.ram, ram = part(new THREE.Mesh(new THREE.ConeGeometry(B * 0.075, rl, 6).rotateZ(-PI / 2), toon(sideC)), 'hull');
    ram.scale.z = 0.8;
    ram.position.set(L * 0.5 + rl * 0.42, base + d * 0.92, 0);
    ram.rotation.z = 0.08;
    withOutline(ram, 0.1);
    body.add(ram);
    if (!sp.tar) {
      const tip = part(new THREE.Mesh(new THREE.ConeGeometry(B * 0.04, rl * 0.22, 6).rotateZ(-PI / 2), toon(GILT)), 'hull');
      tip.position.set(L * 0.5 + rl * 0.86, base + d * 0.92 + Math.sin(0.08) * rl * 0.44, 0);
      tip.rotation.z = 0.08;
      body.add(tip);
    }
  }
  // Stern lanterns: one on the taffrail, two on the quarters, or all three. A galley carries hers high on posts.
  const lr = clamp(L * 0.024, 1.6, 2.8) * (sp.lanternPost ? 1.25 : 1), nl = clamp(ids.lanterns | 0, 1, 3);
  const lanternAt = [];
  const postH = sp.lanternPost ? cH + 7 : 0;
  if (nl !== 2) lanternAt.push([sternX - 0.6, deckY + cH * 1.2 + postH, 0]);
  if (nl >= 2) for (const z of [-1, 1]) lanternAt.push([sternX + 0.6, deckY + cH * 1.08 + postH * 0.8, z * cW * 0.42]);
  for (const [lx, ly, lz] of lanternAt) {
    if (postH) stern(new THREE.CylinderGeometry(0.35, 0.45, ly - deckY, 5), '#5a3d26', lx, (ly + deckY) / 2 - lr, lz);
    stern(new THREE.SphereGeometry(lr, 8, 6), '#ffd65a', lx, ly, lz, 0.15);
    stern(new THREE.ConeGeometry(lr * 0.75, lr * 0.8, 6), '#2a2522', lx, ly + lr * 1.15, lz);
    // The Sultan's captains crown theirs with a gilt crescent.
    if (kapudan || ((dress.fac === 'ottoman' || dress.fac === 'barbary') && boss)) stern(new THREE.TorusGeometry(lr * 0.5, lr * 0.13, 4, 10, PI * 1.35).rotateZ(-PI * 0.18), GILT, lx, ly + lr * 2.1, lz);
  }
  // The great ensign at the stern staff (every flag but the plain one).
  if (ids.flag !== 'colours' && !sp.tar) {
    const sh = clamp(L * 0.2, 12, 22), lean = 0.25;
    const staff = part(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, sh, 5), toon('#7a4a22')), 'flags');
    staff.position.set(sternX - 0.8 - Math.sin(lean) * sh / 2, deckY + cH * 0.85 + Math.cos(lean) * sh / 2, 0);
    staff.rotation.z = lean;
    body.add(staff);
    const en = part(ensign(dress, clamp(L * 0.17, 10, 19), clamp(L * 0.11, 6.5, 12.5)), 'flags');
    en.position.set(sternX - 0.8 - Math.sin(lean) * sh, deckY + cH * 0.85 + Math.cos(lean) * sh - 0.4, 0);
    en.rotation.set(0, 0.18, 0.3);
    body.add(en);
  }
  const gunMat = toon('#2a2522'), portMat = toon(paint.ports);
  // A gun's barrel from its render hint (src/config/guns.js): length and bore relative to a long gun.
  const barrelGeo = (rh, len, axis) => {
    const g = new THREE.CylinderGeometry(1.5 * rh.bore, 1.9 * rh.bore, len * rh.barrel, 8);
    return axis === 'side' ? g.rotateX(PI / 2) : g.rotateZ(-PI / 2);
  };
  // How far out her side is at x, at height y (her sides tumble home toward the keel).
  const half = hullHalf(L, B, sp.pear), taper = sp.pear ? 0.6 : 0.72;
  const sideAt = (x, y) => { const t = clamp((y - base) / d, 0, 1); return half(x / lerp(0.92, 1, t)) * lerp(taper, 1, t) + 1.1; };
  const slope = (x, y) => (sideAt(x + 1, y) - sideAt(x - 1, y)) / 2;
  const deckMounts = [];
  for (const bt of s.batteries || []) {
    const rh = (GUNS[bt.gun] && GUNS[bt.gun].render) || { barrel: 1, bore: 1 }, n = bt.count, sl = 'slot:' + bt.slot;
    const along = (i) => L * (n === 1 ? (bt.at[0] + bt.at[1]) / 2 : lerp(bt.at[0], bt.at[1], i / (n - 1)));
    if (bt.pos === 'broadside') {
      // Ports along her side: the lower tier low on the hull, the upper a tier above; swivels sit on the rail.
      const side = bt.side === 0 ? -1 : 1, geo = barrelGeo(rh, 6, 'side'); // local +z is starboard
      const swivel = bt.gun === 'swivel' || !!sp.railGuns;
      const y = swivel ? deckY + 1.6 : bt.tier === 'lower' ? deckY - d * 0.45 : bt.tier === 'upper' ? deckY - d * 0.12 : deckY - d * (sp.gunY != null ? sp.gunY : 0.35);
      const pw = 3.3 * Math.max(0.85, rh.bore), portGeo = swivel ? null : new THREE.BoxGeometry(pw, pw * 0.9, 1.4);
      for (let i = 0; i < n; i++) {
        const x = along(i), out = sideAt(x, swivel ? deckY : y);
        const gun = part(new THREE.Mesh(geo, gunMat), sl);
        gun.position.set(x, y, side * (swivel ? out - 0.5 : out + rh.barrel * 6 * 0.2));
        body.add(gun);
        if (portGeo) {
          const port = part(new THREE.Mesh(portGeo, portMat), sl);
          port.position.set(x, y, side * (out - 0.35));
          port.rotation.y = -Math.atan(side * slope(x, y));
          body.add(port);
        }
      }
    } else if (bt.pos === 'bow' || bt.pos === 'stern') {
      // Chase guns poke out over the bow, or from the great cabin's windows astern.
      const fwd = bt.pos === 'bow' ? 1 : -1, geo = barrelGeo(rh, 6, 'long');
      for (let i = 0; i < n; i++) {
        const gun = part(new THREE.Mesh(geo, gunMat), sl);
        // A galley's battery of three or more lies abreast under her fighting platform; a galleass's in her gun-castle.
        const z = n === 1 ? 0 : n === 2 ? (i ? 1 : -1) * B * 0.18 : lerp(-0.24, 0.24, i / (n - 1)) * B;
        gun.position.set(fwd * L * (fwd > 0 ? sp.bowGunX || 0.42 : 0.47), fwd > 0 ? deckY + (sp.bowGunY != null ? d * sp.bowGunY : 0.6) : deckY + d * 0.25, z);
        withOutline(gun, 0.12);
        body.add(gun);
      }
    } else deckMounts.push(bt);
  }
  const wood = toon('#7a4a22');
  const spritLen = L * (sp.sprit || 0.3);
  const spritButt = [L * 0.44, deckY + 1.5], spritDir = [Math.cos(0.28), Math.sin(0.28)];
  const spritTip = [spritButt[0] + spritDir[0] * spritLen, spritButt[1] + spritDir[1] * spritLen];
  if (!sp.noSprit) {
    const sprit = part(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, spritLen, 6), wood), 'sails');
    sprit.rotation.z = -PI / 2 + 0.28;
    sprit.position.set((spritButt[0] + spritTip[0]) / 2, (spritButt[1] + spritTip[1]) / 2 + 1, 0);
    body.add(sprit);
  }
  // The figurehead at her stem head, under the bowsprit (on a xebec, at the end of her beak; on a galley, riding
  // the root of her spur).
  if (!sp.tar) {
    const k = clamp(B * 0.15, 2.4, 6.6) * (sp.ram ? 0.8 : 1);
    const fh = part(figurehead(ids.figurehead, k, almirante, parts), 'figurehead');
    if (sp.beak) fh.position.set(L * 0.6, base + d * 0.9, 0);
    else if (sp.ram) fh.position.set(L * 0.5 + k * 0.4, base + d * 1.02, 0);
    else fh.position.set(L * 0.5 + k * 0.2, deckY - d * (sp.pear ? 0.2 : 0.32), 0);
    fh.rotation.z = 0.42;
    body.add(fh);
  }

  if (sp.beak) {
    // A xebec's long, low beak and an overhanging stern platform.
    const beak = part(new THREE.Mesh(new THREE.ConeGeometry(B * 0.16, L * 0.2, 6).rotateZ(-PI / 2), toon(sideC)), 'hull');
    beak.scale.z = 0.7;
    beak.position.set(L * 0.56, base + d * 0.75, 0);
    withOutline(beak, 0.08);
    body.add(beak);
    const plat = part(new THREE.Mesh(new THREE.BoxGeometry(L * 0.1, 1.4, B * 0.56), toon(deckC)), 'stern');
    plat.position.set(-L * 0.53, deckY + 0.2, 0);
    withOutline(plat, 0.08);
    body.add(plat);
  }
  if (sp.oars) {
    // Each oar is tagged with its thole (aTag), so the body shader can pull the whole bank in stroke.
    const n = sp.oars, Lo = B * (sp.oarLen || 0.95), oarMat = toon(sp.galley ? '#c99a5c' : '#b8894e'), bladeMat = toon(sp.galley ? '#ead0a0' : '#d9b47a');
    const shaft = new THREE.CylinderGeometry(sp.galley ? 0.6 : 0.42, sp.galley ? 0.6 : 0.42, Lo, 5).rotateX(PI / 2);
    const oy = deckY - (sp.oarY != null ? d * sp.oarY : 0.9), oz = sp.galley ? B / 2 + 2.4 : B / 2 + 0.2;
    const [x0, x1] = sp.galley ? [-L * 0.32, L * 0.28] : [-L * 0.27, L * 0.25];
    for (let i = 0; i < n; i++) {
      const ax = lerp(x0, x1, i / (n - 1));
      for (const side of [-1, 1]) {
        const og = part(new THREE.Group(), 'hull');
        og.position.set(ax, oy, side * oz);
        og.rotation.x = side * 0.42;
        og.userData.tag = [ax, oy, side * oz, side > 0 ? 11 : 10];
        const oar = new THREE.Mesh(shaft, oarMat);
        oar.position.z = side * Lo / 2;
        const blade = new THREE.Mesh(sp.galley ? new THREE.BoxGeometry(1.8, 0.6, 5.4) : new THREE.BoxGeometry(1.1, 0.5, 4.2), bladeMat);
        blade.position.z = side * (Lo - 1.8);
        og.add(oar, blade);
        body.add(og);
      }
    }
  }
  // A squat iron mortar on a round bed, cocked up toward the bow, with a few shells beside it.
  const addMortar = (mx, p) => {
    const r = Math.min(B * 0.2, 6.5);
    const grp = part(new THREE.Group(), p);
    body.add(grp);
    const bed = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.45, r * 1.6, 3, 12), toon('#6b4424'));
    bed.position.set(mx, deckY + 1.5, 0);
    withOutline(bed, 0.06);
    grp.add(bed);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 0.9, r * 1.7, 12), toon('#34302e'));
    barrel.position.set(mx + r * 0.25, deckY + 3 + r * 0.7, 0);
    barrel.rotation.z = -0.5;
    withOutline(barrel, 0.08);
    grp.add(barrel);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.12, r * 1.12, r * 0.3, 12), toon('#b08a3a'));
    band.position.copy(barrel.position); band.rotation.z = -0.5;
    grp.add(band);
    const bore = new THREE.Mesh(new THREE.CircleGeometry(r * 0.72, 12).rotateX(-PI / 2), toon('#0f0d0c'));
    bore.position.set(mx + r * 0.25 + Math.sin(0.5) * r * 0.86, deckY + 3 + r * 0.7 + Math.cos(0.5) * r * 0.86 + 0.05, 0);
    bore.rotation.z = -0.5;
    grp.add(bore);
    for (let k = 0; k < 3; k++) {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(1.7, 8, 6), gunMat);
      ball.position.set(mx - r * 1.9, deckY + 1.6 + (k === 2 ? 2.4 : 0), (k === 2 ? 0 : k ? 1.8 : -1.8) + B * 0.18);
      grp.add(ball);
    }
  };
  if (mortar) addMortar(L * (sp.mortarX || 0.145), 'hull');
  for (const bt of deckMounts) {
    const mx = L * (bt.at[0] + bt.at[1]) / 2, sl = 'slot:' + bt.slot;
    if (bt.gun === 'mortar') addMortar(mx, sl);
    else if (bt.gun === 'firepot') {
      // A fire-pot engine: a timber sling frame with a pot of pitch glowing in its cup.
      const frame = part(new THREE.Mesh(new THREE.BoxGeometry(7, 5, 6), toon('#6b4424')), sl);
      frame.position.set(mx, deckY + 2.5, 0);
      withOutline(frame, 0.06);
      const arm = part(new THREE.Mesh(new THREE.BoxGeometry(12, 1.1, 1.1), toon('#7a4a22')), sl);
      arm.position.set(mx, deckY + 6.5, 0); arm.rotation.z = 0.55;
      const pot = part(new THREE.Mesh(new THREE.SphereGeometry(1.9, 8, 6), toon('#e0573c')), sl);
      pot.position.set(mx + 5, deckY + 9.6, 0);
      withOutline(pot, 0.12);
      body.add(frame, arm, pot);
    } else {
      // Swivels on posts at the rail.
      const rh = (GUNS[bt.gun] && GUNS[bt.gun].render) || { barrel: 0.45, bore: 0.4 }, geo = barrelGeo(rh, 6, 'long');
      for (let i = 0; i < bt.count; i++) {
        const gun = part(new THREE.Mesh(geo, gunMat), sl);
        gun.position.set(mx, deckY + 2.2, (i % 2 ? 1 : -1) * B * 0.4);
        body.add(gun);
      }
    }
  }
  if (sp.faggots) {
    // Fireship: the deck is heaped with brushwood bundles and tar barrels.
    const fg = new THREE.CylinderGeometry(1.5, 1.5, B * 0.5, 6).rotateX(PI / 2);
    for (let r = 0; r < 6; r++) {
      for (let k = 0; k < 2; k++) {
        const f = part(new THREE.Mesh(fg, toon((r + k) % 2 ? '#a8813f' : '#8d6a33')), 'hull');
        f.position.set(lerp(-L * 0.24, L * 0.3, r / 5) + k * L * 0.045, deckY + 1.5 + k * 2.6, (k ? 1 : -1) * B * 0.04);
        f.rotation.y = (r % 2 ? 0.12 : -0.1) + k * 0.2;
        withOutline(f, 0.12);
        body.add(f);
      }
    }
    for (const z of [-1, 1]) {
      const bar = part(new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 4.4, 8), toon('#1d1917')), 'hull');
      bar.position.set(-L * 0.3, deckY + 2.2, z * B * 0.2);
      withOutline(bar, 0.12);
      body.add(bar);
    }
  }
  if (sp.cargo) {
    // Merchantman: a hatch, crates and barrels amidships and a carved stern gallery on her high stern.
    const hatch = part(new THREE.Mesh(new THREE.BoxGeometry(L * 0.12, 0.8, B * 0.36), toon('#5a3a1e')), 'hull');
    hatch.position.set(L * 0.17, deckY + 0.4, 0);
    body.add(hatch);
    const crateGeo = new THREE.BoxGeometry(5.5, 4.6, 5.5);
    [[0.15, -0.2, 0], [0.19, 0.2, 0], [0.15, 0.2, 1], [-0.1, -0.2, 0], [-0.07, 0.04, 0]].forEach(([fx, fz, up], i) => {
      const c = part(new THREE.Mesh(crateGeo, toon(i % 2 ? '#c99a5a' : '#b5864c')), 'hull');
      c.position.set(L * fx, deckY + 2.3 + up * 4.6, B * fz);
      c.rotation.y = i * 0.35;
      withOutline(c, 0.08);
      body.add(c);
    });
    for (const [fx, fz] of [[-0.13, 0.22], [-0.17, 0.12], [0.31, -0.18]]) {
      const b = part(new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 4.2, 8), toon('#8a5a2e')), 'hull');
      b.position.set(L * fx, deckY + 2.1, B * fz);
      withOutline(b, 0.1);
      body.add(b);
    }
    stern(new THREE.BoxGeometry(1.4, d * ch * 0.45, B * cw * 0.8), '#e2b13a', -L * 0.495, deckY + d * ch * 0.45, 0);
  }

  const masts = sp.masts || defaultMasts(T);
  const rigTex = sailTexture(dress, !!sp.torn, parts);
  const sailMat = toon('#ffffff', { map: rigTex, side: THREE.DoubleSide });
  const breakH = new THREE.Vector4(1e4, 1e4, 1e4, 0);
  let top = 0, mainIdx = 0, flagMesh = null;
  masts.forEach((M, mi) => {
    const rig = M.rig || 'square', fa = rig !== 'square' ? 1 : 0;
    const mh = L * M.h, mx = L * M.x;
    const mast = part(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.7, mh, 7, 3), wood), 'sails');
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
      mainIdx = mi;
      if (rig === 'square' && !M.pole) {
        const nest = part(new THREE.Mesh(new THREE.CylinderGeometry(3.2, 2.6, 2.6, 10), wood), 'sails');
        nest.position.set(mx, deckY + mh * 0.86, 0);
        nest.userData.tag = mast.userData.tag;
        withOutline(nest, 0.12);
        body.add(nest);
      }
      top = deckY + mh;
      const flagPivot = new THREE.Group();
      flagPivot.name = 'flag';
      flagPivot.position.set(mx, top - 1, 0);
      // The colours at the main: a plain flag, a long pennant or an admiral's flag, always in her side's colour.
      const fk = Lk.flag, roger = fk === 'roger' || fk === 'rogerBoss';
      const kind = ids.flag === 'pennant' ? (roger ? 'pennantRoger' : 'pennant') : ids.flag === 'admiral' && !roger ? 'admiral' : roger ? fk : 'plain';
      // The Med's sides fly their nation's own flag in place of a plain one (dress.banner).
      const banner = kind === 'plain' && dress.banner;
      const tex = banner ? flagTexture('banner', boss ? GILT : null, dress.banner) : kind === 'plain' ? null : flagTexture(kind, roger ? null : fk, dress.banner ? dress.fac : null);
      const flagMat = tex ? toon('#ffffff', { map: tex, side: THREE.DoubleSide }) : toon(fk, { side: THREE.DoubleSide });
      const geo = kind === 'pennant' || kind === 'pennantRoger' ? pennantGeometry(boss ? 52 : 40, boss ? 8 : 6)
        : kind === 'admiral' ? new THREE.PlaneGeometry(22, 14, 4, 1).translate(11, -2, 0) : banner ? new THREE.PlaneGeometry(14, 9, 4, 1).translate(7, -0.5, 0) : new THREE.PlaneGeometry(14, 8, 4, 1).translate(7, 0, 0);
      flagMesh = part(new THREE.Mesh(geo, flagMat), 'flags');
      if (kind === 'plain' && boss) flagMesh.scale.setScalar(banner ? 1.45 : 1.6); // a boss flies a long command pennant
      else if (banner) flagMesh.scale.setScalar(1.12);
      else if (kind === 'roger' || kind === 'rogerBoss') flagMesh.scale.setScalar(1.25);
      flagPivot.add(flagMesh);
      body.add(flagPivot);
    }
  });
  if (sp.jib) {
    // Schooner headsail: a fixed jib from the bowsprit to the foremast head (it stays with the hull bake).
    const fm = masts[0], head = [L * fm.x + 1.5, deckY + L * fm.h * 0.94];
    const tack = [spritTip[0] * 0.97, spritTip[1] + 1.5], clew = [L * 0.27, deckY + 6];
    for (const g of twoSided(sailPatch(tack, clew, head, head, 2.2, 4, 3))) body.add(part(new THREE.Mesh(g, toon(dress.cloth.color)), 'sails'));
    body.add(part(spar([spritTip[0] * 0.97, spritTip[1] + 1], head, 0.35, toon(COL.ink)), 'sails'));
  }
  // The yard's model keeps where each part is (in her own frame) for its hotspots.
  const partOf = (o) => { for (let p = o; p && p !== root; p = p.parent) if (p.userData.part) return p.userData.part; return ''; };
  let anchors = null;
  if (parts) {
    root.updateMatrixWorld(true);
    anchors = {};
    const bb = new THREE.Box3();
    root.traverse((o) => {
      if (!o.isMesh || o.material === R.inkMat) return;
      let p = partOf(o);
      if (!p && o.parent && o.parent.name === 'pivot') p = 'sails';
      if (!p) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      (anchors[p] = anchors[p] || new THREE.Box3()).union(bb);
    });
  }
  // Bake: the static body becomes one toon mesh + one outline; each mast's sails and spars become one mesh.
  const animated = (o) => o.name === 'pivot' || o.name === 'flag';
  const tagUp = (o) => { for (let p = o; p && p !== body; p = p.parent) if (p.userData.tag) return p.userData.tag; return null; };
  const partFor = parts ? (o) => Math.max(0, PARTS.indexOf(partOf(o))) : null;
  const baked = bakeChildren(body, toon('#ffffff', { vertexColors: true }), animated, null, tagUp, { partFor });
  baked.solid.name = 'hullBody';
  if (baked.ink) baked.ink.name = 'hullInk';
  const rigMat = toon('#ffffff', { map: rigTex, side: THREE.DoubleSide, vertexColors: true, alphaTest: 0.5 });
  const rigTag = (o) => [0, 0, 0, o.userData.code || 0];
  for (const pv of body.children.filter((c) => c.name === 'pivot')) {
    // Spars sample a plain texel of the sail texture so the wood colour shows through.
    bakeChildren(pv, rigMat, null, (m) => (m.material === wood ? [0.4, 0.15] : null), rigTag).solid.name = 'rig';
  }
  sailMat.dispose(); // only used while building; the baked rig has its own material
  // What she was built with, for tests and the yard: her look and, slot by slot, the guns and how they're drawn.
  const info = {
    key, look: { ...ids }, base: look, faction: dress.fac,
    guns: (s.batteries || []).map((b) => ({ slot: b.slot, gun: b.gun, count: b.count, ...((GUNS[b.gun] && GUNS[b.gun].render) || {}) })),
  };
  const tpl = {
    root, top, deckY, breakH, mainIdx, flagY: top - 1, brokenFlagY: breakH.getComponent(mainIdx) - 1, look, dress, hd: parts,
    torn: !!sp.torn, oars: !!sp.oars, info, L, B, d, lanterns: lanternAt.map(([x, y, z]) => [x, y, z, lr]),
    partCodes: parts ? Object.fromEntries(PARTS.map((p, i) => [p, i]).filter(([p]) => p)) : null, anchors, flagMesh,
  };
  templates.set(key, tpl);
  return tpl;
}

// Disposes the templates whose key passes `test` (the yard's, when it closes) and their 256px canvases.
export function dropTemplates(test) {
  for (const [key, tpl] of [...templates]) {
    if (!test(key)) continue;
    templates.delete(key);
    tpl.root.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m !== R.inkMat && !m.userData.shared) m.dispose();
    });
  }
  for (const k of Object.keys(sailTex)) if (k.endsWith(':hd')) { sailTex[k].dispose(); delete sailTex[k]; }
}
export const templateKeys = () => [...templates.keys()];

// The yard lights up the part you tap: aPart (from the bake) inside the range uPart, by uGlow, warms the part's paint
// toward gilt and turns its outline gilt.
const HI_DECL = 'attribute float aPart;\nuniform vec2 uPart;\nvarying float vHi;\n';
function hiShader(sh, u, ink) {
  Object.assign(sh.uniforms, { uPart: u.uPart, uGlow: u.uGlow });
  sh.vertexShader = sh.vertexShader.replace('void main() {', HI_DECL + 'void main() {')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvHi = step(uPart.x - 0.5, aPart) * step(aPart, uPart.y + 0.5);');
  sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform float uGlow;\nvarying float vHi;\nvoid main() {');
  sh.fragmentShader = ink
    ? sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.99, 0.9, 0.62), vHi * min(1.0, uGlow * 1.8));')
    : sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += vHi * uGlow * vec3(0.42, 0.3, 0.1);');
}

export function buildShipMesh(s, faction, opts) {
  const tpl = shipTemplate(s, faction, opts);
  const g = tpl.root.clone(true);
  g.scale.setScalar(MODEL_SCALE);
  const u = {
    uFade: { value: 1 }, uMast: { value: new THREE.Vector4(0, 0, 0, -1) },
    uMastH: { value: tpl.breakH.clone() }, uSail: { value: new THREE.Vector4(1, 1, 0, -1) },
  };
  const ref = {
    g, u, tpl, rigs: [], pivots: [], body: null, flagPivot: null, hullMat: null, rigMat: null, inkMat: null,
    top: tpl.top * MODEL_SCALE, vis: 1, boom: 0, oar: 0, torn: tpl.torn, mats: [],
  };
  // The yard's model: the body shaders also light up a part (see hiShader).
  let bodyObc = bodyShader, inkObc = bodyShader;
  if (tpl.partCodes) {
    u.uPart = { value: new THREE.Vector2(-9, -9) }; u.uGlow = { value: 0 };
    bodyObc = function (sh) { bodyShader.call(this, sh); hiShader(sh, u, false); };
    inkObc = function (sh) { bodyShader.call(this, sh); hiShader(sh, u, true); };
  }
  g.traverse((o) => {
    if (o.name === 'body') ref.body = o;
    else if (o.name === 'rig') {
      if (!ref.rigMat) ref.rigMat = shipMaterial(o.material, u, rigShader);
      o.material = ref.rigMat;
      ref.rigs.push(o);
    } else if (o.name === 'pivot') ref.pivots.push(o);
    else if (o.name === 'flag') ref.flagPivot = o;
    else if (o.name === 'hullBody') o.material = ref.hullMat = shipMaterial(o.material, u, bodyObc);
    else if (o.name === 'hullInk') o.material = ref.inkMat = shipMaterial(o.material, u, inkObc);
  });
  ref.mats = [ref.hullMat, ref.rigMat, ref.inkMat].filter(Boolean);
  if (ref.rigMat) ref.rigMat.alphaTest = tpl.torn ? 0.5 : 0;
  ref.fading = false;
  return ref;
}

// Switches a ship's materials into or out of their dissolving variant.
export function setShipFading(ref, on) {
  if (ref.fading === on) return;
  ref.fading = on;
  for (const m of ref.mats) {
    m.defines = m.defines || {};
    if (on) m.defines.SHIP_FADE = ''; else delete m.defines.SHIP_FADE;
    m.needsUpdate = true;
  }
}

// Swaps in (or out) the shot-through canvas; the alpha test that cuts its holes only runs while it's on.
export function setShipTorn(ref, torn) {
  if (ref.torn === torn || !ref.rigMat) return;
  ref.torn = torn;
  ref.rigMat.map = sailTexture(ref.tpl.dress, torn, ref.tpl.hd);
  ref.rigMat.alphaTest = torn ? 0.5 : 0;
  ref.rigMat.needsUpdate = true;
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
// ---------- Forts ----------
// A round stone tower with crenellations, a swivelling gun on top and a flag for whoever holds it.
export const FORT_BASE_Y = 12;
export const FORT_SCALE = 1.35; // towers read as landmarks next to the ships
// look: optional stone colours for the region (render/land.js fortLook): { stone, dark }.
export function buildFortMesh(f, wx, wz, look) {
  const g = new THREE.Group();
  g.position.set(wx(f.x), FORT_BASE_Y, wz(f.y));
  g.scale.setScalar(FORT_SCALE);
  const body = new THREE.Group();
  g.add(body);
  const stone = toon((look && look.stone) || '#cfc6b3'), dark = toon((look && look.dark) || '#968d80');
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
