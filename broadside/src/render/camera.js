import * as THREE from 'three';
import { S, afloat, unitById, selfSailing } from '../state.js';
import { PI, clamp, lerp, reduceMotion } from '../util.js';
import { R } from './gl.js';

// Map coords (x right, y down) map to three coords (x right, y up, z toward the viewer).
export const wx = (x) => x - S.G.W / 2;
export const wz = (y) => y - S.G.H / 2;

// Portrait looks down more steeply through a longer lens; landscape keeps the lower, wider view.
const VIEW = { portrait: { tilt: 62, fov: 26 }, landscape: { tilt: 54, fov: 32 } };
const TOP_HUD = 40; // px kept clear above the far edge when sizing a new sea

// The sea is bigger than the screen: a battle's map is SEA_SCALE times (linear) the area that would just fit
// the screen, times the battle's own `sea` multiplier. The director camera shows part of it at a time.
export const SEA_SCALE = 1.45;

export const isLandscape = () => S.view.cw > S.view.ch * 1.05;

// ---------- Fitting a map to the screen (used to size a new sea) ----------
const fit = { corners: null, dir: null, target: null, v: null };
function frameMap(W, H, probe) {
  const { cw, ch } = S.view, camera = R.camera;
  const land = isLandscape();
  const view = land ? VIEW.landscape : VIEW.portrait;
  camera.fov = view.fov;
  camera.aspect = cw / ch;
  camera.updateProjectionMatrix();
  if (!fit.v) {
    fit.corners = [0, 1, 2, 3].map(() => new THREE.Vector3());
    fit.dir = new THREE.Vector3(); fit.target = new THREE.Vector3(); fit.v = new THREE.Vector3();
  }
  const { corners, dir, target, v } = fit;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b], i) => corners[i].set(a * (W / 2 + 6), 0, b * (H / 2 + 6)));
  const tilt = view.tilt * PI / 180;
  dir.set(0, Math.sin(tilt), Math.cos(tilt));
  target.set(0, 0, 0);
  const topRoom = 1 - (2 * TOP_HUD) / ch;
  const place = (dist) => {
    camera.position.copy(dir).multiplyScalar(dist).add(target);
    camera.lookAt(target);
    camera.updateMatrixWorld();
  };
  const farEdge = () => { let m = -Infinity; for (const c of corners) m = Math.max(m, v.copy(c).project(camera).y); return m; };
  const nearEdge = () => { let m = Infinity; for (const c of corners) m = Math.min(m, v.copy(c).project(camera).y); return m; };
  const fits = () => corners.every((c) => { v.copy(c).project(camera); return Math.abs(v.x) <= 1.0001 && v.y <= topRoom + 1e-4 && v.y >= -1.0001; });
  const span = Math.max(W, H);
  const placeFar = (dist, farY) => {
    let lo = -span, hi = span;
    for (let i = 0; i < 32; i++) { const t = (lo + hi) / 2; target.set(0, 0, t); place(dist); if (farEdge() > farY) hi = t; else lo = t; }
    target.set(0, 0, lo); place(dist);
  };
  let lo = 50, hi = 30000;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; placeFar(mid, topRoom); if (fits()) hi = mid; else lo = mid; }
  placeFar(hi, topRoom);
  return Math.max(0, nearEdge() + 1);
}

// World size for a new battle on the current screen: the sea that would just fill the screen, scaled up by
// SEA_SCALE and the battle's `sea` multiplier. Portrait uses a slightly narrower sea (bigger ships on a narrow
// phone) whose depth is chosen so the tilted map would fill the screen.
export function worldSize(sea = 1) {
  const { cw, ch } = S.view;
  const k = SEA_SCALE * (sea > 0 ? sea : 1);
  const ratio = Math.max(cw, ch) / Math.min(cw, ch);
  if (isLandscape()) return { W: Math.round(620 * clamp(ratio, 1.25, 2.0) * k), H: Math.round(620 * k), land: true };
  const W = Math.round(lerp(620, 520, clamp((ratio - 1.3) / 0.6, 0, 1)));
  let H = W * ratio;
  if (R.renderer) {
    let lo = W * 1.25, hi = W * 2.8;
    if (frameMap(W, hi, true) > 0.004) lo = hi;
    else for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (frameMap(W, mid, true) > 0.004) lo = mid; else hi = mid; }
    H = lo;
  }
  return { W: Math.round(W * k), H: Math.round(H * k), land: false };
}

