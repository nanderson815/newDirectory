import { S, afloat, shipById, unitById } from '../state.js';
import { upChart } from './battle.js';
import { edgeHeading } from './exit.js';
import { abilitySteer } from './abilities/index.js';
import { eachGoal, hasGoalFlag } from './goals/index.js';
import { PI, clamp, angDiff } from '../util.js';

// Distance a ship's centre must keep from an island: the drawn beach plus bevel plus most of the hull.
export const shoreClear = (is, s) => is.r * 1.05 + s.L * 0.42;

// The player's ships: an engage order (keep that target on the beam) or else the drawn course.
const gone = (s, u) => !u || (u.kind === 'fort' ? u.state !== 'active' || u.team === s.team : !afloat(u) || u.team === s.team);
export function playerSteer(s) {
  const o = s.order;
  if (o && o.kind === 'engage') {
    const t = unitById(o.targetId);
    if (gone(s, t)) s.order = null;
    else if (s.pivot != null) {
      // Anchored with a target: swing her broadside onto it, whichever side is nearer.
      const b = Math.atan2(t.y - s.y, t.x - s.x), a1 = b + PI / 2, a2 = b - PI / 2;
      s.pivot = Math.abs(angDiff(s.h, a1)) < Math.abs(angDiff(s.h, a2)) ? a1 : a2;
      return s.pivot;
    } else return beamSteer(s, t);
  }
  return followPath(s);
}

export function followPath(s) {
  const G = S.G;
  while (s.path.length) {
    const p = s.path[0];
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    const last = s.path.length === 1;
    const onLand = G.islands.some((is) => Math.hypot(p.x - is.x, p.y - is.y) < shoreClear(is, s));
    const want = Math.atan2(p.y - s.y, p.x - s.x);
    const turnR = Math.max(s.v, 10) / s.turn;
    // Skip waypoints we've reached, that sit on land, or that are inside our turning circle.
    if ((last ? d < 22 : d < 44) || onLand || (d < turnR * 1.15 && Math.abs(angDiff(s.h, want)) > 1.25)) {
      s.path.shift();
      continue;
    }
    return avoidIslands(s, want, d);
  }
  return null;
}

// Bends a heading around the nearest island that sits across it, passing on the side the course already leans to.
export function avoidIslands(s, desired, reach) {
  const G = S.G;
  let best = desired, bestD = Infinity;
  for (const is of G.islands) {
    const dx = is.x - s.x, dy = is.y - s.y, d = Math.hypot(dx, dy);
    const clear = shoreClear(is, s) + 14;
    if (d - clear > Math.min(reach, 160) || d >= bestD) continue;
    const toIs = Math.atan2(dy, dx);
    const off = angDiff(desired, toIs);
    if (Math.abs(off) > PI / 2 || Math.abs(Math.sin(off)) * d > clear) continue;
    const tangent = Math.asin(clamp(clear / Math.max(d, clear), 0, 1));
    // Pass on the side the course leans to, unless that gap is blocked by the map edge.
    const open = (side) => {
      const px = is.x + Math.cos(toIs + side * PI / 2) * clear, py = is.y + Math.sin(toIs + side * PI / 2) * clear;
      return px > 25 && px < G.W - 25 && py > 25 && py < G.H - 25;
    };
    let side = off > 0 ? -1 : 1;
    if (!open(side) && open(-side)) side = -side;
    best = toIs + side * (tangent + 0.12);
    bestD = d;
  }
  return best;
}

// Escorted merchantmen sail for the exit at the top of the chart on their own, dodging islands.
export function escortSteer(s) {
  return avoidIslands(s, upChart(S.G), 160);
}

// How keen an enemy captain is on a target t at distance d: lower is keener. Goals add their own bias.
function weigh(s, t, d) {
  if (t.kind === 'fort') d *= 0.75;
  eachGoal(S.G, 'weigh', (g, o) => { d = g.weigh(o, S.G, s, t, d); });
  return d;
}

