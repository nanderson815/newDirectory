import { S, afloat, shipById, unitById, showToast } from '../state.js';
import { upChart } from './battle.js';
import { edgeHeading } from './exit.js';
import { abilitySteer } from './abilities/index.js';
import { eachGoal, hasGoalFlag } from './goals/index.js';
import { PI, clamp, angDiff } from '../util.js';
import { corePt, coreDist, grounds, coastGap } from './terrain.js';
import { formationSteer } from './formation.js';

// Distance a ship's centre must keep from an island's core: the drawn beach plus bevel plus most of the hull.
export const shoreClear = (is, s) => is.r * 1.05 + s.L * 0.42;
// The same for the rest of the geography (src/sim/terrain.js): reefs hole any hull, shoals only ground big
// ships, and a coast is kept off like a beach.
const reefClear = (c, s) => c.r + s.L * 0.35;
const shoalClear = (c, s) => c.r + s.L * 0.3;
const coastClear = (s) => s.L * 0.42 + 6;
const NONE = [];
// Capsule obstacles for ship s: [list, clearance, kind] (0 island, 1 reef, 2 shoal).
function obstacleLists(s) {
  const G = S.G;
  OBS[0][0] = G.islands; OBS[1][0] = G.reefs || NONE; OBS[2][0] = grounds(s) ? G.shoals || NONE : NONE;
  return OBS;
}
const OBS = [[NONE, shoreClear, 0], [NONE, reefClear, 1], [NONE, shoalClear, 2]];

// How far (x, y) sits inside the room ship s must keep from the geography: <= 0 is clear water for her.
export function penetration(s, x, y) {
  let pen = -Infinity;
  for (const [list, clear] of obstacleLists(s)) {
    for (const c of list) { const p = corePt(c, x, y); pen = Math.max(pen, clear(c, s) - Math.hypot(x - p.x, y - p.y)); }
  }
  for (const c of S.G.coasts || NONE) pen = Math.max(pen, coastClear(s) - coastGap(c, x, y));
  return pen;
}
export const blockedAt = (s, x, y) => penetration(s, x, y) > 0;
const inShoal = (s, p) => (S.G.shoals || NONE).some((c) => coreDist(c, p.x, p.y) < shoalClear(c, s));
// Feelers: is the way ahead on heading h clear for `look` units? Sailing out of somewhere she shouldn't be
// (pushed against a beach, stuck on a shoal) counts as clear as long as it doesn't take her deeper in.
export function wayClear(s, h, look) {
  const here = Math.max(0, penetration(s, s.x, s.y)), c = Math.cos(h), sn = Math.sin(h);
  for (const k of [0.35, 0.7, 1]) if (penetration(s, s.x + c * look * k, s.y + sn * look * k) > here + 0.5) return false;
  return true;
}

// The player's ships: an engage order (keep that target on the beam) or else the drawn course.
const gone = (s, u) => !u || (u.kind === 'fort' ? u.state !== 'active' || u.team === s.team : !afloat(u) || u.team === s.team);
export function playerSteer(s) {
  const o = s.order;
  if (o && (o.kind === 'line' || o.kind === 'abreast')) return s.pivot != null ? s.pivot : formationSteer(s);
  if (o && o.kind === 'engage') {
    const t = unitById(o.targetId);
    if (gone(s, t)) s.order = null;
    else if (s.pivot != null) {
      // Anchored with a target: swing her broadside onto it, whichever side is nearer.
      const b = Math.atan2(t.y - s.y, t.x - s.x), a1 = b + PI / 2, a2 = b - PI / 2;
      s.pivot = Math.abs(angDiff(s.h, a1)) < Math.abs(angDiff(s.h, a2)) ? a1 : a2;
      return s.pivot;
    } else return beamSteer(s, t, o.brg != null ? o : null);
  }
  return followPath(s);
}

export function followPath(s) {
  const G = S.G;
  while (s.path.length) {
    const p = s.path[0];
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    const last = s.path.length === 1;
    const onLand = blockedAt(s, p.x, p.y);
    const want = Math.atan2(p.y - s.y, p.x - s.x);
    const turnR = Math.max(s.v, 10) / s.turn;
    // Skip waypoints we've reached, that sit on land, or that are inside our turning circle.
    if ((last ? d < 22 : d < 44) || onLand || (d < turnR * 1.15 && Math.abs(angDiff(s.h, want)) > 1.25)) {
      // A course that ends on land or in water too shallow for her: say so rather than just stopping.
      if (onLand && last && s.team === 'player' && s.id > 0 && d > 60) showToast(grounds(s) && inShoal(s, p) ? 'Too shallow for her' : 'She can’t sail there', s, 1.4);
      s.path.shift();
      continue;
    }
    return avoidIslands(s, want, d);
  }
  return null;
}

