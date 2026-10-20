import { afloat } from '../../state.js';
import { factionOf } from '../../config/factions.js';
import { worldById } from '../../config/worlds.js';

// Sink every enemy ship.
export default {
  id: 'sink',
  about: 'Sink every enemy ship.',
  params: {},
  done: (o, G) => !G.ships.some((s) => s.team === 'enemy' && afloat(s)),
  brief: (o, B) => `Sink all ${B.enemy.length} enemy ships.`,
  won: (o, B) => `Every ${factionOf(B.faction || (B.world && worldById(B.world).faction)).adj} ship is on the bottom.`,
};
