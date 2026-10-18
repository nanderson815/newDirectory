import { S, afloat, shipById, unitById } from '../state.js';
import { upChart } from './battle.js';
import { fireshipTarget } from './special.js';
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

// Escorted merchantmen sail for the exit at the top of the chart on their own, dodging islands.
export function escortSteer(s) {
  return avoidIslands(s, upChart(S.G), 160);
}

// How keen an enemy captain is on a target: lower is keener. Each goal gives them something to go after.
function weigh(s, o, d) {
  const G = S.G;
  if (o.kind === 'fort') return d * 0.75;
  if (G.goal === 'escort' && o.escort) return d * 0.6;
  if (G.goal === 'breakthrough' && o.flag) return d * 0.65;
  return d;
}

// Enemy captains: close on the nearest English ship, then hold it on the beam at a comfortable range.
export function aiSteer(s, dt) {
  const G = S.G;
  if (s.passive) return null;
  // Fireships just make straight for the nearest target.
  if (s.fireship) {
    const f = fireshipTarget(s);
    return f ? avoidIslands(s, Math.atan2(f.y - s.y, f.x - s.x), Math.hypot(f.x - s.x, f.y - s.y)) : null;
  }
  // Pirate salvors make for the floating treasure while no English ship is close.
  if (G.goal === 'treasure' && s.id % 2 === 0 && !s.boss) {
    const near = G.ships.some((o) => o.team !== s.team && afloat(o) && Math.hypot(o.x - s.x, o.y - s.y) < 170);
    let c = null, cd = Infinity;
    for (const q of G.chests) { if (q.taken) continue; const d = Math.hypot(q.x - s.x, q.y - s.y); if (d < cd) { cd = d; c = q; } }
    if (c && !near) return avoidIslands(s, Math.atan2(c.y - s.y, c.x - s.x), cd);
  }
  s.aiT -= dt;
  let t = s.targetId != null ? unitById(s.targetId) : null;
  const gone = (u) => !u || (u.kind === 'fort' ? u.state !== 'active' || u.team === s.team : !afloat(u) || u.team === s.team);
  if (s.aiT <= 0 || gone(t)) {
    let best = null, bd = Infinity;
    for (const o of G.ships) {
      if (o.team === s.team || !afloat(o)) continue;
      const d = weigh(s, o, Math.hypot(o.x - s.x, o.y - s.y));
      if (d < bd) { bd = d; best = o; }
    }
    // Besiegers go for the fort they came to take.
    if (G.goal === 'defend') {
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
  // Mortar ships stand off at long range; a fort's island keeps everyone a little further out.
  const reach = s.mortar && !s.boss ? s.mortar.range * 0.75 : s.range;
  const ideal = reach * (s.mortar && !s.boss ? 1 : s.ideal) + (t.kind === 'fort' ? G.islands[t.island].r : 0);
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
