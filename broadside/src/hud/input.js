import { S, afloat, fortById, shipById } from '../state.js';
import { clamp } from '../util.js';
import { projTo, toWorld, pxPerUnit, cam, beginPinch, movePinch, endPinch, wheelZoom, toDirector, skipIntro, gesture, nudge } from '../render/camera.js';
import { R } from '../render/gl.js';
import { fireBroadside, findBroadsideTarget, dropMine } from '../sim/combat.js';
import { startLanding } from '../sim/forts.js';
import { startBoarding } from '../sim/boarding.js';
import { hudCanvas } from './hud.js';
import { clampWorld, commandable, setCourse, engage, toggleAnchor, turnTo, haptic, tapFx } from './orders.js';

// One-thumb controls. A ship is always selected.
//   tap one of your ships: select it          drag anywhere on the sea: plot the selected ship's course
//   tap the sea: sail straight there          (a drag that starts on another of your ships selects it first)
//   tap an enemy ship or fort: engage it      anchored: a drag (or tap) turns her on the spot
//   two fingers: pinch to zoom, drag to pan   double-tap the sea: hand the camera back to the director
// Plus the fleet cards, the action bar and the pause button, all drawn by hud.js.
const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
const MOVE_PX = 10; // finger travel before a press counts as a drag
const DOUBLE_MS = 320, DOUBLE_PX = 44;

function nearestUnit(p, pick) {
  let best = null, bd = Infinity;
  for (const s of S.G.ships) {
    if (!pick(s)) continue;
    const q = projTo(s.x, s.y, 8);
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    const reach = Math.max(30, s.L * 0.62 * pxPerUnit(s.x, s.y));
    if (d < reach && d < bd) { bd = d; best = s; }
  }
  return best;
}
const ownShipAt = (p) => nearestUnit(p, commandable);
function enemyAt(p) {
  const s = nearestUnit(p, (e) => e.team !== 'player' && afloat(e) && !e.hidden);
  if (s) return s;
  for (const f of S.G.forts) {
    if (f.team === 'player' || f.state !== 'active') continue;
    const q = projTo(f.x, f.y, 10), r = Math.max(32, S.G.islands[f.island].r * 0.9 * pxPerUnit(f.x, f.y));
    if (Math.hypot(q.x - p.x, q.y - p.y) < r) return f;
  }
  return null;
}


const selectedShip = () => (commandable(S.selected) ? S.selected : null);
export function select(s) {
  if (!commandable(s)) return;
  if (S.selected !== s) haptic(8);
  S.selected = s;
}

// Does one HUD button take this press? (Buttons act on press: crisp, and no drag can start from them.)
function hudPress(p, onPause) {
  const hud = S.hud, sel = selectedShip();
  if (hud.pause && Math.hypot(p.x - hud.pause.x, p.y - hud.pause.y) < hud.pause.r) { onPause(); return true; }
  if (hud.recentre && Math.hypot(p.x - hud.recentre.x, p.y - hud.recentre.y) < hud.recentre.r) { toDirector(); haptic(8); return true; }
  for (const a of hud.actions) {
    if (!inRect(p, a)) continue;
    if (!sel) return true;
    if (a.kind === 'anchor') toggleAnchor(sel);
    else if (a.kind === 'fire') { if (sel.reload[a.side] <= 0) { fireBroadside(sel, a.side, findBroadsideTarget(sel, a.side)); haptic(12); } }
    else if (a.kind === 'ammo') { const k = sel.ammoKinds; sel.ammo = k[(k.indexOf(sel.ammo) + 1) % k.length]; haptic(6); }
    else if (a.kind === 'mine') { dropMine(sel); haptic(10); }
    else if (a.kind === 'land' && a.ready) startLanding(sel, fortById(a.fortId));
    else if (a.kind === 'board') startBoarding(sel, shipById(a.shipId)); // long odds are the captain's call
    return true;
  }
  for (const c of hud.cards) {
    if (!inRect(p, c)) continue;
    if (c.fleet) {
      S.selectAll = !S.selectAll;
      if (S.selectAll && !sel) S.selected = S.G.ships.find(commandable) || null;
      haptic(8);
    } else if (commandable(c.ship)) { select(c.ship); S.selectAll = false; if (cam.mode === 'manual') toDirector(); }
    return true;
  }
  return false;
}

const extend = (drag, w) => {
  const last = drag.pts.length ? drag.pts[drag.pts.length - 1] : drag.from;
  if (Math.hypot(w.x - last.x, w.y - last.y) > 12) drag.pts.push(clampWorld(w));
};

// Drawing a course past the edge of the screen: holding the finger near an edge slides the view that way
// (faster the closer it is), and the course keeps growing under the finger. Called once a frame.
const EDGE = 44;
export function dragTick(dt) {
  const drag = S.drag;
  if (!drag || drag.mode !== 'course' || !drag.moved || drag.px == null || !S.G || S.G.phase !== 'play') return;
  const { cw, ch } = S.view;
  const ex = drag.px < EDGE ? -(1 - drag.px / EDGE) : drag.px > cw - EDGE ? 1 - (cw - drag.px) / EDGE : 0;
  const ey = drag.py < EDGE ? 1 - drag.py / EDGE : drag.py > ch - EDGE ? -(1 - (ch - drag.py) / EDGE) : 0;
  if (!ex && !ey) return;
  const v = 420 * (cam.d / cam.dComfort) * Math.min(dt, 0.1); // map units this frame
  nudge((ex * cam.ux + ey * cam.fx) * v, (ex * cam.uy + ey * cam.fy) * v);
  const w = toWorld(drag.px, drag.py);
  if (w) extend(drag, w);
}

