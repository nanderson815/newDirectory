import { S, afloat, fortById, showToast } from '../state.js';
import { clamp } from '../util.js';
import { proj, toWorld, pxPerUnit } from '../render/camera.js';
import { R } from '../render/gl.js';
import { fireBroadside, findBroadsideTarget, dropMine } from '../sim/combat.js';
import { startLanding } from '../sim/forts.js';
import { hudCanvas } from './hud.js';

// Touch and mouse: drag from a ship to draw a course, hold to anchor and turn, tap to clear,
// tap the fleet cards to select, plus the on-screen buttons.
const HOLD_MS = 350;
const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
const clampWorld = (w) => ({ x: clamp(w.x, 30, S.G.W - 30), y: clamp(w.y, 30, S.G.H - 30) });

function shipAt(p) {
  let best = null, bd = Infinity;
  for (const s of S.G.ships) {
    if (s.team !== 'player' || !afloat(s)) continue;
    const q = proj(s.x, s.y, 8);
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    const reach = Math.max(34, s.L * 0.65 * pxPerUnit(s.x, s.y));
    if (d < reach && d < bd) { bd = d; best = s; }
  }
  return best;
}

export function bindInput(onPause) {
  const cv = hudCanvas;
  cv.addEventListener('pointerdown', (e) => {
    const G = S.G;
    if (!G || !R.renderer || G.phase !== 'play') return;
    const p = { x: e.offsetX, y: e.offsetY }, hud = S.hud;
    if (hud.pause && Math.hypot(p.x - hud.pause.x, p.y - hud.pause.y) < hud.pause.r) { onPause(); return; }
    const sel = S.selected && afloat(S.selected) ? S.selected : null;
    for (const b of hud.fire) {
      if (!inRect(p, b)) continue;
      if (sel && sel.reload[b.side] <= 0) fireBroadside(sel, b.side, findBroadsideTarget(sel, b.side));
      return;
    }
    for (const a of hud.actions) {
      if (!inRect(p, a)) continue;
      if (sel && a.kind === 'mine') dropMine(sel);
      else if (sel && a.kind === 'land' && a.ready) startLanding(sel, fortById(a.fortId));
      return;
    }
    for (const c of hud.cards) {
      if (inRect(p, c)) { if (afloat(c.ship)) S.selected = c.ship; return; }
    }
    const w = toWorld(p.x, p.y);
    if (!w) return;
    const s = shipAt(p);
    if (s) {
      S.selected = s;
      const held = { ship: s, pts: [], id: e.pointerId, from: w, onShip: true, sx: p.x, sy: p.y };
      S.drag = held;
      // Press and hold (without moving) to drop anchor and turn on the spot.
      held.holdTimer = setTimeout(() => {
        if (S.drag !== held || held.pts.length || !afloat(held.ship) || S.G.phase !== 'play') return;
        held.mode = 'rotate';
        held.ship.path = [];
        held.ship.pivot = held.ship.h;
        showToast('Anchored', held.ship);
        try { if (navigator.vibrate) navigator.vibrate(12); } catch (err) { /* no haptics */ }
      }, HOLD_MS);
    } else if (sel) {
      S.drag = { ship: sel, pts: [clampWorld(w)], id: e.pointerId, from: w };
    } else return;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });

  cv.addEventListener('pointermove', (e) => {
    const drag = S.drag;
    if (!drag || e.pointerId !== drag.id) return;
    const w = toWorld(e.offsetX, e.offsetY);
    if (!w) return;
    if (drag.mode === 'rotate') {
      const s = drag.ship;
      if (Math.hypot(w.x - s.x, w.y - s.y) > 8) s.pivot = Math.atan2(w.y - s.y, w.x - s.x);
      return;
    }
    // Small finger wobble on a ship isn't a course yet; it may be the start of a press-and-hold.
    if (drag.onShip && !drag.pts.length && Math.hypot(e.offsetX - drag.sx, e.offsetY - drag.sy) < 10) return;
    const last = drag.pts.length ? drag.pts[drag.pts.length - 1] : drag.from;
    if (Math.hypot(w.x - last.x, w.y - last.y) > 12) drag.pts.push(clampWorld(w));
  });

  const endDrag = (e) => {
    const drag = S.drag, G = S.G;
    if (!drag || e.pointerId !== drag.id) return;
    clearTimeout(drag.holdTimer);
    S.drag = null;
    if (drag.mode === 'rotate') {
      if (G.tut && G.tut.step === 1) G.tut.rotated = true;
      return;
    }
    if (drag.pts.length && afloat(drag.ship)) {
      drag.ship.path = drag.pts; drag.ship.pivot = null; G.dragged = true;
    } else if (drag.onShip && (drag.ship.path.length || drag.ship.pivot != null)) {
      // A tap on a ship (no drag) clears its course and raises the anchor.
      const anchored = drag.ship.pivot != null;
      drag.ship.path = []; drag.ship.pivot = null;
      showToast(anchored ? 'Anchor up' : 'Course cleared', drag.ship);
      if (anchored && G.tut && G.tut.step === 2) G.tut.raised = true;
    }
  };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', (e) => {
    if (S.drag && e.pointerId === S.drag.id) { clearTimeout(S.drag.holdTimer); S.drag = null; }
  });
}
