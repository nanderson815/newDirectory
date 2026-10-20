import * as THREE from 'three';
import { R, toon, withOutline } from './gl.js';
import { buildShipMesh, bakeStatic, dropTemplates, setShipFading, templateKeys } from './models.js';
import { hullShape, foamCollarGeometry } from './shapes.js';
import { TYPES } from '../config/ships.js';
import { makeBatteries } from '../sim/guns.js';
import { COL, clamp, lerp, PI, TAU } from '../util.js';

// The 3D shipyard: the chosen ship of your fleet lying in a fitting-out berth at Port Royal, under warm late light,
// beside a timber wharf with a slipway astern. Built when the shipyard opens and disposed when it closes (the battle
// behind the menus isn't drawn meanwhile), so it costs nothing at sea.
//
// It is drawn with the game's renderer into the whole canvas, its camera's view offset so the ship sits in the
// middle of the 3D window (#yardView, above the ledger in portrait, left of it in landscape). Drag to turn her
// (with inertia), pinch or wheel to zoom, double-tap to set the view back. Lettered keys mark her parts; tapping a
// key or the part itself lights it up on the model, turns the camera to it and calls onPick(part) so the ledger
// opens that section. Parts: hull, sails, figurehead, stern, flags, guns, and 'slot:<id>' for each gun slot.

const Y = {
  active: false, scene: null, camera: null, env: [], view: null, keys: null, onPick: null,
  ship: null, def: null, key: null, leaving: [], extras: null, t: 0,
  orbit: { az: 0.78, el: 0.2, dist: 300, ty: 20, tx: 0 }, goal: null, vel: { az: 0, el: 0 },
  fit: 300, part: null, glow: 0, pulse: 0, rect: { x: 0, y: 0, w: 1, h: 1 }, ptr: new Map(), tap: null, lastTap: null,
  listeners: [], water: null, keyEls: {},
};
export const yardActive = () => Y.active;

// The view the yard opens on (and double-tap returns to): her starboard bow quarter, a little above her rail.
const HOME = { az: 0.8, el: 0.2, ty: 0.46 };
const KEYS = [['hull', 'A', 'The hull'], ['sails', 'B', 'The sails'], ['figurehead', 'C', 'The figurehead'], ['stern', 'D', 'The stern'], ['flags', 'E', 'Her colours'], ['guns', 'F', 'The guns']];
export const YARD_KEYS = Object.fromEntries(KEYS.map(([p, l, n]) => [p, { letter: l, name: n }]));

// ---------- Opening and closing ----------
export function openYardScene(view, keys, { onPick } = {}) {
  if (!R.renderer || Y.active) return false;
  Y.active = true; Y.view = view; Y.keys = keys; Y.onPick = onPick || null;
  Y.scene = new THREE.Scene();
  Y.camera = new THREE.PerspectiveCamera(30, 1, 4, 12000);
  Y.t = 0; Y.part = null; Y.glow = 0; Y.goal = null; Y.ship = null; Y.key = null; Y.def = null; Y.leaving = [];
  Object.assign(Y.orbit, { az: HOME.az, el: HOME.el });
  buildEnvironment();
  bindInput();
  buildKeys();
  return true;
}

export function closeYardScene() {
  if (!Y.active) return;
  Y.active = false;
  for (const [el, ev, fn, o] of Y.listeners) el.removeEventListener(ev, fn, o);
  Y.listeners = [];
  if (Y.ship) disposeShip(Y.ship);
  for (const l of Y.leaving) disposeShip(l.ref);
  disposeExtras();
  Y.ship = null; Y.leaving = [];
  Y.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m !== R.inkMat && !m.userData.shared) { if (m.map) m.map.dispose(); m.dispose(); }
  });
  Y.scene = null; Y.camera = null; Y.water = null; Y.cut = null;
  dropTemplates((k) => k.endsWith(':yard'));
  if (Y.keys) Y.keys.innerHTML = '';
  Y.keyEls = {};
}

function disposeShip(ref) {
  if (Y.scene) Y.scene.remove(ref.g);
  for (const m of ref.mats) m.dispose();
}

// ---------- The ship ----------
// A fleet entry ({ name, cls, up, loadout, look }) as the model builder wants it.
export function yardDef(f) {
  const T = TYPES[f.cls];
  return {
    type: f.cls, name: f.name, team: 'player', origTeam: 'player', look: f.look || {}, abilities: T.abilities,
    batteries: makeBatteries(T, { loadout: f.loadout || {} }, f.up || {}),
  };
}

// Puts a ship in the berth. mode 'swap' (another ship of the fleet: the old one sinks away and the new one rises
// in), 'live' (the same ship refitted or dressed: swapped at once, the changed part lit) or 'open'.
export function yardShow(def, mode = 'live', changed = null) {
  if (!Y.active) return;
  const ref = buildShipMesh(def, undefined, { parts: true });
  if (Y.ship && ref.tpl.info.key === Y.key) { for (const m of ref.mats) m.dispose(); return; }
  const old = Y.ship;
  Y.ship = ref; Y.def = def; Y.key = ref.tpl.info.key;
  Y.scene.add(ref.g);
  ref.fadeIn = mode === 'swap' ? 0 : 1;
  if (mode === 'swap') setShipFading(ref, true);
  if (old) {
    if (mode === 'swap') { setShipFading(old, true); Y.leaving.push({ ref: old, t: 0 }); } else disposeShip(old);
  }
  fitShip(ref, mode);
  shipExtras(ref);
  if (Y.part) setGlow(Y.part);
  if (changed) { Y.pulse = 1; setGlow(changed); }
}

