import { S, afloat } from '../state.js';
import { clamp, angDiff } from '../util.js';
import { wayClear } from './steering.js';

// Local avoidance between ships: every captain, English or Spanish, watches the ships around her and bends her
// helm (or eases her sails) before a collision rather than after it. The hard collision in src/sim/ships.js is
// left for what this can't prevent.
//
// Each tick she tries a fan of headings around the one she wants, at full and at reduced sail, and scores each:
// how far it takes her off her course, plus a risk for every ship it would bring inside her comfort ring within
// the horizon (sooner is worse). Everyone is assumed to hold their present course and speed, so two captains
// who meet both alter; a small preference for turning to starboard means two ships meeting head on pass port to
// port, as the rule of the road says, instead of dancing. Her choice eases in, so the helm never jitters.
//
// Friends keep a comfortable distance (AVOID.ally); enemies only stop short of the hulls (AVOID.foe, inside
// boarding reach) and only at the last moment (foeHorizon), so ships still close to fight and board. Rammers and
// fireships don't avoid their prey at all, nor does a Spanish boarder the ship she means to take, nor one of yours
// whose course ends on an enemy ship.
//
// The course preview (src/sim/predict.js) runs this too, with the other ships sailed on along their present
// course for the time it is looking ahead (AV.tau), so the track it draws bends round them as she will.
export const AVOID = {
  horizon: 3,        // seconds ahead she watches friends
  foeHorizon: 1.0,   // ... and enemies
  ally: 0.5,         // friends keep (L1 + L2) * ally between centres: a third of a length of open water end to end,
                     // much more abeam (a line ahead keeps its own, wider spacing: src/sim/formation.js)
  // In action (an enemy ship or fort inside her gun range) a captain fights his ship: he only keeps clear of his
  // friends' hulls (a tighter ring, watched less far ahead), easing sail only when turning won't do.
  allyAction: 0.42, actionHorizon: 2, actionSlow: true, actionTurn: 1.25, // (actionTurn: how far she may bear away)
  foe: 0.36,         // enemies may come to (L1 + L2) * foe: alongside, inside boarding reach (0.45), outside the hulls (0.34)
  fan: [0, 0.18, -0.18, 0.4, -0.4, 0.65, -0.65, 0.95, -0.95, 1.25, -1.25], // heading offsets tried (radians)
  slow: 0.55,        // the reduced-sail candidates: this share of her way
  slowCost: 0.3,     // ... cost the same as bearing away by 0.3 rad
  starboard: 0.12,   // bonus for altering to starboard
  stick: 0.3,        // cost per radian of changing her mind from last tick's choice
  risk: 3.2,         // weight of a collision course (turning away by a radian costs 1)
  ease: 3,           // 1/s: how fast the chosen alteration takes hold
};
// The preview sets tau: how many seconds ahead the other ships are dead-reckoned.
export const AV = { tau: 0 };

// The ship she is deliberately closing on (ignored by her avoidance), if any.
function prey(s, o) {
  if (o.team === s.team) return false;
  if (s.fireship || (s.abilities && s.abilities.ram)) return true;
  if (s.closeOn === o.id) return true;
  const p = s.path && s.path.length ? s.path[s.path.length - 1] : null;
  return !!p && Math.hypot(p.x - o.x, p.y - o.y) < (s.L + o.L) * 0.7;
}

// Where ship o will be t seconds on, holding her present rate of turn a little while (0.8 s, 0.6 rad at most: a
// captain can see her swinging, not where the swing ends) and then her heading: out = { x, y }.
const AH = { x: 0, y: 0 };
function aheadOf(o, t, out = AH) {
  const v = o.boarding || o.pivot != null ? 0 : o.v, w = o.hRate || 0;
  if (Math.abs(w) < 0.02 || !v) { out.x = o.x + Math.cos(o.h) * v * t; out.y = o.y + Math.sin(o.h) * v * t; return out; }
  const tt = Math.min(t, 0.8, 0.6 / Math.abs(w)), h2 = o.h + w * tt;
  out.x = o.x + (v / w) * (Math.sin(h2) - Math.sin(o.h)) + Math.cos(h2) * v * (t - tt);
  out.y = o.y - (v / w) * (Math.cos(h2) - Math.cos(o.h)) + Math.sin(h2) * v * (t - tt);
  return out;
}