// ---------- The director camera ----------
// The camera keeps a fixed orientation (per screen orientation) and moves over the sea: a look-at point
// (tx, ty in map units) and a distance d along a fixed direction. Because nothing rotates, the patch of sea
// the screen sees (its footprint) is the same trapezoid at every position, scaled by d. fitCamera measures
// it once per resize; framing and the edge clamp are then plain arithmetic, with no per-frame allocation.
//
// Screen axes in map space: u runs to screen right, v runs "up" the screen (away from the viewer).
export const cam = {
  mode: 'director', // 'director' | 'manual' (the player pinched or panned)
  tx: 0, ty: 0, d: 1000, vx: 0, vy: 0, vd: 0, // current pose and spring velocities
  gx: 0, gy: 0, gd: 1000, // the director's goal
  ux: 1, uy: 0, fx: 0, fy: -1, // map-space unit vectors for screen right (u) and screen up (v)
  fp: { nb: -0.3, fb: 0.4, nw: 0.2, fw: 0.3 }, // whole-screen footprint per unit distance
  safe: { nb: -0.2, fb: 0.3, nw: 0.15, fw: 0.25 }, // the footprint inside the HUD insets
  dMin: 300, dClose: 400, dComfort: 600, dWide: 1200, dMax: 2000,
  intro: -1, // seconds into the establishing move, or -1
  mvx: 0, mvy: 0, // map units/s the view coasts on after a one-finger pan
  idle: 0, // seconds since the last pinch/pan (manual mode returns to the director after a while)
  phase: null, frozen: false, ready: false,
};
const MARGIN = 100; // map units the view may show beyond the edge of the sea (it darkens there)
const RETURN_AFTER = 8; // seconds of no camera gestures before the director takes over again
const INSET = { top: 84, bottom: 104, side: 26 }; // px the director keeps its subjects clear of (HUD)

const dir = new THREE.Vector3(), look = new THREE.Vector3(), base = new THREE.Vector3();
const ray = new THREE.Raycaster(), seaPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ndc = new THREE.Vector2(), hitP = new THREE.Vector3();

function place(tx, ty, d) {
  const c = R.camera;
  look.set(tx - S.G.W / 2, 0, ty - S.G.H / 2);
  c.position.copy(dir).multiplyScalar(d).add(look);
  c.lookAt(look);
  c.updateMatrixWorld();
  base.copy(c.position);
  c.userData.base = base;
}

// Ground point under a screen pixel for the camera as currently placed (three coords in hitP).
function groundAt(px, py) {
  ndc.set((px / S.view.cw) * 2 - 1, -((py / S.view.ch) * 2 - 1));
  ray.setFromCamera(ndc, R.camera);
  return ray.ray.intersectPlane(seaPlane, hitP);
}

// Footprint of a screen rectangle (inset by the given px) per unit of camera distance.
function footprint(out, top, bottom, side, D) {
  const { cw, ch } = S.view;
  const lx = R.camera.position.x - dir.x * D, lz = R.camera.position.z - dir.z * D;
  const uv = (px, py) => {
    if (!groundAt(px, py)) return [0, 0];
    const dx = hitP.x - lx, dz = hitP.z - lz;
    return [(dx * cam.ux + dz * cam.uy) / D, (dx * cam.fx + dz * cam.fy) / D];
  };
  const tl = uv(side, top), br = uv(cw - side, ch - bottom);
  out.fb = tl[1]; out.fw = Math.abs(tl[0]); out.nb = br[1]; out.nw = Math.abs(br[0]);
}

// Map extents along the screen axes, measured from the map centre.
const halfU = () => (Math.abs(cam.ux) * S.G.W + Math.abs(cam.uy) * S.G.H) / 2;
const halfV = () => (Math.abs(cam.fx) * S.G.W + Math.abs(cam.fy) * S.G.H) / 2;

