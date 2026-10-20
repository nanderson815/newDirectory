import { S, afloat } from '../../state.js';
import { rand, reduceMotion } from '../../util.js';
import { hitShip, sinkShip } from '../combat.js';
import { avoidIslands } from '../steering.js';
import { spawn } from '../particles.js';
import { sfx } from '../../audio/sfx.js';

// A fireship steers for the nearest enemy and blows up alongside (`dmg`). Whenever she goes down, rammed
// home or sunk early, the blast scorches every ship within `radius`, friend or foe (up to `splash`).
function nearestFoe(s) {
  let best = null, bd = Infinity;
  for (const o of S.G.ships) {
    if (o.team === s.team || !afloat(o)) continue;
    const d = Math.hypot(o.x - s.x, o.y - s.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

export default {
  id: 'fireship',
  about: 'Steers for the nearest enemy and explodes alongside; any sinking sets off a blast.',
  params: { dmg: 'ramming damage', splash: 'blast damage at the centre', radius: 'blast radius' },
  defaults: { dmg: 45, splash: 18, radius: 70 },
  init(s) { s.fireship = true; s.burning = true; },
  steer(s) {
    const t = nearestFoe(s);
    return t ? avoidIslands(s, Math.atan2(t.y - s.y, t.x - s.x), Math.hypot(t.x - s.x, t.y - s.y)) : null;
  },
  update(s, a) {
    const t = nearestFoe(s);
    if (!t || Math.hypot(t.x - s.x, t.y - s.y) >= (s.L + t.L) * 0.42) return;
    hitShip(t, { dmg: a.dmg * (s.team === 'enemy' ? S.G.ai.dmgMul : 1), team: s.team, x: (s.x + t.x) / 2, y: (s.y + t.y) / 2, fire: true });
    t.slowT = Math.max(t.slowT, 2);
    sinkShip(s);
  },
  sunk(s, a) {
    for (const o of S.G.ships) {
      if (o === s || !afloat(o)) continue;
      const d = Math.hypot(o.x - s.x, o.y - s.y);
      if (d >= a.radius + o.L * 0.4) continue; // 0.4 L: as far as the blast reached before hulls were cut to 3/4
      const dmg = Math.round(a.splash * (1 - 0.5 * Math.min(1, d / a.radius)));
      if (dmg > 0) hitShip(o, { dmg, team: s.team === o.team ? 'none' : s.team, x: o.x, y: o.y, fire: true });
    }
    spawn('flash', s.x, s.y, 0, 0, 0.35, 34, 8, 0);
    for (let k = 0; k < 16; k++) spawn('fire', s.x + rand(-18, 18), s.y + rand(-18, 18), rand(-30, 30), rand(-30, 30), rand(0.5, 1.0), rand(5, 9), 8, rand(20, 50));
    for (let k = 0; k < 8; k++) spawn('soot', s.x + rand(-14, 14), s.y + rand(-14, 14), rand(-14, 14), rand(-14, 14), rand(1.6, 2.6), rand(8, 13), 14, rand(14, 24));
    sfx.boom(1.3, 0.8, s.x, s.y);
    if (!reduceMotion) S.shake = Math.max(S.shake, 9);
  },
};
