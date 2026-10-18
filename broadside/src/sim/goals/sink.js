import { afloat } from '../../state.js';

// Sink every enemy ship.
export default {
  id: 'sink',
  about: 'Sink every enemy ship.',
  params: {},
  done: (o, G) => !G.ships.some((s) => s.team === 'enemy' && afloat(s)),
  brief: (o, B) => `Sink all ${B.enemy.length} enemy ships.`,
  won: (o, B) => `The ${B.foe} is on the bottom.`,
};
