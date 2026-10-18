import * as THREE from 'three';
import { S } from '../state.js';
import { PI, clamp, lerp } from '../util.js';
import { R } from './gl.js';

// Map coords (x right, y down) map to three coords (x right, y up, z toward the viewer).
export const wx = (x) => x - S.G.W / 2;
export const wz = (y) => y - S.G.H / 2;

// Portrait looks down more steeply through a longer lens, so a deep map fills a tall screen with little
// perspective shrink at the far edge; landscape keeps the lower, wider view.
const VIEW = { portrait: { tilt: 62, fov: 26 }, landscape: { tilt: 54, fov: 32 } };
const TOP_HUD = 40; // px kept clear above the far edge for the top HUD row

export const isLandscape = () => S.view.cw > S.view.ch * 1.05;

// Places the camera so a W x H map fits on screen as large as possible: the far edge sits just under the
// top HUD row and the camera backs off until every corner is in frame. Returns the spare height at the
// bottom in NDC units (0 when the map fills the screen top to bottom).
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
  // A map built for the other orientation (the phone was turned mid-battle) is yawed 90 degrees so its
  // long axis still runs along the screen's long axis, with the player's side at the bottom or left.
  const mapLand = W > H;
  const fx = mapLand === land ? 0 : mapLand ? 1 : -1, fz = fx ? 0 : -1;
  const tilt = view.tilt * PI / 180;
  dir.set(-fx * Math.cos(tilt), Math.sin(tilt), -fz * Math.cos(tilt));
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
  // Slide the look-at point toward the camera until the far edge sits at farY (it rises as t grows).
  const span = Math.max(W, H);
  const placeFar = (dist, farY) => {
    let lo = -span, hi = span;
    for (let i = 0; i < 32; i++) { const t = (lo + hi) / 2; target.set(-fx * t, 0, -fz * t); place(dist); if (farEdge() > farY) hi = t; else lo = t; }
    target.set(-fx * lo, 0, -fz * lo); place(dist);
  };
  const solve = (farY) => {
    let lo = 50, hi = 30000;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; placeFar(mid, farY); if (fits()) hi = mid; else lo = mid; }
    placeFar(hi, farY);
    return Math.max(0, nearEdge() + 1);
  };
  const slack = solve(topRoom);
  // Width-bound: split the spare height between top and bottom (re-solving the distance each time).
  if (slack > 0.01 && !probe) {
    let farY = topRoom;
    for (let k = 0; k < 4; k++) {
      const gapTop = topRoom - farY, gapBot = solve(farY);
      if (Math.abs(gapBot - gapTop) < 0.01) break;
      farY = Math.min(topRoom, farY - (gapBot - gapTop) / 2);
    }
  }
  return slack;
}

export function fitCamera() {
  if (!R.renderer || !S.G) return;
  frameMap(S.G.W, S.G.H);
  R.camera.userData.base = R.camera.position.clone();
}

// World size for a new battle on the current screen. Portrait uses a slightly narrower sea (bigger ships on
// a narrow phone) whose depth is chosen so the tilted map fills the screen.
export function worldSize() {
  const { cw, ch } = S.view;
  const ratio = Math.max(cw, ch) / Math.min(cw, ch);
  if (isLandscape()) return { W: Math.round(620 * clamp(ratio, 1.25, 2.0)), H: 620, land: true };
  const W = Math.round(lerp(620, 520, clamp((ratio - 1.3) / 0.6, 0, 1)));
  if (!R.renderer) return { W, H: Math.round(W * ratio), land: false };
  let lo = W * 1.25, hi = W * 2.8;
  if (frameMap(W, hi, true) > 0.004) lo = hi;
  else for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (frameMap(W, mid, true) > 0.004) lo = mid; else hi = mid; }
  return { W, H: Math.round(lo), land: false };
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

const ray = new THREE.Raycaster(), seaPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ndc = new THREE.Vector2(), hitP = new THREE.Vector3();
export function toWorld(px, py) {
  ndc.set((px / S.view.cw) * 2 - 1, -((py / S.view.ch) * 2 - 1));
  ray.setFromCamera(ndc, R.camera);
  if (!ray.ray.intersectPlane(seaPlane, hitP)) return null;
  return { x: hitP.x + S.G.W / 2, y: hitP.z + S.G.H / 2 };
}
export function pxPerUnit(x, y) {
  const a = projTo(x, y, 0, scratchA), b = projTo(x + 10, y, 0, scratchB);
  return Math.hypot(b.x - a.x, b.y - a.y) / 10;
}
