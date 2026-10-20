import { S, afloat, shipById } from '../state.js';
import { PI, clamp, angDiff } from '../util.js';
import { avoidIslands } from './steering.js';

// Formations for the whole fleet (src/hud/orders.js gives the orders):
// - Line ahead: each follower keeps station on the ship ahead of her, in that ship's wake, `gap` astern (centre
//   to centre). The wake is a breadcrumb trail every ship of yours leaves (s.trail), so a follower turns where her
//   leader turned instead of cutting the corner, and the line keeps its shape through any number of turns.
// - Line abreast: each follower keeps station off the head of the line's beam, `off` to starboard (negative: to
//   port), facing the way the head is heading.
// A follower's order is { kind: 'line', leaderId, gap } or { kind: 'abreast', leaderId, off }; the head of the line
// sails the course. She shortens sail to her slowest follower's pace (FORMATION.pace) so the line can keep up,
// and each follower eases or presses her sails to hold her station.
export const FORMATION = {
  gap: 1.8,       // line ahead: centre-to-centre spacing, in mean ship lengths (about 0.8 L of open water)
  abreast: 1.9,   // line abreast: spacing across, in mean ship lengths
  pace: 0.88,     // the head sails at this share of her slowest follower's best speed
  crumb: 10,      // map units between trail points
  trail: 40,      // trail points kept (400 units of wake)
  lead: 1.3,      // a follower steers for a point this many of her lengths ahead of her station
};

// Spacing between two ships for a formation kind.
export const spacing = (a, b, kind) => (kind === 'abreast' ? FORMATION.abreast : FORMATION.gap) * (a.L + b.L) / 2;

// Drops a breadcrumb behind a ship of yours as she sails.
export function recordTrail(s) {
  const t = s.trail || (s.trail = []);
  const n = t.length;
  if (n && Math.hypot(s.x - t[n - 2], s.y - t[n - 1]) < FORMATION.crumb) return;
  t.push(s.x, s.y);
  if (t.length > FORMATION.trail * 2) t.splice(0, 2);
}

// The point `dist` astern of ship p along her wake, with the wake's forward direction there: out = { x, y, tx, ty }.
// Past the end of the trail it carries on straight back along the trail's last leg (or her heading).
const TP = { x: 0, y: 0, tx: 1, ty: 0 };
export function wakePoint(p, dist, out = TP) {
  const t = p.trail || [];
  let cx = p.x, cy = p.y, r = dist, bx = -Math.cos(p.h), by = -Math.sin(p.h);
  for (let i = t.length - 2; i >= 0; i -= 2) {
    const dx = t[i] - cx, dy = t[i + 1] - cy, len = Math.hypot(dx, dy);
    if (len < 1e-3) continue;
    bx = dx / len; by = dy / len;
    if (len >= r) { out.x = cx + bx * r; out.y = cy + by * r; out.tx = -bx; out.ty = -by; return out; }
    r -= len; cx = t[i]; cy = t[i + 1];
  }
  out.x = cx + bx * r; out.y = cy + by * r; out.tx = -bx; out.ty = -by;
  return out;
}

// The head of the line a ship sails in (herself if she leads, or sails alone).
export function headOf(s) {
  let h = s;
  for (let k = 0; k < 12 && h.order && (h.order.kind === 'line' || h.order.kind === 'abreast'); k++) {
    const up = shipById(h.order.leaderId);
    if (!up) break;
    h = up;
  }
  return h;
}

const following = (s) => !!s.order && (s.order.kind === 'line' || s.order.kind === 'abreast');
const keeps = (p, s) => p && afloat(p) && p.team === s.team && !p.escort && !p.ally;

// Once a tick, before the ships move: each head of a line sails at her slowest follower's pace; the head's
// heading is smoothed for line abreast (so the line swings round with her, not with every twitch of her helm).
export function paceFormations(G, dt) {
  for (const s of G.ships) { s.vCap = null; s.fV = 1; }
  for (const s of G.ships) {
    if (!following(s) || !afloat(s)) continue;
    const h = headOf(s);
    if (h === s || !afloat(h)) continue;
    const pot = s.vPot != null ? s.vPot : s.speed;
    const cap = pot * FORMATION.pace;
    if (h.vCap == null || cap < h.vCap) h.vCap = cap;
  }
  for (const s of G.ships) {
    if (s.team !== 'player' || !afloat(s)) continue;
    s.fH = s.fH == null ? s.h : s.fH + clamp(angDiff(s.fH, s.h), -0.9 * dt, 0.9 * dt);
  }
}

// Steering for a follower: returns the heading for her station (or null once there's nothing to follow) and sets
// s.fV, the share of her best speed she carries to hold it.
export function formationSteer(s) {
  const o = s.order;
  let p = shipById(o.leaderId);
  if (!keeps(p, s)) {
    // Her leader is gone: close up on the ship ahead of him, or (heading the line now) sail on as she goes.
    const up = p && following(p) && p.order.kind === o.kind ? p.order.leaderId : null;
    p = up != null && up !== s.id ? shipById(up) : null;
    if (!keeps(p, s)) { s.order = null; return null; }
    o.leaderId = p.id;
    if (o.kind === 'line') o.gap = spacing(p, s, 'line');
  }
  let sx, sy, tx, ty;
  if (o.kind === 'line') {
    const w = wakePoint(p, o.gap);
    sx = w.x; sy = w.y; tx = w.tx; ty = w.ty;
  } else {
    const h = p.fH != null ? p.fH : p.h;
    tx = Math.cos(h); ty = Math.sin(h);
    sx = p.x - ty * o.off; sy = p.y + tx * o.off;
  }
  const gap = o.kind === 'line' ? o.gap : Math.abs(o.off) || spacing(p, s, 'line');
  const dx = sx - s.x, dy = sy - s.y, dS = Math.hypot(dx, dy);
  const along = dx * tx + dy * ty; // > 0: her station is ahead of her
  const ahead = Math.max(s.L * FORMATION.lead, 36);
  let ax, ay;
  if (dS > gap * 1.2) {
    // Still forming up: make for her station, leading it a little as it moves on.
    const k = Math.min(dS, gap) * 0.6;
    ax = sx + tx * k; ay = sy + ty * k;
    s.fV = 1;
  } else {
    // On station: steer for a point a little ahead on the line, and trim sail to hold her place.
    if (o.kind === 'line') { const w = wakePoint(p, Math.max(0, o.gap - ahead)); ax = w.x; ay = w.y; } else { ax = sx + tx * ahead; ay = sy + ty * ahead; }
    // Gap error, plus how fast she is closing on her leader: when the ship ahead shortens sail (a turn, a gust)
    // she eases off at once, before the gap closes up.
    s.fV = clamp(0.8 + 0.9 * along / gap - 1.4 * (s.v - p.v) / Math.max(s.speed, 1), 0.3, 1);
  }
  // A ship whose station is a little astern of her and close in can't turn back onto it: she eases right off.
  if (along < -gap * 0.25 && dS < gap) s.fV = 0.35;
  const want = Math.atan2(ay - s.y, ax - s.x);
  return avoidIslands(s, Math.abs(angDiff(s.h, want)) > PI * 0.9 && dS < gap * 0.6 ? s.h : want, Math.max(dS, 60));
}
