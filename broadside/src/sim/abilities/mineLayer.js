import { S, afloat } from '../../state.js';
import { dropMine } from '../combat.js';

// Drops a mine astern whenever an enemy ship is within `range`, every `every` seconds.
export default {
  id: 'mineLayer',
  about: 'Drops a mine astern while an enemy is near.',
  params: { every: 'seconds between mines', range: 'how near an enemy must be' },
  defaults: { every: 8, range: 300 },
  init(s, a) { a.t = a.every; },
  update(s, a, dt) {
    a.t -= dt;
    if (a.t > 0) return;
    if (S.G.ships.some((o) => o.team !== s.team && afloat(o) && Math.hypot(o.x - s.x, o.y - s.y) < a.range)) {
      dropMine(s);
      a.t = a.every;
    }
  },
};