// Bends a heading around the nearest obstacle that sits across it (an island, a reef, or a shoal she'd run aground
// on), passing on the side the course already leans to; then checks the way is clear of everything, the coast
// included, and swings the bow further if it isn't. Long islands block the whole span between their ends.
export function avoidIslands(s, desired, reach) {
  const G = S.G;
  let best = desired, bestD = Infinity;
  const open = (a, dist) => {
    const px = s.x + Math.cos(a) * dist, py = s.y + Math.sin(a) * dist;
    return px > 25 && px < G.W - 25 && py > 25 && py < G.H - 25 && !(G.coasts || NONE).some((c) => coastGap(c, px, py) < coastClear(s));
  };
  for (const [list, clearOf, kind] of obstacleLists(s)) {
    for (const c of list) {
      const p = corePt(c, s.x, s.y), d = Math.hypot(p.x - s.x, p.y - s.y);
      const clear = clearOf(c, s) + 14;
      if (d - clear > Math.min(reach, 160) || d >= bestD) continue;
      // Already in the shallows or over the reef: just sail out of it.
      if (kind && d < c.r) continue;
      // The arc of headings it blocks, relative to the desired one: the union of its two end circles.
      const ux = Math.cos(c.ang || 0) * (c.hl || 0), uy = Math.sin(c.ang || 0) * (c.hl || 0);
      let lo = Infinity, hi = -Infinity, behind = 0;
      for (const e of [-1, 1]) {
        const ex = c.x + ux * e - s.x, ey = c.y + uy * e - s.y, de = Math.hypot(ex, ey);
        const off = angDiff(desired, Math.atan2(ey, ex)), tan = Math.asin(clamp(clear / Math.max(de, clear), 0, 1));
        if (Math.abs(off) > PI / 2 + tan) behind++;
        lo = Math.min(lo, off - tan); hi = Math.max(hi, off + tan);
        if (!c.hl) break;
      }
      if (behind === (c.hl ? 2 : 1) || lo > 0 || hi < 0 || hi - lo > PI * 1.9) continue;
      // Pass on the side the course leans to, unless that gap is blocked by the map edge or the coast.
      const reachD = Math.sqrt(Math.max(0, d * d - clear * clear)) + 10;
      let edge = -lo < hi ? lo - 0.12 : hi + 0.12;
      const other = edge === lo - 0.12 ? hi + 0.12 : lo - 0.12;
      if (!open(desired + edge, reachD) && open(desired + other, reachD)) edge = other;
      best = desired + edge;
      bestD = d;
    }
  }
  const look = Math.min(reach, 110);
  if (look > 24 && !wayClear(s, best, look)) {
    const pref = Math.sign(angDiff(desired, best)) || 1;
    for (let k = 1; k <= 15; k++) {
      for (const sg of [pref, -pref]) { const h = best + sg * k * 0.2; if (wayClear(s, h, look)) return h; }
    }
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
  s.closeOn = null;
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
        s.closeOn = o.id; // she means to lay alongside: her avoidance (src/sim/avoid.js) lets her
        return avoidIslands(s, Math.atan2(o.y - s.y, o.x - s.x), 160);
      }
    }
  }
  return beamSteer(s, t);
}