export function fitCamera() {
  if (!R.renderer || !S.G) return;
  const { cw, ch } = S.view, camera = R.camera, G = S.G;
  const land = isLandscape();
  const view = land ? VIEW.landscape : VIEW.portrait;
  camera.fov = view.fov;
  camera.aspect = cw / ch;
  camera.updateProjectionMatrix();
  // A map built for the other orientation (the phone was turned mid-battle) is yawed 90 degrees so its long
  // axis still runs along the screen's long axis, with the player's side at the bottom or left.
  const mapLand = G.W > G.H;
  const yx = mapLand === land ? 0 : mapLand ? 1 : -1, yz = yx ? 0 : -1;
  const tilt = view.tilt * PI / 180;
  dir.set(-yx * Math.cos(tilt), Math.sin(tilt), -yz * Math.cos(tilt));
  cam.fx = yx; cam.fy = yz; // screen up, on the ground
  cam.ux = -yz; cam.uy = yx; // screen right (up rotated a quarter turn clockwise in map space)
  const D = 1000;
  place(G.W / 2, G.H / 2, D);
  footprint(cam.fp, 0, 0, 0, D);
  footprint(cam.safe, Math.min(INSET.top, ch * 0.22), Math.min(INSET.bottom, ch * 0.24), Math.min(INSET.side, cw * 0.08), D);
  // Zoom range from on-screen ship size: px per map unit at the look-at point, scaled for bigger screens.
  const fp = cam.fp;
  const w0 = 2 * (fp.nw + (fp.fw - fp.nw) * (-fp.nb) / (fp.fb - fp.nb)); // ground width at the centre row, per unit d
  const ref = Math.min(cw, ch) / 390;
  const dAt = (ppu) => cw / (w0 * ppu * ref);
  cam.dMax = Math.min((2 * halfU() + 2 * MARGIN) / (2 * fp.fw), (2 * halfV() + 2 * MARGIN) / (fp.fb - fp.nb));
  cam.dMin = Math.min(dAt(1.7), cam.dMax);
  cam.dClose = Math.min(dAt(1.12), cam.dMax);
  cam.dComfort = Math.min(dAt(0.92), cam.dMax);
  cam.dWide = Math.min(dAt(0.68), cam.dMax);
  if (!cam.ready) { resetCamera(); return; }
  cam.d = clamp(cam.d, cam.dMin * 0.8, cam.dMax);
  clampPose();
  place(cam.tx, cam.ty, cam.d);
}

// A new battle: frame its enemies at once (the backdrop and the start of the establishing move).
export function resetCamera() {
  cam.ready = true; cam.mode = 'director'; cam.intro = -1; cam.idle = 0; cam.phase = S.G.phase; cam.frozen = false;
  director(0);
  cam.tx = cam.gx; cam.ty = cam.gy; cam.d = cam.gd; cam.vx = cam.vy = cam.vd = 0;
  clampPose();
  place(cam.tx, cam.ty, cam.d);
}

// Keeps a look-at point (in cam.tx/ty, or the goal) so the view never leaves the sea.
function clampXY(x, y, d, out) {
  const G = S.G, fp = cam.fp;
  const cx = x - G.W / 2, cy = y - G.H / 2;
  let u = cx * cam.ux + cy * cam.uy, v = cx * cam.fx + cy * cam.fy;
  const hu = halfU() + MARGIN, hv = halfV() + MARGIN;
  const uLim = hu - fp.fw * d;
  u = uLim > 0 ? clamp(u, -uLim, uLim) : 0;
  const vLo = -hv - fp.nb * d, vHi = hv - fp.fb * d;
  v = vLo <= vHi ? clamp(v, vLo, vHi) : (vLo + vHi) / 2;
  out.x = G.W / 2 + u * cam.ux + v * cam.fx; out.y = G.H / 2 + u * cam.uy + v * cam.fy;
}
const cl = { x: 0, y: 0 };
function clampPose() {
  cam.d = clamp(cam.d, cam.dMin * 0.8, cam.dMax);
  clampXY(cam.tx, cam.ty, cam.d, cl); cam.tx = cl.x; cam.ty = cl.y;
}

