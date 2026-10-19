import { S, afloat } from '../../state.js';

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
      o.reload[0] -= extra; o.reload[1] -= extra;
      if (o.chasers) o.chaseT -= extra;
    }
  },
  draw(s, a, api) {
    api.seaCircle(s.x, s.y, a.radius, 56);
    api.stroke(s.team === 'player' ? 'rgba(246,210,122,0.5)' : 'rgba(239,106,88,0.5)', { width: 1, dash: DASH, offset: -S.clock * 8 });
  },
};
