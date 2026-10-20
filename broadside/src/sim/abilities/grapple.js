import { S, afloat } from '../../state.js';
import { avoidIslands } from '../steering.js';
import { startBoarding, defence } from '../boarding.js';

// Corsair boarders: she closes with any enemy ship whose hull is down to `below` of full (boarders elsewhere wait
// for 40%) and, once alongside, throws her grapnels and sends her fighting men across, as long as she has more of
// them than the defenders (by `odds`). AI captains carrying it steer for the nearest such ship within `chase`.
// Grapeshot thins her crew; sinking or out-sailing her is the other answer.
function quarry(s, a) {
  let best = null, bd = a.chase;
  for (const o of S.G.ships) {
    if (o.team === s.team || !afloat(o) || o.boarding || o.passive || o.boss || (o.hidden && s.team === 'player')) continue;
    if (o.hp > o.maxHp * a.below || s.marines <= defence(o) * a.odds) continue;
    const d = Math.hypot(o.x - s.x, o.y - s.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

export default {
  id: 'grapple',
  about: 'Corsair boarders: closes with a hurt enemy ship and boards her sooner than other ships would.',
  params: {
    below: 'board ships whose hull is down to this share of full (0-1)',
    odds: 'only when her fighting men outnumber the defenders by this much',
    chase: 'AI captains steer for such a ship within this range',
  },
  defaults: { below: 0.6, odds: 1.1, chase: 340 },
  steer(s, a) {
    if (s.boarding || s.fleeing || s.team === 'player') return null;
    const t = quarry(s, a);
    return t ? avoidIslands(s, Math.atan2(t.y - s.y, t.x - s.x), Math.hypot(t.x - s.x, t.y - s.y)) : null;
  },
  update(s, a, dt) {
    // Only AI captains grapple on their own (your ships board when you tap Board), and not every instant.
    if (s.boarding || s.team === 'player' || Math.random() > dt * 2) return;
    const t = quarry(s, a);
    if (t) startBoarding(s, t, a.below);
  },
};