// ---------- Framing ----------
// Points of interest in priority order (map x, y and a pad in map units), in preallocated arrays.
const MAXP = 24;
const px_ = new Float32Array(MAXP), py_ = new Float32Array(MAXP), pp_ = new Float32Array(MAXP);
let np = 0;
const addP = (x, y, pad) => { if (np < MAXP) { px_[np] = x; py_[np] = y; pp_[np] = pad; np++; } };
const threat = new Set(); // ids currently framed as threats (hysteresis)
const pick = new Int32Array(3);
const picked = (id, n) => { for (let i = 0; i < n; i++) if (pick[i] === id) return true; return false; };
const fr = { u: 0, v: 0 };

// Can the first n points all sit inside the safe footprint at distance d? Writes the look-at (u, v) to fr.
function feasible(n, d) {
  const sf = cam.safe, G = S.G;
  let lo = -Infinity, hi = Infinity;
  for (let i = 0; i < n; i++) {
    const cx = px_[i] - G.W / 2, cy = py_[i] - G.H / 2, v = cx * cam.fx + cy * cam.fy;
    lo = Math.max(lo, v + pp_[i] - d * sf.fb);
    hi = Math.min(hi, v - pp_[i] - d * sf.nb);
  }
  if (lo > hi) return false;
  const tv = (lo + hi) / 2;
  lo = -Infinity; hi = Infinity;
  for (let i = 0; i < n; i++) {
    const cx = px_[i] - G.W / 2, cy = py_[i] - G.H / 2;
    const u = cx * cam.ux + cy * cam.uy, o = (cx * cam.fx + cy * cam.fy - tv) / d;
    const hw = d * (sf.nw + (sf.fw - sf.nw) * clamp((o - sf.nb) / (sf.fb - sf.nb), 0, 1));
    lo = Math.max(lo, u - hw + pp_[i]);
    hi = Math.min(hi, u + hw - pp_[i]);
  }
  if (lo > hi) return false;
  fr.u = (lo + hi) / 2; fr.v = tv;
  return true;
}

// Smallest distance in [dLo, dHi] that frames the first n points; drops low-priority points until it can.
// Leaves the matching look-at point in fr.
function frame(n, dLo, dHi) {
  while (n > 1 && !feasible(n, dHi)) n--;
  if (!feasible(n, dHi)) return dHi;
  let lo = dLo, hi = dHi;
  if (feasible(n, lo)) return lo;
  for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; if (feasible(n, mid)) hi = mid; else lo = mid; }
  feasible(n, hi);
  return hi;
}

const shown = (s) => afloat(s) && !s.hidden;
// Is the player's fleet commanded as one (and does it have more than one ship)?
function fleetShips() {
  let n = 0;
  for (const s of S.G.ships) if (s.team === 'player' && afloat(s) && !selfSailing(s)) n++;
  return n;
}

