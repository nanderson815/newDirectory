import { S, afloat, showBanner } from '../../state.js';
import { PI, clamp } from '../../util.js';
import { spawnShip } from '../spawn.js';

// Puts a ship of `type` over the side every `every` seconds while an enemy is within `range`,
// keeping at most `max` of them afloat. Calico Kate uses it to send in her fireships.
export default {
  id: 'launcher',
  defaults: { type: 'fireship', name: 'Fireship', every: 16, max: 3, range: 520, banner: ['Fireship!', 'Sink her before she reaches you'] },
  init(s, a) { a.t = a.every * 0.5; },
  update(s, a, dt) {
    const G = S.G;
    a.t -= dt;
    if (a.t > 0) return;
    a.t = a.every;
    const live = G.ships.filter((o) => o.launchedBy === s.id && afloat(o)).length;
    if (live >= a.max || !G.ships.some((o) => o.team !== s.team && afloat(o) && Math.hypot(o.x - s.x, o.y - s.y) < a.range)) return;
    const side = Math.random() < 0.5 ? -1 : 1, ang = s.h + side * PI / 2;
    const x = clamp(s.x + Math.cos(ang) * s.B * 2.2, 40, G.W - 40), y = clamp(s.y + Math.sin(ang) * s.B * 2.2, 40, G.H - 40);
    const o = spawnShip({ type: a.type, name: a.name }, s.team, { x, y, h: s.h });
    o.launchedBy = s.id;
    if (a.banner) showBanner(a.banner[0], a.banner[1] || '', 1.8);
  },
};
