import { S, afloat } from '../../state.js';
import { hasten } from '../guns.js';

// A flagship's example: friendly ships within `radius` of her reload in `reload` times the usual time (0.7: 30%
// faster). Several rally ships don't stack. The HUD rings her radius so you can keep the line close.
const DASH = [3, 9];

export default {
  id: 'rally',
  about: 'Friendly ships near her reload faster.',
  params: { radius: 'how near friends must be', reload: 'their reload time, times normal (0.7 = 30% faster)' },
  defaults: { radius: 180, reload: 0.7 },
  update(s, a, dt) {
    const G = S.G, extra = dt * (1 / a.reload - 1);
    for (const o of G.ships) {
      if (o === s || o.team !== s.team || !afloat(o) || o.rallied === G.t || Math.hypot(o.x - s.x, o.y - s.y) > a.radius) continue;
      o.rallied = G.t;
      hasten(o, extra); // every battery aboard (src/sim/guns.js)
    }
  },
  draw(s, a, api) {
    api.seaCircle(s.x, s.y, a.radius, 56);
    api.stroke(api.tint(s.team === 'player' ? api.MARK.chosen : api.MARK.enemy, 0.5), { width: api.LINE.hair, dash: DASH, offset: -S.clock * 8 });
  },
};