// Neighbours this tick, relative to her: where each is now and where she'll be at K sample times over the
// horizon (once for full sail, once stretched for reduced sail), with her comfort radius and horizon.
const K = 10;
const NB = []; // per neighbour: [px, py, vx, vy, R, H, then K x/y pairs at full sail, then K pairs at reduced sail]
const STRIDE = 6 + K * 4;
const CAND = []; // candidates better than holding on: [cost, offset, sail] triples
// Where she will be, relative to where she is now, t seconds after putting her helm over for heading `a` at
// speed `v`: she swings round at her rate of turn, then sails straight (so a captain knows his own turning circle).
const OWN = { x: 0, y: 0, h: 0, rate: 1 };
function ownAt(a, v, t) {
  const h0 = OWN.h, dh = angDiff(h0, a), w = Math.sign(dh) * OWN.rate;
  if (!w || Math.abs(dh) < 0.02) { OWN.x = Math.cos(a) * v * t; OWN.y = Math.sin(a) * v * t; return; }
  const tt = Math.min(t, Math.abs(dh) / OWN.rate), h2 = h0 + w * tt;
  OWN.x = (v / w) * (Math.sin(h2) - Math.sin(h0)) + Math.cos(h2) * v * (t - tt);
  OWN.y = -(v / w) * (Math.cos(h2) - Math.cos(h0)) + Math.sin(h2) * v * (t - tt);
}
// Risk for a candidate heading `a` at speed `v`: the first sample time she'd be inside a neighbour's ring (sooner
// is worse), graded by how deep. Under reduced sail (`slow` = 1) the samples run over a longer time, so easing off
// earns nothing by just putting a collision off for later, only by letting the other ship by.
function riskOf(a, v, n, slow = 0) {
  const vx = Math.cos(a) * v, vy = Math.sin(a) * v;
  let r = 0;
  for (let i = 0; i < n; i += STRIDE) {
    const px = NB[i], py = NB[i + 1], R = NB[i + 4], H = NB[i + 5];
    const pp = px * px + py * py;
    if (pp < R * R) {
      // Already inside her ring: anything that closes further is bad, anything that opens it well is fine.
      const wx = vx - NB[i + 2], wy = vy - NB[i + 3], pw = px * wx + py * wy, d = Math.sqrt(pp) || 1e-3;
      // Sailing on alongside counts against her too: she should open the distance, not hold it.
      const closing = pw / (d * (Math.hypot(wx, wy) || 1e-3));
      if (closing > -0.35) r += AVOID.risk * (1 - d / R + 0.3) * (closing + 0.35);
      continue;
    }
    const base = i + 6 + (slow ? K * 2 : 0), span = slow ? H / AVOID.slow : H;
    // Each leg between samples is a straight run, so take its closest approach (fast ships cross a small ring
    // between two samples).
    let hit = -1, dmin = Infinity, ax = px, ay = py;
    for (let j = 0; j < K; j++) {
      ownAt(a, v, span * (j + 1) / K);
      const bx = NB[base + j * 2] - OWN.x, by = NB[base + j * 2 + 1] - OWN.y;
      const ex = bx - ax, ey = by - ay, ee = ex * ex + ey * ey;
      const u = ee > 1e-6 ? clamp(-(ax * ex + ay * ey) / ee, 0, 1) : 0;
      const d = Math.hypot(ax + ex * u, ay + ey * u);
      if (d < dmin) dmin = d;
      if (d < R && hit < 0) hit = j;
      ax = bx; ay = by;
    }
    if (hit < 0) continue;
    const k = 1 - hit / K;
    r += AVOID.risk * k * k * (0.55 + 0.45 * (1 - dmin / R));
  }
  return r;
}