// The camera distance that frames her whole in the 3D window; a new ship (or the yard opening) also brings the
// camera back round to the home view.
function fitShip(ref, mode) {
  const tpl = ref.tpl, top = tpl.top;
  const r = Math.max(tpl.L * 0.62, top * 0.62, 30);
  Y.fit = r / Math.sin(fovRect() / 2) * 1.12;
  if (mode === 'live') { if (Y.goal) Y.goal.dist = Math.min(Y.goal.dist, Y.fit * 1.6); return; }
  let az = HOME.az;
  while (az - Y.orbit.az > PI) az -= TAU;
  while (az - Y.orbit.az < -PI) az += TAU;
  Y.goal = { az, el: HOME.el, dist: Y.fit, ty: top * HOME.ty, tx: 0 };
  if (mode === 'open') { Object.assign(Y.orbit, Y.goal); Y.goal = null; }
}

// The fitting-out lines and her shadow on the water, sized to her (one mesh each, rebuilt with the ship).
function disposeExtras() {
  if (!Y.extras) return;
  for (const m of Y.extras) { Y.scene && Y.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
  Y.extras = null;
}
function shipExtras(ref) {
  disposeExtras();
  const { L, B } = ref.tpl;
  const shadow = new THREE.Mesh(new THREE.ShapeGeometry(hullShape(L * 1.12, B * 1.25)).rotateX(-PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x0b2d4a, transparent: true, opacity: 0.28, depthWrite: false }));
  shadow.position.y = 0.3; shadow.renderOrder = 1;
  const foam = new THREE.Mesh(foamCollarGeometry(), new THREE.MeshBasicMaterial({ color: 0xf2fbff, transparent: true, opacity: 0.55, depthWrite: false }));
  foam.scale.set(L * 0.5, 1, B * 0.5); foam.position.y = 0.4; foam.renderOrder = 2;
  // Mooring lines from her bow and quarter to the wharf's bollards.
  const g = new THREE.Group(), rope = toon('#8a6a42');
  const line = (a, b) => {
    const len = a.distanceTo(b), m = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, len, 4), rope);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.add(m);
  };
  const d = ref.tpl.deckY;
  for (const s of [1, -1]) line(new THREE.Vector3(L * 0.4 * s, d - 1, -B * 0.36), new THREE.Vector3(62 * s, WHARF.top + 3.6, WHARF.z0 - 3));
  const b = bakeStatic(g);
  g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  const lines = new THREE.Mesh(b.solid, cutaway(toon('#ffffff', { vertexColors: true }), Y.cut));
  Y.extras = [shadow, foam, lines];
  for (const m of Y.extras) Y.scene.add(m);
}

// ---------- Highlights ----------
// Lights up a part on the model and turns the camera to it (null clears it).
export function yardHighlight(part, { turn = true } = {}) {
  if (!Y.active) return;
  Y.part = part || null;
  setGlow(Y.part);
  if (turn && part && Y.ship) aim(part);
  syncKeys();
}
function partRange(tpl, part) {
  const pc = tpl.partCodes || {};
  if (part === 'guns') {
    const codes = Object.entries(pc).filter(([k]) => k.startsWith('slot:')).map(([, v]) => v);
    return codes.length ? [Math.min(...codes), Math.max(...codes)] : [-9, -9];
  }
  return pc[part] != null ? [pc[part], pc[part]] : [-9, -9];
}
function setGlow(part) {
  const ref = Y.ship;
  if (!ref) return;
  const [a, b] = part ? partRange(ref.tpl, part) : [-9, -9];
  ref.u.uPart.value.set(a, b);
  ref.glowSails = part === 'sails';
  ref.glowFlag = part === 'flags';
}

// Where the camera goes to look at a part: which way round her, how high, how close (of the full fit) and at what.
function viewFor(part) {
  const tpl = Y.ship.tpl, A = tpl.anchors || {}, side = Math.sin(Y.orbit.az) >= 0 || Math.cos(Y.orbit.az) >= 0 ? 1 : -1;
  const sb = Math.cos(Y.orbit.az) >= 0; // the camera is on her starboard side
  const box = A[part === 'guns' ? Object.keys(A).find((k) => k.startsWith('slot:') && /Lower|^slot:(port|starboard)$/.test(k) && (sb ? /starboard/i.test(k) : /port/i.test(k))) || 'hull' : part];
  const c = box ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3(0, tpl.top * 0.4, 0);
  const port = sb ? 0.32 : PI - 0.32;
  switch (true) {
    case part === 'figurehead': return { az: sb ? 0.95 : PI - 0.95, el: 0.1, dist: 0.36, ty: c.y, tx: c.x };
    case part === 'stern': return { az: sb ? -0.95 : -(PI - 0.95), el: 0.16, dist: 0.4, ty: c.y, tx: c.x };
    case part === 'sails': return { az: Y.orbit.az, el: 0.3, dist: 1.0, ty: tpl.top * 0.5, tx: 0 };
    case part === 'flags': return { az: Y.orbit.az, el: 0.34, dist: 0.95, ty: tpl.top * 0.62, tx: 0 };
    case part === 'hull': return { az: Y.orbit.az, el: 0.14, dist: 0.85, ty: tpl.deckY * 0.6, tx: 0 };
    case part === 'guns': return { az: port, el: 0.14, dist: 0.8, ty: tpl.deckY * 0.5, tx: 0 };
    case part.startsWith('slot:'): {
      const s = (Y.def.batteries || []).find((b) => 'slot:' + b.slot === part);
      if (!s) break;
      if (s.pos === 'bow') return { az: sb ? 1.1 : PI - 1.1, el: 0.22, dist: 0.55, ty: c.y, tx: c.x * 0.6 };
      if (s.pos === 'stern') return { az: sb ? -1.05 : -(PI - 1.05), el: 0.22, dist: 0.55, ty: c.y, tx: c.x * 0.6 };
      if (s.pos === 'deck') return { az: Y.orbit.az, el: 0.55, dist: 0.7, ty: c.y, tx: c.x * 0.6 };
      return { az: s.side === 0 ? PI - 0.3 : 0.3, el: s.tier === 'upper' || s.gun === 'swivel' ? 0.22 : 0.14, dist: 0.82, ty: c.y + tpl.top * 0.12, tx: c.x * 0.4 };
    }
    default: break;
  }
  return { az: Y.orbit.az, el: Y.orbit.el, dist: 1, ty: tpl.top * 0.4, tx: 0 };
}
function aim(part) {
  const v = viewFor(part);
  // Go the short way round.
  let az = v.az;
  while (az - Y.orbit.az > PI) az -= TAU;
  while (az - Y.orbit.az < -PI) az += TAU;
  Y.goal = { az, el: v.el, dist: v.dist * Y.fit, ty: v.ty, tx: v.tx };
  Y.vel.az = Y.vel.el = 0;
}
export function yardReset() {
  if (!Y.ship) return;
  let az = HOME.az;
  while (az - Y.orbit.az > PI) az -= TAU;
  while (az - Y.orbit.az < -PI) az += TAU;
  Y.goal = { az, el: HOME.el, dist: Y.fit, ty: Y.ship.tpl.top * HOME.ty, tx: 0 };
}

