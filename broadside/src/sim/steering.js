import { S, afloat, shipById } from '../state.js';
import { PI, clamp, angDiff } from '../util.js';

// Distance a ship's centre must keep from an island: the drawn beach plus bevel plus most of the hull.
export const shoreClear = (is, s) => is.r * 1.05 + s.L * 0.42;

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

// Enemy captains: close on the nearest English ship, then hold it on the beam at a comfortable range.
export function aiSteer(s, dt) {
  const G = S.G;
  if (s.passive) return null;
  s.aiT -= dt;
  let t = s.targetId != null ? shipById(s.targetId) : null;
  if (s.aiT <= 0 || !t || !afloat(t)) {
    let best = null, bd = Infinity;
    for (const o of G.ships) {
      if (o.team === s.team || !afloat(o)) continue;
      const d = Math.hypot(o.x - s.x, o.y - s.y);
      if (d < bd) { bd = d; best = o; }
    }
    s.targetId = best ? best.id : null; t = best; s.aiT = 1.5;
  }
  if (!t) return null;
  // A crippled English ship close by, with too few marines to hold her: run alongside and board.
  if (!s.boss && s.marines > 0) {
    for (const o of G.ships) {
      if (o.team === s.team || !afloat(o) || o.hp > o.maxHp * 0.4 || Math.hypot(o.x - s.x, o.y - s.y) > 220) continue;
      if (s.marines > Math.round(o.marines * (0.6 + 0.4 * o.hp / o.maxHp)) * 1.2) {
        return avoidIslands(s, Math.atan2(o.y - s.y, o.x - s.x), 160);
      }
    }
  }
  const dx = t.x - s.x, dy = t.y - s.y, d = Math.hypot(dx, dy);
  const bearing = Math.atan2(dy, dx);
  const ideal = s.range * s.ideal;
  let desired;
  if (d > s.range * 1.1) {
    desired = bearing;
  } else {
    const a1 = bearing + PI / 2, a2 = bearing - PI / 2;
    const base = Math.abs(angDiff(s.h, a1)) < Math.abs(angDiff(s.h, a2)) ? a1 : a2;
    const corr = clamp((d - ideal) / ideal, -1, 1) * 0.6;
    desired = base + Math.sign(angDiff(base, bearing)) * corr;
  }
  // Ships with bow chasers like to point at you once they're close.
  if (s.chasers && d < s.range * 0.8 && d > 90 && Math.abs(angDiff(s.h, bearing)) < 0.6) desired = bearing;
  // Don't point straight into the wind; take the nearest tack instead.
  const up = G.wind.dir + PI;
  const du = angDiff(up, desired);
  if (Math.abs(du) < 0.6) desired = up + (du >= 0 ? 0.6 : -0.6);
  return avoidIslands(s, desired, 160);
}