// Enemy captains: close on the nearest English ship, then hold it on the beam at a comfortable range.
// A runner makes for the edge; abilities (a fireship's run) and goals (salvaging treasure) can take the helm next.
export function aiSteer(s, dt) {
  const G = S.G;
  if (s.passive) return null;
  // A ship that has broken off runs straight for the nearest edge of the chart, whatever else is going on.
  if (s.fleeing) return avoidIslands(s, edgeHeading(G, s), 160);
  const own = abilitySteer(s);
  if (own != null) return own;
  let goal = null;
  eachGoal(G, 'steer', (g, o) => { if (goal == null) goal = g.steer(o, G, s); });
  if (goal != null) return goal;
  s.aiT -= dt;
  let t = s.targetId != null ? unitById(s.targetId) : null;
  if (s.aiT <= 0 || gone(s, t)) {
    let best = null, bd = Infinity;
    for (const o of G.ships) {
      if (o.team === s.team || !afloat(o)) continue;
      const d = weigh(s, o, Math.hypot(o.x - s.x, o.y - s.y));
      if (d < bd) { bd = d; best = o; }
    }
    // Besiegers go for the forts they came to take.
    if (hasGoalFlag(G, 'aiForts')) {
      for (const f of G.forts) {
        if (f.team === s.team || f.state !== 'active') continue;
        const d = weigh(s, f, Math.hypot(f.x - s.x, f.y - s.y));
        if (d < bd) { bd = d; best = f; }
      }
    }
    s.targetId = best ? best.id : null; t = best; s.aiT = 1.5;
  }
  if (!t) return null;
  // A crippled English ship close by, with too few marines to hold her: run alongside and board.
  if (!s.boss && !s.ally && s.marines > 0) {
    for (const o of G.ships) {
      if (o.team === s.team || !afloat(o) || o.hp > o.maxHp * 0.4 || Math.hypot(o.x - s.x, o.y - s.y) > 220) continue;
      if (s.marines > Math.round(o.marines * (0.6 + 0.4 * o.hp / o.maxHp)) * 1.2) {
        return avoidIslands(s, Math.atan2(o.y - s.y, o.x - s.x), 160);
      }
    }
  }
  return beamSteer(s, t);
}

// Close on a target, then hold it on the beam at a comfortable range (enemy captains and the player's
// engage order alike).
export function beamSteer(s, t) {
  const G = S.G;
  const dx = t.x - s.x, dy = t.y - s.y, d = Math.hypot(dx, dy);
  const bearing = Math.atan2(dy, dx);
  // Mortar ships stand off at long range; a fort's island keeps everyone a little further out.
  const reach = s.standoff || s.range;
  const ideal = (s.standoff || s.range * s.ideal) + (t.kind === 'fort' ? G.islands[t.island].r : 0);
  let desired;
  if (d > Math.max(reach, ideal) * 1.1) {
    desired = bearing;
  } else {
    const a1 = bearing + PI / 2, a2 = bearing - PI / 2;
    const base = Math.abs(angDiff(s.h, a1)) < Math.abs(angDiff(s.h, a2)) ? a1 : a2;
    const corr = clamp((d - ideal) / ideal, -1, 1) * 0.6;
    desired = base + Math.sign(angDiff(base, bearing)) * corr;
  }
  // Ships with bow chasers like to point at you once they're close.
  if (s.chasers && t.kind !== 'fort' && d < s.range * 0.8 && d > 90 && Math.abs(angDiff(s.h, bearing)) < 0.6) desired = bearing;
  // Don't point straight into the wind; take the nearest tack instead.
  const up = G.wind.dir + PI;
  const du = angDiff(up, desired);
  if (Math.abs(du) < 0.6) desired = up + (du >= 0 ? 0.6 : -0.6);
  return avoidIslands(s, desired, 160);
}