// Bends `desired` (or her present heading, when she has no orders) away from the ships about her and sets
// s.avoidV, the share of her way she should carry. Returns the heading to steer (or null to hold her course).
export function avoidShips(s, desired, dt) {
  if (s.pivot != null || s.passive || s.boarding || s.fled) { s.avoidOff = 0; s.avoidV = 1; return desired; }
  const G = S.G, tau = AV.tau;
  const vs = Math.max(s.v, s.speed * 0.4);
  // In action: an enemy ship afloat, or a hostile fort still firing, inside her gun range (plus the fort's island).
  let action = false;
  for (const o of G.ships) if (o.team !== s.team && afloat(o) && Math.abs(o.x - s.x) < s.range && Math.abs(o.y - s.y) < s.range && Math.hypot(o.x - s.x, o.y - s.y) < s.range) { action = true; break; }
  if (!action) for (const f of G.forts) if (f.team !== s.team && f.state === 'active' && Math.hypot(f.x - s.x, f.y - s.y) < s.range + G.islands[f.island].r) { action = true; break; }
  let n = 0;
  for (const o of G.ships) {
    if (o === s || o.id === s.self || !afloat(o) || (o.fled && o.state !== 'afloat')) continue;
    const foe = o.team !== s.team;
    if (foe && prey(s, o)) continue;
    const ov = o.boarding || o.pivot != null ? 0 : o.v;
    const R = (s.L + o.L) * (foe ? AVOID.foe : action ? AVOID.allyAction : AVOID.ally), H = foe ? AVOID.foeHorizon : action ? AVOID.actionHorizon : AVOID.horizon;
    const at = aheadOf(o, tau);
    const px = at.x - s.x, py = at.y - s.y;
    if (px * px + py * py > (R + (vs + ov) * H) ** 2) continue; // too far off to meet within the horizon
    NB[n] = px; NB[n + 1] = py; NB[n + 4] = R; NB[n + 5] = H;
    const hh = o.h + (o.hRate || 0) * Math.min(tau, 1.5);
    NB[n + 2] = Math.cos(hh) * ov; NB[n + 3] = Math.sin(hh) * ov;
    for (let j = 0; j < K; j++) {
      const a = aheadOf(o, tau + H * (j + 1) / K);
      NB[n + 6 + j * 2] = a.x - s.x; NB[n + 7 + j * 2] = a.y - s.y;
      const b = aheadOf(o, tau + H / AVOID.slow * (j + 1) / K);
      NB[n + 6 + K * 2 + j * 2] = b.x - s.x; NB[n + 7 + K * 2 + j * 2] = b.y - s.y;
    }
    n += STRIDE;
  }
  let pick = 0, pickV = 1;
  if (n) {
    // With no orders she holds the heading she had when the alteration began.
    const base = desired != null ? desired : s.avoidRef != null ? s.avoidRef : s.h;
    const prev = s.avoidPick || 0;
    OWN.h = s.h; OWN.rate = Math.max(0.2, s.turn * (0.55 + 0.45 * Math.min(1, s.v / s.speed)));
    const r0 = riskOf(base, vs, n);
    if (r0 > 0) {
      const keep = r0 + AVOID.stick * Math.abs(prev);
      let m = 0;
      for (const k of [1, AVOID.slow]) {
        for (const off of AVOID.fan) {
          if ((!off && k === 1) || (k < 1 && action && !AVOID.actionSlow) || (action && Math.abs(off) > AVOID.actionTurn)) continue;
          const a = base + off, v = vs * k;
          const cost = Math.abs(off) - (off > 0 ? AVOID.starboard : 0) + (k < 1 ? AVOID.slowCost : 0) + AVOID.stick * Math.abs(off - prev) + riskOf(a, v, n, k < 1 ? 1 : 0);
          if (cost < keep) { CAND[m++] = cost; CAND[m++] = off; CAND[m++] = k; }
        }
      }
      // The cheapest alteration that doesn't bear away onto the beach (checked lazily: the land test is dear).
      for (let found = false; m && !found;) {
        let bi = 0;
        for (let i = 3; i < m; i += 3) if (CAND[i] < CAND[bi]) bi = i;
        const off = CAND[bi + 1];
        if (!off || wayClear(s, base + off, 70)) { pick = off; pickV = CAND[bi + 2]; found = true; }
        CAND[bi] = CAND[m - 3]; CAND[bi + 1] = CAND[m - 2]; CAND[bi + 2] = CAND[m - 1]; m -= 3;
      }
    }
    if (desired == null && s.avoidRef == null && (pick || pickV < 1)) s.avoidRef = s.h;
  }
  s.avoidPick = pick;
  const e = Math.min(1, dt * AVOID.ease);
  s.avoidOff = (s.avoidOff || 0) + (pick - (s.avoidOff || 0)) * e;
  s.avoidV = (s.avoidV == null ? 1 : s.avoidV) + (pickV - (s.avoidV == null ? 1 : s.avoidV)) * e;
  if (Math.abs(s.avoidOff) < 0.01 && !pick) {
    s.avoidOff = 0;
    // With no orders she comes back to the heading she was holding, then holds it again.
    if (desired == null && s.avoidRef != null && Math.abs(angDiff(s.h, s.avoidRef)) > 0.03) return s.avoidRef;
    s.avoidRef = null;
    return desired;
  }
  const base = desired != null ? desired : s.avoidRef != null ? s.avoidRef : s.h;
  return base + clamp(s.avoidOff, -1.4, 1.4);
}