// ---------- The berth ----------
const WHARF = { x0: -150, x1: 128, z0: -58, z1: -100, top: 7 };
// The wharf would stand between the camera and her when you look at her larboard side, so it dissolves away (the
// same screen-door the ships fade with) while the camera is over there, like a cutaway in an engraving.
const CUT = `uniform float uCut;
void main() {
  float dz = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715))));
  if (dz < uCut) discard;`;
function cutaway(mat, u) {
  const m = mat.clone();
  m.onBeforeCompile = (sh) => { sh.uniforms.uCut = u; sh.fragmentShader = sh.fragmentShader.replace('void main() {', CUT); };
  m.customProgramCacheKey = () => 'yardCut';
  return m;
}
function buildEnvironment() {
  const scene = Y.scene;
  // Warm late-afternoon light over the harbour, the sun low over her starboard bow.
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x5d7c86, 1.5));
  const sun = new THREE.DirectionalLight(0xffd59a, 2.6);
  sun.position.set(0.75, 0.62, 0.7);
  scene.add(sun);
  scene.fog = new THREE.Fog(0xf2dcb6, 900, 5200);
  // The sky: a dome from a hazy peach horizon to a soft blue overhead.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(6000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#8fbad0') }, mid: { value: new THREE.Color('#d6e3dc') }, low: { value: new THREE.Color('#f6dfb9') } },
    vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top, mid, low; varying vec3 vP;
      void main() { float h = normalize(vP).y; vec3 c = h < 0.04 ? low : h < 0.26 ? mix(low, mid, (h - 0.04) / 0.22) : mix(mid, top, clamp((h - 0.26) / 0.5, 0.0, 1.0));
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
      }`,
  }));
  sky.renderOrder = -1;
  scene.add(sky);
  // Calm water: deeper in the berth, paling into the haze, with slow glints and the wharf's shade.
  Y.water = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000, 1, 1).rotateX(-PI / 2), new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, near: { value: new THREE.Color('#2a84a6') }, far: { value: new THREE.Color('#8cbfc4') }, haze: { value: new THREE.Color('#f2dcb6') } },
    vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uT; uniform vec3 near, far, haze; varying vec3 vW;
      void main() {
        float d = length(vW.xz);
        vec3 c = mix(near, far, smoothstep(140.0, 1500.0, d));
        float w = sin(vW.x * 0.045 + sin(vW.z * 0.021 + uT * 0.5) * 2.2 + uT * 0.35) * sin(vW.z * 0.07 - uT * 0.28 + sin(vW.x * 0.013) * 1.5);
        c += vec3(0.9, 0.95, 1.0) * smoothstep(0.86, 0.97, w) * 0.2 * (1.0 - smoothstep(200.0, 1300.0, d));
        float shade = step(${WHARF.z1.toFixed(1)}, vW.z) * step(vW.z, ${(WHARF.z0 + 4).toFixed(1)}) * step(${WHARF.x0.toFixed(1)}, vW.x) * step(vW.x, ${WHARF.x1.toFixed(1)});
        c *= 1.0 - shade * 0.28;
        c = mix(c, haze, smoothstep(800.0, 4000.0, d));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  scene.add(Y.water);
  // Everything of timber, stone and canvas bakes into one mesh and one outline: the wharf by itself (it can
  // dissolve), and the rest.
  const wharf = new THREE.Group(), rest = new THREE.Group();
  let into = wharf;
  const put = (m, x, y, z, rot, ink) => { m.position.set(x, y, z); if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0); if (ink) withOutline(m, ink); into.add(m); return m; };
  const box = (w, h, dd, col, x, y, z, ink = 0.04, rot) => put(new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), toon(col)), x, y, z, rot, ink);
  const cyl = (r0, r1, h, col, x, y, z, ink = 0.08, rot, seg = 8) => put(new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), toon(col)), x, y, z, rot, ink);
  const ball = (r, col, x, y, z, ink = 0) => put(new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), toon(col)), x, y, z, null, ink);
  const { x0, x1, z0, z1, top } = WHARF, zm = (z0 + z1) / 2;
  // The wharf: planks laid across, piles beneath, a fender along her side of it.
  for (let x = x0, i = 0; x < x1; x += 6, i++) box(5.7, 2, z0 - z1, ['#b08250', '#a37646', '#b98c58', '#a87b4a'][i % 4], x + 3, top - 1, zm, 0);
  box(x1 - x0, 2.4, 1.8, '#6b4a2e', (x0 + x1) / 2, top - 1.6, z0 + 0.7, 0.03);
  for (let x = x0 + 4; x <= x1; x += 18) for (const z of [z0 + 1.6, zm, z1 + 1.6]) cyl(1.6, 1.8, 18, '#5d4128', x, top - 9, z, 0.08);
  // Bollards, barrels, crates, a gun waiting to be swayed aboard and its shot, coils of rope, a capstan.
  for (const x of [-62, -4, 62]) { cyl(1.8, 2.1, 4, '#3b2f28', x, top + 2, z0 - 3); cyl(2.5, 2.5, 0.8, '#3b2f28', x, top + 4.2, z0 - 3, 0); }
  const barrel = (x, z, up = 0) => { cyl(2.6, 2.6, 5.6, '#8a5a2e', x, top + 2.8 + up * 5.6, z, 0.08, null, 10); for (const dy of [-1.8, 1.8]) cyl(2.75, 2.75, 0.6, '#3b2f28', x, top + 2.8 + up * 5.6 + dy, z, 0, null, 10); };
  barrel(-40, z0 - 16); barrel(-34, z0 - 17); barrel(-37, z0 - 22); barrel(-37, z0 - 19, 1); barrel(48, z0 - 28); barrel(54, z0 - 30);
  [[-22, -14, 0, 0.2], [-16, -24, 0, -0.3], [-19, -19, 1, 0.5], [92, -18, 0, 0.1], [98, -27, 0, 0.6], [95, -22, 1, 0.3]].forEach(([x, dz, up, r]) => box(6, 5.2, 6, up ? '#c99a5a' : '#b5864c', x, top + 2.6 + up * 5.2, z0 + dz, 0.07, [0, r, 0]));
  box(9, 2.6, 5, '#6b4424', 22, top + 2, z0 - 15, 0.06);
  cyl(1.4, 1.9, 11, '#2a2522', 24, top + 4.2, z0 - 15, 0.1, [0, 0, -PI / 2 + 0.12]);
  for (const [wx, wz] of [[19, -12.2], [25, -12.2], [19, -17.8], [25, -17.8]]) cyl(1.5, 1.5, 0.9, '#4a3020', wx, top + 1.5, z0 + wz, 0.08, [PI / 2, 0, 0], 10);
  [[0, 0, 0], [3, 0, 0], [1.5, 0, 2.6], [1.5, 2.4, 0.9]].forEach(([dx, dy, dz]) => ball(1.5, '#2a2522', 33 + dx, top + 1.5 + dy, z0 - 20 + dz));
  for (const [x, z] of [[-58, -14], [64, -16]]) put(new THREE.Mesh(new THREE.TorusGeometry(2.8, 1.1, 6, 14), toon('#b08a5a')), x, top + 1.1, z0 + z, [PI / 2, 0, 0], 0.08);
  cyl(3.2, 4, 6, '#6b4424', 4, top + 3, z0 - 30, 0.06); cyl(0.5, 0.5, 14, '#7a4a22', 4, top + 6.5, z0 - 30, 0, [0, 0, PI / 2]); cyl(0.5, 0.5, 14, '#7a4a22', 4, top + 6.5, z0 - 30, 0, [PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) box(40, 2.4, 3.2, i % 2 ? '#c49a62' : '#b8894f', -100 + (i % 2) * 2, top + 1.2 + Math.floor(i / 2) * 2.4, z0 - 30 - (i % 2) * 3.4, 0.03);
  // Scaffolding beyond her bow, and a pair of sheer-legs astern, at the wharf's edge.
  for (const sx of [108, 122]) for (const sz of [z0 - 3, z0 - 17]) cyl(0.8, 0.8, 56, '#8a6a42', sx, top + 28, sz, 0.12, null, 5);
  for (const y of [18, 34, 50]) { box(18, 1, 1, '#8a6a42', 115, top + y, z0 - 3, 0); box(18, 1, 1, '#8a6a42', 115, top + y, z0 - 17, 0); box(15, 0.8, 15, '#b08250', 115, top + y + 0.8, z0 - 10, 0.03); }
  cyl(0.7, 0.7, 44, '#8a6a42', 115, top + 22, z0 - 10, 0, [0.88, 0, 0], 5);
  for (const dz of [-8, 8]) cyl(1.1, 1.3, 78, '#7a5a38', -126, top + 36, z0 - 12 + dz, 0.1, [dz > 0 ? -0.12 : 0.12, 0, -0.32], 6);
  box(3, 3, 3, '#3b2f28', -138.5, top + 73, z0 - 12, 0.08); cyl(0.35, 0.35, 36, '#3b2f28', -138.5, top + 55, z0 - 12, 0, null, 4);
  cyl(0.7, 0.9, 22, '#3b2f28', x1 - 5, top + 11, z0 - 3, 0.1, null, 6);
  box(3, 4, 3, '#ffd65a', x1 - 5, top + 23, z0 - 3, 0.12);
  into = rest;
  // The slipway astern of her, with a new hull in frame on the ways: keel, ribs and a scaffold.
  box(200, 1.6, 50, '#9c7246', -262, 3.5, 0, 0.03, [0, 0, -0.14]);
  for (const z of [-15, 15]) box(206, 3, 3, '#5d4128', -262, 5.2, z, 0.04, [0, 0, -0.14]);
  const slipY = (x) => 3.5 + (-162 - x) * Math.tan(0.14);
  box(120, 3, 3, '#6b4a2e', -282, slipY(-282) + 6, 0, 0.06, [0, 0, -0.14]);
  for (let i = 0; i < 9; i++) {
    const x = -236 - i * 12, r = 17 - Math.abs(i - 3.5) * 1.6;
    put(new THREE.Mesh(new THREE.TorusGeometry(r, 0.9, 5, 14, PI), toon('#b98c58')), x, slipY(x) + 6 + r, 0, [0, PI / 2, PI - 0.14], 0.1);
  }
  for (const x of [-226, -262, -300]) for (const z of [-26, 26]) cyl(0.7, 0.7, 46, '#8a6a42', x, slipY(x) + 22, z, 0.12, null, 5);
  for (const x of [-226, -262, -300]) box(1, 1, 54, '#8a6a42', x, slipY(x) + 34, 0, 0);
  // The yard's shore: a strand, a ropewalk shed with a tiled roof, palms.
  box(260, 24, 560, '#cfb487', -470, -3, -40, 0.02);
  box(300, 30, 560, '#8aa36f', -560, 2, -40, 0.02);
  box(64, 26, 80, '#c9a679', -420, 22, -80, 0.04);
  put(new THREE.Mesh(new THREE.CylinderGeometry(44, 44, 88, 3, 1).rotateX(PI / 2), toon('#a4553a')), -420, 44, -80, [0, 0, PI / 2], 0.03).scale.set(0.82, 0.4, 1);
  box(12, 16, 0.8, '#3b2a1e', -387.6, 17, -80, 0);
  const palm = (x, z, h, lean) => {
    cyl(1.2, 1.8, h, '#8a6a42', x, h / 2, z, 0.08, [0, 0, lean], 6);
    const tx = x - Math.sin(lean) * h, ty = Math.cos(lean) * h;
    for (let k = 0; k < 6; k++) { const a = k * TAU / 6; put(new THREE.Mesh(new THREE.ConeGeometry(2.4, 16, 4), toon(k % 2 ? '#4f7f3e' : '#5d8f48')), tx + Math.cos(a) * 6, ty - 1.5, z + Math.sin(a) * 6, [Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25], 0.06); }
  };
  palm(-360, 120, 40, 0.18); palm(-372, 150, 34, -0.1); palm(-350, -190, 44, 0.12); palm(-400, 60, 30, 0.05);
  // Across the harbour: Port Royal on its spit, the Point's fort, and the Blue Mountains behind in the haze.
  // The mountains and clouds are flat painted silhouettes (unlit), paling with distance like a print's background.
  const far = new THREE.Group();
  into = far;
  const hill = (x, z, r, h, col, seg = 22) => put(new THREE.Mesh(new THREE.SphereGeometry(r, seg, 6, 0, TAU, 0, PI / 2), toon(col)), x, -2, z).scale.y = h / r;
  hill(900, -3600, 1900, 640, '#9fb4cc'); hill(-1100, -3400, 1500, 520, '#a6b9cf'); hill(2700, -3000, 1300, 420, '#a9bbd0');
  hill(-300, -2700, 1300, 330, '#8ea7c2'); hill(-2400, -2400, 1100, 300, '#97aec7'); hill(1800, -2300, 900, 250, '#93abc5');
  hill(-200, -1300, 900, 70, '#9cb390');
  into = rest;
  for (let i = 0; i < 26; i++) {
    const x = -900 + i * 46 + (i % 3) * 7, z = -980 - (i % 4) * 26 - Math.abs(i - 13) * 6;
    const hgt = 16 + (i % 3) * 8;
    box(28, hgt, 24, i % 3 ? '#efe6d2' : '#e3d2b2', x, hgt / 2 + 2, z, 0);
    put(new THREE.Mesh(new THREE.ConeGeometry(21, 13, 4), toon(i % 2 ? '#b2553a' : '#9a4a32')), x, hgt + 8, z, [0, PI / 4, 0]);
  }
  box(22, 70, 22, '#e6dcc6', -420, 37, -1000, 0); put(new THREE.Mesh(new THREE.ConeGeometry(16, 30, 4), toon('#7a4a3a')), -420, 87, -1000, [0, PI / 4, 0]);
  cyl(46, 52, 48, '#cfc6b3', 520, 22, -1000, 0.02, null, 16);
  cyl(50, 50, 6, '#968d80', 520, 48, -1000, 0, null, 16);
  cyl(0.9, 0.9, 40, '#5d4128', 520, 70, -1000, 0, null, 4);
  box(18, 11, 0.8, COL.blue, 530, 84, -1000, 0);
  // A buoy, and a ship's boat lying off.
  cyl(3, 4.4, 7, '#c0302a', 200, 1.5, 160, 0.1, null, 10);
  put(new THREE.Mesh(new THREE.CylinderGeometry(4, 3, 18, 8, 1, false, 0, PI).rotateZ(PI / 2).rotateX(PI), toon('#a5672f', { side: THREE.DoubleSide })), 150, 2.5, 60, [0, 0.4, 0], 0.05);
  // A few soft clouds over the hills.
  for (const [x, y, z, s] of [[-900, 620, -2600, 1], [300, 760, -3000, 1.4], [1500, 560, -2300, 0.9], [-2200, 700, -1800, 1.1]]) {
    into = far;
    for (let k = 0; k < 5; k++) ball(70 * s * (k === 2 ? 1.5 : 1), '#fff8ec', x + (k - 2) * 90 * s, y + (k === 2 ? 30 : 0) * s, z).scale.y = 0.6;
    into = rest;
  }
  const bake = (g, cut) => {
    const b = bakeStatic(g);
    g.traverse((o) => { if (o.isMesh && o.material !== R.inkMat) o.geometry.dispose(); });
    const solid = toon('#ffffff', { vertexColors: true }), ink = R.inkMat;
    if (b.solid) scene.add(new THREE.Mesh(b.solid, cut ? cutaway(solid, cut) : solid));
    if (b.ink) scene.add(new THREE.Mesh(b.ink, cut ? cutaway(ink, cut) : ink));
    if (cut) solid.dispose();
  };
  Y.cut = { value: 0 };
  bake(wharf, Y.cut);
  bake(rest, null);
  const fb = bakeStatic(far);
  far.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  scene.add(new THREE.Mesh(fb.solid, new THREE.MeshBasicMaterial({ vertexColors: true })));
}

// ---------- The 3D window ----------
// The camera sees the whole canvas, but its optical centre is the middle of #yardView, and the field of view is
// set so the window (not the canvas) holds her.
const FOV = 30 * PI / 180;
function fovRect() { return FOV; }
function layout() {
  const el = Y.view, cw = R.renderer.domElement.clientWidth || window.innerWidth, ch = R.renderer.domElement.clientHeight || window.innerHeight;
  const r = el ? el.getBoundingClientRect() : { left: 0, top: 0, width: cw, height: ch };
  Y.rect = { x: r.left, y: r.top, w: Math.max(1, r.width), h: Math.max(1, r.height), cw, ch };
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const fw = 2 * Math.max(cx, cw - cx), fh = 2 * Math.max(cy, ch - cy);
  // The window's own frame: the narrower of its two field-of-view halves fits her.
  const aspect = r.width / Math.max(1, r.height);
  const halfV = aspect < 1 ? Math.atan(Math.tan(FOV / 2) / aspect) : FOV / 2;
  const cam = Y.camera;
  cam.fov = 2 * Math.atan(Math.tan(halfV) * fh / Math.max(1, r.height)) * 180 / PI;
  cam.aspect = fw / fh;
  cam.setViewOffset(fw, fh, fw / 2 - cx, fh / 2 - cy, cw, ch);
  cam.updateProjectionMatrix();
}

// ---------- Input ----------
function on(el, ev, fn, o) { el.addEventListener(ev, fn, o); Y.listeners.push([el, ev, fn, o]); }
function bindInput() {
  const el = Y.view;
  if (!el) return;
  on(el, 'pointerdown', (e) => {
    if (e.target.closest('button')) return;
    el.setPointerCapture && el.setPointerCapture(e.pointerId);
    Y.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Y.ptr.size === 1) Y.tap = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
    else Y.tap = null;
    Y.goal = null;
    Y.vel.az = Y.vel.el = 0;
  });
  on(el, 'pointermove', (e) => {
    const p = Y.ptr.get(e.pointerId);
    if (!p) return;
    const pts = [...Y.ptr.values()];
    if (Y.ptr.size >= 2) {
      const [a, b] = pts, d0 = Math.hypot(a.x - b.x, a.y - b.y);
      p.x = e.clientX; p.y = e.clientY;
      const d1 = Math.hypot(a.x - b.x, a.y - b.y);
      if (d0 > 10 && d1 > 10) zoomBy(d0 / d1);
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (Y.tap) Y.tap.moved += Math.abs(dx) + Math.abs(dy);
    const k = 3.2 / Math.max(300, Y.rect.w);
    Y.orbit.az -= dx * k; Y.orbit.el = clamp(Y.orbit.el + dy * k * 0.7, 0.03, 1.15);
    const dt = 1 / 60;
    Y.vel.az = lerp(Y.vel.az, -dx * k / dt, 0.5); Y.vel.el = lerp(Y.vel.el, dy * k * 0.7 / dt, 0.5);
  });
  const up = (e) => {
    if (!Y.ptr.has(e.pointerId)) return;
    Y.ptr.delete(e.pointerId);
    const tp = Y.tap;
    Y.tap = null;
    if (tp && tp.moved < 8 && performance.now() - tp.t < 350) {
      Y.vel.az = Y.vel.el = 0;
      const now = performance.now(), last = Y.lastTap;
      if (last && now - last.t < 320 && Math.hypot(last.x - e.clientX, last.y - e.clientY) < 30) { Y.lastTap = null; yardReset(); return; }
      Y.lastTap = { t: now, x: e.clientX, y: e.clientY };
      const part = pickAt(e.clientX, e.clientY);
      if (part) choose(part);
    }
  };
  on(el, 'pointerup', up);
  on(el, 'pointercancel', up);
  on(el, 'wheel', (e) => { e.preventDefault(); zoomBy(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
}
function zoomBy(k) {
  const g = Y.goal;
  Y.orbit.dist = clamp(Y.orbit.dist * k, Y.fit * 0.35, Y.fit * 1.7);
  if (g) g.dist = Y.orbit.dist;
}
function choose(part) {
  yardHighlight(part);
  if (Y.onPick) Y.onPick(part);
}

// What's under a point on the screen: the part of her the ray meets first, with small parts (a gun slot, the
// figurehead, the stern work) winning when the ray passes just by them.
const _ray = new THREE.Raycaster(), _v2 = new THREE.Vector2(), _hit = new THREE.Vector3();
export function pickAt(px, py) {
  const ref = Y.ship;
  if (!ref || !Y.camera) return null;
  _v2.set((px / Y.rect.cw) * 2 - 1, -(py / Y.rect.ch) * 2 + 1);
  _ray.setFromCamera(_v2, Y.camera);
  ref.g.updateMatrixWorld(true);
  const targets = [];
  ref.g.traverse((o) => { if (o.isMesh && (o.name === 'hullBody' || o.name === 'rig' || o.parent && o.parent.name === 'flag')) targets.push(o); });
  const hits = _ray.intersectObjects(targets, false);
  let part = null, dist = Infinity;
  if (hits.length) {
    const h = hits[0];
    dist = h.distance;
    if (h.object.name === 'rig') part = 'sails';
    else if (h.object.name === 'hullBody') {
      const a = h.object.geometry.attributes.aPart, code = a ? Math.round(a.getX(h.face.a)) : 0;
      part = Object.keys(ref.tpl.partCodes).find((k) => ref.tpl.partCodes[k] === code) || 'hull';
    } else part = 'flags';
  }
  // Small parts get a little slack round them.
  const A = ref.tpl.anchors || {}, slack = ref.tpl.B * 0.08;
  let best = null;
  for (const [p, box] of Object.entries(A)) {
    if (p === 'hull' || p === 'sails') continue;
    const bx = box.clone().expandByScalar(slack);
    if (!_ray.ray.intersectBox(bx, _hit)) continue;
    const d = _hit.distanceTo(_ray.ray.origin);
    if (d > dist + ref.tpl.B * 0.3) continue;
    const s = bx.getSize(new THREE.Vector3()), vol = s.x * s.y * s.z;
    if (!best || vol < best.vol) best = { p, vol };
  }
  if (best && (!part || part === 'hull' || part === 'sails' || part === best.p || part === 'stern')) part = best.p;
  return part;
}

// ---------- Keys ----------
function buildKeys() {
  const el = Y.keys;
  if (!el) return;
  el.innerHTML = KEYS.map(([p, l, n]) => `<button type="button" class="yard-key" data-part="${p}" aria-label="${n}">${l}</button>`).join('');
  Y.keyEls = {};
  for (const b of el.querySelectorAll('.yard-key')) {
    Y.keyEls[b.dataset.part] = b;
    b.addEventListener('click', () => choose(b.dataset.part));
  }
}
function syncKeys() {
  for (const [p, b] of Object.entries(Y.keyEls)) b.classList.toggle('on', Y.part === p || (p === 'guns' && !!Y.part && Y.part.startsWith('slot:')));
}
// Where each key sits: a point on the part, on the side facing the camera.
const _p = new THREE.Vector3(), _c = new THREE.Vector3();
function keyPoint(part, out) {
  const tpl = Y.ship.tpl, A = tpl.anchors || {}, sb = Math.cos(Y.orbit.az) >= 0 ? 1 : -1;
  const box = (k) => A[k];
  switch (part) {
    case 'hull': { const b = box('hull'); out.set(tpl.L * -0.3, lerp(b.min.y, b.max.y, 0.3), sb * b.max.z * 0.86); return 1; }
    case 'sails': { const b = box('sails'); if (!b) return 0; out.set(tpl.L * 0.05, lerp(b.min.y, b.max.y, 0.52), 0); return 1; }
    case 'figurehead': { const b = box('figurehead'); if (!b) return 0; b.getCenter(out); out.x = b.max.x; return Math.sin(Y.orbit.az) > -0.2 ? 1 : 0.35; }
    case 'stern': { const b = box('stern'); if (!b) return 0; b.getCenter(out); out.x = b.min.x; out.y = lerp(b.min.y, b.max.y, 0.6); return Math.sin(Y.orbit.az) < 0.2 ? 1 : 0.35; }
    case 'flags': {
      const fp = Y.ship.flagPivot;
      if (!fp) return 0;
      fp.getWorldPosition(out); out.y += 2;
      out.x += Math.cos(fp.rotation.y) * 9; out.z -= Math.sin(fp.rotation.y) * 9;
      return 1;
    }
    case 'guns': {
      const key = Object.keys(A).filter((k) => k.startsWith('slot:')).find((k) => (sb > 0 ? /starboard/i.test(k) : /port/i.test(k)) && (/Lower/.test(k) || !/Upper/.test(k)));
      const b = key && A[key];
      if (!b) return 0;
      b.getCenter(out); out.z = sb * b.max.z; out.x += tpl.L * 0.08;
      return 1;
    }
    default: return 0;
  }
}
function placeKeys() {
  if (!Y.ship) return;
  for (const [p, el] of Object.entries(Y.keyEls)) {
    const vis = keyPoint(p, _p);
    if (!vis) { el.hidden = true; continue; }
    _c.copy(_p).project(Y.camera);
    const x = (_c.x + 1) / 2 * Y.rect.cw - Y.rect.x, y = (1 - _c.y) / 2 * Y.rect.ch - Y.rect.y;
    const inside = _c.z < 1 && x > 12 && y > 12 && x < Y.rect.w - 12 && y < Y.rect.h - 12;
    // Close in on a part, its own key steps aside (the part is lit).
    el.hidden = !inside || (Y.part === p && Y.orbit.dist < Y.fit * 0.6);
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    el.style.opacity = vis < 1 ? '0.4' : '';
  }
}

// ---------- Each frame ----------
const _look = new THREE.Vector3();
export function renderYard(dt) {
  if (!Y.active || !R.renderer) return;
  dt = Math.min(0.05, dt || 0);
  Y.t += dt;
  layout();
  // The camera: easing to a goal (a part, a new ship, home), or coasting on the inertia of a drag.
  const o = Y.orbit;
  if (Y.goal) {
    const k = 1 - Math.exp(-dt * 5);
    for (const f of ['az', 'el', 'dist', 'ty', 'tx']) o[f] += (Y.goal[f] - o[f]) * k;
    if (Math.abs(Y.goal.az - o.az) + Math.abs(Y.goal.el - o.el) < 1e-3 && Math.abs(Y.goal.dist - o.dist) < 0.5) Y.goal = null;
  } else if (!Y.ptr.size) {
    o.az += Y.vel.az * dt; o.el = clamp(o.el + Y.vel.el * dt, 0.03, 1.15);
    const damp = Math.exp(-dt * 3.2);
    Y.vel.az *= damp; Y.vel.el *= damp;
  }
  const ce = Math.cos(o.el);
  Y.camera.position.set(o.tx + Math.sin(o.az) * ce * o.dist, o.ty + Math.sin(o.el) * o.dist, Math.cos(o.az) * ce * o.dist);
  if (Y.camera.position.y < 4) Y.camera.position.y = 4;
  _look.set(o.tx, o.ty, 0);
  Y.camera.lookAt(_look);
  Y.camera.updateMatrixWorld();
  if (Y.water) Y.water.material.uniforms.uT.value = Y.t;
  // The wharf dissolves while the camera looks across it at her larboard side.
  if (Y.cut) Y.cut.value = clamp((-Math.cos(o.az) - 0.2) / 0.4, 0, 1) * (1 - clamp((o.el - 0.55) / 0.3, 0, 1));
  // Her: a gentle bob and roll at her moorings, canvas breathing, colours lifting in the breeze.
  const t = Y.t;
  const pose = (ref, sink) => {
    ref.body.position.y = Math.sin(t * 1.1) * 0.45 - sink;
    ref.body.rotation.x = Math.sin(t * 0.8) * 0.016;
    ref.body.rotation.z = Math.sin(t * 0.55 + 1) * 0.008;
    ref.u.uSail.value.set(0.9 + Math.sin(t * 0.7) * 0.06, 0.85 + Math.sin(t * 0.6) * 0.08, t, -1);
    for (const p of ref.pivots) p.rotation.y = p.userData.fa ? -0.35 : 0.06;
    if (ref.flagPivot) ref.flagPivot.rotation.y = PI - 0.45 + Math.sin(t * 2.1) * 0.14 + Math.sin(t * 5.3) * 0.04;
  };
  const ref = Y.ship;
  if (ref) {
    if (ref.fadeIn < 1) {
      ref.fadeIn = Math.min(1, ref.fadeIn + dt / 0.34);
      ref.u.uFade.value = ref.fadeIn;
      if (ref.fadeIn >= 1) setShipFading(ref, false);
    }
    const e = 1 - ref.fadeIn;
    pose(ref, e * e * 6);
    // The lit part glows softly while its section is open; a change pulses it brighter for a moment.
    Y.pulse = Math.max(0, Y.pulse - dt * 1.4);
    const glow = Y.part || Y.pulse > 0 ? 0.34 + 0.14 * Math.sin(t * 3.4) + Y.pulse * 0.5 : 0;
    ref.u.uGlow.value = glow;
    if (ref.rigMat) ref.rigMat.emissive.setRGB(0.5, 0.36, 0.1).multiplyScalar(ref.glowSails ? glow * 0.8 : 0);
    const fm = ref.flagPivot && ref.flagPivot.children[0];
    if (fm && fm.material.emissive) fm.material.emissive.setRGB(0.5, 0.36, 0.1).multiplyScalar(ref.glowFlag ? glow : 0);
  }
  for (let i = Y.leaving.length - 1; i >= 0; i--) {
    const l = Y.leaving[i];
    l.t += dt / 0.24;
    l.ref.u.uFade.value = Math.max(0, 1 - l.t);
    pose(l.ref, l.t * l.t * 8);
    if (l.t >= 1) { disposeShip(l.ref); Y.leaving.splice(i, 1); }
  }
  placeKeys();
  R.renderer.render(Y.scene, Y.camera);
}

// ---------- For tests ----------
// The yard's state: whether it's up, the model it shows (its template key, look and guns as built), the part lit,
// what the scene holds, last frame's draw calls, and each key's place on the screen (to tap).
export const yardDebug = {
  get active() { return Y.active; },
  get key() { return Y.key; },
  get info() { return Y.ship ? Y.ship.tpl.info : null; },
  get part() { return Y.part; },
  get uPart() { return Y.ship ? Y.ship.u.uPart.value.toArray() : null; },
  get objects() { let n = 0; if (Y.scene) Y.scene.traverse(() => n++); return n; },
  get leaving() { return Y.leaving.length; },
  get orbit() { return { ...Y.orbit }; },
  get calls() { return R.renderer ? R.renderer.info.render.calls : 0; },
  // Templates the yard has built and not yet dropped.
  get templates() { return templateKeys().filter((k) => k.endsWith(':yard')).length; },
  // Screen points (CSS px) of each key, and of a part's anchor (for tapping the model itself).
  keyAt(part) { const b = Y.keyEls[part]; if (!b || b.hidden) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; },
  partAt(part) {
    if (!Y.ship || !Y.ship.tpl.anchors || !Y.ship.tpl.anchors[part]) return null;
    Y.ship.tpl.anchors[part].getCenter(_p);
    const sb = Math.cos(Y.orbit.az) >= 0 ? 1 : -1;
    const b = Y.ship.tpl.anchors[part];
    if (part.startsWith('slot:')) _p.z = b[sb > 0 ? 'max' : 'min'].z;
    if (part === 'hull') { _p.set(-Y.ship.tpl.L * 0.4, lerp(b.min.y, b.max.y, 0.2), b[sb > 0 ? 'max' : 'min'].z * 0.75); }
    _c.copy(_p).project(Y.camera);
    return [(_c.x + 1) / 2 * Y.rect.cw, (1 - _c.y) / 2 * Y.rect.ch];
  },
  // Ends every easing at once: the camera's move, a ship rising in, one sinking away.
  settle() {
    if (Y.goal) { Object.assign(Y.orbit, Y.goal); Y.goal = null; }
    Y.vel.az = Y.vel.el = 0;
    if (Y.ship && Y.ship.fadeIn < 1) { Y.ship.fadeIn = 1; Y.ship.u.uFade.value = 1; setShipFading(Y.ship, false); }
    for (const l of Y.leaving) disposeShip(l.ref);
    Y.leaving = [];
  },
  pickAt,
  aim(part) { if (Y.ship) { aim(part); } },
};