export function bindInput(onPause) {
  const cv = hudCanvas;
  const ptrs = new Map(); // live pointers: id -> { x, y }
  let lastTap = { t: -1e9, x: 0, y: 0 }, pendingTap = null;
  const spread = () => { const [a, b] = ptrs.values(); return Math.hypot(a.x - b.x, a.y - b.y); };
  const mid = () => { const [a, b] = ptrs.values(); return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
  const playing = () => S.G && R.renderer && S.G.phase === 'play';

  cv.addEventListener('pointerdown', (e) => {
    if (!playing()) return;
    const p = { x: e.offsetX, y: e.offsetY };
    skipIntro();
    if (!ptrs.size && hudPress(p, onPause)) return;
    ptrs.set(e.pointerId, p);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (ptrs.size === 2) {
      // A second finger turns whatever the first was doing into a pinch: drop the half-drawn course.
      S.drag = null;
      const m = mid();
      beginPinch(m.x, m.y, spread());
      return;
    }
    if (ptrs.size > 2 || gesture.active) return;
    const w = toWorld(p.x, p.y);
    if (!w) return;
    const own = ownShipAt(p);
    if (own) select(own); // starting on another of your ships selects it first
    const ship = own || selectedShip();
    if (!ship) return;
    S.drag = {
      ship, pts: [], id: e.pointerId, from: w, sx: p.x, sy: p.y, onShip: !!own, moved: false,
      enemy: own ? null : enemyAt(p), mode: ship.pivot != null ? 'rotate' : 'course', fleet: S.selectAll, t: performance.now(),
    };
  });

  cv.addEventListener('pointermove', (e) => {
    const q = ptrs.get(e.pointerId);
    if (!q) return;
    q.x = e.offsetX; q.y = e.offsetY;
    if (gesture.active) {
      if (ptrs.size >= 2) { const m = mid(); movePinch(m.x, m.y, spread()); }
      return;
    }
    const drag = S.drag;
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved && Math.hypot(q.x - drag.sx, q.y - drag.sy) < MOVE_PX) return;
    const w = toWorld(q.x, q.y);
    if (!w) return;
    if (!drag.moved) {
      drag.moved = true;
      // A course drawn from open water starts where the finger went down.
      if (drag.mode === 'course' && !drag.onShip) drag.pts.push(clampWorld(drag.from));
    }
    const s = drag.ship;
    if (drag.mode === 'rotate') {
      if (Math.hypot(w.x - s.x, w.y - s.y) > 8) { turnTo(s, Math.atan2(w.y - s.y, w.x - s.x)); drag.turned = true; }
      return;
    }
    drag.px = q.x; drag.py = q.y;
    extend(drag, w);
  });

  // A tap on open sea: sail (or, at anchor, turn) toward it.
  const seaTap = (ship, w) => {
    if (!commandable(ship)) return;
    const G = S.G;
    tapFx.x = w.x; tapFx.y = w.y; tapFx.t = S.clock; tapFx.kind = ship.pivot != null ? 'turn' : 'sail';
    if (ship.pivot != null) turnTo(ship, Math.atan2(w.y - ship.y, w.x - ship.x));
    else {
      setCourse(ship, [clampWorld(w)]);
      if (G.tut && G.tut.step === 1) G.tut.tapped = true;
    }
    haptic(6);
  };

  const endDrag = (e) => {
    const had = ptrs.delete(e.pointerId);
    if (gesture.active) {
      if (ptrs.size < 2) endPinch();
      return;
    }
    const drag = S.drag, G = S.G;
    if (!had || !drag || e.pointerId !== drag.id) return;
    S.drag = null;
    if (!G || G.phase !== 'play') return;
    const s = drag.ship;
    if (drag.moved) {
      if (drag.mode === 'rotate') {
        if (drag.turned && G.tut && G.tut.step === 2) G.tut.rotated = true;
        haptic(8);
      } else if (drag.pts.length && afloat(s)) { setCourse(s, drag.pts); haptic(8); }
      return;
    }
    // A tap.
    const now = performance.now();
    if (drag.onShip) {
      S.selectAll = false;
      if (cam.mode === 'manual') toDirector();
      return;
    }
    if (drag.enemy) {
      engage(s, drag.enemy);
      tapFx.x = drag.enemy.x; tapFx.y = drag.enemy.y; tapFx.t = S.clock; tapFx.kind = 'engage';
      if (G.tut && G.tut.step === 3 && drag.enemy.team !== 'player') G.tut.engaged = true;
      haptic(12);
      return;
    }
    const dbl = now - lastTap.t < DOUBLE_MS && Math.hypot(drag.sx - lastTap.x, drag.sy - lastTap.y) < DOUBLE_PX;
    lastTap = { t: dbl ? -1e9 : now, x: drag.sx, y: drag.sy };
    if (dbl) {
      // Double-tap the sea: the director takes the camera back. (The first tap's order stands.)
      if (pendingTap) { clearTimeout(pendingTap); pendingTap = null; }
      if (cam.mode === 'manual') { toDirector(); haptic(8); }
      return;
    }
    if (cam.mode === 'manual') {
      // With the camera in your hands a double-tap means "give it back", so wait a beat before sailing.
      const w = drag.from;
      pendingTap = setTimeout(() => { pendingTap = null; if (playing()) seaTap(s, w); }, DOUBLE_MS);
    } else seaTap(s, drag.from);
  };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', (e) => {
    ptrs.delete(e.pointerId);
    if (gesture.active && ptrs.size < 2) endPinch();
    if (S.drag && e.pointerId === S.drag.id) S.drag = null;
  });
  cv.addEventListener('wheel', (e) => {
    if (!playing()) return;
    e.preventDefault();
    wheelZoom(e.offsetX, e.offsetY, Math.exp(clamp(e.deltaY, -120, 120) * 0.0022));
  }, { passive: false });
}