// Works out the director's goal (cam.gx, gy, gd) from the battle.
let calm = false; // the overview with nothing selected eases more slowly
function director(dt) {
  const G = S.G;
  np = 0; calm = false;
  const sel = S.selected && afloat(S.selected) && S.selected.team === 'player' && !selfSailing(S.selected) ? S.selected : null;
  if (G.phase === 'title' || cam.intro >= 0 && cam.intro < 0.8) {
    // Establishing view: the enemy squadron and the forts, with a slow drift for the menus behind.
    for (const s of G.ships) if (s.team !== 'player' && shown(s)) addP(s.x, s.y, s.L * 0.7);
    for (const f of G.forts) if (f.team !== 'player') addP(f.x, f.y, 40);
    if (!np) for (const s of G.ships) if (shown(s)) addP(s.x, s.y, s.L * 0.7);
    if (!np) addP(G.W / 2, G.H / 2, 0);
    const d = frame(np, cam.dComfort, cam.dMax);
    setGoal(d, G.phase === 'title' ? Math.sin(S.clock * 0.07) * 40 : 0);
    return;
  }
  const fleet = S.selectAll && fleetShips() > 1;
  if (!sel && !fleet) {
    // Nothing selected: a calm overview of the fleet and the nearest of the enemy, as much of it as fits.
    let cx = 0, cy = 0, n = 0;
    for (const s of G.ships) if (s.team === 'player' && afloat(s)) { addP(s.x, s.y, s.L * 0.7); cx += s.x; cy += s.y; n++; }
    if (n) {
      cx /= n; cy /= n;
      let picks = 0;
      for (let k = 0; k < 2; k++) {
        let best = null, bd = Infinity;
        for (const e of G.ships) {
          if (e.team === 'player' || !shown(e) || picked(e.id, picks)) continue;
          const dd = Math.hypot(e.x - cx, e.y - cy);
          if (dd < 650 && dd < bd) { bd = dd; best = e; }
        }
        if (!best) break;
        pick[picks++] = best.id;
        addP(best.x, best.y, best.L * 0.7);
      }
    }
    if (!np) addP(G.W / 2, G.H / 2, 0);
    calm = true;
    setGoal(frame(np, cam.dComfort, cam.dWide), 0);
    return;
  }
  const lead = 1.4;
  const subjects = fleet ? null : sel;
  if (subjects) {
    addP(sel.x, sel.y, sel.L * 0.7);
    addP(sel.x + Math.cos(sel.h) * sel.v * lead, sel.y + Math.sin(sel.h) * sel.v * lead, sel.L * 0.5);
    const o = sel.order, t = o && o.targetId != null ? unitById(o.targetId) : null;
    if (t && (t.kind === 'fort' ? t.state === 'active' : shown(t))) addP(t.x, t.y, (t.L || 60) * 0.7);
  } else {
    for (const s of G.ships) {
      if (s.team !== 'player' || !afloat(s) || selfSailing(s)) continue;
      addP(s.x + Math.cos(s.h) * s.v * lead * 0.5, s.y + Math.sin(s.h) * s.v * lead * 0.5, s.L * 0.7);
    }
  }
  const keep = np;
  // Threats: the nearest enemies (and hostile forts) to the subject, with hysteresis so the frame doesn't
  // twitch as one crosses the line.
  const ox = subjects ? sel.x : px_[0], oy = subjects ? sel.y : py_[0];
  const reach = Math.max(subjects ? sel.range * 1.9 : 420, 380);
  let picks = 0;
  for (let k = 0; k < 3; k++) {
    let best = null, bd = Infinity;
    for (const e of G.ships) {
      if (e.team === 'player' || !shown(e) || picked(e.id, picks)) continue;
      const dd = Math.hypot(e.x - ox, e.y - oy);
      const lim = threat.has(e.id) ? reach * 1.25 : reach;
      if (dd < lim && dd < bd) { bd = dd; best = e; }
    }
    if (!best) break;
    pick[picks++] = best.id;
    addP(best.x, best.y, best.L * 0.7);
  }
  threat.clear();
  for (let i = 0; i < picks; i++) threat.add(pick[i]);
  for (const f of G.forts) {
    if (f.team === 'player' || f.state !== 'active') continue;
    if (Math.hypot(f.x - ox, f.y - oy) < reach) addP(f.x, f.y, G.islands[f.island].r);
  }
  // The subject and the nearest threat must be in shot; further threats only if they fit (chevrons on the
  // screen edge point at the rest).
  const ess = keep + (picks ? 1 : 0), close = np > keep || fleet ? cam.dClose : cam.dComfort;
  let d = frame(ess, close, cam.dWide);
  const cap = Math.max(d, cam.dComfort);
  if (np > ess && feasible(np, cap)) d = frame(np, close, cap);
  setGoal(d, 0);
}

function setGoal(d, drift) {
  const G = S.G;
  cam.gx = G.W / 2 + fr.u * cam.ux + fr.v * cam.fx + drift * cam.ux;
  cam.gy = G.H / 2 + fr.u * cam.uy + fr.v * cam.fy + drift * cam.uy;
  cam.gd = clamp(d, cam.dMin, cam.dMax);
  clampXY(cam.gx, cam.gy, cam.gd, cl); cam.gx = cl.x; cam.gy = cl.y;
}