// Close on a target, then hold it on the beam at a comfortable range (enemy captains and the player's
// engage order alike). `st` is a station round the target for a whole-fleet engage order (src/hud/orders.js):
// { brg, rk, dir }: she works the arc of sea at bearing brg (radians, from the target) at rk of her gun range,
// sailing to and fro along it with the target on her beam, so the fleet spreads round the target instead of
// chasing one another round the same ring.
export const STATION_ARC = 0.45; // half-width of each ship's arc (radians)
export function beamSteer(s, t, st = null) {
  const G = S.G;
  const dx = t.x - s.x, dy = t.y - s.y, d = Math.hypot(dx, dy);
  const bearing = Math.atan2(dy, dx);
  // Mortar ships stand off at long range; a fort's island keeps everyone a little further out.
  const reach = s.standoff || s.range;
  const ideal = (s.standoff || s.range * (st ? st.rk : s.ideal)) + (t.kind === 'fort' ? G.islands[t.island].r : 0);
  let desired;
  // Raking (src/sim/combat.js): where we sit relative to her bow-stern line. 1 = dead ahead or astern of her.
  const ship = t.kind !== 'fort';
  const fromT = Math.atan2(-dy, -dx), along = ship ? Math.abs(Math.cos(angDiff(t.h, fromT))) : 0;
  if (st && d > Math.max(reach, ideal) * 1.1) {
    // Make for her own station on the ring.
    desired = Math.atan2(t.y + Math.sin(st.brg) * ideal - s.y, t.x + Math.cos(st.brg) * ideal - s.x);
  } else if (d > Math.max(reach, ideal) * 1.1) {
    desired = bearing;
    // Closing on her beam would take her broadside through our bow: come in at an angle, toward her stern.
    if (ship && d < t.range * 1.6 && along < 0.8) {
      const sx = t.x - Math.cos(t.h) * 80, sy = t.y - Math.sin(t.h) * 80;
      desired = bearing + (Math.sign(angDiff(bearing, Math.atan2(sy - s.y, sx - s.x))) || 1) * 0.5;
    }
  } else if (ship && s.crafty && s.speed >= t.speed * 0.95 && along < 0.93 && d > 80 && t.reload && t.reload[angDiff(t.h, fromT) < 0 ? 0 : 1] > 1) {
    // A crafty captain, while the broadside facing him is reloading, works round to cross her stern and rake
    // her rather than trade broadsides.
    const qx = t.x - Math.cos(t.h) * ideal, qy = t.y - Math.sin(t.h) * ideal;
    desired = Math.atan2(qy - s.y, qx - s.x);
  } else {
    const a1 = bearing + PI / 2, a2 = bearing - PI / 2;
    let base = Math.abs(angDiff(s.h, a1)) < Math.abs(angDiff(s.h, a2)) ? a1 : a2;
    if (st) {
      // Off the end of her arc: go about and work back along it. (Sailing along a1 turns her bearing from the
      // target down, anticlockwise on the chart; a2 turns it up.)
      const err = angDiff(Math.atan2(-dy, -dx), st.brg);
      if (Math.abs(err) > STATION_ARC) st.dir = Math.sign(err);
      if (st.dir) base = st.dir > 0 ? a2 : a1;
    }
    const corr = clamp((d - ideal) / ideal, -1, 1) * 0.6;
    desired = base + Math.sign(angDiff(base, bearing)) * corr;
    // Going about at the end of her arc: from well out she tacks in toward the target, from close in she wears
    // round away from it, so the turn never carries her through the target nor far out of range.
    // The way she turns is settled when the turn begins (st.turn), so she can't swing back and forth.
    if (st && Math.abs(angDiff(s.h, base)) > PI / 2) {
      if (!st.turn) {
        const r = Math.max(s.v, 20) / s.turn, inward = d > ideal + r * 0.5 ? 1 : -1;
        st.turn = inward * (Math.sign(angDiff(s.h, bearing)) || 1);
        // Never wear round into a friend close aboard: turn away from her instead.
        let f = null, fd = Infinity;
        for (const o of G.ships) {
          if (o === s || o.team !== s.team || !afloat(o)) continue;
          const dd = Math.hypot(o.x - s.x, o.y - s.y);
          if (dd < (s.L + o.L) * 2 && dd < fd) { fd = dd; f = o; }
        }
        // (Only from well out, tacking in: from close in, wearing the other way would carry her through the target.)
        if (f && inward > 0 && Math.sign(angDiff(s.h, Math.atan2(f.y - s.y, f.x - s.x))) === st.turn) st.turn = -st.turn;
      }
      desired = s.h + st.turn * 1.2;
    } else if (st) st.turn = 0;
  }
  // Ships with bow chasers like to point at you once they're close.
  if (s.chasers && t.kind !== 'fort' && d < s.range * 0.8 && d > 90 && Math.abs(angDiff(s.h, bearing)) < 0.6) desired = bearing;
  // Don't point straight into the wind; take the nearest tack instead.
  const up = G.wind.dir + PI;
  const du = angDiff(up, desired);
  if (Math.abs(du) < 0.6) desired = up + (du >= 0 ? 0.6 : -0.6);
  return avoidIslands(s, desired, 160);
}
