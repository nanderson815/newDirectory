import { S, afloat } from '../../state.js';

// Carpenters patch the hull: `rate` hull a second once she has been out of action (no enemy within gun range,
// no hits taken) for `idle` seconds, plus `always` hull a second even in the thick of it, up to `max` of her
// full hull. The HUD shows "Repairing" while they work.
const near = (s) => S.G.ships.some((o) => o.team !== s.team && afloat(o) && Math.hypot(o.x - s.x, o.y - s.y) < Math.max(s.range, o.range) * 1.1) ||
  S.G.forts.some((f) => f.team !== s.team && f.state === 'active' && Math.hypot(f.x - s.x, f.y - s.y) < f.range * 1.1);

export default {
  id: 'repair',
  about: 'Carpenters patch the hull: slowly once out of action, or always at a low rate.',
  params: {
    rate: 'hull a second once out of action', idle: 'seconds out of gun range and unhit before the carpenters start',
    always: 'hull a second at all times, even in action', max: 'share of full hull they can patch back up to (0-1)',
  },
  defaults: { rate: 2, idle: 5, always: 0, max: 1 },
  init(s, a) { a.quiet = 0; a.hp = s.hp; },
  update(s, a, dt) {
    a.quiet = s.hp < a.hp || near(s) ? 0 : a.quiet + dt;
    const r = a.always + (a.quiet >= a.idle ? a.rate : 0), cap = s.maxHp * a.max;
    s.repairing = r > 0 && s.hp < cap;
    if (s.repairing) s.hp = Math.min(cap, s.hp + r * dt);
    a.hp = s.hp;
  },
  draw(s, a, api) {
    if (!s.repairing) return;
    const q = api.above(s);
    api.outlinedText('Repairing', q.x, q.y + 27, 11, '#9fe08a', 'center');
  },
};