// Critically damped spring (exact-ish solution, so it behaves the same at any frame rate).
function damp(cur, goal, velKey, smooth, dt) {
  const w = 2 / smooth, x = w * dt;
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const ch = cur - goal, v = cam[velKey], t = (v + w * ch) * dt;
  cam[velKey] = (v - w * t) * e;
  return goal + (ch + t) * e;
}

// Advances the camera by dt seconds (sub-stepped) and places it.
export function updateCamera(dt) {
  if (!R.renderer || !S.G || !cam.ready) return;
  const G = S.G;
  // The establishing move starts when a fresh battle goes into play.
  if (G.phase === 'play' && cam.phase === 'title' && G.t < 1) {
    if (reduceMotion) { cam.intro = -1; director(0); snap(); } else cam.intro = 0;
  }
  cam.phase = G.phase;
  if (cam.intro >= 0) { cam.intro += dt; if (cam.intro > 3.2) cam.intro = -1; }
  if (cam.mode === 'manual') {
    cam.idle += dt;
    // With a ship selected the director takes over again after a quiet spell; with nothing selected the view
    // holds where you left it until you take command or double-tap the sea.
    if (cam.idle > RETURN_AFTER && !S.drag && !gesture.active && (S.selected || S.selectAll)) toDirector();
    // A one-finger pan coasts on and eases to a stop.
    if (!pan.active && !gesture.active && (cam.mvx || cam.mvy)) {
      const k = Math.exp(-dt * 3.2), f = (1 - k) / 3.2; // exact for any dt
      cam.tx += cam.mvx * f; cam.ty += cam.mvy * f;
      cam.mvx *= k; cam.mvy *= k;
      if (Math.hypot(cam.mvx, cam.mvy) < 4) cam.mvx = cam.mvy = 0;
    }
  } else cam.mvx = cam.mvy = 0;
  // Holding still under a finger that is drawing a course or turning a ship.
  cam.frozen = !!S.drag || gesture.active;
  if (cam.mode === 'director' && !cam.frozen) {
    director(dt);
    const intro = cam.intro >= 0;
    const sPos = intro ? (cam.intro < 0.8 ? 0.5 : 0.95) : calm ? 1.1 : 0.6, sZoom = intro ? 1.2 : calm ? 1.4 : 0.9;
    while (dt > 1e-6) {
      const h = Math.min(dt, 1 / 30);
      cam.tx = damp(cam.tx, cam.gx, 'vx', sPos, h);
      cam.ty = damp(cam.ty, cam.gy, 'vy', sPos, h);
      cam.d = damp(cam.d, cam.gd, 'vd', sZoom, h);
      dt -= h;
    }
  } else { cam.vx = cam.vy = cam.vd = 0; }
  clampPose();
  place(cam.tx, cam.ty, cam.d);
}

// Jumps straight to the director's framing (tests, reduce-motion and resets).
export function snap() {
  cam.tx = cam.gx; cam.ty = cam.gy; cam.d = cam.gd; cam.vx = cam.vy = cam.vd = 0;
  clampPose();
  place(cam.tx, cam.ty, cam.d);
}
export function settleCamera() {
  if (!cam.ready) return;
  cam.intro = -1; cam.phase = S.G.phase;
  if (cam.mode === 'director') { director(0); snap(); }
}

export function toDirector() {
  cam.mode = 'director'; cam.idle = 0; cam.intro = -1;
}
// Any touch during the establishing move cuts it short.
export function skipIntro() { if (cam.intro >= 0) cam.intro = -1; }

// ---------- Pinch, pan and wheel ----------
// While two fingers are down the camera follows them exactly: the sea point under their midpoint stays under
// it, and the spread zooms. Afterwards the camera stays put (manual) until a double-tap or a quiet spell.
export const gesture = { active: false, wx: 0, wy: 0, d0: 0, f0: 1 };
export function beginPinch(mx, my, spread) {
  pan.active = false; cam.mvx = cam.mvy = 0;
  const w = toWorld(mx, my);
  if (!w) return;
  gesture.active = true; gesture.wx = w.x; gesture.wy = w.y; gesture.d0 = cam.d; gesture.f0 = Math.max(20, spread);
  cam.mode = 'manual'; cam.idle = 0; cam.intro = -1;
}
export function movePinch(mx, my, spread) {
  if (!gesture.active) return;
  cam.d = clamp(gesture.d0 * gesture.f0 / Math.max(20, spread), cam.dMin * 0.8, cam.dMax);
  keepUnder(gesture.wx, gesture.wy, mx, my);
  cam.idle = 0;
}
export function endPinch() { gesture.active = false; cam.idle = 0; }

