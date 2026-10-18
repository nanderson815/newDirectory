import { S, afloat, showToast } from '../../state.js';
import { clamp, angDiff, reduceMotion } from '../../util.js';
import { hitShip } from '../combat.js';
import { avoidIslands } from '../steering.js';
import { sfx } from '../../audio/sfx.js';

// A reinforced bow: running bows-on into an enemy ship stoves in her hull (up to `dmg`, scaled by speed) and
// leaves her slowed for `slow` seconds; the rammer loses way too. Once every `every` seconds at most. AI rammers
// charge any foe within `charge`, then sheer off while they get under way again.
const BOW = 0.7; // half-angle off the bow that counts as bows-on

function nearestFoe(s, range) {
  let best = null, bd = range;
  for (const o of S.G.ships) {
    if (o.team === s.team || !afloat(o) || (o.hidden && s.team === 'player')) continue;
    const d = Math.hypot(o.x - s.x, o.y - s.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

export default {
  id: 'ram',
  about: 'Reinforced bow: sailing into an enemy ship stoves in her hull and slows both.',
  params: { dmg: 'damage at full speed', slow: 'seconds the rammed ship is slowed', every: 'seconds between rams', charge: 'AI rammers charge a foe this close' },
  defaults: { dmg: 26, slow: 4, every: 3, charge: 260 },
  init(s, a) { a.t = 0; },
  // Aim a little ahead of her so the bow meets her hull.
  steer(s, a) {
    if (a.t > 0) return null;
    const t = nearestFoe(s, a.charge);
    if (!t) return null;
    const d = Math.hypot(t.x - s.x, t.y - s.y), lead = Math.min(1.2, d / Math.max(s.v, 20)) * t.v * 0.6;
    return avoidIslands(s, Math.atan2(t.y + Math.sin(t.h) * lead - s.y, t.x + Math.cos(t.h) * lead - s.x), d);
  },
  update(s, a, dt) {
    a.t = Math.max(0, a.t - dt);
    if (a.t > 0 || s.v < s.speed * 0.3) return;
    for (const o of S.G.ships) {
      if (o.team === s.team || !afloat(o)) continue;
      const d = Math.hypot(o.x - s.x, o.y - s.y);
      if (d >= (s.L + o.L) * 0.42 || Math.abs(angDiff(s.h, Math.atan2(o.y - s.y, o.x - s.x))) > BOW) continue;
      const dmg = Math.round(a.dmg * clamp(s.v / s.speed, 0.4, 1.2) * (s.team === 'enemy' ? S.G.ai.dmgMul : 1));
      hitShip(o, { dmg, team: s.team, x: (s.x + o.x) / 2, y: (s.y + o.y) / 2 });
      o.slowT = Math.max(o.slowT, a.slow); o.v *= 0.5;
      s.slowT = Math.max(s.slowT, a.slow * 0.4); s.v *= 0.35;
      a.t = a.every;
      if (afloat(o)) showToast('Rammed!', o, 1.2);
      sfx.boom(0.8, 0.6, o.x, o.y);
      if (!reduceMotion && (o.team === 'player' || s.team === 'player')) S.shake = Math.max(S.shake, 7);
      return;
    }
  },
};
