import { S, afloat, showToast, selfSailing, shipById } from '../state.js';
import { clamp, angDiff, reduceMotion, store } from '../util.js';
import { spacing } from '../sim/formation.js';

// The orders a captain can give: sail a course, sail straight to a point, engage a target, anchor.
// Input and the action bar call these; with the whole fleet selected they go to every ship.

export const clampWorld = (w) => ({ x: clamp(w.x, 30, S.G.W - 30), y: clamp(w.y, 30, S.G.H - 30) });
export const commandable = (s) => !!s && s.team === 'player' && afloat(s) && !selfSailing(s); // merchantmen and allies sail themselves

// Ripple where a tap gave an order (drawn by the HUD).
export const tapFx = { x: 0, y: 0, t: -9, kind: 'sail' };

// The fleet under command: every ship with Whole fleet on, else just the selected one.
export function eachCommanded(lead, fn) {
  if (!S.selectAll) { if (commandable(lead)) fn(lead); return; }
  for (const s of S.G.ships) if (commandable(s) && !s.boarding) fn(s);
}

// The whole fleet's formation for a course: 'line' (line ahead) or 'abreast'. Chosen on the fleet row of the
// dock; remembered on this device.
export const FORMATIONS = ['line', 'abreast'];
export function setFormation(kind) {
  if (!FORMATIONS.includes(kind)) return;
  S.formation = kind;
  store.set('formation', kind);
}

// A ship taking an order of her own leaves any line she was in: the ships astern of her close up on the ship
// ahead of her (or, if she led, follow the next ship as their new head).
function leaveLine(s) {
  const o = s.order, up = o && (o.kind === 'line' || o.kind === 'abreast') ? o.leaderId : null;
  for (const f of S.G.ships) {
    const fo = f.order;
    if (f === s || !fo || fo.leaderId !== s.id || (fo.kind !== 'line' && fo.kind !== 'abreast')) continue;
    if (up != null) { fo.leaderId = up; if (fo.kind === 'line') fo.gap = spacing(shipById(up), f, 'line'); }
  }
}

// Whole fleet: the selected ship sails the course and the rest form on her, in line ahead (each keeping station
// in the wake of the ship ahead of her, nearest ship first) or line abreast (on her beams, keeping the side of
// her each is already on). The formations themselves are sailed in src/sim/formation.js.
function formFleet(lead, pts) {
  const G = S.G;
  const rest = G.ships.filter((o) => o !== lead && commandable(o) && !o.boarding);
  if (!rest.length) return;
  const kind = S.formation === 'abreast' ? 'abreast' : 'line';
  const h = Math.atan2(pts[0].y - lead.y, pts[0].x - lead.x), cx = Math.cos(h), cy = Math.sin(h);
  for (const s of [lead, ...rest]) s.trail = [];
  if (kind === 'line') {
    rest.sort((a, b) => Math.hypot(a.x - lead.x, a.y - lead.y) - Math.hypot(b.x - lead.x, b.y - lead.y));
    let ahead = lead;
    for (const s of rest) {
      s.order = { kind: 'line', leaderId: ahead.id, gap: spacing(ahead, s, 'line') };
      s.path = []; s.pivot = null;
      ahead = s;
    }
    return;
  }
  // Abreast: stations alternate starboard and port, nearest the head first; ships keep the side they're on.
  const side = (s) => -(s.x - lead.x) * cy + (s.y - lead.y) * cx; // + to starboard of the course
  rest.sort((a, b) => side(a) - side(b));
  const slots = [];
  let port = 0, stbd = 0;
  for (let i = 0; i < rest.length; i++) {
    if (i % 2 === 0) slots.push(++stbd); else slots.push(-(++port));
  }
  slots.sort((a, b) => a - b);
  rest.forEach((s, i) => {
    const k = slots[i], step = spacing(lead, s, 'abreast');
    s.order = { kind: 'abreast', leaderId: lead.id, off: k * step };
    s.path = []; s.pivot = null;
  });
}

// A drawn course (or a single point for "sail straight there"). A new course cancels an engage order.
export function setCourse(ship, pts) {
  if (!commandable(ship) || !pts.length) return;
  leaveLine(ship);
  ship.path = pts; ship.pivot = null; ship.order = null;
  S.G.dragged = true;
  if (S.selectAll) formFleet(ship, pts);
}

// Ranges (share of gun range) for the ships of a whole-fleet engage order, near and far in turn.
const STATION_RANGE = [0.6, 0.48, 0.74, 0.54, 0.68, 0.44, 0.8, 0.58];

// Engage: the ship (or the whole fleet) manoeuvres on its own to keep the target on the beam. A ship at
// anchor weighs it first. The whole fleet spreads round the target: each ship takes her own stretch of sea at
// her own range (src/sim/steering.js, beamSteer), spaced round from where the fleet is now, so they cross their
// fire instead of following one another round one ring.
export function engage(ship, target) {
  if (!target) return;
  const fleet = [];
  eachCommanded(ship, (s) => { leaveLine(s); s.order = { kind: 'engage', targetId: target.id }; s.path = []; s.pivot = null; fleet.push(s); });
  if (fleet.length > 1) {
    const brg = (s) => Math.atan2(s.y - target.y, s.x - target.x);
    let mx = 0, my = 0;
    for (const s of fleet) { mx += Math.cos(brg(s)); my += Math.sin(brg(s)); }
    const mean = Math.atan2(my, mx), n = fleet.length, step = Math.min(1.3, 5.2 / n);
    fleet.sort((a, b) => angDiff(mean, brg(a)) - angDiff(mean, brg(b)));
    fleet.forEach((s, i) => { s.order.brg = mean + (i - (n - 1) / 2) * step; s.order.rk = STATION_RANGE[i % STATION_RANGE.length]; s.order.dir = 0; s.order.turn = 0; });
  }
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