// One finger with nothing selected: the sea under the finger stays under it; let go and the view coasts on.
const pan = { active: false, wx: 0, wy: 0, t: 0, vx: 0, vy: 0 };
export function beginPan(px, py) {
  const w = toWorld(px, py);
  if (!w) return;
  pan.active = true; pan.wx = w.x; pan.wy = w.y; pan.t = performance.now(); pan.vx = pan.vy = 0;
  cam.mode = 'manual'; cam.idle = 0; cam.intro = -1; cam.mvx = cam.mvy = 0;
}
export function movePan(px, py) {
  if (!pan.active) return;
  const x0 = cam.tx, y0 = cam.ty, now = performance.now(), dt = Math.max(0.008, (now - pan.t) / 1000);
  keepUnder(pan.wx, pan.wy, px, py);
  // The finger's speed, smoothed, for the coast afterwards.
  const k = Math.min(1, dt * 12);
  pan.vx += ((cam.tx - x0) / dt - pan.vx) * k; pan.vy += ((cam.ty - y0) / dt - pan.vy) * k;
  pan.t = now; cam.idle = 0;
}
export function endPan() {
  if (!pan.active) return;
  pan.active = false; cam.idle = 0;
  // A finger that stopped before lifting doesn't throw the view.
  const still = performance.now() - pan.t > 90, sp = Math.hypot(pan.vx, pan.vy), max = 1600;
  cam.mvx = still ? 0 : pan.vx * Math.min(1, max / (sp || 1)); cam.mvy = still ? 0 : pan.vy * Math.min(1, max / (sp || 1));
}
export function wheelZoom(mx, my, k) {
  const w = toWorld(mx, my);
  if (!w) return;
  cam.mode = 'manual'; cam.idle = 0; cam.intro = -1;
  cam.d = clamp(cam.d * k, cam.dMin * 0.8, cam.dMax);
  keepUnder(w.x, w.y, mx, my);
}
// Moves the look-at point so map point (x, y) sits under screen pixel (sx, sy).
function keepUnder(x, y, sx, sy) {
  place(cam.tx, cam.ty, cam.d);
  if (!groundAt(sx, sy)) return;
  const hx = hitP.x + S.G.W / 2, hy = hitP.z + S.G.H / 2;
  cam.tx += x - hx; cam.ty += y - hy;
  clampPose();
  place(cam.tx, cam.ty, cam.d);
}

// Slides the view by (dx, dy) map units (a course being drawn off the edge of the screen).
export function nudge(dx, dy) {
  cam.tx += dx; cam.ty += dy;
  clampPose();
  place(cam.tx, cam.ty, cam.d);
}

// ---------- Screen projection for the HUD and input ----------
const tmpV = new THREE.Vector3();
export const scratchA = { x: 0, y: 0 }, scratchB = { x: 0, y: 0 };
// Allocation-free projection: writes into out (defaults to a shared scratch point).
export function projTo(x, y, z, out) {
  out = out || scratchA;
  tmpV.set(wx(x), z || 0, wz(y)).project(R.camera);
  out.x = (tmpV.x + 1) / 2 * S.view.cw; out.y = (1 - tmpV.y) / 2 * S.view.ch;
  return out;
}
export const proj = (x, y, z) => projTo(x, y, z, { x: 0, y: 0 });

export function toWorld(px, py) {
  if (!groundAt(px, py)) return null;
  return { x: hitP.x + S.G.W / 2, y: hitP.z + S.G.H / 2 };
}
export function pxPerUnit(x, y) {
  const a = projTo(x, y, 0, scratchA), b = projTo(x + 10, y, 0, scratchB);
  return Math.hypot(b.x - a.x, b.y - a.y) / 10;
}
