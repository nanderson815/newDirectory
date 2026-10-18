import { S, afloat, showToast } from '../state.js';
import { clamp, reduceMotion, store } from '../util.js';

// The orders a captain can give: sail a course, sail straight to a point, engage a target, anchor.
// Input and the action bar call these; with the whole fleet selected they go to every ship.

export const clampWorld = (w) => ({ x: clamp(w.x, 30, S.G.W - 30), y: clamp(w.y, 30, S.G.H - 30) });
export const commandable = (s) => s && s.team === 'player' && afloat(s) && !s.escort; // merchantmen sail themselves

// Ripple where a tap gave an order (drawn by the HUD).
export const tapFx = { x: 0, y: 0, t: -9, kind: 'sail' };

// The fleet under command: every ship with Whole fleet on, else just the selected one.
export function eachCommanded(lead, fn) {
  if (!S.selectAll) { if (commandable(lead)) fn(lead); return; }
  for (const s of S.G.ships) if (commandable(s) && !s.boarding) fn(s);
}

// Every other ship sails the same course, keeping (a slightly tightened version of) its current station
// relative to the leader.
function fleetFollow(leader, pts) {
  for (const o of S.G.ships) {
    if (o === leader || !commandable(o) || o.boarding) continue;
    let dx = (o.x - leader.x) * 0.8, dy = (o.y - leader.y) * 0.8;
    const d = Math.hypot(dx, dy), max = 110;
    if (d > max) { dx *= max / d; dy *= max / d; }
    o.path = pts.map((q) => clampWorld({ x: q.x + dx, y: q.y + dy }));
    o.pivot = null; o.order = null;
  }
}

// A drawn course (or a single point for "sail straight there"). A new course cancels an engage order.
export function setCourse(ship, pts) {
  if (!commandable(ship) || !pts.length) return;
  ship.path = pts; ship.pivot = null; ship.order = null;
  S.G.dragged = true;
  if (S.selectAll) fleetFollow(ship, pts);
}

// Engage: the ship (or the whole fleet) manoeuvres on its own to keep the target on the beam. A ship at
// anchor weighs it first.
export function engage(ship, target) {
  if (!target) return;
  eachCommanded(ship, (s) => { s.order = { kind: 'engage', targetId: target.id }; s.path = []; s.pivot = null; });
  S.G.dragged = true;
  showToast(target.kind === 'fort' ? 'Engaging the fort' : `Engaging ${target.name}`, ship);
}

// Anchor toggle: drop anchor (she stops and can then be turned on the spot) or weigh it.
export function toggleAnchor(ship) {
  if (!commandable(ship)) return;
  const drop = ship.pivot == null;
  eachCommanded(ship, (s) => {
    if (drop) { s.pivot = s.h; s.path = []; } else s.pivot = null;
  });
  showToast(drop ? 'Anchored' : 'Anchor up', ship);
  haptic(drop ? 14 : 8);
}

// Turns an anchored ship (or fleet) to a heading.
export function turnTo(ship, h) {
  eachCommanded(ship, (s) => { if (s.pivot != null) { s.pivot = h; s.order = null; } });
}

// Tiny haptic ticks where the device supports them; off with reduced motion or the 'haptics' setting.
const hapticsOn = () => !reduceMotion && store.get('haptics', 'on') !== 'off';
export function haptic(ms) {
  if (!hapticsOn()) return;
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* no haptics */ }
}
